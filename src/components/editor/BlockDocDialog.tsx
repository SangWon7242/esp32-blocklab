import type { ReactNode } from "react";
import { BookOpen, FileCode2, X } from "lucide-react";
import { Link } from "react-router";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { BlockDoc, TitlePart } from "@/docs/catalog";
import type { BlockDocRequest } from "./blockDocMenu";

type Props = {
  /** 우클릭한 블록 (null 이면 닫힘) */
  request: BlockDocRequest | null;
  /** 그 블록 종류의 설명 (모르는 블록이면 없음: 코드만 보여 준다) */
  doc: BlockDoc | undefined;
  onClose(): void;
  /** 예시 프로그램을 작업판에 싣는다 (자유 코딩 화면에서만 준다) */
  onOpenExample?: (code: string) => void;
};

/** 블록 제목: 고정 글과 학생이 바꾸는 칸(칩) */
function TitleChips({ parts }: { parts: TitlePart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "slot" ? (
          <span key={i} className="rounded-full bg-white/80 px-2 text-sm font-normal text-neutral-900">{p.text || " "}</span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
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

/** 블록 우클릭 → "이 블록 설명 보기" 팝업: 그 블록이 만드는 코드·뜻·예시 프로그램 */
export function BlockDocDialog({ request, doc, onClose, onOpenExample }: Props) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      {request && (
        <DialogContent
          data-testid="block-doc-dialog"
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-2xl"
        >
          <DialogHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {doc && (
                <Badge className="text-white" style={{ backgroundColor: doc.category.colour }}>{doc.category.name}</Badge>
              )}
            </div>
            <DialogTitle
              className="inline-flex w-fit flex-wrap items-center gap-1.5 rounded-lg px-3 py-1.5 text-base leading-normal font-medium"
              style={doc ? { backgroundColor: doc.category.colour, color: "white" } : undefined}
            >
              {doc ? <TitleChips parts={doc.title} /> : "블록 설명"}
            </DialogTitle>
            <DialogDescription className="sr-only">이 블록이 만드는 코드와 뜻, 예시 프로그램</DialogDescription>
          </DialogHeader>

          <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            <Section title="내 블록이 만드는 코드">
              {request.code.trim() ? (
                <CodeBlock code={request.code} />
              ) : (
                <p className="text-muted-foreground">이 블록만으로는 코드가 생기지 않아요.</p>
              )}
            </Section>
            {doc && (
              <>
                <Section title="무슨 뜻인가요">
                  <p className="leading-relaxed">{doc.concept}</p>
                </Section>
                <Section title="예시 프로그램">
                  <p className="font-medium">{doc.example.title}</p>
                  <CodeBlock code={doc.example.code} />
                </Section>
                {doc.tips && doc.tips.length > 0 && (
                  <Section title="알아 두기">
                    <ul className="list-disc space-y-1 pl-5 leading-relaxed">
                      {doc.tips.map((tip) => <li key={tip}>{tip}</li>)}
                    </ul>
                  </Section>
                )}
              </>
            )}
          </div>

          <DialogFooter className="flex-wrap">
            <Button variant="outline" asChild>
              <Link to={`/docs?block=${encodeURIComponent(request.type)}`} onClick={onClose}>
                <BookOpen className="size-4" />블록 사전에서 보기
              </Link>
            </Button>
            {doc && onOpenExample && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline"><FileCode2 className="size-4" />예시를 편집기에 열기</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>지금 작업판을 예시 프로그램으로 바꿀까요?</AlertDialogTitle>
                    <AlertDialogDescription>작업판의 블록과 코드가 "{doc.example.title}" 예시로 바뀌어요. 지금 만든 프로그램은 사라져요.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onOpenExample(doc.example.code)}>바꾸기</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <DialogClose asChild>
              <Button><X className="size-4" />닫기</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
