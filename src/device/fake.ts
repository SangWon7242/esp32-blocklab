import { DeviceBase } from "./base";
import { parseTraceback } from "./traceback";
import { DEVICE_BUSY_MESSAGE, DeviceError, type Device, type RunResult, type Transport } from "./types";

/* ---------------- FakeTransport: 스크립트된 응답 (RawRepl 테스트용) ---------------- */

/** 지금까지 쓴 글자(앞 단계 이후)에 on 이 나타나면 reply 를 보낸다. 배열이면 조각마다 따로 도착한다. */
export type ScriptStep = { on: string; reply: string | string[] };

export class FakeTransport implements Transport {
  /** write 에 넘어온 그대로 (조각 크기 검사용) */
  readonly writes: Array<Uint8Array | string> = [];
  closed = false;
  private readonly script: ScriptStep[];
  private readonly decoder = new TextDecoder();
  private written = "";
  private pending = "";
  private readonly queue: string[] = [];
  private wake: (() => void) | null = null;
  private ended = false;
  private readonly lostListeners: Array<() => void> = [];

  constructor(script: ScriptStep[] = []) {
    this.script = [...script];
  }

  /** 지금까지 쓴 모든 글자 */
  get writtenText(): string {
    return this.written;
  }

  async write(data: Uint8Array | string): Promise<void> {
    if (this.ended) throw new DeviceError("disconnected");
    this.writes.push(data);
    const text = typeof data === "string" ? data : this.decoder.decode(data, { stream: true });
    this.written += text;
    this.pending += text;
    for (let step = this.script[0]; step; step = this.script[0]) {
      const i = this.pending.indexOf(step.on);
      if (i < 0) break;
      this.pending = this.pending.slice(i + step.on.length);
      this.script.shift();
      for (const chunk of typeof step.reply === "string" ? [step.reply] : step.reply) this.push(chunk);
    }
  }

  /** 보드가 보낸 것처럼 글자를 흘린다 */
  push(text: string): void {
    if (this.ended) return;
    this.queue.push(text);
    this.wake?.();
    this.wake = null;
  }

  async *read(): AsyncIterable<string> {
    for (;;) {
      const next = this.queue.shift();
      if (next !== undefined) {
        yield next;
        continue;
      }
      if (this.ended) return;
      await new Promise<void>((r) => { this.wake = r; });
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.end();
  }

  onDisconnect(cb: () => void): void {
    this.lostListeners.push(cb);
  }

  /** 보드가 뽑힌 것처럼 */
  disconnect(): void {
    this.end();
    for (const cb of this.lostListeners) cb();
  }

  private end(): void {
    this.ended = true;
    this.wake?.();
    this.wake = null;
  }
}

/* ---------------- FakeDevice: 보드 없는 시연·e2e 용 ---------------- */

export type FakeDeviceOptions = {
  /**
   * print 인자 식 → 출력할 값. 식이 키와 같거나 ".키" 로 끝나면 쓴다 (sensor.temperature() ← "temperature()").
   * 기본값 { "get_distance()": "23" } 에 덧붙는다.
   */
  values?: Record<string, string>;
  /** print 줄 사이 쉬는 시간 (기본 0) */
  lineDelayMs?: number;
};

const DEFAULT_VALUES: Record<string, string> = { "get_distance()": "23" };

/** 최상위 쉼표로 인자 나누기 (괄호·문자열 안 쉼표는 건너뜀) */
function splitArgs(s: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === "\\") cur += s[++i] ?? "";
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === "\"") quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) {
      args.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

const STRING_LITERAL = /^(['"])((?:\\.|(?!\1).)*)\1$/;
const NUMBER_LITERAL = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

function unescapePy(s: string): string {
  return s.replace(/\\(.)/g, (_, c: string) => ({ n: "\n", t: "\t", r: "\r" })[c] ?? c);
}

export class FakeDevice extends DeviceBase implements Device {
  readonly files = new Map<string, string>([["boot.py", ""]]);
  private readonly values: Record<string, string>;
  private readonly lineDelayMs: number;
  private stopRequested = false;

  constructor(options: FakeDeviceOptions = {}) {
    super();
    this.values = { ...DEFAULT_VALUES, ...options.values };
    this.lineDelayMs = options.lineDelayMs ?? 0;
  }

  async connect(): Promise<void> {
    if (this.status !== "disconnected") return;
    this.setStatus("connecting");
    await Promise.resolve();
    this.setStatus("connected");
  }

  async disconnect(): Promise<void> {
    this.stopRequested = true;
    this.setStatus("disconnected");
  }

  async run(code: string): Promise<RunResult> {
    this.requireIdle();
    this.setStatus("running");
    this.stopRequested = false;
    try {
      const lines = code.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (this.stopRequested) return { ok: true, stopped: true };
        const line = lines[i].trim();
        const raised = /^raise\s+([A-Za-z_]\w*)\s*(?:\((.*)\))?$/.exec(line);
        if (raised) {
          const args = splitArgs(raised[2] ?? "").map((a) => this.evaluate(a));
          const traceback = `Traceback (most recent call last):\r\n  File "<stdin>", line ${i + 1}, in <module>\r\n${raised[1]}${args.length ? `: ${args.join(", ")}` : ""}\r\n`;
          const parsed = parseTraceback(traceback)!;
          return { ok: false, error: { ...parsed, traceback } };
        }
        const printed = /^print\((.*)\)$/.exec(line);
        if (!printed) continue;
        if (this.lineDelayMs > 0) {
          await new Promise((r) => setTimeout(r, this.lineDelayMs));
          if (this.stopRequested) return { ok: true, stopped: true };
        }
        const args = splitArgs(printed[1]).filter((a) => !/^\w+\s*=[^=]/.test(a));
        this.emit({ kind: "stdout", text: `${args.map((a) => this.evaluate(a)).join(" ")}\r\n` });
      }
      return { ok: true };
    } finally {
      if (this.status === "running") this.setStatus("connected");
    }
  }

  async saveFile(path: string, text: string): Promise<void> {
    this.requireIdle();
    this.setStatus("saving");
    await Promise.resolve();
    this.files.set(path, text);
    this.setStatus("connected");
  }

  async listFiles(): Promise<string[]> {
    this.requireConnected();
    return [...this.files.keys()];
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
  }

  async softReset(): Promise<void> {
    this.requireConnected();
  }

  private evaluate(expr: string): string {
    const str = STRING_LITERAL.exec(expr);
    if (str) return unescapePy(str[2]);
    if (NUMBER_LITERAL.test(expr)) return expr;
    for (const [key, value] of Object.entries(this.values)) {
      if (expr === key || expr.endsWith(`.${key}`)) return value;
    }
    return expr;
  }

  private requireConnected(): void {
    if (this.status === "disconnected" || this.status === "connecting") throw new DeviceError("disconnected");
  }

  private requireIdle(): void {
    this.requireConnected();
    if (this.status !== "connected") throw new Error(DEVICE_BUSY_MESSAGE);
  }
}
