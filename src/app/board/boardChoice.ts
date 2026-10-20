import { useSyncExternalStore } from "react";
import { BOARD_IDS, BOARD_LABELS, DEFAULT_BOARD, isBoardId, type BoardId } from "@/track/board";

/*
 * 수업 보드 고르기 (보는 사람 편의 설정). 학생이 챕터 화면 위에서 고른 보드를 이 기기(브라우저) localStorage 에 둔다
 * (키 esp32-blocklab:board, 값 "devkit" — 기본값 plus 는 지운다). 모든 챕터가 같은 값을 따르고, 다른 탭에서 바꾼 값도 따른다.
 * 저장이 막혀 있거나(사생활 보호 창 등) 값이 이상하면 plus. 막혀도 이 화면에서는 고른 값이 그대로 유지된다.
 * 모듈을 import 할 때는 window·localStorage 를 건드리지 않는다 (허브 서버 import 용). 서버 렌더에서는 plus.
 */

export { BOARD_IDS, BOARD_LABELS, DEFAULT_BOARD, isBoardId, type BoardId };

export const BOARD_STORAGE_KEY = "esp32-blocklab:board";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 저장된 보드 (없거나 읽지 못하면 plus) */
export function readStoredBoardChoice(): BoardId {
  try {
    const raw = storage()?.getItem(BOARD_STORAGE_KEY);
    return isBoardId(raw) ? raw : DEFAULT_BOARD;
  } catch {
    return DEFAULT_BOARD;
  }
}

let current: BoardId | null = null;
const listeners = new Set<() => void>();

/** 지금 고른 보드. 처음 부를 때 localStorage 에서 읽는다 */
export function boardChoice(): BoardId {
  if (current === null) current = readStoredBoardChoice();
  return current;
}

/** 보드를 바꾸고 저장한다. 모르는 값은 무시. 저장이 막혀도 이 화면에서는 바뀐 값을 쓴다 */
export function setBoardChoice(id: BoardId): void {
  if (!isBoardId(id) || id === boardChoice()) return;
  current = id;
  try {
    const s = storage();
    if (id === DEFAULT_BOARD) s?.removeItem(BOARD_STORAGE_KEY);
    else s?.setItem(BOARD_STORAGE_KEY, id);
  } catch {
    // 저장이 막힌 브라우저면 새로 고칠 때 plus 로 돌아간다
  }
  listeners.forEach((l) => l());
}

/** 시험용: 모듈 안 값을 비워 다음 boardChoice() 가 저장소에서 다시 읽게 */
export function forgetBoardChoice(): void {
  current = null;
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== BOARD_STORAGE_KEY) return;
  const next = readStoredBoardChoice();
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

/** 구독 (첫 구독 때 다른 탭의 storage 이벤트를 듣기 시작한다) */
export function subscribeBoardChoice(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = (): BoardId => DEFAULT_BOARD;

/** 고른 보드 ("plus" | "devkit"). 바꾸면 모든 구독자가 다시 그린다 */
export function useBoardChoice(): BoardId {
  return useSyncExternalStore(subscribeBoardChoice, boardChoice, serverSnapshot);
}
