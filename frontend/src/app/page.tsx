// frontend/src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredToken } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      // Check if profile exists, otherwise onboard
      const profile = localStorage.getItem("profile");
      if (profile) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-4 border-slate-700 border-t-white rounded-full animate-spin"></div>
        <span className="text-xs font-semibold text-slate-450 tracking-wider">Synchronizing AI environment...</span>
      </div>
    </div>
  );
}
