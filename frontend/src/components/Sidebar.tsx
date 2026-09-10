// frontend/src/components/Sidebar.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  MessageSquare,
  CheckSquare,
  Code,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sparkles,
  X,
  Calendar,
  Activity
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onCollapseToggle,
}: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard Overview", href: "/dashboard", icon: BarChart3 },
    { name: "Knowledge Base (RAG)", href: "/sources", icon: FileText },
    { name: "Tutoring Companion", href: "/tutor", icon: MessageSquare },
    { name: "Quizzes & Revision", href: "/quizzes", icon: CheckSquare },
    { name: "Coding Mentor", href: "/coding", icon: Code },
    { name: "Career & Placement", href: "/career", icon: Briefcase },
    { name: "Study Planner", href: "/planner", icon: Calendar },
    { name: "System Diagnostics", href: "/diagnostics", icon: Activity },
  ];

  const sidebarWidthClass = isCollapsed ? "w-16" : "w-64";

  return (
    <>
      {/* Mobile Backdrop Drawer overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 bg-card text-card-foreground border-r border-border p-4 flex flex-col justify-between shrink-0 z-50 md:sticky transition-all duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarWidthClass}`}
      >
        <div className="space-y-6">
          {/* Mobile Header Menu Closer */}
          <div className="flex items-center justify-between md:hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Navigation</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-secondary text-foreground border border-border cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop Collapse Toggle */}
          {onCollapseToggle && (
            <div className="hidden md:flex justify-end">
              <button
                onClick={onCollapseToggle}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border cursor-pointer transition-colors"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <div className="space-y-1">
            {!isCollapsed && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 block">
                Modules
              </span>
            )}
            <ul className="space-y-1 mt-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Learning Status Box at bottom */}
        {!isCollapsed ? (
          <div className="bg-secondary/40 p-3 rounded-lg border border-border transition-all duration-200">
            <div className="flex items-center gap-1.5 text-[9px] text-green-500 font-bold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Core Engine Synchronized
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-normal">
              Gemini models and DB embeddings active.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Core Engine Synchronized"></span>
          </div>
        )}
      </aside>
    </>
  );
}
