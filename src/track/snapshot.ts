import type { StepRecord } from "./progress";

/**
 * 제출용 챕터 스냅숏 (계획 13 인터페이스 계약). 호스트는 `onSubmit(chapterId, snapshot)` 으로 받는다.
 * 만드는 함수(`chapterSnapshot`·`textAnswersOf`·`judgeSnapshot`)는 A2 에서 이 파일에 더한다.
 */
export type ChapterSnapshot = {
  chapterId: string;
  /** ISO 시각 */
  takenAt: string;
  /** stepId → 기록 */
  records: Record<string, StepRecord>;
  /** 편집기 단계가 저장한 프로그램 */
  programs: { stepId: string; code: string }[];
};
