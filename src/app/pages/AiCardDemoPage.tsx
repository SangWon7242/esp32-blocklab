import { useState } from "react";
import { useSearchParams } from "react-router";
import { CircleAlert, CircleCheck, Code, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiCardStarterCode } from "@/aicard/cards";
import { AiCardEditor } from "@/lib/views";
import { cn } from "@/lib/utils";

/*
 * 체험판 확인용 숨은 화면 `#/ai-card-demo` (lib-v1.7.0). 메뉴에는 없다. `?level=full` 이면 전체 툴박스로 연다.
 * 허브 행사 화면(메이커 데이 색깔 카드 AI 의 코딩 단계)이 쓰는 꼴 그대로: 편집기는 부모 크기를 꽉 채우고, 코드·ok 를 알려 준다.
 */

/** 네 색 예제 (빨강·노랑·초록·파랑) */
const FOUR_COLOUR_CODE = [
  "def on_card(card):",
  '    if card == "red":',
  "        set_color(255, 0, 0)",
  '    elif card == "yellow":',
  "        set_color(255, 255, 0)",
  '    elif card == "green":',
  "        set_color(0, 255, 0)",
  '    elif card == "blue":',
  "        set_color(0, 0, 255)",
  "",
].join("\n");

type Level = "basic" | "full";

export function AiCardDemoPage() {
  const [params, setParams] = useSearchParams();
  const level: Level = params.get("level") === "full" ? "full" : "basic";
  const [showCode, setShowCode] = useState(true);
  const [program, setProgram] = useState({ key: 0, code: FOUR_COLOUR_CODE });
  const [state, setState] = useState<{ code: string; ok: boolean }>({ code: "", ok: false });
  const setLevel = (next: Level) => setParams((p) => { p.set("level", next); return p; }, { replace: true });
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
        <div role="radiogroup" aria-label="블록 꾸러미" className="flex rounded-md border p-0.5">
          {(["basic", "full"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              className={cn("rounded px-3 py-1 text-sm font-medium", level === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              data-testid={`aicard-level-${l}`}
            >
              {l === "basic" ? "기본 블록" : "전체 블록"}
            </button>
          ))}
        </div>
        <Button type="button" variant={showCode ? "secondary" : "outline"} size="sm" aria-pressed={showCode} onClick={() => setShowCode((v) => !v)}>
          <Code className="size-4" />코드 보기
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setProgram((p) => ({ key: p.key + 1, code: FOUR_COLOUR_CODE }))}>
          <RotateCcw className="size-4" />네 색 예제
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setProgram((p) => ({ key: p.key + 1, code: aiCardStarterCode() }))}>
          <RotateCcw className="size-4" />시작 코드
        </Button>
        <span className={cn("ml-auto flex items-center gap-1.5 text-sm font-medium", state.ok ? "text-emerald-700" : "text-red-700")} data-testid="aicard-demo-ok" data-ok={state.ok ? "yes" : "no"}>
          {state.ok ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
          onChange ok = {String(state.ok)}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <AiCardEditor
          key={program.key}
          initialCode={program.code}
          toolboxLevel={level}
          showCode={showCode}
          onChange={(code, ok) => setState({ code, ok })}
        />
      </div>
    </div>
  );
}
