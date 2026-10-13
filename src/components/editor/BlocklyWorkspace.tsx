import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as Blockly from "blockly";
import { entryTheme, registerBlocks, toolbox } from "@/blocks";
import { generateCode, type WorkspaceJson } from "@/codegen";
import { cn } from "@/lib/utils";

export type BlocklyHandle = {
  load(json: WorkspaceJson): void;
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
    });
    wsRef.current = ws;

    const listener = (e: Blockly.Events.Abstract) => {
      if (loadingRef.current || e.isUiEvent || ws.isDragging()) return;
      onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceJson, generateCode(ws));
    };
    ws.addChangeListener(listener);

    const observer = new ResizeObserver(() => {
      Blockly.svgResize(ws);
      if (needsRevealRef.current && revealProgram(ws)) needsRevealRef.current = false;
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      ws.removeChangeListener(listener);
      ws.dispose();
      wsRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    load(json) {
      const ws = wsRef.current;
      if (!ws) return;
      loadingRef.current = true;
      try {
        Blockly.Events.disable();
        ws.clear();
        Blockly.serialization.workspaces.load(json, ws);
        // 패널 크기가 아직 정해지지 않았으면(첫 화면) ResizeObserver 가 크기를 받은 뒤 맞춘다
        needsRevealRef.current = !revealProgram(ws);
      } finally {
        Blockly.Events.enable();
        loadingRef.current = false;
      }
    },
    getJson: () => Blockly.serialization.workspaces.save(wsRef.current!) as WorkspaceJson,
    getCode: () => (wsRef.current ? generateCode(wsRef.current) : ""),
  }));

  return <div ref={hostRef} className={cn("h-full w-full", className)} data-testid="blockly-host" />;
});
