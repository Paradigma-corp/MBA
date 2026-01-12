const BUSINESS_LINE_ALIASES = new Map([
  ['auto', 'Automóviles'],
  ['autos', 'Automóviles'],
  ['automovil', 'Automóviles'],
  ['automoviles', 'Automóviles'],
  ['automóviles', 'Automóviles'],
  ['camion', 'Camiones'],
  ['camioneta', 'Camiones'],
  ['camiones', 'Camiones'],
  ['bus', 'Buses'],
  ['buses', 'Buses'],
  ['van', 'Vans'],
  ['vans', 'Vans'],
  ['nuevo', 'Nuevos'],
  ['nuevos', 'Nuevos'],
  ['usado', 'Usados'],
  ['usados', 'Usados'],
]);

export const normalizeBusinessLine = (value) => {
  if (value === undefined || value === null) return undefined;
  const text = value.toString().trim();
  if (!text) return undefined;

  const lower = text.toLowerCase();
  const normalizedKey = lower.replace(/\s+/g, ' ').trim();
  if (BUSINESS_LINE_ALIASES.has(normalizedKey)) {
    return BUSINESS_LINE_ALIASES.get(normalizedKey);
  }

  if (lower.includes('auto')) return 'Automóviles';
  if (lower.includes('camion')) return 'Camiones';
  if (lower.includes('bus')) return 'Buses';
  if (lower.includes('van')) return 'Vans';
  if (lower.includes('nuevo')) return 'Nuevos';
  if (lower.includes('usad')) return 'Usados';

  return text;
};

const numberCache = new Map();

export const parseNumber = (value) => {
  if (value === undefined || value === null) return NaN;
  if (typeof value === 'number') return value;

  const text = value.toString().trim();
  if (!text) return NaN;

  const sanitized = text.replace(/[^0-9,.,-]/g, '');
  const cacheKey = sanitized;
  if (numberCache.has(cacheKey)) return numberCache.get(cacheKey);
  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');

  let decimalSep = '';
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1) {
    decimalSep = /,\d{1,2}$/.test(sanitized) ? ',' : '';
  } else if (lastDot !== -1) {
    decimalSep = /\.\d{1,2}$/.test(sanitized) ? '.' : '';
  }

  if (decimalSep) {
    const parts = sanitized.split(decimalSep);
    const fractional = parts.pop() || '';
    const integer = parts.join('');
    const intClean = integer.replace(/[.,]/g, '');
    const fracClean = fractional.replace(/[.,]/g, '');
    const parsed = Number(`${intClean}.${fracClean}`);
    numberCache.set(cacheKey, parsed);
    return parsed;
  }

  const integerOnly = sanitized.replace(/[.,]/g, '');
  const parsedInteger = Number(integerOnly);
  numberCache.set(cacheKey, parsedInteger);
  return parsedInteger;
};

const getEntryCaseInsensitive = (recordEntries, targetLower) =>
  recordEntries.find(([key]) => key.toLowerCase() === targetLower);

const textFromRecord = (recordEntries, lowerKey) => {
  const found = getEntryCaseInsensitive(recordEntries, lowerKey);
  if (!found) return undefined;
  const value = found[1];
  if (value === undefined || value === null) return undefined;
  const text = value.toString().trim();
  return text || undefined;
};

const firstNumeric = (record = {}, keys = []) => {
  const entries = Object.entries(record);
  const lowerKeys = keys.map((key) => key.toLowerCase());

  for (const lowerKey of lowerKeys) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const parsed = parseNumber(found[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const INGRESO_KEYS = [
  'ingresos',
  'Ingresos',
  'Ingreso',
  'Venta',
  'Ventas',
  'Total Ingresos',
  'Ingresos netos',
];

const COSTO_KEYS = ['costos', 'Costos', 'Costo', 'Total Costos'];

const MARGEN_KEYS = [
  'margen',
  'Margen',
  'Margen total',
  'margen_total',
  'Margen Total',
  'margenTotal',
  'Margen USD',
  'Margen promedio',
  'margen promedio',
];

const BUSINESS_LINE_KEYS = [
  'línea de negocio',
  'linea de negocio',
  'linea_negocio',
  'linea negocio',
  'lineanegocio',
  'línea de negocio',
  'linea',
  'línea',
  'nombre linea',
  'nombre línea',
  'nombre de línea',
  'nombre negocio',
  'nombre line of business',
  'nombre segmentación',
  'segmentación',
  'segmentacion',
  'segmentacion igd',
  'línea de negocio',
  'linea de negocio',
  'linea_negocio',
];

const YEAR_KEYS = ['año', 'ano', 'anio', 'year', 'periodo', 'período'];
const MONTH_KEYS = ['mes', 'mes_num', 'month'];

const CONDITION_KEYS = ['nuevo/usado', 'nuevo o usado', 'condición', 'condicion', 'estado unidad'];

const SELLER_KEYS = ['nombrevendedor', 'vendedor', 'vendedor sap', 'seller', 'asesor'];
const MODEL_KEYS = ['modelo', 'model', 'vehículo', 'vehiculo', 'vehículo sap', 'vehiculo sap'];

export const yearFromRecord = (record = {}) => {
  if (Number.isFinite(record.Año)) return record.Año;
  if (Number.isFinite(record.año)) return record.año;

  const entries = Object.entries(record);
  for (const lowerKey of YEAR_KEYS) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const parsed = parseNumber(found[1]);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
};

export const monthFromRecord = (record = {}) => {
  if (Number.isFinite(record.Mes)) return record.Mes;

  const entries = Object.entries(record);
  for (const lowerKey of MONTH_KEYS) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const parsed = parseNumber(found[1]);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
};

export const marginFromRecord = (record = {}) => {
  const entries = Object.entries(record);
  for (const lowerKey of MARGEN_KEYS) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const parsed = parseNumber(found[1]);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Number.isFinite(record.margen) ? Number(record.margen) : undefined;
};

export const sellerFromRecord = (record = {}) => {
  if (record.nombreVendedor) return record.nombreVendedor.toString();

  const entries = Object.entries(record);
  for (const lowerKey of SELLER_KEYS) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const value = textFromRecord(entries, lowerKey);
    if (value) return value;
  }

  return undefined;
};

export const modelFromRecord = (record = {}) => {
  if (record.modelo) return record.modelo.toString();

  const entries = Object.entries(record);
  for (const lowerKey of MODEL_KEYS) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const value = textFromRecord(entries, lowerKey);
    if (value) return value;
  }

  return undefined;
};

export const conditionFromRecord = (record = {}) => {
  const entries = Object.entries(record);
  const direct = textFromRecord(entries, 'nuevo/usado');
  if (direct) return direct;

  for (const lowerKey of CONDITION_KEYS) {
    const text = textFromRecord(entries, lowerKey);
    if (!text) continue;
    if (/^nuev/i.test(text)) return 'Nuevo';
    if (/^usad/i.test(text)) return 'Usado';
    return text;
  }

  return undefined;
};

export const businessLineFromRecord = (record = {}) => {
  const entries = Object.entries(record);
  for (const lowerKey of BUSINESS_LINE_KEYS) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const normalized = normalizeBusinessLine(found[1]);
    if (normalized) return normalized;
  }

  for (const [, value] of entries) {
    const normalized = normalizeBusinessLine(value);
    if (normalized) return normalized;
  }

  return undefined;
};

const mapRecord = (record) => {
  const ingresos = firstNumeric(record, INGRESO_KEYS);
  const costos = firstNumeric(record, COSTO_KEYS);
  let margen = marginFromRecord(record);

  if (!Number.isFinite(margen) && Number.isFinite(ingresos) && Number.isFinite(costos)) {
    margen = ingresos - costos;
  }

  return {
    ...record,
    segmentacionIGD:
      record['Nombre segmentación'] || record['nombre segmentación'] || record['nombre segmentacion'],
    vendedorSAP: record['Vendedor SAP'] || record['vendedor sap'] || record['Vendedor'],
    businessLine: businessLineFromRecord(record),
    condition: conditionFromRecord(record),
    sellerName: sellerFromRecord(record),
    modelName: modelFromRecord(record),
    ingresos,
    costos,
    margen,
  };
};

export const normalizeFinancialRecord = mapRecord;
export const normalizeRecords = (records = []) => records.map(mapRecord);

const mean = (values) => values.reduce((acc, val) => acc + val, 0) / (values.length || 1);

const toNumeric = (record, key) => {
  if (Number.isFinite(record[key])) return record[key];
  if (record[key] !== undefined) return parseNumber(record[key]);
  return parseNumber(record[key]);
};

const correlation = (records, xKey, yKey) => {
  const cleaned = records
    .map((record) => ({
      x: toNumeric(record, xKey),
      y: toNumeric(record, yKey),
    }))
    .filter((pair) => Number.isFinite(pair.x) && Number.isFinite(pair.y));

  const n = cleaned.length;
  if (n < 2) return 0;

  const meanX = cleaned.reduce((acc, { x }) => acc + x, 0) / n;
  const meanY = cleaned.reduce((acc, { y }) => acc + y, 0) / n;
  const cov =
    cleaned.reduce((acc, { x, y }) => acc + (x - meanX) * (y - meanY), 0) /
    (n - 1);
  const stdX = Math.sqrt(
    cleaned.reduce((acc, { x }) => acc + (x - meanX) ** 2, 0) / (n - 1),
  );
  const stdY = Math.sqrt(
    cleaned.reduce((acc, { y }) => acc + (y - meanY) ** 2, 0) / (n - 1),
  );

  if (stdX === 0 || stdY === 0) return 0;
  return cov / (stdX * stdY);
};

const ensureNormalized = (records, normalized) => (normalized ? records : normalizeRecords(records));

export const computeCorrelations = (records, { normalized = false } = {}) => {
  const mapped = ensureNormalized(records, normalized);
  return {
    margenIngreso: correlation(mapped, 'ingresos', 'margen'),
    margenCostos: correlation(mapped, 'costos', 'margen'),
    ingresoCostos: correlation(mapped, 'ingresos', 'costos'),
    margenUnidades: correlation(mapped, 'Unidades UN', 'margen'),
  };
};

export const transformToCategories = (records, { normalized = false } = {}) => {
  const mapped = ensureNormalized(records, normalized);
  const groups = mapped.reduce((acc, record) => {
    const groupKey = record.businessLine;
    if (!groupKey) return acc;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(record);
    return acc;
  }, {});

  return Object.entries(groups).map(([name, list], index) => {
    const margins = list.map((item) => Number(item.margen) || 0);
    const ingresos = list.map((item) => Number(item.ingresos) || 0);
    const costos = list.map((item) => Number(item.costos) || 0);
    const margenMean = mean(margins);
    const ingresoMean = mean(ingresos);
    const costoMean = mean(costos);
    const n = list.length;
    const stdDev = Math.sqrt(
      margins.reduce((acc, value) => acc + (value - margenMean) ** 2, 0) / (n || 1),
    );

    return {
      id: index + 1,
      name,
      margen: margenMean,
      ingreso: ingresoMean,
      costo: costoMean,
      stdDev,
      n,
      totalIngresos: ingresos.reduce((acc, value) => acc + value, 0),
      totalCostos: costos.reduce((acc, value) => acc + value, 0),
      totalMargen: margins.reduce((acc, value) => acc + value, 0),
      lower: margenMean,
      upper: margenMean,
      records: list,
    };
  });
};

export const transformToSalespeople = (records, { normalized = false } = {}) => {
  const mapped = ensureNormalized(records, normalized);
  const groups = mapped.reduce((acc, record) => {
    if (!acc[record.vendedorSAP]) {
      acc[record.vendedorSAP] = [];
    }
    acc[record.vendedorSAP].push(record);
    return acc;
  }, {});

  return Object.entries(groups).map(([sapCode, list], index) => {
    const ingresos = list.map((item) => Number(item.ingresos) || 0);
    const margins = list.map((item) => Number(item.margen) || 0);
    const categoriesCount = list.reduce((acc, item) => {
      acc[item.segmentacionIGD] = (acc[item.segmentacionIGD] || 0) + 1;
      return acc;
    }, {});
    const specialization = Object.entries(categoriesCount)
      .sort(([, aCount], [, bCount]) => bCount - aCount)
      .map(([category]) => category);
    const mainCategory = specialization[0];
    const extraCount = Math.max(specialization.length - 1, 0);
    const label = extraCount > 0 ? `${mainCategory} y ${extraCount} más` : mainCategory;
    const avg = mean(ingresos);
    const marginAvg = mean(margins);
    const n = list.length;
    const stdDev = Math.sqrt(
      ingresos.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (n || 1),
    );
    const marginStdDev = Math.sqrt(
      margins.reduce((acc, value) => acc + (value - marginAvg) ** 2, 0) / (n || 1),
    );

    return {
      id: index + 1,
      name: list[0]?.nombreVendedor || sapCode,
      sapCode,
      specialization: label,
      averageSales: avg,
      stdDev,
      target: avg * 1.2,
      averageMargin: marginAvg,
      marginStdDev,
      marginTarget: marginAvg * 1.2,
      totalSales: ingresos.reduce((acc, value) => acc + value, 0),
    };
  });
};

const calculateMoments = (values) => {
  const n = values.length;
  if (!n) {
    return {
      mean: 0,
      median: 0,
      mode: 0,
      stdSample: 0,
      varianceSample: 0,
      stderr: 0,
      skewness: 0,
      kurtosis: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const meanValue = values.reduce((acc, value) => acc + value, 0) / n;
  const varianceSample = n > 1 ? values.reduce((acc, value) => acc + (value - meanValue) ** 2, 0) / (n - 1) : 0;
  const stdSample = Math.sqrt(varianceSample);
  const stderr = n > 0 ? stdSample / Math.sqrt(n) : 0;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const frequency = new Map();
  let mode = sorted[0];
  let maxCount = 0;
  sorted.forEach((value) => {
    const count = (frequency.get(value) || 0) + 1;
    frequency.set(value, count);
    if (count > maxCount) {
      maxCount = count;
      mode = value;
    }
  });

  const centered = values.map((value) => value - meanValue);
  const denom = stdSample > 0 ? stdSample ** 3 : 0;
  const skewness = n > 2 && denom
    ? (n / ((n - 1) * (n - 2))) * (centered.reduce((acc, value) => acc + value ** 3, 0) / denom)
    : 0;
  const kurtosis =
    n > 3 && stdSample > 0
      ? (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * (centered.reduce((acc, value) => acc + value ** 4, 0) / stdSample ** 4) -
        (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
      : 0;

  return {
    mean: meanValue,
    median,
    mode,
    stdSample,
    varianceSample,
    stderr,
    skewness,
    kurtosis,
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

export const computeStatSummary = (records, { normalized = false } = {}) => {
  const mapped = ensureNormalized(records, normalized);
  const marginPercents = [];
  const ingresos = [];
  const costos = [];

  mapped.forEach((item) => {
    const ingreso = item.ingresos;
    const costo = item.costos;
    const margen = item.margen;

    if (Number.isFinite(ingreso)) ingresos.push(ingreso);
    if (Number.isFinite(costo)) costos.push(costo);
    if (Number.isFinite(ingreso) && ingreso !== 0 && Number.isFinite(margen)) {
      marginPercents.push((margen / ingreso) * 100);
    }
  });

  return {
    marginPct: calculateMoments(marginPercents),
    ingresos: calculateMoments(ingresos),
    costos: calculateMoments(costos),
    muestras: marginPercents.length,
  };
};
