import { describe, expect, it } from "vitest";
import { parseGuide, parseInline } from "./guideMarkdown";

const t = (text: string) => ({ kind: "text", text });

describe("parseInline", () => {
  it("굵게·코드", () => {
    expect(parseInline("LED **긴 다리**를 `26`번 핀에")).toEqual([
      t("LED "), { kind: "bold", text: "긴 다리" }, t("를 "), { kind: "code", text: "26" }, t("번 핀에"),
    ]);
  });
  it("코드 안의 ** 는 그대로, 닫히지 않은 꾸밈은 글자 그대로", () => {
    expect(parseInline("`a ** b` 와 **열기만")).toEqual([{ kind: "code", text: "a ** b" }, t(" 와 **열기만")]);
    expect(parseInline("`닫지 않음")).toEqual([t("`닫지 않음")]);
    expect(parseInline("2 * 3 = 6")).toEqual([t("2 * 3 = 6")]);
  });
});

describe("parseGuide", () => {
  it("빈 줄로 문단을 나누고 문단 안 줄바꿈은 둔다", () => {
    expect(parseGuide("첫 줄\n둘째 줄\n\n  \n다음 문단\n")).toEqual([
      { kind: "p", inlines: [t("첫 줄\n둘째 줄")] },
      { kind: "p", inlines: [t("다음 문단")] },
    ]);
  });

  it("글머리 목록과 번호 목록, 문단과 바로 붙어 있어도 나뉜다", () => {
    expect(parseGuide("준비물:\n- 보드\n* **LED**\n이어서\n3. 연결\n4. 실행")).toEqual([
      { kind: "p", inlines: [t("준비물:")] },
      { kind: "ul", items: [[t("보드")], [{ kind: "bold", text: "LED" }]] },
      { kind: "p", inlines: [t("이어서")] },
      { kind: "ol", start: 3, items: [[t("연결")], [t("실행")]] },
    ]);
  });

  it("들여 쓴 다음 줄은 앞 항목에 이어 붙고, 종류가 바뀌면 목록을 새로 연다", () => {
    expect(parseGuide("- 첫 항목\n  이어지는 글\n1. 번호")).toEqual([
      { kind: "ul", items: [[t("첫 항목 이어지는 글")]] },
      { kind: "ol", start: 1, items: [[t("번호")]] },
    ]);
  });

  it("빈 글은 빈 배열", () => {
    expect(parseGuide("  \n\n")).toEqual([]);
  });
});

import { parseInline as _parseInlineOneChar } from "./guideMarkdown";
it("한 글자도 굵게 된다 (**0**)", () => {
  expect(_parseInlineOneChar("값이 **0** 이면")).toEqual([
    { kind: "text", text: "값이 " }, { kind: "bold", text: "0" }, { kind: "text", text: " 이면" },
  ]);
});
