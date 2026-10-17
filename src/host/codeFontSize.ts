import { useSyncExternalStore } from "react";

/*
 * 코드 글자 크기 (lib-v1.0.5). 블록 코딩 뒤 나오는 코드 칸(CodeMirror 편집기·읽기 전용 코드·CodeView)의 글자 크기를 학생이 고른다.
 * 보는 사람 편의 설정이라 호스트 저장소가 아니라 이 브라우저의 localStorage 에만 둔다 (키 blocklab.codeFontSize).
 * 저장이 막혀 있거나(사생활 보호 창 등) 값이 이상하면 기본값을 쓴다 — 이 화면에서는 고른 값이 그대로 유지된다.
 * BlocklabProvider 가 `.blocklab` 루트에 CSS 변수 --blocklab-code-font-size 로 내려 모든 코드 칸이 같은 값을 따른다.
 *
 * 범위 12~30px, 정수만(흐림 방지). 30px 은 폰 390px 의 가장 좁은 코드 칸(단계 안 읽기 전용 코드)에서 한 줄에 21자가 보이고(31px 은 20자)
 * 머리줄·줄 번호가 무너지지 않으며 페이지 가로 넘침이 없는 가장 큰 값
 * (lib-v105-report.md 에 잰 값). 모듈을 import 할 때는 localStorage 를 건드리지 않는다 (서버 import 용).
 */

export const CODE_FONT_SIZE_KEY = "blocklab.codeFontSize";
export const CODE_FONT_SIZE_MIN = 12;
export const CODE_FONT_SIZE_MAX = 30;
export const CODE_FONT_SIZE_DEFAULT = 16;
/** 코드 줄 높이 (글자 크기에 비례) */
export const CODE_LINE_HEIGHT = 1.6;
export const CODE_FONT_SIZE_VAR = "--blocklab-code-font-size";
/** 코드 글꼴 스택 (index.css 의 --blocklab-font-code 와 같은 값. 변수가 없는 곳을 위해 스택을 함께 적는다) */
export const CODE_FONT_STACK = '"D2Coding", "D2Coding ligature", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
export const CODE_FONT_FAMILY = `var(--blocklab-font-code, ${CODE_FONT_STACK})`;

/** 정수 px 로 반올림해 범위 안으로. 숫자가 아니면(NaN·문자·null) 기본값 */
export function clampCodeFontSize(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return CODE_FONT_SIZE_DEFAULT;
  return Math.min(CODE_FONT_SIZE_MAX, Math.max(CODE_FONT_SIZE_MIN, Math.round(n)));
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 저장된 값 (없거나 읽지 못하면 기본값) */
export function readStoredCodeFontSize(): number {
  try {
    const raw = storage()?.getItem(CODE_FONT_SIZE_KEY);
    return raw == null ? CODE_FONT_SIZE_DEFAULT : clampCodeFontSize(raw);
  } catch {
    return CODE_FONT_SIZE_DEFAULT;
  }
}

let current: number | null = null;
const listeners = new Set<() => void>();

/** 지금 값. 처음 부를 때 localStorage 에서 읽는다 */
export function codeFontSize(): number {
  if (current === null) current = readStoredCodeFontSize();
  return current;
}

/** 값을 바꾸고(범위 고정) 저장한다. 저장이 막혀도 이 화면에서는 바뀐 값을 쓴다. 바뀐 값을 돌려준다 */
export function setCodeFontSize(value: number): number {
  const next = clampCodeFontSize(value);
  if (next === codeFontSize()) return next;
  current = next;
  try {
    const s = storage();
    if (next === CODE_FONT_SIZE_DEFAULT) s?.removeItem(CODE_FONT_SIZE_KEY);
    else s?.setItem(CODE_FONT_SIZE_KEY, String(next));
  } catch {
    // 저장이 막힌 브라우저면 새로 고칠 때 기본값으로 돌아간다
  }
  listeners.forEach((l) => l());
  return next;
}

export function resetCodeFontSize(): number {
  return setCodeFontSize(CODE_FONT_SIZE_DEFAULT);
}

/** 시험용: 모듈 안 값을 비워 다음 codeFontSize() 가 저장소에서 다시 읽게 */
export function forgetCodeFontSize(): void {
  current = null;
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== CODE_FONT_SIZE_KEY) return;
  const next = readStoredCodeFontSize();
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 다른 탭에서 바꾼 값도 따른다
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = () => CODE_FONT_SIZE_DEFAULT;

/** 코드 글자 크기 (px, 정수). 바꾸면 모든 구독자가 다시 그린다. 서버 렌더에서는 기본값 */
export function useCodeFontSize(): number {
  return useSyncExternalStore(subscribe, codeFontSize, serverSnapshot);
}
