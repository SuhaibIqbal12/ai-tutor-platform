// frontend/src/app/(dashboard)/quizzes/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  PlayCircle,
  CheckSquare,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  History
} from "lucide-react";
import { apiRequest, Quiz, QuizQuestion } from "@/lib/api";

export default function QuizzesPage() {
  // Heatmap & revision states
  const [heatmap, setHeatmap] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [revisionPlan, setRevisionPlan] = useState("");
  
  // Quiz creation states
  const [quizTopic, setQuizTopic] = useState("");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mcqSelectedIdx, setMcqSelectedIdx] = useState<number | null>(null);
  const [subjectiveAns, setSubjectiveAns] = useState("");
  
  // Report states
  const [quizReport, setQuizReport] = useState<any>(null);
  
  // General UI states
  const [loading, setLoading] = useState(false);
  const [generatingRevision, setGeneratingRevision] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  const fetchRevisionData = async () => {
    try {
      const heatRes = await apiRequest("/api/revision/heatmap");
      if (heatRes.status === "success") {
        setHeatmap(heatRes.data);
      }

      const histRes = await apiRequest("/api/quiz/history");
      if (histRes.status === "success") {
        setHistory(histRes.data.history);
      }
    } catch (err) {
      console.error("Failed to fetch revision analytics:", err);
    }
  };

  useEffect(() => {
    fetchRevisionData();

    // Check for pre-populated topic from tutor companion redirections
    if (typeof window !== "undefined") {
      const pendingTopic = sessionStorage.getItem("pendingQuizTopic");
      if (pendingTopic) {
        setQuizTopic(pendingTopic);
        sessionStorage.removeItem("pendingQuizTopic");
      }
    }
  }, []);

  const handleGenerateRevisionPlan = async () => {
    setGeneratingRevision(true);
    try {
      const planRes = await apiRequest("/api/revision/plan");
      if (planRes.status === "success") {
        setRevisionPlan(planRes.data.plan);
      }
    } catch (err: any) {
      alert("AI Planner failure: " + err.message);
    } finally {
      setGeneratingRevision(false);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTopic.trim() || loading) return;

    setLoading(true);
    setQuizReport(null);

    // Auto-detect coding keywords to pass parameter
    const codingKeywords = [
      "javascript", "typescript", "python", "java", "c++", "sql", 
      "react", "angular", "node", "data structures", "algorithms"
    ];
    const isCoding = codingKeywords.some((key) => quizTopic.toLowerCase().includes(key));

    try {
      const quizRes = await apiRequest("/api/quiz/generate", "POST", {
        topic: quizTopic,
        isCodingTopic: isCoding,
      });
      if (quizRes.status === "success") {
        setActiveQuiz(quizRes.data);
        setUserAnswers(new Array(quizRes.data.questions.length).fill(""));
        setCurrentIdx(0);
        setMcqSelectedIdx(null);
        setSubjectiveAns("");
      }
    } catch (err: any) {
      alert("Failed to compile quiz: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!activeQuiz) return;
    const questions = activeQuiz.questions;
    const currentQ = questions[currentIdx];

    // Store current response
    const copyAnswers = [...userAnswers];
    if (currentQ.type === "mcq" || currentQ.type === "tf") {
      copyAnswers[currentIdx] = mcqSelectedIdx;
    } else {
      copyAnswers[currentIdx] = subjectiveAns;
    }
    setUserAnswers(copyAnswers);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      setMcqSelectedIdx(null);
      setSubjectiveAns("");
    } else {
      // Grade quiz attempts
      setSubmittingQuiz(true);
      try {
        const gradeRes = await apiRequest("/api/quiz/submit", "POST", {
          quizId: activeQuiz.quizId,
          answers: copyAnswers,
        });
        if (gradeRes.status === "success") {
          setQuizReport(gradeRes.data);
          setActiveQuiz(null);
          fetchRevisionData();
        }
      } catch (err: any) {
        alert("Failed to grade test: " + err.message);
      } finally {
        setSubmittingQuiz(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Adaptive Tests & Revision Planner</h2>
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          Identify weaker categories via Spaced Repetition Heatmaps, compile custom test tiers, and generate guidance roadmaps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Heatmap / revision */}
        <div className="md:col-span-1 space-y-6">
          {/* Heatmap module */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              Spaced Repetition Heatmap
            </h3>

            {heatmap ? (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {heatmap.rawList.map((item: any, idx: number) => {
                    let colorClass = "bg-yellow-400 dark:bg-yellow-500/80";
                    if (item.status === "STRONG") colorClass = "bg-emerald-500 dark:bg-emerald-600/80";
                    else if (item.status === "WEAK") colorClass = "bg-red-500 dark:bg-red-650/80";

                    return (
                      <div
                        key={idx}
                        title={`${item.topic}: ${item.status}`}
                        className={`h-8 rounded-lg cursor-pointer ${colorClass} transition-all duration-200 hover:scale-105 flex items-center justify-center text-[10px] text-white font-bold font-mono shadow-sm`}
                      >
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[9px] border-t border-border pt-3 text-muted-foreground font-semibold uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Strong
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-yellow-400"></span> Mid
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-500"></span> Weak
                  </div>
                </div>

                {heatmap.categories.weak.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-3">
                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Critical Weak Areas:
                    </span>
                    <ul className="list-disc pl-4 text-[10px] text-red-650 dark:text-red-400/90 space-y-0.5 font-medium leading-relaxed">
                      {heatmap.categories.weak.map((topic: string, i: number) => (
                        <li key={i}>{topic}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground italic py-6 text-center">
                Submit test evaluations to map spaced repetition mastery.
              </div>
            )}
          </div>

          {/* AI Planner module */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 flex items-center gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
              AI Reinforcement Agent
            </h3>
            
            {revisionPlan ? (
              <div className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap max-h-[220px] overflow-y-auto pr-1 bg-secondary/20 p-3.5 rounded-xl border border-border">
                {revisionPlan}
              </div>
            ) : (
              <button
                onClick={handleGenerateRevisionPlan}
                disabled={generatingRevision}
                className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow disabled:opacity-50"
              >
                {generatingRevision ? "Synthesizing masteries..." : "Compile Revision Blueprint"}
              </button>
            )}
          </div>
        </div>

        {/* Right column: Test Area / Reports */}
        <div className="md:col-span-2 space-y-6">
          {/* Quiz compilation form */}
          {!activeQuiz && !quizReport && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <PlayCircle className="h-5 w-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-foreground">Launch Custom Evaluation</h3>
              </div>

              <form onSubmit={handleCreateQuiz} className="space-y-4">
                <div>
                  <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                    Target Topic
                  </label>
                  <input
                    type="text"
                    required
                    value={quizTopic}
                    onChange={(e) => setQuizTopic(e.target.value)}
                    className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground mt-1 shadow-inner"
                    placeholder="e.g. Mitochondria, Quicksort complexity, Organic synthesis"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow disabled:opacity-50"
                >
                  {loading ? "Structuring questions..." : "Compile 8-Question Adaptive Quiz"}
                </button>
              </form>
            </div>
          )}

          {/* Active Quiz Question Card */}
          {activeQuiz && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-border pb-3 gap-4">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider truncate">
                  Topic: {activeQuiz.topic}
                </h3>
                <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                  Question {currentIdx + 1} of {activeQuiz.questions.length} (
                  {String(activeQuiz.questions[currentIdx]?.difficulty || "medium").toUpperCase()})
                </span>
              </div>

              <div className="space-y-4">
                <div className="text-xs sm:text-sm font-bold text-foreground leading-relaxed">
                  {activeQuiz.questions[currentIdx]?.question}
                </div>

                {/* Optional starter code block */}
                {activeQuiz.questions[currentIdx]?.codingTemplate && (
                  <pre className="p-3.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs font-mono whitespace-pre overflow-x-auto">
                    {activeQuiz.questions[currentIdx].codingTemplate}
                  </pre>
                )}

                {/* Options rendering (MCQ/TF) */}
                {activeQuiz.questions[currentIdx].type === "mcq" ||
                activeQuiz.questions[currentIdx].type === "tf" ? (
                  <div className="grid grid-cols-1 gap-2">
                    {activeQuiz.questions[currentIdx].options?.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMcqSelectedIdx(idx)}
                        className={`text-left p-3 text-xs border rounded-xl transition-all duration-200 font-medium cursor-pointer ${
                          mcqSelectedIdx === idx
                            ? "bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm scale-[1.01]"
                            : "bg-secondary/40 hover:bg-secondary/80 border-border text-foreground/80"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}. {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  // Subjective or FITB (Fill in the blanks)
                  <div className="space-y-2">
                    <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block">
                      Your Response
                    </label>
                    {activeQuiz.questions[currentIdx].type === "fitb" ? (
                      <input
                        type="text"
                        value={subjectiveAns}
                        onChange={(e) => setSubjectiveAns(e.target.value)}
                        className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground shadow-inner"
                        placeholder="Type answer phrase..."
                      />
                    ) : (
                      <textarea
                        value={subjectiveAns}
                        onChange={(e) => setSubjectiveAns(e.target.value)}
                        className="w-full p-3 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground shadow-inner"
                        rows={4}
                        placeholder="Explain reasoning or write solution implementation code..."
                      />
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={submittingQuiz}
                className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow"
              >
                {submittingQuiz
                  ? "Evaluating performance..."
                  : currentIdx < activeQuiz.questions.length - 1
                  ? "Next Question"
                  : "Submit and Calculate Score"}
              </button>
            </div>
          )}

          {/* Quiz Report Card */}
          {quizReport && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="text-center space-y-2 border-b border-border pb-5">
                <Award className="h-10 w-10 text-indigo-500 mx-auto" />
                <h3 className="text-lg font-bold text-foreground">Score Assessment Card</h3>
                <div className="text-3xl font-extrabold text-foreground font-mono">
                  {quizReport.score} / {quizReport.totalCount}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {quizReport.percentage}% proficiency rate
                </p>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {quizReport.gradedQuestions.map((q: any, i: number) => (
                  <div
                    key={i}
                    className={`p-4 border rounded-xl space-y-2 ${
                      q.isCorrect
                        ? "bg-emerald-500/10 border-emerald-500/25"
                        : "bg-red-500/10 border-red-500/25"
                    }`}
                  >
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Question {i + 1} ({String(q.difficulty || "medium").toUpperCase()})
                    </span>
                    <p className="text-xs font-bold text-foreground leading-normal">{q.question}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Your answer choice:{" "}
                      <span className="font-bold text-foreground">
                        {q.type === "mcq" || q.type === "tf"
                          ? q.options?.[q.studentAnswer] || "None"
                          : q.studentAnswer}
                      </span>
                    </p>
                    <p className="text-[11px] text-foreground/80 border-t border-border/50 pt-1.5 leading-relaxed">
                      <span className="font-bold text-indigo-500">Critique:</span> {q.feedback}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      <span className="font-bold">Correct Concept:</span> {q.explanation}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setQuizReport(null)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-850 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow"
              >
                Compile Next Quiz
              </button>
            </div>
          )}

          {/* Quiz Attempt history scorecard list */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 flex items-center gap-1.5">
              <History className="h-4.5 w-4.5 text-indigo-400" />
              Evaluation History log
            </h3>
            <div className="max-h-[220px] overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-8 text-center">
                  No submissions recorded.
                </div>
              ) : (
                <ul className="space-y-2">
                  {history.map((attempt, idx) => {
                    const pass = attempt.percentage >= 70;
                    return (
                      <li
                        key={idx}
                        className="p-3 bg-secondary/40 border border-border rounded-xl flex items-center justify-between text-xs hover:border-indigo-500/20 transition-all duration-200"
                      >
                        <div>
                          <span className="font-bold text-foreground">{attempt.topic}</span>
                          <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                            Attempted: {new Date(attempt.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[9px] font-bold font-mono ${
                            pass ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {attempt.score}/{attempt.totalCount} ({attempt.percentage}%)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
