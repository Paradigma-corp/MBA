const mapRecord = (record) => ({
  ...record,
  segmentacionIGD: record['Nombre segmentación'],
  vendedorSAP: record['Vendedor SAP'],
});

const mean = (values) => values.reduce((acc, val) => acc + val, 0) / (values.length || 1);

export const transformToCategories = (records) => {
  const mapped = records.map(mapRecord);
  const groups = mapped.reduce((acc, record) => {
    if (!acc[record.segmentacionIGD]) {
      acc[record.segmentacionIGD] = [];
    }
    acc[record.segmentacionIGD].push(record);
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
    const n = list.length;
    const stdDev = Math.sqrt(
      ingresos.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (n || 1),
    );

    return {
      id: index + 1,
      name: list[0]?.nombreVendedor || sapCode,
      sapCode,
      specialization: label,
      averageSales: avg,
      stdDev,
      target: avg * 1.2,
      totalSales: ingresos.reduce((acc, value) => acc + value, 0),
    };
  });
};
