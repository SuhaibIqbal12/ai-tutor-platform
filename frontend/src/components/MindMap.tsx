"use client";
import { useEffect, useId, useState } from "react";
export default function MindMap({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const render = async () => {
      try {
        const [{ default: mermaid }, { default: DOMPurify }] =
          await Promise.all([import("mermaid"), import("dompurify")]);
        if (!active) return;
        if (source.length > 30000) throw new Error("Diagram too large");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
          maxTextSize: 30000,
          maxEdges: 100,
          theme: "neutral",
          flowchart: { htmlLabels: false },
          secure: [
            "securityLevel",
            "startOnLoad",
            "maxTextSize",
            "maxEdges",
            "suppressErrorRendering",
            "themeCSS",
            "htmlLabels",
          ],
        });
        const code = source
          .replace(/^```(?:mermaid)?\s*|\s*```$/g, "")
          .replace(/%%\{[\s\S]*?\}%%/g, "")
          .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
        const result = await mermaid.render(`mindmap-${id}`, code);
        if (active)
          setSvg(
            DOMPurify.sanitize(result.svg, {
              USE_PROFILES: { svg: true, svgFilters: true },
              FORBID_TAGS: ["foreignObject"],
              FORBID_ATTR: ["href", "xlink:href"],
            }),
          );
      } catch {
        if (active) setError(true);
      }
    };
    void render();
    return () => {
      active = false;
    };
  }, [source, id]);
  if (error)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        This diagram couldn’t be displayed. You can still use the flashcards and
        ask your tutor about this material.
      </p>
    );
  if (!svg)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Preparing your mind map…
      </p>
    );
  return (
    <div
      className="mind-map overflow-auto rounded-lg bg-card p-4 border border-border"
      role="img"
      aria-label="Mind map of your study material"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
