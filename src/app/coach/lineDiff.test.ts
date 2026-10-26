import { describe, expect, it } from "vitest";
import { diffStats, foldRows, lineDiff, splitLines, type DiffRow } from "./lineDiff";

/** 행을 "+텍스트" / "-텍스트" / " 텍스트" 로 줄여 읽기 쉽게 */
const brief = (rows: DiffRow[]) => rows.map((r) => (r.kind === "add" ? "+" : r.kind === "del" ? "-" : " ") + r.text);

describe("splitLines", () => {
  it("끝 줄바꿈 하나는 줄로 세지 않고 \\r\\n 은 \\n 으로 본다", () => {
    expect(splitLines("a\r\nb\n")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
    expect(splitLines("a\n\n")).toEqual(["a", ""]);
  });
});

describe("lineDiff", () => {
  it("같은 코드는 모두 같음", () => {
    const rows = lineDiff("a\nb\n", "a\nb");
    expect(brief(rows)).toEqual([" a", " b"]);
    expect(diffStats(rows)).toEqual({ added: 0, removed: 0 });
  });

  it("가운데 줄 하나를 바꾸면 지움 다음 더함, 줄 번호는 각 코드 기준", () => {
    const rows = lineDiff("x = 1\nif x > 2000:\n    led.on()\n", "x = 1\nif x < 1500:\n    led.on()\n");
    expect(brief(rows)).toEqual([" x = 1", "-if x > 2000:", "+if x < 1500:", "     led.on()"]);
    expect(rows[1]).toEqual({ kind: "del", text: "if x > 2000:", oldLine: 2 });
    expect(rows[2]).toEqual({ kind: "add", text: "if x < 1500:", newLine: 2 });
    expect(rows[3]).toEqual({ kind: "same", text: "    led.on()", oldLine: 3, newLine: 3 });
  });

  it("줄을 끼워 넣으면 뒤 줄의 새 번호가 밀린다", () => {
    const rows = lineDiff("a\nb\nc", "a\n# [F1] 표식\nb\nc");
    expect(brief(rows)).toEqual([" a", "+# [F1] 표식", " b", " c"]);
    expect(rows[2]).toEqual({ kind: "same", text: "b", oldLine: 2, newLine: 3 });
    expect(diffStats(rows)).toEqual({ added: 1, removed: 0 });
  });

  it("빈 코드에서 시작하면 모두 더함, 모두 지우면 모두 지움", () => {
    expect(brief(lineDiff("", "a\nb"))).toEqual(["+a", "+b"]);
    expect(brief(lineDiff("a\nb", ""))).toEqual(["-a", "-b"]);
  });

  it("흩어진 변경도 가장 긴 공통 줄을 지킨다", () => {
    const rows = lineDiff("a\nb\nc\nd\ne", "a\nc\nd\nx\ne");
    expect(brief(rows)).toEqual([" a", "-b", " c", " d", "+x", " e"]);
  });

  it("줄 순서를 바꾸면 하나는 같음으로 남는다", () => {
    const rows = lineDiff("a\nb", "b\na");
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
    expect(rows.filter((r) => r.kind === "same")).toHaveLength(1);
  });

  it("아주 긴 코드도 멈추지 않는다 (표 한도를 넘으면 가운데를 통째로)", () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join("\n");
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join("\n");
    const rows = lineDiff(a, b);
    expect(diffStats(rows)).toEqual({ added: 3000, removed: 3000 });
  });
});

describe("foldRows", () => {
  it("바뀐 곳 둘레 3줄만 남기고 긴 같은 줄은 접는다", () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i + 1}`).join("\n");
    const after = before.replace("l10", "L10");
    const rows = foldRows(lineDiff(before, after));
    expect(rows[0]).toEqual({ kind: "fold", count: 6, oldLine: 1, newLine: 1 });
    expect(rows.filter((r) => r.kind === "same")).toHaveLength(6);
    expect(rows[rows.length - 1]).toEqual({ kind: "fold", count: 7, oldLine: 14, newLine: 14 });
  });

  it("한 줄짜리 묶음은 접지 않고, 바뀐 줄이 없으면 그대로", () => {
    const before = "a\nb\nc\nd\ne";
    const rows = foldRows(lineDiff(before, "a\nb\nc\nd\nE"));
    expect(rows.some((r) => r.kind === "fold")).toBe(false);
    expect(foldRows(lineDiff(before, before))).toHaveLength(5);
  });
});
