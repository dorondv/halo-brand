'use client';

import type { ReactNode } from 'react';
import type { Theme } from './theme-context';
import { useCallback, useEffect, useState } from 'react';
import { ThemeContext } from './theme-context';
import { useHasMounted } from './useHasMounted';

const STORAGE_KEY = 'theme';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light');
  const mounted = useHasMounted();

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newTheme);
    }
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    // Apply initial theme from localStorage (set by ThemeInitScript)
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const current = stored === 'dark' || stored === 'light' ? stored : 'light';
    applyTheme(current);
    queueMicrotask(() => setThemeState(current));

    // Fetch user settings if authenticated - API will return 401 for unauthenticated
    fetch('/api/settings', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.light_mode !== undefined) {
          const userTheme: Theme = data.data.light_mode ? 'light' : 'dark';
          applyTheme(userTheme);
          setThemeState(userTheme);
          localStorage.setItem(STORAGE_KEY, userTheme);
        }
      })
      .catch(() => {
        // Unauthenticated or error - keep localStorage theme
      });
  }, [mounted]);

  return (
    <ThemeContext
      value={{
        theme,
        setTheme,
        isDark: theme === 'dark',
      }}
    >
      {children}
    </ThemeContext>
  );
}
