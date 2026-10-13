import type { ReactNode } from "react";
import { ChevronDown, FileCode2 } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { BlockDoc, TitlePart } from "@/docs/catalog";

/** 블록 제목: 고정 글과 학생이 바꾸는 칸(칩) */
export function TitleChips({ parts }: { parts: TitlePart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "slot" ? (
          <span key={i} className="rounded-full bg-white/80 px-2 text-sm font-normal text-neutral-900">{p.text || " "}</span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** 블록 모양을 닮은 제목 알약 (카테고리 색 바탕) */
export function TitlePill({ doc, className }: { doc: BlockDoc; className?: string }) {
  return (
    <div
      className={cn("inline-flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-lg px-3 py-1.5 text-base leading-normal font-medium text-white", className)}
      style={{ backgroundColor: doc.category.colour }}
    >
      <TitleChips parts={doc.title} />
    </div>
  );
}

export function CategoryBadge({ doc }: { doc: BlockDoc }) {
  return <Badge className="text-white" style={{ backgroundColor: doc.category.colour }}>{doc.category.name}</Badge>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function CodeBlock({ code }: { code: string }) {
  return <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm whitespace-pre">{code}</pre>;
}

type BodyProps = {
  /** 블록 하나가 만드는 코드 (팝업: 우클릭한 블록, 사전: 툴박스 그대로의 블록) */
  code: string;
  codeTitle: string;
  /** 모르는 블록이면 없음: 코드만 보여 준다 */
  doc: BlockDoc | undefined;
  /** 예시 프로그램을 접어 두고 펼치면 보인다 (사전 카드) */
  collapsibleExample?: boolean;
  /** 예시 코드 아래에 붙는 것 (사전의 "편집기에서 열어 보기") */
  exampleAction?: ReactNode;
};

/** 블록 설명 본문: 만드는 코드·뜻·예시 프로그램·알아 두기. 설명 팝업과 블록 사전 카드가 함께 쓴다 */
export function BlockDocBody({ code, codeTitle, doc, collapsibleExample, exampleAction }: BodyProps) {
  const example = doc && (
    <>
      <p className="font-medium">{doc.example.title}</p>
      <CodeBlock code={doc.example.code} />
      {exampleAction}
    </>
  );
  return (
    <>
      <Section title={codeTitle}>
        {code.trim() ? (
          <CodeBlock code={code} />
        ) : (
          <p className="text-muted-foreground">이 블록만으로는 코드가 생기지 않아요.</p>
        )}
      </Section>
      {doc && (
        <>
          <Section title="무슨 뜻인가요">
            <p className="leading-relaxed">{doc.concept}</p>
          </Section>
          {collapsibleExample ? (
            <Collapsible className="group/example flex flex-col gap-1.5">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]/example:rotate-180" />
                  예시 프로그램
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1.5">{example}</CollapsibleContent>
            </Collapsible>
          ) : (
            <Section title="예시 프로그램">{example}</Section>
          )}
          {doc.tips && doc.tips.length > 0 && (
            <Section title="알아 두기">
              <ul className="list-disc space-y-1 pl-5 leading-relaxed">
                {doc.tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}

/** 블록 사전의 블록 하나 */
export function BlockDocCard({ doc, highlighted }: { doc: BlockDoc; highlighted?: boolean }) {
  return (
    <Card
      data-testid="block-doc-card"
      data-type={doc.type}
      className={cn("transition-shadow duration-500", highlighted && "ring-2 ring-primary")}
    >
      <CardHeader className="flex flex-wrap items-center gap-2">
        <TitlePill doc={doc} />
        <CategoryBadge doc={doc} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <BlockDocBody
          code={doc.code}
          codeTitle="이 블록이 만드는 코드"
          doc={doc}
          collapsibleExample
          exampleAction={
            <Button variant="outline" size="sm" className="w-fit" asChild>
              <Link to={`/lab?example=${encodeURIComponent(doc.type)}`}>
                <FileCode2 className="size-4" />편집기에서 열어 보기
              </Link>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
