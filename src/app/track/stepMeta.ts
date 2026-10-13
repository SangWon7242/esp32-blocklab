import type { StepType } from "@/track/schema";

/** 단계 유형 이름 (목록 배지·안내 머리) */
export const STEP_TYPE_LABEL: Record<StepType, string> = {
  problem: "문제 만나기",
  analysis: "조건 분석",
  predict: "예측하기",
  run: "복사·실행",
  readcheck: "읽기 체크",
  mission: "미션",
  debug: "디버깅",
  design: "설계",
  reflect: "성찰",
};

/** 콘텐츠에 body 가 없을 때 왼쪽 안내 칸에 보일 기본 안내 */
export const STEP_TYPE_GUIDE: Record<StepType, string> = {
  problem: "정답을 맞히는 단계가 아니에요. 질문을 읽고 지금 떠오르는 생각을 내 말로 적어 보세요.\n\n모든 질문에 한 줄 이상 쓰면 완료할 수 있어요.",
  analysis: "만들 것을 세 칸으로 나눠 봅니다. 무엇을 알아야 하는지, 무엇을 정해야 하는지, 무엇을 해야 하는지 적어 보세요.\n\n세 칸을 다 쓰면 예시 답을 볼 수 있어요. 내 답과 비교한 뒤 완료하세요.",
  predict: "코드를 실행하기 전에 결과를 먼저 예상해 봅니다. 틀려도 괜찮아요. 실행해 본 뒤 예상과 무엇이 달랐는지가 중요해요.",
  run: "코드를 그대로 옮겨 보드에서 실행해 봅니다.",
  readcheck: "코드를 천천히 읽고 질문에 답하세요. 다 고른 뒤 확인을 누르면 채점합니다. 틀리면 힌트를 보고 다시 해 보세요.",
  mission: "주어진 코드를 고쳐 미션을 해결합니다.",
  debug: "고장 난 코드에서 증상의 원인을 찾아 고칩니다.",
  design: "코드로 옮기기 전에 우리말로 순서를 먼저 적어 봅니다.",
  reflect: "완성한 코드를 한 줄씩 내 말로 풀어 쓰고, 오늘 한 생각을 정리합니다.\n\n줄 설명은 할 수 있는 만큼, 아래 성찰 네 칸은 모두 써야 완료할 수 있어요.",
};
