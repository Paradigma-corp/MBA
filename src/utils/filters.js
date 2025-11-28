import { businessLineFromRecord, yearFromRecord } from './dataParser.js';

export const defaultFilters = {
  years: [],
  businessLine: 'all',
};

export const filterRecords = (records = [], filters = defaultFilters) =>
  records.filter((record) => {
    const year = yearFromRecord(record);
    const line = businessLineFromRecord(record);
    const matchYear =
      filters.years.length === 0 || (year !== undefined && year !== null && filters.years.includes(year));
    const matchBusiness = filters.businessLine === 'all' || (line && line === filters.businessLine);
    return matchYear && matchBusiness;
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

  return { years, businessLines };
};
