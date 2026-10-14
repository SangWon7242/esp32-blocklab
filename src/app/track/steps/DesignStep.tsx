import { Fragment, useRef, useState } from "react";
import { canonicalLines } from "../canonical";
import { Link } from "react-router";
import { CheckCircle2, ListChecks, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onEditedProgram, type DesignInput } from "@/track/completion";
import { DESIGN_FAIL, gradeBlanks, scatterStartBody } from "@/track/design";
import { judge } from "@/track/judge";
import { codeToBlocks } from "@/parser";
import { TrackEditor, type EditorProgram, type TrackEditorHandle } from "../TrackEditor";
import { JudgePanel } from "./JudgePanel";
import type { StepProps } from "./types";
import { useStepInput } from "./useStepInput";

/** 조립 작업판의 처음 블록: 기대 코드를 블록으로 바꾼 뒤 시작 블록 몸통을 떼어 흩어 둔다 */
function scatteredBlocks(code: string): EditorProgram["blocksJson"] {
  const r = codeToBlocks(code);
  return r.ok ? scatterStartBody(r.json) : null;
}

/**
 * 설계(Parsons): ① 의사코드 빈칸 → ② 번역표 확인 → ③ 흩어진 블록을 시작 블록에 이어 조립하고 판정.
 * 조립 판정(codeEquals targetCode)을 통과하면 완료할 수 있다.
 */
export function DesignStep({ step, chapter, input, onInput, teacherMode }: StepProps<"design">) {
  const d = input as DesignInput;
  const update = useStepInput<DesignInput>(input, onInput);
  const editor = useRef<TrackEditorHandle>(null);
  const target = chapter.files[step.targetCode] ?? "";
  // 처음 한 번만 흩어 둔다 (다시 그릴 때마다 위치가 바뀌지 않게). 저장한 작업판이 있으면 그것
  const [initialBlocks] = useState(() => (d.program?.blocksJson as EditorProgram["blocksJson"] | undefined) ?? scatteredBlocks(target));

  const blanks = d.blanks ?? [];
  const results = d.blankResults;
  const setBlank = (i: number, text: string) =>
    update((cur) => {
      const next = [...(cur.blanks ?? [])];
      while (next.length <= i) next.push("");
      next[i] = text;
      return { blanks: next };
    });
  const checkBlanks = () => {
    const graded = gradeBlanks(step, blanks);
    update(() => ({ blankResults: graded, blanksDone: graded.every((g) => g !== false) }), { attempt: true });
  };

  const onJudge = () => {
    const program = editor.current?.getProgram();
    if (!program) return;
    const result = judge([{ codeEquals: { file: step.targetCode }, fail: DESIGN_FAIL }], { code: program.code, blocksJson: program.blocksJson , canonical: canonicalLines }, chapter.files);
    update(() => ({ program: { code: program.code, blocksJson: program.blocksJson }, passed: result.pass, failures: result.failures, judgedCode: program.code }), { attempt: true });
  };

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* 넓은 활동 칸에서는 설계도 빈칸과 번역표를 나란히 둔다 */}
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2 @3xl:items-start">
        <section className="rounded-lg border p-4" data-testid="design-blanks">
          <h3 className="font-semibold">1. 우리말 설계도의 빈칸 채우기</h3>
          <ol className="mt-3 space-y-2">
            {step.pseudocode.map((line, i) => {
              const parts = line.text.split("__");
              const r = results?.[i];
              return (
                <li key={i} className="flex flex-wrap items-center gap-1 text-sm">
                  <span className="w-6 text-muted-foreground">{i + 1}</span>
                  {line.blank ? (
                    parts.map((part, j) => (
                      <Fragment key={j}>
                        {part && <span>{part}</span>}
                        {j < parts.length - 1 && (
                          <Input
                            aria-label={`${i + 1}번 줄 빈칸`}
                            className="h-8 w-28"
                            value={blanks[i] ?? ""}
                            disabled={d.blanksDone}
                            placeholder={teacherMode && line.blank?.answer !== undefined ? String(line.blank.answer) : undefined}
                            onChange={(e) => setBlank(i, e.target.value)}
                          />
                        )}
                      </Fragment>
                    ))
                  ) : (
                    <span>{line.text}</span>
                  )}
                  {r === true && <CheckCircle2 className="size-4 text-primary" aria-label="맞음" />}
                  {r === false && <XCircle className="size-4 text-destructive" aria-label="다시 생각해 보기" />}
                </li>
              );
            })}
          </ol>
          {d.blanksDone ? (
            <p className="mt-3 flex items-center gap-1 text-sm text-primary"><CheckCircle2 className="size-4" />빈칸을 모두 채웠어요</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button onClick={checkBlanks}><ListChecks className="size-4" />빈칸 확인</Button>
              {results && results.some((r) => r === false) && <span className="text-sm text-destructive" role="status">표시한 빈칸을 다시 생각해 보세요</span>}
            </div>
          )}
        </section>

        {d.blanksDone && (
          <section className="rounded-lg border p-4" data-testid="design-table">
            <h3 className="font-semibold">2. 우리말을 코드로 바꾸는 번역표</h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">우리말</th>
                  <th className="py-1 font-medium">코드</th>
                </tr>
              </thead>
              <tbody>
                {step.translation.map(([ko, py], i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-1.5 pr-3">{ko}</td>
                    <td className="py-1.5"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{py}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.tableDone ? (
              <p className="mt-3 flex items-center gap-1 text-sm text-primary"><CheckCircle2 className="size-4" />번역표를 확인했어요</p>
            ) : (
              <Button className="mt-3" onClick={() => update(() => ({ tableDone: true }))}><CheckCircle2 className="size-4" />확인했어요</Button>
            )}
          </section>
        )}
      </div>

      {teacherMode && (
        <Button asChild variant="outline" size="sm">
          <Link to={`/lab?code=${chapter.id}/${step.targetCode}`}>정답 코드 열기 ({step.targetCode})</Link>
        </Button>
      )}

      {d.blanksDone && d.tableDone ? (
        <section className="flex flex-1 flex-col gap-4" data-testid="design-assembly">
          <div>
            <h3 className="font-semibold">3. 블록 조립</h3>
            <p className="mt-1 text-sm text-muted-foreground">흩어진 블록을 설계도 순서대로 "프로그램이 시작되면" 블록 안에 이어 붙이고 판정을 누르세요. 회색 블록은 아직 이어지지 않은 블록이에요.</p>
          </div>
          <JudgePanel onJudge={onJudge} failures={d.failures} passed={d.passed} passText="설계도대로 조립했어요. 아래 완료를 누르세요." />
          <TrackEditor
            fill
            ref={editor}
            initialCode=""
            initialBlocks={initialBlocks}
            assemblyMode
            onProgram={(code, blocksJson) => update((cur) => onEditedProgram(cur, { code, blocksJson }))}
          />
        </section>
      ) : (
        // 블록 조립 자리: 앞 칸을 마치면 열린다 (남는 높이를 채워 다음 할 일을 보여 준다)
        <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid="design-assembly-locked">
          <Lock className="size-5" />
          {d.blanksDone ? "번역표를 확인하면 3. 블록 조립이 열려요" : "빈칸을 모두 채우면 2. 번역표, 그다음 3. 블록 조립이 열려요"}
        </div>
      )}
    </div>
  );
}
