import {
  businessLineFromRecord,
  conditionFromRecord,
  marginFromRecord,
  sellerFromRecord,
  yearFromRecord,
  normalizeFinancialRecord,
} from './dataParser.js';

export const deriveFilterOptions = (records = []) => {
  const years = Array.from(
    new Set(
      records
        .map((item) => yearFromRecord(item))
        .filter((year) => year !== undefined && year !== null && !Number.isNaN(year)),
    ),
  ).sort((a, b) => a - b);

  const conditions = ['Todos', 'Nuevo', 'Usado'];

  const margins = records
    .map((record) => normalizeFinancialRecord(record)?.margen)
    .filter((value) => Number.isFinite(value));
  const marginRange = margins.length
    ? { min: Math.min(...margins), max: Math.max(...margins) }
    : { min: 0, max: 0 };

  const sellerMap = new Map();
  records.forEach((record) => {
    const seller = sellerFromRecord(record);
    if (!seller) return;
    const line = businessLineFromRecord(record) || 'Sin línea';
    const prev = sellerMap.get(seller);
    const nextLine = prev && prev.line !== line ? 'Mixto' : line;
    sellerMap.set(seller, { value: seller, label: seller, line: nextLine });
  });

  const sellers = Array.from(sellerMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  return { years, conditions, marginRange, sellers };
};

export const createDefaultFilters = (options = {}) => ({
  years: new Set(),
  condicion: 'Todos',
  vendedores: new Set(),
  mMin: options.marginRange?.min ?? 0,
  mMax: options.marginRange?.max ?? 0,
  logScale: false,
});

export const selectSample = (rows = [], f = createDefaultFilters()) =>
  rows
    .filter((r) => f.years.size === 0 || f.years.has(yearFromRecord(r)))
    .filter((r) => (f.condicion === 'Todos' ? true : conditionFromRecord(r) === f.condicion))
    .filter((r) => (f.vendedores.size ? f.vendedores.has(sellerFromRecord(r)) : true))
    .filter((r) => {
      const normalized = normalizeFinancialRecord(r);
      const margin = Number.isFinite(normalized.margen) ? normalized.margen : marginFromRecord(r);
      if (!Number.isFinite(margin)) return true;
      return margin >= f.mMin && margin <= f.mMax;
    });

export const clampMarginRange = (filters, bounds) => ({
  ...filters,
  mMin: Math.max(bounds.min, Math.min(filters.mMin, bounds.max)),
  mMax: Math.min(bounds.max, Math.max(filters.mMax, bounds.min)),
});

export const deriveMarginBounds = (records = [], filters = createDefaultFilters()) => {
  const baseFilters = { ...filters, mMin: Number.NEGATIVE_INFINITY, mMax: Number.POSITIVE_INFINITY };
  const margins = selectSample(records, baseFilters)
    .map((row) => normalizeFinancialRecord(row)?.margen)
    .filter((value) => Number.isFinite(value));
  if (!margins.length) return { min: 0, max: 0 };
  return { min: Math.min(...margins), max: Math.max(...margins) };
};

const parseSetParam = (param) => new Set(param.split(',').map((value) => value.trim()).filter(Boolean));
const parseVendorParam = (param) => new Set(param.split(';').map((value) => value.trim()).filter(Boolean));

export const parseFiltersFromQuery = (search = '', options = {}) => {
  const query = new URLSearchParams(search);
  const years = query.has('years') ? parseSetParam(query.get('years')) : new Set();
  const condicion = query.get('cond') ?? 'Todos';
  const vendedores = query.has('vendors') ? parseVendorParam(query.get('vendors')) : new Set();
  const mMin = query.has('mMin') ? Number(query.get('mMin')) : options.marginRange?.min ?? 0;
  const mMax = query.has('mMax') ? Number(query.get('mMax')) : options.marginRange?.max ?? 0;
  return { years, condicion, vendedores, mMin, mMax, logScale: false };
};

export const serializeFiltersToQuery = (filters = createDefaultFilters()) => {
  const params = new URLSearchParams();
  if (filters.years.size) params.set('years', Array.from(filters.years).join(','));
  if (filters.condicion && filters.condicion !== 'Todos') params.set('cond', filters.condicion);
  if (filters.vendedores.size) params.set('vendors', Array.from(filters.vendedores).join(';'));
  params.set('mMin', filters.mMin);
  params.set('mMax', filters.mMax);
  return params.toString();
};
