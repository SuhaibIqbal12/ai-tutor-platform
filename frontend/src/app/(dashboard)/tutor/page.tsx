// frontend/src/app/(dashboard)/tutor/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Send,
  Sparkles,
  ArrowRight,
  Bot,
  User,
  ChevronDown,
  BookOpen,
  Code2,
  Calculator,
  Globe,
  Cpu,
  Database,
  Shield,
  Layers,
  Network,
  Server,
  Terminal,
  Binary,
  Braces,
  FileCode2,
  MonitorSmartphone,
  Atom,
  GitBranch,
} from "lucide-react";
import {
  setupStreamingTutor,
  apiRequest,
  DocumentSource,
  Message,
  getStoredEmail,
} from "@/lib/api";
import { formatExplanations } from "@/components/CollapsiblePanel";

const SUBJECTS = [
  // General
  {
    value: "General",
    label: "General Tutor",
    icon: Sparkles,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    group: "General",
  },

  // BTech Core (Academics)
  {
    value: "Mathematics",
    label: "Engineering Mathematics",
    icon: Calculator,
    color: "text-blue-600",
    bg: "bg-blue-50",
    group: "BTech Core",
  },
  {
    value: "Physics",
    label: "Engineering Physics",
    icon: Atom,
    color: "text-purple-600",
    bg: "bg-purple-50",
    group: "BTech Core",
  },
  {
    value: "ComputerScience",
    label: "Computer Science Fundamentals",
    icon: Cpu,
    color: "text-foreground",
    bg: "bg-secondary",
    group: "BTech Core",
  },
  {
    value: "OperatingSystems",
    label: "Operating Systems",
    icon: Server,
    color: "text-orange-600",
    bg: "bg-orange-50",
    group: "BTech Core",
  },
  {
    value: "ComputerNetworks",
    label: "Computer Networks",
    icon: Network,
    color: "text-teal-600",
    bg: "bg-teal-50",
    group: "BTech Core",
  },
  {
    value: "DataStructures",
    label: "Data Structures & Algorithms",
    icon: Layers,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    group: "BTech Core",
  },
  {
    value: "Databases",
    label: "DBMS & SQL",
    icon: Database,
    color: "text-green-600",
    bg: "bg-green-50",
    group: "BTech Core",
  },

  // Programming Languages
  {
    value: "Python",
    label: "Python",
    icon: Terminal,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    group: "Programming Languages",
  },
  {
    value: "Java",
    label: "Java",
    icon: Binary,
    color: "text-red-600",
    bg: "bg-red-50",
    group: "Programming Languages",
  },
  {
    value: "JavaScript",
    label: "JavaScript",
    icon: Braces,
    color: "text-amber-500",
    bg: "bg-amber-50",
    group: "Programming Languages",
  },
  {
    value: "CPlusPlus",
    label: "C++",
    icon: FileCode2,
    color: "text-blue-700",
    bg: "bg-blue-50",
    group: "Programming Languages",
  },
  {
    value: "C",
    label: "C Language",
    icon: Code2,
    color: "text-muted-foreground",
    bg: "bg-secondary",
    group: "Programming Languages",
  },
  {
    value: "HTMLCSS",
    label: "HTML & CSS",
    icon: MonitorSmartphone,
    color: "text-rose-600",
    bg: "bg-rose-50",
    group: "Programming Languages",
  },

  // Interview Prep
  {
    value: "SystemDesign",
    label: "System Design",
    icon: GitBranch,
    color: "text-violet-600",
    bg: "bg-violet-50",
    group: "Interview Prep",
  },
  {
    value: "MachineLearning",
    label: "Machine Learning & AI",
    icon: Bot,
    color: "text-pink-600",
    bg: "bg-pink-50",
    group: "Interview Prep",
  },
  {
    value: "WebDevelopment",
    label: "Full Stack Web Dev",
    icon: Globe,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    group: "Interview Prep",
  },
  {
    value: "CyberSecurity",
    label: "Cybersecurity",
    icon: Shield,
    color: "text-red-700",
    bg: "bg-red-50",
    group: "Interview Prep",
  },
];

const activeStreams = new Set<string>();
const MODES = [["step_by_step","Step by step"],["concise","Short answer"],["deep_dive","Deep explanation"],["example","Worked example"],["visual","Visual analogy"],["practice","Practice question"],["mistakes","Common mistakes"],["interview","Interview preparation"],["exam","Exam preparation"],["revision","Revision"],["memory","Memory and recall"]];
type SavedChat = { messages: Message[]; conversationId: string; subject: string; documentId: string; ragEnabled: boolean; mode: string; input: string; pending?: boolean };
type HistoryChat = { id: string; title: string; subject: string; updatedAt: string };

const SUBJECT_GROUPS = [
  "General",
  "BTech Core",
  "Programming Languages",
  "Interview Prep",
];

export default function TutorPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("General");
  const [ragEnabled, setRagEnabled] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState("step_by_step");
  const [initialized, setInitialized] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryChat[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState("");
  const storageKey = useRef("");
  const watchingStream = useRef(false);
  const pendingExplain = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const applySaved = (saved: SavedChat) => {
    setMessages(saved.messages || []); setConversationId(saved.conversationId || "");
    setSubject(saved.subject || "General"); setDocumentId(saved.documentId || "");
    setRagEnabled(!!saved.ragEnabled); setMode(saved.mode || "step_by_step"); setInput(saved.input || "");
    setStreaming(!!saved.pending && activeStreams.has(storageKey.current));
  };
  const openConversation = async (id: string, draft = "") => {
    try {
      const { data } = await apiRequest(`/api/tutor/conversations/${id}`);
      applySaved({ ...data, conversationId: data.id, ragEnabled: data.ragMode, mode: data.explanationMode, input: draft });
      setOlderCursor(data.olderCursor); setHistoryOpen(false); setHistoryError("");
    } catch (error) { setHistoryError(error instanceof Error ? error.message : "Unable to open conversation."); }
  };
  useEffect(() => {
    storageKey.current = `tutor-active:${getStoredEmail() || "account"}`;
    let saved: SavedChat | null = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey.current) || "null"); } catch {}
    if (saved) { applySaved(saved); watchingStream.current = !!saved.pending && activeStreams.has(storageKey.current); }
    const handoff = sessionStorage.getItem("pendingTutorRequest");
    if (handoff) {
      try { const request = JSON.parse(handoff); setInput(request.question || ""); setDocumentId(request.documentId || ""); setRagEnabled(true); setMode("step_by_step"); pendingExplain.current = true; }
      catch { setHistoryError("Unable to open selected material. Select it from Study material."); }
      sessionStorage.removeItem("pendingTutorRequest");
    } else if (saved?.conversationId && !activeStreams.has(storageKey.current)) {
      void openConversation(saved.conversationId, saved.input || "").finally(() => setInitialized(true));
    }
    if (handoff || !saved?.conversationId || activeStreams.has(storageKey.current)) setInitialized(true);
    const interval = setInterval(() => {
      if (watchingStream.current || activeStreams.has(storageKey.current)) {
        try { const cached = JSON.parse(localStorage.getItem(storageKey.current) || "null"); if (cached) applySaved(cached); watchingStream.current = activeStreams.has(storageKey.current); } catch {}
      } else { setStreaming(false); }
    },500);
    return () => clearInterval(interval);
    // Restore once; subsequent edits are persisted below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!initialized || activeStreams.has(storageKey.current)) return;
    try { localStorage.setItem(storageKey.current, JSON.stringify({ messages, conversationId, subject, documentId, ragEnabled, mode, input })); } catch {}
  },[initialized,messages,conversationId,subject,documentId,ragEnabled,mode,input]);
  const loadHistory = async (cursor?: string) => {
    try {
      const { data } = await apiRequest(`/api/tutor/conversations?search=${encodeURIComponent(historySearch)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      setHistory(previous => cursor ? [...previous,...data.conversations] : data.conversations);
      setHistoryCursor(data.nextCursor); setHistoryError("");
    } catch (error) { setHistoryError(error instanceof Error ? error.message : "Unable to load history."); }
  };
  const [readySources, setReadySources] = useState<DocumentSource[]>([]);
  useEffect(() => {
    apiRequest("/api/rag/documents")
      .then((result) =>
        setReadySources(
          result.data.documents.filter(
            (doc: DocumentSource) => doc.status === "READY",
          ),
        ),
      )
      .catch(() => {});
  }, []);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const subjectPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSubject =
    SUBJECTS.find((s) => s.value === subject) || SUBJECTS[0];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close subject picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        subjectPickerRef.current &&
        !subjectPickerRef.current.contains(e.target as Node)
      ) {
        setShowSubjectPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming || !initialized) return;

    const userQuestion = input;
    setInput("");
    setStreaming(true);
    setShowSubjectPicker(false);

    const updatedMessages = [
      ...messages,
      { role: "user" as const, content: userQuestion },
    ];
    setMessages(updatedMessages);
    setMessages((prev) => [
      ...prev,
      { role: "model" as const, content: "..." },
    ]);

    let receivedText = "";
    let activeId = conversationId;
    const cacheKey = storageKey.current;
    activeStreams.add(cacheKey); watchingStream.current = true;
    const cacheResponse = (pending: boolean, content: string) => {
      try { localStorage.setItem(cacheKey, JSON.stringify({ messages: [...updatedMessages,{ role: "model", content }], conversationId: activeId, subject, documentId, ragEnabled, mode, input: "", pending })); } catch {}
    };
    cacheResponse(true,"...");

    const cleanup = setupStreamingTutor({
      explanationMode: mode,
      question: userQuestion,
      conversationId,
      ragMode: ragEnabled,
      subject,
      documentId: documentId || undefined,
      onMeta: (meta) => {
        activeId = meta.conversationId;
        cacheResponse(true, receivedText || "...");
        setConversationId(meta.conversationId);
      },
      onContent: (text) => {
        receivedText += text;
        cacheResponse(true,receivedText);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "model", content: receivedText };
          return next;
        });
      },
      onError: (err) => {
        cacheResponse(false,`⚠️ Connection issue: ${err}`); activeStreams.delete(cacheKey);
        cleanup();
        setStreaming(false);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "model",
            content: `⚠️ Connection issue: ${err}`,
          };
          return next;
        });
      },
      onDone: () => {
        cacheResponse(false,receivedText); activeStreams.delete(cacheKey);
        cleanup();
        setStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      },
    });
  };

  useEffect(() => {
    if (initialized && pendingExplain.current && input.trim()) {
      pendingExplain.current = false;
      formRef.current?.requestSubmit();
    }
  },[initialized,input]);

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
    <div className="h-[calc(100dvh-155px)] min-h-[540px] flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="border-b border-border bg-card px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Your tutor
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Ask a question. Work through it. Make it yours.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" disabled={streaming} onClick={() => { setHistoryOpen(!historyOpen); void loadHistory(); }} className="px-3 py-2 border rounded-lg text-xs">History</button>
          <button type="button" disabled={streaming} onClick={() => { setMessages([]); setConversationId(""); setInput(""); setOlderCursor(null); }} className="px-3 py-2 border rounded-lg text-xs">New chat</button>
          {/* Subject Picker */}
          <div className="relative" ref={subjectPickerRef}>
            <button
              type="button"
              onClick={() => setShowSubjectPicker(!showSubjectPicker)}
              aria-expanded={showSubjectPicker}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                showSubjectPicker
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-border bg-card text-foreground hover:border-indigo-200 hover:bg-indigo-50"
              }`}
            >
              <currentSubject.icon
                className={`h-3.5 w-3.5 ${currentSubject.color}`}
              />
              <span className="hidden sm:inline">{currentSubject.label}</span>
              <span className="sm:hidden">Subject</span>
              <ChevronDown
                className={`h-3 w-3 text-muted-foreground transition-transform ${showSubjectPicker ? "rotate-180" : ""}`}
              />
            </button>

            {showSubjectPicker && (
              <div className="absolute top-full mt-2 right-0 z-50 bg-card border border-border rounded-xl shadow-xl p-3 w-72 max-h-80 overflow-y-auto">
                {SUBJECT_GROUPS.map((group) => {
                  const groupSubjects = SUBJECTS.filter(
                    (s) => s.group === group,
                  );
                  return (
                    <div key={group} className="mb-3 last:mb-0">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-1.5">
                        {group}
                      </div>
                      {groupSubjects.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setSubject(s.value);
                            setShowSubjectPicker(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer text-left ${
                            subject === s.value
                              ? `${s.bg} ${s.color} font-bold`
                              : "text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          <s.icon
                            className={`h-3.5 w-3.5 ${s.color} shrink-0`}
                          />
                          {s.label}
                          {subject === s.value && (
                            <span className="ml-auto text-xs font-semibold bg-card rounded px-1.5 py-0.5 border border-current">
                              ACTIVE
                            </span>
                          )}
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
            aria-pressed={ragEnabled}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
              ragEnabled
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-border bg-card text-muted-foreground hover:border-emerald-200"
            }`}
          >
            <BookOpen
              className={`h-3.5 w-3.5 ${ragEnabled ? "text-emerald-600" : "text-muted-foreground"}`}
            />
            <span className="hidden sm:inline">Use your library</span>
            <div
              className={`h-4 w-7 rounded-full transition-all duration-300 ${ragEnabled ? "bg-emerald-400" : "bg-slate-200"} relative`}
            >
              <div
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-card shadow transition-transform duration-200 ${ragEnabled ? "translate-x-3.5" : "translate-x-0.5"}`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 bg-background/30"
        role="log"
        aria-label="Tutor conversation"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6 py-12">
            <div className="p-5 bg-card border border-border rounded-xl shadow-sm">
              <div className="p-3 bg-indigo-600 rounded-xl w-fit mx-auto mb-3">
                <currentSubject.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {currentSubject.label} Tutor
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                Ask anything about {currentSubject.label}. Your AI tutor adapts
                explanations to your learning style, level, and knowledge gaps.
              </p>
            </div>

            {/* Quick suggestions */}
            <div className="w-full space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                A FEW STARTING POINTS
              </p>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(s)}
                  className="w-full text-left px-4 py-2.5 bg-card border border-border rounded-xl text-xs text-muted-foreground font-medium hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all duration-150 cursor-pointer flex items-center gap-2"
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
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-xl text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-slate-800 text-white px-4 py-3 rounded-tr-sm"
                    : "bg-card border border-border text-foreground px-5 py-4 rounded-tl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap font-medium">
                    {msg.content}
                  </div>
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
                      <div className="border-t border-border pt-3 mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-amber-400" />
                          Choose your next step below, or ask a follow-up.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const lastUserMsg = messages
                              .slice()
                              .reverse()
                              .find((m) => m.role === "user");
                            if (lastUserMsg)
                              handleLaunchQuiz(lastUserMsg.content);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-all shrink-0"
                        >
                          Take Reinforcement Quiz{" "}
                          <ArrowRight className="h-3 w-3" />
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

      {historyOpen && <section aria-label="Chat history" className="border-t p-4 max-h-72 overflow-auto bg-card space-y-2">
        <form onSubmit={(event) => { event.preventDefault(); void loadHistory(); }} className="flex gap-2">
          <input aria-label="Search chat history" value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search subjects or topics" className="border rounded p-2 flex-1" />
          <button className="border rounded px-3">Search</button>
        </form>
        {historyError && <p role="alert">{historyError}</p>}
        {!history.length && <p className="text-sm text-muted-foreground">No saved conversations found.</p>}
        {history.map(chat => <button key={chat.id} type="button" onClick={() => void openConversation(chat.id)} className="block text-left w-full p-2 border rounded hover:bg-secondary"><strong className="text-sm">{chat.title}</strong><span className="block text-xs text-muted-foreground">{chat.subject} · {new Date(chat.updatedAt).toLocaleString()}</span></button>)}
        {historyCursor && <button type="button" onClick={() => void loadHistory(historyCursor)}>Load more conversations</button>}
      </section>}
      {olderCursor && <button type="button" className="text-xs p-2 border-t" onClick={async () => {
        try { const { data } = await apiRequest(`/api/tutor/conversations/${conversationId}?before=${olderCursor}`); setMessages(previous => [...data.messages,...previous]); setOlderCursor(data.olderCursor); }
        catch (error) { setHistoryError(error instanceof Error ? error.message : "Unable to load older messages."); }
      }}>Load older messages</button>}
      {/* Input Bar */}
      <div className="border-t border-border p-4 shrink-0 bg-card">
        <label className="block text-xs mb-3">Explanation style
          <select aria-label="Explanation style" value={mode} disabled={streaming} onChange={event => setMode(event.target.value)} className="ml-2 border rounded p-2 bg-background">
            {MODES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {messages.length > 0 && !streaming && <div className="flex flex-wrap gap-2 mb-3" aria-label="Choose next explanation">
          {[["example","Worked example"],["visual","Visual analogy"],["practice","Practice question"],["revision","Revision"],["interview","Interview preparation"]].map(([value,label]) => <button key={value} type="button" className="text-xs border rounded-lg px-3 py-2 hover:bg-secondary" onClick={() => {
            const topic = [...messages].reverse().find(message => message.role === "user")?.content || "this topic";
            setMode(value); setInput(`${label}: ${topic}`); inputRef.current?.focus();
          }}>{label}</button>)}
        </div>}
        {/* Active subject badge */}
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${currentSubject.bg} border border-current/20`}
          >
            <currentSubject.icon
              className={`h-3 w-3 ${currentSubject.color}`}
            />
            <span className={`text-xs font-bold ${currentSubject.color}`}>
              {currentSubject.label}
            </span>
          </div>
          {ragEnabled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
              <BookOpen className="h-3 w-3 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-600">
                Library mode
              </span>
            </div>
          )}
        </div>

        {ragEnabled && (
          <label className="block text-xs mb-2">
            Study material
            <select
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
              className="ml-2 rounded border border-border bg-background p-2"
            >
              <option value="">All ready materials</option>
              {readySources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2.5">
          <input
            ref={inputRef}
            aria-label="Your question"
            type="text"
            required
            disabled={streaming || !initialized}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              streaming
                ? "Your tutor is responding…"
                : `Ask your ${currentSubject.label} tutor anything...`
            }
            className="flex-1 px-4 py-3 bg-secondary border border-border rounded-xl text-xs focus:outline-none focus:border-indigo-400 focus:bg-card text-foreground placeholder-slate-400 disabled:opacity-50 transition-all duration-200"
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
