import { useState } from "react";
import { Eye, Highlighter, MessageSquareDiff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoachEditorView, type CoachProgram, type CoachProposal, type CoachRunEvent } from "@/lib/views";

/*
 * 체험판 확인용 숨은 화면 `#/coach-editor-demo` (lib-v1.1.0). 메뉴에는 없다. e2e 가 CoachEditorView 의 콜백·제안 상자·강조를 본다.
 * 허브가 쓰는 꼴 그대로: 부모가 높이를 주고(h-full 사슬, 체험판은 h-screen 아래 main) 그 안에서 편집기가 나머지를 채운다.
 */

export const DEMO_INITIAL_CODE = `from machine import Pin
import time

led = Pin(26, Pin.OUT)
print("start")
led.value(1)
`;

const PROPOSALS: Record<string, CoachProposal> = {
  p1: {
    id: "p1",
    code: `from machine import Pin
import time

led = Pin(26, Pin.OUT)
print("start")
# [F1] 불 켜기
led.value(1)
print("done")
`,
    note: "불을 켠 다음 끝났다는 글을 보여 주면 확인하기 쉬워요",
  },
  p2: { id: "p2", code: "if x\n    print(1)\n", note: "문법 오류가 있는 제안 (블록으로 바뀌지 않아 코드 모드로 열려요)" },
};

type Decision = { id: string; accepted: boolean; program: CoachProgram };

export function CoachEditorDemoPage() {
  const [proposal, setProposal] = useState<CoachProposal | null>(null);
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [lastProgram, setLastProgram] = useState<CoachProgram | null>(null);
  const [programCount, setProgramCount] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [run, setRun] = useState<CoachRunEvent | null>(null);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
        <span className="font-medium">코치 편집기 확인</span>
        <Button size="sm" variant="outline" onClick={() => setProposal(PROPOSALS.p1)} data-testid="demo-proposal-1">
          <MessageSquareDiff className="size-4" />제안 1
        </Button>
        <Button size="sm" variant="outline" onClick={() => setProposal(PROPOSALS.p2)} data-testid="demo-proposal-2">
          <MessageSquareDiff className="size-4" />제안 2
        </Button>
        <Button size="sm" variant="outline" onClick={() => setHighlight({ start: 4, end: 5 })} data-testid="demo-highlight">
          <Highlighter className="size-4" />4~5줄 강조
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHighlight(null)} data-testid="demo-highlight-clear">
          <X className="size-4" />강조 지우기
        </Button>
        <Button size="sm" variant={readOnly ? "secondary" : "ghost"} onClick={() => setReadOnly((v) => !v)} data-testid="demo-readonly" aria-pressed={readOnly}>
          <Eye className="size-4" />보기만
        </Button>
      </div>
      <dl className="grid shrink-0 grid-cols-1 gap-x-4 gap-y-1 border-b px-3 py-2 text-xs md:grid-cols-3">
        <div className="min-w-0">
          <dt className="font-medium">프로그램 변경 <span data-testid="demo-program-count">{programCount}</span>번</dt>
          <dd className="truncate font-mono" data-testid="demo-program" title={lastProgram?.code}>
            {lastProgram ? `${lastProgram.parseError ? "문법 오류 · " : ""}${lastProgram.blocksJson ? "블록 있음 · " : "블록 없음 · "}${JSON.stringify(lastProgram.code)}` : "아직 없음"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-medium">제안 결정</dt>
          <dd className="truncate font-mono" data-testid="demo-decision">
            {decision ? `${decision.id} ${decision.accepted ? "적용" : "닫기"} · ${JSON.stringify(decision.program.code)}` : "아직 없음"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-medium">실행 끝</dt>
          <dd className="truncate font-mono" data-testid="demo-run">
            {run ? `${run.source} · ${run.ok ? "성공" : "실패"}${run.error ? ` · ${run.error.line ?? "-"}줄 ${run.error.message}` : ""} · ${JSON.stringify(run.output)}` : "아직 없음"}
          </dd>
        </div>
      </dl>
      <div className="min-h-0 flex-1">
        <CoachEditorView
          initialProgram={{ code: DEMO_INITIAL_CODE }}
          onProgramChange={(p) => {
            setLastProgram(p);
            setProgramCount((n) => n + 1);
          }}
          proposal={proposal}
          onProposalDecision={(id, accepted, program) => setDecision({ id, accepted, program })}
          onRunEnd={setRun}
          highlightLines={highlight}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
