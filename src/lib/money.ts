export function getMoneyDecimals(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = Number(localStorage.getItem('psycloud:moneyDecimals') || '0');
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(2, Math.round(v)));
  } catch {
    return 0;
  }
}

export function formatMoneyFromCents(cents: number, decimals = 0, locale = 'es-CO'): string {
  const d = Math.max(0, Math.min(2, Math.round(decimals)));
  const value = (Number(cents) || 0) / Math.pow(10, d);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
}

export function parseMoneyToCents(input: string | number, decimals = 0): number {
  const d = Math.max(0, Math.min(2, Math.round(decimals)));
  const s = String(input ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * Math.pow(10, d));
}
