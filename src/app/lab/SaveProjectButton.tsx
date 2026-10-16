import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, FolderPlus, LoaderCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHost } from "@/host/HostContext";
import { checkProjectTitle, fitTitle, PROJECT_TITLE_MAX, runSaveProject, SAVE_PROJECT_TEXT, tidyTitle, titleLength, type SaveProjectStatus } from "./saveProject";

/*
 * 「작품으로 저장」 단추와 제목 대화상자 (lib-v1.0.3). 자유 코딩(LabPage)과 트랙 편집기 단계(TrackEditor)가 함께 쓴다.
 * 호스트가 onSaveProject 를 주지 않으면(체험판) 없고, 열람(review) 모드에서도 없다.
 * 토스트는 호스트가 띄운다(허브: sonner). 라이브러리는 대화상자 안 실패 문구(role=alert)와 단추 옆 확인 문구(role=status)만.
 */

/** 저장 성공 문구를 단추 옆에 두는 시간 */
export const SAVED_NOTE_MS = 4000;

type FormProps = {
  title: string;
  status: SaveProjectStatus;
  /** 제목 검사에 걸린 까닭 (저장을 누른 뒤에만) */
  invalid: "empty" | "long" | null;
  onTitleChange(title: string): void;
  onSubmit(): void;
  onCancel(): void;
};

/** 대화상자 속 (제목 칸·실패 문구·단추). 상태는 밖에서 받는다 — 테스트가 그대로 그릴 수 있게 */
export function SaveProjectForm({ title, status, invalid, onTitleChange, onSubmit, onCancel }: FormProps) {
  const id = useId();
  const saving = status === "saving";
  const count = titleLength(tidyTitle(title));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saving) onSubmit();
  };
  return (
    <form className="grid gap-4" onSubmit={submit} data-testid="save-project-form" data-status={status}>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${id}-title`}>{SAVE_PROJECT_TEXT.label}</Label>
          <span className="text-xs text-muted-foreground tabular-nums" aria-hidden="true">{count}/{PROJECT_TITLE_MAX}</span>
        </div>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={saving}
          autoComplete="off"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-hint` : undefined}
        />
        {invalid && (
          <p id={`${id}-hint`} className="text-sm text-destructive">
            {invalid === "empty" ? SAVE_PROJECT_TEXT.emptyTitle : SAVE_PROJECT_TEXT.longTitle}
          </p>
        )}
      </div>
      {status === "failed" && (
        <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
          <XCircle className="mt-0.5 size-4 shrink-0" />{SAVE_PROJECT_TEXT.failed}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>{SAVE_PROJECT_TEXT.cancel}</Button>
        <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
          {saving ? SAVE_PROJECT_TEXT.saving : SAVE_PROJECT_TEXT.save}
        </Button>
      </DialogFooter>
    </form>
  );
}

type Props = {
  /** 저장을 누른 순간의 프로그램 (편집기 핸들의 getProgram — debounce 중인 코드까지) */
  getProgram(): { code: string; blocksJson: unknown };
  /** 대화상자에 미리 채울 제목. 한 번 저장한 뒤로는 그 제목을 다시 채운다 */
  defaultTitle: string;
  /** 트랙 단계에서 저장하면 그 챕터 id (호스트가 출처를 챕터로 남긴다) */
  chapterId?: string;
};

/** 「작품으로 저장」 단추. 호스트 onSaveProject 가 있고 열람 모드가 아닐 때만 보인다 */
export function SaveProjectButton({ getProgram, defaultTitle, chapterId }: Props) {
  const { onSaveProject, mode } = useHost();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SaveProjectStatus>("idle");
  const [invalid, setInvalid] = useState<"empty" | "long" | null>(null);
  /** 마지막으로 저장한 제목 (같은 작품을 계속 저장할 때 다시 묻지 않아도 되게) */
  const [lastTitle, setLastTitle] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  if (!onSaveProject || mode === "review") return null;
  const saving = status === "saving";

  const openDialog = () => {
    if (saving) return;
    window.clearTimeout(noteTimer.current);
    setTitle(lastTitle ?? fitTitle(defaultTitle));
    setInvalid(null);
    setStatus("idle");
    setOpen(true);
  };

  const submit = async () => {
    const checked = checkProjectTitle(title);
    if (!checked.ok) {
      setInvalid(checked.reason);
      return;
    }
    setInvalid(null);
    setStatus("saving");
    const program = getProgram();
    const result = await runSaveProject(onSaveProject, { title: checked.title, code: program.code, blocksJson: program.blocksJson, chapterId });
    setStatus(result);
    if (result === "saved") {
      setLastTitle(checked.title);
      setOpen(false);
      noteTimer.current = window.setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), SAVED_NOTE_MS);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status === "saved" && !open && (
        <span className="hidden items-center gap-1 text-xs text-primary sm:inline-flex" role="status" data-testid="save-project-saved">
          <CheckCircle2 className="size-3.5" />{SAVE_PROJECT_TEXT.saved}
        </span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={SAVE_PROJECT_TEXT.button}
            disabled={saving}
            aria-busy={saving || undefined}
            onClick={openDialog}
            data-testid="save-project-button"
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
            <span className="hidden md:inline">{SAVE_PROJECT_TEXT.button}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{SAVE_PROJECT_TEXT.tip}</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>{SAVE_PROJECT_TEXT.dialogTitle}</DialogTitle>
            <DialogDescription>{SAVE_PROJECT_TEXT.dialogDescription}</DialogDescription>
          </DialogHeader>
          <SaveProjectForm
            title={title}
            status={status}
            invalid={invalid}
            onTitleChange={(t) => {
              setTitle(t);
              if (invalid) setInvalid(null);
            }}
            onSubmit={() => void submit()}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
