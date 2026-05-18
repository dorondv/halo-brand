export type InsightsData = {
  timing: string[];
  content: string[];
  keywords: string[];
  strategy: string[];
};

type RawInsights = {
  timing?: unknown;
  content?: unknown;
  keywords?: unknown;
  strategy?: unknown;
};

function insightItemToString(item: unknown): string {
  if (typeof item === 'string') {
    return item.trim();
  }
  if (item == null || typeof item === 'boolean') {
    return '';
  }
  if (typeof item !== 'object') {
    return String(item).trim();
  }

  const o = item as Record<string, unknown>;

  if ('day' in o || 'time' in o) {
    const day = o.day != null ? String(o.day).trim() : '';
    const time = o.time != null ? String(o.time).trim() : '';
    if (day && time) {
      return `${day}: ${time}`;
    }
    return day || time;
  }

  for (const key of ['text', 'message', 'recommendation', 'tip', 'title', 'value'] as const) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }

  try {
    return JSON.stringify(o);
  } catch {
    return '';
  }
}

function normalizeCategory(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => insightItemToString(item))
    .filter(s => s.length > 0);
}

/** Coerce AI / JSON payloads into display-safe string arrays. */
export function normalizeInsightsPayload(raw: RawInsights): InsightsData {
  return {
    timing: normalizeCategory(raw.timing),
    content: normalizeCategory(raw.content),
    keywords: normalizeCategory(raw.keywords),
    strategy: normalizeCategory(raw.strategy),
  };
}
