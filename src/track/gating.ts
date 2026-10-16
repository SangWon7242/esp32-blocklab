import { awaitingExplain, type CompleteOptions } from "./completion";
import type { Chapter, Step } from "./schema";

/** awaiting: 열린 단계인데 판정은 통과했고 교사 "설명 확인"만 남았다 (설정 explainGate 가 켜졌을 때만) */
export type StepState = "locked" | "open" | "awaiting" | "done";

/** 상태 계산에 필요한 기록 조각 (StepRecord 의 일부) */
export type StateRecord = { status: string; input?: Record<string, unknown> };

/** 부를 이어 붙여 단계를 순서대로 편다 */
export function allSteps(chapter: Chapter): Step[] {
  return chapter.parts.flatMap((p) => p.steps);
}

/**
 * 단계마다 잠김/열림/완료.
 * - 기록이 done 이면 done (교사 모드에서도 그대로).
 * - 교사 모드면 나머지는 모두 open.
 * - 아니면 바로 앞의 필수 단계(optional 이 아닌 단계)가 done 일 때 open. 앞에 필수 단계가 없으면 open.
 *   그래서 첫 단계는 늘 열리고, 선택 단계는 마치지 않아도 그다음을 막지 않는다.
 * - 열린 mission·debug 가 판정은 통과했는데 교사 확인만 남았으면(opts.explainGate) open 대신 awaiting. 관문으로는 open 과 같다.
 */
export function stepStates(
  chapter: Chapter,
  records: Readonly<Record<string, StateRecord | undefined>>,
  teacherMode = false,
  opts?: CompleteOptions,
): Record<string, StepState> {
  const out: Record<string, StepState> = {};
  let lastRequiredDone = true;
  for (const step of allSteps(chapter)) {
    const record = records[step.id];
    const done = record?.status === "done";
    if (done) out[step.id] = "done";
    else if (teacherMode || lastRequiredDone) out[step.id] = awaitingExplain(step, record?.input ?? {}, opts) ? "awaiting" : "open";
    else out[step.id] = "locked";
    if (!step.optional) lastRequiredDone = done;
  }
  return out;
}
