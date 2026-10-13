import * as Blockly from "blockly";
import * as Ko from "blockly/msg/ko";

/** 내장 블록의 한국어 문구를 엔트리 표현에 맞춘다. registerBlocks() 안에서 한 번 호출. */
export function applyKoreanMessages(): void {
  Blockly.setLocale(Ko as unknown as Record<string, string>);
  Object.assign(Blockly.Msg, {
    CONTROLS_IF_MSG_IF: "만약",
    CONTROLS_IF_MSG_THEN: "이라면",
    CONTROLS_IF_MSG_ELSE: "아니면",
    CONTROLS_IF_MSG_ELSEIF: "아니면 만약",
    LOGIC_NEGATE_TITLE: "%1 이(가) 아니다",
    LOGIC_BOOLEAN_TRUE: "참",
    LOGIC_BOOLEAN_FALSE: "거짓",
    VARIABLES_SET: "%1 를 %2 로 정하기",
    PROCEDURES_DEFNORETURN_TITLE: "함수 정의하기",
    PROCEDURES_DEFNORETURN_PROCEDURE: "이름",
    PROCEDURES_DEFRETURN_TITLE: "함수 정의하기",
    PROCEDURES_DEFRETURN_PROCEDURE: "이름",
    PROCEDURES_DEFRETURN_RETURN: "돌려주기",
    PROCEDURES_BEFORE_PARAMS: "매개변수:",
    PROCEDURES_CALL_BEFORE_PARAMS: "값:",
    PROCEDURES_CALLNORETURN_TOOLTIP: "정의한 함수를 실행합니다.",
    PROCEDURES_CALLRETURN_TOOLTIP: "정의한 함수를 실행하고 결과값을 돌려줍니다.",
    NEW_VARIABLE: "변수 만들기",
  });
}
