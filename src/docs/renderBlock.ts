/**
 * 블록 JSON 을 편집기 팔레트와 똑같은 그림(SVG)으로. 화면 밖에 숨긴 Blockly 작업판(zelos·entryTheme) 하나에
 * 블록을 그려 그 SVG 를 복제한다. Blockly CSS 는 `.zelos-renderer.entry-theme .blocklyText` 꼴의 선택자로
 * 주입 div 아래에만 먹으므로, 복제한 <svg> 에 주입 div 와 그 안 svg 의 클래스를 그대로 붙인다.
 */
import * as Blockly from "blockly";
import { blocklyMediaPath } from "@/host/mediaPath";
import { entryTheme, registerBlocks } from "@/blocks";
import type { BlockState } from "./types";

let hidden: { host: HTMLDivElement; ws: Blockly.WorkspaceSvg } | null = null;
/** 지금 그림을 쓰고 있는 곳의 수 (BlockImage). 0 이 되면 잠시 뒤 숨긴 작업판을 치운다 */
let users = 0;
let disposeTimer: ReturnType<typeof setTimeout> | undefined;
/** 카테고리를 옮기는 동안(카드가 내려갔다 올라오는 사이) 작업판을 다시 만들지 않게 기다리는 시간 */
const IDLE_DISPOSE_MS = 5000;

/** 아직 화면에 붙어 있는 작업판인가 (치운 편집기 작업판을 주 작업판으로 되돌리지 않게) */
function isLive(ws: Blockly.WorkspaceSvg): boolean {
  try {
    return ws.rendered && !!ws.getParentSvg()?.isConnected;
  } catch {
    return false;
  }
}

/** 숨긴 작업판 (모듈에 하나). 편집기의 작업판을 Blockly 의 "주 작업판" 으로 그대로 둔다 */
function hiddenWorkspace(): Blockly.WorkspaceSvg {
  if (hidden) return hidden.ws;
  registerBlocks();
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.blockImageRenderer = "";
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(host);
  // inject 는 새 작업판을 주 작업판으로 삼는다: 편집기 팝업에서 그릴 때 편집기의 것을 되돌린다
  const main = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg | null;
  const ws = Blockly.inject(host, {
      // 효과음·sprites.svg 를 자기 주소에서 (기본 static.blockly.com 은 허브 CSP 에 막힘)
      media: blocklyMediaPath(),
    renderer: "zelos",
    theme: entryTheme,
    readOnly: true,
    scrollbars: false,
    zoom: { startScale: 1 },
  });
  if (main && main !== ws && isLive(main)) Blockly.common.setMainWorkspace(main);
  hidden = { host, ws };
  return ws;
}

/** 그림을 쓰기 시작한다 (BlockImage 가 붙을 때). 돌려준 함수로 그만 쓴다 */
export function acquireBlockRenderer(): () => void {
  users++;
  clearTimeout(disposeTimer);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users--;
    if (users > 0) return;
    disposeTimer = setTimeout(() => {
      if (users > 0 || !hidden) return;
      hidden.ws.dispose();
      hidden.host.remove();
      hidden = null;
    }, IDLE_DISPOSE_MS);
  };
}

/**
 * 주입 div·작업판 svg 의 클래스 (예: "zelos-renderer entry-theme" + "blocklySvg").
 * injectionDiv 자체 클래스는 크기·위치를 바꾸므로 빼고, 나머지(렌더러·테마)는 Blockly CSS 선택자가 쓴다
 */
function wrapperClasses(ws: Blockly.WorkspaceSvg): string[] {
  const div = [...ws.getInjectionDiv().classList].filter((c) => c !== "injectionDiv");
  const svg = [...ws.getParentSvg().classList];
  return [...new Set([...svg, ...div])];
}

/** 복제본에서 문서에 겹치면 안 되는 id·포커스·보조기술 속성을 지운다 (그림은 BlockImage 가 role="img" 로 알린다) */
function scrub(el: Element) {
  for (const node of [el, ...el.querySelectorAll("*")]) {
    for (const name of ["id", "tabindex", "role", "data-id"]) node.removeAttribute(name);
    for (const attr of [...node.attributes]) if (attr.name.startsWith("aria-")) node.removeAttribute(attr.name);
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";
const cache = new Map<string, SVGSVGElement>();

/**
 * 블록 JSON(툴박스 항목 그대로, 또는 학생 블록의 save 결과)을 그린 독립 <svg>. scale 은 그림 크기 배율
 * (작업판 1배 기준; 편집기는 0.75로 시작한다). 같은 JSON·배율은 한 번만 그리고 복제해 준다 (글꼴을 다 읽은 뒤에만 기억한다)
 */
export function renderBlockSvg(state: BlockState, scale = 0.8): SVGSVGElement {
  const key = `${scale}|${JSON.stringify(state)}`;
  const hit = cache.get(key);
  if (hit) return hit.cloneNode(true) as SVGSVGElement;

  const ws = hiddenWorkspace();
  // 버리는 블록이라 이벤트(실행 취소 기록 등)를 남기지 않는다
  Blockly.Events.disable();
  let block: Blockly.BlockSvg | null = null;
  try {
    // 학생 블록의 JSON 에는 좌표·id 가 있을 수 있다: 숨긴 작업판의 (0,0) 에 새 id 로 놓는다
    const { x: _x, y: _y, id: _id, ...clean } = state;
    block = Blockly.serialization.blocks.append(clean, ws) as Blockly.BlockSvg;
    block.initSvg();
    block.render();
    // 블록 크기 (getHeightWidth) 와 실제로 그려진 범위 (getBBox: zelos 명령 블록 아래로 튀어나온 홈까지) 를 합친다
    const { height, width } = block.getHeightWidth();
    const box = block.getSvgRoot().getBBox();
    const pad = 2;
    const x0 = Math.min(0, box.x) - pad;
    const y0 = Math.min(0, box.y) - pad;
    const w = Math.max(width, box.x + box.width) - x0 + pad;
    const h = Math.max(height, box.y + box.height) - y0 + pad;

    // 블록 자리(transform)는 숨긴 작업판의 것이므로 지우고 viewBox 로 맞춘다
    const root = block.getSvgRoot().cloneNode(true) as SVGGElement;
    root.removeAttribute("transform");
    scrub(root);

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("viewBox", `${x0} ${y0} ${w} ${h}`);
    svg.setAttribute("width", String(Math.round(w * scale)));
    svg.setAttribute("height", String(Math.round(h * scale)));
    svg.setAttribute("class", wrapperClasses(ws).join(" "));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    // .blocklySvg 의 흰 바탕·absolute 자리를 지운다 (카드 안에 글처럼 놓이게)
    svg.style.cssText = "position:static;display:block;background:transparent;overflow:visible;max-width:100%;height:auto;";
    svg.appendChild(root);

    if (document.fonts?.status === "loaded") cache.set(key, svg.cloneNode(true) as SVGSVGElement);
    return svg;
  } finally {
    block?.dispose(false);
    Blockly.Events.enable();
  }
}
