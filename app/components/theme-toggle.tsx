"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const themes: readonly Theme[] = ["light", "dark", "system"];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    const isDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem("securebin-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setTheme(stored);
      applyTheme(stored);
    } else {
      applyTheme("system");
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = (window.localStorage.getItem("securebin-theme") as Theme) || "system";
      if (current === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    window.localStorage.setItem("securebin-theme", nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="theme-control" role="group" aria-label="Color theme">
      {themes.map((option) => (
        <button
          className="theme-option"
          data-active={theme === option}
          key={option}
          onClick={() => chooseTheme(option)}
          type="button"
          aria-pressed={theme === option}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
