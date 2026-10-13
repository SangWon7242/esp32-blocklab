import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeviceError, FakeDevice, WebSerialDevice, type Device, type DeviceStatus } from "@/device";
import {
  appendDeviceRow, appendDeviceText, EMPTY_DEVICE_CONSOLE, tracebackRow, type DeviceConsole, type DeviceKind, type DeviceRow,
} from "./deviceConsole";
import { saveToBoard, type DeviceProgram } from "./saveToBoard";

export type { DeviceProgram };

/** 화면에 보이는 보드 상태. 저장 흐름(라이브러리 확인·올리기·main.py·다시 시작) 내내 "saving" 이다 */
export type DeviceDisplayStatus = DeviceStatus;

export type UseDeviceOptions = {
  /** ?device=fake 면 보드 없이 미리 정한 출력을 내는 가짜 장치 */
  fake: boolean;
  /**
   * 실행·저장 직전에 부른다. 아직 debounce 중인 코드를 먼저 반영하고 그 코드를 돌려준다.
   * null 이면 보내지 않는다 (코드 모드 문법 오류: 부르는 쪽이 안내한다)
   */
  getProgram(): DeviceProgram | null;
  /** 보드 Traceback 이 줄을 가리킬 때. code 는 그 실행에 쓴 코드 (그사이 코드가 바뀌었으면 강조하지 않게) */
  onErrorLine(code: string, line: number): void;
  /** 보드 행이 생길 일을 시작할 때 (하단 콘솔을 펼친다) */
  showConsole(): void;
  /** 실행이 끝날 때 (트랙: 실행 단계 완료, outputIncludes 판정용 출력). 멈춤·오류도 알린다 */
  onRunEnd?(result: { ok: boolean; stopped: boolean }, output: string): void;
};

/** stdout 을 화면에 붙이는 것은 한 프레임에 한 번. 숨은 탭처럼 프레임이 오지 않아도 이만큼 쌓이면 바로 붙인다 */
const MAX_PENDING_STDOUT = 64 * 1024;

/** 가짜 장치는 print 줄 사이를 잠깐 쉬어 "실행 중" 상태와 멈춤을 볼 수 있게 한다 */
const FAKE_LINE_DELAY_MS = 200;

export function createDevice(fake: boolean): Device {
  return fake ? new FakeDevice({ lineDelayMs: FAKE_LINE_DELAY_MS }) : new WebSerialDevice();
}

/**
 * 보드 연결·실행·저장·멈춤과 콘솔의 보드 행.
 * - 실행: "실행을 시작했어요" → 보드 출력 → "실행이 끝났어요" / "실행을 멈췄어요" / Traceback 행(영어 그대로) + 오류 줄 강조
 * - 저장: 쓰인 블록의 라이브러리 중 보드에 없는 것만 올리고 → main.py → 소프트 리셋(main.py 가 바로 돈다)
 * - 오류는 토스트 + 콘솔 system 행. 보드를 고르지 않은 것(cancelled)은 조용히 넘어간다.
 */
export function useDevice({ fake, getProgram, onErrorLine, showConsole, onRunEnd }: UseDeviceOptions) {
  const [device] = useState(() => createDevice(fake));
  const [status, setStatus] = useState<DeviceStatus>(device.status);
  const [consoleState, setConsoleState] = useState<DeviceConsole>(EMPTY_DEVICE_CONSOLE);
  /** 실행·저장 흐름이 진행 중인지 (저장은 여러 단계라 장치 상태가 사이사이 connected 로 돌아온다) */
  const [task, setTask] = useState<"run" | "save" | null>(null);
  const taskRef = useRef<"run" | "save" | null>(null);

  const optsRef = useRef({ getProgram, onErrorLine, showConsole, onRunEnd });
  optsRef.current = { getProgram, onErrorLine, showConsole, onRunEnd };
  /** 지금 실행의 stdout (끝날 때 onRunEnd 로 넘긴다) */
  const runOutput = useRef("");

  /**
   * 보드 stdout 은 작은 조각으로 아주 자주 오므로(sleep 없는 print 반복) 조각마다 다시 그리지 않고 모았다가
   * requestAnimationFrame 마다 한 번 붙인다. 다른 행(system·stderr)을 붙이기 전·실행이 끝날 때는 바로 붙여 순서를 지킨다.
   */
  const pendingStdout = useRef("");
  const frameRef = useRef<number | null>(null);
  const flushStdout = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const text = pendingStdout.current;
    if (!text) return;
    pendingStdout.current = "";
    setConsoleState((c) => appendDeviceText(c, "stdout", text));
  }, []);
  const push = useCallback((kind: DeviceKind, text: string) => {
    if (kind === "stdout") {
      pendingStdout.current += text;
      if (pendingStdout.current.length >= MAX_PENDING_STDOUT) flushStdout();
      else if (frameRef.current === null) frameRef.current = requestAnimationFrame(() => { frameRef.current = null; flushStdout(); });
      return;
    }
    flushStdout();
    setConsoleState((c) => appendDeviceText(c, kind, text));
  }, [flushStdout]);
  const pushRow = useCallback((row: DeviceRow) => {
    flushStdout();
    setConsoleState((c) => appendDeviceRow(c, row));
  }, [flushStdout]);

  useEffect(() => {
    const offStatus = device.onStatus(setStatus);
    const offOutput = device.onOutput((e) => {
      if (e.kind === "stdout" && taskRef.current === "run") runOutput.current += e.text;
      push(e.kind, e.text);
      // 장치 쪽 안내는 지금은 "보드 연결이 끊겼어요" 뿐이다 (뽑힘)
      if (e.kind === "system") toast.error(e.text);
    });
    setStatus(device.status);
    return () => {
      offStatus();
      offOutput();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      // 화면을 떠나면 포트를 놓아 준다 (다른 탭·PyCharm 이 쓸 수 있게)
      if (device.status !== "disconnected") void device.disconnect();
    };
  }, [device, push]);

  const report = useCallback((e: unknown) => {
    if (e instanceof DeviceError && e.code === "cancelled") return;
    // 뽑힘은 장치가 이미 "보드 연결이 끊겼어요" 행을 냈다 (실행·저장이 그 때문에 실패해도 두 번 알리지 않는다)
    if (e instanceof DeviceError && e.code === "disconnected" && device.status === "disconnected") return;
    const message = e instanceof Error ? e.message : String(e);
    toast.error(message);
    push("system", message);
  }, [device, push]);

  /** 실행·저장을 시작할 수 있으면 보낼 프로그램을 돌려주고 task 를 잡는다 */
  const begin = (t: "run" | "save"): DeviceProgram | null => {
    if (taskRef.current || device.status !== "connected") return null;
    const program = optsRef.current.getProgram();
    if (!program) return null;
    taskRef.current = t;
    setTask(t);
    return program;
  };
  const end = () => {
    flushStdout();
    taskRef.current = null;
    setTask(null);
  };

  const connect = useCallback(async () => {
    try {
      await device.connect();
      optsRef.current.showConsole();
      push("system", "보드에 연결했어요");
    } catch (e) {
      report(e);
    }
  }, [device, push, report]);

  const disconnect = useCallback(async () => {
    try {
      await device.disconnect();
      push("system", "보드 연결을 끊었어요");
    } catch (e) {
      report(e);
    }
  }, [device, push, report]);

  const run = useCallback(async () => {
    const program = begin("run");
    if (!program) return;
    const { code } = program;
    try {
      optsRef.current.showConsole();
      push("system", "실행을 시작했어요");
      runOutput.current = "";
      const result = await device.run(code);
      flushStdout();
      if (result.stopped) push("system", "실행을 멈췄어요");
      else if (result.ok || !result.error) push("system", "실행이 끝났어요");
      else {
        pushRow(tracebackRow(result.error));
        if (result.error.line !== null) optsRef.current.onErrorLine(code, result.error.line);
      }
      optsRef.current.onRunEnd?.({ ok: result.ok && !result.stopped, stopped: result.stopped === true }, runOutput.current);
    } catch (e) {
      report(e);
    } finally {
      end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, flushStdout, push, pushRow, report]);

  const save = useCallback(async () => {
    const program = begin("save");
    if (!program) return;
    try {
      optsRef.current.showConsole();
      await saveToBoard(device, program, (text) => push("system", text));
      toast.success("보드에 저장했어요");
    } catch (e) {
      report(e);
    } finally {
      end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, push, report]);

  const stop = useCallback(async () => {
    try {
      await device.stop();
    } catch (e) {
      report(e);
    }
  }, [device, report]);

  /** 보드 행을 지운다 (id 는 이어서 늘어나 React key 가 겹치지 않는다) */
  const clear = useCallback(() => {
    flushStdout();
    setConsoleState((c) => ({ ...EMPTY_DEVICE_CONSOLE, nextId: c.nextId }));
  }, [flushStdout]);

  const shown: DeviceDisplayStatus = task === "save" ? "saving" : status;
  const idle = status === "connected" && task === null;
  return {
    status: shown,
    rows: consoleState.rows,
    /** 연결/끊기 버튼을 누를 수 있는지 (연결 중·저장 중에는 안 된다. 실행 중 끊기는 멈춤으로 끝난다) */
    canToggleConnection: status !== "connecting" && task !== "save",
    canRun: idle,
    canSave: idle,
    /** 저장 중에는 멈추면 파일이 반쯤 써지므로 막는다. 연결만 된 상태에서도 저장한 main.py 를 멈출 수 있다 */
    canStop: (status === "connected" || status === "running") && task !== "save",
    connect,
    disconnect,
    run,
    save,
    stop,
    clear,
  };
}
