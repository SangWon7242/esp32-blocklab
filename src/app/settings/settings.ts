import { useSyncExternalStore } from "react";

/** 이 기기(브라우저)에만 남는 설정. 진행 기록(esp32-blocklab:v1)과 따로 둔다 */
export const SETTINGS_KEY = "esp32-blocklab:settings";

export type Settings = {
  /** 모든 단계를 열고 예시 답·정답을 바로 보여 준다 */
  teacherMode: boolean;
  /** 보드 없이 가짜 장치로 실행한다 (?device=fake 와 같음) */
  fakeBoard: boolean;
};

const DEFAULTS: Settings = { teacherMode: false, fakeBoard: false };

function read(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const data = JSON.parse(raw) as Partial<Settings>;
    return { teacherMode: data.teacherMode === true, fakeBoard: data.fakeBoard === true };
  } catch {
    return DEFAULTS;
  }
}

let snapshot: Settings = read();
const listeners = new Set<() => void>();

export function readSettings(): Settings {
  return snapshot;
}

export function updateSettings(patch: Partial<Settings>): void {
  snapshot = { ...snapshot, ...patch };
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(snapshot));
  } catch {
    // 저장이 막힌 브라우저면 이 화면에서만 유지된다
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, readSettings);
}
