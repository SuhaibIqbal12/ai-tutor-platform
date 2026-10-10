// frontend/src/app/(dashboard)/sources/page.tsx
"use client";
import PageHeader from "@/components/PageHeader";
import MindMap from "@/components/MindMap";
import { useNotice } from "@/components/NoticeProvider";
import type { GraphEdge, DocumentProgress, GraphNode } from "@/lib/contracts";
import { errorMessage } from "@/lib/contracts";

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
} from "lucide-react";
import { apiRequest, DocumentSource } from "@/lib/api";

export default function SourcesPage() {
  const notify = useNotice();
  const router = useRouter();
  const [sources, setSources] = useState<DocumentSource[]>([]);
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Forms loading/success states
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"file" | "text" | "url">("file");

  // Ingestion states
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [documentDetails, setDocumentDetails] = useState<{
    title: string;
    flashcards: { front: string; back: string }[];
    mindMap: string | null;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<DocumentProgress | null>(null);

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
      setSourceError(
        err instanceof Error ? errorMessage(err) : "Unable to load materials.",
      );
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchData);
  }, []);

  useEffect(() => {
    if (!activeJobId) return;

    let timer: NodeJS.Timeout;
    let cancelled = false;
    let failures = 0;
    const startedAt = Date.now();
    const checkProgress = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        setSourceError(
          "Processing is taking longer than expected. Check the document status later; a worker may be unavailable.",
        );
        setActiveJobId(null);
        return;
      }
      try {
        const res = await apiRequest(`/api/rag/progress/${activeJobId}`);
        if (cancelled) return;
        failures = 0;
        if (res.status === "success") {
          const progress = res.data;
          setJobProgress(progress);
          if (progress.status === "completed") {
            setSuccessMsg(
              progress.warnings?.length
                ? "Material is ready for questions. Optional study aids are unavailable."
                : "Material is ready for questions.",
            );
            setTimeout(() => setSuccessMsg(""), 5000);
            fetchData();
            setActiveJobId(null);
            setJobProgress(null);
          } else if (progress.status === "failed") {
            notify(`Ingestion failed: ${progress.error || "Unknown error"}`);
            setActiveJobId(null);
            setJobProgress(null);
          } else {
            timer = setTimeout(checkProgress, 10000);
          }
        }
      } catch (err: unknown) {
        console.error("Error checking progress:", err);
        failures++;
        if (failures >= 3) {
          setSourceError(
            "Cannot check processing status. Refresh to try again.",
          );
          setActiveJobId(null);
          return;
        }
        timer = setTimeout(checkProgress, 10000);
      }
    };

    checkProgress();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeJobId, notify]);

  const handleIngestText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textTitle.trim() || !textContent.trim() || loading) return;

    setLoading(true);
    try {
      const res = await apiRequest("/api/rag/upload", "POST", {
        title: textTitle,
        content: textContent,
      });
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
    } catch (err: unknown) {
      notify("Failed to ingest notes: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleIngestFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || loading) return;
    if (file.size > 4 * 1024 * 1024) {
      setSourceError("Maximum file size is 4 MB. Split or compress larger files.");
      return;
    }

    setLoading(true);
    setSourceError("");
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
      let data: {
        status: string;
        message?: string;
        data?: { documentId: string; title: string };
      };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.ok
            ? "The server returned an unexpected response. Please try again."
            : `Upload unavailable (${res.status}). Please try again.`,
        );
      }

      if (!res.ok) {
        throw new Error(
          data?.message || `Upload failed with status ${res.status}`,
        );
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        notify(
          "File upload timed out. The file may be too large or the server is busy. Please try again.",
        );
      } else {
        notify("File upload issue: " + errorMessage(err));
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleIngestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSourceError("");
    try {
      const result = await apiRequest("/api/rag/upload-url", "POST", {
        url: sourceUrl,
      });
      setActiveJobId(result.data.documentId);
      setJobProgress({ stage: result.data.stage });
      setSourceUrl("");
    } catch (error: unknown) {
      setSourceError(
        error instanceof Error ? error.message : "URL upload failed.",
      );
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
      const isPrereq =
        graphData.edges?.some((e) => e.from === node.id) || false;
      let finalCol = col;
      if (hasPrereq && !isPrereq)
        finalCol = 2; // Leaf/dependent nodes
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
    sessionStorage.setItem(
      "pendingTutorQuestion",
      `Explain the topic "${nodeLabel}" in detail. Provide analogies and step-by-step reasoning.`,
    );
    router.push("/tutor");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="STUDY MATERIAL"
        title="Your library"
        description="Keep your notes, chapters and lectures together. Add material to study with your tutor."
      />

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold leading-normal flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {activeJobId && jobProgress && (
        <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
              Preparing your material
            </h3>
            <span className="text-xs bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded font-mono uppercase font-semibold animate-pulse">
              {jobProgress.stage
                ? jobProgress.stage.replace(/_/g, " ").toLowerCase()
                : "Preparing for study"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 text-xs text-foreground/80">
            <div className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  jobProgress.textExtracted
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground animate-pulse"
                }`}
              >
                {jobProgress.textExtracted ? "✓" : "1"}
              </span>
              <span
                className={
                  jobProgress.textExtracted
                    ? "font-bold text-foreground"
                    : "text-muted-foreground font-medium"
                }
              >
                Text Extracted
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  jobProgress.chunksCreated
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {jobProgress.chunksCreated ? "✓" : "2"}
              </span>
              <span
                className={
                  jobProgress.chunksCreated
                    ? "font-bold text-foreground"
                    : "text-muted-foreground font-medium"
                }
              >
                {jobProgress.chunksCount
                  ? `${jobProgress.chunksCount} Sections prepared`
                  : "Sections prepared"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  jobProgress.embeddingsGenerated
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {jobProgress.embeddingsGenerated ? "✓" : "3"}
              </span>
              <span
                className={
                  jobProgress.embeddingsGenerated
                    ? "font-bold text-foreground"
                    : "text-muted-foreground font-medium"
                }
              >
                {jobProgress.embeddingsCount
                  ? `${jobProgress.embeddingsCount}/${jobProgress.chunksCount || "?"} Embeddings`
                  : "Search index prepared"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  jobProgress.graphGenerated
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {jobProgress.graphGenerated ? "✓" : "4"}
              </span>
              <span
                className={
                  jobProgress.graphGenerated
                    ? "font-bold text-foreground"
                    : "text-muted-foreground font-medium"
                }
              >
                {jobProgress.graphNodesCount
                  ? `${jobProgress.graphNodesCount} Graph Nodes`
                  : "Knowledge Graph Nodes"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  jobProgress.flashcardsGenerated
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {jobProgress.flashcardsGenerated ? "✓" : "5"}
              </span>
              <span
                className={
                  jobProgress.flashcardsGenerated
                    ? "font-bold text-foreground"
                    : "text-muted-foreground font-medium"
                }
              >
                Flashcards Generated
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`h-4 w-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  jobProgress.tutorReady
                    ? "bg-green-500 text-white"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {jobProgress.tutorReady ? "✓" : "6"}
              </span>
              <span
                className={
                  jobProgress.tutorReady
                    ? "font-bold text-foreground"
                    : "text-muted-foreground font-medium"
                }
              >
                Tutor Ready
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Ingest Form */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("file")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                activeTab === "file"
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileUp className="h-4 w-4" />
              Files
            </button>
            <button
              onClick={() => setActiveTab("text")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
                activeTab === "text"
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlignLeft className="h-4 w-4" />
              Notes
            </button>
          </div>

          {/* Form 1: File Upload */}
          {activeTab === "file" && (
            <form onSubmit={handleIngestFile} className="space-y-4">
              <div className="border-2 border-dashed border-border hover:border-indigo-500/50 rounded-xl p-8 flex flex-col items-center justify-center bg-secondary/20 transition-all cursor-pointer relative">
                <UploadCloud className="h-10 w-10 text-muted-foreground/60" />
                <span className="text-xs font-bold text-foreground mt-3">
                  Select a document
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  PDF, DOCX, PPTX, JPG, TXT up to 4MB
                </span>
                <input
                  type="file"
                  required
                  accept=".pdf,.txt,.md,.docx,.pptx,.xlsx,.odt,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-4 block w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white dark:file:bg-foreground dark:file:text-background file:cursor-pointer hover:file:opacity-90"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !file}
                className="w-full py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer shadow disabled:opacity-50"
              >
                {loading ? "Uploading..." : "Upload material"}
              </button>
            </form>
          )}

          <form
            onSubmit={handleIngestUrl}
            className="space-y-3 border-t border-border pt-4"
          >
            <label htmlFor="source-url" className="text-sm font-semibold">
              Webpage or YouTube video
            </label>
            <input
              aria-label="Webpage or YouTube video"
              id="source-url"
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full p-3 rounded-xl border border-border bg-background"
            />
            <button
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white"
            >
              {loading ? "Uploading..." : "Add link"}
            </button>
          </form>
          {sourceError && (
            <p role="alert" className="text-sm text-red-500">
              {sourceError}
            </p>
          )}
          {documentDetails && (
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="font-semibold">
                Study aids: {documentDetails.title}
              </h3>
              {!documentDetails.flashcards.length && (
                <p className="text-sm">
                  Study aids are unavailable for this material.
                </p>
              )}
              {documentDetails.flashcards.map((card, i) => (
                <details
                  key={i}
                  className="rounded-xl border border-border p-3"
                >
                  <summary>{card.front}</summary>
                  <p className="pt-2 text-sm">{card.back}</p>
                </details>
              ))}
              {documentDetails.mindMap && (
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold">Mind map</h4>
                  <MindMap
                    key={documentDetails.mindMap}
                    source={documentDetails.mindMap}
                  />
                </section>
              )}
            </section>
          )}

          {/* Form 2: Notes */}
          {activeTab === "text" && (
            <form onSubmit={handleIngestText} className="space-y-4">
              <div>
                <label className="text-muted-foreground text-xs font-bold uppercase tracking-wider block mb-1.5">
                  Title
                </label>
                <input
                  aria-label="Title"
                  type="text"
                  required
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className="w-full p-2.5 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground mt-1"
                  placeholder="e.g. Chapter 4: Photosynthesis Study Guide"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs font-bold uppercase tracking-wider block mb-1.5">
                  Your notes
                </label>
                <textarea
                  aria-label="Your notes"
                  required
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full p-3 border border-border bg-secondary/30 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-foreground placeholder-muted-foreground mt-1"
                  rows={6}
                  placeholder="Paste reference explanations, notes transcripts, or formulas here..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer shadow disabled:opacity-50"
              >
                {loading ? "Adding your notes…" : "Add notes to your library"}
              </button>
            </form>
          )}
        </div>

        {/* Right: Sources List */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4 h-fit max-h-[380px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 flex items-center gap-1.5">
            <FileText className="h-4.5 w-4.5 text-indigo-400" />
            Your materials ({sources.length})
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
                  className="p-3 bg-secondary/40 border border-border rounded-xl flex flex-col gap-1 text-xs text-foreground/80 hover:border-indigo-500/20 hover:bg-secondary/60 transition-colors"
                >
                  <span className="font-bold text-foreground truncate">
                    {src.title}
                  </span>
                  {src.error && <p className="text-red-500">{src.error}</p>}
                  {src.status === "READY" && (
                    <button
                      className="text-left text-indigo-500"
                      onClick={async () => {
                        try {
                          const result = await apiRequest(
                            `/api/rag/documents/${src.id}`,
                          );
                          setDocumentDetails(result.data);
                        } catch (error: unknown) {
                          setSourceError(
                            error instanceof Error
                              ? error.message
                              : "Unable to load study aids.",
                          );
                        }
                      }}
                    >
                      View study aids
                    </button>
                  )}
                  {!["READY", "FAILED", "NEEDS_REINDEX"].includes(
                    src.status,
                  ) && (
                    <button
                      onClick={() => {
                        setActiveJobId(src.id);
                        setJobProgress({ stage: src.status });
                      }}
                    >
                      Check progress
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">
                    Uploaded: {new Date(src.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1 mt-1 font-bold text-emerald-500 text-xs uppercase tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    {src.status === "READY"
                      ? "Ready for questions"
                      : src.status.replaceAll("_", " ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Dependency Map Visualization */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="border-b border-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Compass className="h-4.5 w-4.5 text-indigo-400" />
              Adaptive Knowledge Pathway Map
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Prerequisite networks extracted from your vectorized documents.
            </p>
          </div>
          <span className="px-2.5 py-0.5 bg-slate-900 dark:bg-slate-800 text-white rounded text-xs font-bold font-mono w-fit">
            {graphData.nodes?.length || 0} nodes identified
          </span>
        </div>

        {!graphData.nodes || graphData.nodes.length === 0 ? (
          <div className="text-center py-20 text-xs text-muted-foreground italic bg-secondary/20 rounded-xl border border-dashed border-border">
            No topics extracted yet. Upload files or paste guides, and models
            will populate this graph!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG SVG Map Canvas */}
            <div className="lg:col-span-2 border border-border rounded-xl bg-secondary/15 p-4 h-[350px] relative overflow-hidden flex items-center justify-center">
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
                        strokeDasharray={
                          edge.relation === "Part of" ? "4,4" : "0"
                        }
                      />
                      <text
                        x={(p1.x + p2.x) / 2}
                        y={(p1.y + p2.y) / 2 - 4}
                        fill="#94a3b8"
                        fontSize="8"
                        className="font-bold select-none text-xs"
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
                        className={`text-xs font-bold select-none ${
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
                        className={`text-xs font-extrabold select-none ${
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
            <div className="border border-border rounded-xl p-5 bg-card/60 space-y-4 flex flex-col justify-between min-h-[300px]">
              {selectedNode ? (
                <div className="space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider ${
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
                      <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">
                        Source Reference:
                      </span>
                      <div className="text-xs text-foreground font-semibold truncate bg-secondary p-2 rounded-lg border border-border">
                        {selectedNode.documentTitle || "Aggregated Index"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExploreInChat(selectedNode.label)}
                    className="w-full py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Explain in Tutoring Chat
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-3">
                  <Compass className="h-9 w-9 text-muted-foreground/30 animate-pulse" />
                  <h4 className="text-xs font-bold text-foreground">
                    Node Explorer
                  </h4>
                  <p className="text-xs text-muted-foreground leading-normal max-w-xs">
                    Select a prerequisite circle on the visualizer canvas to
                    read definitions and launch tutor explanations.
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
