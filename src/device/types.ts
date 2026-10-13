/** 보드 연결 계층의 타입. React·Blockly·DOM 을 모른다. */

export type DeviceStatus = "disconnected" | "connecting" | "connected" | "running" | "saving";

/**
 * 장치가 내보내는 출력.
 * - stdout: 보드 프로그램 출력 (실행 중 스트리밍, 소프트 리셋 뒤 main.py 출력 포함)
 * - system: 장치 쪽 안내 (예: 연결이 끊겼어요)
 * - stderr: 화면이 Traceback 행을 만들 때 쓰는 종류. 장치는 Traceback 을 내보내지 않고 RunResult.error 로 돌려준다.
 */
export type OutputEvent = { kind: "stdout" | "stderr" | "system"; text: string };

/** 바이트 통로 (Web Serial, 테스트용 가짜). 읽기는 UTF-8 로 풀린 문자열 조각. */
export interface Transport {
  write(data: Uint8Array | string): Promise<void>;
  read(): AsyncIterable<string>;
  close(): Promise<void>;
  onDisconnect(cb: () => void): void;
}

export type RunError = { line: number | null; message: string; traceback: string };

/**
 * 실행 결과. 오류면 ok=false 와 error(줄 번호·마지막 줄 메시지·Traceback 원문).
 * stopped: 멈춤(Ctrl-C)으로 끝났다 — 이때 ok 는 true 이고 error 는 없다 (KeyboardInterrupt 는 오류로 보지 않는다).
 */
export type RunResult = { ok: boolean; error?: RunError; stopped?: boolean };

export interface Device {
  readonly status: DeviceStatus;
  onStatus(cb: (s: DeviceStatus) => void): () => void;
  onOutput(cb: (e: OutputEvent) => void): () => void;
  /** Web Serial 포트 선택 + open + raw REPL 확인 */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** raw REPL 실행, 출력은 onOutput 으로 스트리밍 */
  run(code: string): Promise<RunResult>;
  saveFile(path: string, text: string): Promise<void>;
  listFiles(): Promise<string[]>;
  /** Ctrl-C ×2 */
  stop(): Promise<void>;
  softReset(): Promise<void>;
}

export type DeviceErrorCode = "unsupported" | "cancelled" | "busy" | "timeout" | "disconnected";

/** 학생 화면 문구 (기준 문서 7장) */
export const DEVICE_ERROR_MESSAGES: Record<DeviceErrorCode, string> = {
  unsupported: "Chrome에서 열어 주세요",
  cancelled: "보드를 고르지 않았어요",
  busy: "다른 프로그램(PyCharm 등)이 보드를 쓰고 있어요",
  timeout: "코드가 지금 무엇을 기다리고 있을까요? 멈춤을 눌러 보세요",
  disconnected: "보드 연결이 끊겼어요",
};

export class DeviceError extends Error {
  readonly code: DeviceErrorCode;
  constructor(code: DeviceErrorCode, options?: { cause?: unknown }) {
    super(DEVICE_ERROR_MESSAGES[code], options);
    this.name = "DeviceError";
    this.code = code;
  }
}

/** 실행·저장 중에 또 실행·저장을 부르면 (화면이 버튼을 막아야 하지만 마지막 방어) */
export const DEVICE_BUSY_MESSAGE = "보드가 지금 다른 일을 하고 있어요";
