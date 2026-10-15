/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { registerBlocks } from "@/blocks";
import { codeToBlocks } from "@/parser";
import { codeRefs, imageRefs, loadChapters, parseChapter } from "./content";
import { allChapterImages, chapterImage, sanitizeSvg, unsafeSvgReason } from "./images";
import { allSteps } from "./gating";
import { judge } from "./judge";
import type { LoadedChapter } from "./content";

const root = join(process.cwd(), "content/chapters");

function readDir(dir: string) {
  const files: Record<string, string> = {};
  for (const f of readdirSync(join(root, dir)).filter((f) => f.endsWith(".py"))) files[f] = readFileSync(join(root, dir, f), "utf8");
  return { yaml: readFileSync(join(root, dir, "chapter.yaml"), "utf8"), files, images: readImages(dir) };
}

/** 폴더의 그림 이름들 ("images/x.svg") */
function readImages(dir: string): string[] {
  const d = join(root, dir, "images");
  return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".svg")).map((f) => `images/${f}`) : [];
}

const chapterDirs = () => readdirSync(root).filter((d) => existsSync(join(root, d, "chapter.yaml")));

const chapters: Record<string, LoadedChapter> = {};
beforeAll(() => {
  registerBlocks();
  for (const dir of ["01-led", "10-auto-door"]) {
    const { yaml, files, images } = readDir(dir);
    chapters[dir] = parseChapter(yaml, files, dir, images);
  }
});

describe("챕터 YAML", () => {
  it("두 YAML 이 스키마를 통과한다", () => {
    expect(chapters["01-led"].title).toBe("LED 켜기");
    expect(chapters["10-auto-door"].title).toBe("다가가면 열리는 자동문");
  });

  it("단계 수: 챕터 1 은 8, 챕터 10 은 14 (1부 7 + 2부 7)", () => {
    expect(allSteps(chapters["01-led"]).map((s) => s.type)).toEqual(["problem", "analysis", "predict", "run", "readcheck", "mission", "design", "reflect"]);
    const ch10 = chapters["10-auto-door"];
    expect(ch10.parts.map((p) => p.steps.map((s) => s.id))).toEqual([
      ["problem", "analysis", "predict", "run1", "readcheck1", "mission1", "debug1"],
      ["design", "run2", "readcheck2", "mission2", "debug2", "extra", "reflect"],
    ]);
    expect(allSteps(ch10).filter((s) => s.optional).map((s) => s.id)).toEqual(["debug2", "extra"]);
  });

  it("참조한 코드 파일이 모두 폴더에 있다", () => {
    for (const [dir, ch] of Object.entries(chapters)) {
      const refs = codeRefs(ch);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(readdirSync(join(root, dir))).toContain(ref);
      expect(Object.keys(ch.files).sort()).toEqual(expect.arrayContaining(refs));
    }
  });

  it("읽기 체크의 줄 문항은 그 파일의 해당 줄을 가리킨다", () => {
    const ch1 = chapters["01-led"];
    const rc = allSteps(ch1).find((s) => s.type === "readcheck");
    if (rc?.type !== "readcheck") throw new Error("readcheck 없음");
    const line = rc.questions.find((q) => q.kind === "line")!;
    expect(ch1.files[rc.code].split("\n")[line.answer - 1]).toContain("time.sleep(1)");
  });

  it("정답 코드는 자기 미션 규칙을 통과한다", async () => {
    for (const ch of Object.values(chapters)) {
      for (const step of allSteps(ch)) {
        if (step.type !== "mission" || !step.answerCode) continue;
        const code = ch.files[step.answerCode];
        const r = codeToBlocks(code);
        if (!r.ok) throw new Error(`${step.id} 정답 파싱 실패`);
        expect(judge(step.rules, { code, blocksJson: r.json }, ch.files), `${ch.id}/${step.id}`).toEqual({ pass: true, failures: [] });
      }
    }
  });

  it("챕터 1 미션은 정답 파일과 같은 코드면 통과, 처음 코드면 실패", () => {
    const ch1 = chapters["01-led"];
    const m = allSteps(ch1).find((s) => s.id === "mission");
    if (m?.type !== "mission") throw new Error("mission 없음");
    expect(judge(m.rules, { code: ch1.files["mission1_slow_blink.py"] }, ch1.files).pass).toBe(true);
    expect(judge(m.rules, { code: ch1.files["step4_blink_loop.py"] }, ch1.files).failures).toEqual(["켜진 시간과 꺼진 시간이 다른가요? time.sleep 숫자를 다시 보세요"]);
  });

  it("디버깅 증상 코드는 고치기 전엔 규칙에 걸린다", () => {
    for (const ch of Object.values(chapters)) {
      for (const step of allSteps(ch)) {
        if (step.type !== "debug") continue;
        for (const s of step.symptoms) expect(judge(s.rules, { code: s.code }).pass, s.title).toBe(false);
      }
    }
  });

  it("참조한 그림이 모두 images/ 폴더에 있고 import.meta.glob 으로도 읽힌다", () => {
    for (const ch of loadChapters()) {
      for (const ref of imageRefs(ch)) {
        expect(existsSync(join(root, ch.id, ref)), `${ch.id}/${ref}`).toBe(true);
        expect(chapterImage(ch.id, ref), `${ch.id}/${ref}`).toMatch(/<svg\b/);
      }
    }
  });

  it("모든 그림 파일에 script·on* 처리기·javascript: 가 없다", () => {
    for (const dir of chapterDirs()) {
      for (const ref of readImages(dir)) {
        expect(unsafeSvgReason(readFileSync(join(root, dir, ref), "utf8")), `${dir}/${ref}`).toBeNull();
      }
    }
    for (const [path, svg] of Object.entries(allChapterImages())) expect(unsafeSvgReason(svg), path).toBeNull();
  });

  it("loadChapters 는 import.meta.glob 으로 모든 챕터를 order 순으로 읽는다", () => {
    const loaded = loadChapters();
    const ids = loaded.map((c) => c.id);
    expect(ids).toContain("01-led");
    expect(ids).toContain("10-auto-door");
    expect(loaded.map((c) => c.order)).toEqual([...loaded.map((c) => c.order)].sort((a, b) => a - b));
    expect(loaded.find((c) => c.id === "10-auto-door")).toEqual(chapters["10-auto-door"]);
  });
});

describe("parseChapter 는 잘못된 YAML 을 거부한다", () => {
  const files = { "a.py": "print(1)\n" };
  const base = (step: string) => `id: x\norder: 1\ntitle: x\ntrack: sensor\nlabel: S1\nparts:\n  - id: p\n    title: p\n    steps:\n${step}`;
  it("없는 코드 파일", () => {
    expect(() => parseChapter(base("      - { id: r, type: run, title: r, code: b.py }\n"), files, "x")).toThrow(/b\.py/);
  });
  it("모르는 유형·모르는 키", () => {
    expect(() => parseChapter(base("      - { id: r, type: quiz, title: r }\n"), files, "x")).toThrow();
    expect(() => parseChapter(base("      - { id: r, type: run, title: r, code: a.py, cod: a.py }\n"), files, "x")).toThrow();
  });
  it("겹치는 단계 id", () => {
    expect(() => parseChapter(base("      - { id: r, type: run, title: r, code: a.py }\n      - { id: r, type: run, title: r2, code: a.py }\n"), files, "x")).toThrow(/r/);
  });
  it("폴더 이름과 다른 id", () => {
    expect(() => parseChapter(base("      - { id: r, type: run, title: r, code: a.py }\n"), files, "y")).toThrow(/y/);
  });
  it("정규식이 틀린 codeMatches, 범위 밖 선택지 답, 파일 밖 줄 번호", () => {
    expect(() => parseChapter(base('      - { id: m, type: mission, title: m, instructions: i, rules: [{ codeMatches: "(", fail: f }] }\n'), files, "x")).toThrow();
    expect(() => parseChapter(base('      - { id: c, type: readcheck, title: c, code: a.py, questions: [{ kind: choice, q: q, options: [a, b], answer: 2 }] }\n'), files, "x")).toThrow();
    expect(() => parseChapter(base('      - { id: c, type: readcheck, title: c, code: a.py, questions: [{ kind: line, q: q, answer: 5 }] }\n'), files, "x")).toThrow(/줄/);
  });
});

describe("그림·할 일·부품 키", () => {
  const files = { "a.py": "print(1)\n" };
  const chapter = (head: string, step = "{ id: r, type: run, title: r, code: a.py }") =>
    `id: x\norder: 1\ntitle: x\ntrack: sensor\nlabel: S1\n${head}parts:\n  - id: p\n    title: p\n    steps:\n      - ${step}\n`;
  const full = chapter(
    "summary: 요약\ncover: images/cover.svg\nmaterials:\n  - { name: LED, image: images/led.svg, note: 긴 다리가 + }\n  - { name: 점퍼선 }\nwiring: { image: images/wiring.svg, caption: 26번 핀 }\n",
    "{ id: r, type: run, title: r, code: a.py, scene: { image: images/scene.svg, caption: 교실 }, todo: [보드 연결, 실행] }",
  );

  it("새 키를 받아들이고 imageRefs 가 표지·부품·배선·장면 순으로 모은다", () => {
    const ch = parseChapter(full, files, "x");
    expect(ch.summary).toBe("요약");
    expect(allSteps(ch)[0].todo).toEqual(["보드 연결", "실행"]);
    expect(imageRefs(ch)).toEqual(["images/cover.svg", "images/led.svg", "images/wiring.svg", "images/scene.svg"]);
  });

  it("images 를 주면 없는 그림을 잡는다", () => {
    expect(() => parseChapter(full, files, "x", ["images/cover.svg", "images/led.svg", "images/wiring.svg"])).toThrow(/images\/scene\.svg/);
    expect(() => parseChapter(full, files, "x", ["images/cover.svg", "images/led.svg", "images/wiring.svg", "images/scene.svg"])).not.toThrow();
  });

  it("그림 경로 모양, 할 일 개수, 모르는 키", () => {
    expect(() => parseChapter(chapter("cover: cover.svg\n"), files, "x")).toThrow(/images/);
    expect(() => parseChapter(chapter("cover: images/../a.svg\n"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("cover: images/a.png\n"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, todo: [a, b, c, d, e] }"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, todo: [] }"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, scene: { img: images/a.svg } }"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("materials:\n  - { name: LED, img: images/a.svg }\n"), files, "x")).toThrow();
  });
});

describe("원리·실행 결과·코드 설명 (Keyestudio 수업 구조)", () => {
  const files = { "a.py": "import time\n\nprint(1)\n" };
  const chapter = (head: string, step: string) =>
    `id: x\norder: 1\ntitle: x\ntrack: sensor\nlabel: S1\n${head}parts:\n  - id: p\n    title: p\n    steps:\n      - ${step}\n`;
  const run = "{ id: r, type: run, title: r, code: a.py, expected: 불이 켜져요, codeNotes: [{ line: 1, note: 시간 기능 }, { line: 3, note: 출력 }] }";
  const rc = (line: number) =>
    `{ id: c, type: readcheck, title: c, code: a.py, questions: [{ kind: number, q: q, answer: 1 }], codeNotes: [{ line: ${line}, note: n }] }`;

  it("원리·실행 결과·코드 설명을 받아들이고, 원리 그림도 그림 참조에 든다", () => {
    const ch = parseChapter(chapter("principle: { body: 전기가 돌아요, image: images/p.svg }\n", run), files, "x", ["images/p.svg"]);
    expect(ch.principle).toEqual({ body: "전기가 돌아요", image: "images/p.svg" });
    const step = allSteps(ch)[0];
    if (step.type !== "run") throw new Error("run 아님");
    expect(step.expected).toBe("불이 켜져요");
    expect(step.codeNotes).toEqual([{ line: 1, note: "시간 기능" }, { line: 3, note: "출력" }]);
    expect(imageRefs(ch)).toEqual(["images/p.svg"]);
    expect(() => parseChapter(chapter("principle: { body: 글, image: images/p.svg }\n", run), files, "x", [])).toThrow(/images\/p\.svg/);
    expect(parseChapter(chapter("principle: { body: 그림 없는 원리 }\n", rc(3)), files, "x").principle).toEqual({ body: "그림 없는 원리" });
  });

  it("코드 설명 줄 번호가 파일 줄 수 밖이면 걸린다 (run·readcheck)", () => {
    expect(() => parseChapter(chapter("", rc(4)), files, "x")).toThrow(/코드 설명 1: 4번 줄/);
    expect(() => parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, codeNotes: [{ line: 9, note: n }] }"), files, "x")).toThrow(/9번 줄/);
  });

  it("모양이 틀린 키", () => {
    expect(() => parseChapter(chapter("principle: { body: \"\" }\n", rc(1)), files, "x")).toThrow();
    expect(() => parseChapter(chapter("principle: { text: 글 }\n", rc(1)), files, "x")).toThrow();
    expect(() => parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, codeNotes: [] }"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, codeNotes: [{ line: 0, note: n }] }"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, codeNotes: [{ line: 1, text: n }] }"), files, "x")).toThrow();
    // expected 는 run 에만, codeNotes 는 run·readcheck 에만
    expect(() => parseChapter(chapter("", "{ id: c, type: readcheck, title: c, code: a.py, questions: [{ kind: number, q: q, answer: 1 }], expected: e }"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("", "{ id: p, type: predict, title: p, code: a.py, blanks: [{ q: q }], codeNotes: [{ line: 1, note: n }] }"), files, "x")).toThrow();
  });

  it("모든 챕터: 코드 설명 줄이 파일 안의 빈 줄 아닌 줄을 가리키고, 원리 그림이 있다", () => {
    for (const dir of chapterDirs()) {
      const { yaml, files: f, images } = readDir(dir);
      const ch = parseChapter(yaml, f, dir, images);
      if (ch.principle?.image) expect(images, `${dir} 원리 그림`).toContain(ch.principle.image);
      for (const s of allSteps(ch)) {
        if ((s.type !== "run" && s.type !== "readcheck") || !s.codeNotes) continue;
        const lines = ch.files[s.code].replace(/\n$/, "").split("\n");
        for (const n of s.codeNotes) expect(lines[n.line - 1]?.trim(), `${dir}/${s.id} ${n.line}번 줄`).toBeTruthy();
      }
    }
  });
});

describe("그림 원문 거르기", () => {
  it("script·on* 처리기·javascript: 주소·XML 선언을 뺀다", () => {
    const dirty = `<?xml version="1.0"?>\n<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><a href="javascript:x()"><rect onclick='y()' width="1"/></a></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).toBe(`<svg viewBox="0 0 10 10"><a><rect width="1"/></a></svg>`);
    expect(unsafeSvgReason(clean)).toBeNull();
    expect(unsafeSvgReason(dirty)).not.toBeNull();
  });

  it("모르는 이름·모양이 틀린 참조는 undefined", () => {
    expect(chapterImage("01-led", "images/없는그림.svg")).toBeUndefined();
    expect(chapterImage("01-led", "../x.svg")).toBeUndefined();
    expect(chapterImage("../x", "images/a.svg")).toBeUndefined();
    expect(chapterImage("01-led", undefined)).toBeUndefined();
  });
});

describe("src/track 은 React·Blockly 에 기대지 않는다", () => {
  const dir = join(process.cwd(), "src/track");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
    it(f, () => {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text).not.toMatch(/from\s+["'](blockly|react)/);
      expect(text).not.toMatch(/from\s+["']@\/(blocks|components|app|codegen|device)/);
    });
  }
});
