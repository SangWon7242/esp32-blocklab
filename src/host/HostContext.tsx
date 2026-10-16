import { createContext, useContext, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import type { AiReview, DebugRequest, ReflectRequest } from "@/ai/claude";
import type { ProgressStore, StepRecord } from "@/track/progress";
import type { ChapterSnapshot } from "@/track/snapshot";

/*
 * 호스트 어댑터 (계획 13 인터페이스 계약). 블록랩 화면은 진행 저장소·설정·AI·주소 이동을 모두 여기서 받는다.
 * 체험판(App.tsx)은 localStorage 와 react-router 로, 허브는 fetch 와 Next 라우터로 이 모양을 채운다.
 */

export type HostUser = { id: string; name: string; grade?: string | null };
export type HostMode = "student" | "review" | "demo";
export type SettingsSource = { teacherMode: boolean; fakeBoard: boolean; explainGate: boolean };
export type AiClient = { reflect(req: ReflectRequest): Promise<AiReview>; debug(req: DebugRequest): Promise<AiReview> };
export type Navigator = {
  href: { track(): string; chapter(id: string): string; step(id: string, step: string): string; lab(): string };
  go(href: string): void;
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
};

const HostContext = createContext<HostProps | null>(null);

export const MISSING_HOST_MESSAGE = "BlocklabProvider 가 없어요. 블록랩 화면은 BlocklabProvider 안에서만 그릴 수 있어요";

/** 호스트가 블록랩 화면을 감싼다. 라이브러리 CSS 는 `.blocklab` 아래에서만 작동하므로 루트 div 를 함께 그린다 */
export function BlocklabProvider({ children, ...host }: HostProps & { children: ReactNode }) {
  return (
    <HostContext.Provider value={host}>
      {/* display:contents — 호스트 배치(flex 등)를 그대로 흘려보낸다 */}
      <div className="blocklab" style={{ display: "contents" }}>{children}</div>
    </HostContext.Provider>
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
