import { describe, expect, it } from "vitest";
import { loadChapters } from "./content";
import type { Chapter } from "./schema";
import {
  buildChapterSearchIndex, chapterDevices, chosungOf, makeSnippet, matchChapter, normalizeSearchText, parseSearchQuery, searchChapters,
  type SearchableChapter,
} from "./search";

const chapters = loadChapters();
const ids = (query: string) => searchChapters(chapters, query).map((h) => h.id);

/** 시험용 작은 챕터 */
function mini(over: Partial<SearchableChapter> = {}): SearchableChapter {
  const base: Chapter = {
    id: "99-test", order: 99, title: "시험 챕터", track: "sensor", label: "S99", status: "published",
    parts: [{ id: "p1", title: "1부", steps: [{ id: "problem", type: "problem", title: "문제 만나기", questions: ["왜?"] }] }],
  };
  return { ...base, ...over } as SearchableChapter;
}

describe("정규화", () => {
  it("공백·대소문자·문장 부호를 무시한다", () => {
    expect(normalizeSearchText(" HC-SR04  초음파 · 센서 ")).toBe("hcsr04초음파센서");
    expect(normalizeSearchText("**굵게** `code`")).toBe("굵게code");
  });
  it("초성 글", () => {
    expect(chosungOf("초음파 센서")).toBe("ㅊㅇㅍㅅㅅ");
    expect(chosungOf("OLED 화면")).toBe("oledㅎㅁ");
  });
  it("낱말 나누기: 빈 낱말·겹치는 낱말은 뺀다", () => {
    expect(parseSearchQuery("  초음파   LED  초음파 ·  ")).toEqual(["초음파", "led"]);
    expect(parseSearchQuery("   ")).toEqual([]);
  });
});

describe("장치 알아내기", () => {
  it("코드에서: 초음파 챕터는 초음파 센서, OLED 챕터는 OLED, 서보 챕터는 서보 모터", () => {
    const get = (id: string) => chapterDevices(chapters.find((c) => c.id === id)!);
    expect(get("17-ultrasonic")).toContain("초음파 센서");
    expect(get("21-oled")).toContain("OLED 화면");
    expect(get("18-servo")).toContain("서보 모터");
    expect(get("15-temp-humidity")).toContain("온습도 센서");
    expect(get("01-led")).toContain("LED");
    expect(get("01-led")).not.toContain("초음파 센서");
  });
  it("코드가 없으면 준비물 이름에서", () => {
    const ch = mini({ materials: [{ name: "HC-SR04 초음파 센서" }, { name: "SG90 서보 모터" }] });
    expect(chapterDevices(ch)).toEqual(["초음파 센서", "서보 모터"]);
  });
});

describe("searchChapters — 실제 챕터", () => {
  it("빈 검색어는 모든 챕터를 원래 순서대로", () => {
    expect(ids("")).toEqual(chapters.map((c) => c.id));
    expect(searchChapters(chapters, " ")[0]).toMatchObject({ score: 0, matchedIn: [], snippets: [] });
  });

  it("초음파: 초음파 챕터가 맨 앞이고, 초음파를 쓰는 융합 챕터(자동문 등)도 걸린다. 초음파와 무관한 LED 챕터는 빠진다", () => {
    const found = ids("초음파");
    expect(found[0]).toBe("17-ultrasonic");
    expect(found).toContain("10-auto-door");
    expect(found).not.toContain("01-led");
    expect(found.length).toBeLessThan(chapters.length);
  });

  it("영어 별칭·대소문자: ultrasonic · Oled · SERVO", () => {
    expect(ids("ultrasonic")).toContain("17-ultrasonic");
    expect(ids("Oled")).toContain("21-oled");
    expect(ids("SERVO")).toContain("18-servo");
  });

  it("공백 무시: '초음파센서' 도 '초음파 센서' 를 찾는다", () => {
    expect(ids("초음파센서")).toContain("17-ultrasonic");
  });

  it("여러 낱말은 모두 맞아야 한다 (AND)", () => {
    const both = ids("초음파 서보");
    expect(both).toContain("10-auto-door");
    expect(both).not.toContain("17-ultrasonic");
    expect(both).not.toContain("18-servo");
    for (const id of both) {
      expect(ids("초음파")).toContain(id);
      expect(ids("서보")).toContain(id);
    }
    expect(ids("초음파 없는낱말이다")).toEqual([]);
  });

  it("번호는 전체가 같을 때만: S14 → 초음파 하나, S1 은 S14 에 걸리지 않는다", () => {
    const s14 = searchChapters(chapters, "S14");
    expect(s14[0].id).toBe("17-ultrasonic");
    expect(s14[0].matchedIn[0]).toBe("번호");
    expect(searchChapters(chapters, "s1")[0].id).toBe("01-led");
    expect(searchChapters(chapters, "S1").filter((h) => h.matchedIn.includes("번호")).map((h) => h.id)).toEqual(["01-led"]);
    expect(ids("f4")[0]).toBe("31-safe-fan");
  });

  it("트랙 이름·교과·SDG", () => {
    const fusion = searchChapters(chapters, "교과 융합");
    expect(fusion.length).toBe(chapters.filter((c) => c.track === "fusion").length + fusion.filter((h) => h.chapter.track === "sensor").length);
    expect(fusion.filter((h) => h.chapter.track === "fusion").every((h) => h.matchedIn.includes("트랙"))).toBe(true);
    const sdg = searchChapters(chapters, "SDG 11");
    expect(sdg.map((h) => h.id)).toContain("10-auto-door");
    expect(sdg.find((h) => h.id === "10-auto-door")!.matchedIn).toContain("SDG");
    expect(searchChapters(chapters, "수학").some((h) => h.matchedIn.includes("교과"))).toBe(true);
  });

  it("단계 제목·원리 글·준비물에서도 찾는다", () => {
    const bat = searchChapters(chapters, "박쥐").find((h) => h.id === "17-ultrasonic")!;
    expect(bat.matchedIn).toEqual(expect.arrayContaining(["요약", "단계", "원리"]));
    const resistor = searchChapters(chapters, "220Ω");
    expect(resistor.find((h) => h.id === "01-led")!.matchedIn).toContain("준비물");
  });

  it("초성 검색: ㅊㅇㅍ → 초음파", () => {
    const found = searchChapters(chapters, "ㅊㅇㅍ");
    expect(found[0].id).toBe("17-ultrasonic");
    const title = found.find((h) => h.id === "17-ultrasonic")!.snippets.find((s) => s.field === "제목")!;
    expect(title.parts.filter((p) => p.match).map((p) => p.text)).toEqual(["초음파"]);
  });

  it("matchedIn 은 겹치지 않고 자리 순서대로, snippets 는 자리마다 하나", () => {
    for (const h of searchChapters(chapters, "LED")) {
      expect(new Set(h.matchedIn).size).toBe(h.matchedIn.length);
      expect(h.snippets.map((s) => s.field)).toEqual(h.matchedIn);
    }
  });

  it("색인을 미리 만들어 넘겨도 결과가 같다", () => {
    const index = buildChapterSearchIndex(chapters);
    expect(searchChapters(index, "온습도").map((h) => h.id)).toEqual(ids("온습도"));
    expect(matchChapter(index.entries[0], "없는낱말이다")).toBeNull();
  });
});

describe("강조 조각", () => {
  it("맞은 부분을 parts 로 나누고, 이어 붙이면 text 가 된다", () => {
    const hit = matchChapter(buildChapterSearchIndex([mini({ title: "초음파 거리 재기" })]).entries[0], "거리")!;
    const s = hit.snippets[0];
    expect(s.field).toBe("제목");
    expect(s.parts).toEqual([{ text: "초음파 ", match: false }, { text: "거리", match: true }, { text: " 재기", match: false }]);
    expect(s.parts.map((p) => p.text).join("")).toBe(s.text);
    expect(s.ranges).toEqual([[4, 6]]);
  });

  it("공백을 건너 맞아도 원래 글 범위로 강조한다 (초음파센서 → '초음파 센서')", () => {
    const hit = matchChapter(buildChapterSearchIndex([mini({ subtitle: "HC-SR04 초음파 센서로 재요" })]).entries[0], "초음파센서")!;
    const s = hit.snippets.find((x) => x.field === "부제")!;
    expect(s.parts.filter((p) => p.match).map((p) => p.text)).toEqual(["초음파 센서"]);
  });

  it("긴 글은 첫 맞은 곳 둘레만 자르고 … 를 붙인다", () => {
    const long = `${"가".repeat(100)}목표낱말${"나".repeat(100)}`;
    const s = makeSnippet("요약", long, [[100, 104]]);
    expect(s.text.startsWith("…")).toBe(true);
    expect(s.text.endsWith("…")).toBe(true);
    expect(s.parts.find((p) => p.match)!.text).toBe("목표낱말");
    expect(s.text.length).toBeLessThanOrEqual(82);
  });

  it("markdown 굵게·코드 표시는 조각에서 지운다", () => {
    const hit = matchChapter(buildChapterSearchIndex([mini({ summary: "**메아리**를 듣는 `센서`" })]).entries[0], "메아리")!;
    expect(hit.snippets[0].text).toBe("메아리를 듣는 센서");
  });

  it("호스트가 붙인 태그도 찾는다", () => {
    const hit = matchChapter(buildChapterSearchIndex([mini({ tags: ["안전", "생활"] })]).entries[0], "안전")!;
    expect(hit.matchedIn).toEqual(["태그"]);
  });
});
