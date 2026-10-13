import { describe, expect, it } from "vitest";
import { diffLintMarks, type MarkedBlock } from "./lintMarks";

type Fake = { id: string; dead?: boolean };
const isDead = (b: Fake) => !!b.dead;
const marks = (...entries: [string, MarkedBlock<Fake>][]) => new Map(entries);

describe("diffLintMarks", () => {
  it("같은 블록·같은 글·같은 수준이면 건드리지 않는다", () => {
    const a: Fake = { id: "a" };
    const d = diffLintMarks(marks(["a", { block: a, text: "x", level: "error" }]), marks(["a", { block: a, text: "x", level: "error" }]), isDead);
    expect(d).toEqual({ clear: [], apply: [] });
  });

  it("글이 바뀌면 경고 글과 테두리를, 수준만 바뀌면 테두리만 다시 단다", () => {
    const a: Fake = { id: "a" };
    const prev = marks(["a", { block: a, text: "x", level: "warning" }]);
    expect(diffLintMarks(prev, marks(["a", { block: a, text: "y", level: "warning" }]), isDead).apply).toEqual([{ block: a, text: "y", level: "warning", setText: true }]);
    expect(diffLintMarks(prev, marks(["a", { block: a, text: "x", level: "error" }]), isDead).apply).toEqual([{ block: a, text: "x", level: "error", setText: false }]);
  });

  it("사라진 문제는 (살아 있는 블록이면) 뗀다", () => {
    const a: Fake = { id: "a" };
    const gone: Fake = { id: "g", dead: true };
    const d = diffLintMarks(marks(["a", { block: a, text: "x", level: "error" }], ["g", { block: gone, text: "x", level: "error" }]), marks(), isDead);
    expect(d).toEqual({ clear: [a], apply: [] });
  });

  it("같은 id 로 지웠다 다시 만든 블록은 글이 같아도 새로 단다", () => {
    const old: Fake = { id: "a", dead: true };
    const fresh: Fake = { id: "a" };
    const d = diffLintMarks(marks(["a", { block: old, text: "x", level: "error" }]), marks(["a", { block: fresh, text: "x", level: "error" }]), isDead);
    expect(d).toEqual({ clear: [], apply: [{ block: fresh, text: "x", level: "error", setText: true }] });
  });
});
