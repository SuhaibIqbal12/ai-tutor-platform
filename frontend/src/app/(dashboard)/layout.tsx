// frontend/src/app/(dashboard)/layout.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { getStoredToken, apiRequest } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const syncSupabaseAndVerify = async () => {
      try {
        // First check if we have a locally stored token. If so, verify it.
        const token = getStoredToken();
        if (token) {
          try {
            const data = await apiRequest("/api/auth/profile");
            if (data.status === "success" && data.data.profile) {
              localStorage.setItem("profile", JSON.stringify(data.data.profile));
              setLoading(false);
              return;
            } else {
              router.replace("/onboarding");
              return;
            }
          } catch (apiErr) {
            console.error("Failed to load user profile from local API:", apiErr);
            router.replace("/login");
            return;
          }
        }

        // If no token locally, try to get from Supabase (wrapped in try-catch so it doesn't crash us)
        try {
          const { supabase } = await import("@/lib/supabase");
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            localStorage.setItem("token", session.access_token);
            localStorage.setItem("email", session.user.email || "");
            
            const data = await apiRequest("/api/auth/profile");
            if (data.status === "success" && data.data.profile) {
              localStorage.setItem("profile", JSON.stringify(data.data.profile));
              setLoading(false);
              return;
            } else {
              router.replace("/onboarding");
              return;
            }
          }
        } catch (subErr) {
          console.warn("Supabase session sync failed/timed out, using local auth:", subErr);
        }

        // If neither worked, redirect to login
        router.replace("/login");
      } catch (err) {
        console.error("Failed to load user profile in layout:", err);
        router.replace("/login");
      }
    };

    syncSupabaseAndVerify();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500 tracking-wider">Synchronizing profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200 font-sans">
      {/* Shared Navbar top header */}
      <Navbar onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Shared Collapsible Sidebar */}
        <Sidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
