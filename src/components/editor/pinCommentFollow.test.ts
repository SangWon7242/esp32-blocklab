import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, type Transaction } from "@codemirror/state";
import { history, undo } from "@codemirror/commands";
import { pinCommentFollow } from "./pinCommentFollow";

const START = "led_red = Pin(13, Pin.OUT)  # IO13 → 빨강\nled_yellow = Pin(14, Pin.OUT)  # IO14 → 노랑\n";

/** 학생 입력처럼 (userEvent) 바꾼다 */
function edit(state: EditorState, from: number, to: number, insert: string, userEvent = "input.type"): EditorState {
  return state.update({ changes: { from, to, insert }, selection: EditorSelection.cursor(from + insert.length), userEvent }).state;
}

const at = (state: EditorState, text: string) => state.doc.toString().indexOf(text);

describe("pinCommentFollow — 코드 모드에서 핀 숫자를 고치면 그 줄 주석이 따라간다", () => {
  const init = () => EditorState.create({ doc: START, extensions: [history(), pinCommentFollow()] });

  it("13 을 지우고 1, 5 를 치면 주석도 IO15, 커서는 숫자 뒤 그대로", () => {
    let s = init();
    const p = at(s, "13,");
    s = edit(s, p, p + 2, "", "delete.backward");
    expect(s.doc.line(1).text).toBe("led_red = Pin(, Pin.OUT)  # IO13 → 빨강");
    s = edit(s, p, p, "1");
    expect(s.doc.line(1).text).toBe("led_red = Pin(1, Pin.OUT)  # IO1 → 빨강");
    s = edit(s, p + 1, p + 1, "5");
    expect(s.doc.line(1).text).toBe("led_red = Pin(15, Pin.OUT)  # IO15 → 빨강");
    expect(s.selection.main.head).toBe(p + 2);
    // 다른 줄은 그대로
    expect(s.doc.line(2).text).toBe("led_yellow = Pin(14, Pin.OUT)  # IO14 → 노랑");
  });

  it("숫자를 골라 한 번에 바꿔도", () => {
    let s = init();
    const p = at(s, "14,");
    s = edit(s, p, p + 2, "16");
    expect(s.doc.line(2).text).toBe("led_yellow = Pin(16, Pin.OUT)  # IO16 → 노랑");
  });

  it("실행 취소 한 번에 핀과 주석이 같이 되돌아간다", () => {
    let s = init();
    const p = at(s, "13,");
    s = edit(s, p, p + 2, "15");
    expect(s.doc.line(1).text).toContain("IO15");
    undo({ state: s, dispatch: (tr: Transaction) => { s = tr.state; } });
    expect(s.doc.toString()).toBe(START);
  });

  it("바깥에서 넣은 글(userEvent 없음)은 건드리지 않는다", () => {
    let s = init();
    const p = at(s, "13,");
    s = s.update({ changes: { from: p, to: p + 2, insert: "15" } }).state;
    expect(s.doc.line(1).text).toBe("led_red = Pin(15, Pin.OUT)  # IO13 → 빨강");
  });
});
