import { BookOpen, FileCode2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BlockDocBody, CategoryBadge, titleText } from "@/app/docs/BlockDocCard";
import { BlockImage } from "@/app/docs/BlockImage";
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
            {doc && <CategoryBadge doc={doc} />}
            {/* 제목 글은 화면 읽기용(보이지 않음), 보이는 제목은 우클릭한 블록을 지금 값 그대로 그린 그림 (아래 코드와 같은 값) */}
            <DialogTitle className="sr-only">{doc ? titleText(request.title) : "블록 설명"}</DialogTitle>
            <BlockImage state={request.state} />
            <DialogDescription className="sr-only">이 블록이 만드는 코드와 뜻, 예시 프로그램</DialogDescription>
          </DialogHeader>

          <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            <BlockDocBody
              code={request.code}
              codeTitle={request.fromFlyout ? "이 블록이 만드는 코드" : "내 블록이 만드는 코드"}
              doc={doc}
              headingLevel={3}
            />
          </div>

          <DialogFooter className="flex-wrap">
            {doc && (
              // 새 탭으로: 같은 창에서 옮기면 자유 코딩 작업판이 사라지고 보드 연결이 끊긴다
              <Button variant="outline" asChild>
                <a href={`#/docs?block=${encodeURIComponent(request.type)}`} target="_blank" rel="noopener">
                  <BookOpen className="size-4" />블록 사전에서 보기
                </a>
              </Button>
            )}
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
