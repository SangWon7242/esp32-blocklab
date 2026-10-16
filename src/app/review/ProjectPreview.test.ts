import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderWithHost } from "@/host/testHost";
import { topBlocks, topBlockStates } from "./blockStates";
import { BLOCKS_UNAVAILABLE, CodeView, ProjectPreview } from "./ProjectPreview";

/*
 * 작품 미리 보기: 코드는 줄 번호와 함께 글로, 블록 그림 자리는 blocksJson 이 있을 때만 (그림 자체는 화면에서 useEffect 로 그린다).
 */

const code = "from machine import Pin\n\nled = Pin(26, Pin.OUT)\nled.value(1)\n";

const workspace = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "start_program",
        id: "s",
        x: 40,
        y: 40,
        inputs: { BODY: { block: { type: "variables_set", id: "v", fields: { VAR: { id: "led-id" } }, inputs: { VALUE: { block: { type: "math_number", fields: { NUM: 1 } } } } } } },
      },
      { type: "procedures_defnoreturn", id: "f", fields: { NAME: "blink" } },
    ],
  },
  variables: [{ id: "led-id", name: "led", type: "" }],
};

describe("CodeView", () => {
  it("줄마다 번호를 붙이고 끝 줄바꿈은 빈 줄로 세지 않는다", () => {
    const html = renderToStaticMarkup(createElement(CodeView, { code, name: "led.py" }));
    expect(html).toContain("led.py");
    expect(html).toContain("from machine import Pin");
    expect(html).toContain("led.value(1)");
    expect(html.match(/<span class="block whitespace-pre">/g)).toHaveLength(4);
  });
});

describe("ProjectPreview", () => {
  it("코드만: 블록 그림 자리가 없다", () => {
    const html = renderToStaticMarkup(createElement(ProjectPreview, { code }));
    expect(html).toContain('data-testid="project-preview"');
    expect(html).toContain('data-testid="code-view"');
    expect(html).not.toContain("project-blocks");
    expect(html).not.toContain(BLOCKS_UNAVAILABLE);
  });

  it("blocksJson 이 있으면 블록 그림 자리(비어 있음 — 화면에서 그린다)", () => {
    const html = renderWithHost(createElement(ProjectPreview, { code, blocksJson: workspace, name: "저장한 프로그램" }));
    expect(html).toContain('data-testid="project-blocks"');
    expect(html).toContain("블록 그림");
    expect(html).toContain("저장한 프로그램");
    expect(html).not.toContain("<svg");
  });

  it("빈 작업판·이상한 값은 코드만", () => {
    expect(renderToStaticMarkup(createElement(ProjectPreview, { code, blocksJson: { blocks: { blocks: [] } } }))).not.toContain("project-blocks");
    expect(renderToStaticMarkup(createElement(ProjectPreview, { code, blocksJson: "쓰레기" }))).not.toContain("project-blocks");
  });
});

describe("topBlockStates", () => {
  it("작업판·배열·블록 하나 어느 꼴이든 맨 위 블록 목록으로", () => {
    expect(topBlocks(workspace).map((b) => b.type)).toEqual(["start_program", "procedures_defnoreturn"]);
    expect(topBlocks([{ type: "a" }, "x", { noType: 1 }]).map((b) => b.type)).toEqual(["a"]);
    expect(topBlocks({ type: "one" }).map((b) => b.type)).toEqual(["one"]);
    expect(topBlocks(null)).toEqual([]);
    expect(topBlocks({ blocks: {} })).toEqual([]);
  });

  it("변수 칸 {id} 에 작업판 변수 표의 이름을 채우고 원본은 건드리지 않는다", () => {
    const states = topBlockStates(workspace);
    const set = states[0].inputs!.BODY.block!;
    expect(set.fields!.VAR).toEqual({ id: "led-id", name: "led", type: "" });
    expect(set.inputs!.VALUE.block!.fields!.NUM).toBe(1);
    expect(workspace.blocks.blocks[0].inputs!.BODY.block.fields.VAR).toEqual({ id: "led-id" });
    expect(states[1].fields!.NAME).toBe("blink");
  });

  it("이름을 모르는 변수 id 는 그대로 둔다", () => {
    const states = topBlockStates({ blocks: { blocks: [{ type: "variables_get", fields: { VAR: { id: "없음" } } }] } });
    expect(states[0].fields!.VAR).toEqual({ id: "없음" });
  });
});
