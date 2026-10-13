import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeTransport, type ScriptStep } from "./fake";
import { RawRepl, RAW_PROMPT, STOPPED_MESSAGE } from "./rawRepl";
import { DeviceError } from "./types";

const OK_END = "OK\x04\x04>";
const TIMEOUT_MSG = "코드가 지금 무엇을 기다리고 있을까요? 멈춤을 눌러 보세요";
const enter: ScriptStep = { on: "\x01", reply: RAW_PROMPT };

function setup(script: ScriptStep[]) {
  const t = new FakeTransport(script);
  const repl = new RawRepl(t, { settleMs: 0, chunkDelayMs: 0 });
  return { t, repl };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.useRealTimers());

describe("RawRepl.enterRaw", () => {
  it("\\x03\\x03\\x01 을 보내고 raw REPL 프롬프트를 기다린다", async () => {
    const { t, repl } = setup([]);
    let done = false;
    const p = repl.enterRaw().then(() => { done = true; });
    await tick();
    expect(t.writtenText).toBe("\x03\x03\x01");
    t.push("\r\nMicroPython v1.24.1 on 2024-11-29; Generic ESP32 module with ESP32\r\n>>> raw REPL; CTRL-B");
    await tick();
    expect(done).toBe(false);
    expect(repl.mode).not.toBe("raw");
    t.push(" to exit\r\n>");
    await p;
    expect(repl.mode).toBe("raw");
  });
});

describe("RawRepl.enterRaw 잔여 출력", () => {
  it("멈춘 뒤 쉬는 동안 온 글자는 버리고 \\x01 뒤의 프롬프트를 기다린다", async () => {
    const t = new FakeTransport([{ on: "\x03\x03", reply: `old output ${RAW_PROMPT}` }]);
    const repl = new RawRepl(t, { settleMs: 5, chunkDelayMs: 0 });
    let done = false;
    const p = repl.enterRaw().then(() => { done = true; });
    await new Promise((r) => setTimeout(r, 20));
    expect(t.writtenText).toBe("\x03\x03\x01");
    expect(done).toBe(false);
    t.push(RAW_PROMPT);
    await p;
    expect(repl.mode).toBe("raw");
  });
});

describe("RawRepl.exec", () => {
  it("코드 + \\x04 를 보내고 OK 뒤 출력, \\x04\\x04> 에서 ok", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: "OK1\r\n\x04\x04>" }]);
    await repl.enterRaw();
    const r = await repl.exec("print(1)");
    expect(t.writtenText).toBe("\x03\x03\x01print(1)\x04");
    expect(r).toEqual({ ok: true, output: "1\r\n" });
  });

  it("raw 모드가 아니면 먼저 들어간다", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: OK_END }]);
    expect((await repl.exec("x = 1")).ok).toBe(true);
    expect(t.writtenText).toBe("\x03\x03\x01x = 1\x04");
  });

  it("출력은 도착하는 대로 onOutput 으로 흘려보낸다", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: ["OK", "a\r\n"] }]);
    const chunks: string[] = [];
    let done = false;
    const p = repl.exec("print('a')\nprint('b')", (c) => chunks.push(c)).then((r) => { done = true; return r; });
    await tick();
    expect(chunks).toEqual(["a\r\n"]);
    expect(done).toBe(false);
    t.push("b\r");
    await tick();
    t.push("\n\x04");
    await tick();
    t.push("\x04>");
    const r = await p;
    expect(chunks.join("")).toBe("a\r\nb\r\n");
    expect(r).toEqual({ ok: true, output: "" });
  });

  it("예외: ok false, 줄 번호와 메시지와 Traceback 원문", async () => {
    const tb = "Traceback (most recent call last):\r\n  File \"<stdin>\", line 3, in <module>\r\nNameError: name 'd' isn't defined\r\n";
    const { repl } = setup([enter, { on: "\x04", reply: `OK\x04${tb}\x04>` }]);
    const r = await repl.exec("a = 1\nb = 2\nprint(d)");
    expect(r.ok).toBe(false);
    expect(r.error).toEqual({ line: 3, message: "NameError: name 'd' isn't defined", traceback: tb });
  });

  it("코드는 256바이트 이하 조각으로 보낸다 (한글 포함)", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: OK_END }]);
    const code = Array.from({ length: 40 }, (_, i) => `print("줄 ${i} 안녕하세요")`).join("\n");
    await repl.exec(code);
    const codeWrites = t.writes.slice(2, -1);
    expect(codeWrites.length).toBeGreaterThan(2);
    for (const w of codeWrites) expect(typeof w === "string" ? new TextEncoder().encode(w).length : w.length).toBeLessThanOrEqual(256);
    expect(t.writtenText).toBe(`\x03\x03\x01${code}\x04`);
  });

  it("OK 가 3초 안에 오지 않으면 시간 초과 오류", async () => {
    vi.useFakeTimers();
    const { repl } = setup([enter]);
    const p = repl.exec("print(1)");
    const check = expect(p).rejects.toMatchObject({ code: "timeout", message: TIMEOUT_MSG });
    await vi.advanceTimersByTimeAsync(2999);
    await vi.advanceTimersByTimeAsync(1);
    await check;
    expect(repl.mode).toBe("unknown");
  });

  it("실행 중인 프로그램은 시간 제한 없이 기다린다", async () => {
    vi.useFakeTimers();
    const { t, repl } = setup([enter, { on: "\x04", reply: "OKtick\r\n" }]);
    let done = false;
    const p = repl.exec("while True: ...").then((r) => { done = true; return r; });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done).toBe(false);
    t.push("\x04\x04>");
    expect((await p).ok).toBe(true);
  });

  it("실행 중 연결이 끊기면 disconnected 오류", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: "OK" }]);
    const p = repl.exec("while True: pass");
    const check = expect(p).rejects.toMatchObject({ code: "disconnected" });
    await tick();
    t.disconnect();
    await check;
    await expect(repl.exec("print(1)")).rejects.toBeInstanceOf(DeviceError);
  });
});

describe("RawRepl.interrupt (멈춤)", () => {
  it("\\x03\\x03 을 보낸다", async () => {
    const { t, repl } = setup([]);
    await repl.interrupt();
    expect(t.writtenText).toBe("\x03\x03");
  });

  it("실행 중 멈춤: KeyboardInterrupt 는 오류가 아니라 stopped", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: "OKrunning\r\n" }]);
    const p = repl.exec("while True:\n    print('running')");
    await tick();
    await repl.interrupt();
    expect(t.writtenText.endsWith("\x04\x03\x03")).toBe(true);
    t.push("\x04Traceback (most recent call last):\r\n  File \"<stdin>\", line 2, in <module>\r\nKeyboardInterrupt: \r\n\x04>");
    expect(await p).toEqual({ ok: true, stopped: true, output: "running\r\n" });
  });

  it("멈춤 뒤 3초 안에 끝나지 않으면 시간 초과", async () => {
    vi.useFakeTimers();
    const { repl } = setup([enter, { on: "\x04", reply: "OK" }]);
    const p = repl.exec("while True: pass");
    const check = expect(p).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(10_000);
    await repl.interrupt();
    await vi.advanceTimersByTimeAsync(3000);
    await check;
  });
});

describe("RawRepl 파일", () => {
  it("writeFile: open / write / close 를 raw 모드에서 실행한다", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: OK_END }, { on: "\x04", reply: OK_END }, { on: "\x04", reply: OK_END }]);
    await repl.writeFile("main.py", "a\nb");
    expect(t.writtenText).toBe("\x03\x03\x01f = open('main.py', 'w')\x04f.write('a\\nb')\x04f.close()\x04");
  });

  it("writeFile: 특수 문자 이스케이프와 긴 내용 나누어 쓰기", async () => {
    const steps = Array.from({ length: 5 }, () => ({ on: "\x04", reply: OK_END }));
    const { t, repl } = setup([enter, ...steps]);
    await repl.writeFile("lib.py", `it's \\ \t\r` + "x".repeat(1100));
    const writes = t.writtenText.split("\x04").filter((s) => s.startsWith("f.write("));
    expect(writes.length).toBe(3);
    expect(writes[0].startsWith("f.write('it\\'s \\\\ \\t\\r")).toBe(true);
  });

  it("writeFile: 보드 오류면 파일을 닫고 오류를 던진다", async () => {
    const tb = "Traceback (most recent call last):\r\n  File \"<stdin>\", line 1, in <module>\r\nOSError: 28\r\n";
    const { t, repl } = setup([enter, { on: "\x04", reply: OK_END }, { on: "\x04", reply: `OK\x04${tb}\x04>` }, { on: "\x04", reply: OK_END }]);
    await expect(repl.writeFile("main.py", "a")).rejects.toThrow("OSError: 28");
    expect(t.writtenText.endsWith("f.close()\x04")).toBe(true);
  });

  it("writeFile 도중 멈춤: 남은 조각은 쓰지 않고 파일을 닫은 뒤 오류", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: OK_END }, { on: "\x04", reply: "OK" }, { on: "\x04", reply: OK_END }]);
    const p = repl.writeFile("lib.py", "x".repeat(2000));
    const check = expect(p).rejects.toThrow(STOPPED_MESSAGE);
    await tick();
    await repl.interrupt();
    t.push("\x04Traceback (most recent call last):\r\n  File \"<stdin>\", line 1, in <module>\r\nKeyboardInterrupt: \r\n\x04>");
    await check;
    expect(t.writtenText.split("f.write(").length - 1).toBe(1);
    expect(t.writtenText.endsWith("\x03\x03f.close()\x04")).toBe(true);
  });

  it("listFiles: os.listdir() 결과를 배열로", async () => {
    const { t, repl } = setup([enter, { on: "\x04", reply: "OK['boot.py', 'main.py', 'ssd1306.py']\r\n\x04\x04>" }]);
    expect(await repl.listFiles()).toEqual(["boot.py", "main.py", "ssd1306.py"]);
    expect(t.writtenText).toContain("import os");
    expect(t.writtenText).toContain("print(os.listdir())");
  });

  it("listFiles: 빈 목록", async () => {
    const { repl } = setup([enter, { on: "\x04", reply: "OK[]\r\n\x04\x04>" }]);
    expect(await repl.listFiles()).toEqual([]);
  });
});

describe("RawRepl.softReset", () => {
  it("\\x02 로 일반 REPL 에 돌아가 \\x04 로 다시 시작하고, 그 뒤 출력은 idle 로", async () => {
    const { t, repl } = setup([enter, { on: "\x02", reply: "\r\nMicroPython v1.24.1\r\nType \"help()\" for more information.\r\n>>> " }]);
    const idle: string[] = [];
    repl.onIdleOutput((s) => idle.push(s));
    await repl.enterRaw();
    await repl.softReset();
    expect(t.writtenText).toBe("\x03\x03\x01\x02\x04");
    expect(repl.mode).toBe("friendly");
    t.push("MPY: soft reboot\r\nhello\r\n");
    await tick();
    expect(idle.join("")).toBe("MPY: soft reboot\r\nhello\r\n");
  });
});
