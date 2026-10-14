import { useState } from "react";

/** 단계 화면의 안내 칸 접힘 상태 (넓은 화면 전용). 이 브라우저에만 저장한다 */
export const GUIDE_COLLAPSED_KEY = "esp32-blocklab:track-guide-collapsed";

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(GUIDE_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function write(collapsed: boolean) {
  try {
    if (collapsed) globalThis.localStorage?.setItem(GUIDE_COLLAPSED_KEY, "1");
    else globalThis.localStorage?.removeItem(GUIDE_COLLAPSED_KEY);
  } catch {
    // 저장이 막힌 브라우저면 이 화면에서만 유지된다
  }
}

export function useGuideCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(read);
  return [collapsed, (next) => {
    setCollapsed(next);
    write(next);
  }];
}
