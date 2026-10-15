import type { StepType } from "@/track/schema";
import { STEP_TYPE_ICON } from "./stepMeta";

/** 단계 유형 배지 앞 아이콘 (아이콘이 있는 유형만) */
export function StepTypeIcon({ type }: { type: StepType }) {
  const Icon = STEP_TYPE_ICON[type];
  return Icon ? <Icon className="size-3" aria-hidden /> : null;
}
