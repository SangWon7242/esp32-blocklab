import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  CheckCircle2, ClipboardCopy, Eye, EyeOff, Lock, MonitorSmartphone, MousePointerClick, Palette, ShieldCheck, Upload, Usb, Unplug, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  APP_DESIGN_BOXES, appCheckOptions, appCheckPassed, checkAppStep, fillPrompt, gradeAppReadCheck, stripCodeFence, utf8Bytes,
  type AppDesignKey, type AppInput,
} from "@/track/appCheck";
import type { AppReadQuestion } from "@/track/schema";
import { readSettings } from "../../settings/settings";
import { GuideInline } from "../GuideBody";
import { useAppBoard } from "./appUpload";
import type { StepProps } from "./types";
import { useStepInput } from "./useStepInput";

const BOX_ICON: Record<AppDesignKey, typeof Eye> = { show: Eye, buttons: MousePointerClick, changes: Palette };

/** 섹션 머리: 번호 + 제목 (+ 설명) */
function Head({ n, title, help }: { n: number; title: string; help?: string }) {
  return (
    <div>
      <h3 className="font-semibold">{n}. {title}</h3>
      {help && <p className="mt-1 text-sm text-muted-foreground">{help}</p>}
    </div>
  );
}

/** 잠긴 자리: 앞 칸을 마치면 열린다 */
function Locked({ text, testId }: { text: string; testId: string }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid={testId}>
      <Lock className="size-5" />
      {text}
    </div>
  );
}

/**
 * 앱 만들기(AI 바이브 코딩): ① 화면 설계 세 칸 → ② 약속표 → ③ 프롬프트 복사 → ④ AI 결과 붙여넣기·검사
 * → ⑤ 보드에 index.html 저장(선택)·미리 보기 → ⑥ 읽기 체크. 검사와 읽기 체크를 통과하면 완료할 수 있다.
 */
export function AppStep({ step, input, onInput, teacherMode, attempts }: StepProps<"app">) {
  const a = input as AppInput;
  const update = useStepInput<AppInput>(input, onInput);
  const design = a.design ?? {};
  const html = a.html ?? "";
  const prompt = useMemo(() => fillPrompt(step.promptTemplate, step.api, design), [step.promptTemplate, step.api, design]);
  const opts = useMemo(() => appCheckOptions(step), [step]);
  const checked = typeof a.checkedHtml === "string" && a.checkedHtml === html && html.trim() !== "";
  const checks = useMemo(() => (checked ? checkAppStep(step, html) : null), [checked, step, html]);
  const passed = appCheckPassed(step, a);
  const bytes = utf8Bytes(stripCodeFence(html));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.text);
      toast.success("프롬프트를 복사했어요. AI 에 붙여 넣으세요", { id: "app-prompt-copied" });
    } catch {
      toast.error("복사하지 못했어요. 글을 직접 골라 복사해 주세요", { id: "app-prompt-copied" });
    }
  };

  const missingLabels = prompt.missing.map((k) => APP_DESIGN_BOXES.find((b) => b.key === k)!.label);

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* ① 화면 설계 */}
      <section className="space-y-3 rounded-lg border p-4" data-testid="app-design">
        <Head n={1} title="화면 설계" help="폰 화면에 무엇이 있을지 먼저 정해요. 한 줄에 하나씩 쓰세요." />
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
          {APP_DESIGN_BOXES.map((b) => {
            const Icon = BOX_ICON[b.key];
            const examples = step.design[b.key];
            return (
              <div key={b.key} className="flex flex-col gap-2">
                <Label htmlFor={`app-${b.key}`} className="flex items-center gap-2"><Icon className="size-4 text-primary" />{b.label}</Label>
                <Textarea
                  id={`app-${b.key}`}
                  value={design[b.key] ?? ""}
                  onChange={(e) => update((cur) => ({ design: { ...cur.design, [b.key]: e.target.value } }))}
                  placeholder={examples.length ? `예:\n${examples.join("\n")}` : b.help}
                  className="min-h-28 resize-y"
                />
                <p className="text-xs text-muted-foreground">{b.help}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ② 약속표 */}
      <section className="space-y-3 rounded-lg border p-4" data-testid="app-api">
        <Head n={2} title="약속표" help="ESP32 코드가 내는 주소예요. 앱은 이 주소로만 보드와 이야기해요." />
        <ul className="divide-y rounded-md border">
          {step.api.map((api, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">{api.path}</code>
              <Badge variant={api.method === "읽기" ? "secondary" : "outline"}>{api.method}</Badge>
              {api.fields?.length ? <span className="text-muted-foreground">값: {api.fields.join(", ")}</span> : null}
              {api.note && <span className="min-w-0 basis-full @md:basis-auto">{api.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      {/* ③ 프롬프트 */}
      <section className="space-y-3 rounded-lg border p-4" data-testid="app-prompt">
        <Head n={3} title="프롬프트" help="설계와 약속표로 채운 부탁 글이에요. 복사해서 쓰는 AI(ChatGPT, Claude 등)에 붙여 넣으세요." />
        <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words" data-testid="app-prompt-text">{prompt.text}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={copy} disabled={prompt.missing.length > 0}><ClipboardCopy className="size-4" />복사</Button>
          {prompt.missing.length > 0 && (
            <span className="text-sm text-muted-foreground">{missingLabels.join(", ")} 칸을 채우면 복사할 수 있어요</span>
          )}
        </div>
      </section>

      {/* ④ 붙여넣기 · 검사 */}
      <section className="space-y-3 rounded-lg border p-4" data-testid="app-paste">
        <Head n={4} title="결과 붙여넣기 · 검사" help="AI 가 만든 HTML 을 처음부터 끝까지 붙여 넣고 검사를 누르세요." />
        <Textarea
          aria-label="AI 가 만든 HTML"
          value={html}
          onChange={(e) => update(() => ({ html: e.target.value }))}
          placeholder="<!DOCTYPE html> …"
          spellCheck={false}
          className="min-h-48 resize-y font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => update(() => ({ checkedHtml: html }), { attempt: true })} disabled={!html.trim() || checked}>
            <ShieldCheck className="size-4" />검사
          </Button>
          <span className={cn("text-xs", bytes > opts.maxBytes ? "text-destructive" : "text-muted-foreground")}>{bytes} / {opts.maxBytes} 바이트</span>
          {!checked && a.checkedHtml && html.trim() && <span className="text-sm text-muted-foreground">글이 바뀌었어요. 다시 검사하세요</span>}
          {attempts > 0 && <span className="text-xs text-muted-foreground">시도 {attempts}번</span>}
        </div>
        {checks && (
          <ul className="space-y-2" data-testid="app-check">
            {checks.map((c) => (
              <li key={c.id} className="text-sm" data-pass={c.pass}>
                <div className={cn("flex items-start gap-2", c.pass ? "text-primary" : "text-destructive")}>
                  {c.pass ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-label="통과" /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-label="실패" />}
                  <GuideInline text={c.label} />
                </div>
                {c.fail && <p className="mt-1 pl-6 text-muted-foreground"><GuideInline text={c.fail} /></p>}
              </li>
            ))}
          </ul>
        )}
        {passed && <p className="flex items-center gap-1 text-sm text-primary" role="status"><CheckCircle2 className="size-4" />검사를 모두 통과했어요</p>}
      </section>

      {/* ⑤ 보드 저장 · 미리 보기 */}
      {passed ? <BoardAndPreview html={stripCodeFence(html)} saved={a.savedHtml === html} onSaved={() => update(() => ({ savedHtml: html }))} /> : (
        <Locked testId="app-board-locked" text="검사를 통과하면 보드 저장과 미리 보기가 열려요" />
      )}

      {/* ⑥ 읽기 체크 */}
      {passed ? <AppReadCheck questions={step.readcheck} input={a} update={update} teacherMode={teacherMode} /> : (
        <Locked testId="app-readcheck-locked" text="검사를 통과하면 읽기 체크가 열려요" />
      )}
    </div>
  );
}

/** ⑤ 보드에 index.html 저장(보드 연결 필요, 선택) + 미리 보기(sandbox — 스크립트·요청 없이 모양만) */
function BoardAndPreview({ html, saved, onSaved }: { html: string; saved: boolean; onSaved(): void }) {
  const [searchParams] = useSearchParams();
  const fake = searchParams.get("device") === "fake" || readSettings().fakeBoard;
  const board = useAppBoard(fake);
  const [preview, setPreview] = useState(false);
  const linked = board.status !== "disconnected" && board.status !== "connecting";

  const connect = async () => {
    const err = await board.connect();
    if (err) toast.error(err);
  };
  const save = async () => {
    const err = await board.save(html);
    if (err) toast.error(err);
    else {
      toast.success("보드에 index.html 을 저장했어요");
      onSaved();
    }
  };

  return (
    <section className="space-y-4 rounded-lg border p-4" data-testid="app-board">
      <Head n={5} title="보드에 저장 · 미리 보기" help="보드에 저장하면 폰에서 보드 주소를 열었을 때 내 앱이 떠요. 보드가 없어도 읽기 체크를 마치면 완료할 수 있어요." />
      <div className="flex flex-wrap items-center gap-2">
        {linked ? (
          <Button variant="outline" onClick={() => void board.disconnect()} disabled={board.saving}><Unplug className="size-4" />연결 끊기</Button>
        ) : (
          <Button variant="outline" onClick={() => void connect()} disabled={board.status === "connecting"}><Usb className="size-4" />보드 연결</Button>
        )}
        <Button onClick={() => void save()} disabled={!board.connected}><Upload className="size-4" />보드에 index.html 저장</Button>
        <Button variant="secondary" onClick={() => setPreview((p) => !p)} aria-expanded={preview}>
          {preview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{preview ? "미리 보기 닫기" : "미리 보기"}
        </Button>
      </div>
      <div className="text-sm" role="status" data-testid="app-board-status">
        {board.saving ? (
          <span className="text-muted-foreground">{board.log[board.log.length - 1] ?? "저장하는 중…"}</span>
        ) : saved ? (
          <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="size-4" />보드에 저장했어요. 폰에서 보드 주소를 열어 보세요</span>
        ) : linked ? (
          <span className="text-muted-foreground">보드가 연결됐어요. 저장을 누르세요</span>
        ) : (
          <span className="text-muted-foreground">보드를 연결하면 저장할 수 있어요</span>
        )}
      </div>
      {preview && (
        <div className="space-y-2">
          <p className="flex items-start gap-1 text-xs text-muted-foreground"><MonitorSmartphone className="size-4 shrink-0" />미리 보기는 모양만 보여 줘요. 값 읽기와 버튼은 보드에 저장한 뒤 폰에서 확인하세요.</p>
          {/* sandbox="" : 스크립트·폼·요청을 모두 막는다 (붙여 넣은 HTML 이 이 사이트에서 돌지 않게) */}
          <iframe
            title="앱 미리 보기"
            sandbox=""
            srcDoc={html}
            className="h-[560px] w-full max-w-[400px] rounded-lg border bg-white"
            data-testid="app-preview"
          />
        </div>
      )}
    </section>
  );
}

type ReadCheckProps = {
  questions: readonly AppReadQuestion[];
  input: AppInput;
  update: ReturnType<typeof useStepInput<AppInput>>;
  teacherMode: boolean;
};

/** ⑥ 결과 HTML 읽기 체크: choice 는 채점, text 는 쓰면 통과 (선생님이 확인) */
function AppReadCheck({ questions, input, update, teacherMode }: ReadCheckProps) {
  const answers = input.answers ?? [];
  const results = input.results ?? [];
  const setAnswer = (i: number, text: string) =>
    update((cur) => {
      const nextAnswers = [...(cur.answers ?? [])];
      nextAnswers[i] = text;
      const nextResults = [...(cur.results ?? [])];
      nextResults[i] = null; // 답을 바꾸면 그 문항은 다시 확인해야 한다
      return { answers: nextAnswers, results: nextResults };
    });
  const allAnswered = questions.every((_, i) => (answers[i] ?? "").trim() !== "");
  const allRight = questions.every((_, i) => results[i] === true);
  const check = () => update(() => ({ results: gradeAppReadCheck(questions, answers) }), { attempt: true });

  return (
    <section className="space-y-3 rounded-lg border p-4" data-testid="app-readcheck">
      <Head n={6} title="읽기 체크" help="붙여 넣은 HTML 을 읽고 답하세요. AI 가 만든 코드도 내가 설명할 수 있어야 해요." />
      <ol className="space-y-3">
        {questions.map((q, i) => {
          const id = `app-rq-${i}`;
          const result = results[i];
          return (
            <li
              key={i}
              className={cn("space-y-2 rounded-xl border bg-card p-4", result === true && "border-primary/50", result === false && "border-destructive/50")}
              data-testid={`app-readcheck-q-${i}`}
            >
              <Label htmlFor={q.kind === "text" ? id : undefined} className="leading-snug">{i + 1}. {q.q}</Label>
              {q.kind === "choice" ? (
                <RadioGroup value={answers[i] ?? ""} onValueChange={(v) => setAnswer(i, v)} aria-label={q.q}>
                  {q.options.map((opt, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <RadioGroupItem value={String(k)} id={`${id}-${k}`} />
                      <Label htmlFor={`${id}-${k}`} className="font-mono font-normal">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea id={id} value={answers[i] ?? ""} onChange={(e) => setAnswer(i, e.target.value)} placeholder="내 말로 써 보세요" className="min-h-20 resize-y" />
              )}
              {result === true && (
                <p className="flex items-center gap-1 text-sm text-primary">
                  <CheckCircle2 className="size-4" />{q.kind === "text" ? "적었어요. 선생님과 함께 확인해요" : "맞았어요"}
                </p>
              )}
              {result === false && (
                <div className="text-sm text-destructive" role="status">
                  <p className="flex items-center gap-1"><XCircle className="size-4" />다시 생각해 보세요</p>
                  {q.hint && <p className="mt-1 text-muted-foreground">힌트: {q.hint}</p>}
                </div>
              )}
              {teacherMode && q.kind === "choice" && <p className="text-xs text-muted-foreground">정답(교사 모드): {q.options[q.answer]}</p>}
              {teacherMode && q.kind === "text" && <p className="text-xs text-muted-foreground">교사 확인 문항(채점하지 않음)</p>}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={check} disabled={allRight || !allAnswered}>확인</Button>
        {allRight ? (
          <span className="text-sm text-primary">모두 마쳤어요. 완료를 누르세요.</span>
        ) : !allAnswered ? (
          <span className="text-sm text-muted-foreground">모든 문항에 답하면 확인할 수 있어요</span>
        ) : null}
      </div>
    </section>
  );
}
