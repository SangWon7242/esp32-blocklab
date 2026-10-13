import { useCallback, useEffect, useReducer, useRef } from "react";
import { AlertTriangle, Blocks, Code2, Play, Save, Square, Usb } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlocklyWorkspace, type BlocklyHandle } from "@/components/editor/BlocklyWorkspace";
import { CodePanel } from "@/components/editor/CodePanel";
import type { WorkspaceJson } from "@/codegen";
import { editorReducer, initialEditorState, type Source } from "./editorSync";
import { SAMPLE_CODE } from "./sample";

const DEVICE_BUTTONS = [
  { icon: Usb, label: "보드 연결" },
  { icon: Play, label: "실행" },
  { icon: Save, label: "보드에 저장" },
  { icon: Square, label: "멈춤" },
];

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

  // 코드가 기준일 때: 파싱 결과가 바뀌면 작업판에 올린다
  useEffect(() => {
    if (state.source === "code" && state.blocks) blocklyRef.current?.load(state.blocks);
  }, [state.source, state.blocks]);

  // 처음 한 번: 예시 블록을 작업판에 올린다
  useEffect(() => {
    if (state.blocks) blocklyRef.current?.load(state.blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBlocksChange = useCallback((json: WorkspaceJson, code: string) => {
    dispatch({ type: "blocksChanged", json, code });
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
    if (source === "blocks" && blocklyRef.current && current.blocks) blocklyRef.current.load(current.blocks);
    dispatch({ type: "switchSource", source });
  };

  const codeMode = state.source === "code";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Tabs value={state.source} onValueChange={(v) => switchSource(v as Source)}>
          <TabsList>
            <TabsTrigger value="blocks"><Blocks className="size-4" />블록</TabsTrigger>
            <TabsTrigger value="code"><Code2 className="size-4" />코드</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-sm text-muted-foreground">
          {codeMode ? "코드를 고치면 블록이 따라옵니다" : "블록을 놓으면 코드가 바로 바뀝니다"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {DEVICE_BUTTONS.map(({ icon: Icon, label }) => (
            <Tooltip key={label}>
              {/* 비활성 버튼은 포인터 이벤트를 받지 않으므로 span 이 툴팁을 받는다 */}
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex rounded-md">
                  <Button variant="outline" size="sm" disabled><Icon className="size-4" />{label}</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>보드 연결은 다음 단계에서 들어옵니다</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="62" minSize="35" className="relative">
          <BlocklyWorkspace ref={blocklyRef} onChange={onBlocksChange} />
          {codeMode && (
            <div className="pointer-events-auto absolute inset-0 flex items-start justify-center bg-background/40 pt-6" data-testid="blocks-overlay">
              <Badge variant="secondary">코드 편집 중 — 블록은 코드에 따라 갱신됩니다</Badge>
            </div>
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="38" minSize="25" className="flex flex-col">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-sm">
            <span className="font-medium">main.py</span>
            {state.unparsed.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1"><AlertTriangle className="size-3" />블록으로 바꾸지 못한 줄 {state.unparsed.length}개</Badge>
                </TooltipTrigger>
                <TooltipContent className="whitespace-pre-line">{state.unparsed.map((u) => `${u.line}줄: ${u.text}`).join("\n")}</TooltipContent>
              </Tooltip>
            )}
            {state.parseError && (
              <Badge variant="destructive" className="gap-1" data-testid="parse-error">
                <AlertTriangle className="size-3" />{state.parseError.line}줄 {state.parseError.message}
              </Badge>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <CodePanel value={state.code} readOnly={!codeMode} onChange={onCodeChange} errorLine={state.parseError?.line ?? null} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
