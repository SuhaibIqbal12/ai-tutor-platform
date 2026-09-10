// frontend/src/app/(dashboard)/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles, Brain, Award, BarChart3, Clock, Zap, Target, Flame,
  BookOpen, TrendingUp, Star, Coins, ShieldCheck, AlertCircle, RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/api";

interface DnaData {
  learningStyle: string;
  currentLevel: string;
  retentionRate: number;
  studyConsistency: number;
  confidenceLevel: number;
  learningVelocity: number;
  codingGrowthScore: number;
  placementReadiness: number;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  learningCoins: number;
  badges: string[];
}

interface AnalyticsData {
  streak: number;
  averageScore: number;
  masteredCount: number;
  documentsCount: number;
  dna: DnaData;
  aiFeedback: string;
  quizHistoryChart: { name: string; score: number }[];
  skillGrowthChart: { subject: string; A: number }[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  accentClass = "text-indigo-500",
  iconBg = "bg-indigo-50",
}: {
  icon: any;
  label: string;
  value: string | number;
  subtext?: string;
  accentClass?: string;
  iconBg?: string;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${iconBg} mb-3`}>
          <Icon className={`h-5 w-5 ${accentClass}`} />
        </div>
      </div>
      <div className={`text-2xl font-black tracking-tight ${accentClass}`}>{value}</div>
      <div className="text-xs font-bold text-slate-700 mt-1">{label}</div>
      {subtext && <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{subtext}</p>}
    </div>
  );
}

function ProgressBar({ label, value, color = "bg-indigo-500" }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
        <span className="text-[11px] font-black text-slate-800">{Math.round(value)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          style={{ width: `${Math.min(value, 100)}%` }}
          className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("/api/analytics/dashboard");
      if (res.status === "success") {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="relative">
          <div className="h-12 w-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          <Brain className="h-5 w-5 text-indigo-500 absolute inset-0 m-auto" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-700">Compiling your learning analytics...</p>
          <p className="text-xs text-slate-400 mt-1">Analyzing quiz history, mastery scores & DNA profile</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold text-slate-800">Dashboard Sync Error</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">{error || "Failed to query stats. Please try again."}</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const { dna } = data;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-bold text-indigo-100 uppercase tracking-widest">Learning Intelligence Hub</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Your Dashboard</h1>
            <p className="text-sm text-indigo-200 mt-1 font-medium">
              Personalized AI Tutor — Adaptive learning powered by your DNA profile
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* XP Pill */}
            <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 text-center backdrop-blur-sm">
              <div className="text-xs text-indigo-200 font-semibold">Level</div>
              <div className="text-xl font-black text-white">{dna.level}</div>
            </div>
            {/* Streak Pill */}
            <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 text-center backdrop-blur-sm">
              <div className="flex items-center gap-1 justify-center mb-0.5">
                <Flame className="h-3 w-3 text-amber-300" />
                <span className="text-xs text-indigo-200 font-semibold">Streak</span>
              </div>
              <div className="text-xl font-black text-white">{data.streak || dna.currentStreak}d</div>
            </div>
            {/* Coins Pill */}
            <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 text-center backdrop-blur-sm">
              <div className="flex items-center gap-1 justify-center mb-0.5">
                <Coins className="h-3 w-3 text-amber-300" />
                <span className="text-xs text-indigo-200 font-semibold">Coins</span>
              </div>
              <div className="text-xl font-black text-white">{dna.learningCoins}</div>
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-indigo-200 font-semibold mb-1.5">
            <span>XP Progress — Level {dna.level}</span>
            <span>{dna.xp} XP</span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min((dna.xp % 1000) / 10, 100)}%` }}
              className="h-full bg-white/80 rounded-full transition-all duration-700"
            />
          </div>
          <p className="text-[10px] text-indigo-300 mt-1">{1000 - (dna.xp % 1000)} XP to next level</p>
        </div>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Avg. Quiz Score"
          value={`${data.averageScore}%`}
          subtext="Average across all attempts"
          accentClass="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          icon={Star}
          label="Topics Mastered"
          value={data.masteredCount}
          subtext="Concepts with STRONG rating"
          accentClass="text-amber-500"
          iconBg="bg-amber-50"
        />
        <StatCard
          icon={BookOpen}
          label="Study Resources"
          value={data.documentsCount}
          subtext="Documents indexed in RAG engine"
          accentClass="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          icon={Zap}
          label="Learning Velocity"
          value={`${dna.learningVelocity}x`}
          subtext="Concept absorption rate vs baseline"
          accentClass="text-violet-600"
          iconBg="bg-violet-50"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Diagnostics */}
        <div className="lg:col-span-2 space-y-4">
          {/* Learning DNA */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Brain className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Learning DNA Profile</h3>
                <p className="text-[10px] text-slate-400">AI-computed biometric learning fingerprint</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">
                  {dna.currentLevel}
                </span>
                <span className="px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full text-[10px] font-bold border border-violet-100">
                  {dna.learningStyle}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <ProgressBar label="Retention Rate" value={dna.retentionRate} color="bg-indigo-500" />
              <ProgressBar label="Study Consistency" value={dna.studyConsistency} color="bg-emerald-500" />
              <ProgressBar label="Confidence Level" value={dna.confidenceLevel} color="bg-amber-400" />
              <ProgressBar label="Placement Readiness" value={dna.placementReadiness} color="bg-violet-500" />
              <ProgressBar label="Coding Growth Score" value={Math.min(dna.codingGrowthScore, 100)} color="bg-blue-500" />
            </div>
          </div>

          {/* Quiz Performance Chart */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Quiz Performance Trend</h3>
                <p className="text-[10px] text-slate-400">Last 10 quiz attempts — hover for details</p>
              </div>
            </div>
            {data.quizHistoryChart?.length > 0 ? (
              <div className="h-[180px] flex items-end justify-between gap-2 border-b border-l border-slate-100 pb-2 pl-2">
                {data.quizHistoryChart.map((q, i) => {
                  const score = Math.max(q.score, 4);
                  const color = q.score >= 80 ? "bg-emerald-500 hover:bg-emerald-400" : q.score >= 60 ? "bg-amber-400 hover:bg-amber-300" : "bg-red-400 hover:bg-red-300";
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <div
                        style={{ height: `${score}%` }}
                        className={`w-full ${color} transition-all duration-300 rounded-t-lg cursor-default relative`}
                        title={`${q.score}%`}
                      >
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {q.score}%
                        </span>
                      </div>
                      <span className="text-[8px] text-slate-400 font-mono">Q{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-8 w-8 text-slate-200 mb-3" />
                <p className="text-xs text-slate-400 font-medium">No quiz data yet</p>
                <p className="text-[10px] text-slate-300 mt-1">Complete quizzes to see your performance trend</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: AI Coach + Subject Mastery */}
        <div className="space-y-4">
          {/* AI Coach Feedback */}
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-indigo-100 rounded-lg">
                <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
              </div>
              <span className="text-xs font-black text-slate-800">AI Academic Coach</span>
            </div>
            <div className="w-full h-px bg-indigo-100 mb-3" />
            <p className="text-xs leading-relaxed text-slate-700 italic">
              &ldquo;{data.aiFeedback}&rdquo;
            </p>
          </div>

          {/* Subject Mastery */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Award className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800">Subject Mastery</h3>
                <p className="text-[10px] text-slate-400">From quiz evaluations</p>
              </div>
            </div>
            {data.skillGrowthChart?.length > 0 ? (
              <div className="space-y-3">
                {data.skillGrowthChart.map((skill, i) => {
                  const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-400", "bg-violet-500", "bg-blue-500", "bg-rose-400"];
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>{skill.subject}</span>
                        <span className="text-slate-400 font-mono">{skill.A}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${skill.A}%` }}
                          className={`h-full ${colors[i % colors.length]} rounded-full transition-all duration-500`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Take topic quizzes to track mastery</p>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-yellow-50 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-yellow-500" />
              </div>
              <span className="text-xs font-black text-slate-800">Achievement Badges</span>
            </div>
            {dna.badges?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dna.badges.map((badge, i) => (
                  <span key={i} className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold border border-amber-100">
                    🏆 {badge}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400">Complete challenges to earn badges</p>
                <div className="flex justify-center gap-2 mt-3 opacity-30">
                  {["🎯", "🚀", "⚡", "🏆"].map((e, i) => (
                    <span key={i} className="text-lg grayscale">{e}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
