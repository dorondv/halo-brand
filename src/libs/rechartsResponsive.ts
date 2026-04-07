/**
 * Recharts 3 `ResponsiveContainer` uses `initialDimension` −1×−1 until `ResizeObserver` runs,
 * which triggers console warnings. Positive placeholders match our Tailwind chart heights
 * (e.g. h-80 = 320px) so the first paint is valid; the observer still updates to real size.
 */
export const RECHARTS_INITIAL_H80 = { width: 400, height: 320 } as const;
export const RECHARTS_INITIAL_H64 = { width: 400, height: 256 } as const;
export const RECHARTS_INITIAL_300 = { width: 400, height: 300 } as const;
export const RECHARTS_INITIAL_250 = { width: 400, height: 250 } as const;
