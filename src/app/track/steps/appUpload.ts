import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceError, type Device, type DeviceStatus } from "@/device";
import { writeBoardFile } from "../../lab/saveToBoard";
import { createDevice } from "../../lab/useDevice";

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
 * 앱 단계 전용 보드 연결: 연결·끊기·index.html 저장만. 장치는 처음 연결할 때 만든다(열어 보기만 하면 만들지 않는다).
 * 화면을 떠나면 포트를 놓아 준다.
 */
export function useAppBoard(fake: boolean) {
  const deviceRef = useRef<Device | null>(null);
  const offRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<DeviceStatus>("disconnected");
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const device = useCallback(() => {
    if (!deviceRef.current) {
      const d = createDevice(fake);
      deviceRef.current = d;
      offRef.current = d.onStatus(setStatus);
    }
    return deviceRef.current;
  }, [fake]);

  useEffect(() => () => {
    offRef.current?.();
    const d = deviceRef.current;
    if (d && d.status !== "disconnected") void d.disconnect();
  }, []);

  /** 실패 메시지 (보드를 고르지 않은 것은 조용히 null) */
  const errorText = (e: unknown): string | null => {
    if (e instanceof DeviceError && e.code === "cancelled") return null;
    return e instanceof Error ? e.message : String(e);
  };

  const connect = useCallback(async (): Promise<string | null> => {
    try {
      await device().connect();
      return null;
    } catch (e) {
      return errorText(e);
    }
  }, [device]);

  const disconnect = useCallback(async () => {
    await deviceRef.current?.disconnect();
  }, []);

  /** 저장. 성공하면 null, 실패하면 학생 문구 */
  const save = useCallback(async (html: string): Promise<string | null> => {
    setSaving(true);
    setLog([]);
    try {
      await saveAppToBoard(device(), html, (t) => setLog((l) => [...l, t]));
      return null;
    } catch (e) {
      return errorText(e) ?? "보드에 저장하지 못했어요";
    } finally {
      setSaving(false);
    }
  }, [device]);

  return { status, saving, log, connected: status === "connected" && !saving, connect, disconnect, save };
}
