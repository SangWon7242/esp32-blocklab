import type { Chapter, Step } from "./schema";

export type StepState = "locked" | "open" | "done";

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
 */
export function stepStates(
  chapter: Chapter,
  records: Readonly<Record<string, { status: string } | undefined>>,
  teacherMode = false,
): Record<string, StepState> {
  const out: Record<string, StepState> = {};
  let lastRequiredDone = true;
  for (const step of allSteps(chapter)) {
    const done = records[step.id]?.status === "done";
    out[step.id] = done ? "done" : teacherMode || lastRequiredDone ? "open" : "locked";
    if (!step.optional) lastRequiredDone = done;
  }
  return out;
}
