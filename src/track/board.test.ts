import { describe, expect, it } from "vitest";
import {
  BOARD_IDS, BOARD_LABELS, DEFAULT_BOARD, JUMPER_5V_NOTICE, boardImageRef, boardVariantRef, chapterForBoard, chapterHasBoardChoice, devkitImageRef,
  figureCaption, imageBoard, isBoardId, jumperNotice, materialsForBoard, svgJumper,
} from "./board";
import { parseChapter } from "./content";
import { allSteps } from "./gating";
import { ChapterSchema, FigureSchema } from "./schema";

/*
 * 수업 보드 (plus = ESP32 Plus 확장 보드 · devkit = 기본 보드 DevKit 38핀): 스키마(captionDevkit·materials[].board),
 * 그림 이름(.devkit.svg) 고르기와 없을 때 기본 그림, 설명·준비물 고르기, 슬라이드용 chapterForBoard.
 */

const files = { "a.py": "print(1)\n" };
const chapter = (head: string, step = "{ id: r, type: run, title: r, code: a.py }") =>
  `id: x\norder: 1\ntitle: x\ntrack: sensor\nlabel: S1\n${head}parts:\n  - id: p\n    title: p\n    steps:\n      - ${step}\n`;

const yaml = chapter(
  [
    "cover: images/cover.svg",
    "materials:",
    "  - { name: ESP32 Plus 보드, board: plus }",
    "  - { name: ESP32 DevKit 보드, board: devkit, note: 브레드보드에 꽂기 }",
    "  - { name: 초음파 센서, image: images/sonar.svg }",
    "wiring: { image: images/wiring.svg, caption: 확장 보드 io13, captionDevkit: 기본 보드 D13 }",
    "",
  ].join("\n"),
  "{ id: r, type: run, title: r, code: a.py, scene: { image: images/scene.svg, caption: 장면, captionDevkit: 기본 장면 } }",
);

describe("이름·라벨", () => {
  it("보드는 plus(기본)·devkit·expansion 셋", () => {
    expect(BOARD_IDS).toEqual(["plus", "devkit", "expansion"]);
    expect(DEFAULT_BOARD).toBe("plus");
    expect(BOARD_LABELS).toEqual({ plus: "ESP32 Plus 확장 보드", devkit: "기본 보드 (DevKit 38핀)", expansion: "확장 보드 (DevKit 38핀)" });
    expect(isBoardId("devkit")).toBe(true);
    expect(isBoardId("expansion")).toBe(true);
    for (const v of ["uno", "", null, undefined, 1, "PLUS"]) expect(isBoardId(v)).toBe(false);
  });
});

describe("스키마", () => {
  it("captionDevkit 과 준비물 board 를 받아들인다", () => {
    const ch = parseChapter(yaml, files, "x");
    expect(ch.wiring).toEqual({ image: "images/wiring.svg", caption: "확장 보드 io13", captionDevkit: "기본 보드 D13" });
    expect(ch.materials?.map((m) => m.board)).toEqual(["plus", "devkit", undefined]);
    expect(allSteps(ch)[0].scene?.captionDevkit).toBe("기본 장면");
    expect(FigureSchema.safeParse({ image: "images/a.svg", captionDevkit: "기본만" }).success).toBe(true);
  });
  it("모르는 보드, 빈 captionDevkit, 오타 키는 걸린다", () => {
    expect(() => parseChapter(chapter("materials:\n  - { name: LED, board: uno }\n"), files, "x")).toThrow(/materials/);
    expect(() => parseChapter(chapter('wiring: { image: images/w.svg, captionDevkit: "" }\n'), files, "x")).toThrow(/captionDevkit/);
    expect(() => parseChapter(chapter("wiring: { image: images/w.svg, caption_devkit: 오타 }\n"), files, "x")).toThrow();
    expect(() => parseChapter(chapter("materials:\n  - { name: LED, boards: [plus] }\n"), files, "x")).toThrow();
    // 보드는 챕터 키가 아니다 (학생이 고른다)
    const base = ChapterSchema.safeParse({ id: "x", order: 1, title: "x", track: "sensor", label: "S1", board: "devkit", parts: [] });
    expect(base.success).toBe(false);
  });
});

describe("그림·설명·준비물 고르기", () => {
  const has = (refs: string[]) => (ref: string) => refs.includes(ref);

  it("devkitImageRef: 같은 이름에 .devkit.svg", () => {
    expect(devkitImageRef("images/wiring-door.svg")).toBe("images/wiring-door.devkit.svg");
    expect(devkitImageRef("images/wiring-door.devkit.svg")).toBe("images/wiring-door.devkit.svg");
  });

  it("boardImageRef: devkit 이고 그림이 있을 때만 바꾸고, 없으면 기본 그림", () => {
    const exists = has(["images/w.svg", "images/w.devkit.svg"]);
    expect(boardImageRef("images/w.svg", "devkit", exists)).toBe("images/w.devkit.svg");
    expect(boardImageRef("images/w.svg", "plus", exists)).toBe("images/w.svg");
    expect(boardImageRef("images/other.svg", "devkit", exists)).toBe("images/other.svg");
    expect(boardImageRef(undefined, "devkit", exists)).toBeUndefined();
  });

  it("figureCaption: devkit 은 captionDevkit, 없으면 caption", () => {
    expect(figureCaption({ caption: "a", captionDevkit: "b" }, "devkit")).toBe("b");
    expect(figureCaption({ caption: "a", captionDevkit: "b" }, "plus")).toBe("a");
    expect(figureCaption({ caption: "a" }, "devkit")).toBe("a");
    expect(figureCaption({ captionDevkit: "b" }, "plus")).toBeUndefined();
    expect(figureCaption(undefined, "devkit")).toBeUndefined();
  });

  it("materialsForBoard: board 가 없으면 두 보드 모두, 있으면 그 보드만", () => {
    const ch = parseChapter(yaml, files, "x");
    expect(materialsForBoard(ch.materials, "plus").map((m) => m.name)).toEqual(["ESP32 Plus 보드", "초음파 센서"]);
    expect(materialsForBoard(ch.materials, "devkit").map((m) => m.name)).toEqual(["ESP32 DevKit 보드", "초음파 센서"]);
    expect(materialsForBoard(undefined, "devkit")).toEqual([]);
  });

  it("chapterHasBoardChoice: 배선도·.devkit.svg·보드별 준비물·captionDevkit 중 하나라도", () => {
    const plain = parseChapter(chapter(""), files, "x");
    expect(chapterHasBoardChoice(plain, ["images/cover.svg"])).toBe(false);
    expect(chapterHasBoardChoice(plain, ["images/scene.devkit.svg"])).toBe(true);
    expect(chapterHasBoardChoice(parseChapter(chapter("wiring: { image: images/w.svg }\n"), files, "x"), [])).toBe(true);
    expect(chapterHasBoardChoice(parseChapter(chapter("materials:\n  - { name: LED, board: devkit }\n"), files, "x"), [])).toBe(true);
    expect(chapterHasBoardChoice(parseChapter(chapter("", "{ id: r, type: run, title: r, code: a.py, scene: { image: images/s.svg, captionDevkit: d } }"), files, "x"), [])).toBe(true);
  });

  it("chapterForBoard (슬라이드): devkit 그림·설명·준비물로 바꾸고 원본은 그대로", () => {
    const ch = parseChapter(yaml, files, "x");
    const exists = has(["images/wiring.devkit.svg", "images/sonar.devkit.svg"]);
    const devkit = chapterForBoard(ch, "devkit", exists);
    expect(devkit.cover).toBe("images/cover.svg");
    expect(devkit.wiring).toEqual({ image: "images/wiring.devkit.svg", caption: "기본 보드 D13" });
    expect(devkit.materials).toEqual([
      { name: "ESP32 DevKit 보드", note: "브레드보드에 꽂기" },
      { name: "초음파 센서", image: "images/sonar.devkit.svg" },
    ]);
    expect(allSteps(devkit)[0].scene).toEqual({ image: "images/scene.svg", caption: "기본 장면" });

    const plus = chapterForBoard(ch, "plus", exists);
    expect(plus.wiring).toEqual({ image: "images/wiring.svg", caption: "확장 보드 io13" });
    expect(plus.materials?.map((m) => m.name)).toEqual(["ESP32 Plus 보드", "초음파 센서"]);
    // 원본은 바뀌지 않는다
    expect(ch.wiring?.captionDevkit).toBe("기본 보드 D13");
    expect(ch.materials).toHaveLength(3);
  });

  it("확장 보드: 그림은 .expansion.svg → .devkit.svg → 기본, 설명은 captionExpansion → captionDevkit → caption", () => {
    expect(boardVariantRef("images/w.svg", "expansion")).toBe("images/w.expansion.svg");
    expect(boardVariantRef("images/w.devkit.svg", "expansion")).toBe("images/w.devkit.svg");
    expect(imageBoard("images/w.expansion.svg")).toBe("expansion");
    expect(imageBoard("images/w.svg")).toBeUndefined();
    const both = has(["images/w.svg", "images/w.devkit.svg", "images/w.expansion.svg"]);
    expect(boardImageRef("images/w.svg", "expansion", both)).toBe("images/w.expansion.svg");
    expect(boardImageRef("images/w.svg", "devkit", both)).toBe("images/w.devkit.svg");
    expect(boardImageRef("images/w.svg", "expansion", has(["images/w.devkit.svg"]))).toBe("images/w.devkit.svg");
    expect(boardImageRef("images/w.svg", "expansion", has([]))).toBe("images/w.svg");
    expect(figureCaption({ caption: "a", captionDevkit: "b", captionExpansion: "c" }, "expansion")).toBe("c");
    expect(figureCaption({ caption: "a", captionDevkit: "b", captionExpansion: "c" }, "devkit")).toBe("b");
    expect(figureCaption({ caption: "a", captionDevkit: "b" }, "expansion")).toBe("b");
    expect(figureCaption({ caption: "a" }, "expansion")).toBe("a");
  });

  it("확장 보드 준비물: board: expansion 이 있으면 그것, 하나도 없으면 devkit 것으로 물러난다", () => {
    const ch = parseChapter(yaml, files, "x");
    expect(materialsForBoard(ch.materials, "expansion").map((m) => m.name)).toEqual(["ESP32 DevKit 보드", "초음파 센서"]);
    const own = [{ name: "a" }, { name: "b", board: "devkit" as const }, { name: "c", board: "expansion" as const }];
    expect(materialsForBoard(own, "expansion").map((m) => m.name)).toEqual(["a", "c"]);
    expect(materialsForBoard(own, "devkit").map((m) => m.name)).toEqual(["a", "b"]);
    expect(materialsForBoard(own, "plus").map((m) => m.name)).toEqual(["a"]);
  });

  it("점퍼 안내: 확장 보드 그림이 5V 일 때만", () => {
    const svgs: Record<string, string> = {
      "images/w.expansion.svg": '<svg><polygon data-expansion-jumper="5V"/></svg>',
      "images/l.expansion.svg": '<svg><polygon data-expansion-jumper="3V3"/></svg>',
      "images/w.devkit.svg": '<svg data-expansion-jumper="5V"></svg>',
    };
    const of = (r: string) => svgs[r];
    expect(svgJumper(svgs["images/w.expansion.svg"])).toBe("5V");
    expect(svgJumper("<svg/>")).toBeUndefined();
    expect(jumperNotice("images/w.expansion.svg", of)).toBe(JUMPER_5V_NOTICE);
    expect(JUMPER_5V_NOTICE).toBe("이번 수업은 점퍼를 5V 쪽으로 옮겨요 (끝나면 3.3V 로)");
    expect(jumperNotice("images/l.expansion.svg", of)).toBeUndefined();
    expect(jumperNotice("images/w.devkit.svg", of)).toBeUndefined();
    expect(jumperNotice(undefined, of)).toBeUndefined();
  });

  it("chapterForBoard (슬라이드, expansion): 확장 보드 그림·설명, svgOf 를 주면 점퍼 안내를 설명 끝에", () => {
    const ch = parseChapter(yaml.replace("captionDevkit: 기본 보드 D13 }", "captionDevkit: 기본 보드 D13, captionExpansion: 확장 P13 }"), files, "x");
    const exists = has(["images/wiring.expansion.svg", "images/scene.devkit.svg"]);
    const svgOf = (r: string) => (r === "images/wiring.expansion.svg" ? '<polygon data-expansion-jumper="5V"/>' : undefined);
    const x = chapterForBoard(ch, "expansion", exists, { svgOf });
    expect(x.wiring).toEqual({ image: "images/wiring.expansion.svg", caption: `확장 P13 (${JUMPER_5V_NOTICE})` });
    expect(allSteps(x)[0].scene).toEqual({ image: "images/scene.devkit.svg", caption: "기본 장면" });
    expect(chapterForBoard(ch, "expansion", exists).wiring?.caption).toBe("확장 P13");
    expect(chapterHasBoardChoice(parseChapter(chapter(""), files, "x"), ["images/a.expansion.svg"])).toBe(true);
  });
});
