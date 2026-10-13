import { describe, expect, it } from "vitest";
import { createNamePrompt } from "./namePrompt";

describe("createNamePrompt", () => {
  it("쓸 수 있는 이름이 나올 때까지 다시 묻는다", () => {
    const answers = ["엘이디", "while", " led2 "];
    const asked: string[] = [];
    let result: string | null | undefined;
    createNamePrompt((m) => { asked.push(m); return answers.shift() ?? null; })("새 변수 이름:", "", (r) => { result = r; });
    expect(result).toBe("led2");
    expect(asked).toHaveLength(3);
    expect(asked[1]).toContain("영어 글자, 숫자, _");
  });
  it("취소하면 null", () => {
    let result: string | null | undefined;
    createNamePrompt(() => null)("새 변수 이름:", "", (r) => { result = r; });
    expect(result).toBeNull();
  });
});
