import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { aiCardToolbox, type AiCardToolboxLevel } from "@/blocks";
import { generateAiCardCodeWithMap, type LineMap, type WorkspaceJson } from "@/codegen";
import { BlocklyWorkspace, type BlocklyHandle, type WorkspaceVariant } from "@/components/editor/BlocklyWorkspace";
import { CodePanel, type LineHighlight } from "@/components/editor/CodePanel";
import { aiCardStarterCode, checkAiCardCode } from "@/aicard/cards";
import { aiCardBlocksFromCode, aiCardIssues } from "@/aicard/program";
import type { Issue } from "@/lint";
import { cn } from "@/lib/utils";

export type AiCardEditorProps = {
  /** 처음 실을 아이 코드 (`def on_card(card): …`). 블록으로 바꾸지 못하면 시작 뼈대(aiCardStarterCode)를 싣는다. 처음 한 번만 읽는다 */
  initialCode: string;
  /** 블록을 바꿀 때마다(처음 실을 때 한 번 포함). ok = 문법 오류가 없고 on_card 정의가 꼭 하나 */
  onChange: (code: string, ok: boolean) => void;
  /** 블록 옆에 파이썬 코드를 나란히 보여 준다 (기본 true) */
  showCode?: boolean;
  className?: string;
  /** basic: AI 카드 · 판단 · RGB 색 / full: + 흐름(기다리기·반복) · 계산 · 숫자 set_color (기본 basic) */
  toolboxLevel?: AiCardToolboxLevel;
};

/** 블록 크기 (기본 편집기 0.75 보다 크게: 아이 손가락·눈에 맞춘다) */
const START_SCALE = 1.25;
/** 코드 글씨 (15pt = 20px 이상) */
const CODE_MIN_FONT = 20;

const codegen = (ws: Parameters<NonNullable<WorkspaceVariant["codegen"]>>[0]) => generateAiCardCodeWithMap(ws);

/**
 * 행사용 AI 카드 코딩 편집기 (lib-v1.7.0, 메이커 데이 색깔 카드 AI 의 코딩 단계). 블록으로 `def on_card(card): …` 를 만든다.
 * 생성 코드에는 RGB 준비 · set_color 정의가 없다 — 호스트가 보드에 먼저 올린다. 부모 크기를 꽉 채운다 (호스트가 높이를 준다).
 * BlocklabProvider 안에서 쓴다 (라이브러리 CSS 범위·Blockly media 주소).
 */
export function AiCardEditor({ initialCode, onChange, showCode = true, className, toolboxLevel = "basic" }: AiCardEditorProps) {
  const blocksRef = useRef<BlocklyHandle>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [code, setCode] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const firstLevel = useRef(toolboxLevel);
  const variant = useMemo<WorkspaceVariant>(
    () => ({ toolbox: aiCardToolbox(firstLevel.current), startScale: START_SCALE, maxScale: 2, maxInstances: { aicard_on_card: 1, start_program: 1 }, codegen }),
    [],
  );

  const publish = useCallback((json: WorkspaceJson, next: string, map: LineMap) => {
    const found = aiCardIssues(json, map);
    setCode(next);
    setIssues(found);
    blocksRef.current?.setIssues(found);
    onChangeRef.current(next, checkAiCardCode(next).ok);
  }, []);

  // 처음 한 번: 코드 → 블록. 못 바꾸면 시작 뼈대
  useEffect(() => {
    const handle = blocksRef.current;
    if (!handle) return;
    let r = aiCardBlocksFromCode(initialCode);
    if (!r.ok) {
      setLoadError(`처음 코드 ${r.line}줄을 블록으로 바꾸지 못해서 시작 코드를 실었어요.`);
      r = aiCardBlocksFromCode(aiCardStarterCode());
    }
    if (!r.ok) return;
    handle.load(r.json);
    const { code: next, map } = handle.getCodeWithMap();
    publish(handle.getJson(), next, map);
    // initialCode 는 처음 한 번만 읽는다 (아이 편집을 덮지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 툴박스 단계가 바뀌면 툴박스만 바꾼다 (놓인 블록은 그대로)
  useEffect(() => {
    if (toolboxLevel === firstLevel.current) return;
    firstLevel.current = toolboxLevel;
    blocksRef.current?.updateToolbox(aiCardToolbox(toolboxLevel));
  }, [toolboxLevel]);

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const ok = checkAiCardCode(code).ok && errors.length === 0;
  const highlights = useMemo<LineHighlight[]>(
    () => issues.flatMap((i) => (i.line !== undefined && i.level !== "info" ? [{ line: i.line, kind: i.level }] : [])),
    [issues],
  );
  const first = errors[0] ?? warnings[0];
  const status = loadError ?? first?.ko ?? null;
  const statusLevel = first?.level ?? (loadError ? "warning" : null);

  return (
    <div className={cn("aiCardEditor relative flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-background", className)} data-testid="aicard-editor" data-ok={ok ? "yes" : "no"}>
      <div className="relative min-h-0 min-w-0 flex-1">
        <BlocklyWorkspace ref={blocksRef} variant={variant} onChange={publish} className="absolute inset-0" />
      </div>
      {showCode && (
        <aside className="flex min-h-0 w-[38%] min-w-[260px] max-w-[520px] shrink-0 flex-col border-l bg-background">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-lg font-bold">내가 만든 코드</h2>
          </div>
          <div className="min-h-0 flex-1">
            <CodePanel value={code} readOnly onChange={() => {}} highlightLines={highlights} minFontSize={CODE_MIN_FONT} />
          </div>
          <div className="shrink-0 border-t p-3">
            <StatusBar ok={ok} message={status} level={statusLevel} />
          </div>
        </aside>
      )}
      {/* 코드 칸이 없으면 작업판 오른쪽 위에 띄운다 (왼쪽은 팔레트, 오른쪽 아래는 확대·휴지통) */}
      {!showCode && (
        <div className="pointer-events-none absolute top-3 right-4 z-10 max-w-[50%]">
          <StatusBar ok={ok} message={status} level={statusLevel} />
        </div>
      )}
    </div>
  );
}

/** 맨 아래 한 줄 상태: 보드에 올릴 수 있는지, 아니면 첫 문제 */
function StatusBar({ ok, message, level }: { ok: boolean; message: string | null; level: Issue["level"] | null }) {
  const good = ok && level !== "error";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-base font-semibold",
        good && !message ? "border-emerald-300 bg-emerald-50 text-emerald-800" : good ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-300 bg-red-50 text-red-800",
      )}
      role="status"
      data-testid="aicard-status"
    >
      {good && !message ? <CircleCheck className="size-5 shrink-0" aria-hidden /> : <CircleAlert className="size-5 shrink-0" aria-hidden />}
      <span className="min-w-0 break-keep">{good && !message ? "보드에 올릴 수 있어요" : (message ?? "블록을 다시 살펴봐요")}</span>
    </div>
  );
}
