"use client";
import { errorMessage } from "@/lib/contracts";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Code2 } from "lucide-react";
import Brand from "@/components/Brand";
import Link from "next/link";
import { setStoredToken, setStoredEmail, getStoredToken } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          throw new Error(
            resData.message || "Authentication failed. Invalid email/password.",
          );
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
          throw new Error(
            resData.message ||
              "Registration failed. Verify password complexity (at least 8 chars, 1 letter, 1 number).",
          );
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
        localStorage.setItem(
          "profile",
          JSON.stringify(profileData.data.profile),
        );
        // Trigger profile update event
        window.dispatchEvent(new Event("profileUpdated"));
        router.replace("/dashboard");
      } else {
        // Redirect to student profile onboarding wizard
        router.replace("/onboarding");
      }
    } catch (err: unknown) {
      setError(errorMessage(err) || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setError("");
    if (!supabase) {
      setError("Social sign-in is not configured. Use email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Social sign-in failed.",
      );
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      setStoredToken(session.access_token);
      setStoredEmail(session.user.email || "");
      router.replace("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <p className="eyebrow">LESS DISTRACTION. MORE UNDERSTANDING.</p>
          <h1>
            A space to learn.
            <br />
            At your own pace.
          </h1>
          <p>
            Your material, your questions, your next step. Keep them together in
            one thoughtful workspace.
          </p>
          <div className="mt-10">
            {[
              {
                title: "Bring what you’re studying",
                text: "Chapters, lecture notes, documents and videos.",
              },
              {
                title: "Make sense of the difficult parts",
                text: "Ask questions and revisit the supporting material.",
              },
              {
                title: "Put understanding into practice",
                text: "Quizzes, coding challenges and a study plan.",
              },
            ].map((step, i) => (
              <div className="auth-story-step" key={step.title}>
                <span>0{i + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="auth-footer">
          Personalized Tutor · Built around your learning
        </p>
      </section>
      <section className="auth-form-pane">
        <div className="auth-form">
          <p className="eyebrow">YOUR LEARNING WORKSPACE</p>
          <h2>{isLogin ? "Welcome back." : "Make room for learning."}</h2>
          <p>
            {isLogin
              ? "Sign in to pick up where you left off."
              : "Create an account and start with your first question."}
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email" className="field-label">
              Email address
            </label>
            <input
              id="email"
              className="field"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                className="field pr-11"
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                minLength={isLogin ? undefined : 8}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  isLogin ? "Enter your password" : "Create a password"
                }
              />
              <button
                type="button"
                className="icon-button absolute right-1 top-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {!isLogin && (
              <p className="field-hint">
                At least 8 characters, including a letter and a number.
              </p>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="button-primary w-full mt-6"
            >
              {loading
                ? "Please wait…"
                : isLogin
                  ? "Sign in"
                  : "Create account"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>
          {supabase && (
            <>
              <div className="auth-divider">or continue with</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={loading}
                  className="button-secondary"
                  onClick={() => handleOAuthLogin("google")}
                >
                  <span className="font-semibold">G</span>Google
                </button>
                <button
                  disabled={loading}
                  className="button-secondary"
                  onClick={() => handleOAuthLogin("github")}
                >
                  <Code2 size={16} />
                  GitHub
                </button>
              </div>
            </>
          )}
          <p className="auth-switch">
            {isLogin ? "New here?" : "Already have an account?"}{" "}
            <button
              disabled={loading}
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
          <div className="border-t border-border mt-8 pt-5 text-center">
            <Link href="/" className="text-xs text-muted-foreground">
              ← Back to Tutor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
