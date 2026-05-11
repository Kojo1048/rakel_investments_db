export const CURRENCIES = ['NLE', 'USD', 'GBP', 'EUR'] as const;
export type Currency = typeof CURRENCIES[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  NLE: 'NLE — Leones (Le)',
  USD: 'USD — US Dollar ($)',
  GBP: 'GBP — British Pound (£)',
  EUR: 'EUR — Euro (€)',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NLE: 'Le',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

/** Format a monetary amount with the correct currency symbol. */
export function fmtCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}
