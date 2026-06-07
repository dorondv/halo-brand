/* eslint-disable next/no-before-interactive-script-outside-document -- theme must apply before hydration; supported in App Router root layout */
/* eslint-disable react-dom/no-dangerously-set-innerhtml -- static theme init script, no user input */
import Script from 'next/script';

/**
 * Runs before React hydrates to apply theme from localStorage immediately,
 * preventing a flash of wrong theme on page load.
 */
export function ThemeInitScript() {
  return (
    <Script
      id="theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(){var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t==='dark');})();`,
      }}
    />
  );
}
