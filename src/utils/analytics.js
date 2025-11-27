import { normalizeBusinessLine } from './dataParser.js';

const ensureFinite = (value) => (Number.isFinite(value) ? value : 0);

const parseNumber = (value) => {
  if (value === undefined || value === null) return NaN;
  if (typeof value === 'number') return value;
  const cleaned = value
    .toString()
    .replace(/[^0-9,.-]/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '.');
  return Number(cleaned);
};

export const correlationCoefficient = (valuesA, valuesB) => {
  const cleanedA = valuesA.map(ensureFinite);
  const cleanedB = valuesB.map(ensureFinite);
  const n = Math.min(cleanedA.length, cleanedB.length);
  if (n < 2) return 0;

  const sliceA = cleanedA.slice(0, n);
  const sliceB = cleanedB.slice(0, n);

  const mean = (values) => values.reduce((acc, value) => acc + value, 0) / values.length;
  const meanA = mean(sliceA);
  const meanB = mean(sliceB);
  const cov =
    sliceA.reduce((acc, value, index) => acc + (value - meanA) * (sliceB[index] - meanB), 0) /
    (n - 1);
  const std = (values, meanValue) =>
    Math.sqrt(values.reduce((acc, value) => acc + (value - meanValue) ** 2, 0) / (n - 1));
  const stdA = std(sliceA, meanA);
  const stdB = std(sliceB, meanB);
  if (stdA === 0 || stdB === 0) return 0;
  return cov / (stdA * stdB);
};

const sumRecordValues = (target, record) => {
  target.ingresos += ensureFinite(parseNumber(record.ingresos));
  target.costos += ensureFinite(parseNumber(record.costos));
  target.margen += ensureFinite(parseNumber(record.margen));
  target.unidades += ensureFinite(parseNumber(record['Unidades UN']));
  target.count += 1;
  return target;
};

const buildCategorySeries = (records) => {
  return records.reduce(
    (acc, record) => {
      const category =
        normalizeBusinessLine(
          record.lineaNegocio ||
            record['Linea de negocio'] ||
            record['Línea de negocio'] ||
            record['lineaNegocio'] ||
            record['Linea Negocio'] ||
            record['Línea Negocio'] ||
            record['linea de negocio'] ||
            record['línea de negocio'],
        ) || record['Nombre segmentación'] || record.segmentacionIGD;

      if (!category) return acc;

      const period = `${record.Año || record.year || 's/f'}-${record.Mes || record.month || 's/m'}`;
      if (!acc.series[category]) {
        acc.series[category] = {};
        acc.categories.add(category);
      }
      if (!acc.series[category][period]) {
        acc.series[category][period] = { ingresos: 0, costos: 0, margen: 0, unidades: 0, count: 0 };
      }
      acc.series[category][period] = sumRecordValues(acc.series[category][period], record);
      return acc;
    },
    { series: {}, categories: new Set() },
  );
};

const alignValuesByPeriod = (seriesA, seriesB, metric) => {
  const periods = Object.keys(seriesA).filter((key) => seriesB[key]);
  const valuesA = periods.map((key) => ensureFinite(seriesA[key][metric]));
  const valuesB = periods.map((key) => ensureFinite(seriesB[key][metric]));
  return { valuesA, valuesB };
};

const interpretCorrelationStrength = (value) => {
  const abs = Math.abs(value);
  if (abs < 0.3) return 'correlación débil (casi independiente)';
  if (abs < 0.7) return 'correlación moderada';
  return 'correlación fuerte (dependencia clara)';
};

const CORE_CATEGORIES = ['Automóviles', 'Vans', 'Camiones', 'Buses'];

export const computeCategoryCorrelations = (records) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const { series, categories: foundCategories } = buildCategorySeries(safeRecords);
  const discovered = Array.from(foundCategories);
  const preferred = CORE_CATEGORIES.filter((cat) => foundCategories.has(cat));
  const extras = discovered.filter((cat) => !CORE_CATEGORIES.includes(cat)).sort();
  const categories = preferred.length ? [...preferred, ...extras] : extras;
  const primaryCategories = preferred.length
    ? preferred
    : categories.slice(0, Math.min(4, categories.length));
  const metrics = ['ingresos', 'costos', 'margen', 'unidades'];
  const matrices = {};

  metrics.forEach((metric) => {
    matrices[metric] = categories.map((catA) =>
      categories.map((catB) => {
        if (catA === catB) return 1;
        const { valuesA, valuesB } = alignValuesByPeriod(series[catA] || {}, series[catB] || {}, metric);
        return correlationCoefficient(valuesA, valuesB);
      }),
    );
  });

  return { categories, matrices, primaryCategories };
};

export const computeOneVsManyCorrelations = (records) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const { series, categories: foundCategories } = buildCategorySeries(safeRecords);
  const discovered = Array.from(foundCategories);
  const preferred = CORE_CATEGORIES.filter((cat) => foundCategories.has(cat));
  const extras = discovered.filter((cat) => !CORE_CATEGORIES.includes(cat)).sort();
  const categories = preferred.length ? [...preferred, ...extras] : extras;
  const metrics = ['ingresos', 'costos', 'margen', 'unidades'];

  return categories.map((category) => {
    const remainingPeriods = {};
    categories.forEach((other) => {
      if (other === category) return;
      Object.entries(series[other] || {}).forEach(([period, data]) => {
        if (!remainingPeriods[period]) {
          remainingPeriods[period] = { ingresos: 0, costos: 0, margen: 0, unidades: 0 };
        }
        remainingPeriods[period].ingresos += data.ingresos;
        remainingPeriods[period].costos += data.costos;
        remainingPeriods[period].margen += data.margen;
        remainingPeriods[period].unidades += data.unidades;
      });
    });

    const correlations = metrics.reduce((acc, metric) => {
      const { valuesA, valuesB } = alignValuesByPeriod(series[category] || {}, remainingPeriods, metric);
      const rho = correlationCoefficient(valuesA, valuesB);
      acc[metric] = rho;
      return acc;
    }, {});

    const summary = interpretCorrelationStrength(correlations.margen ?? 0);

    return {
      category,
      correlations,
      summary,
    };
  });
};

const buildCategoryMeans = (records) => {
  const categories = ['Automóviles', 'Vans', 'Camiones', 'Buses'];
  const sums = Object.fromEntries(categories.map((cat) => [cat, { sum: 0, count: 0 }]));

  records.forEach((record) => {
    const category =
      normalizeBusinessLine(
        record.lineaNegocio ||
          record['Linea de negocio'] ||
          record['Línea de negocio'] ||
          record['lineaNegocio'] ||
          record['Linea Negocio'] ||
          record['Línea Negocio'] ||
          record['linea de negocio'] ||
          record['línea de negocio'],
      ) || record['Nombre segmentación'] || record.segmentacionIGD;
    const margin = ensureFinite(parseNumber(record.margen));
    if (!category || !categories.includes(category)) return;
    sums[category].sum += margin;
    sums[category].count += 1;
  });

  return Object.fromEntries(
    categories.map((cat) => [cat, sums[cat].count > 0 ? sums[cat].sum / sums[cat].count : 0]),
  );
};

const predictMargin = (category, betas) => {
  const value = betas[category] ?? 0;
  return ensureFinite(value);
};

const computeRSquared = (records, betas) => {
  const rows = records
    .map((record) => ({
      category:
        normalizeBusinessLine(
          record.lineaNegocio ||
            record['Linea de negocio'] ||
            record['Línea de negocio'] ||
            record['lineaNegocio'] ||
            record['Linea Negocio'] ||
            record['Línea Negocio'] ||
            record['linea de negocio'] ||
            record['línea de negocio'],
        ) || record['Nombre segmentación'] || record.segmentacionIGD,
      margin: ensureFinite(parseNumber(record.margen)),
    }))
    .filter((row) => row.category);

  if (!rows.length) return 0;

  const meanMargin = rows.reduce((acc, row) => acc + row.margin, 0) / rows.length;
  let ssTotal = 0;
  let ssResidual = 0;

  rows.forEach((row) => {
    const prediction = predictMargin(row.category, betas);
    ssTotal += (row.margin - meanMargin) ** 2;
    ssResidual += (row.margin - prediction) ** 2;
  });

  if (ssTotal === 0) return 0;
  return 1 - ssResidual / ssTotal;
};

const describeImpact = (beta, maxAbsBeta) => {
  const abs = Math.abs(beta);
  if (abs === 0) return 'Sin impacto';
  if (abs >= 0.75 * maxAbsBeta) return 'Alto';
  if (abs >= 0.4 * maxAbsBeta) return 'Medio';
  return 'Bajo';
};

export const buildRegressionModel = (records) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const betas = buildCategoryMeans(safeRecords);
  const rSquared = computeRSquared(safeRecords, betas);
  const betasWithoutAuto = { ...betas, Automóviles: 0 };
  const rSquaredWithoutAuto = computeRSquared(safeRecords, betasWithoutAuto);

  const betaValues = Object.values(betas);
  const maxAbsBeta = betaValues.reduce((max, value) => Math.max(max, Math.abs(value)), 0) || 1;
  const averageOtherBeta = (betas.Vans + betas.Camiones + betas.Buses) / 3;
  const deltaR2 = rSquared - rSquaredWithoutAuto;

  const summary = {
    averageOtherBeta,
    deltaR2,
    interpretation: `El coeficiente β de Autos es ${betas.Automóviles.toFixed(
      2,
    )}, comparado con ${averageOtherBeta.toFixed(
      2,
    )} en promedio para las otras tres categorías. R²: ${rSquared.toFixed(
      3,
    )}. La exclusión de Autos reduce el R² en ${deltaR2.toFixed(3)}.`,
  };

  const table = [
    ['Automóviles', betas.Automóviles],
    ['Vans', betas.Vans],
    ['Camiones', betas.Camiones],
    ['Buses', betas.Buses],
  ].map(([category, beta]) => ({
    category,
    beta,
    impact: describeImpact(beta, maxAbsBeta),
  }));

  return {
    betas,
    rSquared,
    rSquaredWithoutAuto,
    averageOtherBeta,
    deltaR2,
    table,
    maxAbsBeta,
    summary,
  };
};

export const recomputeModelWithBetas = (records, betas) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const rSquared = computeRSquared(safeRecords, betas);
  const betasWithoutAuto = { ...betas, Automóviles: 0 };
  const rSquaredWithoutAuto = computeRSquared(safeRecords, betasWithoutAuto);
  const averageOtherBeta = (betas.Vans + betas.Camiones + betas.Buses) / 3;
  const deltaR2 = rSquared - rSquaredWithoutAuto;

  return {
    rSquared,
    rSquaredWithoutAuto,
    averageOtherBeta,
    deltaR2,
  };
};
