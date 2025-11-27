import { normalizeBusinessLine } from './dataParser.js';

export const CORE_LINES = ['Automóviles', 'Vans', 'Camiones', 'Buses'];

const ensureFinite = (value) => (Number.isFinite(value) ? value : 0);

export const canonicalLine = (raw) => {
  const normalized = normalizeBusinessLine(raw) || '';
  if (!normalized) return '';
  if (normalized.toLowerCase().startsWith('auto')) return 'Automóviles';
  if (normalized.toLowerCase().startsWith('van')) return 'Vans';
  if (normalized.toLowerCase().startsWith('camion')) return 'Camiones';
  if (normalized.toLowerCase().startsWith('bus')) return 'Buses';
  return normalized;
};

export function poissonCdf(m, lambda) {
  if (lambda <= 0) return m >= 0 ? 1 : 0;
  const upper = Math.max(0, Math.floor(m));
  let sum = 0;
  let term = Math.exp(-lambda);
  sum += term;
  for (let i = 1; i <= upper; i += 1) {
    term *= lambda / i;
    sum += term;
  }
  return Math.min(1, sum);
}

export const poissonPAtLeastK = (k, lambda) => (k <= 0 ? 1 : 1 - poissonCdf(k - 1, lambda));

export function fitNegBinMoment(mu, sigma2) {
  if (sigma2 <= mu) return { r: Infinity, p: 1 };
  const r = (mu * mu) / (sigma2 - mu);
  const p = r / (r + mu);
  return { r, p };
}

export function negbinCdf(m, r, p) {
  if (m < 0) return 0;
  if (!Number.isFinite(r) || p >= 1) return 1;
  const upper = Math.max(0, Math.floor(m));
  let sum = 0;
  let term = p ** r;
  sum += term;
  for (let k = 1; k <= upper; k += 1) {
    term *= ((1 - p) * (k - 1 + r)) / (k * p);
    sum += term;
  }
  return Math.min(1, sum);
}

export const negbinPAtLeastK = (k, r, p) => (k <= 0 ? 1 : 1 - negbinCdf(k - 1, r, p));

const extractYear = (value) => {
  const numeric = Number(value);
  if ([2022, 2023, 2024].includes(numeric)) return numeric;
  return undefined;
};

const extractVendor = (record) =>
  record.nombreVendedor || record.vendedor || record['Vendedor SAP'] || record['Nombre vendedor'] || 'Vendedor sin nombre';

const extractUnits = (record) =>
  ensureFinite(
    Number(
      record.ventas ??
        record['ventas'] ??
        record['Unidades UN'] ??
        record.unidades ??
        record.unidadesVendidas ??
        record['Unidades'],
    ),
  );

const extractMargin = (record) => ensureFinite(Number(record.margen_total ?? record.margen ?? record.margenTotal));

export function aggregateVentaAnual(records = []) {
  const map = new Map();
  const safeRecords = Array.isArray(records) ? records : [];

  safeRecords.forEach((record) => {
    const linea = canonicalLine(
      record.lineaNegocio ||
        record['Linea de negocio'] ||
        record['Línea de negocio'] ||
        record['lineaNegocio'] ||
        record['Linea Negocio'] ||
        record['Línea Negocio'] ||
        record['linea de negocio'] ||
        record['línea de negocio'] ||
        record['Nombre segmentación'],
    );
    if (!linea || !CORE_LINES.includes(linea)) return;

    const anio = extractYear(record.Año || record.anio || record.year);
    if (!anio) return;

    const vendedor = extractVendor(record);
    const ventas = extractUnits(record);
    const margen_total = extractMargin(record);

    const key = `${linea}|${vendedor}|${anio}`;
    if (!map.has(key)) {
      map.set(key, { linea, vendedor, anio, ventas: 0, margen_total: 0 });
    }
    const current = map.get(key);
    map.set(key, {
      ...current,
      ventas: current.ventas + ventas,
      margen_total: current.margen_total + margen_total,
    });
  });

  return Array.from(map.values());
}

export function deriveMetasFromData(ventasAnuales = []) {
  const grouped = CORE_LINES.map((linea) => {
    const rows = ventasAnuales.filter((row) => row.linea === linea);
    const totalVentas = rows.reduce((acc, row) => acc + row.ventas, 0);
    const totalMargen = rows.reduce((acc, row) => acc + row.margen_total, 0);
    const n = rows.length || 1;
    const ventasMedias = totalVentas / n;
    const margenMedio = totalVentas > 0 ? totalMargen / totalVentas : 0;
    return { linea, ventasMedias, margenMedio };
  });

  const metas = grouped.map(({ linea, ventasMedias, margenMedio }) => ({
    linea,
    k: Math.max(1, Math.round(ventasMedias * 1.1)),
    margen_medio: margenMedio || 1,
    ic95_inferior_margen: margenMedio * 0.9,
    ic95_superior_margen: margenMedio * 1.1,
  }));

  return metas;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const summarizeProbability = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { median: 0, iqr: 0 };
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = ensureFinite(q3 - q1);
  return { median, iqr };
};

export function computeLineMetrics(metas = []) {
  const marginByLine = Object.fromEntries(metas.map((meta) => [meta.linea, meta.margen_medio]));
  const maxMargin = Math.max(...Object.values(marginByLine).map((v) => ensureFinite(v)), 1);

  return Object.fromEntries(
    metas.map((meta) => {
      const margenRel = maxMargin > 0 ? ensureFinite(meta.margen_medio) / maxMargin : 0;
      const variab = clamp01(
        ensureFinite(meta.ic95_superior_margen - meta.ic95_inferior_margen) /
          (meta.margen_medio || 1),
      );
      return [meta.linea, { margenRel, variab }];
    }),
  );
}

const familyDecision = (mu, sigma2, familyOverride) => {
  if (familyOverride === 'poisson') return 'poisson';
  if (familyOverride === 'negbin') return 'negbin';
  if (!Number.isFinite(mu) || !Number.isFinite(sigma2)) return 'poisson';
  return sigma2 > mu ? 'negbin' : 'poisson';
};

export function buildPriorityModel({
  ventasAnuales = [],
  metas = [],
  exposicion = { 2022: 1, 2023: 1, 2024: 1 },
  horizon = 1,
  thresholds = { a: 0.6, b: 0.35 },
  family = 'auto',
  lambdaScale = 1,
  kShift = 0,
}) {
  const metasByLine = Object.fromEntries(metas.map((meta) => [meta.linea, meta]));
  const lineMetrics = computeLineMetrics(metas);

  const grouped = ventasAnuales.reduce((acc, row) => {
    if (!acc[row.linea]) acc[row.linea] = new Map();
    const key = `${row.vendedor}`;
    if (!acc[row.linea].has(key)) acc[row.linea].set(key, []);
    acc[row.linea].get(key).push(row);
    return acc;
  }, {});

  const lineResults = CORE_LINES.map((linea) => {
    const vendorRows = grouped[linea] || new Map();
    const entries = Array.from(vendorRows.entries()).map(([vendor, rows]) => {
      const counts = rows.map((row) => row.ventas);
      const exposures = rows.map((row) => exposicion[row.anio] ?? 1);
      const totalExposure = exposures.reduce((acc, value) => acc + value, 0);
      const nPeriods = exposures.filter((value) => value > 0).length || counts.length || 1;
      if (totalExposure <= 0) {
        return {
          linea,
          vendedor: vendor,
          lambda: 0,
          familia: 'sin_exposicion',
          prob: 0,
          segmento: 'Sin datos',
          priority: 0,
          totalVentas: 0,
          margenTotal: 0,
          exposureUsada: totalExposure,
          kTarget: metasByLine[linea]?.k ?? 0,
          margenRel: lineMetrics[linea]?.margenRel ?? 0,
          variab: lineMetrics[linea]?.variab ?? 0,
          errorMargin: 0,
          precisionLevel: 'Baja',
          nPeriods,
          modeloLabel: 'Sin exposición',
          overconfident: false,
        };
      }

      const totalVentas = rows.reduce((acc, row) => acc + row.ventas, 0);
      const lambdaHat = totalVentas / totalExposure;
      const mu = counts.reduce((acc, value) => acc + value, 0) / counts.length;
      const variance = counts.reduce((acc, value) => acc + (value - mu) ** 2, 0) / Math.max(1, counts.length - 1);
      const chosenFamily = familyDecision(mu, variance, family);

      const adjustedLambda = lambdaHat * lambdaScale;
      const adjustedMu = mu * lambdaScale * horizon;
      const adjustedVariance = variance * lambdaScale * horizon;

      let prob = 0;
      let errorMargin = 0;
      const meta = metasByLine[linea];
      const kTarget = Math.max(0, Math.round((meta?.k ?? 0) + kShift));
      const effectiveLambda = adjustedLambda * horizon;

      if (chosenFamily === 'poisson') {
        prob = poissonPAtLeastK(kTarget, effectiveLambda);
      } else {
        const { r, p } = fitNegBinMoment(adjustedMu, adjustedVariance);
        if (!Number.isFinite(r) || p <= 0 || p >= 1) {
          prob = poissonPAtLeastK(kTarget, effectiveLambda);
        } else {
          prob = negbinPAtLeastK(kTarget, r, p);
          const nEff = Math.max(1, nPeriods);
          const stderr = Math.sqrt(prob * (1 - prob)) / Math.sqrt(nEff);
          errorMargin = Math.min(0.25, stderr * 1.96);
        }
      }

      const metricLine = lineMetrics[linea] || { margenRel: 0, variab: 0 };
      const priority = 0.6 * prob + 0.25 * metricLine.margenRel + 0.15 * (1 - metricLine.variab);

      let segmento = 'C';
      if (prob >= thresholds.a) segmento = 'A';
      else if (prob >= thresholds.b) segmento = 'B';

      const margenTotal = rows.reduce((acc, row) => acc + ensureFinite(row.margen_total), 0);

      return {
        linea,
        vendedor: vendor,
        lambda: lambdaHat,
        familia: chosenFamily,
        prob,
        segmento,
        priority,
        totalVentas,
        margenTotal,
        exposureUsada: totalExposure,
        kTarget,
        margenRel: metricLine.margenRel,
        variab: metricLine.variab,
        errorMargin,
        precisionLevel: totalExposure >= 3 ? 'Alta' : totalExposure >= 1.5 ? 'Media' : 'Baja',
        nPeriods,
        modeloLabel:
          family === 'auto'
            ? `Auto — ${chosenFamily === 'poisson' ? 'Poisson' : 'NegBin'}`
            : chosenFamily === 'poisson'
            ? 'Poisson'
            : 'NegBin',
        overconfident: prob >= 0.999,
      };
    });

    const probs = entries.map((entry) => entry.prob);
    const { median, iqr } = summarizeProbability(probs);
    const totalVentas = entries.reduce((acc, entry) => acc + entry.totalVentas, 0);
    const totalMargen = entries.reduce((acc, entry) => acc + entry.margenTotal, 0);
    const totalVendedores = entries.length;
    const segmentCounts = entries.reduce(
      (acc, entry) => {
        acc[entry.segmento] = (acc[entry.segmento] || 0) + 1;
        return acc;
      },
      { A: 0, B: 0, C: 0 },
    );

    return {
      linea,
      entries,
      summary: {
        median,
        iqr,
        totalVentas,
        totalMargen,
        totalVendedores,
        segmentCounts,
      },
    };
  });

  const globalVentas = lineResults.reduce((acc, line) => acc + line.summary.totalVentas, 0) || 1;
  const globalMargen = lineResults.reduce((acc, line) => acc + line.summary.totalMargen, 0) || 1;
  const globalVendedores = lineResults.reduce((acc, line) => acc + line.summary.totalVendedores, 0) || 1;

  const tableSummary = lineResults.map((line) => ({
    linea: line.linea,
    nVendedores: line.summary.totalVendedores,
    pctVendedores: line.summary.totalVendedores / globalVendedores,
    median: line.summary.median,
    iqr: line.summary.iqr,
    pctVentas: line.summary.totalVentas / globalVentas,
    pctMargen: line.summary.totalMargen / globalMargen,
    segmentCounts: line.summary.segmentCounts,
  }));

  const stackedSegments = lineResults.map((line) => {
    const total = Math.max(1, line.summary.totalVendedores);
    return {
      linea: line.linea,
      A: (line.summary.segmentCounts.A || 0) / total,
      B: (line.summary.segmentCounts.B || 0) / total,
      C: (line.summary.segmentCounts.C || 0) / total,
      median: line.summary.median,
    };
  });

  return { lineResults, tableSummary, stackedSegments };
}

export const exportCsv = (entries = []) => {
  const header = [
    'linea',
    'vendedor',
    'lambda_hat',
    'exposicion_total',
    'k_meta',
    'familia',
    'probabilidad',
    'segmento',
    'margen_rel',
    'variab',
    'priority_index',
  ];
  const rows = entries.map((entry) =>
    [
      entry.linea,
      entry.vendedor,
      entry.lambda,
      entry.exposureUsada,
      entry.kTarget,
      entry.familia,
      entry.prob,
      entry.segmento,
      entry.margenRel ?? '',
      entry.variab ?? '',
      entry.priority,
    ]
      .map((value) => `${value}`)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
};

export const formatPercentage = (value) => `${(value * 100).toFixed(1)}%`;

export const priorityLabel = (segmento) => {
  if (segmento === 'A') return { label: 'Segmento A', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (segmento === 'B') return { label: 'Segmento B', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Segmento C', color: 'bg-rose-50 text-rose-700 border-rose-200' };
};
