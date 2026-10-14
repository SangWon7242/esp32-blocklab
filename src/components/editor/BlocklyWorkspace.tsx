import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as Blockly from "blockly";
import { entryTheme, registerBlocks, registerEntryToolbox, registerVariableFlyout, toolbox } from "@/blocks";
import { emptyLineMap, generateCode, generateCodeWithMap, type LineMap, type WorkspaceJson } from "@/codegen";
import type { Issue } from "@/lint";
import { cn } from "@/lib/utils";
import { registerBlockDocMenu, type BlockDocRequest } from "./blockDocMenu";
import { diffLintMarks, type LintMark, type MarkedBlock } from "./lintMarks";
import { createNamePrompt } from "./namePrompt";

export type LoadOptions = {
  /** 지금 보던 자리를 그대로 둔다 (코드 ↔ 블록 전환·코드 고칠 때). 아니면 프로그램 왼쪽 위로 맞춘다 */
  keepScroll?: boolean;
};

export type BlocklyHandle = {
  load(json: WorkspaceJson, opts?: LoadOptions): void;
  getJson(): WorkspaceJson;
  getCode(): string;
  /** 지금 작업판의 코드와 코드 지도 (블록 id ↔ 줄 번호, id 는 살아 있는 작업판의 것) */
  getCodeWithMap(): { code: string; map: LineMap };
  /**
   * 검사 결과를 블록에 단다: 블록마다 경고 아이콘(말풍선에 "<한글> — 코드 N줄"), 오류는 빨간 테두리(lint-error),
   * 주의는 노란 테두리(lint-warning). 지난번과 달라진 블록만 고치고 사라진 문제는 지운다. 정보 수준은 달지 않는다.
   */
  setIssues(issues: Issue[]): void;
  /**
   * 블록을 선택하고 화면 가운데로. 그림자 블록이면 담은 블록. 실제로 고른 블록 id (없으면 null).
   * `focus: false` 면 가운데로 옮기기만 하고 선택·키보드 포커스는 건드리지 않는다 (코드 모드: 치던 글자가 작업판으로 가지 않게)
   */
  selectBlock(id: string, opts?: { focus?: boolean }): string | null;
  /**
   * 지금 살펴보는 블록에 파란 테두리(lint-focus)를 단다 (그림자면 담은 블록, null 이면 뗀다).
   * 보이기만 할 뿐 Blockly 선택·키보드 포커스와 상관없다. 같은 id 로 다시 만들어진 블록에도 다시 달도록 불릴 때마다 맞춘다
   */
  setFocusBlock(id: string | null): void;
};

type Props = {
  /** 사용자가 블록을 바꿀 때마다 (프로그램이 load 한 경우는 제외) */
  onChange: (json: WorkspaceJson, code: string, map: LineMap) => void;
  /** 블록을 선택하거나(그 id) 선택을 풀 때(null) */
  onSelect?: (blockId: string | null) => void;
  /** 블록의 경고 말풍선을 열 때 */
  onWarningOpen?: (blockId: string) => void;
  /** 블록 우클릭 메뉴 "이 블록 설명 보기" (작업판·팔레트 블록. 그림자 블록이면 담은 블록) */
  onDocRequest?: (req: BlockDocRequest) => void;
  className?: string;
};

/** 검사가 단 경고 아이콘의 id (다른 경고와 섞이지 않게) */
const LINT_WARNING = "lint";
const LINT_FOCUS = "lint-focus";

function setLintClass(block: Blockly.BlockSvg, level: LintMark["level"] | null) {
  const root = block.getSvgRoot();
  root.classList.toggle("lint-error", level === "error");
  root.classList.toggle("lint-warning", level === "warning");
}

/** 그림자 블록은 아이콘·선택을 담은 블록이 받는다 */
function realBlock(ws: Blockly.WorkspaceSvg, id: string): Blockly.BlockSvg | null {
  let block: Blockly.BlockSvg | null = ws.getBlockById(id);
  while (block?.isShadow()) block = block.getParent();
  return block;
}

const REVEAL_MARGIN = 24;

/**
 * 프로그램 왼쪽 위가 여백을 두고 보이도록 스크롤한다. 작업판 크기가 0이면 Blockly 가 스크롤을
 * 0 폭 기준으로 잘라 두므로(첫 화면에서 시작 블록이 왼쪽에 잘리던 원인) 하지 않고 false 를 돌려준다.
 */
function revealProgram(ws: Blockly.WorkspaceSvg): boolean {
  const host = ws.getInjectionDiv();
  if (!host || host.clientWidth === 0 || host.clientHeight === 0) return false;
  Blockly.svgResize(ws);
  const box = ws.getBlocksBoundingBox();
  ws.scroll(REVEAL_MARGIN - box.left * ws.scale, REVEAL_MARGIN - box.top * ws.scale);
  return true;
}

export const BlocklyWorkspace = forwardRef<BlocklyHandle, Props>(function BlocklyWorkspace({ onChange, onSelect, onWarningOpen, onDocRequest, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loadingRef = useRef(false);
  /** load 했지만 작업판 크기가 0이라 아직 프로그램을 화면에 맞추지 못했다 */
  const needsRevealRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onWarningOpenRef = useRef(onWarningOpen);
  onWarningOpenRef.current = onWarningOpen;
  const onDocRequestRef = useRef(onDocRequest);
  onDocRequestRef.current = onDocRequest;
  /** 지금 검사 경고를 단 블록들 (블록 id → 블록·말풍선 글·수준) */
  const lintMarksRef = useRef(new Map<string, MarkedBlock<Blockly.BlockSvg>>());
  /** 지금 파란 테두리를 단 블록 */
  const focusBlockRef = useRef<Blockly.BlockSvg | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    registerBlocks();
    // 엔트리식 카테고리 열 (아이콘 위·이름 아래, 고르면 카테고리 색으로 채운 타일). inject 전에 등록해야 툴박스가 쓴다
    registerEntryToolbox();
    // 메뉴 항목은 전역에 한 번만 등록되고, 콜백은 지금 마운트된 작업판의 것으로 바뀐다
    registerBlockDocMenu((req) => onDocRequestRef.current?.(req));
    const ws = Blockly.inject(host, {
      toolbox,
      theme: entryTheme,
      renderer: "zelos",
      trashcan: true,
      grid: { spacing: 24, length: 2, colour: "#e5e7eb", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.75, minScale: 0.4, maxScale: 1.5 },
      move: { scrollbars: true, drag: true, wheel: false },
      // 프로그램 시작은 하나뿐 (둘이면 어느 쪽이 실행되는지 알 수 없다)
      maxInstances: { start_program: 1 },
    });
    wsRef.current = ws;
    // 변수 꾸러미에 "만큼 바꾸기" 를 정하기 블록 뒤에 끼운다 (Blockly 기본 꾸러미를 감싼다)
    registerVariableFlyout(ws);
    // 개발 서버에서만: e2e 가 블록을 끌어 잇는 대신 프로그램으로 잇는다 (설계 조립)
    if (import.meta.env.DEV) (window as unknown as { __blocklabWorkspace?: Blockly.WorkspaceSvg }).__blocklabWorkspace = ws;
    // 시작 블록이나 함수 정의에 붙지 않은 블록은 꺼서 코드에 넣지 않는다
    ws.addChangeListener(Blockly.Events.disableOrphans);
    // 변수 만들기·이름 바꾸기 창: 파이썬에서 그대로 쓸 수 있는 이름만 받는다
    Blockly.dialog.setPrompt(createNamePrompt());

    const listener = (e: Blockly.Events.Abstract) => {
      if (e.type === Blockly.Events.SELECTED) {
        const id = (e as Blockly.Events.Selected).newElementId;
        if (id && ws.getBlockById(id)) onSelectRef.current?.(id);
        // 선택이 풀려도 포커스가 작업판 밖(코드·하단 패널)으로 간 것이면 알리지 않는다 — 그쪽에서 막 고른 강조를 지우지 않게
        else if (host.contains(document.activeElement)) onSelectRef.current?.(null);
        return;
      }
      // 빈 바탕을 누르면 (선택이 이미 풀려 있어 선택 이벤트가 없어도) 강조를 지운다
      if (e.type === Blockly.Events.CLICK && (e as Blockly.Events.Click).targetType === "workspace") {
        onSelectRef.current?.(null);
        return;
      }
      if (e.type === Blockly.Events.BUBBLE_OPEN) {
        const b = e as Blockly.Events.BubbleOpen;
        if (b.isOpen && b.bubbleType === "warning" && b.blockId) onWarningOpenRef.current?.(b.blockId);
        return;
      }
      if (loadingRef.current || e.isUiEvent || ws.isDragging()) return;
      const { code, map } = generateCodeWithMap(ws);
      onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceJson, code, map);
    };
    ws.addChangeListener(listener);

    const observer = new ResizeObserver(() => {
      // 숨겨진(display:none) 동안은 크기가 0이다. 그대로 재면 Blockly 가 스크롤을 0 폭 기준으로 잘라
      // 보던 자리를 잃으므로, 다시 보일 때(크기가 생겨 이 observer 가 다시 불릴 때) 잰다.
      if (host.clientWidth === 0 || host.clientHeight === 0) return;
      Blockly.svgResize(ws);
      if (needsRevealRef.current && revealProgram(ws)) needsRevealRef.current = false;
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      ws.removeChangeListener(listener);
      ws.removeChangeListener(Blockly.Events.disableOrphans);
      ws.dispose();
      wsRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    load(json, opts) {
      const ws = wsRef.current;
      if (!ws) return;
      const { scrollX, scrollY } = ws;
      loadingRef.current = true;
      // 새 블록들이므로 (같은 id 로 다시 올려도) 단 경고·테두리가 없다
      lintMarksRef.current.clear();
      focusBlockRef.current = null;
      try {
        Blockly.Events.disable();
        ws.clear();
        Blockly.serialization.workspaces.load(json, ws);
        if (opts?.keepScroll) ws.scroll(scrollX, scrollY);
        // 패널 크기가 아직 정해지지 않았으면(첫 화면) ResizeObserver 가 크기를 받은 뒤 맞춘다
        else needsRevealRef.current = !revealProgram(ws);
      } finally {
        Blockly.Events.enable();
        loadingRef.current = false;
      }
      // 실행취소가 load 이전 작업판으로 되돌아가 코드와 어긋나지 않게 한다
      ws.clearUndo();
    },
    getJson: () => Blockly.serialization.workspaces.save(wsRef.current!) as WorkspaceJson,
    getCode: () => (wsRef.current ? generateCode(wsRef.current) : ""),
    getCodeWithMap: () => (wsRef.current ? generateCodeWithMap(wsRef.current) : { code: "", map: emptyLineMap() }),
    setIssues(issues) {
      const ws = wsRef.current;
      if (!ws) return;
      const next = new Map<string, MarkedBlock<Blockly.BlockSvg>>();
      for (const issue of issues) {
        if (!issue.blockId || issue.level === "info") continue;
        const block = realBlock(ws, issue.blockId);
        if (!block) continue;
        const line = issue.line !== undefined ? `${issue.ko} — 코드 ${issue.line}줄` : issue.ko;
        const prev = next.get(block.id);
        next.set(block.id, {
          block,
          text: prev ? `${prev.text}\n${line}` : line,
          level: prev?.level === "error" || issue.level === "error" ? "error" : "warning",
        });
      }
      const { clear, apply } = diffLintMarks(lintMarksRef.current, next, (b) => b.isDeadOrDying());
      // 아이콘을 달고 떼는 일은 작업판 변경이 아니다 (코드를 다시 만들지 않게)
      Blockly.Events.disable();
      try {
        for (const block of clear) {
          block.setWarningText(null, LINT_WARNING);
          setLintClass(block, null);
        }
        for (const { block, text, level, setText } of apply) {
          if (setText) block.setWarningText(text, LINT_WARNING);
          setLintClass(block, level);
        }
      } finally {
        Blockly.Events.enable();
      }
      lintMarksRef.current = next;
    },
    selectBlock(id, opts) {
      const ws = wsRef.current;
      const block = ws && realBlock(ws, id);
      if (!ws || !block) return null;
      if (opts?.focus !== false) Blockly.getFocusManager().focusNode(block);
      ws.centerOnBlock(block.id, true);
      return block.id;
    },
    setFocusBlock(id) {
      const ws = wsRef.current;
      const block = ws && id ? realBlock(ws, id) : null;
      const prev = focusBlockRef.current;
      if (prev && prev !== block && !prev.isDeadOrDying()) prev.getSvgRoot().classList.remove(LINT_FOCUS);
      block?.getSvgRoot().classList.add(LINT_FOCUS);
      focusBlockRef.current = block;
    },
  }));

  return <div ref={hostRef} className={cn("h-full w-full", className)} data-testid="blockly-host" />;
});
