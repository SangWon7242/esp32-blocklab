import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FakeTransport } from "./fake";
import {
  boardChipName, checkFirmware, compareVersions, downloadFirmware, FakeFirmwareInstaller, FIRMWARE, FIRMWARE_URL, FirmwareError,
  firmwareErrorFrom, isBoardPort, isOlderFirmware, overallPercent, validateFirmware, VERSION_PROBE,
} from "./firmware";
import { RAW_PROMPT } from "./rawRepl";
import type { SerialPortLike } from "./webSerial";

const port = {} as SerialPortLike;
const BIN = path.resolve(__dirname, "../../public/blocklab/firmware", FIRMWARE.file);

describe("펌웨어 파일", () => {
  it("public/blocklab/firmware 의 파일이 적어 둔 크기·SHA-256 과 같다", async () => {
    const data = new Uint8Array(readFileSync(BIN));
    expect(data.length).toBe(FIRMWARE.bytes);
    expect(await validateFirmware(data)).toBe(true);
  });

  it("크기가 같아도 내용이 다르면 받지 않는다", async () => {
    const data = new Uint8Array(readFileSync(BIN));
    data[100] ^= 0xff;
    expect(await validateFirmware(data)).toBe(false);
  });

  it("주소는 <BASE_URL>blocklab/firmware/<파일>", () => {
    expect(FIRMWARE_URL.endsWith(`blocklab/firmware/${FIRMWARE.file}`)).toBe(true);
  });

  it("받은 파일이 틀리면 download 오류", async () => {
    const fakeFetch = (async () => new Response(new Uint8Array(10))) as unknown as typeof fetch;
    await expect(downloadFirmware(fakeFetch, "/x.bin")).rejects.toMatchObject({ code: "download" });
    const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(downloadFirmware(notFound, "/x.bin")).rejects.toMatchObject({ code: "download" });
  });
});

describe("보드 칩", () => {
  it("CH340 · CP2102 는 수업 보드, 블루투스 포트(USB 번호 없음)는 아니다", () => {
    expect(boardChipName({ usbVendorId: 0x1a86 })).toBe("CH340");
    expect(boardChipName({ usbVendorId: 0x10c4 })).toBe("CP2102");
    expect(isBoardPort({ getInfo: () => ({}) })).toBe(false);
    expect(isBoardPort({ getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }) })).toBe(true);
    expect(isBoardPort({})).toBe(true);
  });
});

describe("판 번호", () => {
  it("비교와 옛 판 여부", () => {
    expect(compareVersions("1.24.1", "1.29.0")).toBeLessThan(0);
    expect(compareVersions("1.29.0", "1.29.0")).toBe(0);
    expect(compareVersions("1.30.0", "1.29.0")).toBeGreaterThan(0);
    expect(isOlderFirmware({ kind: "micropython", version: "1.24.1" })).toBe(true);
    expect(isOlderFirmware({ kind: "micropython", version: FIRMWARE.version })).toBe(false);
    expect(isOlderFirmware({ kind: "micropython", version: null })).toBe(false);
    expect(isOlderFirmware({ kind: "none" })).toBe(false);
  });
});

describe("진행 막대", () => {
  it("단계 순서대로 커지고 쓰기는 35~97", () => {
    const seq = [
      overallPercent({ phase: "download", percent: 0 }),
      overallPercent({ phase: "connect", percent: 0 }),
      overallPercent({ phase: "erase", percent: 0 }),
      overallPercent({ phase: "write", percent: 0 }),
      overallPercent({ phase: "write", percent: 100 }),
      overallPercent({ phase: "restart", percent: 100 }),
    ];
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    expect(seq[3]).toBe(35);
    expect(seq[4]).toBe(97);
  });
});

describe("checkFirmware", () => {
  it("raw REPL 이 대답하면 MicroPython 과 판 번호", async () => {
    const t = new FakeTransport([
      { on: "\x01", reply: RAW_PROMPT },
      { on: "\x04", reply: "OK1.29.0\r\n\x04\x04>" },
    ]);
    const result = await checkFirmware(port, async () => t, 200);
    expect(result).toEqual({ kind: "micropython", version: "1.29.0" });
    expect(t.writtenText).toContain(VERSION_PROBE);
    expect(t.closed).toBe(true);
  });

  it("대답이 없으면(아두이노 스케치 등) none, 포트는 닫는다", async () => {
    const t = new FakeTransport([]);
    t.push("garbage from sketch");
    const result = await checkFirmware(port, async () => t, 30);
    expect(result).toEqual({ kind: "none" });
    expect(t.closed).toBe(true);
  });

  it("포트를 열 수 없으면 busy", async () => {
    await expect(checkFirmware(port, async () => { throw new Error("open failed"); }, 30)).rejects.toMatchObject({ code: "busy" });
  });
});

describe("firmwareErrorFrom", () => {
  it("접속 단계 실패는 설치 모드 문제, 열기 실패는 busy, 끊김은 lost", () => {
    expect(firmwareErrorFrom(new Error("Failed to connect with the device"), "connect").code).toBe("no-bootloader");
    expect(firmwareErrorFrom(new DOMException("Failed to open serial port.", "InvalidStateError"), "connect").code).toBe("busy");
    expect(firmwareErrorFrom(new DOMException("The device has been lost.", "NetworkError"), "write").code).toBe("lost");
    expect(firmwareErrorFrom(new Error("Invalid head of packet"), "write").code).toBe("failed");
    const own = new FirmwareError("wrong-chip");
    expect(firmwareErrorFrom(own, "connect")).toBe(own);
  });
});

describe("FakeFirmwareInstaller", () => {
  it("꽂혀 있지 않으면 보드가 없고, 꽂으면 알린다", async () => {
    const f = new FakeFirmwareInstaller({ plugged: false, stepMs: 0 });
    expect(await f.grantedBoards()).toEqual([]);
    await expect(f.requestBoard()).rejects.toMatchObject({ code: "no-board" });
    let told = 0;
    f.onPlugChange(() => { told += 1; });
    f.setPlugged(true);
    expect(told).toBe(1);
    expect(await f.grantedBoards()).toHaveLength(1);
  });

  it("설치하면 단계를 차례로 알리고 MicroPython 이 생긴다", async () => {
    const f = new FakeFirmwareInstaller({ stepMs: 0 });
    const [board] = await f.grantedBoards();
    expect(await f.check()).toEqual({ kind: "none" });
    const phases: string[] = [];
    await f.flash(board, { onProgress: (p) => { if (phases.at(-1) !== p.phase) phases.push(p.phase); } });
    expect(phases).toEqual(["download", "connect", "erase", "write", "restart"]);
    expect(await f.check()).toEqual({ kind: "micropython", version: FIRMWARE.version });
  });
});
