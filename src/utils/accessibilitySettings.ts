/**
 * Accessibility settings (parity with Solo / project-management-tool).
 * Validates on load so corrupt localStorage cannot break the UI.
 */

const STORAGE_KEY = 'accessibilitySettings';

export type AccessibilitySettings = {
  textSize: number;
  highContrast: boolean;
  largeCursor: boolean;
};

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  textSize: 100,
  highContrast: false,
  largeCursor: false,
};

export const MIN_TEXT_SIZE = 75;
export const MAX_TEXT_SIZE = 200;

export function validateAccessibilitySettings(
  raw: Partial<AccessibilitySettings> | null | undefined,
): AccessibilitySettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }

  const textSize = typeof raw.textSize === 'number' && !Number.isNaN(raw.textSize)
    ? Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, raw.textSize))
    : DEFAULT_ACCESSIBILITY_SETTINGS.textSize;

  const highContrast = typeof raw.highContrast === 'boolean'
    ? raw.highContrast
    : DEFAULT_ACCESSIBILITY_SETTINGS.highContrast;

  const largeCursor = typeof raw.largeCursor === 'boolean'
    ? raw.largeCursor
    : DEFAULT_ACCESSIBILITY_SETTINGS.largeCursor;

  return { textSize, highContrast, largeCursor };
}

export function loadAccessibilityFromStorage(): AccessibilitySettings {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) {
      return DEFAULT_ACCESSIBILITY_SETTINGS;
    }
    const parsed = JSON.parse(item) as unknown;
    return validateAccessibilitySettings(parsed as Partial<AccessibilitySettings>);
  } catch {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }
}

export function saveAccessibilityToStorage(settings: AccessibilitySettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}

export function applyAccessibilitySettingsToDocument(settings: AccessibilitySettings): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.style.fontSize = `${settings.textSize}%`;
  if (settings.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }
  if (settings.largeCursor) {
    root.classList.add('large-cursor');
  } else {
    root.classList.remove('large-cursor');
  }
}

export function resetAccessibilityToDefault(): void {
  const validated = DEFAULT_ACCESSIBILITY_SETTINGS;
  saveAccessibilityToStorage(validated);
  applyAccessibilitySettingsToDocument(validated);
}
