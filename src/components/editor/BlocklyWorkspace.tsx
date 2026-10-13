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

export const BlocklyWorkspace = forwardRef<BlocklyHandle, Props>(function BlocklyWorkspace({ onChange, className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loadingRef = useRef(false);
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

    const observer = new ResizeObserver(() => Blockly.svgResize(ws));
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
