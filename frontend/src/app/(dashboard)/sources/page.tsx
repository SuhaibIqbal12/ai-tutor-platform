// frontend/src/app/(dashboard)/sources/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  UploadCloud,
  FileUp,
  AlignLeft,
  CheckCircle,
  Compass,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import { apiRequest, DocumentSource } from "@/lib/api";

export default function SourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<DocumentSource[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  
  // Forms loading/success states
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");

  // Ingestion states
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);


  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);

  const fetchData = async () => {
    try {
      const docRes = await apiRequest("/api/rag/documents");
      if (docRes.status === "success") {
        setSources(docRes.data.documents);
      }
      
      const graphRes = await apiRequest("/api/rag/graph");
      if (graphRes.status === "success") {
        setGraphData(graphRes.data || { nodes: [], edges: [] });
      }
    } catch (err) {
      console.error("Failed to load sources or graph:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!activeJobId) return;

    let timer: NodeJS.Timeout;
    const checkProgress = async () => {
      try {
        const res = await apiRequest(`/api/rag/progress/${activeJobId}`);
        if (res.status === "success") {
          const progress = res.data;
          setJobProgress(progress);
          if (progress.status === "completed") {
            setSuccessMsg("Document processing completed successfully!");
            setTimeout(() => setSuccessMsg(""), 5000);
            fetchData();
            setActiveJobId(null);
            setJobProgress(null);
          } else if (progress.status === "failed") {
            alert(`Ingestion failed: ${progress.error || "Unknown error"}`);
            setActiveJobId(null);
            setJobProgress(null);
          } else {
            timer = setTimeout(checkProgress, 1500);
          }
        }
      } catch (err: any) {
        console.error("Error checking progress:", err);
        timer = setTimeout(checkProgress, 1500);
      }
    };

    checkProgress();
    return () => clearTimeout(timer);
  }, [activeJobId]);

  const handleIngestText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim() || loading) return;

    setLoading(true);
    try {
      const res = await apiRequest("/api/rag/upload", "POST", { title: textTitle, content: textContent });
      setTextTitle("");
      setTextContent("");
      if (res.status === "success" && res.data?.documentId) {
        setActiveJobId(res.data.documentId);
        setJobProgress({ status: "processing" });
      } else {
        setSuccessMsg("Notes content upload accepted!");
        setTimeout(() => setSuccessMsg(""), 5000);
        fetchData();
      }
    } catch (err: any) {
      alert("Failed to ingest notes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIngestFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || loading) return;

    setLoading(true);
    const token = localStorage.getItem("token") || "";
    const formData = new FormData();
    formData.append("file", file);

    // Use AbortController with a 5-minute timeout for large file processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      const res = await fetch("/api/rag/upload-file", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Safely parse — server may return plain text on crash
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(res.ok ? `Unexpected response: ${text.slice(0, 120)}` : `Server error (${res.status}): ${text.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data?.message || `Upload failed with status ${res.status}`);
      }

      setFile(null);
      if (data.status === "success" && data.data?.documentId) {
        setActiveJobId(data.data.documentId);
        setJobProgress({ status: "processing" });
      } else {
        setSuccessMsg("File upload accepted!");
        setTimeout(() => setSuccessMsg(""), 5000);
        fetchData();
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        alert("File upload timed out. The file may be too large or the server is busy. Please try again.");
      } else {
        alert("File upload issue: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };




  // Precompute layout node positions for the dependency graph
  const positions: Record<string, { x: number; y: number }> = {};
  
  if (graphData.nodes && graphData.nodes.length > 0) {
    graphData.nodes.forEach((node) => {
      const col = node.type === "concept" ? 0 : 1;
      const hasPrereq = graphData.edges?.some((e) => e.to === node.id) || false;
      const isPrereq = graphData.edges?.some((e) => e.from === node.id) || false;
      let finalCol = col;
      if (hasPrereq && !isPrereq) finalCol = 2; // Leaf/dependent nodes
      else if (hasPrereq && isPrereq) finalCol = 1; // Intermediates

      const sameColNodes = graphData.nodes.filter((n) => {
        const c = n.type === "concept" ? 0 : 1;
        const hp = graphData.edges?.some((e) => e.to === n.id) || false;
        const ip = graphData.edges?.some((e) => e.from === n.id) || false;
        let fc = c;
        if (hp && !ip) fc = 2;
        return fc === finalCol;
      });

      const idxInCol = sameColNodes.findIndex((n) => n.id === node.id);
      const totalInCol = sameColNodes.length;

      const x = finalCol * 170 + 80;
      const y = totalInCol > 1 ? (idxInCol / (totalInCol - 1)) * 220 + 50 : 150;
      
      positions[node.id] = { x, y };
    });
  }

  const handleExploreInChat = (nodeLabel: string) => {
    sessionStorage.setItem("pendingTutorQuestion", `Explain the topic "${nodeLabel}" in detail. Provide analogies and step-by-step reasoning.`);
    router.push("/tutor");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Knowledge Base & RAG Index</h2>
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          Index your custom notes, slide decks, or wiki page links. Explore educational maps visualizer.
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-600 dark:text-emerald-450 text-xs font-semibold leading-normal flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {activeJobId && jobProgress && (
        <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
              Processing Document Ingestion
            </h3>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded font-mono uppercase font-black animate-pulse">
              Running fallbacks & vectorizing
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 text-[11px] text-foreground/80">
            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                jobProgress.textExtracted ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground animate-pulse"
              }`}>
                {jobProgress.textExtracted ? "✓" : "1"}
              </span>
              <span className={jobProgress.textExtracted ? "font-bold text-foreground" : "text-muted-foreground font-medium"}>
                Text Extracted
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                jobProgress.chunksCreated ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {jobProgress.chunksCreated ? "✓" : "2"}
              </span>
              <span className={jobProgress.chunksCreated ? "font-bold text-foreground" : "text-muted-foreground font-medium"}>
                {jobProgress.chunksCount ? `${jobProgress.chunksCount} Chunks Created` : "Chunks Created"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                jobProgress.embeddingsGenerated ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {jobProgress.embeddingsGenerated ? "✓" : "3"}
              </span>
              <span className={jobProgress.embeddingsGenerated ? "font-bold text-foreground" : "text-muted-foreground font-medium"}>
                {jobProgress.embeddingsCount ? `${jobProgress.embeddingsCount}/${jobProgress.chunksCount || '?'} Embeddings` : "Embeddings Generated"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                jobProgress.graphGenerated ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {jobProgress.graphGenerated ? "✓" : "4"}
              </span>
              <span className={jobProgress.graphGenerated ? "font-bold text-foreground" : "text-muted-foreground font-medium"}>
                {jobProgress.graphNodesCount ? `${jobProgress.graphNodesCount} Graph Nodes` : "Knowledge Graph Nodes"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                jobProgress.flashcardsGenerated ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {jobProgress.flashcardsGenerated ? "✓" : "5"}
              </span>
              <span className={jobProgress.flashcardsGenerated ? "font-bold text-foreground" : "text-muted-foreground font-medium"}>
                Flashcards Generated
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                jobProgress.tutorReady ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {jobProgress.tutorReady ? "✓" : "6"}
              </span>
              <span className={jobProgress.tutorReady ? "font-bold text-foreground" : "text-muted-foreground font-medium"}>
                Tutor Ready
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Ingest Form */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("file")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                activeTab === "file" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileUp className="h-4 w-4" />
              Files
            </button>
            <button
              onClick={() => setActiveTab("text")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                activeTab === "text" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlignLeft className="h-4 w-4" />
              Raw Text
            </button>

          </div>

          {/* Form 1: File Upload */}
          {activeTab === "file" && (
            <form onSubmit={handleIngestFile} className="space-y-4">
              <div className="border-2 border-dashed border-border hover:border-indigo-500/50 rounded-xl p-8 flex flex-col items-center justify-center bg-secondary/20 transition-all cursor-pointer relative">
                <UploadCloud className="h-10 w-10 text-muted-foreground/60" />
                <span className="text-xs font-bold text-foreground mt-3">Drag & Drop Documents</span>
                <span className="text-[10px] text-muted-foreground mt-1">PDF, DOCX, PPTX, JPG, TXT up to 10MB</span>
                <input
                  type="file"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-4 block w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-900 file:text-white dark:file:bg-foreground dark:file:text-background file:cursor-pointer hover:file:opacity-90"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !file}
                className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow disabled:opacity-50"
              >
                {loading ? "Vectorizing chunk layers..." : "Ingest Base Document"}
              </button>
            </form>
          )}

          {/* Form 2: Raw Text */}
          {activeTab === "text" && (
            <form onSubmit={handleIngestText} className="space-y-4">
              <div>
                <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground mt-1 shadow-inner"
                  placeholder="e.g. Chapter 4: Photosynthesis Study Guide"
                />
              </div>
              <div>
                <label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
                  Content Body
                </label>
                <textarea
                  required
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full p-3 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground mt-1 shadow-inner"
                  rows={6}
                  placeholder="Paste reference explanations, notes transcripts, or formulas here..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow disabled:opacity-50"
              >
                {loading ? "Chunking text nodes..." : "Generate Vector Embeddings"}
              </button>
            </form>
          )}


        </div>

        {/* Right: Sources List */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 h-fit max-h-[380px] overflow-y-auto">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 flex items-center gap-1.5">
            <FileText className="h-4.5 w-4.5 text-indigo-400" />
            Vector Sources ({sources.length})
          </h3>
          {sources.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-10 text-center">
              No custom files loaded.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {sources.map((src) => (
                <li
                  key={src.id}
                  className="p-3 bg-secondary/40 border border-border rounded-xl flex flex-col gap-1 text-[11px] text-foreground/80 hover:border-indigo-500/20 hover:bg-secondary/60 transition-colors"
                >
                  <span className="font-bold text-foreground truncate">{src.title}</span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    Ingested: {new Date(src.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1 mt-1 font-bold text-emerald-500 text-[9px] uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Index Ready
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Dependency Map Visualization */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Compass className="h-4.5 w-4.5 text-indigo-400" />
              Adaptive Knowledge Pathway Map
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
              Prerequisite networks extracted from your vectorized documents.
            </p>
          </div>
          <span className="px-2.5 py-0.5 bg-slate-900 dark:bg-slate-800 text-white rounded text-[10px] font-bold font-mono w-fit">
            {graphData.nodes?.length || 0} nodes identified
          </span>
        </div>

        {!graphData.nodes || graphData.nodes.length === 0 ? (
          <div className="text-center py-20 text-xs text-muted-foreground italic bg-secondary/20 rounded-xl border border-dashed border-border">
            No topics extracted yet. Upload files or paste guides, and models will populate this graph!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG SVG Map Canvas */}
            <div className="lg:col-span-2 border border-border rounded-xl bg-secondary/15 p-4 h-[350px] relative overflow-hidden flex items-center justify-center shadow-inner">
              <svg className="w-full h-full min-h-[300px]">
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="22"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                  </marker>
                </defs>

                {/* Render Edges */}
                {graphData.edges?.map((edge, idx) => {
                  const p1 = positions[edge.from];
                  const p2 = positions[edge.to];
                  if (!p1 || !p2) return null;

                  return (
                    <g key={idx}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#cbd5e1"
                        className="dark:stroke-slate-800"
                        strokeWidth="2"
                        markerEnd="url(#arrow)"
                        strokeDasharray={edge.relation === "Part of" ? "4,4" : "0"}
                      />
                      <text
                        x={(p1.x + p2.x) / 2}
                        y={(p1.y + p2.y) / 2 - 4}
                        fill="#94a3b8"
                        fontSize="8"
                        className="font-bold select-none text-[8px]"
                        textAnchor="middle"
                      >
                        {edge.relation}
                      </text>
                    </g>
                  );
                })}

                {/* Render Nodes */}
                {graphData.nodes?.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer group"
                      onClick={() => setSelectedNode(node)}
                    >
                      <circle
                        r="16"
                        className={`transition-all duration-300 group-hover:scale-110 shadow ${
                          isSelected
                            ? "fill-indigo-600 stroke-indigo-500"
                            : node.type === "concept"
                            ? "fill-secondary stroke-border"
                            : "fill-card stroke-border"
                        }`}
                        strokeWidth="2"
                      />
                      <text
                        y="32"
                        textAnchor="middle"
                        className={`text-[9px] font-bold select-none ${
                          isSelected
                            ? "fill-indigo-500 font-extrabold"
                            : "fill-foreground"
                        }`}
                      >
                        {node.label}
                      </text>
                      <text
                        textAnchor="middle"
                        dy="4"
                        className={`text-[9px] font-extrabold select-none ${
                          isSelected ? "fill-white" : "fill-foreground"
                        }`}
                      >
                        {(node.label || " ").charAt(0).toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Inspector sidebox */}
            <div className="border border-border rounded-xl p-5 bg-card/60 space-y-4 shadow-sm flex flex-col justify-between min-h-[300px]">
              {selectedNode ? (
                <div className="space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                        selectedNode.type === "concept"
                          ? "bg-secondary text-foreground"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}
                    >
                      {selectedNode.type}
                    </span>
                    <h4 className="text-sm font-bold text-foreground leading-tight">
                      {selectedNode.label}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedNode.description}
                    </p>

                    <div className="border-t border-border pt-3 space-y-1.5">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">
                        Source Reference:
                      </span>
                      <div className="text-[10px] text-foreground font-semibold truncate bg-secondary p-2 rounded-lg border border-border">
                        {selectedNode.documentTitle || "Aggregated Index"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExploreInChat(selectedNode.label)}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Explain in Tutoring Chat
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-3">
                  <Compass className="h-9 w-9 text-muted-foreground/30 animate-pulse" />
                  <h4 className="text-xs font-bold text-foreground">Node Explorer</h4>
                  <p className="text-[10px] text-muted-foreground leading-normal max-w-xs">
                    Select a prerequisite circle on the visualizer canvas to read definitions and launch tutor explanations.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
