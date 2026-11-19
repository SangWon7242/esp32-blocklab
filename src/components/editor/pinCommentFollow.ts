import { EditorState, StateEffect, StateField, type Extension, type Transaction, type TransactionSpec } from "@codemirror/state";
import { EMPTY_PIN_MEMORY, followPinLine, type PinMemory } from "@/track/pinComment";

/*
 * 코드 모드: 학생이 `Pin(13` 을 `Pin(15` 로 고치면 같은 줄 주석의 13 도 15 로 (src/track/pinComment.ts followPinLine).
 * 학생의 입력 트랜잭션에 주석 부분만 바꾸는 변경을 붙인다(transactionFilter) — 한 트랜잭션이라 실행 취소 한 번에 같이 되돌아가고,
 * 주석은 고친 숫자 뒤에 있어 커서가 움직이지 않는다. 한 줄 안의 입력·지우기만 본다 (붙여 넣기·여러 줄 편집·바깥에서 넣은 글은 그대로).
 */

const setMemory = StateEffect.define<PinMemory>();
/** 숫자를 다 지운 사이(`Pin(`) 옛 번호를 기억한다 */
const memoryField = StateField.define<PinMemory>({
  create: () => EMPTY_PIN_MEMORY,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMemory)) return e.value;
    return value;
  },
});

function follow(tr: Transaction): Transaction | readonly (Transaction | TransactionSpec)[] {
  if (!tr.docChanged || !(tr.isUserEvent("input") || tr.isUserEvent("delete"))) return tr;
  const ranges: [number, number, number, number][] = [];
  tr.changes.iterChanges((fromA, toA, fromB, toB) => ranges.push([fromA, toA, fromB, toB]));
  if (ranges.length !== 1) return tr;
  const [fromA, toA, fromB, toB] = ranges[0];
  const oldLine = tr.startState.doc.lineAt(fromA);
  const newLine = tr.newDoc.lineAt(fromB);
  if (tr.startState.doc.lineAt(toA).number !== oldLine.number || tr.newDoc.lineAt(toB).number !== newLine.number) return tr;

  const memory = tr.startState.field(memoryField, false);
  if (memory === undefined) return tr;
  const r = followPinLine(oldLine.text, newLine.text, memory);
  if (r.line === newLine.text && r.memory === memory) return tr;
  const spec: TransactionSpec = { sequential: true };
  if (r.memory !== memory) spec.effects = setMemory.of(r.memory);
  if (r.line !== newLine.text) {
    // 앞이 같은 만큼은 두고 주석의 바뀐 뒤쪽만
    let cut = 0;
    while (cut < r.line.length && r.line[cut] === newLine.text[cut]) cut++;
    spec.changes = { from: newLine.from + cut, to: newLine.to, insert: r.line.slice(cut) };
  }
  return [tr, spec];
}

/** CodeMirror 확장: 핀 숫자를 고치면 그 줄 주석의 번호가 따라간다 */
export function pinCommentFollow(): Extension {
  return [memoryField, EditorState.transactionFilter.of(follow)];
}
