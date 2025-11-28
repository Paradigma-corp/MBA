import { modelFromRecord, sellerFromRecord, yearFromRecord } from './dataParser.js';

const percentile = (values = [], p = 0.5) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const median = (values = []) => percentile(values, 0.5);

const mad = (values = [], center) => {
  if (!values.length) return 0;
  const med = center ?? median(values);
  const deviations = values.map((value) => Math.abs(value - med));
  return median(deviations);
};

const bootstrapMedianCI = (values = [], samples = 2000, confidence = 0.95) => {
  if (!values.length) return { lower: 0, upper: 0, samples: [] };
  const n = values.length;
  const draws = new Float64Array(samples);

  for (let i = 0; i < samples; i += 1) {
    const resample = new Float64Array(n);
    for (let j = 0; j < n; j += 1) {
      const idx = Math.floor(Math.random() * n);
      resample[j] = values[idx];
    }
    draws[i] = median(resample);
  }

  const sorted = Array.from(draws).sort((a, b) => a - b);
  const alpha = (1 - confidence) / 2;
  const lower = percentile(sorted, alpha);
  const upper = percentile(sorted, 1 - alpha);
  return { lower, upper, samples: sorted };
};

export const summarizeMarginsByLine = (
  records = [],
  { bootstrapSamples = 2000, outlierRule = 'pRange', includeOutliers = true } = {},
) => {
  const groups = new Map();

  records.forEach((record) => {
    const line = record.businessLine || record['Línea de Negocio'] || record.lineaNegocio;
    const margin = Number(record.margen);
    if (!line || !Number.isFinite(margin)) return;

    if (!groups.has(line)) {
      groups.set(line, { margins: [], years: new Set(), sellers: new Set(), detail: [] });
    }
    const group = groups.get(line);
    group.margins.push(margin);
    const year = yearFromRecord(record);
    if (year !== undefined && year !== null) group.years.add(year);
    const seller = sellerFromRecord(record);
    if (seller) group.sellers.add(seller);
    group.detail.push({
      margin,
      year,
      seller,
      model: modelFromRecord(record),
      line,
    });
  });

  return Array.from(groups.entries())
    .map(([line, { margins, years, sellers, detail }]) => {
      if (!margins.length) return null;
      const n = margins.length;
      const q1 = percentile(margins, 0.25);
      const med = percentile(margins, 0.5);
      const q3 = percentile(margins, 0.75);
      const iqr = q3 - q1;
      const p10 = percentile(margins, 0.1);
      const p90 = percentile(margins, 0.9);
      const madValue = mad(margins, med);
      const cvRobust = med !== 0 ? madValue / Math.abs(med) : 0;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      const outliersTukey = detail.filter((item) => item.margin < lowerFence || item.margin > upperFence);
      const outliersPRange = detail.filter((item) => item.margin < p10 || item.margin > p90);
      const activeOutliers = outlierRule === 'pRange' ? outliersPRange : outliersTukey;
      const outlierCount = activeOutliers.length;
      const outlierPct = n ? (outlierCount / n) * 100 : 0;
      const visibleOutliers = includeOutliers ? activeOutliers : [];
      const visibleOutlierCount = includeOutliers ? outlierCount : 0;
      const visibleOutlierPct = includeOutliers ? outlierPct : 0;
      const { lower: ciLower, upper: ciUpper } = bootstrapMedianCI(margins, bootstrapSamples, 0.95);

      return {
        line,
        n,
        q1,
        median: med,
        q3,
        iqr,
        p10,
        p90,
        pRange: p90 - p10,
        mad: madValue,
        cvRobust,
        outlierCount,
        outlierPct,
        outlierCountVisible: visibleOutlierCount,
        outlierPctVisible: visibleOutlierPct,
        outliers: visibleOutliers,
        outliersTukey,
        outliersPRange,
        lowerFence,
        upperFence,
        ciLower,
        ciUpper,
        years: Array.from(years).sort((a, b) => a - b),
        sellers: Array.from(sellers),
        margins,
        outlierRule,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.line.localeCompare(b.line));
};
