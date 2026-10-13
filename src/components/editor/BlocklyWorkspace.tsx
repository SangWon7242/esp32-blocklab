import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as Blockly from "blockly";
import { entryTheme, registerBlocks, toolbox } from "@/blocks";
import { generateCode, type WorkspaceJson } from "@/codegen";
import { cn } from "@/lib/utils";
import { createNamePrompt } from "./namePrompt";

export type LoadOptions = {
  /** 지금 보던 자리를 그대로 둔다 (코드 ↔ 블록 전환·코드 고칠 때). 아니면 프로그램 왼쪽 위로 맞춘다 */
  keepScroll?: boolean;
};

export type BlocklyHandle = {
  load(json: WorkspaceJson, opts?: LoadOptions): void;
  getJson(): WorkspaceJson;
  getCode(): string;
};

type Props = {
  /** 사용자가 블록을 바꿀 때마다 (프로그램이 load 한 경우는 제외) */
  onChange: (json: WorkspaceJson, code: string) => void;
  className?: string;
};

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

export const BlocklyWorkspace = forwardRef<BlocklyHandle, Props>(function BlocklyWorkspace({ onChange, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loadingRef = useRef(false);
  /** load 했지만 작업판 크기가 0이라 아직 프로그램을 화면에 맞추지 못했다 */
  const needsRevealRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    registerBlocks();
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
    // 시작 블록이나 함수 정의에 붙지 않은 블록은 꺼서 코드에 넣지 않는다
    ws.addChangeListener(Blockly.Events.disableOrphans);
    // 변수 만들기·이름 바꾸기 창: 파이썬에서 그대로 쓸 수 있는 이름만 받는다
    Blockly.dialog.setPrompt(createNamePrompt());

    const listener = (e: Blockly.Events.Abstract) => {
      if (loadingRef.current || e.isUiEvent || ws.isDragging()) return;
      onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceJson, generateCode(ws));
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
  }));

  return <div ref={hostRef} className={cn("h-full w-full", className)} data-testid="blockly-host" />;
});
