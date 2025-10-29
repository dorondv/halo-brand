export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num === null || num === undefined || !Number.isFinite(num)) {
    return '0';
  }

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  const formatWithSuffix = (divisor: number, suffix: string) => {
    const scaled = abs / divisor;
    const fixed = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1);
    const trimmed = Number.parseFloat(fixed).toString();
    return `${sign}${trimmed}${suffix}`;
  };

  if (abs >= 1_000_000_000_000) {
    return formatWithSuffix(1_000_000_000_000, 'T');
  }
  if (abs >= 1_000_000_000) {
    return formatWithSuffix(1_000_000_000, 'B');
  }
  if (abs >= 1_000_000) {
    return formatWithSuffix(1_000_000, 'M');
  }
  if (abs >= 1_000) {
    return formatWithSuffix(1_000, 'K');
  }

  return new Intl.NumberFormat().format(num);
}

export default formatNumber;
