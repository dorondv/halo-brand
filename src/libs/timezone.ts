/**
 * Timezone utility functions for consistent date/time handling across the application
 * All dates are stored in UTC in the database, but displayed in user's timezone
 */

/**
 * Get user's timezone from browser or default to UTC
 */
export function getUserTimezone(): string {
  if (typeof window !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
}

/**
 * Map locale code to Intl locale string
 * 'he' -> 'he-IL', 'en' -> 'en-US', etc.
 */
export function getIntlLocale(locale: string): string {
  const localeMap: Record<string, string> = {
    he: 'he-IL',
    en: 'en-US',
  };
  return localeMap[locale] || locale || 'en-US';
}

/**
 * Convert UTC date string to user's local timezone Date object
 * JavaScript Date objects are always in local timezone, so this mainly ensures
 * proper parsing of UTC ISO strings
 */
export function utcToLocal(utcDateString: string | Date, _timezone?: string): Date {
  if (utcDateString instanceof Date) {
    return utcDateString;
  }

  // If it's a date-only string (YYYY-MM-DD), treat it as midnight UTC
  if (utcDateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(`${utcDateString}T00:00:00Z`);
  }

  // For ISO strings, JavaScript Date will parse them correctly
  // The Date object will represent the UTC time, but when formatted
  // it will display in the local timezone
  return new Date(utcDateString);
}

/**
 * Convert local date to UTC ISO string for storage
 * Handles datetime-local input values which are in local timezone
 * datetime-local inputs provide values in YYYY-MM-DDTHH:mm format without timezone
 * JavaScript interprets these as local time, so we need to convert to UTC
 */
export function localToUtc(localDate: Date | string, _timezone?: string): string {
  // If input is a datetime-local string (YYYY-MM-DDTHH:mm), treat it as local time
  if (typeof localDate === 'string' && localDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
    // Create a date object - JavaScript will interpret this as local time
    // Then convert to UTC ISO string
    const localDateTime = new Date(localDate);
    return localDateTime.toISOString();
  }

  // For Date objects or ISO strings, convert to UTC
  const date = typeof localDate === 'string' ? new Date(localDate) : localDate;
  return date.toISOString();
}

/**
 * Format date for display in user's timezone
 */
export function formatDateForDisplay(
  date: string | Date,
  options?: {
    locale?: string;
    timezone?: string;
    includeTime?: boolean;
    format?: 'short' | 'medium' | 'long' | 'full';
  },
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const tz = options?.timezone || getUserTimezone();
  const intlLocale = getIntlLocale(options?.locale || 'en');

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    ...(options?.format === 'short' && {
      dateStyle: 'short',
      ...(options?.includeTime && { timeStyle: 'short' }),
    }),
    ...(options?.format === 'medium' && {
      dateStyle: 'medium',
      ...(options?.includeTime && { timeStyle: 'medium' }),
    }),
    ...(options?.format === 'long' && {
      dateStyle: 'long',
      ...(options?.includeTime && { timeStyle: 'long' }),
    }),
    ...(options?.format === 'full' && {
      dateStyle: 'full',
      ...(options?.includeTime && { timeStyle: 'full' }),
    }),
    ...(!options?.format && {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(options?.includeTime && {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    }),
  };

  return new Intl.DateTimeFormat(intlLocale, formatOptions).format(dateObj);
}

/**
 * Get datetime-local string value from UTC date
 * Used for populating datetime-local inputs
 * datetime-local expects YYYY-MM-DDTHH:mm format in local timezone
 */
export function utcToDatetimeLocal(utcDateString: string | Date, _timezone?: string): string {
  const date = typeof utcDateString === 'string' ? new Date(utcDateString) : utcDateString;

  // JavaScript Date already represents the UTC time, but when we access
  // getFullYear(), getMonth(), etc., it returns values in local timezone
  // So we can use these directly for datetime-local format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Check if a date is in the past
 */
export function isDateInPast(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return dateObj < now;
}
