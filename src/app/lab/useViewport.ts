import { useEffect, useState } from "react";

/** 이 폭 아래에서는 블록과 코드를 나란히 두지 않고 탭으로 하나씩 보여 준다 */
const QUERY = "(max-width: 1023px)";

export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}
