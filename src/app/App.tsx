import { HashRouter, Link, NavLink, Route, Routes } from "react-router";
import { Blocks, Cpu, Route as RouteIcon, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { HomePage } from "./pages/HomePage";
import { LabPage } from "./lab/LabPage";

const navItems = [
  { to: "/lab", label: "자유 코딩", icon: Blocks },
  { to: "/track", label: "트랙", icon: RouteIcon, soon: true },
  { to: "/settings", label: "설정", icon: Settings, soon: true },
];

export function App() {
  return (
    <HashRouter>
      <div className="flex h-screen flex-col">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Cpu className="size-5" />
            ESP32 블록랩
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {navItems.map(({ to, label, icon: Icon, soon }) => (
              <NavLink
                key={to}
                to={soon ? "#" : to}
                aria-disabled={soon}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                    isActive && !soon && "bg-muted text-foreground",
                    soon && "pointer-events-none opacity-60",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
                {soon && <Badge variant="outline">준비 중</Badge>}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lab" element={<LabPage />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </HashRouter>
  );
}
