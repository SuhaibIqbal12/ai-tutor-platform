// frontend/src/components/Navbar.tsx
"use client";

import React, { useEffect, useState } from "react";
import { GraduationCap, LogOut, Menu, User } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { clearStoredAuth, getStoredEmail, getSystemHealth } from "@/lib/api";

interface NavbarProps {
  onMenuToggle?: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [cgpa, setCgpa] = useState<number | null>(null);
  
  const [health, setHealth] = useState<any>(null);
  const [showHealthCard, setShowHealthCard] = useState(false);

  useEffect(() => {
    // Read from localStorage to avoid hydration mismatch
    setEmail(getStoredEmail());
    try {
      const storedProfile = localStorage.getItem("profile");
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        setBranch(parsed.branch || "");
        setAcademicYear(parsed.academicYear || "");
        setCgpa(parsed.cgpa || null);
      }
    } catch (e) {
      console.error("Failed to parse stored profile", e);
    }

    // Custom event listener in case profile updates during onboarding
    const handleProfileUpdate = () => {
      try {
        const storedProfile = localStorage.getItem("profile");
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          setBranch(parsed.branch || "");
          setAcademicYear(parsed.academicYear || "");
          setCgpa(parsed.cgpa || null);
        }
      } catch (e) {}
    };

    window.addEventListener("profileUpdated", handleProfileUpdate);

    // Fetch System Health
    const fetchHealth = async () => {
      try {
        const res = await getSystemHealth();
        if (res && res.status === "success") {
          setHealth(res.data);
        }
      } catch (e) {
        console.error("Health check failed", e);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);

    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    clearStoredAuth();
    localStorage.removeItem("profile");
    window.location.href = "/login";
  };

  return (
    <header className="bg-card text-card-foreground border-b border-border py-3 px-6 shrink-0 flex items-center justify-between shadow-sm select-none z-30 transition-all duration-200">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border cursor-pointer transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-600 border border-indigo-700 rounded-xl hidden sm:block shadow-sm">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight leading-none text-foreground">Personalized AI Tutor</h1>
            <span className="text-[10px] text-muted-foreground mt-0.5 font-medium hidden sm:block">RAG • Adaptive Learning • Skill Tracking</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {email && (
          <div className="text-right hidden md:block">
            <div className="text-xs font-semibold text-foreground flex items-center justify-end gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              {email}
            </div>
            {branch && (
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                {branch} • {academicYear} {cgpa !== null ? `(CGPA: ${cgpa})` : ""}
              </div>
            )}
          </div>
        )}
        
        {/* System Health Indicator */}
        {health && (
          <div className="relative">
            <button
              onClick={() => setShowHealthCard(!showHealthCard)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg bg-secondary hover:bg-secondary/80 text-[11px] font-bold text-foreground cursor-pointer transition-all duration-150 shadow-sm"
            >
              <span className={`h-2 w-2 rounded-full ${
                health.database === "Disconnected" || health.redis === "Disconnected" || (!health.providers.gemini && !health.providers.groq && !health.providers.openrouter)
                  ? "bg-red-500 animate-pulse"
                  : !health.providers.gemini || !health.providers.groq || !health.providers.openrouter
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`} />
              <span className="hidden md:inline">System Health</span>
            </button>

            {showHealthCard && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl p-4 z-50 text-left">
                <h3 className="text-xs font-black border-b border-border pb-2 mb-2 text-foreground flex items-center justify-between">
                  <span>System Diagnostics</span>
                  <button 
                    onClick={() => setShowHealthCard(false)}
                    className="text-muted-foreground hover:text-foreground text-[10px]"
                  >
                    Close
                  </button>
                </h3>
                <div className="space-y-2.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">AI Provider:</span>
                    <span className="font-semibold text-foreground">{health.currentProvider}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/40 pt-2">
                    <span className="text-muted-foreground">Gemini API Key:</span>
                    <span className={`font-semibold ${health.providers.gemini ? "text-green-500" : "text-yellow-500"}`}>
                      {health.providers.gemini ? "Configured" : "Missing"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Groq API Key:</span>
                    <span className={`font-semibold ${health.providers.groq ? "text-green-500" : "text-yellow-500"}`}>
                      {health.providers.groq ? "Configured" : "Missing"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">OpenRouter Key:</span>
                    <span className={`font-semibold ${health.providers.openrouter ? "text-green-500" : "text-yellow-500"}`}>
                      {health.providers.openrouter ? "Configured" : "Missing"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/40 pt-2">
                    <span className="text-muted-foreground">Vector Database:</span>
                    <span className={`font-semibold ${health.database === "Connected" ? "text-green-500" : "text-red-500"}`}>
                      {health.database}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Embeddings Layer:</span>
                    <span className={`font-semibold ${health.database === "Connected" && health.providers.gemini ? "text-green-500" : "text-yellow-500"}`}>
                      {health.database === "Connected" && health.providers.gemini ? "Working" : "Degraded"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">RAG Retrieval:</span>
                    <span className={`font-semibold ${health.database === "Connected" ? "text-green-500" : "text-yellow-500"}`}>
                      {health.database === "Connected" ? "Working" : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                    <span>Latency: {health.latency}ms</span>
                    <a href="/diagnostics" className="text-indigo-500 hover:underline font-bold">Admin Panel</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <ThemeToggle />
        
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-bold text-foreground transition-all duration-200 cursor-pointer shadow-sm"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
