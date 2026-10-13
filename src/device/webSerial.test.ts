import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeTransport, type ScriptStep } from "./fake";
import { RAW_PROMPT } from "./rawRepl";
import type { DeviceStatus, OutputEvent } from "./types";
import { WebSerialDevice, WebSerialTransport } from "./webSerial";

afterEach(() => vi.unstubAllGlobals());

const enter: ScriptStep = { on: "\x01", reply: RAW_PROMPT };
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(script: ScriptStep[]) {
  const t = new FakeTransport(script);
  const d = new WebSerialDevice({ openTransport: async () => t, repl: { settleMs: 0, chunkDelayMs: 0 } });
  const statuses: DeviceStatus[] = [];
  const out: OutputEvent[] = [];
  d.onStatus((s) => statuses.push(s));
  d.onOutput((e) => out.push(e));
  return { t, d, statuses, out };
}

describe("WebSerialDevice (가짜 전송)", () => {
  it("connect: 포트를 열고 raw REPL 을 확인한다", async () => {
    const { t, d, statuses } = setup([enter]);
    await d.connect();
    expect(t.writtenText).toBe("\x03\x03\x01");
    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("run: 출력은 stdout 으로 흘리고, 오류는 RunResult 에", async () => {
    const tb = "Traceback (most recent call last):\r\n  File \"<stdin>\", line 2, in <module>\r\nValueError: x\r\n";
    const { d, statuses, out } = setup([enter, { on: "\x04", reply: ["OK", "1\r\n", `\x04${tb}\x04>`] }]);
    await d.connect();
    const r = await d.run("print(1)\nraise ValueError('x')");
    expect(out).toEqual([{ kind: "stdout", text: "1\r\n" }]);
    expect(r).toEqual({ ok: false, error: { line: 2, message: "ValueError: x", traceback: tb } });
    expect(statuses.slice(-2)).toEqual(["running", "connected"]);
  });

  it("stop: \\x03\\x03 을 보내고 실행은 stopped 로 끝난다", async () => {
    const { t, d } = setup([enter, { on: "\x04", reply: "OK" }]);
    await d.connect();
    const p = d.run("while True: pass");
    await tick();
    await d.stop();
    expect(t.writtenText.endsWith("\x03\x03")).toBe(true);
    t.push("\x04Traceback (most recent call last):\r\n  File \"<stdin>\", line 1, in <module>\r\nKeyboardInterrupt: \r\n\x04>");
    expect(await p).toEqual({ ok: true, stopped: true });
    expect(d.status).toBe("connected");
  });

  it("saveFile: 저장 중 → 연결됨, softReset 뒤 보드 출력은 stdout", async () => {
    const ok = { on: "\x04", reply: "OK\x04\x04>" };
    const { t, d, statuses, out } = setup([enter, ok, ok, ok, { on: "\x02", reply: "\r\n>>> " }]);
    await d.connect();
    await d.saveFile("main.py", "print(1)");
    expect(statuses.slice(-2)).toEqual(["saving", "connected"]);
    await d.softReset();
    t.push("MPY: soft reboot\r\n1\r\n");
    await tick();
    expect(out.map((e) => e.text).join("")).toBe("MPY: soft reboot\r\n1\r\n");
  });

  it("보드가 뽑히면 disconnected 와 system 안내", async () => {
    const { t, d, out } = setup([enter]);
    await d.connect();
    t.disconnect();
    await tick();
    expect(d.status).toBe("disconnected");
    expect(out).toContainEqual({ kind: "system", text: "보드 연결이 끊겼어요" });
  });

  it("disconnect: 일반 REPL 로 돌려놓고 전송을 닫는다", async () => {
    const { t, d, out } = setup([enter]);
    await d.connect();
    await d.disconnect();
    expect(t.writtenText.endsWith("\x02")).toBe(true);
    expect(t.closed).toBe(true);
    expect(d.status).toBe("disconnected");
    expect(out.filter((e) => e.kind === "system")).toEqual([]);
  });

  it("실행 중 disconnect: \\x03\\x03 먼저 보내고, 실행은 stopped 로 끝난다", async () => {
    const { t, d } = setup([enter, { on: "\x04", reply: "OKtick\r\n" }]);
    await d.connect();
    const p = d.run("while True: pass");
    await tick();
    await d.disconnect();
    expect(t.writtenText.endsWith("\x04\x03\x03\x02")).toBe(true);
    expect(await p).toEqual({ ok: true, stopped: true });
    expect(d.status).toBe("disconnected");
  });

  it("connect 실패(응답 없음)면 no-response 로 실패하고 disconnected 로 돌아가 전송을 닫는다", async () => {
    vi.useFakeTimers();
    try {
      const { t, d } = setup([]);
      const check = expect(d.connect()).rejects.toMatchObject({ code: "no-response", message: "보드가 대답하지 않아요. MicroPython이 들어 있는 보드인지 확인해 주세요" });
      await vi.advanceTimersByTimeAsync(6000);
      await check;
      expect(d.status).toBe("disconnected");
      expect(t.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("WebSerialTransport.open 오류", () => {
  it("navigator.serial 이 없으면 unsupported (Chrome에서 열어 주세요)", async () => {
    vi.stubGlobal("navigator", {});
    await expect(WebSerialTransport.open()).rejects.toMatchObject({ code: "unsupported", message: "Chrome에서 열어 주세요" });
  });
  it("포트 선택 취소 → cancelled", async () => {
    vi.stubGlobal("navigator", { serial: { requestPort: async () => { throw new DOMException("No port selected by the user.", "NotFoundError"); } } });
    await expect(WebSerialTransport.open()).rejects.toMatchObject({ code: "cancelled" });
  });
  it("전에 허락한 보드가 있으면 고르기 창 없이 바로 연다", async () => {
    let opened = 0; let asked = 0;
    const granted = { open: async () => { opened++; }, setSignals: async () => undefined };
    vi.stubGlobal("navigator", { serial: { getPorts: async () => [granted], requestPort: async () => { asked++; return granted; } } });
    await WebSerialTransport.open();
    expect(opened).toBe(1);
    expect(asked).toBe(0);
  });
  it("허락한 보드가 안 열리면(뽑힘·사용 중) 고르기 창으로 넘어간다", async () => {
    let asked = 0;
    const stale = { open: async () => { throw new DOMException("Failed to open serial port.", "NetworkError"); } };
    const fresh = { open: async () => undefined, setSignals: async () => undefined };
    vi.stubGlobal("navigator", { serial: { getPorts: async () => [stale], requestPort: async () => { asked++; return fresh; } } });
    await WebSerialTransport.open();
    expect(asked).toBe(1);
  });
  it("열기 실패(다른 프로그램 사용 중·드라이버 문제) → busy", async () => {
    const port = { open: async () => { throw new DOMException("Failed to open serial port.", "NetworkError"); } };
    vi.stubGlobal("navigator", { serial: { requestPort: async () => port } });
    await expect(WebSerialTransport.open()).rejects.toMatchObject({ code: "busy", message: "보드 포트를 열 수 없어요. 다른 프로그램(PyCharm 등)이 쓰고 있으면 닫고, 아니면 USB를 뽑았다 다시 꽂아 보세요" });
  });
});

function stubPort(write: (chunk: Uint8Array) => Promise<void> | void) {
  const readable = new ReadableStream<Uint8Array>();
  const writable = new WritableStream<Uint8Array>({ write });
  const port = Object.assign(new EventTarget(), {
    readable, writable,
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    setSignals: vi.fn(async () => {}),
  });
  vi.stubGlobal("navigator", { serial: { requestPort: async () => port } });
  return port;
}

describe("WebSerialTransport 쓰기", () => {
  it("열고 나서 DTR/RTS 를 내린다 (실패해도 계속)", async () => {
    const port = stubPort(() => {});
    port.setSignals.mockRejectedValueOnce(new Error("not supported"));
    await WebSerialTransport.open();
    expect(port.setSignals).toHaveBeenCalledWith({ dataTerminalReady: false, requestToSend: false });
  });

  it("동시에 부른 write 는 차례로 모두 보낸다", async () => {
    const sent: string[] = [];
    stubPort(async (chunk) => {
      await new Promise((r) => setTimeout(r, 5));
      sent.push(new TextDecoder().decode(chunk));
    });
    const t = await WebSerialTransport.open();
    await Promise.all([t.write("code"), t.write("\x03\x03"), t.write(new TextEncoder().encode("\x02"))]);
    expect(sent).toEqual(["code", "\x03\x03", "\x02"]);
  });

  it("쓰기가 실패하면(뽑힘) disconnected", async () => {
    stubPort(() => { throw new DOMException("The device has been lost.", "NetworkError"); });
    const t = await WebSerialTransport.open();
    await expect(t.write("a")).rejects.toMatchObject({ code: "disconnected" });
  });
});

describe("WebSerialTransport 읽기·쓰기", () => {
  it("115200 으로 열고, 바이트 조각에 걸친 UTF-8 을 이어 붙여 읽는다", async () => {
    const bytes = new TextEncoder().encode("안녕\r\n");
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } });
    const sent: Uint8Array[] = [];
    const writable = new WritableStream<Uint8Array>({ write: (chunk) => { sent.push(chunk); } });
    const port = Object.assign(new EventTarget(), {
      readable, writable, opened: 0,
      open: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    });
    vi.stubGlobal("navigator", { serial: { requestPort: async () => port } });
    const t = await WebSerialTransport.open();
    expect(port.open).toHaveBeenCalledWith({ baudRate: 115200 });
    const it = t.read()[Symbol.asyncIterator]();
    controller.enqueue(bytes.slice(0, 2));
    controller.enqueue(bytes.slice(2));
    let text = "";
    while (text !== "안녕\r\n") text += (await it.next()).value;
    await t.write("\x03");
    expect(new TextDecoder().decode(sent[0])).toBe("\x03");
    const lost = vi.fn();
    t.onDisconnect(lost);
    port.dispatchEvent(new Event("disconnect"));
    expect(lost).toHaveBeenCalled();
    await t.close();
    expect(port.close).toHaveBeenCalled();
  });
});
