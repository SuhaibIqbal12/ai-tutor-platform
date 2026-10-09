// frontend/src/lib/api.ts

export interface UserProfile {
  academicYear: string;
  branch: string;
  cgpa: number;
  strongSubjects: string[];
  weakSubjects: string[];
  learningPreferences: string[];
  careerInterests: string[];
  learningStyle?: string;
  currentLevel?: string;
  retentionRate?: number;
  studyConsistency?: number;
  confidenceLevel?: number;
  learningVelocity?: number;
  codingGrowthScore?: number;
  placementReadiness?: number;
}

export interface DocumentSource {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  error?: string | null;
  warnings?: string;
}

export interface Message {
  role: "user" | "model";
  content: string;
}

export interface QuizQuestion {
  question: string;
  type: string;
  difficulty: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  explanation: string;
  codingTemplate?: string;
}

export interface Quiz {
  quizId: string;
  topic: string;
  questions: QuizQuestion[];
}

const BASE_URL = ""; // Empty string because Next.js rewrites proxy to backend

export function getStoredToken(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token") || "";
  }
  return "";
}

export function setStoredToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
}

export function getStoredEmail(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("email") || "";
  }
  return "";
}

export function setStoredEmail(email: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("email", email);
  }
}

export function clearStoredAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("profile");
    import("./supabase").then(({ supabase }) => supabase?.auth.signOut());
  }
}

export async function apiRequest(
  endpoint: string,
  method = "GET",
  body: unknown = null,
) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, config);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(
        `The service is temporarily unavailable (${res.status}). Please try again.`,
      );
    }
    throw new Error(
      "The service returned an unexpected response. Please try again.",
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    throw new Error(data.message || data.error || "Request failed");
  }
  return data;
}

export function setupStreamingTutor({
  question,
  conversationId,
  ragMode,
  subject,
  documentId,
  onMeta,
  onContent,
  onError,
  onDone,
}: {
  question: string;
  conversationId: string;
  ragMode: boolean;
  subject: string;
  documentId?: string;
  onMeta: (metadata: { conversationId: string }) => void;
  onContent: (text: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}) {
  const controller = new AbortController();
  void (async () => {
    try {
      const response = await fetch("/api/tutor/ask/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getStoredToken()}`,
        },
        body: JSON.stringify({
          question,
          conversationId,
          ragMode,
          subject,
          documentId,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        if (response.status === 401) clearStoredAuth();
        throw new Error("Tutor is unavailable. Please retry or sign in again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const part = await reader.read();
        buffer += decoder.decode(part.value || new Uint8Array(), {
          stream: !part.done,
        });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event
            .split("\n")
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6))
            .join("\n");
          if (!data) continue;
          if (data === "[DONE]") {
            done = true;
            onDone();
            break;
          }
          const payload = JSON.parse(data);
          if (payload.type === "meta")
            onMeta({ conversationId: payload.conversationId });
          if (payload.type === "content") onContent(payload.text);
          if (payload.type === "error")
            throw new Error(payload.message || "Tutor response interrupted.");
        }
        if (part.done && !done)
          throw new Error("Tutor response interrupted. Please retry.");
      }
      await reader.cancel();
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        onError(
          error instanceof Error
            ? error.message
            : "Tutor connection interrupted.",
        );
    }
  })();
  return () => controller.abort();
}

export async function getSystemHealth() {
  return apiRequest("/api/diagnostics/health");
}

export async function getSystemLogs() {
  return apiRequest("/api/diagnostics/logs");
}

export async function getDocumentProgress(documentId: string) {
  return apiRequest(`/api/rag/progress/${documentId}`);
}
