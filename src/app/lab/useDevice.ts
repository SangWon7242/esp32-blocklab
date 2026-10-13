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
  /** 실행·저장 직전에 부른다. 아직 debounce 중인 코드를 먼저 반영하고 그 코드를 돌려준다 */
  getProgram(): DeviceProgram;
  /** 보드 Traceback 이 줄을 가리킬 때. code 는 그 실행에 쓴 코드 (그사이 코드가 바뀌었으면 강조하지 않게) */
  onErrorLine(code: string, line: number): void;
  /** 보드 행이 생길 일을 시작할 때 (하단 콘솔을 펼친다) */
  showConsole(): void;
};

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
export function useDevice({ fake, getProgram, onErrorLine, showConsole }: UseDeviceOptions) {
  const [device] = useState(() => createDevice(fake));
  const [status, setStatus] = useState<DeviceStatus>(device.status);
  const [consoleState, setConsoleState] = useState<DeviceConsole>(EMPTY_DEVICE_CONSOLE);
  /** 실행·저장 흐름이 진행 중인지 (저장은 여러 단계라 장치 상태가 사이사이 connected 로 돌아온다) */
  const [task, setTask] = useState<"run" | "save" | null>(null);
  const taskRef = useRef<"run" | "save" | null>(null);

  const optsRef = useRef({ getProgram, onErrorLine, showConsole });
  optsRef.current = { getProgram, onErrorLine, showConsole };

  const push = useCallback((kind: DeviceKind, text: string) => setConsoleState((c) => appendDeviceText(c, kind, text)), []);
  const pushRow = useCallback((row: DeviceRow) => setConsoleState((c) => appendDeviceRow(c, row)), []);

  useEffect(() => {
    const offStatus = device.onStatus(setStatus);
    const offOutput = device.onOutput((e) => {
      push(e.kind, e.text);
      // 장치 쪽 안내는 지금은 "보드 연결이 끊겼어요" 뿐이다 (뽑힘)
      if (e.kind === "system") toast.error(e.text);
    });
    setStatus(device.status);
    return () => {
      offStatus();
      offOutput();
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

  const begin = (t: "run" | "save"): boolean => {
    if (taskRef.current || device.status !== "connected") return false;
    taskRef.current = t;
    setTask(t);
    return true;
  };
  const end = () => {
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
    if (!begin("run")) return;
    try {
      const { code } = optsRef.current.getProgram();
      optsRef.current.showConsole();
      push("system", "실행을 시작했어요");
      const result = await device.run(code);
      if (result.stopped) push("system", "실행을 멈췄어요");
      else if (result.ok || !result.error) push("system", "실행이 끝났어요");
      else {
        pushRow(tracebackRow(result.error));
        if (result.error.line !== null) optsRef.current.onErrorLine(code, result.error.line);
      }
    } catch (e) {
      report(e);
    } finally {
      end();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, push, pushRow, report]);

  const save = useCallback(async () => {
    if (!begin("save")) return;
    try {
      const program = optsRef.current.getProgram();
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

  const clear = useCallback(() => setConsoleState(EMPTY_DEVICE_CONSOLE), []);

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
