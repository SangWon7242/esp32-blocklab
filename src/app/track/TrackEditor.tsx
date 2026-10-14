import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { useSearchParams } from "react-router";
import { cn } from "@/lib/utils";
import { EditorWorkbench, type EditorProgram, type EditorWorkbenchHandle } from "../lab/EditorWorkbench";
import { readSettings } from "../settings/settings";

export type { EditorProgram };
export type TrackEditorHandle = EditorWorkbenchHandle;

/** 단계 기록에 프로그램을 저장하는 간격 (마지막 변경 뒤) */
export const PROGRAM_SAVE_DELAY_MS = 1000;

type Props = {
  /** 처음 실을 코드 (저장한 프로그램이 있으면 그것) */
  initialCode: string;
  /** 코드 대신 처음 실을 블록 JSON (설계 조립: 떼어 흩어 둔 블록, 저장한 작업판) */
  initialBlocks?: EditorProgram["blocksJson"];
  /** 코드·블록이 바뀌면 1초 뒤(마지막 변경 기준) 한 번. 화면을 떠날 때 기다리던 것도 저장한다 */
  onProgram(code: string, blocksJson: unknown): void;
  /** 실행 결과와 그 실행의 보드 출력 */
  onRunEnd?(result: { ok: boolean; stopped: boolean }, output: string): void;
  /** 설계 조립: 블록 모드 고정, 떨어진 블록 경고 없음 */
  assemblyMode?: boolean;
  /** 높이를 줄인다 */
  compact?: boolean;
  ref?: Ref<TrackEditorHandle>;
};

/**
 * 트랙 편집기 단계(실행·미션·디버깅)의 편집기. 자유 코딩 화면과 같은 편집기(EditorWorkbench)에
 * "보드에 저장"만 숨기고, 가짜 보드(?device=fake·설정)를 따른다.
 */
export function TrackEditor({ initialCode, initialBlocks, assemblyMode, onProgram, onRunEnd, compact, ref }: Props) {
  const [searchParams] = useSearchParams();
  const fake = searchParams.get("device") === "fake" || readSettings().fakeBoard;
  const inner = useRef<EditorWorkbenchHandle>(null);
  useImperativeHandle(ref, () => ({ getProgram: () => inner.current!.getProgram(), openExample: (code: string) => inner.current?.openExample(code) }), []);

  const onProgramRef = useRef(onProgram);
  onProgramRef.current = onProgram;
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<EditorProgram | null>(null);
  /** 처음 실린 프로그램은 저장하지 않는다 (열어 보기만 해도 기록이 생기지 않게) */
  const first = useRef(true);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    if (p) onProgramRef.current(p.code, p.blocksJson);
  }, []);

  const onChange = useCallback((p: EditorProgram) => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = p;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, PROGRAM_SAVE_DELAY_MS);
  }, [flush]);

  // 화면을 떠날 때 기다리던 저장을 마친다
  useEffect(() => flush, [flush]);

  return (
    <div className={cn("overflow-hidden rounded-lg border", compact ? "h-[420px]" : "h-[min(640px,70vh)] min-h-[440px]")} data-testid="track-editor">
      <EditorWorkbench ref={inner} initialCode={initialCode} initialBlocks={initialBlocks} assemblyMode={assemblyMode} fake={fake} hideSave onProgram={onChange} onRunEnd={onRunEnd} />
    </div>
  );
}
