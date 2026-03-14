/**
 * Runs before React hydrates to apply theme from localStorage immediately,
 * preventing a flash of wrong theme on page load.
 * Static script content - no user input.
 */
export function ThemeInitScript() {
  return (
    <script
      // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml -- Static theme init script, no user input
      dangerouslySetInnerHTML={{
        __html: `(function(){var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t==='dark');})();`,
      }}
    />
  );
}
