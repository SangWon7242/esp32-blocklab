import { createContext, useContext } from "react";

/*
 * 블록랩 틀(chrome): BlocklabProvider 가 그리는 `.blocklab` 루트 안의 공용 요소.
 * 라이브러리 CSS 는 `.blocklab` 아래에서만 작동하므로, body 로 나가는 Radix 포털(Dialog·AlertDialog·Tooltip)도
 * 이 루트 안의 포털 상자에 붙인다. HostContext 와 ui 컴포넌트가 서로를 import 하지 않도록 따로 둔다.
 */

export type Chrome = {
  /** Radix 포털이 붙을 `.blocklab` 안의 상자 (처음 그릴 때는 아직 없음) */
  portal: HTMLElement | null;
};

export const ChromeContext = createContext<Chrome | null>(null);

/** 포털 상자. Provider 밖(또는 아직 붙기 전)이면 undefined → Radix 기본값(document.body) */
export function usePortalContainer(): HTMLElement | undefined {
  return useContext(ChromeContext)?.portal ?? undefined;
}
