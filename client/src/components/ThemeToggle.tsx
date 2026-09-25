'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    let isCurrentlyDark = false;
    try {
      isCurrentlyDark = localStorage.getItem('se-quiz-theme') === 'dark';
    } catch (e) {}

    if (isCurrentlyDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setIsDark(isCurrentlyDark);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDark: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isDark === 'boolean') {
        setIsDark(customEvent.detail.isDark);
      } else {
        setIsDark(document.documentElement.classList.contains('dark'));
      }
    };

    window.addEventListener('se-theme-change', handleThemeChange);
    return () => window.removeEventListener('se-theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('se-quiz-theme', 'dark');
      } catch (err) {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('se-quiz-theme', 'light');
      } catch (err) {}
    }

    window.dispatchEvent(
      new CustomEvent('se-theme-change', { detail: { isDark: nextDark } })
    );
  };

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 animate-pulse ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group relative flex items-center justify-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:text-schneider-brand dark:hover:text-schneider-green hover:border-schneider-brand/40 dark:hover:border-schneider-green/40 shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600 transition-transform duration-300 group-hover:-rotate-12" />
      )}

      {showLabel && (
        <span className="text-xs font-bold hidden sm:inline select-none">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
