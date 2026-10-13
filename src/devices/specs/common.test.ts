import { describe, expect, it } from "vitest";
import { isSingleArg, isSingleOperand } from "./common";

describe("isSingleOperand (1줄 lines 패턴의 곱셈 앞 그룹)", () => {
  it("이름·숫자·호출·괄호 식·곱셈은 피연산자 하나", () => {
    for (const t of ["90", "a", "f(x)", "(a + b)", "f(a - b)", "a * b", "x[i + 1]", '"a+b"']) expect(isSingleOperand(t), t).toBe(true);
  });
  it("괄호 밖 + 나 - 가 있거나 괄호가 맞지 않으면 아니다", () => {
    for (const t of ["offset + a", "a - b", "-a", "(a + b) + c", "a) + (b", "(a", 'f(")")+1']) expect(isSingleOperand(t), t).toBe(false);
  });
});

describe("isSingleArg (함수 인자 하나)", () => {
  it("괄호 밖 쉼표가 없으면 인자 하나", () => {
    for (const t of ["0", "max(a, b)", '"a, b"', "[1, 2]"]) expect(isSingleArg(t), t).toBe(true);
  });
  it("괄호 밖 쉼표가 있거나 괄호가 맞지 않으면 아니다", () => {
    for (const t of ["0, f(a", "b)", "a, b"]) expect(isSingleArg(t), t).toBe(false);
  });
});
