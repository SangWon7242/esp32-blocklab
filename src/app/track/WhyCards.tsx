import { ChevronDown, CircleHelp, TriangleAlert } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { whyCards } from "@/track/why";
import { GuideBody } from "./GuideBody";

/** 「왜 그럴까?」: 질문과 한 줄 답은 늘 보이고, 누르면 비유로 푼 설명이 펼쳐진다 */
export function WhyCards({ ids }: { ids: readonly string[] | undefined }) {
  const cards = whyCards(ids);
  if (!cards.length) return null;
  return (
    <section className="rounded-xl border bg-card p-4" data-testid="chapter-why">
      <h2 className="flex items-center gap-2 text-md font-semibold">
        <CircleHelp className="size-4 text-primary" />왜 그럴까?
      </h2>
      <ul className="mt-3 grid gap-2">
        {cards.map((card) => (
          <li key={card.id}>
            <Collapsible className="rounded-lg border bg-background" data-testid={`why-${card.id}`}>
              <CollapsibleTrigger className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-keep">{card.question}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground break-keep">{card.short}</span>
                </span>
                <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 px-3 pt-1 pb-3">
                <GuideBody text={card.body} />
                <p className="flex max-w-measure items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm leading-relaxed break-keep">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span><b className="font-semibold">이렇게 안 하면?</b> {card.without}</span>
                </p>
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}
      </ul>
    </section>
  );
}
