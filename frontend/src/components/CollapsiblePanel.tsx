// frontend/src/components/CollapsiblePanel.tsx
"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsiblePanelProps {
  title: string;
  content: string;
}

export default function CollapsiblePanel({ title, content }: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/45 transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-secondary/80 hover:bg-secondary transition-colors flex justify-between items-center text-xs font-bold text-foreground border-b border-border/50 cursor-pointer"
      >
        <span>{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="p-4 text-xs leading-relaxed text-foreground/90 bg-card whitespace-pre-wrap font-normal overflow-x-auto">
          {content}
        </div>
      )}
    </div>
  );
}

// Utility function to format and parse structured content containing ### headings
export function formatExplanations(content: string) {
  if (!content) return null;

  // Split content by headings to create collapsible panels
  const sections = content.split(/(### .*?\n)/g);
  let currentHeading = "Explanation Details";
  const panels: { heading: string; body: string }[] = [];

  sections.forEach((sec) => {
    if (sec.startsWith("### ")) {
      currentHeading = sec.replace("### ", "").trim();
    } else if (sec.trim()) {
      panels.push({ heading: currentHeading, body: sec.trim() });
    }
  });

  if (panels.length === 0) {
    return <div className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="space-y-3 mt-3">
      {panels.map((panel, idx) => (
        <CollapsiblePanel key={idx} title={panel.heading} content={panel.body} />
      ))}
    </div>
  );
}
