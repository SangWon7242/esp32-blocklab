/*
 * Blockly 에 기대는 도구 묶음. src/lib/index.ts 의 loadBlockTools() 가 동적 import 로만 불러온다 (브라우저 전용 — Node 순수 경로에 안 실림).
 *   - canonicalLines: codeEquals 비교용 표준 꼴. judgeSnapshot(chapter, snapshot, { canonical: canonicalLines }) 로 넘기면 화면 판정과 같아진다
 *   - blocksToCode: 작업판 직렬화 JSON → MicroPython 코드
 *   - renderBlockSvg / acquireBlockRenderer: 블록 하나를 SVG 로 (acquire 로 숨긴 작업판을 잡고, 다 쓰면 돌려준다)
 */
export { canonicalLines } from "@/app/track/canonical";
export { workspaceJsonToCode as blocksToCode } from "@/codegen";
export { acquireBlockRenderer, renderBlockSvg } from "@/docs/renderBlock";
