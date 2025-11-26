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

const mapRecord = (record) => ({
  ...record,
  segmentacionIGD: record['Nombre segmentación'],
  vendedorSAP: record['Vendedor SAP'],
  businessLine:
    normalizeBusinessLine(
      record.lineaNegocio ||
        record['Linea de negocio'] ||
        record['Línea de negocio'] ||
        record['lineaNegocio'] ||
        record['Linea Negocio'] ||
        record['Línea Negocio'] ||
        record['linea de negocio'] ||
        record['línea de negocio'],
    ) || undefined,
});

const mean = (values) => values.reduce((acc, val) => acc + val, 0) / (values.length || 1);

const correlation = (records, xKey, yKey) => {
  const cleaned = records
    .map((record) => ({
      x: Number(record[xKey]),
      y: Number(record[yKey]),
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

export const computeCorrelations = (records) => ({
  margenIngreso: correlation(records, 'ingresos', 'margen'),
  margenCostos: correlation(records, 'costos', 'margen'),
  ingresoCostos: correlation(records, 'ingresos', 'costos'),
  margenUnidades: correlation(records, 'Unidades UN', 'margen'),
});

export const transformToCategories = (records) => {
  const mapped = records.map(mapRecord);
  const groups = mapped.reduce((acc, record) => {
    const groupKey = record.businessLine || record.segmentacionIGD;
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
