import { describe, expect, it } from "vitest";
import {
  BOARD_IDS, BOARD_LABELS, DEFAULT_BOARD, boardImageRef, chapterForBoard, chapterHasBoardChoice, devkitImageRef, figureCaption, isBoardId,
  materialsForBoard,
} from "./board";
import { parseChapter } from "./content";
import { allSteps } from "./gating";
import { ChapterSchema, FigureSchema } from "./schema";

/*
 * 수업 보드 (plus = ESP32 Plus 확장 보드 · devkit = 기본 보드 DevKit 30핀): 스키마(captionDevkit·materials[].board),
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
  it("보드는 plus(기본)·devkit 둘", () => {
    expect(BOARD_IDS).toEqual(["plus", "devkit"]);
    expect(DEFAULT_BOARD).toBe("plus");
    expect(BOARD_LABELS).toEqual({ plus: "ESP32 Plus 확장 보드", devkit: "기본 보드 (DevKit 30핀)" });
    expect(isBoardId("devkit")).toBe(true);
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
});
