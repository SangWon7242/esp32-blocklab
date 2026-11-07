import { createContext, useContext, useEffect, useRef } from "react";

/** 하단 줄의 「채점하기」 버튼 이름 */
export const JUDGE_LABEL = "채점하기";

/**
 * 「채점하기」 버튼을 단계 화면 하단 줄(이전 · 건너뛰기 · 완료 · 다음 옆)에 두기 위한 통로.
 * StepPage 가 setter 를 내려 주고, 판정 패널(JudgePanel)이 자기 onJudge 를 올린다.
 * 통로가 없으면(StepPage 밖) 패널이 버튼을 스스로 그린다.
 */
export const JudgeActionContext = createContext<((judge: (() => void) | null) => void) | null>(null);

/** onJudge 를 하단 줄 버튼에 건다. 하단 줄이 있으면 true (그러면 패널은 버튼을 그리지 않는다) */
export function useJudgeAction(onJudge: () => void): boolean {
  const register = useContext(JudgeActionContext);
  // 버튼은 늘 마지막 onJudge 를 부른다 (편집기 ref·입력 상태가 바뀌어도 다시 등록하지 않게)
  const latest = useRef(onJudge);
  latest.current = onJudge;
  useEffect(() => {
    if (!register) return;
    register(() => latest.current());
    return () => register(null);
  }, [register]);
  return register !== null;
}
