import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssemblyStage, type AssemblyCue, type Scene3D } from "@/lib/views";

/*
 * 체험판 확인용 숨은 화면 `#/assembly-demo` (lib-v1.6.0). 메뉴에는 없다.
 * 허브 행사 화면(메이커 데이 「색깔 카드 AI 불빛」)이 쓰는 꼴 그대로: 차례 · 다시 보기는 이 화면이 쥐고, 무대는 움직임만 그린다.
 * 장면은 scripts/wiring/chapters/maker-color-ai.mjs 의 DevKit 판 4단계(선 넷)를 그대로 옮겨 둔 것.
 */

const scenes = import.meta.glob<Scene3D>("./demo/*.3d.json", { import: "default", eager: true });
const scene = scenes["./demo/maker-color-ai.3d.json"];

export const DEMO_STEPS: AssemblyCue[] = [
  { kind: "place", board: 0 },
  { kind: "place", part: 0 },
  { kind: "wire", wire: 0 },
  { kind: "wire", wire: 1 },
  { kind: "wire", wire: 2 },
  { kind: "wire", wire: 3 },
  { kind: "all" },
];

const TITLES = ["보드를 놓아요", "RGB LED 모듈을 놓아요", "빨간 선: R → D27", "초록 선: G → D25", "파란 선: B → D26", "검은 선: − → GND", "다 꽂았어요"];

export function AssemblyDemoPage() {
  const [step, setStep] = useState(0);
  const [replay, setReplay] = useState(0);
  const [ended, setEnded] = useState<string>("");
  const key = `${step}:${replay}`;
  const go = (n: number) => setStep(Math.max(0, Math.min(DEMO_STEPS.length - 1, n)));
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <AssemblyStage scene={scene} steps={DEMO_STEPS} step={step} replayKey={replay} onMotionEnd={() => setEnded(key)} />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t bg-background px-3 py-2">
        <Button type="button" variant="outline" size="sm" disabled={step === 0} onClick={() => go(step - 1)} data-testid="asm-prev"><ChevronLeft className="size-4" />이전</Button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold" data-testid="asm-title">
          <span className="mr-2 tabular-nums text-muted-foreground">{step + 1} / {DEMO_STEPS.length}</span>{TITLES[step]}
        </p>
        <span className="text-xs text-muted-foreground" data-testid="asm-ended" data-ended={ended === key ? "yes" : "no"}>{ended === key ? "움직임 끝" : "움직이는 중"}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setReplay((n) => n + 1)} data-testid="asm-replay"><RotateCcw className="size-4" />다시 보기</Button>
        <Button type="button" size="sm" disabled={step === DEMO_STEPS.length - 1} onClick={() => go(step + 1)} data-testid="asm-next">다음<ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}
