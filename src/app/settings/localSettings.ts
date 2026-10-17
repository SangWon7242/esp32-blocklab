import { useSyncExternalStore } from "react";
import { DEFAULT_MODEL } from "@/ai/claude";

/*
 * 체험판 설정 소스: 이 기기(브라우저)에만 남는다. 진행 기록(esp32-blocklab:v1)과 따로 둔다.
 * 라이브러리 화면은 이 파일을 모르고 호스트 컨텍스트의 settings 만 본다 (settings.ts).
 */
export const SETTINGS_KEY = "esp32-blocklab:settings";

export type LocalSettings = {
  /** 모든 단계를 열고 예시 답·정답을 바로 보여 준다 */
  teacherMode: boolean;
  /** 보드 없이 가짜 장치로 실행한다 (?device=fake 와 같음) */
  fakeBoard: boolean;
  /** 1분 설명 관문: 미션·디버깅은 판정 통과 뒤 교사가 "설명 확인"을 눌러야 완료된다 */
  explainGate: boolean;
  /** 교사용 Claude API 키 (이 브라우저에만 저장, 비어 있으면 AI 점검 버튼을 숨긴다) */
  claudeApiKey: string;
  /** AI 점검 모델 */
  claudeModel: string;
};

const DEFAULTS: LocalSettings = { teacherMode: false, fakeBoard: false, explainGate: false, claudeApiKey: "", claudeModel: DEFAULT_MODEL };

function read(): LocalSettings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const data = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      teacherMode: data.teacherMode === true,
      fakeBoard: data.fakeBoard === true,
      explainGate: data.explainGate === true,
      claudeApiKey: typeof data.claudeApiKey === "string" ? data.claudeApiKey : "",
      claudeModel: typeof data.claudeModel === "string" && data.claudeModel.trim() ? data.claudeModel : DEFAULT_MODEL,
    };
  } catch {
    return DEFAULTS;
  }
}

let snapshot: LocalSettings = read();
const listeners = new Set<() => void>();

export function readLocalSettings(): LocalSettings {
  return snapshot;
}

export function updateSettings(patch: Partial<LocalSettings>): void {
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

export function useLocalSettings(): LocalSettings {
  return useSyncExternalStore(subscribe, readLocalSettings, readLocalSettings);
}
