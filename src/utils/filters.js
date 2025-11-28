import { businessLineFromRecord, conditionFromRecord, marginFromRecord, yearFromRecord } from './dataParser.js';

export const defaultFilters = {
  years: [],
  condition: 'all',
  marginRange: null,
};

export const filterRecords = (records = [], filters = defaultFilters) =>
  records.filter((record) => {
    const year = yearFromRecord(record);
    const condition = conditionFromRecord(record);
    const margin = marginFromRecord(record);
    const matchYear =
      filters.years.length === 0 || (year !== undefined && year !== null && filters.years.includes(year));
    const matchCondition = filters.condition === 'all' || (condition && condition.toLowerCase() === filters.condition);
    const [minMargin, maxMargin] = filters.marginRange ?? [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
    const matchMargin = Number.isFinite(margin) && margin >= minMargin && margin <= maxMargin;
    return matchYear && matchCondition && matchMargin;
  });

export const deriveFilterOptions = (records = []) => {
  const years = Array.from(
    new Set(
      records
        .map((item) => yearFromRecord(item))
        .filter((year) => year !== undefined && year !== null && !Number.isNaN(year)),
    ),
  ).sort((a, b) => a - b);

  const businessLines = Array.from(
    new Set(
      records
        .map((item) => businessLineFromRecord(item))
        .filter((value) => value !== undefined && value !== null)
        .map((value) => value.toString()),
    ),
  )
    .filter((value) => value)
    .sort((a, b) => a.localeCompare(b));

  const conditions = Array.from(
    new Set(
      records
        .map((record) => conditionFromRecord(record))
        .filter((value) => value !== undefined && value !== null)
        .map((value) => value.toString().toLowerCase()),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const margins = records
    .map((record) => marginFromRecord(record))
    .filter((value) => Number.isFinite(value));

  const marginRange = margins.length
    ? { min: Math.min(...margins), max: Math.max(...margins) }
    : { min: 0, max: 0 };

  return { years, businessLines, conditions, marginRange };
};
