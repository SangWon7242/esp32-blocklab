import { workspaceJsonToCode } from "@/codegen";
import { codeToBlocks, normalizeCode } from "@/parser";

/**
 * 판정(codeEquals)용 표준 꼴: 블록으로 바꿨다가 다시 코드로 낸 것(정규화). 생성기는 함수 정의를 준비 줄 위로 올리고
 * import 순서를 정하므로, 선생님 원본 파일(함수가 아래, import 순서가 다른)과 학생이 블록 모드에서 만든 코드가 글자 순서만
 * 달라도 같다고 본다. 파싱이 안 되면 정규화한 원문. src/track 은 Blockly 에 기대지 않으므로 여기(화면 쪽)에 둔다.
 */
export function canonicalLines(code: string): string[] {
  try {
    const r = codeToBlocks(code);
    if (r.ok) return normalizeCode(workspaceJsonToCode(r.json));
  } catch {
    /* 파서·생성기 예외면 원문 비교 */
  }
  return normalizeCode(code);
}
