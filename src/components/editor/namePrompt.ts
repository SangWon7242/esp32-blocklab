import { isProgramName, isValidPythonName, PROGRAM_NAME_HINT, VARIABLE_NAME_HINT } from "@/blocks";

type Ask = (message: string, defaultValue: string) => string | null;

/**
 * Blockly.dialog.setPrompt 에 넘길 변수 이름 창. 쓸 수 있는 파이썬 이름이 나오거나 취소할 때까지
 * 다시 묻는다. 한글 이름·키워드는 생성기가 다른 이름으로 바꿔 써서 코드와 블록이 어긋나고,
 * print·time·get_distance 처럼 프로그램이 쓰는 이름은 덮으면 생성 코드가 깨지기 때문이다.
 */
export function createNamePrompt(ask: Ask = (m, d) => window.prompt(m, d)) {
  return (message: string, defaultValue: string, callback: (result: string | null) => void): void => {
    let text = `${message}\n${VARIABLE_NAME_HINT}`;
    let value = defaultValue;
    for (;;) {
      const answer = ask(text, value);
      if (answer === null) return callback(null);
      value = answer.trim();
      if (isValidPythonName(value)) return callback(value);
      text = isProgramName(value) ? `'${value}': ${PROGRAM_NAME_HINT}` : `'${value}' 은(는) 쓸 수 없어요.\n${VARIABLE_NAME_HINT}`;
    }
  };
}
