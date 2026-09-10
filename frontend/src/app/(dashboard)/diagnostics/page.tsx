// frontend/src/app/(dashboard)/diagnostics/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { 
  Activity, 
  Cpu, 
  Database, 
  Layers, 
  Network, 
  RefreshCw, 
  Terminal, 
  TrendingUp, 
  AlertCircle 
} from "lucide-react";
import { getSystemHealth, getSystemLogs } from "@/lib/api";

export default function DiagnosticsPage() {
  const [health, setHealth] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDiagnostics = async () => {
    setRefreshing(true);
    try {
      const healthRes = await getSystemHealth();
      if (healthRes.status === "success") {
        setHealth(healthRes.data);
      }
      const logsRes = await getSystemLogs();
      if (logsRes.status === "success") {
        setLogs(logsRes.data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load diagnostics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <span className="text-xs text-muted-foreground font-bold">Loading System Health Data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-500" />
            System Diagnostics & Health
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Real-time pipeline monitoring, provider fallback logging, and RAG retrieval checks.
          </p>
        </div>
        <button
          onClick={fetchDiagnostics}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-bold text-foreground transition-all duration-150 cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Active Provider */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI Pipeline Layer</span>
              <Cpu className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground">{health.currentProvider}</span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Active provider for stream content requests
              </span>
            </div>
            <div className="flex gap-2.5 pt-2 text-[10px]">
              <span className={`px-2 py-0.5 rounded font-bold border ${health.providers.gemini ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-secondary border-border text-muted-foreground"}`}>
                Gemini
              </span>
              <span className={`px-2 py-0.5 rounded font-bold border ${health.providers.groq ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-secondary border-border text-muted-foreground"}`}>
                Groq
              </span>
              <span className={`px-2 py-0.5 rounded font-bold border ${health.providers.openrouter ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-secondary border-border text-muted-foreground"}`}>
                OpenRouter
              </span>
            </div>
          </div>

          {/* Card 2: Database Status */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vector Store Status</span>
              <Database className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground">
                {health.database === "Connected" ? "SQLite / SQLite" : health.database}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Relational DB & vector store mapping
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-2 text-[10px] font-bold text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              {health.database}
            </div>
          </div>

          {/* Card 3: Index Volumes */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Index Volumes</span>
              <Layers className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground">{health.chunkCount} Embeddings</span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Parsed from {health.documentCount} source files
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground pt-2">
              <span className="font-bold text-foreground">{health.nodeCount}</span> knowledge nodes mapped
            </div>
          </div>

          {/* Card 4: API Latency */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">API Performance</span>
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-foreground">{health.latency} ms</span>
              <span className="text-[10px] text-muted-foreground mt-1">
                Last completed LLM generation roundtrip
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground pt-2">
              Redis cache: <span className="font-bold text-foreground">{health.redis}</span>
            </div>
          </div>
        </div>
      )}

      {/* Logs View */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider border-b border-border pb-2.5 flex items-center gap-2">
          <Terminal className="h-4.5 w-4.5 text-indigo-500" />
          Execution Log Streams
        </h3>
        
        {logs.length === 0 ? (
          <div className="text-center py-20 text-xs text-muted-foreground italic border border-dashed border-border rounded-xl">
            No pipeline logs recorded. Ask a tutoring question or ingest a source to populate.
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto rounded-xl border border-border/80 bg-secondary/20 p-4 font-mono text-[10px] leading-relaxed space-y-3.5">
            {logs.map((log, idx) => (
              <div key={idx} className="flex flex-col gap-1 border-b border-border/40 pb-2.5 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                    log.type === "ingestion" 
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" 
                      : log.type === "retrieval" 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                  }`}>
                    {log.type}
                  </span>
                </div>
                <div className="text-foreground font-medium">{log.message}</div>
                {log.details && (
                  <pre className="mt-1.5 p-2 bg-slate-900 text-slate-300 dark:bg-card border border-border/80 rounded-lg overflow-x-auto text-[9px] max-h-40">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
