import { Link } from "react-router";
import { Blocks, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoadedChapter } from "@/track/content";
import type { Step } from "@/track/schema";

type EditorStep = Extract<Step, { type: "run" | "mission" | "debug" | "design" }>;

/** 편집기에 깔 코드 파일 (디버깅은 고장 코드 조각만 있어 파일이 없다) */
function codeFile(step: EditorStep): string | undefined {
  switch (step.type) {
    case "run": return step.code;
    case "mission": return step.code;
    case "design": return step.targetCode;
    case "debug": return undefined;
  }
}

const labLink = (chapter: LoadedChapter, file: string) => `/lab?code=${chapter.id}/${file}`;

/** 편집기 단계(실행·미션·디버깅·설계)는 계획 3B 에서 연다. 지금은 안내 + 자유 코딩 연결 + 건너뛰기 */
export function EditorStepPlaceholder({ step, chapter, teacherMode }: { step: EditorStep; chapter: LoadedChapter; teacherMode: boolean }) {
  const file = codeFile(step);
  const answerCode = step.type === "mission" || step.type === "debug" ? step.answerCode : undefined;
  return (
    <div className="space-y-5">
      {step.type === "mission" && (
        <section className="rounded-lg border p-4">
          <h3 className="font-semibold">미션</h3>
          <p className="mt-1">{step.instructions}</p>
          {step.hint && <p className="mt-2 text-sm text-muted-foreground">힌트: {step.hint}</p>}
        </section>
      )}
      {step.type === "debug" && (
        <section className="space-y-3">
          {step.symptoms.map((s, i) => (
            <div key={i} className="rounded-lg border p-4">
              <h3 className="font-semibold">증상 {i + 1}. {s.title}</h3>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">{s.code}</pre>
              <p className="mt-2 text-sm">{s.question}</p>
            </div>
          ))}
        </section>
      )}
      {step.type === "design" && (
        <section className="rounded-lg border p-4">
          <h3 className="font-semibold">우리말 순서</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {step.pseudocode.map((p, i) => <li key={i}>{p.text}</li>)}
          </ol>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Construction className="size-5" />이 단계는 다음 업데이트에서 열립니다</CardTitle>
          <CardDescription>
            블록·코드 편집기가 들어간 단계는 준비 중이에요. 지금은 자유 코딩 화면에서 같은 코드를 열어 직접 해 볼 수 있어요.
            해 본 뒤 아래 <strong>건너뛰기</strong>를 누르면 다음 단계가 열립니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {file ? (
            <Button asChild>
              <Link to={labLink(chapter, file)}><Blocks className="size-4" />자유 코딩에서 이 코드 열기</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/lab"><Blocks className="size-4" />자유 코딩 열기</Link>
            </Button>
          )}
          {teacherMode && answerCode && (
            <Button asChild variant="outline">
              <Link to={labLink(chapter, answerCode)}>정답 코드 열기 ({answerCode})</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
