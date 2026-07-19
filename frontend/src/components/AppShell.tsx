import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  GitBranch,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import clsx from "clsx";

const links = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/repos", label: "Repositories", icon: GitBranch },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="glass border-r border-[var(--border)] p-5 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[linear-gradient(135deg,#3dd6c6,#5b8cff)] grid place-items-center">
            <Sparkles size={18} color="#041018" />
          </div>
          <div>
            <div
              className="text-sm font-semibold tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              CodeAtlas AI
            </div>
            <div className="text-xs text-[var(--muted)]">Code Intelligence</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  isActive
                    ? "bg-[rgba(61,214,198,0.12)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
                )
              }
            >
              <link.icon size={16} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm truncate">{user?.username || "Developer"}</div>
              <div className="text-xs text-[var(--muted)]">Signed in</div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-[var(--muted)] hover:bg-white/5 hover:text-white"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="p-6 md:p-8 max-w-7xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
