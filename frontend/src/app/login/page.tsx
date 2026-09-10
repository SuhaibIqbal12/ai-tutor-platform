"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Mail, Lock, Sparkles, CheckCircle } from "lucide-react";
import { setStoredToken, setStoredEmail, getStoredToken } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect
    if (getStoredToken()) {
      const profile = localStorage.getItem("profile");
      if (profile) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let token = "";
      let userEmail = "";

      if (isLogin) {
        // Authenticate via local Express Sign In
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.message || "Authentication failed. Invalid email/password.");
        }
        token = resData.data.token;
        userEmail = resData.data.user.email || email;
      } else {
        // Register via local Express Sign Up
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.message || "Registration failed. Verify password complexity (at least 8 chars, 1 letter, 1 number).");
        }
        token = resData.data.token;
        userEmail = resData.data.user.email || email;
      }

      if (!token) {
        throw new Error("Authentication failed. No token returned.");
      }

      // Save token & email locally
      setStoredToken(token);
      setStoredEmail(userEmail);

      // Check if user profile exists in PostgreSQL
      const profileRes = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await profileRes.json();

      if (profileData.status === "success" && profileData.data.profile) {
        localStorage.setItem("profile", JSON.stringify(profileData.data.profile));
        // Trigger profile update event
        window.dispatchEvent(new Event("profileUpdated"));
        router.replace("/dashboard");
      } else {
        // Redirect to student profile onboarding wizard
        router.replace("/onboarding");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setError("");
    setLoading(true);
    try {
      const email = `${provider}-student@academy.com`;
      const password = "Password123"; // Meets zod requirements
      
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || "OAuth login stub failed.");
      }
      
      const token = resData.data.token;
      const userEmail = resData.data.user.email || email;

      setStoredToken(token);
      setStoredEmail(userEmail);

      const profileRes = await fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await profileRes.json();

      if (profileData.status === "success" && profileData.data.profile) {
        localStorage.setItem("profile", JSON.stringify(profileData.data.profile));
        window.dispatchEvent(new Event("profileUpdated"));
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    } catch (err: any) {
      setError(err.message || "Social login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-650/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-650/5 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000"></div>

      <div className="max-w-md w-full space-y-8 bg-slate-900/60 backdrop-blur-md p-8 rounded-2xl border border-slate-800 shadow-2xl z-10 transition-all duration-300">
        <div className="text-center">
          <div className="inline-flex p-3 bg-gradient-to-tr from-indigo-600 to-emerald-500 rounded-xl shadow-lg border border-slate-750/30 mb-4 animate-bounce">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            AI Learning Tutor
          </h2>
          <p className="mt-2 text-xs text-slate-400 font-medium max-w-xs mx-auto">
            Adaptive RAG-based companion & placement tutor
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              isLogin ? "bg-white text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              !isLogin ? "bg-white text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Create Account
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none transition-all duration-200 shadow-inner"
                  placeholder="student@academy.com"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none transition-all duration-200 shadow-inner"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/35 rounded-xl text-xs text-red-300 leading-normal flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 shrink-0 animate-ping"></span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-450 text-white rounded-xl shadow-lg hover:shadow-xl text-xs font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div>
                Authenticating...
              </>
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-2.5 text-slate-500 text-[10px] tracking-wider font-bold">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            className="flex items-center justify-center gap-2 py-2 px-4 bg-slate-950 border border-slate-800 hover:border-slate-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer hover:bg-slate-900"
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuthLogin("github")}
            className="flex items-center justify-center gap-2 py-2 px-4 bg-slate-950 border border-slate-800 hover:border-slate-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer hover:bg-slate-900"
          >
            GitHub
          </button>
        </div>

        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] text-slate-450 font-medium">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            Adaptive algorithms customize explaining styles
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-450 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Integrates mock ATS checker and coding logic
          </div>
        </div>
      </div>
    </div>
  );
}
