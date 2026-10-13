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
  it("프로그램이 쓰는 이름이면 이미 쓰고 있다고 알려 준다", () => {
    const answers = ["get_distance", "dist"];
    const asked: string[] = [];
    let result: string | null | undefined;
    createNamePrompt((m) => { asked.push(m); return answers.shift() ?? null; })("새 변수 이름:", "", (r) => { result = r; });
    expect(result).toBe("dist");
    expect(asked[1]).toContain("이 이름은 프로그램이 이미 쓰고 있어요. 다른 이름을 골라 주세요");
  });
  it("취소하면 null", () => {
    let result: string | null | undefined;
    createNamePrompt(() => null)("새 변수 이름:", "", (r) => { result = r; });
    expect(result).toBeNull();
  });
  it("함수 이름 창이면 함수 이름 안내를 보이고 같은 검사를 한다", () => {
    const answers = ["깜빡이기", "blink"];
    const asked: string[] = [];
    let result: string | null | undefined;
    createNamePrompt((m) => { asked.push(m); return answers.shift() ?? null; })("새 함수 이름:", "", (r) => { result = r; });
    expect(result).toBe("blink");
    expect(asked[0]).toContain("함수 이름은 영어 글자, 숫자, _ 만 쓸 수 있어요 (예: blink)");
    expect(asked[1]).toContain("함수 이름은 영어 글자, 숫자, _ 만 쓸 수 있어요 (예: blink)");
    expect(asked.join("\n")).not.toContain("변수 이름은");
  });
});
