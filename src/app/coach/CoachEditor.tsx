import { useCallback, useEffect, useRef, useState } from "react";
import { EditorWorkbench, type EditorWorkbenchHandle } from "../lab/EditorWorkbench";
import type { SaveProgram } from "../lab/editorSync";
import { labStart } from "../lab/labStart";
import type { RunEndResult } from "../lab/useDevice";
import { useSettings } from "../settings/settings";
import { COACH_PROGRAM_DELAY_MS, coachProgramKey, coachProgramOf, coachRunEvent } from "./coachProgram";
import { ProposalBox } from "./ProposalBox";
import type { CoachEditorViewProps, CoachProgram } from "./types";

/**
 * 코치 편집기 화면 (lib-v1.1.0, CoachEditorView 의 몸통). 자유 코딩과 같은 편집기(EditorWorkbench: 블록·코드 탭, 보드 연결·실행·멈춤,
 * 콘솔, 코드 글자 크기)에 작품 저장·예제·보드에 저장 단추는 없다. 부모 높이를 꽉 채운다 (h-full 사슬).
 */
export function CoachEditor({ initialProgram, onProgramChange, proposal, onProposalDecision, onRunEnd, highlightLines, readOnly }: CoachEditorViewProps) {
  const settings = useSettings();
  // 장치는 마운트 때 정해진다 (EditorWorkbench 의 useDevice) — 실행 증거의 source 도 그때 값을 쓴다
  const [fake] = useState(() => settings.fakeBoard);
  // 처음 한 번만: 자유 코딩의 작품 싣기 규칙 그대로 (맨 위 블록이 있는 blocksJson 이면 작업판, 아니면 코드 → 블록, 실패하면 코드 모드)
  const [start] = useState(() =>
    labStart({ initialProgram: initialProgram && typeof initialProgram.code === "string" ? { code: initialProgram.code, blocksJson: initialProgram.blocksJson ?? undefined } : null }),
  );
  const workbench = useRef<EditorWorkbenchHandle>(null);

  const onProgramChangeRef = useRef(onProgramChange);
  onProgramChangeRef.current = onProgramChange;
  const onDecisionRef = useRef(onProposalDecision);
  onDecisionRef.current = onProposalDecision;
  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;

  /* ---- onProgramChange: 1초 디바운스, 같은 프로그램은 다시 내보내지 않는다 ---- */
  /** 마지막으로 알린(또는 처음 실린) 프로그램의 열쇠. 처음 실린 프로그램은 내보내지 않는다 */
  const lastKey = useRef<string | null>(null);
  /** 편집기가 마지막으로 알린 프로그램 (언마운트 때 핸들이 이미 떨어졌으면 이것을 쓴다) */
  const latest = useRef<CoachProgram | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef(false);

  const emit = useCallback((p: CoachProgram) => {
    const key = coachProgramKey(p);
    if (key === lastKey.current) return;
    lastKey.current = key;
    onProgramChangeRef.current?.(p);
  }, []);

  /** 기다리던 것을 바로 내보낸다 (디바운스 끝·탭 숨김·언마운트). 코드 칸의 짧은 입력 대기도 먼저 반영한다 */
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (!pending.current) return;
    pending.current = false;
    const handle = workbench.current;
    const p = handle ? coachProgramOf(handle.getSaveProgram()) : latest.current;
    if (p) emit(p);
  }, [emit]);

  const onSaveProgram = useCallback((sp: SaveProgram) => {
    const p = coachProgramOf(sp);
    latest.current = p;
    if (lastKey.current === null) {
      lastKey.current = coachProgramKey(p);
      return;
    }
    pending.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, COACH_PROGRAM_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  /* ---- 실행 증거 ---- */
  const onWorkbenchRunEnd = useCallback((result: RunEndResult, output: string, code: string) => {
    onRunEndRef.current?.(coachRunEvent({ fake, result, output, code }));
  }, [fake]);

  /* ---- 제안 상자: 같은 id 는 한 번 결정되면 다시 띄우지 않는다 ---- */
  const [decided, setDecided] = useState<ReadonlySet<string>>(() => new Set());
  const shown = proposal && !decided.has(proposal.id) ? proposal : null;
  /** 상자에 보일 지금 코드: 편집기가 알린 마지막 프로그램 (디바운스와 상관없이 바로 따라간다) */
  const [currentCode, setCurrentCode] = useState(start.initialCode);
  const onSaveProgramWithCode = useCallback((sp: SaveProgram) => {
    setCurrentCode(sp.code);
    onSaveProgram(sp);
  }, [onSaveProgram]);

  const decide = useCallback((accepted: boolean) => {
    if (!shown) return;
    const handle = workbench.current;
    if (!handle) return;
    if (accepted && readOnly) return;
    const program = coachProgramOf(accepted ? handle.replaceCode(shown.code) : handle.getSaveProgram());
    setDecided((s) => new Set(s).add(shown.id));
    onDecisionRef.current?.(shown.id, accepted, program);
  }, [shown, readOnly]);

  const banner = shown ? (
    <ProposalBox
      current={currentCode}
      proposed={shown.code}
      note={shown.note}
      readOnly={readOnly}
      onApply={() => decide(true)}
      onClose={() => decide(false)}
    />
  ) : null;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col" data-testid="coach-editor">
      <EditorWorkbench
        ref={workbench}
        initialCode={start.initialCode}
        initialBlocks={start.initialBlocks}
        initialSource={start.initialSource}
        fake={fake}
        hideSave
        onSaveProgram={onSaveProgramWithCode}
        onRunEnd={onWorkbenchRunEnd}
        banner={banner}
        markLines={highlightLines ?? null}
        readOnly={readOnly}
      />
    </div>
  );
}
