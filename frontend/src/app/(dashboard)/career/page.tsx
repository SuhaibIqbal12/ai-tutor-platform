// frontend/src/app/(dashboard)/career/page.tsx
"use client";

import React, { useState } from "react";
import {
  Compass,
  FileBadge,
  MessageSquare,
  Award,
  TrendingUp,
  AlertTriangle,
  FileText,
  Star,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  CheckCircle2
} from "lucide-react";
import { apiRequest } from "@/lib/api";

function gradeColor(grade: string) {
  if (!grade) return "text-slate-400 bg-slate-500/10 border-slate-500/30";
  if (grade.startsWith("A")) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
  if (grade.startsWith("B")) return "text-blue-500 bg-blue-500/10 border-blue-500/30";
  if (grade.startsWith("C")) return "text-amber-500 bg-amber-500/10 border-amber-500/30";
  if (grade === "D") return "text-orange-500 bg-orange-500/10 border-orange-500/30";
  return "text-red-500 bg-red-500/10 border-red-500/30";
}

function scoreBarColor(score: number) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 6) return "bg-blue-500";
  if (score >= 4) return "bg-amber-500";
  return "bg-red-500";
}

function scoreChipColor(score: number) {
  if (score >= 8) return "bg-emerald-500/10 border-emerald-500/30 text-emerald-500";
  if (score >= 6) return "bg-blue-500/10 border-blue-500/30 text-blue-500";
  if (score >= 4) return "bg-amber-500/10 border-amber-500/30 text-amber-500";
  return "bg-red-500/10 border-red-500/30 text-red-500";
}

export default function CareerPage() {
  const [subTab, setSubTab] = useState<"roadmap" | "ats" | "interview" | "practice">("roadmap");
  const [loading, setLoading] = useState(false);
  const [customSkills, setCustomSkills] = useState("");
  const [roadmap, setRoadmap] = useState<any>(null);
  const [resumeRole, setResumeRole] = useState("Software Engineer");
  const [resumeText, setResumeText] = useState("");
  const [resumeAnalysis, setResumeAnalysis] = useState<any>(null);
  const [interviewType, setInterviewType] = useState<"Technical" | "HR">("Technical");
  const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
  const [interviewInput, setInterviewInput] = useState("");
  const [interviewerText, setInterviewerText] = useState(
    "Hello! Welcome to your mock interview. Tell me about a challenging project you have worked on."
  );
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [scorecard, setScorecard] = useState<any>(null);
  const [practiceType, setPracticeType] = useState<"aptitude" | "sql" | "system_design">("aptitude");
  const [challenge, setChallenge] = useState<any>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleGenerateRoadmap = async () => {
    setLoading(true); setRoadmap(null);
    const skillsArr = customSkills.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      const res = await apiRequest("/api/career/roadmap", "POST", { skills: skillsArr });
      if (res.status === "success") setRoadmap(res.data);
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setLoading(false); }
  };

  const handleAnalyzeResume = async () => {
    if (!resumeText.trim()) return;
    setLoading(true); setResumeAnalysis(null);
    try {
      const res = await apiRequest("/api/placement/resume", "POST", { resumeText, targetRole: resumeRole });
      if (res.status === "success") setResumeAnalysis(res.data.analysis);
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setLoading(false); }
  };

  const handleSendInterviewMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewInput.trim() || interviewLoading) return;
    const answer = interviewInput;
    setInterviewInput(""); setInterviewLoading(true);
    const nextHistory = [...interviewHistory, { role: "student" as const, text: answer }];
    setInterviewHistory(nextHistory);
    try {
      const res = await apiRequest("/api/placement/interview", "POST", { type: interviewType, history: nextHistory, studentAnswer: answer });
      if (res.status === "success") {
        setInterviewerText(res.data.interviewerMessage);
        setInterviewFeedback(res.data.feedback || "");
        setInterviewEnded(res.data.endSession);
        setInterviewHistory((prev) => [...prev, { role: "interviewer" as const, text: res.data.interviewerMessage }]);
        if (res.data.endSession && res.data.scorecard) setScorecard(res.data.scorecard);
      }
    } catch (err: any) { alert("Error: " + err.message); }
    finally { setInterviewLoading(false); }
  };

  const resetInterview = () => {
    setInterviewHistory([]); setInterviewFeedback(""); setInterviewEnded(false); setScorecard(null);
    setInterviewerText("Hello! Let's start a new session. Tell me about your technical strengths.");
  };

  const handleFetchChallenge = async () => {
    setLoading(true); setChallenge(null); setShowAnswer(false);
    try {
      const res = await apiRequest(`/api/placement/practice?type=${practiceType}`);
      if (res.status === "success") setChallenge(res.data);
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Career &amp; Placement Companion</h2>
        <p className="text-xs text-muted-foreground mt-1 font-medium">Simulate interviewer dialogues, check your resume against ATS bots, and generate stage roadmaps.</p>
      </div>

      <div className="flex bg-secondary/80 p-1.5 rounded-xl border border-border flex-wrap gap-1">
        {([["roadmap","AI Coach Roadmap"], ["ats","ATS Auditor"], ["interview","Mock Interview"], ["practice","Practice Hub"]] as [string,string][]).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key as any)}
            className={`flex-1 min-w-[110px] py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${subTab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ROADMAP */}
      {subTab === "roadmap" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 h-fit">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2">Select Focus Skills</h3>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Pre-existing Skills (comma separated)</label>
            <input type="text" value={customSkills} onChange={(e) => setCustomSkills(e.target.value)}
              className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground shadow-inner"
              placeholder="e.g. Git, React, SQL, Python" />
            <button onClick={handleGenerateRoadmap} disabled={loading}
              className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow disabled:opacity-50">
              {loading ? "Analyzing..." : "Generate Custom Roadmap"}
            </button>
          </div>
          <div className="lg:col-span-2 space-y-6">
            {roadmap ? (
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold border-b border-border pb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-indigo-400" />{roadmap.title}
                  </h3>
                  {roadmap.roadmapStages?.map((stage: any, i: number) => (
                    <div key={i} className="p-4 bg-secondary/40 border border-border rounded-xl text-xs space-y-1.5">
                      <span className="font-extrabold flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-bold">{i+1}</span>
                        {stage.stageName}
                      </span>
                      <p className="text-muted-foreground text-[11px] pl-7 leading-relaxed">{stage.description}</p>
                      {stage.recommendedSkills?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-7">{stage.recommendedSkills.map((s: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-secondary border border-border rounded text-[8px] font-bold uppercase">{s}</span>
                        ))}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-16 flex flex-col items-center text-center space-y-3">
                <Compass className="h-10 w-10 text-indigo-500 animate-pulse" />
                <h4 className="text-sm font-bold">Aesthetic Career Mapping</h4>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">Enter your skills on the left. AI generates a personalized milestone roadmap with gap analysis.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATS */}
      {subTab === "ats" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <FileBadge className="h-5 w-5 text-indigo-500" />
              <h3 className="text-sm font-bold">ATS Resume Scoring Bot</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Target Role</label>
                <input type="text" value={resumeRole} onChange={(e) => setResumeRole(e.target.value)}
                  className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground shadow-inner" />
                <button onClick={handleAnalyzeResume} disabled={loading || !resumeText.trim()}
                  className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow disabled:opacity-50">
                  {loading ? "Parsing..." : "Audit Resume Score"}
                </button>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                  <FileText className="h-3.5 w-3.5" /> Paste Plain Text Resume
                </label>
                <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={8}
                  className="w-full p-3 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground shadow-inner"
                  placeholder="Paste raw text from your PDF resume..." />
              </div>
            </div>
          </div>
          {resumeAnalysis && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-b border-border pb-5">
                <div className="text-center p-6 bg-secondary/40 border border-border rounded-2xl shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ATS Score</span>
                  <span className="text-4xl font-extrabold font-mono text-foreground mt-2 block">{resumeAnalysis.atsScore} / 100</span>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Coach Critique:</span>
                  <p className="text-xs text-foreground/80 leading-relaxed font-semibold">{resumeAnalysis.feedback}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-2">Key Improvements:</span>
                  <ul className="list-disc pl-4 text-xs text-foreground/80 space-y-1 font-medium">
                    {resumeAnalysis.improvements?.slice(0,4).map((imp: string, i: number) => <li key={i}>{imp}</li>)}
                  </ul>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-2">Missing Keywords:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {resumeAnalysis.missingKeywords?.map((kw: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[9px] font-bold uppercase">{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MOCK INTERVIEW */}
      {subTab === "interview" && (
        <div className="space-y-5">
          {/* Chat panel */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3 gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-foreground">Placement Mock Simulator</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Session Type:</span>
                <select value={interviewType} onChange={(e) => setInterviewType(e.target.value as any)}
                  disabled={interviewHistory.length > 0}
                  className="px-2.5 py-1 bg-secondary border border-border text-[10px] font-bold focus:outline-none rounded-lg disabled:opacity-50">
                  <option>Technical</option>
                  <option>HR</option>
                </select>
              </div>
            </div>

            <div className="bg-secondary/25 dark:bg-slate-950/20 border border-border rounded-2xl p-4 h-[320px] overflow-y-auto space-y-3">
              {interviewHistory.length === 0 ? (
                <div className="p-3.5 bg-card border border-border rounded-xl text-xs leading-relaxed font-medium">
                  <span className="font-bold text-indigo-500 block mb-1">Interviewer (AI):</span>
                  {interviewerText}
                </div>
              ) : interviewHistory.map((chat, i) => (
                <div key={i} className={`p-3.5 border rounded-xl text-xs leading-relaxed font-medium ${chat.role === "interviewer" ? "bg-card border-border text-foreground/85" : "bg-slate-950 text-white dark:bg-slate-900 border-transparent shadow-sm"}`}>
                  <span className={`font-bold block mb-1 ${chat.role === "interviewer" ? "text-indigo-500" : "text-slate-300"}`}>
                    {chat.role === "interviewer" ? "Interviewer:" : "You:"}
                  </span>
                  {chat.text}
                </div>
              ))}
              {interviewFeedback && !interviewEnded && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-600 dark:text-emerald-400 rounded-xl font-semibold leading-relaxed">
                  <span className="font-bold text-emerald-500 block mb-0.5">💬 Real-time Coaching Feedback:</span>
                  {interviewFeedback}
                </div>
              )}
              {interviewLoading && (
                <div className="p-3.5 bg-card border border-border rounded-xl text-xs text-muted-foreground animate-pulse font-medium">
                  <span className="font-bold text-indigo-500 block mb-1">Interviewer:</span>
                  Thinking...
                </div>
              )}
            </div>

            {!interviewEnded ? (
              <form onSubmit={handleSendInterviewMessage} className="flex gap-2">
                <input type="text" required disabled={interviewLoading} value={interviewInput}
                  onChange={(e) => setInterviewInput(e.target.value)}
                  placeholder="Type your response to the interviewer..."
                  className="flex-1 px-4 py-2.5 bg-secondary border border-border text-xs rounded-xl focus:outline-none focus:border-indigo-500 text-foreground shadow-inner disabled:opacity-50" />
                <button type="submit" disabled={interviewLoading || !interviewInput.trim()}
                  className="px-5 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow disabled:opacity-50">
                  {interviewLoading ? "Typing..." : "Send"}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Interview complete! Your scorecard is ready below.</span>
                </div>
                <button type="button" onClick={resetInterview}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-950 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 transition-colors cursor-pointer">
                  <RotateCcw className="h-3 w-3" /> New Session
                </button>
              </div>
            )}
          </div>

          {/* SCORECARD PANEL */}
          {interviewEnded && scorecard && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              {/* Header gradient */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                      Interview Scorecard · {interviewType} Round
                    </p>
                    <h3 className="text-xl font-extrabold tracking-tight">Session Performance Report</h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">AI-generated analysis of all your interview responses</p>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full border-4 border-indigo-500/50 bg-slate-900/60 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold font-mono leading-none">{scorecard.overallScore}</span>
                        <span className="text-[10px] text-slate-400 font-bold">/10</span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Score</p>
                    </div>
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-extrabold ${gradeColor(scorecard.grade)}`}>
                        {scorecard.grade}
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Grade</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Coach comment */}
                <div className="p-4 bg-secondary/40 border border-border rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-amber-500" /> Coach Overall Assessment
                  </p>
                  <p className="text-xs text-foreground/85 leading-relaxed font-medium">{scorecard.overallComment}</p>
                </div>

                {/* Strengths + Improvements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2.5">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ThumbsUp className="h-3.5 w-3.5" /> Strengths Observed
                    </p>
                    <ul className="space-y-2">
                      {scorecard.strengths?.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/80 font-medium">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2.5">
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ThumbsDown className="h-3.5 w-3.5" /> Areas to Improve
                    </p>
                    <ul className="space-y-2">
                      {scorecard.improvements?.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/80 font-medium">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Per-answer breakdown */}
                {scorecard.answerBreakdown?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                      Answer-by-Answer Breakdown
                    </p>
                    {scorecard.answerBreakdown.map((item: any, i: number) => (
                      <div key={i} className="p-4 bg-secondary/30 border border-border rounded-xl space-y-3 hover:border-indigo-500/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider leading-snug">Q{i+1}: {item.question}</p>
                            <p className="text-[11px] text-muted-foreground italic leading-relaxed">Your answer: &ldquo;{item.answer}&rdquo;</p>
                          </div>
                          <div className="shrink-0 text-center">
                            <div className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center font-extrabold text-base ${scoreChipColor(item.score)}`}>
                              {item.score}
                            </div>
                            <p className="text-[8px] font-bold text-muted-foreground mt-0.5">/10</p>
                          </div>
                        </div>
                        <div className="w-full bg-border/40 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full transition-all duration-700 ${scoreBarColor(item.score)}`} style={{ width: `${(item.score/10)*100}%` }} />
                        </div>
                        <p className="text-[10.5px] text-foreground/75 leading-relaxed font-medium border-t border-border/50 pt-2.5">
                          <span className="font-bold text-foreground/90">Feedback: </span>{item.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={resetInterview}
                  className="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow">
                  <RotateCcw className="h-3.5 w-3.5" /> Start New Interview Session
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRACTICE HUB */}
      {subTab === "practice" && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-3">
            <h3 className="text-sm font-bold">Placement Challenge Practice Hub</h3>
            <div className="flex items-center gap-2">
              <select value={practiceType} onChange={(e) => setPracticeType(e.target.value as any)}
                className="px-2.5 py-1 bg-secondary border border-border text-[10px] font-bold rounded-lg focus:outline-none">
                <option value="aptitude">Quantitative Aptitude</option>
                <option value="sql">SQL Practice</option>
                <option value="system_design">System Design</option>
              </select>
              <button type="button" onClick={handleFetchChallenge} disabled={loading}
                className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-lg text-[10px] font-bold transition-colors cursor-pointer shadow disabled:opacity-50">
                {loading ? "Loading..." : "Fetch Challenge"}
              </button>
            </div>
          </div>
          {challenge ? (
            <div className="space-y-4 text-xs leading-relaxed font-semibold">
              <h4 className="text-sm font-extrabold text-foreground">{challenge.title}</h4>
              <p className="bg-secondary/20 p-4 border border-border rounded-xl whitespace-pre-wrap text-foreground/90">{challenge.question}</p>
              {challenge.options?.length > 0 && (
                <div className="space-y-2 pl-3">
                  {challenge.options.map((opt: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 font-medium">
                      <span className="font-bold text-indigo-500 font-mono">{String.fromCharCode(65 + i)}.</span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-border pt-3">
                <button type="button" onClick={() => setShowAnswer(prev => !prev)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer">
                  {showAnswer ? "Hide Explanation" : "Reveal Answer & Explanation"}
                </button>
              </div>
              {showAnswer && (
                <div className="p-4 bg-slate-950 text-slate-200 rounded-xl space-y-3 font-medium text-[10px] border border-slate-800 shadow-inner">
                  {challenge.correctAnswerIndex !== -1 && challenge.correctAnswerIndex !== undefined && (
                    <div className="font-bold text-green-400">Correct Option: {String.fromCharCode(65 + challenge.correctAnswerIndex)}</div>
                  )}
                  <p className="leading-relaxed"><span className="font-bold text-slate-400 block mb-0.5">Explanation:</span>{challenge.explanation}</p>
                  {challenge.systemDesignRubric?.length > 0 && (
                    <div className="space-y-1.5 border-t border-slate-800 pt-2">
                      <span className="font-bold text-slate-400 block">Grading Rubric:</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                        {challenge.systemDesignRubric.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic py-10 text-center">
              Select a challenge type and click Fetch Challenge to begin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
