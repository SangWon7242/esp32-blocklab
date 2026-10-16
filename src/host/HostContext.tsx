import { createContext, useContext, useMemo, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import type { AiReview, DebugRequest, ReflectRequest } from "@/ai/claude";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProgressStore, StepRecord } from "@/track/progress";
import type { ChapterSnapshot } from "@/track/snapshot";
import { setBlocklyMediaPath } from "./mediaPath";
import { ChromeContext, type Chrome } from "./chrome";

/*
 * 호스트 어댑터 (계획 13 인터페이스 계약). 블록랩 화면은 진행 저장소·설정·AI·주소 이동을 모두 여기서 받는다.
 * 체험판(App.tsx)은 localStorage 와 react-router 로, 허브는 fetch 와 Next 라우터로 이 모양을 채운다.
 */

export type HostUser = { id: string; name: string; grade?: string | null };
export type HostMode = "student" | "review" | "demo";
export type SettingsSource = { teacherMode: boolean; fakeBoard: boolean; explainGate: boolean };
export type AiClient = { reflect(req: ReflectRequest): Promise<AiReview>; debug(req: DebugRequest): Promise<AiReview> };
export type NavigateOptions = {
  /** 지금 항목을 바꿔 넣어 뒤로 가기에 남기지 않는다 (잠긴·없는 단계를 돌려보낼 때) */
  replace?: boolean;
};
export type Navigator = {
  href: {
    track(): string;
    chapter(id: string): string;
    step(id: string, step: string): string;
    lab(): string;
    /** 블록 사전 화면 (선택). 호스트에 사전이 없으면 비워 두면 "블록 사전에서 보기" 링크가 숨는다 */
    docs?(block: string): string;
  };
  go(href: string, opts?: NavigateOptions): void;
};
export type HostProps = {
  user: HostUser | null;
  mode: HostMode;
  store: ProgressStore;
  settings: SettingsSource;
  ai?: AiClient;
  nav: Navigator;
  onSubmit?: (chapterId: string, snapshot: ChapterSnapshot) => Promise<void>;
  onSaveProject?: (p: { title: string; code: string; blocksJson: unknown; chapterId?: string }) => Promise<void>;
  /** review 모드에서 보여 줄 학생 기록 (stepId → 기록). 저장하지 않는다 */
  reviewRecords?: Record<string, StepRecord>;
  /**
   * Blockly media(효과음 mp3·sprites.svg·아이콘·커서) 주소 (lib-v1.0.1, 선택). 기본 "/blocklab/media/".
   * 호스트는 dist-lib/media/ 의 파일을 이 주소에서 서빙한다. 끝 "/" 는 없어도 붙인다
   */
  blocklyMediaPath?: string;
};

const HostContext = createContext<HostProps | null>(null);

export const MISSING_HOST_MESSAGE = "BlocklabProvider 가 없어요. 블록랩 화면은 BlocklabProvider 안에서만 그릴 수 있어요";

/**
 * 호스트가 블록랩 화면을 감싼다. 라이브러리 CSS 는 `.blocklab` 아래에서만 작동하므로 루트 div 와 함께
 * 화면이 기대는 틀(TooltipProvider·토스트·Radix 포털 상자)도 여기서 그린다.
 * 이미 Provider 안이면(열람 화면이 review 로 다시 감쌀 때) 호스트 값만 바꾸고 틀은 바깥 것을 쓴다.
 */
export function BlocklabProvider({ children, ...host }: HostProps & { children: ReactNode }) {
  const outer = useContext(ChromeContext);
  // 자식 편집기의 useEffect(Blockly.inject)가 이 Provider 의 effect 보다 먼저 돌므로 그리는 동안 정한다 (같은 값을 다시 넣는 것뿐)
  if (host.blocklyMediaPath !== undefined) setBlocklyMediaPath(host.blocklyMediaPath);
  return (
    <HostContext.Provider value={host}>{outer ? children : <BlocklabChrome>{children}</BlocklabChrome>}</HostContext.Provider>
  );
}

function BlocklabChrome({ children }: { children: ReactNode }) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const chrome = useMemo<Chrome>(() => ({ portal }), [portal]);
  return (
    // display:contents — 호스트 배치(flex 등)를 그대로 흘려보낸다. 토큰·글자색은 display:contents 여도 상속된다
    <div className="blocklab" style={{ display: "contents" }}>
      <ChromeContext.Provider value={chrome}>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </ChromeContext.Provider>
      {/* Dialog·Tooltip 포털이 body 대신 여기 붙어 `.blocklab` 범위 CSS 를 받는다 */}
      <div ref={setPortal} data-slot="blocklab-portal" style={{ display: "contents" }} />
    </div>
  );
}

/** 호스트 어댑터. Provider 밖에서 부르면 바로 throw (조용히 깨지지 않게) */
export function useHost(): HostProps {
  const host = useContext(HostContext);
  if (!host) throw new Error(MISSING_HOST_MESSAGE);
  return host;
}

/** review(열람) 모드: 입력·판정·저장·AI 를 숨기고 기록만 보여 준다 */
export function useReadOnly(): boolean {
  return useHost().mode === "review";
}

/** href 뒤에 ?key=value 를 붙인다. 값의 "/" 는 그대로 둔다 (?code=챕터/파일 처럼 읽기 쉽게) */
export function withQuery(href: string, params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params)
    .filter((e): e is [string, string] => e[1] !== undefined && e[1] !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%2F/g, "/")}`);
  if (pairs.length === 0) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${pairs.join("&")}`;
}

type LinkProps = Omit<ComponentProps<"a">, "href"> & { to: string };

/** 새 탭·수정키 클릭은 브라우저에 맡기고, 보통 클릭만 호스트 이동으로 바꾼다 */
function plainClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && (!e.currentTarget.target || e.currentTarget.target === "_self");
}

/** 호스트 Navigator 로 이동하는 링크. href 는 그대로 두어 중간 클릭·새 탭도 된다 */
export function HostLink({ to, onClick, children, ...rest }: LinkProps) {
  const { nav } = useHost();
  return (
    <a
      {...rest}
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !plainClick(e)) return;
        e.preventDefault();
        nav.go(to);
      }}
    >
      {children}
    </a>
  );
}
