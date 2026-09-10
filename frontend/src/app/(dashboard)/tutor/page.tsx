// frontend/src/app/(dashboard)/tutor/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Send, Sparkles, ArrowRight, Bot, User, ChevronDown,
  BookOpen, Code2, Calculator, Globe, Cpu, Database, Shield, Layers,
  Network, Server, Terminal, Binary, Braces, FileCode2, MonitorSmartphone, Atom, GitBranch
} from "lucide-react";
import { setupStreamingTutor, Message } from "@/lib/api";
import { formatExplanations } from "@/components/CollapsiblePanel";

const SUBJECTS = [
  // General
  { value: "General", label: "General Tutor", icon: Sparkles, color: "text-indigo-600", bg: "bg-indigo-50", group: "General" },

  // BTech Core (Academics)
  { value: "Mathematics", label: "Engineering Mathematics", icon: Calculator, color: "text-blue-600", bg: "bg-blue-50", group: "BTech Core" },
  { value: "Physics", label: "Engineering Physics", icon: Atom, color: "text-purple-600", bg: "bg-purple-50", group: "BTech Core" },
  { value: "ComputerScience", label: "Computer Science Fundamentals", icon: Cpu, color: "text-slate-700", bg: "bg-slate-100", group: "BTech Core" },
  { value: "OperatingSystems", label: "Operating Systems", icon: Server, color: "text-orange-600", bg: "bg-orange-50", group: "BTech Core" },
  { value: "ComputerNetworks", label: "Computer Networks", icon: Network, color: "text-teal-600", bg: "bg-teal-50", group: "BTech Core" },
  { value: "DataStructures", label: "Data Structures & Algorithms", icon: Layers, color: "text-cyan-600", bg: "bg-cyan-50", group: "BTech Core" },
  { value: "Databases", label: "DBMS & SQL", icon: Database, color: "text-green-600", bg: "bg-green-50", group: "BTech Core" },

  // Programming Languages
  { value: "Python", label: "Python", icon: Terminal, color: "text-yellow-600", bg: "bg-yellow-50", group: "Programming Languages" },
  { value: "Java", label: "Java", icon: Binary, color: "text-red-600", bg: "bg-red-50", group: "Programming Languages" },
  { value: "JavaScript", label: "JavaScript", icon: Braces, color: "text-amber-500", bg: "bg-amber-50", group: "Programming Languages" },
  { value: "CPlusPlus", label: "C++", icon: FileCode2, color: "text-blue-700", bg: "bg-blue-50", group: "Programming Languages" },
  { value: "C", label: "C Language", icon: Code2, color: "text-slate-600", bg: "bg-slate-100", group: "Programming Languages" },
  { value: "HTMLCSS", label: "HTML & CSS", icon: MonitorSmartphone, color: "text-rose-600", bg: "bg-rose-50", group: "Programming Languages" },

  // Interview Prep
  { value: "SystemDesign", label: "System Design", icon: GitBranch, color: "text-violet-600", bg: "bg-violet-50", group: "Interview Prep" },
  { value: "MachineLearning", label: "Machine Learning & AI", icon: Bot, color: "text-pink-600", bg: "bg-pink-50", group: "Interview Prep" },
  { value: "WebDevelopment", label: "Full Stack Web Dev", icon: Globe, color: "text-emerald-600", bg: "bg-emerald-50", group: "Interview Prep" },
  { value: "CyberSecurity", label: "Cybersecurity", icon: Shield, color: "text-red-700", bg: "bg-red-50", group: "Interview Prep" },
];

const SUBJECT_GROUPS = ["General", "BTech Core", "Programming Languages", "Interview Prep"];

export default function TutorPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("General");
  const [ragEnabled, setRagEnabled] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const subjectPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSubject = SUBJECTS.find(s => s.value === subject) || SUBJECTS[0];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close subject picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (subjectPickerRef.current && !subjectPickerRef.current.contains(e.target as Node)) {
        setShowSubjectPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userQuestion = input;
    setInput("");
    setStreaming(true);
    setShowSubjectPicker(false);

    const updatedMessages = [...messages, { role: "user" as const, content: userQuestion }];
    setMessages(updatedMessages);
    setMessages((prev) => [...prev, { role: "model" as const, content: "..." }]);

    let receivedText = "";

    const cleanup = setupStreamingTutor({
      question: userQuestion,
      conversationId,
      ragMode: ragEnabled,
      subject,
      onMeta: (meta) => { setConversationId(meta.conversationId); },
      onContent: (text) => {
        receivedText += text;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "model", content: receivedText };
          return next;
        });
      },
      onError: (err) => {
        cleanup();
        setStreaming(false);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "model", content: `⚠️ Connection issue: ${err}` };
          return next;
        });
      },
      onDone: () => {
        cleanup();
        setStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      },
    });
  };

  const handleLaunchQuiz = (topic: string) => {
    sessionStorage.setItem("pendingQuizTopic", topic);
    router.push("/quizzes");
  };

  const SUGGESTIONS = [
    "Explain Binary Search Trees with examples",
    `Solve a ${currentSubject.label} problem step by step`,
    "What are the top interview questions on this topic?",
    "Give me a visual analogy for this concept",
  ];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 bg-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800">AI Tutoring Workspace</h2>
            <p className="text-[10px] text-slate-400 font-medium">
              Adaptive depth • 11-section format • Personalized to your Learning DNA
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Subject Picker */}
          <div className="relative" ref={subjectPickerRef}>
            <button
              type="button"
              onClick={() => setShowSubjectPicker(!showSubjectPicker)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                showSubjectPicker ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
              }`}
            >
              <currentSubject.icon className={`h-3.5 w-3.5 ${currentSubject.color}`} />
              <span className="hidden sm:inline">{currentSubject.label}</span>
              <span className="sm:hidden">Subject</span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showSubjectPicker ? "rotate-180" : ""}`} />
            </button>

            {showSubjectPicker && (
              <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-72 max-h-80 overflow-y-auto">
                {SUBJECT_GROUPS.map(group => {
                  const groupSubjects = SUBJECTS.filter(s => s.group === group);
                  return (
                    <div key={group} className="mb-3 last:mb-0">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1.5">{group}</div>
                      {groupSubjects.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => { setSubject(s.value); setShowSubjectPicker(false); }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer text-left ${
                            subject === s.value ? `${s.bg} ${s.color} font-bold` : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <s.icon className={`h-3.5 w-3.5 ${s.color} shrink-0`} />
                          {s.label}
                          {subject === s.value && <span className="ml-auto text-[8px] font-black bg-white rounded px-1.5 py-0.5 border border-current">ACTIVE</span>}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RAG Toggle */}
          <button
            type="button"
            onClick={() => setRagEnabled(!ragEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
              ragEnabled
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200"
            }`}
          >
            <BookOpen className={`h-3.5 w-3.5 ${ragEnabled ? "text-emerald-600" : "text-slate-400"}`} />
            <span className="hidden sm:inline">RAG Context</span>
            <div className={`h-4 w-7 rounded-full transition-all duration-300 ${ragEnabled ? "bg-emerald-400" : "bg-slate-200"} relative`}>
              <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${ragEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 py-12">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="p-3 bg-indigo-600 rounded-xl w-fit mx-auto mb-3">
                <currentSubject.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-base font-black text-slate-800">{currentSubject.label} Tutor</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
                Ask anything about {currentSubject.label}. Your AI tutor adapts explanations to your learning style, level, and knowledge gaps.
              </p>
            </div>

            {/* Quick suggestions */}
            <div className="w-full space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick Start</p>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(s)}
                  className="w-full text-left px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 font-medium hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all duration-150 cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === "user"
                    ? "bg-slate-800 text-white"
                    : "bg-indigo-600 text-white"
                }`}
              >
                {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl text-xs leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-slate-800 text-white px-4 py-3 rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 px-5 py-4 rounded-tl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                ) : msg.content === "..." ? (
                  <div className="flex items-center gap-2 py-1">
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>{formatExplanations(msg.content)}</div>

                    {/* Quiz CTA on last tutor message */}
                    {!streaming && idx === messages.length - 1 && (
                      <div className="border-t border-slate-100 pt-3 mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 italic flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-amber-400" />
                          Ready to test your understanding?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const lastUserMsg = messages.slice().reverse().find(m => m.role === "user");
                            if (lastUserMsg) handleLaunchQuiz(lastUserMsg.content);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-all shrink-0"
                        >
                          Take Reinforcement Quiz <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-slate-100 p-4 shrink-0 bg-white">
        {/* Active subject badge */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${currentSubject.bg} border border-current/20`}>
            <currentSubject.icon className={`h-3 w-3 ${currentSubject.color}`} />
            <span className={`text-[10px] font-bold ${currentSubject.color}`}>{currentSubject.label}</span>
          </div>
          {ragEnabled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
              <BookOpen className="h-3 w-3 text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-600">RAG Active</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2.5">
          <input
            ref={inputRef}
            type="text"
            required
            disabled={streaming}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              streaming
                ? "AI Tutor is responding..."
                : `Ask your ${currentSubject.label} tutor anything...`
            }
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-400 focus:bg-white text-slate-800 placeholder-slate-400 disabled:opacity-50 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
