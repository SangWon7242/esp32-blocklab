import type { LoadedChapter } from "@/track/content";
import type { StepOf, StepType } from "@/track/schema";

/** 단계 활동 컴포넌트가 받는 것. input 은 StepRecord.input 그대로 */
export type StepProps<T extends StepType> = {
  step: StepOf<T>;
  chapter: LoadedChapter;
  input: Record<string, unknown>;
  /** 입력을 바꾸고 저장한다. attempt 면 시도 횟수를 하나 올린다 (읽기 체크 "확인") */
  onInput(next: Record<string, unknown>, opts?: { attempt?: boolean }): void;
  teacherMode: boolean;
  attempts: number;
  /** 단계를 완료로 기록한다 (extra 는 입력에 합친다). 편집기 단계가 스스로 끝낼 때 (실행 성공) */
  onComplete(extra?: Record<string, unknown>): void;
  /** 열람 모드: 기록을 보여 주기만 한다 (입력은 꺼지고 판정·저장·확인 버튼은 숨긴다) */
  readOnly?: boolean;
};
