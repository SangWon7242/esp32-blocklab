import type { DeviceStatus, OutputEvent } from "./types";

/** 상태·출력 구독을 다루는 공통 부분 (WebSerialDevice, FakeDevice) */
export abstract class DeviceBase {
  private current: DeviceStatus = "disconnected";
  private readonly statusListeners = new Set<(s: DeviceStatus) => void>();
  private readonly outputListeners = new Set<(e: OutputEvent) => void>();

  get status(): DeviceStatus {
    return this.current;
  }

  onStatus(cb: (s: DeviceStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => { this.statusListeners.delete(cb); };
  }

  onOutput(cb: (e: OutputEvent) => void): () => void {
    this.outputListeners.add(cb);
    return () => { this.outputListeners.delete(cb); };
  }

  protected setStatus(s: DeviceStatus): void {
    if (s === this.current) return;
    this.current = s;
    for (const cb of [...this.statusListeners]) cb(s);
  }

  protected emit(e: OutputEvent): void {
    for (const cb of [...this.outputListeners]) cb(e);
  }
}
