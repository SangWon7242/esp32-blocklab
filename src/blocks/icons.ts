import {
  Box, Calculator, Check, Code, createElement, Fan, Flag, Keyboard, Lightbulb, List, Monitor, Pin, Radar, Repeat,
  SquareFunction, ToggleLeft, Volume2, type IconNode,
} from "lucide";
import type { CategoryId } from "./colors";

/** 카테고리 열 아이콘 (lucide 정적 SVG). 툴박스 카테고리 정의의 icon 키가 이 id 다 */
const CATEGORY_ICON_NODES: Record<CategoryId, IconNode> = {
  start: Flag,
  flow: Repeat,
  judge: Check,
  calc: Calculator,
  variable: Box,
  list: List,
  func: SquareFunction,
  pin: Pin,
  led: Lightbulb,
  switch: ToggleLeft,
  sensor: Radar,
  sound: Volume2,
  motor: Fan,
  display: Monitor,
  input: Keyboard,
  code: Code,
};

const cache = new Map<string, string>();

/**
 * 카테고리 아이콘의 SVG 문자열 (24×24, stroke 2, currentColor — 색은 감싼 요소의 color 를 따른다). 모르는 id 면 null.
 * DOM 이 있어야 만들 수 있어 처음 부를 때 만들고 기억해 둔다
 */
export function categoryIconSvg(id: string): string | null {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const node = (CATEGORY_ICON_NODES as Record<string, IconNode | undefined>)[id];
  if (!node) return null;
  const svg = createElement(node, { width: 26, height: 26, "aria-hidden": "true" }).outerHTML;
  cache.set(id, svg);
  return svg;
}
