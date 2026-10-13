import { lazy, Suspense } from "react";
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from "react-router";
import { Blocks, Cpu, Route as RouteIcon, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "./ErrorBoundary";
import { HomePage } from "./pages/HomePage";

// 편집기(Blockly·CodeMirror)는 무거우므로 자유 코딩 화면을 열 때 따로 받는다
const LabPage = lazy(() => import("./lab/LabPage").then((m) => ({ default: m.LabPage })));
// 트랙 화면은 콘텐츠(YAML·코드 글)를 함께 받으므로 열 때 받는다
const TrackPage = lazy(() => import("./track/TrackPage").then((m) => ({ default: m.TrackPage })));
const ChapterPage = lazy(() => import("./track/ChapterPage").then((m) => ({ default: m.ChapterPage })));
const StepPage = lazy(() => import("./track/StepPage").then((m) => ({ default: m.StepPage })));
const SettingsPage = lazy(() => import("./settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const navItems = [
  { to: "/lab", label: "자유 코딩", icon: Blocks },
  { to: "/track", label: "트랙", icon: RouteIcon },
  { to: "/settings", label: "설정", icon: Settings },
] as { to: string; label: string; icon: typeof Blocks; soon?: boolean }[];

/** 화면 영역. 주소가 바뀌면 오류 경계를 새로 만들어 다른 화면으로는 갈 수 있게 한다 */
function Screens() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<div className="p-8 text-muted-foreground">불러오는 중…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/track" element={<TrackPage />} />
          <Route path="/track/:chapter" element={<ChapterPage />} />
          <Route path="/track/:chapter/:step" element={<StepPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <HashRouter>
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
    </HashRouter>
  );
}
