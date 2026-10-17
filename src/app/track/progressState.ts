import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useHost } from "@/host/HostContext";
import { emptyProgress, type Progress, type ProgressStore, type StepRecord } from "@/track/progress";

/*
 * 호스트가 넘긴 진행 저장소(ProgressStore)마다 화면용 스냅숏 하나. 같은 저장소를 쓰는 화면은 스냅숏을 함께 본다.
 * review(열람) 모드는 저장소를 읽지도 쓰지도 않는다 (기록은 host.reviewRecords).
 */
type State = { snapshot: Progress | null; listeners: Set<() => void>; warned: boolean };
const states = new WeakMap<ProgressStore, State>();

function stateOf(store: ProgressStore): State {
  let s = states.get(store);
  if (!s) {
    s = { snapshot: null, listeners: new Set(), warned: false };
    states.set(store, s);
  }
  return s;
}

const emit = (s: State) => s.listeners.forEach((l) => l());

export const SAVE_FAILED_MESSAGE = "이 브라우저에서는 기록을 저장할 수 없어요";

/** 저장할 수 없다는 안내는 저장소마다 한 번만 */
function warnUnsaved(s: State) {
  if (s.warned) return;
  s.warned = true;
  toast.warning(SAVE_FAILED_MESSAGE, { id: "save-failed", description: "이 화면을 닫거나 새로 고치면 적은 내용이 사라져요." });
}

/** 저장소가 "영구 저장이 아니다"라고 밝히면(LocalProgressStore.persistent=false) 한 번 알린다 */
function isPersistent(store: ProgressStore): boolean {
  return (store as { persistent?: boolean }).persistent !== false;
}

/** 저장소에서 다시 읽는다 (불러오기·초기화 뒤). 읽지 못하면 빈 기록으로 */
export async function reloadProgress(store: ProgressStore): Promise<void> {
  const s = stateOf(store);
  try {
    s.snapshot = await store.load();
  } catch {
    s.snapshot = emptyProgress();
  }
  emit(s);
}

/** 화면 스냅숏을 바로 바꾸고 저장한다 */
export async function saveStepRecord(store: ProgressStore, chapterId: string, stepId: string, record: StepRecord): Promise<void> {
  const s = stateOf(store);
  if (s.snapshot) {
    s.snapshot = {
      ...s.snapshot,
      chapters: { ...s.snapshot.chapters, [chapterId]: { ...s.snapshot.chapters[chapterId], [stepId]: record } },
    };
    emit(s);
  }
  try {
    await store.saveStep(chapterId, stepId, record);
    if (!isPersistent(store)) warnUnsaved(s);
  } catch {
    warnUnsaved(s);
  }
}

/** 열람 모드의 빈 기록 (한 객체를 돌려주어 다시 그리지 않게) */
const REVIEW_PROGRESS: Progress = emptyProgress();

/** 처음엔 null (읽는 중), 다 읽으면 기록. 열람 모드는 바로 빈 기록 */
export function useProgress(): Progress | null {
  const { store, mode } = useHost();
  const s = stateOf(store);
  const value = useSyncExternalStore(
    (l) => {
      s.listeners.add(l);
      return () => s.listeners.delete(l);
    },
    () => s.snapshot,
    () => s.snapshot,
  );
  const review = mode === "review";
  useEffect(() => {
    if (!review && !s.snapshot) void reloadProgress(store);
  }, [review, store, s]);
  return review ? REVIEW_PROGRESS : value;
}

/**
 * 한 챕터의 단계 기록. 열람 모드면 호스트가 넘긴 학생 기록(reviewRecords), 아니면 진행 기록에서.
 * 읽는 중(progress null)이면 null
 */
export function useChapterRecords(chapterId: string): Record<string, StepRecord> | null {
  const { mode, reviewRecords } = useHost();
  const progress = useProgress();
  if (mode === "review") return reviewRecords ?? {};
  if (!progress) return null;
  return progress.chapters[chapterId] ?? {};
}
