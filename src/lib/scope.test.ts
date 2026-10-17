import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { blocklabScope, scopeSelector } from "../../scripts/postcss-blocklab-scope.ts";

/*
 * CSS 범위 플러그인: 라이브러리 CSS 는 `.blocklab` 아래에서만 작동해야 한다.
 * 루트(html·body·:root)는 .blocklab 자체로, 그 글꼴은 빼고(호스트 상속), Blockly 주입 요소는 전역에 남긴다.
 */

const run = (css: string, file?: string) =>
  postcss([blocklabScope({ exclude: (f) => !!f && /demo\.css$/.test(f) })]).process(css, { from: file ?? "index.css" }).css.replace(/\s+/g, " ");

describe("scopeSelector", () => {
  it("보통 선택자는 .blocklab 아래로", () => {
    expect(scopeSelector(".p-4")).toEqual([".blocklab .p-4"]);
    expect(scopeSelector("*")).toEqual([".blocklab *"]);
    expect(scopeSelector("::backdrop")).toEqual([".blocklab ::backdrop"]);
    expect(scopeSelector(".dark\\:bg-x:is(.dark *):hover")).toEqual([".blocklab .dark\\:bg-x:is(.dark *):hover"]);
    expect(scopeSelector("[data-x=\"a b\"] > span")).toEqual([".blocklab [data-x=\"a b\"] > span"]);
  });
  it("루트 선택자는 .blocklab 자체로 (뒤는 그대로)", () => {
    expect(scopeSelector(":root")).toEqual([".blocklab"]);
    expect(scopeSelector("html")).toEqual([".blocklab"]);
    expect(scopeSelector(":host")).toEqual([".blocklab"]);
    expect(scopeSelector("body > #root")).toEqual([".blocklab > #root"]);
    expect(scopeSelector("html.dark")).toEqual([".blocklab html.dark"]);
  });
  it(".dark 토큰은 조상·자기 자신 둘 다", () => {
    expect(scopeSelector(".dark")).toEqual([".dark .blocklab", ".blocklab.dark"]);
  });
  it("Blockly 주입 요소와 이미 범위가 있는 것은 그대로", () => {
    expect(scopeSelector(".injectionDiv .blocklyToolbox")).toEqual([".injectionDiv .blocklyToolbox"]);
    expect(scopeSelector(".lint-error > .blocklyPath")).toEqual([".lint-error > .blocklyPath"]);
    expect(scopeSelector(".blocklab .x")).toEqual([".blocklab .x"]);
  });
});

describe("blocklabScope 플러그인", () => {
  it("규칙·미디어 안 규칙을 옮기고 @keyframes 안은 건드리지 않는다", () => {
    const out = run("@layer base{*,:after{margin:0}} @media (hover:hover){.a:hover{color:red}} @keyframes spin{from{opacity:0}to{opacity:1}}");
    expect(out).toContain("@layer base{.blocklab *,.blocklab :after{margin:0}}");
    expect(out).toContain("@media (hover:hover){.blocklab .a:hover{color:red}}");
    expect(out).toContain("@keyframes spin{from{opacity:0}to{opacity:1}}");
  });
  it("루트의 토큰은 .blocklab 로 합치고 글꼴 선언은 뺀다", () => {
    const out = run(":root,:host{--a:1;--b:2} html,:host{line-height:1.5;font-family:X;font-feature-settings:normal} html{font-family:Y} body{color:var(--fg)}");
    expect(out).toContain(".blocklab{--a:1;--b:2}");
    expect(out).toContain(".blocklab{line-height:1.5}");
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("html");
    expect(out).toContain(".blocklab{color:var(--fg)}");
  });
  it("exclude 한 파일은 그대로 둔다", () => {
    expect(run("html{font-family:X} body{margin:0}", "demo.css")).toBe("html{font-family:X} body{margin:0}");
  });
});
