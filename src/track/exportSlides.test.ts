import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { loadChapter } from "../../scripts/slides/chapter.ts";
import { buildDeck, deckBuffer, fixSlideXml, paginate, type Png } from "../../scripts/slides/deck.ts";
import { blockLines, markdownBlocks } from "../../scripts/slides/text.ts";

/*
 * 슬라이드 내보내기(scripts/export-slides.ts, npm run slides)의 단위 테스트.
 * 그림은 Playwright 대신 가짜 래스터라이저(1x1 PNG)를 써서 브라우저 없이 돈다.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

async function exportChapter(id: string) {
  const loaded = loadChapter(ROOT, id);
  const asked: string[] = [];
  const rasterize = async (_svg: string, ref: string): Promise<Png> => {
    asked.push(ref);
    return { data: `image/png;base64,${PNG_1x1}`, width: 640, height: 360 };
  };
  const { pres, slideCount } = await buildDeck(loaded, { rasterize, font: "Malgun Gothic", codeFont: "Consolas" });
  const buf = await deckBuffer(pres);
  const zip = await JSZip.loadAsync(buf);
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  const slides = await Promise.all(slideNames.map((n) => zip.file(n)!.async("string")));
  const stepCount = loaded.chapter.parts.reduce((n, p) => n + p.steps.length, 0);
  return { loaded, buf, slides, slideCount, stepCount, asked, all: slides.join("\n") };
}

/** 슬라이드 XML 의 글(<a:t>)만 이어 붙인다 */
function texts(xml: string): string {
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join("");
}

describe("슬라이드 내보내기", () => {
  for (const id of ["01-led", "10-auto-door"]) {
    it(`${id}: pptx 를 만들고, 장 수 ≥ 단계 수 + 5, 표지에 챕터 제목`, async () => {
      const { loaded, buf, slides, slideCount, stepCount, asked } = await exportChapter(id);
      expect(buf.length).toBeGreaterThan(10_000);
      expect(slides.length).toBe(slideCount);
      expect(slides.length).toBeGreaterThanOrEqual(stepCount + 5);
      expect(texts(slides[0])).toContain(loaded.chapter.title);
      // 표지·배선·원리·장면 그림을 모두 그려 달라고 했다
      expect(asked).toContain(loaded.chapter.cover);
      if (loaded.chapter.wiring) expect(asked).toContain(loaded.chapter.wiring.image);
      // 마지막 장은 교사용
      expect(texts(slides[slides.length - 1])).toContain("교사 모드");
    }, 60_000);
  }

  it("학생에게 숨기는 답(조건 분석 예시 답·정답 코드)은 넣지 않는다", async () => {
    const { loaded, slides } = await exportChapter("01-led");
    const body = slides.map(texts).join("\n");
    for (const part of loaded.chapter.parts) {
      for (const step of part.steps) {
        if (step.type === "analysis") for (const a of [...step.answer.know, ...step.answer.decide, ...step.answer.act]) expect(body).not.toContain(a);
        if (step.type === "mission" && step.answerCode) expect(body).not.toContain(step.answerCode);
      }
    }
  }, 60_000);

  it("app 단계: 설계 세 칸(빈 칸)·약속표·프롬프트 템플릿·검사 항목·읽기 체크 문항 (답은 넣지 않는다)", async () => {
    const loaded = loadChapter(ROOT, "01-led");
    const app = {
      type: "app" as const,
      id: "app-test",
      title: "폰 앱 만들기",
      api: [
        { path: "/data", method: "읽기" as const, fields: ["temp"], note: "2초마다 읽기" },
        { path: "/cmd?led=on", method: "명령" as const, note: "LED 켜기" },
      ],
      design: { show: ["보기글온도"], buttons: [], changes: [] },
      promptTemplate: "ESP32 주소 {{ip}} 에서 {{data}} 를 읽어 {{show}} 을(를) 보여 줘.\n외부 라이브러리 없이.\n",
      readcheck: [{ kind: "choice" as const, q: "값을 가져오는 함수는?", options: ["fetch", "print"], answer: 0, hint: "숨긴힌트" }],
    };
    const chapter = { ...loaded.chapter, parts: [{ id: "p", title: "앱", steps: [app] }] };
    const { pres } = await buildDeck({ ...loaded, chapter }, { font: "Malgun Gothic", codeFont: "Consolas" });
    const zip = await JSZip.loadAsync(await deckBuffer(pres));
    const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    const body = (await Promise.all(names.map((n) => zip.file(n)!.async("string")))).map(texts).join("\n");
    for (const t of ["화면 설계", "보여 줄 값", "누를 버튼", "바뀌는 모습", "약속표", "/cmd?led=on", "프롬프트 템플릿", "＿＿(보여 줄 값)", "붙여넣기 검사", "약속 주소 /data 쓰기", "크기 12000 바이트 이하", "값을 가져오는 함수는?"]) {
      expect(body).toContain(t);
    }
    // 학생 설계 칸은 빈 칸으로 (보기 글은 넣지 않는다), 힌트도 넣지 않는다
    expect(body).not.toContain("보기글온도");
    expect(body).not.toContain("숨긴힌트");
  }, 60_000);

  it("한 문단에 문단 속성(pPr)은 하나뿐이고, 동아시아 글꼴은 한글 charset", async () => {
    const { all } = await exportChapter("01-led");
    for (const [, para] of all.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)) expect((para.match(/<a:pPr\b/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(all).not.toContain('charset="-122"');
    expect(fixSlideXml('<a:p><a:pPr marL="1"/><a:r><a:t>a</a:t></a:r><a:pPr indent="0"><a:buNone/></a:pPr><a:r><a:t>b</a:t></a:r></a:p>')).toBe(
      '<a:p><a:pPr marL="1"/><a:r><a:t>a</a:t></a:r><a:r><a:t>b</a:t></a:r></a:p>',
    );
  }, 60_000);

  it("글은 한 장에 8줄 이하로 나눈다", () => {
    const md = Array.from({ length: 6 }, (_, i) => `${i + 1}번째 문단은 한 줄보다 훨씬 긴 문장이라서 슬라이드 글 칸에서는 두 줄 이상으로 접혀 보이게 됩니다.`).join("\n\n");
    const pages = paginate([{ blocks: markdownBlocks(md) }], () => 6.75, 22, 8);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const lines = page.reduce((n, s) => n + s.blocks.reduce((m, b) => m + blockLines(b, 22, 6.75), 0), 0);
      expect(lines).toBeLessThanOrEqual(8);
    }
  });

  it("markdown: 글머리·번호·굵게·코드", () => {
    const blocks = markdownBlocks("첫 문단 **굵게** 와 `code**x**`\n\n- 하나\n  이어짐\n2. 둘");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "bullet", "number"]);
    expect(blocks[0].runs).toEqual([{ text: "첫 문단 " }, { text: "굵게", bold: true }, { text: " 와 " }, { text: "code**x**", code: true }]);
    expect(blocks[1].runs.map((r) => r.text).join("")).toBe("하나 이어짐");
    expect(blocks[2].n).toBe(2);
  });
});
