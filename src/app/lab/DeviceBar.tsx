import type { ReactNode } from "react";
import { Loader2, Play, Save, Square, Unplug, Usb, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DeviceDisplayStatus } from "./useDevice";

const STATUS: Record<DeviceDisplayStatus, { label: string; icon: LucideIcon; className: string; spin?: boolean }> = {
  disconnected: { label: "끊김", icon: Unplug, className: "border-border text-muted-foreground" },
  connecting: { label: "연결 중", icon: Loader2, className: "border-border text-muted-foreground", spin: true },
  connected: { label: "연결됨", icon: Usb, className: "bg-green-600/10 text-green-700 dark:text-green-400" },
  running: { label: "실행 중", icon: Loader2, className: "bg-blue-600/10 text-blue-700 dark:text-blue-400", spin: true },
  saving: { label: "저장 중", icon: Loader2, className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", spin: true },
};

type Props = {
  status: DeviceDisplayStatus;
  canToggleConnection: boolean;
  canRun: boolean;
  canSave: boolean;
  canStop: boolean;
  /** "보드에 저장"을 숨긴다 (트랙 단계) */
  hideSave?: boolean;
  onConnect(): void;
  onDisconnect(): void;
  onRun(): void;
  onSave(): void;
  onStop(): void;
};

type BarButtonProps = { icon: LucideIcon; label: string; tip: string; disabled: boolean; onClick(): void; spin?: boolean };

function BarButton({ icon: Icon, label, tip, disabled, onClick, spin }: BarButtonProps) {
  return (
    <Tooltip>
      {/* 비활성 버튼은 포인터 이벤트를 받지 않으므로 span 이 툴팁을 받는다 */}
      <TooltipTrigger asChild>
        <span tabIndex={disabled ? 0 : -1} className="inline-flex rounded-md">
          <Button variant="outline" size="sm" disabled={disabled} aria-label={label} onClick={onClick}>
            <Icon className={cn("size-4", spin && "animate-spin")} /><span className="hidden md:inline">{label}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/** 상단 보드 버튼(연결/끊기·실행·보드에 저장·멈춤)과 상태 배지 */
export function DeviceBar(props: Props): ReactNode {
  const { status } = props;
  const s = STATUS[status];
  const StatusIcon = s.icon;
  const connected = status !== "disconnected" && status !== "connecting";
  const needBoard = "먼저 보드를 연결해 주세요";
  const busy = status === "running" || status === "saving";

  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className={cn("mr-1 gap-1", s.className)} data-testid="device-status" aria-live="polite">
        {/* 아주 좁은 화면(sm 미만)은 아이콘만 — 머리줄에 「작품으로 저장」까지 들어가게. 글은 화면 읽기 프로그램에 남는다 */}
        <StatusIcon className={cn(s.spin && "animate-spin")} /><span className="max-sm:sr-only">{s.label}</span>
      </Badge>
      {connected ? (
        <BarButton icon={Unplug} label="연결 끊기" tip="보드와의 연결을 끊어요" disabled={!props.canToggleConnection} onClick={props.onDisconnect} />
      ) : (
        <BarButton
          icon={status === "connecting" ? Loader2 : Usb}
          spin={status === "connecting"}
          label="보드 연결"
          tip="USB로 꽂은 ESP32를 골라 연결해요 (Chrome)"
          disabled={!props.canToggleConnection}
          onClick={props.onConnect}
        />
      )}
      <BarButton
        icon={Play}
        label="실행"
        tip={!connected ? needBoard : busy ? "지금 하는 일이 끝나면 실행할 수 있어요" : "지금 코드를 보드에서 실행해요 (보드에 저장하지는 않아요)"}
        disabled={!props.canRun}
        onClick={props.onRun}
      />
      {!props.hideSave && (
        <BarButton
          icon={Save}
          label="보드에 저장"
          tip={!connected ? needBoard : busy ? "지금 하는 일이 끝나면 저장할 수 있어요" : "main.py 로 저장해요. 보드를 켤 때마다 실행돼요"}
          disabled={!props.canSave}
          onClick={props.onSave}
        />
      )}
      <BarButton
        icon={Square}
        label="멈춤"
        tip={!connected ? needBoard : status === "saving" ? "저장이 끝날 때까지 기다려 주세요" : "보드에서 돌고 있는 프로그램을 멈춰요"}
        disabled={!props.canStop}
        onClick={props.onStop}
      />
    </div>
  );
}
