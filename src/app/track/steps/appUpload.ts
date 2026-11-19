import { useCallback, useEffect, useState } from "react";
import { DeviceError, type Device, type DeviceStatus } from "@/device";
import { writeBoardFile } from "../../lab/saveToBoard";
import { sharedDevices } from "../../lab/sharedDevice";

/* 앱 단계의 보드 연결과 index.html 저장. 파일 쓰기는 라이브러리 올리기와 같은 길(saveToBoard.writeBoardFile). */

/** 보드에 저장할 앱 파일 이름 (ESP32 웹서버가 / 에 내준다) */
export const APP_FILE_NAME = "index.html";

/** index.html 을 쓰고 보드를 다시 시작한다 (파일을 쓰느라 멈춘 main.py 웹서버가 다시 돈다) */
export async function saveAppToBoard(device: Device, html: string, log: (text: string) => void = () => {}): Promise<void> {
  await writeBoardFile(device, APP_FILE_NAME, html, log);
  await device.softReset();
  log("보드를 다시 시작했어요 (웹서버가 새 index.html 을 내줘요)");
}

/**
 * 앱 단계의 보드 연결: 연결·끊기·index.html 저장만. 장치는 편집기와 같은 공유 장치(sharedDevice)다 —
 * 앞 단계에서 연결했으면 그대로 이어 쓰고, 공유 장치가 연결된 채 따로 포트를 열다 busy 가 되는 일도 없다.
 * 화면을 떠나도 연결은 유지한다 (쓰는 곳이 하나도 없이 60초가 지나면 공유 장치가 놓아 준다). 저장 중이면 끝날 때까지 둔다.
 */
export function useAppBoard(fake: boolean) {
  // 장치(가짜/진짜)는 마운트 때 정해진다
  const [{ board, boardFake }] = useState(() => ({ board: sharedDevices().get(fake), boardFake: fake }));
  const [status, setStatus] = useState<DeviceStatus>(board.status);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const release = sharedDevices().hold(boardFake);
    const off = board.onStatus(setStatus);
    setStatus(board.status);
    return () => {
      off();
      release();
    };
  }, [board, boardFake]);

  /** 실패 메시지 (보드를 고르지 않은 것은 조용히 null) */
  const errorText = (e: unknown): string | null => {
    if (e instanceof DeviceError && e.code === "cancelled") return null;
    return e instanceof Error ? e.message : String(e);
  };

  const connect = useCallback(async (): Promise<string | null> => {
    try {
      await board.connect();
      return null;
    } catch (e) {
      return errorText(e);
    }
  }, [board]);

  const disconnect = useCallback(async () => {
    await board.disconnect();
  }, [board]);

  /** 저장. 성공하면 null, 실패하면 학생 문구 */
  const save = useCallback(async (html: string): Promise<string | null> => {
    setSaving(true);
    setLog([]);
    // 저장하는 동안은 화면을 떠나도 쉬는 시간 끊김이 오지 않게 붙잡아 둔다
    const release = sharedDevices().hold(boardFake);
    try {
      await saveAppToBoard(board, html, (t) => setLog((l) => [...l, t]));
      return null;
    } catch (e) {
      return errorText(e) ?? "보드에 저장하지 못했어요";
    } finally {
      release();
      setSaving(false);
    }
  }, [board, boardFake]);

  return { status, saving, log, connected: status === "connected" && !saving, connect, disconnect, save };
}
