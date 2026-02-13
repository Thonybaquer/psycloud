'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Theme handling (light/dark/system)
// Compatibility goals:
// - Preserve existing behavior (older builds stored only "light"|"dark").
// - Add "system" to match Settings and avoid inconsistent UI state.

export type Theme = 'light' | 'dark' | 'system';

type ResolvedTheme = 'light' | 'dark';

type Ctx = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function getSystemTheme(): ResolvedTheme {
  try {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyResolvedTheme(t: ResolvedTheme) {
  const root = document.documentElement;
  if (t === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

function normalizeTheme(v: unknown): Theme {
  if (v === 'dark' || v === 'light' || v === 'system') return v;
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Initial load
  useEffect(() => {
    let stored: Theme | null = null;
    try {
      stored = normalizeTheme(localStorage.getItem('psycloud:theme')) as Theme;
    } catch {
      stored = null;
    }

    const initialTheme = stored ?? 'system';
    const initialResolved: ResolvedTheme = initialTheme === 'system' ? getSystemTheme() : initialTheme;

    setThemeState(initialTheme);
    setResolvedTheme(initialResolved);
    applyResolvedTheme(initialResolved);

    // Track system changes only while in "system"
    let mql: MediaQueryList | null = null;
    const onChange = () => {
      if (initialTheme !== 'system') return;
      const next = getSystemTheme();
      setResolvedTheme(next);
      applyResolvedTheme(next);
    };

    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener?.('change', onChange);
    } catch {
      // ignore
    }

    return () => {
      try {
        mql?.removeEventListener?.('change', onChange);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (t: Theme) => {
    const nextTheme = normalizeTheme(t);
    const nextResolved: ResolvedTheme = nextTheme === 'system' ? getSystemTheme() : nextTheme;

    setThemeState(nextTheme);
    setResolvedTheme(nextResolved);
    applyResolvedTheme(nextResolved);

    try {
      localStorage.setItem('psycloud:theme', nextTheme);
    } catch {
      // ignore
    }
  };

  const toggle = () => {
    // Toggle between explicit light/dark; if currently system, toggle based on resolved
    const base: ResolvedTheme = theme === 'system' ? resolvedTheme : (theme as ResolvedTheme);
    setTheme(base === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toggle }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: 'system' as Theme, resolvedTheme: 'light' as ResolvedTheme, toggle: () => {}, setTheme: (_: Theme) => {} };
  }
  return ctx;
}
