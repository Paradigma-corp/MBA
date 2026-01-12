import { useCallback, useMemo, useState } from 'react';
import { normalizeRecords, monthFromRecord, yearFromRecord } from '../utils/dataParser.js';

const pearsonCorrelation = (x = [], y = []) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return Number.NaN;
  const meanX = x.reduce((acc, val) => acc + val, 0) / n;
  const meanY = y.reduce((acc, val) => acc + val, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return Number.NaN;
  return num / Math.sqrt(denX * denY);
};

const toYearMonth = (year, month) => (Number.isFinite(year) && Number.isFinite(month) ? year * 100 + month : null);

const buildMonthlySeries = (records = [], metricKey = 'margen') => {
  const normalized = normalizeRecords(records);
  const monthly = new Map();

  normalized.forEach((row) => {
    const line = row.businessLine;
    if (!line || !Number.isFinite(row[metricKey])) return;
    const ym = toYearMonth(yearFromRecord(row), monthFromRecord(row));
    if (!ym) return;
    if (!monthly.has(line)) monthly.set(line, new Map());
    const prev = monthly.get(line).get(ym) || 0;
    monthly.get(line).set(ym, prev + Number(row[metricKey]));
  });

  const seriesByLine = new Map();
  monthly.forEach((monthMap, line) => {
    const months = Array.from(monthMap.keys()).sort();
    const values = months.map((m) => monthMap.get(m) || 0);
    seriesByLine.set(line, { months, values });
  });

  const allMonths = new Set();
  seriesByLine.forEach((series) => series.months.forEach((m) => allMonths.add(m)));

  const alignedSeries = new Map();
  seriesByLine.forEach((series, line) => {
    const months = Array.from(allMonths).sort();
    const values = months.map((m) => {
      const idx = series.months.indexOf(m);
      return idx === -1 ? null : series.values[idx];
    });
    alignedSeries.set(line, { months, values });
  });

  return { lines: Array.from(seriesByLine.keys()).sort(), seriesByLine: alignedSeries, monthCount: allMonths.size };
};

const oneVsRestCorrelation = (seriesByLine, lines) =>
  lines.map((line) => {
    const target = seriesByLine.get(line);
    if (!target) return { line, r: Number.NaN };
    const otherMonths = new Map();
    lines
      .filter((l) => l !== line)
      .forEach((other) => {
        const otherSeries = seriesByLine.get(other);
        if (!otherSeries) return;
        otherSeries.months.forEach((m, idx) => {
          const value = otherSeries.values[idx];
          if (value === null) return;
          otherMonths.set(m, (otherMonths.get(m) || 0) + value);
        });
      });
    const pairs = [];
    target.months.forEach((m, idx) => {
      const val = target.values[idx];
      if (val === null || !otherMonths.has(m)) return;
      pairs.push([val, otherMonths.get(m)]);
    });
    if (pairs.length < 3) return { line, r: Number.NaN, n: pairs.length };
    const r = pearsonCorrelation(
      pairs.map(([x]) => x),
      pairs.map(([, y]) => y),
    );
    return { line, r, n: pairs.length };
  });

export const buildCorrelationBindings = (records = [], metricKey = 'margen') => {
  const { lines, seriesByLine, monthCount } = buildMonthlySeries(records, metricKey);
  if (!lines.length) return { avgAbsR: null, minOneVsAll: null, monthCount: 0 };
  let totalAbs = 0;
  let pairs = 0;

  lines.forEach((lineA, idx) => {
    for (let j = idx + 1; j < lines.length; j += 1) {
      const lineB = lines[j];
      const seriesA = seriesByLine.get(lineA);
      const seriesB = seriesByLine.get(lineB);
      if (!seriesA || !seriesB) continue;
      const pairsValues = [];
      seriesA.months.forEach((m, monthIdx) => {
        const aVal = seriesA.values[monthIdx];
        const bIdx = seriesB.months.indexOf(m);
        const bVal = bIdx === -1 ? null : seriesB.values[bIdx];
        if (aVal === null || bVal === null) return;
        pairsValues.push([aVal, bVal]);
      });
      if (pairsValues.length < 3) continue;
      const r = pearsonCorrelation(
        pairsValues.map(([x]) => x),
        pairsValues.map(([, y]) => y),
      );
      if (Number.isFinite(r)) {
        totalAbs += Math.abs(r);
        pairs += 1;
      }
    }
  });

  const oneVsAll = oneVsRestCorrelation(seriesByLine, lines);
  const validOneVsAll = oneVsAll.filter((item) => Number.isFinite(item.r));
  const minOneVsAll = validOneVsAll.length ? Math.min(...validOneVsAll.map((item) => item.r)) : null;

  return {
    avgAbsR: pairs ? totalAbs / pairs : null,
    minOneVsAll,
    monthCount,
  };
};

export const useBindingsResolver = (bindingMap = {}) => {
  const [timestamp, setTimestamp] = useState(Date.now());

  const resolveToken = useCallback(
    (token) => {
      const parts = token.split('.');
      let value = bindingMap;
      for (const part of parts) {
        if (value && Object.prototype.hasOwnProperty.call(value, part)) {
          value = value[part];
        } else {
          return { value: null, missing: true };
        }
      }
      if (value === undefined) return { value: null, missing: true };
      return { value, missing: false };
    },
    [bindingMap],
  );

  const resolveText = useCallback(
    (text) => {
      const missingTokens = new Set();
      const resolved = text.replace(/{{(.*?)}}/g, (match, token) => {
        const { value, missing } = resolveToken(token.trim());
        if (missing) {
          missingTokens.add(token.trim());
          return '— (actualiza módulo)';
        }
        if (value === null || value === undefined) {
          missingTokens.add(token.trim());
          return '— (actualiza módulo)';
        }
        if (typeof value === 'number') {
          if (Math.abs(value) >= 100) return value.toLocaleString('en-US');
          return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
        }
        return value;
      });
      return { text: resolved, missing: Array.from(missingTokens) };
    },
    [resolveToken],
  );

  const refresh = useCallback(() => setTimestamp(Date.now()), []);

  return useMemo(
    () => ({
      resolveToken,
      resolveText,
      refresh,
      timestamp,
    }),
    [resolveText, resolveToken, timestamp, refresh],
  );
};

