import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LineMap, WorkspaceJson } from "@/codegen";
import { alignLines, formatConsole, lint, type ConsoleEntry, type Issue } from "@/lint";
import { buildContext } from "@/lint/walk";
import type { LineHighlight } from "@/components/editor/CodePanel";
import type { EditorState, Source } from "./editorSync";

/** 살아 있는 작업판에서 한 번에 잰 JSON(블록 id 포함)·재생성 코드·코드 지도 */
export type WorkspaceSnapshot = { json: WorkspaceJson; generated: string; map: LineMap };

export type LintInput = {
  snapshot: WorkspaceSnapshot | null;
  source: Source;
  /** 코드 패널에 보이는 글 (코드 모드면 학생이 친 원문) */
  code: string;
  parseError: { line: number; message: string } | null;
};

/** 검사 결과. 줄 번호는 모두 코드 패널(state.code) 기준 */
export type LintView = {
  issues: Issue[];
  console: ConsoleEntry[];
  snapshot: WorkspaceSnapshot | null;
  /** 재생성 코드 줄 → 코드 패널 줄. null 이면 같은 줄(블록 모드) */
  toPanel: Map<number, number> | null;
  /** 문법 오류가 있어 작업판이 지금 코드와 맞지 않는다 */
  stale: boolean;
};

export const EMPTY_VIEW: LintView = { issues: [], console: [], snapshot: null, toPanel: null, stale: false };

const blockCount = (json: WorkspaceJson | undefined): number => (json?.blocks as { blocks?: unknown[] } | undefined)?.blocks?.length ?? 0;

/**
 * 검사 → 줄 옮기기 → 콘솔 문구 (순수 함수).
 * - 문법 오류가 있으면 파이썬처럼 그것 하나만 (작업판은 지난 성공 블록이라 그 문제는 지금 코드와 맞지 않는다).
 * - 코드 모드면 재생성 코드 줄을 학생이 친 원문 줄로 옮긴다 (짝이 없으면 줄 번호를 버린다).
 * - 블록이 하나도 없는 빈 작업판은 시작 블록 오류를 내지 않는다.
 */
export function computeLintView({ snapshot, source, code, parseError }: LintInput): LintView {
  if (parseError) {
    const syntax: Issue = { id: "syntax", level: "error", line: parseError.line, ko: parseError.message, en: "SyntaxError: invalid syntax" };
    return { issues: [syntax], console: formatConsole([], parseError), snapshot, toPanel: null, stale: true };
  }
  if (!snapshot || blockCount(snapshot.json) === 0) return { ...EMPTY_VIEW, snapshot };
  const toPanel = source === "code" ? alignLines(snapshot.generated, code) : null;
  const issues = lint(snapshot.json, snapshot.map).map((issue) => {
    if (!toPanel || issue.line === undefined) return issue;
    const { line, ...rest } = issue;
    const moved = toPanel.get(line);
    return moved === undefined ? rest : { ...rest, line: moved };
  });
  return { issues, console: formatConsole(issues, null), snapshot, toPanel, stale: false };
}

/** 블록의 코드 줄(코드 패널 기준). 값 블록처럼 지도에 없으면 담은 블록을 거슬러 올라간다 */
export function blockLines(view: LintView, blockId: string): number[] {
  const snap = view.snapshot;
  if (!snap || view.stale) return [];
  const ctx = buildContext(snap.json, snap.map);
  let cur = ctx.byId.get(blockId);
  while (cur) {
    const lines = snap.map.blockToLines[cur.id];
    if (lines?.length) {
      if (!view.toPanel) return [...lines];
      return lines.flatMap((l) => view.toPanel!.get(l) ?? []);
    }
    cur = cur.parentId ? ctx.byId.get(cur.parentId) : undefined;
  }
  return [];
}

/** 코드 패널 줄을 낸 블록 */
export function blockAtLine(view: LintView, line: number): string | undefined {
  const snap = view.snapshot;
  if (!snap || view.stale) return undefined;
  let generated: number | undefined = line;
  if (view.toPanel) {
    generated = undefined;
    for (const [g, p] of view.toPanel) if (p === line) { generated = g; break; }
  }
  return generated === undefined ? undefined : snap.map.lineToBlock[generated];
}

/** 코드 패널 줄 장식: 문제 줄(수준별 색) 다음에 강조 줄 */
export function highlightFor(issues: Issue[], focusLines: number[]): LineHighlight[] {
  const out: LineHighlight[] = [];
  for (const i of issues) if (i.line !== undefined) out.push({ line: i.line, kind: i.level });
  for (const line of focusLines) out.push({ line, kind: "focus" });
  return out;
}

/** 강조할 대상: 블록(그 블록의 줄 전부)과/또는 줄 하나 */
export type FocusTarget = { blockId?: string; line?: number };

const LINT_DELAY = 100;

/**
 * 블록·코드가 바뀌면 잠깐(100ms) 기다렸다 살아 있는 작업판을 읽어 검사한다.
 * 강조 대상(focus)은 블록 id 로 들고 있다가 검사 결과가 바뀔 때마다 그 블록의 지금 줄로 다시 잰다.
 */
export function useLint(state: EditorState, readWorkspace: () => WorkspaceSnapshot | null) {
  const [view, setView] = useState<LintView>(EMPTY_VIEW);
  /** view 를 잰 때의 코드 패널 글 (보드 Traceback 줄을 그 코드의 블록으로 옮길 때 짝이 맞는지 본다) */
  const [viewCode, setViewCode] = useState<string | null>(null);
  const [target, setTarget] = useState<FocusTarget | null>(null);
  const readRef = useRef(readWorkspace);
  readRef.current = readWorkspace;
  const inputRef = useRef(state);
  inputRef.current = state;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const s = inputRef.current;
      setView(computeLintView({ snapshot: readRef.current(), source: s.source, code: s.code, parseError: s.parseError }));
      setViewCode(s.code);
    }, LINT_DELAY);
    return () => window.clearTimeout(timer);
  }, [state.source, state.code, state.map, state.parseError, state.blocks]);

  // 코드가 바뀌면 줄 하나만 가리키던 강조는 낡는다 (블록 강조는 그 블록을 따라간다)
  useEffect(() => {
    setTarget((t) => (t && t.blockId ? { blockId: t.blockId } : null));
  }, [state.code]);

  const focusLines = useMemo(() => {
    if (!target) return [];
    const lines = target.blockId ? blockLines(view, target.blockId) : [];
    if (target.line !== undefined && !lines.includes(target.line)) lines.push(target.line);
    return lines.sort((a, b) => a - b);
  }, [view, target]);

  const setFocus = useCallback((t: FocusTarget | null) => setTarget(t), []);

  return { view, viewCode, issues: view.issues, console: view.console, focus: { blockId: target?.blockId, lines: focusLines }, setFocus, setTarget };
}
