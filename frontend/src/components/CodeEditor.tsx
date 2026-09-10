// frontend/src/components/CodeEditor.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  language: string;
  className?: string;
}

export default function CodeEditor({ value, onChange, language, className = "" }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  // Sync line numbers count
  useEffect(() => {
    const lines = value.split("\n").length;
    setLineCount(lines || 1);
  }, [value]);

  // Synchronize scrolling between the textarea and line number gutter
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Support Tab key indentation inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 4 spaces for tab
      const newValue = value.substring(0, start) + "    " + value.substring(end);
      onChange(newValue);

      // Reset selection caret position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  return (
    <div className={`flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg h-full ${className}`}>
      {/* Gutter (Line Numbers) */}
      <div
        ref={gutterRef}
        className="w-12 bg-slate-950/80 text-right pr-3 select-none py-4 text-xs font-mono text-slate-650 leading-relaxed border-r border-slate-850 overflow-hidden"
      >
        {Array.from({ length: lineCount }).map((_, i) => (
          <div key={i} className="h-5">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Editor Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="flex-1 p-4 bg-slate-900 text-slate-200 text-xs font-mono border-0 focus:ring-0 focus:outline-none resize-none leading-relaxed h-full overflow-y-auto"
        spellCheck="false"
        style={{
          lineHeight: "1.25rem", // 20px matching height of gutter rows
        }}
      />
    </div>
  );
}
