import { useCallback, useRef } from "react";
import type { StepProps } from "./types";

/**
 * 늦게 부르는 콜백(1초 뒤 프로그램 저장, 실행 끝)이 옛 입력을 덮지 않도록 지금 입력·onInput 을 읽어 합친다.
 * patch 는 지금 입력을 받아 바꿀 부분을 돌려준다.
 */
export function useStepInput<T extends Record<string, unknown>>(input: Record<string, unknown>, onInput: StepProps<never>["onInput"]) {
  const ref = useRef({ input, onInput });
  ref.current = { input, onInput };
  return useCallback((patch: (current: T) => Partial<T>, opts?: { attempt?: boolean }) => {
    const current = ref.current.input as T;
    const next = { ...current, ...patch(current) };
    ref.current.input = next;
    ref.current.onInput(next, opts);
  }, []);
}
