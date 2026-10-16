import { lazy, Suspense, useMemo, type ReactNode } from "react";
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Blocks, BookOpen, Cpu, Route as RouteIcon, Settings } from "lucide-react";
import { askClaude, debugMessage, reflectMessage } from "@/ai/claude";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BlocklabProvider, type AiClient, type Navigator, type SettingsSource } from "@/host/HostContext";
import { cn } from "@/lib/utils";
import { LocalProgressStore } from "@/track/progress";
import { isTrackId } from "@/track/tracks";
import { ErrorBoundary } from "./ErrorBoundary";
import { HomePage } from "./pages/HomePage";
import { useLocalSettings } from "./settings/localSettings";

// 편집기(Blockly·CodeMirror)는 무거우므로 자유 코딩 화면을 열 때 따로 받는다
const LabPage = lazy(() => import("./lab/LabPage").then((m) => ({ default: m.LabPage })));
// 트랙 화면은 콘텐츠(YAML·코드 글)를 함께 받으므로 열 때 받는다
const TrackPage = lazy(() => import("./track/TrackPage").then((m) => ({ default: m.TrackPage })));
const ChapterPage = lazy(() => import("./track/ChapterPage").then((m) => ({ default: m.ChapterPage })));
const StepPage = lazy(() => import("./track/StepPage").then((m) => ({ default: m.StepPage })));
// 블록 사전은 카탈로그를 만들 때 Blockly 를 쓰므로 열 때 받는다
const DocsPage = lazy(() => import("./docs/DocsPage").then((m) => ({ default: m.DocsPage })));
const SettingsPage = lazy(() => import("./settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const navItems = [
  { to: "/lab", label: "자유 코딩", icon: Blocks },
  { to: "/track", label: "트랙", icon: RouteIcon },
  { to: "/docs", label: "블록 사전", icon: BookOpen },
  { to: "/settings", label: "설정", icon: Settings },
] as { to: string; label: string; icon: typeof Blocks; soon?: boolean }[];

/*
 * 체험판 호스트 어댑터. 라이브러리 화면(src/app/track 등)은 react-router 를 모르고 BlocklabProvider 의
 * store·settings·ai·nav 만 쓴다. 이 파일만 HashRouter 와 주소(검색 매개변수)를 다룬다.
 */

/** 진행 기록: 이 브라우저의 localStorage (막혀 있으면 메모리) */
const demoStore = new LocalProgressStore();

/** HashRouter 주소. `#/track/...` 꼴을 그대로 <a href> 에 쓸 수 있고, go 는 # 을 떼어 라우터로 옮긴다 */
const demoHref: Navigator["href"] = {
  track: () => "#/track",
  chapter: (id) => `#/track/${id}`,
  step: (id, step) => `#/track/${id}/${step}`,
  lab: () => "#/lab",
};

/** 교사 키가 있을 때만 Claude 를 브라우저에서 바로 부른다 (설정 §10) */
function claudeClient(apiKey: string, model: string): AiClient {
  return {
    reflect: (req) => askClaude({ apiKey, model, message: reflectMessage(req) }),
    debug: (req) => askClaude({ apiKey, model, message: debugMessage(req) }),
  };
}

function DemoHost({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const local = useLocalSettings();
  // ?device=fake 는 어느 화면에서든 가짜 보드로 (e2e·보드 없는 자리)
  const deviceFake = searchParams.get("device") === "fake";

  const settings = useMemo<SettingsSource>(
    () => ({ teacherMode: local.teacherMode, fakeBoard: local.fakeBoard || deviceFake, explainGate: local.explainGate }),
    [local.teacherMode, local.fakeBoard, local.explainGate, deviceFake],
  );
  const ai = useMemo(() => (local.claudeApiKey ? claudeClient(local.claudeApiKey, local.claudeModel) : undefined), [local.claudeApiKey, local.claudeModel]);
  const nav = useMemo<Navigator>(() => ({ href: demoHref, go: (href) => void navigate(href.replace(/^#/, "")) }), [navigate]);

  return (
    <BlocklabProvider user={null} mode="demo" store={demoStore} settings={settings} ai={ai} nav={nav}>
      {children}
    </BlocklabProvider>
  );
}

/* 주소 → props. 라이브러리 화면은 id 를 props 로만 받는다 */

function TrackRoute() {
  const [params, setParams] = useSearchParams();
  return (
    <TrackPage
      track={params.get("track")}
      onTrackChange={(track) => {
        if (!isTrackId(track)) return;
        setParams((p) => {
          const next = new URLSearchParams(p);
          next.set("track", track);
          return next;
        }, { replace: true });
      }}
    />
  );
}

function ChapterRoute() {
  const { chapter = "" } = useParams();
  return <ChapterPage chapterId={chapter} />;
}

function StepRoute() {
  const { chapter = "", step = "" } = useParams();
  return <StepPage chapterId={chapter} stepId={step} />;
}

function LabRoute() {
  const [params, setParams] = useSearchParams();
  return (
    <LabPage
      exampleType={params.get("example")}
      codeRef={params.get("code")}
      onExampleLoaded={() =>
        setParams((p) => {
          p.delete("example");
          return p;
        }, { replace: true })
      }
    />
  );
}

function DocsRoute() {
  const [params, setParams] = useSearchParams();
  return <DocsPage block={params.get("block")} category={params.get("cat")} onCategoryChange={(id) => setParams({ cat: id })} />;
}

/** 화면 영역. 주소가 바뀌면 오류 경계를 새로 만들어 다른 화면으로는 갈 수 있게 한다 */
function Screens() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<div className="p-8 text-muted-foreground">불러오는 중…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lab" element={<LabRoute />} />
          <Route path="/track" element={<TrackRoute />} />
          <Route path="/track/:chapter" element={<ChapterRoute />} />
          <Route path="/track/:chapter/:step" element={<StepRoute />} />
          <Route path="/docs" element={<DocsRoute />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <HashRouter>
      <DemoHost>
        <TooltipProvider>
          <div className="flex h-screen flex-col">
            <header className="flex h-12 shrink-0 items-center gap-4 overflow-hidden border-b px-4 whitespace-nowrap">
              <Link to="/" className="flex items-center gap-2 font-semibold" aria-label="ESP32 블록랩">
                <Cpu className="size-5" />
                <span className="hidden sm:inline">ESP32 블록랩</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                {navItems.map(({ to, label, icon: Icon, soon }) => (
                  <NavLink
                    key={to}
                    to={soon ? "#" : to}
                    aria-disabled={soon}
                    aria-label={label}
                    title={label}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                        isActive && !soon && "bg-muted text-foreground",
                        soon && "pointer-events-none opacity-60",
                      )
                    }
                  >
                    <Icon className="size-4" />
                    {/* 좁은 화면에서는 아이콘만 보인다 */}
                    <span className="hidden md:inline">{label}</span>
                    {soon && <Badge variant="outline" className="hidden md:inline-flex">준비 중</Badge>}
                  </NavLink>
                ))}
              </nav>
            </header>
            <main className="min-h-0 flex-1">
              <Screens />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </DemoHost>
    </HashRouter>
  );
}
