import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleCheck, HardDriveDownload, LoaderCircle, RotateCcw, TriangleAlert, Usb, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  FakeFirmwareInstaller, FIRMWARE, FirmwareError, isOlderFirmware, overallPercent, WebSerialFirmwareInstaller,
  type BoardPort, type FirmwareCheck, type FirmwareInstaller, type FlashPhase, type FlashProgress,
} from "@/device";
import { cn } from "@/lib/utils";
import { sharedDevices } from "../lab/sharedDevice";
import { useSettings } from "../settings/settings";
import { useFirmwareOpener } from "./firmwareRequest";

/*
 * 「펌웨어 설치」 창. 보드가 꽂혀 있는지 먼저 보고(없으면 "연결되어 있지 않아요"), 꽂혀 있으면 MicroPython 이 있는지 확인한 뒤
 * 없거나 옛 판이면 설치한다. 설치 도구는 src/device/firmware.ts (진짜: Web Serial + esptool-js, 가짜: ?device=fake).
 * 설치하는 동안은 창을 닫을 수 없다 (중간에 끊기면 다시 설치해야 한다).
 */

type View =
  | { kind: "looking" }
  | { kind: "unsupported" }
  /** tried: 고르기 창을 열었는데 고르지 않았다 (목록에 보드가 없었을 수 있다) */
  | { kind: "no-board"; tried: boolean }
  | { kind: "checking" }
  | { kind: "device-busy" }
  | { kind: "checked"; check: FirmwareCheck }
  | { kind: "flashing"; progress: FlashProgress }
  | { kind: "verifying" }
  | { kind: "done"; check: FirmwareCheck | null }
  | { kind: "error"; error: FirmwareError; during: "check" | "flash" };

export const FIRMWARE_TEXT = {
  button: "펌웨어 설치",
  buttonTip: "보드에 MicroPython 펌웨어가 있는지 보고, 없으면 바로 설치해요",
} as const;

const PHASES: ReadonlyArray<{ phase: FlashPhase; label: string }> = [
  { phase: "download", label: "펌웨어 받기" },
  { phase: "connect", label: "보드를 설치 모드로 바꾸기" },
  { phase: "erase", label: "보드 지우기 (20초쯤)" },
  { phase: "write", label: "펌웨어 쓰기" },
  { phase: "restart", label: "보드 다시 켜기" },
];

/** 오류마다 학생이 해 볼 일 */
const ERROR_HINTS: Partial<Record<FirmwareError["code"], string[]>> = {
  "no-bootloader": [
    "보드의 BOOT 버튼을 누른 채로 「다시 시도」를 눌러요.",
    "「보드 지우기」가 보이면 BOOT 버튼에서 손을 떼요.",
  ],
  lost: ["USB 케이블이 단단히 꽂혔는지 보고 「다시 시도」를 눌러요.", "설치하다 끊겨도 다시 설치하면 괜찮아요."],
  busy: ["PyCharm 이나 블록랩을 연 다른 탭이 있으면 닫아요.", "그래도 안 되면 USB 를 뽑았다가 다시 꽂아요."],
  failed: ["「다시 시도」를 누르면 더 느린 속도로 설치해요.", "계속 안 되면 선생님께 알려 주세요."],
  download: ["인터넷 연결을 확인하고 「다시 시도」를 눌러요."],
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 설치가 끝난 뒤 보드가 처음 켜지며 파일 공간을 만드는 시간 */
const FIRST_BOOT_MS = 2500;

let fakeInstaller: FakeFirmwareInstaller | null = null;
let realInstaller: WebSerialFirmwareInstaller | null = null;
function installerFor(fake: boolean): FirmwareInstaller {
  if (fake) return (fakeInstaller ??= new FakeFirmwareInstaller());
  return (realInstaller ??= new WebSerialFirmwareInstaller());
}

function asFirmwareError(e: unknown): FirmwareError {
  return e instanceof FirmwareError ? e : new FirmwareError("failed", { cause: e });
}

/**
 * 블록랩이 함께 쓰는 보드 연결(sharedDevice)이 포트를 잡고 있으면 놓는다. 저장 중이면 false (끝날 때까지 기다려야 한다).
 * 실행 중이면 disconnect 가 먼저 멈춘다.
 */
async function releaseSharedDevice(fake: boolean): Promise<boolean> {
  const device = sharedDevices().get(fake);
  if (device.status === "saving") return false;
  if (device.status !== "disconnected") await device.disconnect().catch(() => undefined);
  return true;
}

/** 창의 상태 기계 */
function useFirmwareFlow(open: boolean, fake: boolean) {
  const installer = installerFor(fake);
  const [view, setView] = useState<View>({ kind: "looking" });
  const viewRef = useRef(view);
  viewRef.current = view;
  const board = useRef<BoardPort | null>(null);
  const attempts = useRef(0);
  const alive = useRef(false);
  const show = useCallback((v: View) => { if (alive.current) setView(v); }, []);

  const runCheck = useCallback(async () => {
    const b = board.current;
    if (!b) return;
    show({ kind: "checking" });
    if (!(await releaseSharedDevice(fake))) return show({ kind: "device-busy" });
    try {
      show({ kind: "checked", check: await installer.check(b) });
    } catch (e) {
      show({ kind: "error", error: asFirmwareError(e), during: "check" });
    }
  }, [fake, installer, show]);

  /** 꽂혀 있는 (전에 허락한) 보드를 찾는다. 없으면 "연결되어 있지 않아요" */
  const look = useCallback(async (tried = false) => {
    if (!installer.supported()) return show({ kind: "unsupported" });
    const boards = await installer.grantedBoards().catch(() => []);
    if (!boards.length) {
      board.current = null;
      return show({ kind: "no-board", tried });
    }
    board.current = boards[0];
    await runCheck();
  }, [installer, runCheck, show]);

  /** 「보드 찾기」: 고르기 창 */
  const pick = useCallback(async () => {
    try {
      board.current = await installer.requestBoard();
    } catch (e) {
      const error = asFirmwareError(e);
      if (error.code === "unsupported") return show({ kind: "unsupported" });
      return show({ kind: "no-board", tried: true });
    }
    attempts.current = 0;
    await runCheck();
  }, [installer, runCheck, show]);

  const install = useCallback(async () => {
    const b = board.current;
    if (!b) return look();
    if (!(await releaseSharedDevice(fake))) return show({ kind: "device-busy" });
    attempts.current += 1;
    show({ kind: "flashing", progress: { phase: "download", percent: 0 } });
    try {
      await installer.flash(b, { slow: attempts.current > 1, onProgress: (progress) => show({ kind: "flashing", progress }) });
    } catch (e) {
      return show({ kind: "error", error: asFirmwareError(e), during: "flash" });
    }
    attempts.current = 0;
    show({ kind: "verifying" });
    await sleep(fake ? 0 : FIRST_BOOT_MS);
    let check: FirmwareCheck | null = null;
    for (let i = 0; i < 3 && check?.kind !== "micropython"; i++) {
      check = await installer.check(b).catch(() => null);
      if (check?.kind !== "micropython" && !fake) await sleep(1500);
    }
    show({ kind: "done", check });
  }, [fake, installer, look, show]);

  const retry = useCallback(() => {
    const v = viewRef.current;
    if (v.kind === "error" && v.during === "flash") return void install();
    if (v.kind === "error" || v.kind === "device-busy") return void (board.current ? runCheck() : look());
    void look();
  }, [install, look, runCheck]);

  // 창을 열 때마다 처음부터 (꽂혀 있는지부터)
  useEffect(() => {
    if (!open) return;
    alive.current = true;
    setView({ kind: "looking" });
    attempts.current = 0;
    void look();
    return () => { alive.current = false; };
  }, [open, look]);

  // 허락한 보드를 꽂거나 뽑으면: 기다리던 화면이면 다시 찾고, 보던 보드가 뽑혔으면 "연결되어 있지 않아요"
  useEffect(() => {
    if (!open) return;
    return installer.onPlugChange(() => {
      const kind = viewRef.current.kind;
      if (kind === "flashing" || kind === "verifying" || kind === "checking") return;
      if (kind === "no-board" || kind === "looking") return void look((viewRef.current as { tried?: boolean }).tried ?? false);
      void installer.grantedBoards().then((boards) => {
        if (board.current && !boards.some((b) => b.port === board.current?.port)) {
          board.current = null;
          show({ kind: "no-board", tried: false });
        }
      });
    });
  }, [open, installer, look, show]);

  const busy = view.kind === "flashing" || view.kind === "verifying";
  // 설치 중에 페이지를 닫으려 하면 한 번 묻는다
  useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  return { view, busy, pick, install, retry, chip: board.current?.chip ?? null };
}

function Note({ tone, icon: Icon, title, children }: { tone: "info" | "warn" | "ok"; icon?: LucideIcon; title?: string; children?: ReactNode }) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-md border px-3 py-2 text-sm leading-snug break-keep",
        tone === "warn" && "border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
        tone === "ok" && "border-green-600/40 bg-green-50 text-green-950 dark:bg-green-950/40 dark:text-green-100",
        tone === "info" && "border-border bg-muted/50",
      )}
    >
      {title && (
        <p className="flex items-center gap-1.5 font-semibold">
          {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
          {title}
        </p>
      )}
      {children && <div className={cn(title && "mt-1")}>{children}</div>}
    </div>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="grid gap-1">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-1.5">
          <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

const ERASE_WARNING = "설치하면 보드 안의 파일(main.py, 라이브러리)이 모두 지워져요. 1분쯤 걸리고, 그동안 USB 를 뽑으면 안 돼요.";

function versionText(check: FirmwareCheck): string {
  return check.kind === "micropython" && check.version ? `MicroPython v${check.version}` : "MicroPython";
}

type DialogProps = { open: boolean; onOpenChange(open: boolean): void; fake: boolean };

/** 펌웨어 설치 창 */
export function FirmwareInstallDialog({ open, onOpenChange, fake }: DialogProps) {
  const { view, busy, pick, install, retry, chip } = useFirmwareFlow(open, fake);
  const close = () => onOpenChange(false);
  const boardName = chip ? `ESP32 보드 (${chip})` : "ESP32 보드";

  let title: string;
  let body: ReactNode = null;
  let footer: ReactNode = null;

  switch (view.kind) {
    case "looking":
    case "checking":
      title = view.kind === "looking" ? "보드를 찾고 있어요" : "펌웨어가 있는지 보고 있어요";
      body = (
        <p className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {view.kind === "looking" ? "USB 로 꽂힌 보드를 찾는 중이에요" : `${boardName}에게 물어보는 중이에요`}
        </p>
      );
      break;

    case "unsupported":
      title = "이 브라우저에서는 설치할 수 없어요";
      body = <p>보드와 이야기하려면 컴퓨터의 <b>Chrome</b> 이나 <b>Edge</b> 가 필요해요. 휴대폰·태블릿·Safari 에서는 안 돼요.</p>;
      footer = <Button onClick={close}>닫기</Button>;
      break;

    case "no-board":
      title = "보드가 연결되어 있지 않아요";
      body = (
        <>
          <ol className="grid gap-1.5">
            <li><b>1.</b> USB 케이블로 ESP32 보드를 컴퓨터에 꽂아요.</li>
            <li><b>2.</b> 「보드 찾기」를 누르고, 목록에서 보드(USB Serial, CH340 등)를 골라 「연결」을 눌러요.</li>
          </ol>
          <p className="text-muted-foreground">한 번 고른 보드는 다음부터 꽂기만 하면 저절로 찾아요.</p>
          {view.tried && (
            <Note tone="warn" icon={TriangleAlert} title="목록에 보드가 없었나요?">
              <Bullets items={[
                "충전만 되는 케이블은 안 돼요. 데이터 케이블로 바꿔 꽂아 보세요.",
                "컴퓨터의 다른 USB 구멍에 꽂아 보세요.",
                "Windows 는 CH340 드라이버가 있어야 할 수 있어요. 선생님께 알려 주세요.",
              ]} />
            </Note>
          )}
        </>
      );
      footer = (
        <>
          <Button variant="outline" onClick={close}>닫기</Button>
          <Button onClick={() => void pick()} data-testid="firmware-pick"><Usb className="size-4" />보드 찾기</Button>
        </>
      );
      break;

    case "device-busy":
      title = "보드에 저장하고 있어요";
      body = <p>저장이 끝난 뒤에 다시 해 주세요.</p>;
      footer = <Button onClick={retry}><RotateCcw className="size-4" />다시 확인</Button>;
      break;

    case "checked": {
      const { check } = view;
      if (check.kind === "micropython" && !isOlderFirmware(check)) {
        title = "펌웨어가 이미 들어 있어요";
        body = (
          <>
            <Note tone="ok" icon={CircleCheck} title={`${versionText(check)} — 설치하지 않아도 돼요`}>
              「보드 연결」을 누르고 바로 수업을 시작하면 돼요.
            </Note>
            <p className="text-muted-foreground">보드가 이상하게 움직일 때만 다시 설치해 보세요. {ERASE_WARNING}</p>
          </>
        );
        footer = (
          <>
            <Button variant="outline" onClick={() => void install()} data-testid="firmware-install">다시 설치하기</Button>
            <Button onClick={close}>닫기</Button>
          </>
        );
      } else {
        const older = check.kind === "micropython";
        title = older ? "펌웨어가 옛 판이에요" : "MicroPython 펌웨어가 없어요";
        body = (
          <>
            <p>
              {older
                ? <>보드에 {versionText(check)} 이 들어 있어요. 수업은 v{FIRMWARE.version} 으로 해요. 새 판으로 바꾸는 것을 권해요.</>
                : <>블록랩이 보드에 코드를 보내려면 보드에 MicroPython 이 있어야 해요. 지금 바로 설치할 수 있어요.</>}
            </p>
            <Note tone="warn" icon={TriangleAlert}>{ERASE_WARNING}</Note>
          </>
        );
        footer = (
          <>
            <Button variant="outline" onClick={close}>나중에</Button>
            <Button onClick={() => void install()} data-testid="firmware-install">
              <HardDriveDownload className="size-4" />{older ? "새 판으로 설치" : "설치하기"}
            </Button>
          </>
        );
      }
      break;
    }

    case "flashing": {
      const { progress } = view;
      const current = PHASES.findIndex((p) => p.phase === progress.phase);
      title = "펌웨어를 설치하고 있어요";
      body = (
        <>
          <Progress value={overallPercent(progress)} className="h-2" aria-label="설치 진행률" />
          <ol className="grid gap-1" data-testid="firmware-phases">
            {PHASES.map((p, i) => {
              const state = i < current ? "done" : i === current ? "now" : "next";
              return (
                <li key={p.phase} className={cn("flex items-center gap-2", state === "next" && "text-muted-foreground")} data-state={state}>
                  {state === "done" ? <CircleCheck className="size-4 text-green-600" aria-hidden />
                    : state === "now" ? <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    : <span className="size-4 rounded-full border" aria-hidden />}
                  <span className={cn(state === "now" && "font-semibold")}>
                    {p.label}{p.phase === "write" && state === "now" ? ` ${Math.round(progress.percent)}%` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <Note tone="warn" icon={TriangleAlert} title="USB 를 뽑거나 이 창을 닫지 마세요" />
        </>
      );
      break;
    }

    case "verifying":
      title = "잘 설치됐는지 보고 있어요";
      body = (
        <p className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />보드가 처음 켜지며 준비하는 중이에요
        </p>
      );
      break;

    case "done": {
      const ok = view.check?.kind === "micropython";
      title = ok ? "설치를 마쳤어요" : "설치는 끝났어요";
      body = ok ? (
        <Note tone="ok" icon={CircleCheck} title={`${versionText(view.check!)} 이 들어갔어요`}>
          이제 「보드 연결」을 누르고 수업을 시작해요.
        </Note>
      ) : (
        <Note tone="warn" icon={TriangleAlert} title="보드가 아직 대답하지 않아요">
          USB 를 뽑았다가 다시 꽂고 「보드 연결」을 눌러 보세요. 그래도 안 되면 다시 설치해요.
        </Note>
      );
      footer = <Button onClick={close} data-testid="firmware-done">닫기</Button>;
      break;
    }

    case "error": {
      const hints = ERROR_HINTS[view.error.code];
      title = view.during === "check" ? "보드를 확인하지 못했어요" : "설치하지 못했어요";
      body = (
        <Note tone="warn" icon={TriangleAlert} title={view.error.message}>
          {hints && <Bullets items={hints} />}
        </Note>
      );
      footer = (
        <>
          <Button variant="outline" onClick={close}>닫기</Button>
          <Button onClick={retry} data-testid="firmware-retry"><RotateCcw className="size-4" />다시 시도</Button>
        </>
      );
      break;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!busy}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (busy) e.preventDefault(); }}
        onInteractOutside={(e) => { if (busy) e.preventDefault(); }}
        data-testid="firmware-dialog"
        data-view={view.kind}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardDriveDownload className="size-5 shrink-0" aria-hidden />{title}</DialogTitle>
          <DialogDescription>MicroPython v{FIRMWARE.version} · ESP32 보드용</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm leading-relaxed break-keep">{body}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

/** 창만 둔다 (편집기: 보드 연결이 "대답하지 않아요" 로 실패하면 알림 단추가 연다) */
export function FirmwareDialogHost({ fake }: { fake: boolean }) {
  const [open, setOpen] = useState(false);
  useFirmwareOpener(() => setOpen(true));
  return <FirmwareInstallDialog open={open} onOpenChange={setOpen} fake={fake} />;
}

/** 「펌웨어 설치」 단추 + 창 (챕터 화면 머리띠) */
export function FirmwareInstallButton({ className }: { className?: string }) {
  const { fakeBoard } = useSettings();
  const [open, setOpen] = useState(false);
  useFirmwareOpener(() => setOpen(true));
  return (
    <>
      <Button
        variant="outline"
        className={cn("h-9 px-3 text-sm", className)}
        title={FIRMWARE_TEXT.buttonTip}
        onClick={() => setOpen(true)}
        data-testid="firmware-button"
      >
        <HardDriveDownload className="size-4" />{FIRMWARE_TEXT.button}
      </Button>
      <FirmwareInstallDialog open={open} onOpenChange={setOpen} fake={fakeBoard} />
    </>
  );
}
