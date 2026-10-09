"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  MessageSquare,
  ListChecks,
  Code2,
  BriefcaseBusiness,
  CalendarDays,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ArrowUpRight,
} from "lucide-react";
import Brand from "./Brand";
interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}
const groups = [
  {
    label: "WORKSPACE",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Your library", href: "/sources", icon: Library },
      { name: "Tutor", href: "/tutor", icon: MessageSquare },
      { name: "Practice & quizzes", href: "/quizzes", icon: ListChecks },
    ],
  },
  {
    label: "DEVELOP YOUR SKILLS",
    items: [
      { name: "Coding studio", href: "/coding", icon: Code2 },
      { name: "Career preparation", href: "/career", icon: BriefcaseBusiness },
      { name: "Study planner", href: "/planner", icon: CalendarDays },
    ],
  },
];
export default function Sidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onCollapseToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
      if (e.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0];
      const last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [isOpen, onClose]);
  return (
    <>
      {isOpen && (
        <button
          className="sidebar-backdrop"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={ref}
        id="workspace-navigation"
        aria-label="Workspace navigation"
        className={`workspace-sidebar ${isOpen ? "is-open" : ""} ${isCollapsed ? "is-collapsed" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand compact={isCollapsed} />
          <button
            className="mobile-close icon-button"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-scroll">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              {!isCollapsed && <p className="nav-label">{group.label}</p>}
              <nav>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={isCollapsed ? item.name : undefined}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={`nav-item ${pathname === item.href ? "active" : ""}`}
                  >
                    <item.icon size={18} />
                    {!isCollapsed && <span>{item.name}</span>}
                    {pathname === item.href && !isCollapsed && (
                      <span className="nav-active-dot" />
                    )}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          {!isCollapsed && (
            <Link href="/sources" onClick={onClose} className="sidebar-note">
              <span className="eyebrow">MAKE IT YOURS</span>
              <strong>Start with your material.</strong>
              <p>Add a chapter, a lecture, or your own notes.</p>
              <span className="sidebar-note-link">
                Add a resource <ArrowUpRight size={15} />
              </span>
            </Link>
          )}
          <Link
            href="/diagnostics"
            onClick={onClose}
            className={`nav-item ${pathname === "/diagnostics" ? "active" : ""}`}
            title="Service status"
          >
            <Activity size={17} />
            {!isCollapsed && <span>Service status</span>}
          </Link>
          <button
            className="nav-item collapse-button"
            onClick={onCollapseToggle}
            aria-label={
              isCollapsed ? "Expand navigation" : "Collapse navigation"
            }
          >
            {isCollapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}{" "}
            {!isCollapsed && <span>Collapse navigation</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
