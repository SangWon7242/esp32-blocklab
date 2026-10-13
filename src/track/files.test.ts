import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentFile } from "./files";

describe("contentFile", () => {
  it("챕터 id/파일 이름으로 콘텐츠 .py 글을 준다", () => {
    const want = readFileSync("content/chapters/10-auto-door/step1_distance.py", "utf8");
    expect(contentFile("10-auto-door/step1_distance.py")).toBe(want);
  });
  it("모르는 이름·이상한 모양이면 undefined", () => {
    expect(contentFile("10-auto-door/nope.py")).toBeUndefined();
    expect(contentFile("../etc/passwd")).toBeUndefined();
    expect(contentFile(null)).toBeUndefined();
    expect(contentFile("10-auto-door/chapter.yaml")).toBeUndefined();
  });
});
