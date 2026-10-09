// frontend/src/components/ThemeToggle.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      const storedTheme = localStorage.getItem("theme") as
        "light" | "dark" | null;
      const initialTheme = storedTheme === "dark" ? "dark" : "light";
      setTheme(initialTheme);

      if (initialTheme === "dark") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-lg bg-secondary/50 animate-pulse"></div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200 border border-border shadow-sm flex items-center justify-center cursor-pointer"
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4.5 w-4.5 text-yellow-500 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="h-4.5 w-4.5 text-indigo-600 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
