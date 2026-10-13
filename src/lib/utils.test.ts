import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("클래스를 합치고 tailwind 충돌을 뒤쪽 값으로 정리한다", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
