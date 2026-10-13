import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertTriangle, Blocks, Code2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Play, Save, Square, Usb,
} from "lucide-react";
import { usePanelRef, type PanelSize } from "react-resizable-panels";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BlocklyWorkspace, type BlocklyHandle } from "@/components/editor/BlocklyWorkspace";
import { CodePanel } from "@/components/editor/CodePanel";
import type { LineMap, WorkspaceJson } from "@/codegen";
import type { ConsoleEntry, Issue } from "@/lint";
import { countCodeBlocks, editorReducer, initialEditorState, type Source } from "./editorSync";
import { SAMPLE_CODE } from "./sample";
import { BottomPanel } from "./BottomPanel";
import { ConsolePanel } from "./ConsolePanel";
import { ProblemsPanel } from "./ProblemsPanel";
import { blockAtLine, highlightFor, useLint, type WorkspaceSnapshot } from "./useLint";
import { useIsNarrow } from "./useViewport";

const DEVICE_BUTTONS = [
  { icon: Usb, label: "보드 연결" },
  { icon: Play, label: "실행" },
  { icon: Save, label: "보드에 저장" },
  { icon: Square, label: "멈춤" },
];

/** 넓은 화면에서 어느 패널을 펼쳐 두었는지. 좁은 화면에서는 블록·코드 대신 지금 기준(source) 쪽만 보인다 */
export type Panels = { blocks: boolean; code: boolean; bottom: boolean };
const INITIAL_PANELS: Panels = { blocks: true, code: true, bottom: false };

type PanelToggleProps = {
  label: string;
  icon: typeof PanelLeftClose;
  /** 아이콘 옆 글자 (펼치기 버튼이 바로 옆 접기 버튼과 헷갈리지 않게) */
  text?: string;
  onClick(): void;
};

function PanelToggle({ label, icon: Icon, text, onClick }: PanelToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size={text ? "sm" : "icon"} className={text ? "h-7" : "size-7"} aria-label={label} onClick={onClick}>
          <Icon className="size-4" />{text}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function LabPage() {
  const [state, dispatch] = useReducer(editorReducer, SAMPLE_CODE, initialEditorState);
  const blocklyRef = useRef<BlocklyHandle>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  /** 아직 debounce 를 기다리는 코드. 탭을 바꿀 때 먼저 반영해야 마지막 입력이 사라지지 않는다 */
  const pendingCodeRef = useRef<string | null>(null);
  /**
   * 지금 기준. Radix Tabs 는 한 번 누를 때 onValueChange 를 두 번(mousedown, focus) 부르고, 두 번째는
   * 다시 그리기 전의 state 를 보므로 옛 블록을 다시 올린다. 같은 쪽으로의 전환은 여기서 걸러 낸다.
   */
  const sourceRef = useRef(state.source);
  sourceRef.current = state.source;

  const narrow = useIsNarrow();
  const narrowRef = useRef(narrow);
  narrowRef.current = narrow;
  const [panels, setPanels] = useState<Panels>(INITIAL_PANELS);
  const blocksPanelRef = usePanelRef();
  const codePanelRef = usePanelRef();
  // 좁은 화면에서는 탭처럼 지금 기준 쪽 하나만 보인다. 숨긴 쪽도 마운트는 유지한다(작업판 상태를 지킨다).
  const showBlocks = narrow ? state.source === "blocks" : panels.blocks;
  const showCode = narrow ? state.source === "code" : panels.code;

  /** 지금 보여야 할 패널. 그룹이 크기를 잰 뒤의 onResize 에서도 읽는다 */
  const wantRef = useRef({ blocks: showBlocks, code: showCode });
  wantRef.current = { blocks: showBlocks, code: showCode };

  // 보일 패널을 펼치고 숨길 패널을 접는다. 둘 다 접을 수는 없으므로 펼치기를 먼저 한다.
  const applyVisibility = useCallback(() => {
    const targets = [
      { panel: blocksPanelRef.current, show: wantRef.current.blocks },
      { panel: codePanelRef.current, show: wantRef.current.code },
    ];
    for (const { panel, show } of targets) if (show && panel?.isCollapsed()) panel.expand();
    for (const { panel, show } of targets) if (!show && panel && !panel.isCollapsed()) panel.collapse();
  }, [blocksPanelRef, codePanelRef]);

  useLayoutEffect(applyVisibility, [showBlocks, showCode, applyVisibility]);

  /**
   * 패널 크기가 바뀔 때. 처음 그릴 때는 위 effect 가 그룹이 크기를 재기 전에 돌아 접기가 먹지 않으므로
   * (좁은 화면에서 숨긴 코드 패널 자리가 빈 칸으로 남던 원인), 크기가 원하는 상태와 어긋나면 다시 맞춘다.
   * 넓은 화면에서 손잡이를 끌어 패널을 접거나 펼친 것이면 버튼 상태가 따라간다.
   */
  const onPanelResize = useCallback((key: "blocks" | "code", size: PanelSize) => {
    const open = size.asPercentage > 0;
    if (narrowRef.current) {
      if (open !== wantRef.current[key]) requestAnimationFrame(applyVisibility);
      return;
    }
    setPanels((p) => (p[key] === open ? p : { ...p, [key]: open }));
  }, [applyVisibility]);
  const onBlocksResize = useCallback((size: PanelSize) => onPanelResize("blocks", size), [onPanelResize]);
  const onCodeResize = useCallback((size: PanelSize) => onPanelResize("code", size), [onPanelResize]);

  /** 한쪽을 접으면 다른 쪽은 반드시 펼친다 (둘 다 접힌 화면은 없다) */
  const setSidePanel = (key: "blocks" | "code", open: boolean) => {
    const other = key === "blocks" ? "code" : "blocks";
    setPanels((p) => ({ ...p, [key]: open, ...(open ? {} : { [other]: true }) }));
  };

  /** 작업판에 블록을 올린 뒤 그 작업판(블록 id)으로 코드 지도를 다시 잰다. load 는 변경 이벤트를 내지 않는다 */
  const refreshMap = useCallback(() => {
    const handle = blocklyRef.current;
    if (handle) dispatch({ type: "mapUpdated", map: handle.getCodeWithMap().map });
  }, []);

  // 코드가 기준일 때: 파싱 결과가 바뀌면 작업판에 올린다 (보던 자리는 그대로)
  useEffect(() => {
    if (state.source === "code" && state.blocks) {
      blocklyRef.current?.load(state.blocks, { keepScroll: true });
      refreshMap();
    }
  }, [state.source, state.blocks, refreshMap]);

  // 처음 한 번: 예시 블록을 작업판에 올린다
  useEffect(() => {
    if (state.blocks) {
      blocklyRef.current?.load(state.blocks);
      refreshMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 검사가 읽는 살아 있는 작업판 (블록 id 가 화면의 블록과 같다) */
  const readWorkspace = useCallback((): WorkspaceSnapshot | null => {
    const handle = blocklyRef.current;
    if (!handle) return null;
    const { code, map } = handle.getCodeWithMap();
    return { json: handle.getJson(), generated: code, map };
  }, []);
  const lintState = useLint(state, readWorkspace);
  const { view, issues, focus, setTarget } = lintState;
  const consoleEntries = lintState.console;

  // 검사 결과를 블록 경고 아이콘·테두리로
  useEffect(() => {
    blocklyRef.current?.setIssues(issues);
  }, [issues]);

  // 오류가 처음 생기면 하단 패널을 한 번 펼쳐 준다 (그 뒤로는 학생이 접은 대로 둔다)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || !issues.some((i) => i.level === "error")) return;
    autoOpenedRef.current = true;
    setPanels((p) => (p.bottom ? p : { ...p, bottom: true }));
  }, [issues]);

  const highlightLines = useMemo(() => highlightFor(issues, focus.lines), [issues, focus.lines]);

  /** 블록을 선택하고(있으면) 그 블록의 코드 줄과 line 을 강조한다 */
  const reveal = useCallback((blockId: string | undefined, line: number | undefined) => {
    const selected = blockId ? blocklyRef.current?.selectBlock(blockId) ?? null : null;
    setTarget({ blockId: selected ?? blockId, line });
  }, [setTarget]);

  const onProblemSelect = useCallback((issue: Issue) => reveal(issue.blockId, issue.line), [reveal]);
  const onConsoleSelect = useCallback((entry: ConsoleEntry) => {
    if (entry.line === undefined && !entry.blockId) return;
    reveal(entry.blockId ?? (entry.line !== undefined ? blockAtLine(view, entry.line) : undefined), entry.line);
  }, [reveal, view]);
  const onLineClick = useCallback((line: number) => reveal(blockAtLine(view, line), line), [reveal, view]);

  // 작업판에서 블록을 고르면 (어떤 블록이든) 그 블록이 만든 코드 줄을 강조한다. 같은 블록이면 줄 강조를 지키고, 선택을 풀면 지운다
  const onBlockSelect = useCallback((blockId: string | null) => {
    setTarget((t) => (blockId === null ? null : t?.blockId === blockId ? t : { blockId }));
  }, [setTarget]);
  const onWarningOpen = useCallback((blockId: string) => {
    setTarget((t) => (t?.blockId === blockId ? t : { blockId }));
  }, [setTarget]);

  const onBlocksChange = useCallback((json: WorkspaceJson, code: string, map: LineMap) => {
    dispatch({ type: "blocksChanged", json, code, map });
  }, []);

  const onCodeChange = useCallback((code: string) => {
    window.clearTimeout(debounceRef.current);
    pendingCodeRef.current = code;
    debounceRef.current = window.setTimeout(() => {
      pendingCodeRef.current = null;
      dispatch({ type: "codeChanged", code });
    }, 300);
  }, []);

  const switchSource = (source: Source) => {
    if (source === sourceRef.current) return;
    let current = state;
    if (pendingCodeRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      const flush = { type: "codeChanged", code: pendingCodeRef.current } as const;
      pendingCodeRef.current = null;
      current = editorReducer(current, flush);
      dispatch(flush);
    }
    if (source === "blocks" && current.parseError) {
      // 블록으로 가면 마지막 성공 블록의 코드로 덮인다. 코드 모드에 머물고 오류 줄은 그대로 강조한다.
      // (Radix 가 한 번 누를 때 두 번 부르므로 같은 id 로 토스트를 하나만 띄운다)
      toast.error("문법 오류를 고친 뒤에 블록으로 돌아갈 수 있어요", { id: "parse-error-switch" });
      return;
    }
    sourceRef.current = source;
    if (source === "blocks" && blocklyRef.current && current.blocks) blocklyRef.current.load(current.blocks, { keepScroll: true });
    dispatch({ type: "switchSource", source });
    if (source === "blocks") refreshMap();
  };

  const codeMode = state.source === "code";
  // 블록 모드에서는 지금 작업판에 남은 코드 블록 수 (지난 파싱의 unparsed 는 블록을 지우면 낡는다)
  const unconvertedCount = codeMode ? state.unparsed.length : countCodeBlocks(state.blocks);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 overflow-hidden border-b px-3 whitespace-nowrap">
        <Tabs value={state.source} onValueChange={(v) => switchSource(v as Source)}>
          <TabsList>
            <TabsTrigger value="blocks"><Blocks className="size-4" />블록</TabsTrigger>
            <TabsTrigger value="code"><Code2 className="size-4" />코드</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="hidden truncate text-sm text-muted-foreground lg:inline">
          {codeMode ? "코드를 고치면 블록이 따라옵니다" : "블록을 놓으면 코드가 바로 바뀝니다"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {DEVICE_BUTTONS.map(({ icon: Icon, label }) => (
            <Tooltip key={label}>
              {/* 비활성 버튼은 포인터 이벤트를 받지 않으므로 span 이 툴팁을 받는다 */}
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex rounded-md">
                  <Button variant="outline" size="sm" disabled aria-label={label}>
                    <Icon className="size-4" /><span className="hidden md:inline">{label}</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>보드 연결은 다음 단계에서 들어옵니다</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel
          panelRef={blocksPanelRef}
          defaultSize="62"
          minSize="35"
          collapsible
          collapsedSize="0"
          onResize={onBlocksResize}
          className="flex flex-col"
        >
          {/* 접혀도 작업판은 언마운트하지 않고 display:none 으로 숨긴다 */}
          <div className={cn("flex h-full min-h-0 flex-col", !showBlocks && "hidden")}>
            {!narrow && (
              <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-sm">
                <span className="font-medium">작업판</span>
                <div className="ml-auto flex items-center">
                  {!panels.code && <PanelToggle label="코드 패널 펼치기" icon={PanelRightOpen} text="코드" onClick={() => setSidePanel("code", true)} />}
                  <PanelToggle label="블록 패널 접기" icon={PanelLeftClose} onClick={() => setSidePanel("blocks", false)} />
                </div>
              </div>
            )}
            <div className="relative min-h-0 flex-1">
              <BlocklyWorkspace ref={blocklyRef} onChange={onBlocksChange} onSelect={onBlockSelect} onWarningOpen={onWarningOpen} />
              {codeMode && (
                <div className="pointer-events-auto absolute inset-0 flex items-start justify-center bg-background/40 pt-6" data-testid="blocks-overlay">
                  <Badge variant="secondary">코드 편집 중 — 블록은 코드에 따라 갱신됩니다</Badge>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className={cn(narrow && "hidden")} disabled={narrow} />
        <ResizablePanel
          panelRef={codePanelRef}
          defaultSize="38"
          minSize="25"
          collapsible
          collapsedSize="0"
          onResize={onCodeResize}
          className="flex flex-col"
        >
          <div className={cn("flex h-full min-h-0 flex-col", !showCode && "hidden")}>
            <div className="flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b px-3 text-sm whitespace-nowrap">
              {!narrow && !panels.blocks && <PanelToggle label="블록 패널 펼치기" icon={PanelLeftOpen} text="블록" onClick={() => setSidePanel("blocks", true)} />}
              <span className="font-medium">main.py</span>
              {unconvertedCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="gap-1" data-testid="unconverted-badge"><AlertTriangle className="size-3" />블록으로 바꾸지 못한 줄 {unconvertedCount}개</Badge>
                  </TooltipTrigger>
                  <TooltipContent className="whitespace-pre-line">
                    {codeMode ? state.unparsed.map((u) => `${u.line}줄: ${u.text}`).join("\n") : "작업판에 코드 블록으로 남아 있어요"}
                  </TooltipContent>
                </Tooltip>
              )}
              {state.parseError && (
                <Badge variant="destructive" className="gap-1" data-testid="parse-error">
                  <AlertTriangle className="size-3" />{state.parseError.line}줄 {state.parseError.message}
                </Badge>
              )}
              {!narrow && (
                <div className="ml-auto flex items-center">
                  <PanelToggle label="코드 패널 접기" icon={PanelRightClose} onClick={() => setSidePanel("code", false)} />
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <CodePanel
                value={state.code}
                readOnly={!codeMode}
                onChange={onCodeChange}
                errorLine={state.parseError?.line ?? null}
                highlightLines={highlightLines}
                onLineClick={onLineClick}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <BottomPanel
        open={panels.bottom}
        onToggle={() => setPanels((p) => ({ ...p, bottom: !p.bottom }))}
        counts={{ problems: issues.length, console: consoleEntries.length }}
      >
        <TabsContent value="problems"><ProblemsPanel issues={issues} onSelect={onProblemSelect} /></TabsContent>
        <TabsContent value="console"><ConsolePanel entries={consoleEntries} onSelect={onConsoleSelect} /></TabsContent>
      </BottomPanel>
    </div>
  );
}
