import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { emptyProgress, LocalProgressStore, type Progress, type StepRecord } from "@/track/progress";

/** 앱 전체가 함께 쓰는 진행 기록 저장소와 화면용 스냅숏 */
export const progressStore = new LocalProgressStore();

let snapshot: Progress | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const SAVE_FAILED_MESSAGE = "이 브라우저에서는 기록을 저장할 수 없어요";
let warned = false;
/** 저장할 수 없다는 안내는 한 번만 */
function warnUnsaved() {
  if (warned) return;
  warned = true;
  toast.warning(SAVE_FAILED_MESSAGE, { id: "save-failed", description: "이 화면을 닫거나 새로 고치면 적은 내용이 사라져요." });
}

/** 저장소에서 다시 읽는다 (불러오기·초기화 뒤). 읽지 못하면 빈 기록으로 */
export async function reloadProgress(): Promise<void> {
  try {
    snapshot = await progressStore.load();
  } catch {
    snapshot = emptyProgress();
  }
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
  try {
    await progressStore.saveStep(chapterId, stepId, record);
    if (!progressStore.persistent) warnUnsaved();
  } catch {
    warnUnsaved();
  }
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
