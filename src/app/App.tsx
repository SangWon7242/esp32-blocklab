import { lazy, Suspense } from "react";
import { HashRouter, Link, NavLink, Route, Routes } from "react-router";
import { Blocks, Cpu, Route as RouteIcon, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HomePage } from "./pages/HomePage";

// 편집기(Blockly·CodeMirror)는 무거우므로 자유 코딩 화면을 열 때 따로 받는다
const LabPage = lazy(() => import("./lab/LabPage").then((m) => ({ default: m.LabPage })));

const navItems = [
  { to: "/lab", label: "자유 코딩", icon: Blocks },
  { to: "/track", label: "트랙", icon: RouteIcon, soon: true },
  { to: "/settings", label: "설정", icon: Settings, soon: true },
];

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
            <Suspense fallback={<div className="p-8 text-muted-foreground">편집기를 불러오는 중…</div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/lab" element={<LabPage />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </HashRouter>
  );
}
