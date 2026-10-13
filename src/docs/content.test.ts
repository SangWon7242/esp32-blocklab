import { describe, expect, it } from "vitest";
import { findDoc } from "./catalog";
import { CONTENT } from "./content";

/** 학생용 설명 글의 꼴 (계획 4 리뷰 반영): 2~4문장, "이 블록은"으로 시작하지 않기, 이모지 없음, 카탈로그에 있는 블록만 */
const sentences = (text: string) => text.split(/[.!?](?:\s+|$)/).filter((s) => s.trim().length > 0).length;
const EMOJI = /\p{Extended_Pictographic}/u;

describe("블록 설명 내용 규칙", () => {
  const entries = Object.entries(CONTENT);
  it("내용이 있는 블록 종류는 모두 카탈로그에 있다", () => {
    const unknown = entries.filter(([type]) => !findDoc(type)).map(([type]) => type);
    expect(unknown).toEqual([]);
  });
  it("개념 설명은 2~4문장이고 '이 블록은'으로 시작하지 않는다", () => {
    const bad = entries
      .filter(([, c]) => { const n = sentences(c.concept); return n < 2 || n > 4 || /^이 블록은/.test(c.concept.trim()); })
      .map(([type, c]) => `${type}: ${sentences(c.concept)}문장`);
    expect(bad).toEqual([]);
  });
  it("설명·예시·팁에 이모지가 없다", () => {
    const bad = entries
      .filter(([, c]) => EMOJI.test(c.concept) || EMOJI.test(c.example.title) || EMOJI.test(c.example.code) || (c.tips ?? []).some((t) => EMOJI.test(t)))
      .map(([type]) => type);
    expect(bad).toEqual([]);
  });
});
