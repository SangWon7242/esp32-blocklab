import { useState } from "react";
import { Cable, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyPinMap, type CarriedCode, type PinChange, type PinMap } from "@/track/pinCarry";

/**
 * 이어 받은 시작 코드: 앞 단계에서 바꾼 핀(pinMap)을 이 단계 시작 코드에 적용한 것. 저장한 프로그램이 있거나(학생이 이미 고쳤다)
 * 표가 비었거나 적용·부딪힘이 하나도 없으면 null. 마운트할 때 한 번 정한다 (편집기 initialCode 도 마운트 때만 읽는다)
 */
export function useCarriedStart(startCode: string | undefined, saved: boolean, pinMap: PinMap | undefined) {
  const [carried] = useState<CarriedCode | null>(() => carriedStart(startCode, saved, pinMap));
  const [reverted, setReverted] = useState(false);
  return {
    carried,
    /** 편집기에 처음 실을 시작 코드 */
    start: carried?.code ?? startCode,
    /** 안내 줄을 보일지 (「원래 핀으로」를 누르면 닫힌다) */
    showNotice: carried !== null && !reverted,
    reverted,
    revert: () => setReverted(true),
  };
}

export function carriedStart(startCode: string | undefined, saved: boolean, pinMap: PinMap | undefined): CarriedCode | null {
  if (startCode === undefined || saved || !pinMap?.size) return null;
  const c = applyPinMap(startCode, pinMap);
  return c.applied.length || c.skipped.length ? c : null;
}

const changeText = (changes: readonly PinChange[]) => changes.map((c) => `${c.from}번 → ${c.to}번`).join(", ");

/**
 * 편집기 위 작은 안내 한 줄: 「앞 단계에서 바꾼 핀을 이어서 썼어요: 13번 → 15번」 + 「원래 핀으로」(선생님 시작 코드로 되돌림).
 * 다른 부품의 핀과 부딪혀 적용하지 않은 바꿈도 적는다.
 */
export function PinCarryNotice({ carried, onRevert }: { carried: CarriedCode; onRevert(): void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed px-2 py-1 text-sm text-muted-foreground" role="status" data-testid="pin-carry">
      <Cable className="size-4 shrink-0" aria-hidden />
      {carried.applied.length > 0 && (
        <span>앞 단계에서 바꾼 핀을 이어서 썼어요: <strong className="font-medium text-foreground">{changeText(carried.applied)}</strong></span>
      )}
      {carried.skipped.length > 0 && (
        <span data-testid="pin-carry-skipped">
          {changeText(carried.skipped)}은 그 번호를 다른 부품이 쓰고 있어서 원래대로 두었어요
        </span>
      )}
      {carried.applied.length > 0 && (
        <Button variant="outline" size="sm" className="ml-auto" onClick={onRevert} data-testid="pin-carry-revert">
          <RotateCcw className="size-4" />원래 핀으로
        </Button>
      )}
    </div>
  );
}
