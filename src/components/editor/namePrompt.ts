import { FUNCTION_NAME_HINT, isReservedName, isValidPythonName, PROGRAM_NAME_HINT, VARIABLE_NAME_HINT } from "@/blocks";

type Ask = (message: string, defaultValue: string) => string | null;

/**
 * Blockly.dialog.setPrompt 에 넘길 이름 창. Blockly 는 변수·함수 이름 둘 다에 이 창을 쓰므로 메시지에
 * "함수"가 들면 함수 이름 안내를 보인다. 쓸 수 있는 파이썬 이름이 나오거나 취소할 때까지 다시 묻는다.
 * 한글 이름·키워드는 생성기가 다른 이름으로 바꿔 써서 코드와 블록이 어긋나고,
 * print·time·trig 처럼 프로그램이 쓰는 이름은 덮으면 생성 코드가 깨지기 때문이다. 함수 이름은 get_distance 같은 장치 도우미 이름도 된다
 * (그 함수 블록이 도우미가 된다).
 */
export function createNamePrompt(ask: Ask = (m, d) => window.prompt(m, d)) {
  return (message: string, defaultValue: string, callback: (result: string | null) => void): void => {
    const kind = message.includes("함수") ? "function" : "variable";
    const hint = kind === "function" ? FUNCTION_NAME_HINT : VARIABLE_NAME_HINT;
    let text = `${message}\n${hint}`;
    let value = defaultValue;
    for (;;) {
      const answer = ask(text, value);
      if (answer === null) return callback(null);
      value = answer.trim();
      if (isValidPythonName(value, kind)) return callback(value);
      text = isReservedName(value, kind) ? `'${value}': ${PROGRAM_NAME_HINT}` : `'${value}' 은(는) 쓸 수 없어요.\n${hint}`;
    }
  };
}
