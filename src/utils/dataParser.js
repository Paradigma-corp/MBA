export const normalizeBusinessLine = (value) => {
  if (value === undefined || value === null) return undefined;
  const text = value.toString().trim();
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('auto')) return 'Automóviles';
  if (lower.includes('camion')) return 'Camiones';
  if (lower.includes('bus')) return 'Buses';
  if (lower.includes('van')) return 'Vans';
  if (lower.includes('nuevo')) return 'Nuevos';
  if (lower.includes('usad')) return 'Usados';

  return text;
};

const CORE_LINES = ['Automóviles', 'Vans', 'Camiones', 'Buses'];

const parseNumber = (value) => {
  if (value === undefined || value === null) return NaN;
  if (typeof value === 'number') return value;

  const text = value.toString().trim();
  if (!text) return NaN;

  const sanitized = text.replace(/[^0-9,.,-]/g, '');
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
    return Number(`${intClean}.${fracClean}`);
  }

  const integerOnly = sanitized.replace(/[.,]/g, '');
  return Number(integerOnly);
};

const getEntryCaseInsensitive = (recordEntries, targetLower) =>
  recordEntries.find(([key]) => key.toLowerCase() === targetLower);

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

const UNITS_KEYS = [
  'unidades',
  'unidades un',
  'cantidad unidades',
  'ventas unidades',
  'numero unidades',
  'units',
  'units sold',
  'volumen',
];

const BUSINESS_LINE_KEYS = [
  'lineanegocio',
  'linea de negocio',
  'línea de negocio',
  'linea',
  'línea',
  'linea_negocio',
  'linea negocio',
  'nombre linea',
  'nombre línea',
  'nombre de línea',
  'nombre negocio',
  'nombre line of business',
  'nombre segmentación',
  'segmentación',
  'segmentacion',
  'segmentacion igd',
];

const YEAR_KEYS = ['año', 'ano', 'anio', 'year', 'periodo', 'período'];

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

export const businessLineFromRecord = (record = {}) => {
  const entries = Object.entries(record);
  for (const lowerKey of BUSINESS_LINE_KEYS) {
    const found = getEntryCaseInsensitive(entries, lowerKey);
    if (!found) continue;
    const normalized = normalizeBusinessLine(found[1]);
    if (normalized && CORE_LINES.includes(normalized)) {
      return normalized;
    }
  }

  for (const [, value] of entries) {
    const normalized = normalizeBusinessLine(value);
    if (normalized && CORE_LINES.includes(normalized)) {
      return normalized;
    }
  }

  return undefined;
};

const mapRecord = (record) => {
  const ingresos = firstNumeric(record, INGRESO_KEYS);
  const costos = firstNumeric(record, COSTO_KEYS);
  let margen = firstNumeric(record, MARGEN_KEYS);
  const unidades = firstNumeric(record, UNITS_KEYS);

  if (!Number.isFinite(margen) && Number.isFinite(ingresos) && Number.isFinite(costos)) {
    margen = ingresos - costos;
  }

  return {
    ...record,
    segmentacionIGD:
      record['Nombre segmentación'] || record['nombre segmentación'] || record['nombre segmentacion'],
    vendedorSAP: record['Vendedor SAP'] || record['vendedor sap'] || record['Vendedor'],
    businessLine: businessLineFromRecord(record),
    ingresos,
    costos,
    margen,
    unidades,
  };
};

export const normalizeFinancialRecord = mapRecord;

const mean = (values) => values.reduce((acc, val) => acc + val, 0) / (values.length || 1);

const correlation = (records, xKey, yKey) => {
  const cleaned = records
    .map((record) => ({
      x: parseNumber(record[xKey]),
      y: parseNumber(record[yKey]),
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

export const computeCorrelations = (records) => {
  const mapped = records.map(mapRecord);
  return {
    margenIngreso: correlation(mapped, 'ingresos', 'margen'),
    margenCostos: correlation(mapped, 'costos', 'margen'),
    ingresoCostos: correlation(mapped, 'ingresos', 'costos'),
    margenUnidades: correlation(mapped, 'Unidades UN', 'margen'),
  };
};

export const transformToCategories = (records) => {
  const mapped = records.map(mapRecord);
  const groups = mapped.reduce((acc, record) => {
    const groupKey = record.businessLine;
    if (!groupKey || !CORE_LINES.includes(groupKey)) return acc;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(record);
    return acc;
  }, {});

  return Object.entries(groups).map(([name, list], index) => {
    const margins = list.map((item) => parseNumber(item.margen) || 0);
    const ingresos = list.map((item) => parseNumber(item.ingresos) || 0);
    const costos = list.map((item) => parseNumber(item.costos) || 0);
    const unidades = list.map((item) => parseNumber(item.unidades) || 0);
    const margenMean = mean(margins);
    const ingresoMean = mean(ingresos);
    const costoMean = mean(costos);
    const unitsMean = mean(unidades);
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
      unidades: unitsMean,
      stdDev,
      n,
      totalIngresos: ingresos.reduce((acc, value) => acc + value, 0),
      totalCostos: costos.reduce((acc, value) => acc + value, 0),
      totalMargen: margins.reduce((acc, value) => acc + value, 0),
      totalUnidades: unidades.reduce((acc, value) => acc + value, 0),
      lower: margenMean,
      upper: margenMean,
      records: list,
    };
  });
};

export const transformToSalespeople = (records) => {
  const mapped = records.map(mapRecord);
  const groups = mapped.reduce((acc, record) => {
    if (!acc[record.vendedorSAP]) {
      acc[record.vendedorSAP] = [];
    }
    acc[record.vendedorSAP].push(record);
    return acc;
  }, {});

  return Object.entries(groups).map(([sapCode, list], index) => {
    const ingresos = list.map((item) => parseNumber(item.ingresos) || 0);
    const margins = list.map((item) => parseNumber(item.margen) || 0);
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
