"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import {
  getStoredToken,
  apiRequest,
  setStoredToken,
  setStoredEmail,
} from "@/lib/api";
import { errorMessage } from "@/lib/contracts";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeMenu = useCallback(() => setMobileSidebarOpen(false), []);
  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        if (!getStoredToken()) {
          const { supabase } = await import("@/lib/supabase");
          const result = await supabase?.auth.getSession();
          const session = result?.data.session;
          if (session) {
            setStoredToken(session.access_token);
            setStoredEmail(session.user.email || "");
          }
        }
        if (!getStoredToken()) {
          router.replace("/login");
          return;
        }
        const data = await apiRequest("/api/auth/profile");
        if (!active) return;
        if (data.status !== "success")
          throw new Error("We couldn't load your profile.");
        if (!data.data.profile) {
          router.replace("/onboarding");
          return;
        }
        localStorage.setItem("profile", JSON.stringify(data.data.profile));
        setLoading(false);
      } catch (err) {
        if (!active) return;
        if (!getStoredToken()) {
          router.replace("/login");
          return;
        }
        setError(errorMessage(err));
        setLoading(false);
      }
    };
    void verify();
    return () => {
      active = false;
    };
  }, [router]);
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center">
          <div className="h-6 w-6 border-2 border-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Opening your workspace…
          </p>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <section className="panel max-w-md p-8">
          <p className="eyebrow">CONNECTION INTERRUPTED</p>
          <h1 className="text-xl font-semibold mt-3">
            Your workspace couldn’t load.
          </h1>
          <p className="text-sm text-muted-foreground mt-3 mb-6" role="alert">
            {error}
          </p>
          <div className="flex gap-3">
            <button
              className="button-primary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <Link href="/login" className="button-secondary">
              Back to sign in
            </Link>
          </div>
        </section>
      </div>
    );
  return (
    <div className="workspace-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={closeMenu}
        isCollapsed={sidebarCollapsed && !mobileSidebarOpen}
        onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="workspace-body">
        <Navbar
          menuOpen={mobileSidebarOpen}
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />
        <main id="main-content" className="workspace-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
