import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadChapters } from "@/track/content";
import { allSteps } from "@/track/gating";
import { useProgress } from "./progressState";

/** #/track — 챕터 카드 목록 */
export function TrackPage() {
  const progress = useProgress();
  const chapters = loadChapters();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <h1 className="text-2xl font-bold">트랙</h1>
        <p className="mt-2 text-muted-foreground">챕터를 골라 단계를 차례대로 풀어 갑니다. 앞 단계를 끝내야 다음 단계가 열려요.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {chapters.map((ch) => {
            const steps = allSteps(ch);
            const records = progress?.chapters[ch.id] ?? {};
            const done = steps.filter((s) => records[s.id]?.status === "done").length;
            return (
              <Card key={ch.id} data-testid={`chapter-card-${ch.id}`}>
                <CardHeader>
                  <CardDescription>챕터 {ch.order}</CardDescription>
                  <CardTitle>{ch.title}</CardTitle>
                  {ch.subtitle && <CardDescription>{ch.subtitle}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Progress value={(done / steps.length) * 100} className="h-2" aria-label="진행률" />
                    <span className="shrink-0">{done} / {steps.length}</span>
                  </div>
                  <Button asChild>
                    <Link to={`/track/${ch.id}`}>{done > 0 ? "이어서 하기" : "시작하기"} <ArrowRight className="size-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
