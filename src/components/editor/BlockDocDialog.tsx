import { BookOpen, FileCode2, X } from "lucide-react";
import { Link } from "react-router";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BlockDocBody, CategoryBadge, TitleChips } from "@/app/docs/BlockDocCard";
import type { BlockDoc } from "@/docs/catalog";
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
              {doc && <CategoryBadge doc={doc} />}
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
            <BlockDocBody code={request.code} codeTitle="내 블록이 만드는 코드" doc={doc} />
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
