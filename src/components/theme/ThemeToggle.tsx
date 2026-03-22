'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-context';
import { useHasMounted } from './useHasMounted';

export function ThemeToggle() {
  const mounted = useHasMounted();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-600 dark:text-gray-400"
        aria-label="Toggle theme"
      >
        <Moon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:outline-none dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-900"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
