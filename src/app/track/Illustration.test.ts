import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Chapter } from "@/track/schema";

/*
 * 기본 보드 그림 고르기: devkit 이고 같은 이름의 .devkit.svg 가 있으면 그것, 없으면 기본 그림. boardVariant={false} 는 늘 기본.
 * 준비물 칩은 그 보드의 부품만. 그림은 가짜 챕터 폴더(vi.mock)로 — 실제 콘텐츠에 기본 보드 그림이 있든 없든 같은 결과.
 */

const FAKE: Record<string, string> = {
  "/content/chapters/zz-board/images/wiring.svg": '<svg viewBox="0 0 1 1"><title>ESP32 Plus 배선</title></svg>',
  "/content/chapters/zz-board/images/wiring.devkit.svg": '<svg viewBox="0 0 1 1"><title>기본 보드 배선</title></svg>',
  "/content/chapters/zz-board/images/scene.svg": '<svg viewBox="0 0 1 1"><title>장면</title></svg>',
};

vi.mock("@/track/images", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/track/images")>();
  return {
    ...real,
    chapterImage: (chapterId: string, ref: string | null | undefined) =>
      chapterId === "zz-board" && ref ? FAKE[`/content/chapters/${chapterId}/${ref}`] : real.chapterImage(chapterId, ref),
  };
});

const { Illustration, resolveBoardImage } = await import("./Illustration");
const { MaterialChips } = await import("./Materials");

const title = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1];

describe("Illustration 보드 그림", () => {
  it("resolveBoardImage: devkit 이고 그림이 있으면 .devkit.svg, 없으면 원래 그림", () => {
    expect(resolveBoardImage("zz-board", "images/wiring.svg", "devkit")).toBe("images/wiring.devkit.svg");
    expect(resolveBoardImage("zz-board", "images/wiring.svg", "plus")).toBe("images/wiring.svg");
    expect(resolveBoardImage("zz-board", "images/scene.svg", "devkit")).toBe("images/scene.svg");
    expect(resolveBoardImage("zz-board", undefined, "devkit")).toBeUndefined();
  });

  it("devkit 이면 기본 보드 그림을 그리고 data-shown-image 에 적는다", () => {
    const html = renderToStaticMarkup(createElement(Illustration, { chapterId: "zz-board", image: "images/wiring.svg", board: "devkit", zoomable: true }));
    expect(title(html)).toBe("기본 보드 배선");
    expect(html).toContain('data-image="images/wiring.svg"');
    expect(html).toContain('data-shown-image="images/wiring.devkit.svg"');
  });

  it("기본값(서버 렌더 = plus)과 plus 는 기본 그림", () => {
    for (const board of [undefined, "plus" as const]) {
      const html = renderToStaticMarkup(createElement(Illustration, { chapterId: "zz-board", image: "images/wiring.svg", board }));
      expect(title(html)).toBe("ESP32 Plus 배선");
      expect(html).not.toContain("data-shown-image");
    }
  });

  it("기본 보드 그림이 없으면 기본 그림으로, boardVariant={false} 면 늘 기본 그림", () => {
    const missing = renderToStaticMarkup(createElement(Illustration, { chapterId: "zz-board", image: "images/scene.svg", board: "devkit" }));
    expect(title(missing)).toBe("장면");
    const optOut = renderToStaticMarkup(createElement(Illustration, { chapterId: "zz-board", image: "images/wiring.svg", board: "devkit", boardVariant: false }));
    expect(title(optOut)).toBe("ESP32 Plus 배선");
  });
});

describe("MaterialChips 보드 거르기", () => {
  const materials: NonNullable<Chapter["materials"]> = [
    { name: "Plus 확장 보드", board: "plus" },
    { name: "DevKit 30핀 보드", board: "devkit" },
    { name: "서보 모터" },
  ];
  it("그 보드의 부품과 공통 부품만", () => {
    const devkit = renderToStaticMarkup(createElement(MaterialChips, { chapterId: "zz-board", materials, board: "devkit" }));
    expect(devkit).toContain("DevKit 30핀 보드");
    expect(devkit).toContain("서보 모터");
    expect(devkit).not.toContain("Plus 확장 보드");
    // 고른 보드 기본값(서버 렌더) = plus
    const plus = renderToStaticMarkup(createElement(MaterialChips, { chapterId: "zz-board", materials }));
    expect(plus).toContain("Plus 확장 보드");
    expect(plus).not.toContain("DevKit 30핀 보드");
  });
  it("남는 부품이 없으면 그리지 않는다", () => {
    expect(renderToStaticMarkup(createElement(MaterialChips, { chapterId: "zz-board", materials: [{ name: "a", board: "plus" }], board: "devkit" }))).toBe("");
  });
});
