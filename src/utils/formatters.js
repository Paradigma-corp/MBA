export const formatNumber = (value, options = {}) =>
  Number.isFinite(value) ? value.toLocaleString('es-ES', { maximumFractionDigits: 2, ...options }) : '—';

export const formatCurrency = (value) =>
  Number.isFinite(value) ? `$${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}` : '—';

export const formatMillionsUSD = (value) => {
  if (!Number.isFinite(value)) return '—';
  const millions = value / 1_000_000;
  return `$${millions.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
};

export const formatPercent = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}%` : '—');
