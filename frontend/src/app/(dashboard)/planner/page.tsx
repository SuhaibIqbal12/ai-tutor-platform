// frontend/src/app/(dashboard)/planner/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Sparkles, Clock, CheckCircle, ShieldAlert, Award } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function PlannerPage() {
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState("3");
  const [academicGoal, setAcademicGoal] = useState("Master current semester courses");
  const [studyPlan, setStudyPlan] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [fetchingLatest, setFetchingLatest] = useState(true);

  useEffect(() => {
    const fetchLatestPlan = async () => {
      try {
        const res = await apiRequest("/api/planner/latest");
        if (res.status === "success" && res.data.plan) {
          setStudyPlan(res.data.plan);
          
          // Pre-populate forms if plan exists
          if (res.data.plan.examDate) {
            const formattedDate = new Date(res.data.plan.examDate).toISOString().split("T")[0];
            setExamDate(formattedDate);
          }
        }
      } catch (err) {
        console.error("Failed to load latest study plan:", err);
      } finally {
        setFetchingLatest(false);
      }
    };
    fetchLatestPlan();
  }, []);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examDate || !dailyHours.trim() || !academicGoal.trim() || loading) return;

    setLoading(true);
    try {
      const res = await apiRequest("/api/planner/generate", "POST", {
        examDate,
        availableHours: dailyHours,
        academicGoal,
      });
      if (res.status === "success") {
        setStudyPlan(res.data);
      }
    } catch (err: any) {
      alert("Failed to build roadmap schedule: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingLatest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-4 border-slate-700 border-t-white dark:border-slate-800 dark:border-t-foreground rounded-full animate-spin"></div>
        <p className="text-xs text-muted-foreground font-semibold">Retrieving calendar milestones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Smart Study Planner</h2>
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          Generate daily routines and weekly milestones automatically calculated based on target exam dates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Form: Parameters */}
        <div className="md:col-span-1 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 h-fit">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <CalendarIcon className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-foreground">Planner Parameters</h3>
          </div>

          <form onSubmit={handleGeneratePlan} className="space-y-4">
            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Target Exam Date
              </label>
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground shadow-inner"
              />
            </div>

            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Daily Study Hours Available
              </label>
              <input
                type="number"
                min="1"
                max="24"
                required
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
                className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground shadow-inner"
                placeholder="e.g. 3"
              />
            </div>

            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Primary Academic Goal
              </label>
              <input
                type="text"
                required
                value={academicGoal}
                onChange={(e) => setAcademicGoal(e.target.value)}
                className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground mt-1 shadow-inner"
                placeholder="e.g. Score GPA > 9.0, Master algorithms"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow disabled:opacity-50"
            >
              {loading ? "Aligning modules..." : "Compile Study Calendar"}
            </button>
          </form>
        </div>

        {/* Right Panel: Plan Display */}
        <div className="md:col-span-2 space-y-6">
          {studyPlan ? (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
              <div className="border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground">{studyPlan.title}</h3>
                {studyPlan.examDate && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                    Target Exam: {new Date(studyPlan.examDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* 1. Daily routine */}
              {studyPlan.dailyPlan?.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Daily Task Schedule Checklist:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {studyPlan.dailyPlan.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-secondary/45 border border-border rounded-xl text-xs flex justify-between items-center text-foreground/80 hover:border-indigo-500/10 transition-colors"
                      >
                        <span className="font-bold text-foreground flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          {item.task}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-950 dark:bg-slate-800 text-slate-350 rounded text-[9px] font-bold font-mono shrink-0">
                          {item.durationMinutes} mins
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Weekly milestones roadmap */}
              {studyPlan.weeklyPlan?.length > 0 && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    4-Week Milestones Pathway:
                  </span>
                  <div className="space-y-3">
                    {studyPlan.weeklyPlan.map((wk: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 bg-secondary/40 border border-border rounded-xl text-xs space-y-2 hover:border-indigo-500/10 transition-colors animate-fade-in"
                      >
                        <div className="flex justify-between items-center gap-4 border-b border-border/40 pb-1.5 font-bold">
                          <span className="text-foreground">{wk.week}</span>
                          <span className="px-2 py-0.5 bg-secondary text-foreground text-[9px] rounded-lg border border-border uppercase tracking-wider">
                            {wk.focus}
                          </span>
                        </div>
                        <ul className="list-disc pl-4 text-muted-foreground space-y-1 mt-1 text-[11px] leading-relaxed font-semibold">
                          {wk.tasks?.map((t: string, i: number) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Monthly tasks */}
              {studyPlan.monthlyPlan?.length > 0 && (
                <div className="space-y-2.5 border-t border-border/60 pt-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Long-Term Core Milestones (3 Months):
                  </span>
                  <ul className="list-disc pl-5 text-xs text-foreground/80 space-y-1.5 font-semibold leading-relaxed">
                    {studyPlan.monthlyPlan.map((m: string, idx: number) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4 py-16">
              <CalendarIcon className="h-10 w-10 text-indigo-500 animate-pulse" />
              <h4 className="text-sm font-bold text-foreground">Schedules Generation</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Set target exam dates, goals, and daily study hours on the left to generate dynamic 
                calendars synced to your weaker categories automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
