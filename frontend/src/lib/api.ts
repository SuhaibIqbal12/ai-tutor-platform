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
  }
}

export async function apiRequest(endpoint: string, method = "GET", body: any = null) {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  
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
  } catch (e) {
    if (!res.ok) {
      throw new Error(`API Error (${res.status}): ${text}`);
    }
    throw new Error(`Invalid JSON response: ${text}`);
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export function setupStreamingTutor({
  question,
  conversationId,
  ragMode,
  subject,
  onMeta,
  onContent,
  onError,
  onDone,
}: {
  question: string;
  conversationId: string;
  ragMode: boolean;
  subject: string;
  onMeta: (metadata: { conversationId: string }) => void;
  onContent: (text: string) => void;
  onError: (errMessage: string) => void;
  onDone: () => void;
}) {
  const token = getStoredToken();
  const url = `/api/tutor/ask/stream?question=${encodeURIComponent(question)}&conversationId=${encodeURIComponent(conversationId)}&ragMode=${ragMode}&subject=${encodeURIComponent(subject)}&token=${encodeURIComponent(token)}`;
  
  const sse = new EventSource(url);

  sse.onmessage = (event) => {
    if (event.data === "[DONE]") {
      sse.close();
      onDone();
      return;
    }

    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "meta") {
        onMeta({ conversationId: payload.conversationId });
      } else if (payload.type === "content") {
        onContent(payload.text);
      } else if (payload.type === "error") {
        sse.close();
        onError(payload.message || "Tutor model streaming error");
      }
    } catch (err) {
      console.error("Stream parse error:", err);
      onError("Error parsing stream content");
    }
  };

  sse.onerror = () => {
    sse.close();
    onError("AI Tutor connection lost. Verify backend configuration and your Gemini API key.");
  };

  return () => sse.close();
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
