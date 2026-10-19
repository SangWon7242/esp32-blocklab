import { cn } from "@/lib/utils";
import type { StepType } from "@/track/schema";
import { STEP_TYPE_ICON } from "./stepMeta";

/** 단계 유형 배지 앞 아이콘 (아이콘이 있는 유형만). 기본 크기 size-3, className 으로 바꾼다 */
export function StepTypeIcon({ type, className }: { type: StepType; className?: string }) {
  const Icon = STEP_TYPE_ICON[type];
  return Icon ? <Icon className={cn("size-3", className)} aria-hidden /> : null;
}
