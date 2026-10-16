import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { stripAmdSniff } from "../../scripts/vite-blockly";
import { BlocklabProvider } from "./HostContext";
import { DEFAULT_BLOCKLY_MEDIA_PATH, blocklyMediaPath, setBlocklyMediaPath } from "./mediaPath";
import { fakeHost } from "./testHost";

describe("Blockly media 경로 (lib-v1.0.1)", () => {
  afterEach(() => setBlocklyMediaPath(undefined));

  it("기본은 <BASE_URL>blocklab/media/ (시험·라이브러리에서는 /blocklab/media/)", () => {
    expect(DEFAULT_BLOCKLY_MEDIA_PATH).toBe("/blocklab/media/");
    expect(blocklyMediaPath()).toBe("/blocklab/media/");
  });

  it("바꾼 경로 끝에 / 를 붙이고, 빈 값은 기본값으로 되돌린다", () => {
    setBlocklyMediaPath("/vendor/media");
    expect(blocklyMediaPath()).toBe("/vendor/media/");
    setBlocklyMediaPath("https://cdn.example/m/");
    expect(blocklyMediaPath()).toBe("https://cdn.example/m/");
    setBlocklyMediaPath("");
    expect(blocklyMediaPath()).toBe(DEFAULT_BLOCKLY_MEDIA_PATH);
  });

  it("Provider 의 blocklyMediaPath 가 그리는 동안 정해진다. 안 주면 그대로 둔다", () => {
    renderToStaticMarkup(createElement(BlocklabProvider, { ...fakeHost(), blocklyMediaPath: "/hub/blockly", children: null }));
    expect(blocklyMediaPath()).toBe("/hub/blockly/");
    renderToStaticMarkup(createElement(BlocklabProvider, { ...fakeHost(), children: null }));
    expect(blocklyMediaPath()).toBe("/hub/blockly/");
  });
});

describe("stripAmdSniff (Blockly UMD 의 AMD 갈래 끄기)", () => {
  it("원본·압축 꼴의 AMD 조건을 false 로 바꾸고 다른 갈래는 둔다", () => {
    const umd = `if (typeof define === 'function' && define.amd) { define([], f); } else if (typeof exports === 'object') { module.exports = f(); }`;
    const min = `else if("function"==typeof define&&define.amd)define(["blockly/core"],f);`;
    const a = stripAmdSniff(umd);
    expect(a.count).toBe(1);
    expect(a.code).toContain("if (false) {");
    expect(a.code).toContain("typeof exports === 'object'");
    const b = stripAmdSniff(min);
    expect(b.count).toBe(1);
    expect(b.code).not.toContain("define.amd");
    expect(stripAmdSniff("const x = 1;").count).toBe(0);
  });
});
