import { useSyncExternalStore } from "react";
import { DEFAULT_MODEL } from "@/ai/claude";

/** 이 기기(브라우저)에만 남는 설정. 진행 기록(esp32-blocklab:v1)과 따로 둔다 */
export const SETTINGS_KEY = "esp32-blocklab:settings";

export type Settings = {
  /** 모든 단계를 열고 예시 답·정답을 바로 보여 준다 */
  teacherMode: boolean;
  /** 보드 없이 가짜 장치로 실행한다 (?device=fake 와 같음) */
  fakeBoard: boolean;
  /** 교사용 Claude API 키 (이 브라우저에만 저장, 비어 있으면 AI 점검 버튼을 숨긴다) */
  claudeApiKey: string;
  /** AI 점검 모델 */
  claudeModel: string;
};

const DEFAULTS: Settings = { teacherMode: false, fakeBoard: false, claudeApiKey: "", claudeModel: DEFAULT_MODEL };

function read(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const data = JSON.parse(raw) as Partial<Settings>;
    return {
      teacherMode: data.teacherMode === true,
      fakeBoard: data.fakeBoard === true,
      claudeApiKey: typeof data.claudeApiKey === "string" ? data.claudeApiKey : "",
      claudeModel: typeof data.claudeModel === "string" && data.claudeModel.trim() ? data.claudeModel : DEFAULT_MODEL,
    };
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
