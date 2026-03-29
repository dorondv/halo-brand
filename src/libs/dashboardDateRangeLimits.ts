import { addDays, differenceInCalendarDays, endOfDay, startOfDay, subDays } from 'date-fns';

/** Getlate analytics: date range must not exceed one year. */
export const DASHBOARD_MAX_RANGE_INCLUSIVE_DAYS = 365;

/** Earliest selectable start: this many calendar days before today. */
export const DASHBOARD_LOOKBACK_DAYS = 365;

export function getDashboardDateBounds(now: Date = new Date()) {
  const todayEnd = endOfDay(now);
  const earliestStart = startOfDay(subDays(now, DASHBOARD_LOOKBACK_DAYS));
  return { todayEnd, earliestStart };
}

/**
 * Clamp [from, to] to [earliestStart, today] and to at most 365 inclusive calendar days (Getlate limit).
 * If the span is too long, keeps the most recent 365 days ending at `to` (then re-clamps to bounds).
 */
export function clampDashboardDateRange(from: Date, to: Date, now: Date = new Date()): { from: Date; to: Date } {
  const { todayEnd, earliestStart } = getDashboardDateBounds(now);
  let f = startOfDay(from);
  let t = endOfDay(to);
  if (f < earliestStart) {
    f = earliestStart;
  }
  if (t > todayEnd) {
    t = todayEnd;
  }
  if (t < f) {
    return { from: earliestStart, to: todayEnd };
  }

  const span = differenceInCalendarDays(startOfDay(t), f) + 1;
  if (span <= DASHBOARD_MAX_RANGE_INCLUSIVE_DAYS) {
    return { from: f, to: t };
  }

  f = startOfDay(subDays(startOfDay(t), DASHBOARD_MAX_RANGE_INCLUSIVE_DAYS - 1));
  if (f < earliestStart) {
    f = earliestStart;
    t = endOfDay(addDays(f, DASHBOARD_MAX_RANGE_INCLUSIVE_DAYS - 1));
    if (t > todayEnd) {
      t = todayEnd;
    }
  }
  return { from: f, to: t };
}
