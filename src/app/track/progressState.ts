import { useEffect, useSyncExternalStore } from "react";
import { LocalProgressStore, type Progress, type StepRecord } from "@/track/progress";

/** 앱 전체가 함께 쓰는 진행 기록 저장소와 화면용 스냅숏 */
export const progressStore = new LocalProgressStore();

let snapshot: Progress | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** 저장소에서 다시 읽는다 (불러오기·초기화 뒤) */
export async function reloadProgress(): Promise<void> {
  snapshot = await progressStore.load();
  emit();
}

/** 화면 스냅숏을 바로 바꾸고 저장한다 */
export async function saveStepRecord(chapterId: string, stepId: string, record: StepRecord): Promise<void> {
  if (snapshot) {
    snapshot = {
      ...snapshot,
      chapters: { ...snapshot.chapters, [chapterId]: { ...snapshot.chapters[chapterId], [stepId]: record } },
    };
    emit();
  }
  await progressStore.saveStep(chapterId, stepId, record);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 처음엔 null (읽는 중), 다 읽으면 기록 */
export function useProgress(): Progress | null {
  const value = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    if (!snapshot) void reloadProgress();
  }, []);
  return value;
}
