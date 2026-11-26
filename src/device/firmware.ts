import { RawRepl } from "./rawRepl";
import { DeviceError, type Transport } from "./types";
import { getSerial, WebSerialTransport, type SerialLike, type SerialPortLike } from "./webSerial";

/*
 * MicroPython 펌웨어를 브라우저에서 바로 설치한다 (Web Serial + Espressif 공식 esptool-js).
 * React·DOM 화면을 모른다. 화면은 src/app/firmware/ 에 있다.
 *
 * 흐름
 *   1. 보드 찾기: 전에 허락한 보드(getPorts)가 꽂혀 있으면 바로 쓴다. 없으면 "연결되지 않았어요"를 먼저 알리고,
 *      학생이 「보드 찾기」를 누르면 고르기 창(requestPort, USB 시리얼 칩만)을 연다.
 *      브라우저는 허락받지 않은 보드를 볼 수 없다 (Web Serial 보안 규칙) — 처음 한 번은 고르기 창이 꼭 필요하다.
 *   2. 펌웨어 확인: raw REPL 이 대답하면 MicroPython 이 있다 (판 번호도 읽는다). 대답이 없으면 없다.
 *   3. 설치: 펌웨어(.bin)를 받아 확인(크기·SHA-256) → 다운로드 모드로 접속 → 전체 지우기 → 0x1000 에 쓰기 → 다시 켜기.
 *
 * 펌웨어 파일은 public/blocklab/firmware/ 에 있다 (MIT, micropython.org 의 ESP32_GENERIC 그대로).
 * 라이브러리 빌드가 dist-lib/firmware/ 로 내고, 허브는 /blocklab/firmware/ 로 서빙한다.
 */

/** 설치하는 펌웨어. 보드 수업이 쓰는 판과 같다 (2026-10-14 실보드 v1.29.0) */
export const FIRMWARE = {
  version: "1.29.0",
  file: "ESP32_GENERIC-20260824-v1.29.0.bin",
  /** ESP32(클래식) 은 0x1000 부터 쓴다 (micropython.org 설치 안내) */
  address: 0x1000,
  bytes: 1_790_544,
  sha256: "e67ad6015a0a504c1fec9aa9bbf589d0432ed28e62546f4f8dd8a147f8bd95f6",
} as const;

/** 앱은 <BASE_URL>blocklab/firmware/, 라이브러리(허브)는 /blocklab/firmware/ */
export const FIRMWARE_URL = `${import.meta.env?.BASE_URL ?? "/"}blocklab/firmware/${FIRMWARE.file}`;

/** 수업 보드의 USB 시리얼 칩. 고르기 창에 이것만 보여 블루투스 포트 등을 고르지 않게 한다 */
export const BOARD_USB_CHIPS: ReadonlyArray<{ usbVendorId: number; name: string }> = [
  { usbVendorId: 0x1a86, name: "CH340" }, // Keyestudio ESP32 Plus, 많은 DevKit (CH9102 도 같은 번호)
  { usbVendorId: 0x10c4, name: "CP2102" }, // ESP32-DevKitC
  { usbVendorId: 0x0403, name: "FTDI" },
  { usbVendorId: 0x303a, name: "ESP32 USB" }, // Espressif 내장 USB
];

export type FirmwareErrorCode =
  | "unsupported" | "no-board" | "busy" | "no-bootloader" | "wrong-chip" | "download" | "lost" | "failed";

/** 학생 화면 문구 */
export const FIRMWARE_ERROR_MESSAGES: Record<FirmwareErrorCode, string> = {
  unsupported: "이 브라우저에서는 설치할 수 없어요. 컴퓨터의 Chrome 이나 Edge 에서 열어 주세요",
  "no-board": "보드가 연결되어 있지 않아요",
  busy: "다른 프로그램(PyCharm, 다른 탭 등)이 보드를 쓰고 있어요. 그 프로그램을 닫고 다시 해 주세요",
  "no-bootloader": "보드가 설치 모드로 들어가지 않았어요",
  "wrong-chip": "이 펌웨어는 ESP32 보드용이에요. 수업에서 쓰는 ESP32 보드인지 확인해 주세요",
  download: "펌웨어 파일을 받지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요",
  lost: "설치하는 도중에 보드 연결이 끊겼어요",
  failed: "설치하지 못했어요",
};

export class FirmwareError extends Error {
  readonly code: FirmwareErrorCode;
  constructor(code: FirmwareErrorCode, options?: { cause?: unknown }) {
    super(FIRMWARE_ERROR_MESSAGES[code], options);
    this.name = "FirmwareError";
    this.code = code;
  }
}

/** 찾은 보드 하나 (포트 + 칩 이름) */
export type BoardPort = { port: SerialPortLike; chip: string | null };

export type FirmwareCheck =
  /** MicroPython 이 대답했다. version 은 "1.29.0" 꼴 (읽지 못하면 null) */
  | { kind: "micropython"; version: string | null }
  /** 포트는 열렸는데 MicroPython 이 대답하지 않는다 (펌웨어 없음, 아두이노 스케치 등) */
  | { kind: "none" };

export type FlashPhase = "download" | "connect" | "erase" | "write" | "restart";
/** percent: 쓰기 단계의 진행률(0~100). 다른 단계는 0 */
export type FlashProgress = { phase: FlashPhase; percent: number };

export type FlashOptions = {
  onProgress?(p: FlashProgress): void;
  /** 느린 속도(115200)로 쓴다. 빠른 속도에서 실패했을 때 다시 시도용 */
  slow?: boolean;
};

/** 화면이 쓰는 설치 도구. 진짜(Web Serial)와 가짜(?device=fake)가 같은 꼴이다 */
export interface FirmwareInstaller {
  /** 이 브라우저가 Web Serial 을 지원하는가 */
  supported(): boolean;
  /** 전에 허락했고 지금 꽂혀 있는 수업 보드들 */
  grantedBoards(): Promise<BoardPort[]>;
  /** 고르기 창을 연다. 고르지 않으면 FirmwareError("no-board") */
  requestBoard(): Promise<BoardPort>;
  /** 허락한 보드를 꽂거나 뽑을 때 */
  onPlugChange(cb: () => void): () => void;
  /** MicroPython 이 들어 있는지 본다 (포트를 열었다가 닫는다) */
  check(board: BoardPort): Promise<FirmwareCheck>;
  /** 펌웨어를 설치한다 (보드의 파일도 모두 지워진다) */
  flash(board: BoardPort, options?: FlashOptions): Promise<void>;
}

/** 쓰기 진행률을 화면 전체 막대 값(0~100)으로. 받기 0~8 · 접속 8~15 · 지우기 15~35 · 쓰기 35~97 · 다시 켜기 97~100 */
export function overallPercent({ phase, percent }: FlashProgress): number {
  const p = Math.max(0, Math.min(100, percent));
  switch (phase) {
    case "download": return 4;
    case "connect": return 10;
    case "erase": return 22;
    case "write": return Math.round(35 + (p * 62) / 100);
    case "restart": return 98;
  }
}

/** VID 로 칩 이름. 수업 보드 칩이 아니면 null */
export function boardChipName(info: { usbVendorId?: number } | undefined): string | null {
  const vid = info?.usbVendorId;
  return BOARD_USB_CHIPS.find((c) => c.usbVendorId === vid)?.name ?? null;
}

/** 수업 보드로 보이는 포트인가 (USB 번호를 알 수 없는 오래된 브라우저는 일단 믿는다) */
export function isBoardPort(port: Pick<SerialPortLike, "getInfo">): boolean {
  if (!port.getInfo) return true;
  return boardChipName(port.getInfo()) !== null;
}

/** "1.29.0" 꼴의 두 판 번호 비교 (a 가 낮으면 음수) */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** 확인한 판이 설치할 판보다 낮은가 (모르면 false — 굳이 다시 깔라고 하지 않는다) */
export function isOlderFirmware(check: FirmwareCheck): boolean {
  return check.kind === "micropython" && check.version !== null && compareVersions(check.version, FIRMWARE.version) < 0;
}

/** 판 번호를 읽는 코드. "1.29.0" 한 줄을 찍는다 */
export const VERSION_PROBE = "import sys\nprint('.'.join(str(n) for n in sys.implementation.version[:3]))";

/** 받은 파일이 그 펌웨어인가: 크기, ESP 이미지 머리(0xE9), SHA-256 (계산할 수 있을 때) */
export async function validateFirmware(data: Uint8Array): Promise<boolean> {
  if (data.length !== FIRMWARE.bytes || data[0] !== 0xe9) return false;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return true;
  const digest = new Uint8Array(await subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  return hex === FIRMWARE.sha256;
}

/**
 * MicroPython 이 있는지 본다. raw REPL 에 두 번 들어가 보고(켜지는 중이면 첫 번째를 놓친다) 대답이 없으면 "none".
 * 포트를 열 수 없으면 FirmwareError("busy").
 */
export async function checkFirmware(
  port: SerialPortLike,
  open: (port: SerialPortLike) => Promise<Transport> = (p) => WebSerialTransport.openPort(p),
  timeoutMs = 1500,
): Promise<FirmwareCheck> {
  let transport: Transport;
  try {
    transport = await open(port);
  } catch (cause) {
    throw new FirmwareError("busy", { cause });
  }
  const repl = new RawRepl(transport, { timeoutMs });
  try {
    let entered = false;
    for (let attempt = 0; attempt < 2 && !entered; attempt++) {
      try {
        await repl.enterRaw();
        entered = true;
      } catch (e) {
        if (!(e instanceof DeviceError && e.code === "timeout")) throw e;
      }
    }
    if (!entered) return { kind: "none" };
    let version: string | null = null;
    try {
      const result = await repl.exec(VERSION_PROBE);
      version = /\d+\.\d+\.\d+/.exec(result.output)?.[0] ?? null;
    } catch {
      /* 판 번호는 몰라도 MicroPython 은 있다 */
    }
    await repl.exitRaw().catch(() => undefined);
    return { kind: "micropython", version };
  } catch (cause) {
    if (cause instanceof DeviceError && cause.code === "disconnected") throw new FirmwareError("lost", { cause });
    throw cause;
  } finally {
    await transport.close().catch(() => undefined);
  }
}

/** esptool-js 가 던진 오류를 학생 문구로 */
export function firmwareErrorFrom(e: unknown, phase: FlashPhase): FirmwareError {
  if (e instanceof FirmwareError) return e;
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  if (/lost|NetworkError|disconnected|device has been/i.test(text)) return new FirmwareError("lost", { cause: e });
  if (phase === "connect") {
    if (/open|InvalidState|busy|access/i.test(text)) return new FirmwareError("busy", { cause: e });
    return new FirmwareError("no-bootloader", { cause: e });
  }
  return new FirmwareError("failed", { cause: e });
}

let cachedFirmware: Uint8Array | null = null;

/** 펌웨어를 받아 확인한다 (한 번 받으면 이 페이지 동안 다시 쓰기) */
export async function downloadFirmware(fetchImpl: typeof fetch = fetch, url: string = FIRMWARE_URL): Promise<Uint8Array> {
  if (cachedFirmware) return cachedFirmware;
  let data: Uint8Array;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = new Uint8Array(await res.arrayBuffer());
  } catch (cause) {
    throw new FirmwareError("download", { cause });
  }
  if (!(await validateFirmware(data))) throw new FirmwareError("download");
  cachedFirmware = data;
  return data;
}

/** 빠른 속도 (CH340·CP2102 모두 됨). 실패하면 화면이 slow 로 다시 시도한다 */
const FAST_BAUD = 460_800;
const ROM_BAUD = 115_200;

/** Web Serial 진짜 설치 도구 */
export class WebSerialFirmwareInstaller implements FirmwareInstaller {
  private readonly serial: SerialLike | undefined;

  constructor(serial: SerialLike | undefined = getSerial()) {
    this.serial = serial;
  }

  supported(): boolean {
    return this.serial !== undefined;
  }

  async grantedBoards(): Promise<BoardPort[]> {
    if (!this.serial) throw new FirmwareError("unsupported");
    const ports = (await this.serial.getPorts?.().catch(() => [])) ?? [];
    return ports.filter(isBoardPort).map((port) => ({ port, chip: boardChipName(port.getInfo?.()) }));
  }

  async requestBoard(): Promise<BoardPort> {
    if (!this.serial) throw new FirmwareError("unsupported");
    try {
      const port = await this.serial.requestPort({ filters: BOARD_USB_CHIPS.map(({ usbVendorId }) => ({ usbVendorId })) });
      return { port, chip: boardChipName(port.getInfo?.()) };
    } catch (cause) {
      if (cause instanceof Error && cause.name === "SecurityError") throw new FirmwareError("unsupported", { cause });
      throw new FirmwareError("no-board", { cause });
    }
  }

  onPlugChange(cb: () => void): () => void {
    const serial = this.serial;
    if (!serial) return () => undefined;
    serial.addEventListener("connect", cb);
    serial.addEventListener("disconnect", cb);
    return () => {
      serial.removeEventListener("connect", cb);
      serial.removeEventListener("disconnect", cb);
    };
  }

  check(board: BoardPort): Promise<FirmwareCheck> {
    return checkFirmware(board.port);
  }

  async flash(board: BoardPort, options: FlashOptions = {}): Promise<void> {
    const report = (p: FlashProgress) => options.onProgress?.(p);
    let phase: FlashPhase = "download";
    report({ phase, percent: 0 });
    const data = await downloadFirmware();

    phase = "connect";
    report({ phase, percent: 0 });
    // esptool-js(약 0.9MB)는 설치할 때만 받는다
    const { ESPLoader, Transport } = await import("esptool-js");
    const transport = new Transport(board.port as never, false);
    try {
      const loader = new ESPLoader({
        transport,
        baudrate: options.slow ? ROM_BAUD : FAST_BAUD,
        romBaudrate: ROM_BAUD,
        terminal: { clean: () => undefined, write: () => undefined, writeLine: () => undefined },
      });
      await loader.main();
      if (loader.chip.CHIP_NAME !== "ESP32") throw new FirmwareError("wrong-chip");

      phase = "erase";
      report({ phase, percent: 0 });
      await loader.writeFlash({
        fileArray: [{ data, address: FIRMWARE.address }],
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "keep",
        eraseAll: true,
        compress: true,
        reportProgress: (_file, written, total) => {
          phase = "write";
          report({ phase, percent: total ? (written / total) * 100 : 0 });
        },
      });

      phase = "restart";
      report({ phase, percent: 100 });
      await loader.after("hard_reset");
    } catch (e) {
      throw firmwareErrorFrom(e, phase);
    } finally {
      await transport.disconnect().catch(() => undefined);
    }
  }
}

export type FakeFirmwareInstallerOptions = {
  /** 처음에 꽂혀 있는가 (기본 true) */
  plugged?: boolean;
  /** 처음 펌웨어 상태 (기본: 없음) */
  initial?: FirmwareCheck;
  /** 단계 사이 쉬는 시간 (기본 300ms) */
  stepMs?: number;
};

/** 가짜 설치 도구 (?device=fake, 시험). 보드 없이 같은 화면 흐름을 본다 */
export class FakeFirmwareInstaller implements FirmwareInstaller {
  private plugged: boolean;
  private state: FirmwareCheck;
  private readonly stepMs: number;
  private readonly listeners = new Set<() => void>();
  private readonly board: BoardPort = { port: new EventTarget() as unknown as SerialPortLike, chip: "CH340" };

  constructor(options: FakeFirmwareInstallerOptions = {}) {
    this.plugged = options.plugged ?? true;
    this.state = options.initial ?? { kind: "none" };
    this.stepMs = options.stepMs ?? 300;
  }

  supported(): boolean {
    return true;
  }

  async grantedBoards(): Promise<BoardPort[]> {
    return this.plugged ? [this.board] : [];
  }

  async requestBoard(): Promise<BoardPort> {
    if (!this.plugged) throw new FirmwareError("no-board");
    return this.board;
  }

  onPlugChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** 시험: 보드를 꽂거나 뽑는다 */
  setPlugged(plugged: boolean): void {
    this.plugged = plugged;
    for (const cb of this.listeners) cb();
  }

  async check(): Promise<FirmwareCheck> {
    await this.wait();
    if (!this.plugged) throw new FirmwareError("lost");
    return this.state;
  }

  async flash(_board: BoardPort, options: FlashOptions = {}): Promise<void> {
    const report = (p: FlashProgress) => options.onProgress?.(p);
    for (const phase of ["download", "connect", "erase"] as const) {
      report({ phase, percent: 0 });
      await this.wait();
    }
    for (let p = 0; p <= 100; p += 25) {
      if (!this.plugged) throw new FirmwareError("lost");
      report({ phase: "write", percent: p });
      await this.wait();
    }
    report({ phase: "restart", percent: 100 });
    await this.wait();
    this.state = { kind: "micropython", version: FIRMWARE.version };
  }

  private wait(): Promise<void> {
    return new Promise((r) => setTimeout(r, this.stepMs));
  }
}
