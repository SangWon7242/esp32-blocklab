import { parseTraceback } from "./traceback";
import { DeviceError, type RunResult, type Transport } from "./types";

/*
 * MicroPython raw REPL 상태 기계 (mpremote·ViperIDE 와 같은 절차). Transport 만 쓴다 (DOM 비의존).
 *
 *   enterRaw : \x03\x03 (실행 중단) → \x01 → "raw REPL; CTRL-B to exit\r\n>" 를 기다림
 *   exec     : 코드(256바이트 조각) → \x04 → "OK" → 출력 스트리밍 … \x04 → 오류 텍스트 … \x04>
 *   softReset: \x02 → ">>> " (일반 REPL) → \x04 (main.py 가 돈다; 그 뒤 출력은 idle 출력)
 *   interrupt: \x03\x03 (멈춤) — 잠금 없이 바로 보낸다
 *
 * 응답을 기다리는 단계(프롬프트·OK·Traceback 끝)는 3초 제한, 프로그램 출력 단계는 제한 없음(멈춤 뒤에는 다시 3초).
 * 한 번에 하나의 작업만 (잠금). 작업이 없을 때 들어온 글자는 onIdleOutput 으로 넘긴다.
 */

export const RAW_PROMPT = "raw REPL; CTRL-B to exit\r\n>";
const FRIENDLY_PROMPT = ">>> ";
const CHUNK_BYTES = 256;
/** f.write 한 번에 담을 글자 수 */
const WRITE_CHARS = 512;
/** 작업이 없고 idle 출력을 받는 쪽도 없을 때 쌓아 둘 최대 글자 수 */
const MAX_IDLE_BUFFER = 64 * 1024;

/** 저장·목록 읽기 도중 멈춤을 눌렀을 때 */
export const STOPPED_MESSAGE = "멈춤을 눌러 그만두었어요";

export type ReplMode = "unknown" | "raw" | "friendly";

export type RawReplOptions = {
  /** 프롬프트·OK 를 기다리는 시간 (기본 3000ms) */
  timeoutMs?: number;
  /** 코드 조각 사이 쉬는 시간 (기본 10ms, 보드 수신 버퍼 보호) */
  chunkDelayMs?: number;
  /** \x03\x03 뒤 \x01 을 보내기 전 쉬는 시간 (기본 100ms, 프로그램이 멈출 틈) */
  settleMs?: number;
};

export type ExecResult = RunResult & { output: string };

type Waiter = { check(): void; fail(e: Error): void; arm(ms: number): void };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** marker 의 앞부분으로 끝나는 꼬리 길이 (조각에 걸친 marker 를 흘려보내지 않으려고) */
function partialTail(buf: string, marker: string): number {
  for (let n = Math.min(marker.length - 1, buf.length); n > 0; n--) {
    if (buf.endsWith(marker.slice(0, n))) return n;
  }
  return 0;
}

/** JS 문자열 → 작은따옴표 Python 문자열 리터럴 (제어 문자는 이스케이프해 raw REPL 제어 글자와 겹치지 않게) */
export function pyStr(text: string): string {
  let out = "'";
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === "'") out += "\\'";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 0x20 || c === 0x7f) out += `\\x${c.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `${out}'`;
}

/** print(os.listdir()) 출력 "['a.py', 'b.py']" → 이름 배열 */
export function parsePyStrList(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
    names.push((m[1] ?? m[2]).replace(/\\(.)/g, "$1"));
  }
  return names;
}

/** `{'boot.py': 0, 'ssd1306.py': 4922}` 꼴(MicroPython dict 출력) → 이름 → 크기 */
export function parsePySizeDict(text: string): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const m of text.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*(\d+)/g)) sizes[m[1].replace(/\\(.)/g, "$1")] = Number(m[2]);
  return sizes;
}

export class RawRepl {
  mode: ReplMode = "unknown";
  private readonly transport: Transport;
  private readonly timeoutMs: number;
  private readonly chunkDelayMs: number;
  private readonly settleMs: number;
  private buf = "";
  private waiter: Waiter | null = null;
  private active = false;
  private closed = false;
  private stopRequested = false;
  private lock: Promise<unknown> = Promise.resolve();
  private idleSink: ((text: string) => void) | null = null;
  private readonly closeListeners = new Set<() => void>();

  constructor(transport: Transport, options: RawReplOptions = {}) {
    this.transport = transport;
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.chunkDelayMs = options.chunkDelayMs ?? 10;
    this.settleMs = options.settleMs ?? 100;
    void this.pump();
  }

  /** 작업 밖에서 들어온 보드 출력 (소프트 리셋 뒤 main.py 출력, 멈춤 뒤 일반 REPL 출력 등) */
  onIdleOutput(cb: ((text: string) => void) | null): void {
    this.idleSink = cb;
    if (cb && !this.active && this.buf) this.flushIdle();
  }

  /** 읽기가 끝났을 때 (보드 뽑힘, 전송 닫힘) */
  onClose(cb: () => void): () => void {
    this.closeListeners.add(cb);
    return () => { this.closeListeners.delete(cb); };
  }

  get isClosed(): boolean {
    return this.closed;
  }

  enterRaw(): Promise<void> {
    return this.withLock(() => this.enterRawUnlocked());
  }

  exec(code: string, onOutput?: (text: string) => void): Promise<ExecResult> {
    return this.withLock(async () => {
      await this.ensureRaw();
      return this.execUnlocked(code, onOutput);
    });
  }

  /** raw 모드에서 f = open(path, 'w') / f.write(...) / f.close() 실행 */
  writeFile(path: string, text: string): Promise<void> {
    return this.withLock(async () => {
      await this.ensureRaw();
      await this.execOrThrow(`f = open(${pyStr(path)}, 'w')`);
      const chars = Array.from(text);
      try {
        for (let i = 0; i < chars.length; i += WRITE_CHARS) {
          await this.execOrThrow(`f.write(${pyStr(chars.slice(i, i + WRITE_CHARS).join(""))})`);
        }
      } catch (e) {
        if (!(e instanceof DeviceError)) {
          this.stopRequested = false;
          await this.execUnlocked("f.close()").catch(() => undefined);
        }
        throw e;
      }
      await this.execOrThrow("f.close()");
    });
  }

  listFiles(): Promise<string[]> {
    return this.withLock(async () => {
      await this.ensureRaw();
      return parsePyStrList(await this.execOrThrow("import os\nprint(os.listdir())"));
    });
  }

  fileSizes(): Promise<Record<string, number>> {
    return this.withLock(async () => {
      await this.ensureRaw();
      return parsePySizeDict(await this.execOrThrow("import os\nprint({n: os.stat(n)[6] for n in os.listdir()})"));
    });
  }

  /** 일반 REPL 로 돌아가 소프트 리셋 (main.py 실행) */
  softReset(): Promise<void> {
    return this.withLock(async () => {
      if (this.mode !== "friendly") {
        await this.transport.write("\x02");
        await this.readUntil(FRIENDLY_PROMPT, this.timeoutMs);
        this.mode = "friendly";
      }
      await this.transport.write("\x04");
    });
  }

  /** 일반 REPL 로 돌려놓기 (연결 끊기 전, 응답을 기다리지 않음) */
  async exitRaw(): Promise<void> {
    if (this.closed) return;
    await this.transport.write("\x02");
    this.mode = "friendly";
  }

  /** 멈춤: \x03\x03. 실행 중이면 끝(\x04>)을 3초 안에 기다린다. */
  async interrupt(): Promise<void> {
    if (this.closed) return;
    this.stopRequested = true;
    await this.transport.write("\x03\x03");
    this.waiter?.arm(this.timeoutMs);
  }

  // ---- 내부 ----

  private async pump(): Promise<void> {
    try {
      for await (const text of this.transport.read()) this.receive(text);
    } catch {
      /* 읽기 오류 = 연결 끊김으로 본다 */
    }
    this.closed = true;
    this.waiter?.fail(new DeviceError("disconnected"));
    for (const cb of [...this.closeListeners]) cb();
  }

  private receive(text: string): void {
    if (!this.active && this.idleSink) {
      this.idleSink(text);
      return;
    }
    this.buf += text;
    if (!this.active && this.buf.length > MAX_IDLE_BUFFER) this.buf = this.buf.slice(-MAX_IDLE_BUFFER);
    this.waiter?.check();
  }

  private flushIdle(): void {
    const text = this.buf;
    this.buf = "";
    if (text) this.idleSink?.(text);
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lock.then(async () => {
      if (this.closed) throw new DeviceError("disconnected");
      this.active = true;
      this.stopRequested = false;
      try {
        return await fn();
      } finally {
        this.active = false;
        if (this.idleSink) this.flushIdle();
      }
    });
    this.lock = run.catch(() => undefined);
    return run;
  }

  /**
   * marker 가 올 때까지 기다려 그 앞 글자를 돌려주고 marker 까지 버퍼에서 지운다.
   * onData 가 있으면 앞 글자를 도착하는 대로 넘기고 빈 문자열을 돌려준다.
   * timeoutMs=null 이면 제한 없음 (interrupt 가 arm 으로 걸 수 있다).
   */
  private readUntil(marker: string, timeoutMs: number | null, onData?: (text: string) => void): Promise<string> {
    if (this.closed) return Promise.reject(new DeviceError("disconnected"));
    return new Promise<string>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const done = () => {
        if (timer) clearTimeout(timer);
        this.waiter = null;
      };
      const waiter: Waiter = {
        check: () => {
          const i = this.buf.indexOf(marker);
          if (i >= 0) {
            const before = this.buf.slice(0, i);
            this.buf = this.buf.slice(i + marker.length);
            done();
            if (onData) {
              if (before) onData(before);
              resolve("");
            } else resolve(before);
            return;
          }
          if (onData) {
            const keep = partialTail(this.buf, marker);
            const ready = this.buf.slice(0, this.buf.length - keep);
            this.buf = this.buf.slice(this.buf.length - keep);
            if (ready) onData(ready);
          }
        },
        fail: (e) => {
          done();
          reject(e);
        },
        arm: (ms) => {
          if (timer) return;
          timer = setTimeout(() => {
            this.mode = "unknown";
            waiter.fail(new DeviceError("timeout"));
          }, ms);
        },
      };
      this.waiter = waiter;
      if (timeoutMs !== null) waiter.arm(timeoutMs);
      waiter.check();
    });
  }

  private async ensureRaw(): Promise<void> {
    if (this.mode !== "raw") await this.enterRawUnlocked();
  }

  private async enterRawUnlocked(): Promise<void> {
    this.mode = "unknown";
    await this.transport.write("\x03\x03");
    if (this.settleMs > 0) await sleep(this.settleMs);
    // 멈춘 프로그램의 남은 출력·KeyboardInterrupt 를 버려 옛 프롬프트를 새 것으로 오인하지 않게
    this.buf = "";
    await this.transport.write("\x01");
    await this.readUntil(RAW_PROMPT, this.timeoutMs);
    this.mode = "raw";
  }

  private async sendCode(code: string): Promise<boolean> {
    const bytes = new TextEncoder().encode(code);
    for (let i = 0; i < bytes.length; i += CHUNK_BYTES) {
      if (this.stopRequested) return false;
      await this.transport.write(bytes.slice(i, i + CHUNK_BYTES));
      if (this.chunkDelayMs > 0 && i + CHUNK_BYTES < bytes.length) await sleep(this.chunkDelayMs);
    }
    return !this.stopRequested;
  }

  /** 멈춤 표시(stopRequested)는 작업(잠금) 단위로 지워진다: writeFile 도중 멈추면 남은 조각도 쓰지 않는다. */
  private async execUnlocked(code: string, onOutput?: (text: string) => void): Promise<ExecResult> {
    this.buf = "";
    if (!(await this.sendCode(code))) {
      // 올리는 도중 멈춤: \x03 이 raw REPL 입력 줄을 비웠다. 실행하지 않는다.
      return { ok: true, stopped: true, output: "" };
    }
    await this.transport.write("\x04");
    await this.readUntil("OK", this.timeoutMs);
    const output = await this.readUntil("\x04", this.stopRequested ? this.timeoutMs : null, onOutput);
    const errorText = await this.readUntil("\x04>", this.timeoutMs);
    const stopped = this.stopRequested;
    if (errorText.trim() === "") return { ok: true, output };
    const parsed = parseTraceback(errorText) ?? { line: null, message: errorText.trim() };
    if (stopped && parsed.message.startsWith("KeyboardInterrupt")) return { ok: true, stopped: true, output };
    return { ok: false, error: { ...parsed, traceback: errorText }, output };
  }

  /** 실행하고 출력을 돌려준다. 보드 오류면 마지막 줄 메시지로 Error 를 던진다. */
  private async execOrThrow(code: string): Promise<string> {
    const r = await this.execUnlocked(code);
    if (r.stopped) throw new Error(STOPPED_MESSAGE);
    if (!r.ok) throw new Error(r.error?.message || "보드에서 실행하지 못했어요");
    return r.output;
  }
}
