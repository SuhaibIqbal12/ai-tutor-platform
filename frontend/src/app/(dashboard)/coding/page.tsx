// frontend/src/app/(dashboard)/coding/page.tsx
"use client";

import React, { useState } from "react";
import { Terminal, Sparkles, Code2, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import CodeEditor from "@/components/CodeEditor";

export default function CodingPage() {
  const [lang, setLang] = useState("Python");
  const [topic, setTopic] = useState("Binary Search");
  const [diff, setDiff] = useState<"easy" | "medium" | "hard">("medium");

  // Exercise & Workspace States
  const [exercise, setExercise] = useState<any>(null);
  const [code, setCode] = useState("");
  const [review, setReview] = useState<any>(null);

  // Loading/Submission States
  const [loading, setLoading] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);

  const handleGenerateChallenge = async () => {
    setLoading(true);
    setReview(null);
    setExercise(null);

    try {
      const res = await apiRequest("/api/coding/exercise", "POST", {
        language: lang,
        topic,
        difficulty: diff,
      });
      if (res.status === "success") {
        setExercise(res.data);
        setCode(res.data.starterCode || "");
      }
    } catch (err: any) {
      alert("Failed to retrieve coding challenge: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!code || !exercise || submittingCode) return;

    setSubmittingCode(true);
    try {
      const res = await apiRequest("/api/coding/review", "POST", {
        language: lang,
        problemTitle: exercise.title,
        description: exercise.description,
        studentCode: code,
      });
      if (res.status === "success") {
        setReview(res.data);
      }
    } catch (err: any) {
      alert("Failed to evaluate submission: " + err.message);
    } finally {
      setSubmittingCode(false);
    }
  };

  const showHint = () => {
    if (!exercise?.hints || exercise.hints.length === 0) {
      alert("No hints available for this problem.");
      return;
    }
    alert(`Hints:\n${exercise.hints.map((h: string, i: number) => `${i + 1}. ${h}`).join("\n")}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Interactive Coding Mentor</h2>
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          Choose a language and data structure. Solve challenges in real time, and audit code complexity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 h-fit">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Terminal className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-foreground">Challenge Config</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Target Language
              </label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full px-3 py-2 bg-secondary/40 border border-border text-slate-300 text-xs focus:outline-none focus:border-indigo-500 rounded-xl transition-colors"
              >
                <option>Python</option>
                <option>JavaScript</option>
                <option>TypeScript</option>
                <option>Java</option>
                <option>C++</option>
                <option>SQL</option>
              </select>
            </div>

            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Topic or Algorithm
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground mt-1 shadow-inner"
                placeholder="Binary Search, Tree traversals..."
              />
            </div>

            <div>
              <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                Difficulty
              </label>
              <select
                value={diff}
                onChange={(e) => setDiff(e.target.value as any)}
                className="w-full px-3 py-2 bg-secondary/40 border border-border text-slate-300 text-xs focus:outline-none focus:border-indigo-500 rounded-xl transition-colors"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <button
              onClick={handleGenerateChallenge}
              disabled={loading || !topic.trim()}
              className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow disabled:opacity-50"
            >
              {loading ? "Synthesizing challenge..." : "Generate Coding Exercise"}
            </button>
          </div>
        </div>

        {/* Workspace Code Console */}
        <div className="lg:col-span-2 space-y-6">
          {exercise ? (
            <div className="space-y-4">
              {/* Exercise Description Box */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">{exercise.title}</h3>
                  <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 rounded text-[8px] font-bold uppercase tracking-wider">
                    {diff}
                  </span>
                </div>
                
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium">
                  {exercise.description}
                </p>

                {exercise.testCases?.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Sample Test Cases:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 text-[10px] text-foreground/75 font-semibold">
                      {exercise.testCases.map((tc: any, i: number) => (
                        <div key={i} className="p-3 bg-secondary/35 border border-border rounded-xl">
                          <div>
                            <span className="text-muted-foreground">Input:</span> {tc.input}
                          </div>
                          <div className="mt-1">
                            <span className="text-muted-foreground">Output:</span> {tc.expectedOutput}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Gutter Line Editor */}
              <div className="h-[380px] flex flex-col relative">
                <div className="absolute top-3 right-4 z-10 flex gap-2">
                  <button
                    onClick={showHint}
                    className="p-1.5 px-3 bg-slate-950 text-slate-450 hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer border border-slate-800 flex items-center gap-1 shadow"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Hint
                  </button>
                  <button
                    onClick={handleSubmitCode}
                    disabled={submittingCode}
                    className="p-1.5 px-3 bg-white text-slate-950 hover:bg-slate-100 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer shadow flex items-center gap-1"
                  >
                    {submittingCode ? (
                      <>
                        <div className="h-3 w-3 border border-slate-450 border-t-slate-950 rounded-full animate-spin"></div>
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Code2 className="h-3.5 w-3.5" />
                        Run & Verify
                      </>
                    )}
                  </button>
                </div>

                <CodeEditor value={code} onChange={setCode} language={lang} className="flex-1" />
              </div>

              {/* Code Review response */}
              {review && (
                <div
                  className={`p-6 border rounded-2xl shadow-sm space-y-4 transition-colors ${
                    review.isCorrect
                      ? "bg-emerald-500/10 border-emerald-500/25"
                      : "bg-red-500/10 border-red-500/25"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-2">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {review.isCorrect ? (
                        <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4.5 w-4.5 text-red-500 animate-pulse" />
                      )}
                      Assessment: {review.isCorrect ? "Correct Solution!" : "Logic Flaws Identified"}
                    </h4>
                    
                    <div className="flex gap-2">
                      <span className="text-[9px] font-bold bg-slate-950 dark:bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-850 uppercase tracking-wider font-mono">
                        Time: {review.timeComplexity}
                      </span>
                      <span className="text-[9px] font-bold bg-slate-950 dark:bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-850 uppercase tracking-wider font-mono">
                        Space: {review.spaceComplexity}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-foreground/80 leading-relaxed font-semibold">
                    {review.feedback}
                  </p>

                  {review.bugsFound?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider block">
                        Identified Logic Issues:
                      </span>
                      <ul className="list-disc pl-4 text-[10px] text-red-650 dark:text-red-400/90 space-y-1 font-medium leading-relaxed">
                        {review.bugsFound.map((b: string, i: number) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {review.optimizedSolution && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">
                        Optimized Reference Solution:
                      </span>
                      <pre className="p-3.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-[10px] font-mono whitespace-pre overflow-x-auto leading-relaxed shadow-inner">
                        {review.optimizedSolution}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4 py-16">
              <div className="p-4 bg-secondary rounded-2xl border border-border/40">
                <Code2 className="h-10 w-10 text-indigo-500 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-foreground">Launch Code Terminal</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure topic filters and details on the left, then click Generate. 
                Our AI Coding Mentor checks algorithmic bounds and complexity indices.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
