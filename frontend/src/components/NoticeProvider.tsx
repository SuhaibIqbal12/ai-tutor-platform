"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, Info, X } from "lucide-react";
type Tone = "error" | "info" | "success";
const NoticeContext = createContext<(message: string, tone?: Tone) => void>(
  () => {},
);
export function useNotice() {
  return useContext(NoticeContext);
}
export default function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; tone: Tone } | null>(
    null,
  );
  const notify = useCallback(
    (message: string, tone: Tone = "error") => setNotice({ message, tone }),
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotice(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [notice]);
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {notice && (
        <div
          className={`notice notice-${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <div className="notice-icon">
            {notice.tone === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Info size={18} />
            )}
          </div>
          <div className="min-w-0">
            <strong>
              {notice.tone === "error"
                ? "Something needs attention"
                : notice.tone === "success"
                  ? "All set"
                  : "Good to know"}
            </strong>
            <p>{notice.message}</p>
          </div>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </NoticeContext.Provider>
  );
}
