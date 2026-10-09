"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, ChevronRight, ArrowUpRight } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { clearStoredAuth, getStoredEmail } from "@/lib/api";
const names: Record<string, string> = {
  "/dashboard": "Overview",
  "/sources": "Your library",
  "/tutor": "Tutor",
  "/quizzes": "Practice & quizzes",
  "/coding": "Coding studio",
  "/career": "Career preparation",
  "/planner": "Study planner",
  "/diagnostics": "Service status",
};
export default function Navbar({
  onMenuToggle,
  menuOpen = false,
}: {
  onMenuToggle?: () => void;
  menuOpen?: boolean;
}) {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setEmail(getStoredEmail()), 0);
    return () => clearTimeout(timer);
  }, []);
  const logout = () => {
    clearStoredAuth();
    window.location.href = "/login";
  };
  return (
    <header className="workspace-topbar">
      <div className="flex items-center gap-3">
        <button
          className="icon-button mobile-menu"
          onClick={onMenuToggle}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="workspace-navigation"
        >
          <Menu size={20} />
        </button>
        <span className="breadcrumb-root">Workspace</span>
        <ChevronRight size={13} className="text-muted-foreground" />
        <span className="breadcrumb-current">
          {names[pathname] || "Workspace"}
        </span>
      </div>
      <div className="topbar-actions">
        <Link href="/tutor" className="topbar-quick-link">
          Start a session <ArrowUpRight size={14} />
        </Link>
        <ThemeToggle />
        <div className="account-chip">
          <span className="avatar">
            {email.slice(0, 1).toUpperCase() || "S"}
          </span>
          <span className="account-email" title={email}>
            {email.split("@")[0] || "Student"}
          </span>
        </div>
        <button
          className="icon-button"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
