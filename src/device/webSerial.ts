import { DeviceBase } from "./base";
import { RawRepl, type RawReplOptions } from "./rawRepl";
import { DEVICE_BUSY_MESSAGE, DeviceError, type Device, type RunResult, type Transport } from "./types";

/*
 * Web Serial (Chrome 전용). TypeScript DOM 라이브러리에 Web Serial 타입이 없어 쓰는 부분만 여기 적는다
 * (전역 Navigator 를 넓히지 않고, open() 안에서만 navigator.serial 을 꺼낸다).
 */
interface SerialPortLike extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}
interface SerialLike {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPortLike>;
}

const BAUD_RATE = 115200;

export class WebSerialTransport implements Transport {
  private readonly port: SerialPortLike;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private closing = false;
  private readonly encoder = new TextEncoder();
  /** 쓰기 차례 (멈춤·끊기가 코드 올리기와 겹쳐도 writer 잠금이 부딪히지 않게) */
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(port: SerialPortLike) {
    this.port = port;
  }

  /** 포트 고르기 창 → 115200 으로 열기. 미지원 → unsupported, 취소 → cancelled, 열기 실패 → busy */
  static async open(): Promise<WebSerialTransport> {
    const serial = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { serial?: SerialLike }).serial;
    if (!serial) throw new DeviceError("unsupported");
    let port: SerialPortLike;
    try {
      port = await serial.requestPort();
    } catch (cause) {
      if (cause instanceof Error && cause.name === "SecurityError") throw new DeviceError("unsupported", { cause });
      throw new DeviceError("cancelled", { cause });
    }
    try {
      await port.open({ baudRate: BAUD_RATE });
    } catch (cause) {
      throw new DeviceError("busy", { cause });
    }
    // ESP32 자동 리셋 회로: DTR/RTS 를 내려 EN/IO0 을 건드리지 않게 (지원하지 않으면 그냥 넘어감)
    try {
      await port.setSignals?.({ dataTerminalReady: false, requestToSend: false });
    } catch {
      /* 무시 */
    }
    return new WebSerialTransport(port);
  }

  write(data: Uint8Array | string): Promise<void> {
    const bytes = typeof data === "string" ? this.encoder.encode(data) : data;
    const run = this.writeChain.then(() => this.writeNow(bytes));
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async writeNow(bytes: Uint8Array): Promise<void> {
    const writable = this.port.writable;
    if (!writable) throw new DeviceError("disconnected");
    let writer: WritableStreamDefaultWriter<Uint8Array>;
    try {
      writer = writable.getWriter();
    } catch (cause) {
      throw new DeviceError("disconnected", { cause });
    }
    try {
      await writer.write(bytes);
    } catch (cause) {
      throw new DeviceError("disconnected", { cause });
    } finally {
      writer.releaseLock();
    }
  }

  async *read(): AsyncIterable<string> {
    const decoder = new TextDecoder("utf-8");
    // 치명적이지 않은 오류(break·framing)는 readable 이 새로 생긴다. 치명적이면 null 이 되어 끝난다.
    while (this.port.readable && !this.closing) {
      const reader = this.port.readable.getReader();
      this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = value ? decoder.decode(value, { stream: true }) : "";
          if (text) yield text;
        }
      } catch {
        /* 다음 readable 로 이어 간다 */
      } finally {
        reader.releaseLock();
        this.reader = null;
      }
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    const reader = this.reader;
    if (reader) {
      await reader.cancel().catch(() => undefined);
      try { reader.releaseLock(); } catch { /* 이미 풀림 */ }
    }
    await this.port.close().catch(() => undefined);
  }

  onDisconnect(cb: () => void): void {
    this.port.addEventListener("disconnect", () => cb());
  }
}

export type WebSerialDeviceOptions = {
  /** 전송 열기 (기본: WebSerialTransport.open). 테스트에서 가짜 전송을 넣는다. */
  openTransport?: () => Promise<Transport>;
  repl?: RawReplOptions;
};

export class WebSerialDevice extends DeviceBase implements Device {
  private readonly openTransport: () => Promise<Transport>;
  private readonly replOptions: RawReplOptions;
  private transport: Transport | null = null;
  private repl: RawRepl | null = null;
  /** 실행 중에 사용자가 끊은 연결 (그 run 은 오류 대신 stopped) */
  private userClosed: RawRepl | null = null;

  constructor(options: WebSerialDeviceOptions = {}) {
    super();
    this.openTransport = options.openTransport ?? (() => WebSerialTransport.open());
    this.replOptions = options.repl ?? {};
  }

  async connect(): Promise<void> {
    if (this.status !== "disconnected") return;
    this.setStatus("connecting");
    let transport: Transport;
    try {
      transport = await this.openTransport();
    } catch (e) {
      this.setStatus("disconnected");
      throw e;
    }
    const repl = new RawRepl(transport, this.replOptions);
    repl.onIdleOutput((text) => this.emit({ kind: "stdout", text }));
    transport.onDisconnect(() => this.lost(repl));
    repl.onClose(() => this.lost(repl));
    try {
      try {
        await repl.enterRaw();
      } catch (e) {
        // 포트를 열 때 보드가 다시 켜지는 중이면 첫 Ctrl-C 를 놓칠 수 있어 한 번 더
        if (!(e instanceof DeviceError && e.code === "timeout")) throw e;
        try {
          await repl.enterRaw();
        } catch (e2) {
          // 포트는 열렸는데 raw REPL 응답이 없다: MicroPython 이 없는 보드(아두이노 스케치 등)
          if (e2 instanceof DeviceError && e2.code === "timeout") throw new DeviceError("no-response", { cause: e2 });
          throw e2;
        }
      }
    } catch (e) {
      await transport.close().catch(() => undefined);
      this.setStatus("disconnected");
      throw e;
    }
    this.transport = transport;
    this.repl = repl;
    this.setStatus("connected");
  }

  async disconnect(): Promise<void> {
    const { transport, repl } = this;
    const wasRunning = this.status === "running";
    this.transport = null;
    this.repl = null;
    if (repl) {
      // 실행 중이면 먼저 멈춰 두고 (run() 은 stopped 로 끝난다) 일반 REPL 로 돌려놓는다
      if (wasRunning) {
        this.userClosed = repl;
        await repl.interrupt().catch(() => undefined);
      }
      await repl.exitRaw().catch(() => undefined);
    }
    if (transport) await transport.close().catch(() => undefined);
    this.setStatus("disconnected");
  }

  async run(code: string): Promise<RunResult> {
    const repl = this.requireIdle();
    this.setStatus("running");
    try {
      const { output: _output, ...result } = await repl.exec(code, (text) => this.emit({ kind: "stdout", text }));
      return result;
    } catch (e) {
      if (this.userClosed === repl && e instanceof DeviceError && e.code === "disconnected") return { ok: true, stopped: true };
      throw e;
    } finally {
      if (this.userClosed === repl) this.userClosed = null;
      if (this.repl === repl) this.setStatus("connected");
    }
  }

  async saveFile(path: string, text: string): Promise<void> {
    const repl = this.requireIdle();
    this.setStatus("saving");
    try {
      await repl.writeFile(path, text);
    } finally {
      if (this.repl === repl) this.setStatus("connected");
    }
  }

  async listFiles(): Promise<string[]> {
    return this.requireRepl().listFiles();
  }

  async stop(): Promise<void> {
    await this.repl?.interrupt();
  }

  async softReset(): Promise<void> {
    await this.requireRepl().softReset();
  }

  /** 보드가 뽑히거나 읽기가 끝났을 때 (사용자가 끊은 경우는 this.repl 이 이미 비어 있다) */
  private lost(repl: RawRepl): void {
    if (this.repl !== repl) return;
    const transport = this.transport;
    this.transport = null;
    this.repl = null;
    void transport?.close().catch(() => undefined);
    this.setStatus("disconnected");
    this.emit({ kind: "system", text: new DeviceError("disconnected").message });
  }

  private requireRepl(): RawRepl {
    if (!this.repl || this.repl.isClosed) throw new DeviceError("disconnected");
    return this.repl;
  }

  private requireIdle(): RawRepl {
    const repl = this.requireRepl();
    if (this.status !== "connected") throw new Error(DEVICE_BUSY_MESSAGE);
    return repl;
  }
}
