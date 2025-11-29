import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, BarChart3, ChevronDown, Download, Info, LineChart, SlidersHorizontal } from 'lucide-react';
import {
  businessLineFromRecord,
  monthFromRecord,
  normalizeRecords,
  parseNumber,
  sellerFromRecord,
  yearFromRecord,
} from '../../utils/dataParser.js';
import { formatNumber } from '../../utils/formatters.js';
import { fitNegBinMoment, negbinPAtLeastK, poissonPAtLeastK } from '../../utils/countingModel.js';

const quantile = (arr = [], q = 0.5) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
};

const percentileRange = (values = [], lower = 0.1, upper = 0.9) => ({
  p10: quantile(values, lower),
  p90: quantile(values, upper),
});

const trimOutliers = (values = [], rule = 'pRange', include = true) => {
  if (include) return values;
  if (!values.length) return [];

  const sorted = [...values].sort((a, b) => a - b);
  if (rule === 'tukey') {
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return sorted.filter((v) => v >= lower && v <= upper);
  }

  const { p10, p90 } = percentileRange(sorted, 0.1, 0.9);
  return sorted.filter((v) => v >= p10 && v <= p90);
};

const unitsFromRecord = (record = {}) =>
  parseNumber(
    record['Unidades UN'] || record.unidades || record.Unidades || record.ventas || record.venta || record.ventasMes,
  ) || 0;

const currencyFromRecord = (record = {}, key) => parseNumber(record[key]) || 0;

const colorForProb = (p, strongThreshold = 0.7) => {
  if (p >= strongThreshold) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (p >= 0.4) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const tableBadgeColor = (p) => {
  if (p >= 0.8) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (p >= 0.4) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const formatProb = (p) => `${(p * 100).toFixed(1)}%`;

const formatSol = (value) =>
  Number.isFinite(value)
    ? `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const samplePoisson = (lambda) => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L);
  return Math.max(0, k - 1);
};

const sampleNegBin = (r, p) => {
  if (!Number.isFinite(r) || p <= 0 || p >= 1) return 0;
  let successes = 0;
  for (let i = 0; i < r; i += 1) {
    let trialSuccess = false;
    while (!trialSuccess) {
      const u = Math.random();
      if (u < p) {
        trialSuccess = true;
      } else {
        successes += 1;
      }
    }
  }
  return successes;
};

const simulateCounts = (lambda, variance, exposure) => {
  const mean = lambda * exposure;
  if (variance > 1.5 * lambda) {
    const scaledVar = Math.max(mean, variance * exposure);
    const { r, p } = fitNegBinMoment(mean, scaledVar);
    return sampleNegBin(r, p);
  }
  return samplePoisson(mean);
};

const buildMetaState = (lines = [], history = []) => {
  if (!lines.length) return [];
  const grouped = lines.map((line) => {
    const records = history.filter((row) => row.linea === line);
    const avgUnits = records.length
      ? records.reduce((acc, row) => acc + (row.units || 0), 0) / (records.length || 1)
      : 1;
    const avgIngreso = records.length
      ? records.reduce((acc, row) => acc + (row.ingresos || 0), 0) / (records.length || 1)
      : 50000;
    const avgMargin = records.length
      ? records.reduce((acc, row) => acc + (row.margen || 0), 0) / (records.length || 1)
      : 15000;
    return {
      linea: line,
      k_unid_mes: Math.max(1, Math.round(avgUnits * 1.1)),
      meta_ing_mes: Math.round(avgIngreso * 1.05),
      meta_mar_mes: Math.round(avgMargin * 1.05),
    };
  });
  return grouped;
};

const SliderControl = ({ label, value, onChange, min = 0, max = 1, step = 0.05, hint }) => (
  <label className="flex flex-col gap-1 text-sm text-slate-700">
    <div className="flex items-center justify-between">
      <span className="font-medium">{label}</span>
      <span className="text-xs text-slate-500">{Math.round(value * 100)}%</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
  </label>
);

const TopActionCard = ({ title, subtitle, children }) => (
  <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-2">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Recomendación</p>
        <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      <ArrowUpRight className="text-slate-400" size={18} />
    </div>
    {children}
  </div>
);

const FomForecastPanel = ({ records = [] }) => {
  const normalized = useMemo(() => normalizeRecords(records), [records]);
  const [showTech, setShowTech] = useState(false);
  const availableYears = useMemo(() => {
    const years = normalized.map((row) => yearFromRecord(row)).filter((v) => Number.isFinite(v));
    return Array.from(new Set(years)).sort((a, b) => a - b);
  }, [normalized]);

  const monthsByYear = useMemo(() => {
    const map = new Map();
    normalized.forEach((row) => {
      const year = yearFromRecord(row);
      const month = monthFromRecord(row);
      if (!Number.isFinite(year) || !Number.isFinite(month)) return;
      if (!map.has(year)) map.set(year, new Set());
      map.get(year).add(month);
    });
    return map;
  }, [normalized]);

  const defaultYear = availableYears.length ? availableYears[availableYears.length - 1] : new Date().getFullYear();
  const defaultMonth = useMemo(() => {
    const months = monthsByYear.get(defaultYear);
    if (months && months.size) {
      return Array.from(months).sort((a, b) => a - b).pop();
    }
    return 1;
  }, [defaultYear, monthsByYear]);

  const [activeYear, setActiveYear] = useState(defaultYear);
  const [activeMonth, setActiveMonth] = useState(defaultMonth);
  const [exposure, setExposure] = useState(0.5);
  const [windowMonths, setWindowMonths] = useState(12);
  const [mcRuns, setMcRuns] = useState(5000);
  const [outlierRule, setOutlierRule] = useState('pRange');
  const [includeOutliers, setIncludeOutliers] = useState(true);

  useEffect(() => {
    const months = monthsByYear.get(activeYear);
    if (months && months.size) {
      const latest = Array.from(months).sort((a, b) => a - b).pop();
      setActiveMonth((prev) => (months.has(prev) ? prev : latest));
    }
  }, [activeYear, monthsByYear]);

  const trainingMonthly = useMemo(() => {
    const upper = activeYear * 100 + activeMonth;
    const lower = upper - windowMonths + 1;
    const map = new Map();
    normalized.forEach((row) => {
      const year = yearFromRecord(row);
      const month = monthFromRecord(row);
      const yyyymm = Number.isFinite(year) && Number.isFinite(month) ? year * 100 + month : undefined;
      if (!yyyymm || yyyymm >= upper || yyyymm < lower) return;
      const line = businessLineFromRecord(row) || 'Sin línea';
      const seller = sellerFromRecord(row) || '—';
      const key = `${line}|${seller}|${yyyymm}`;
      const prev = map.get(key) || { linea: line, vendedor: seller, yyyymm, units: 0, ingresos: 0, margen: 0 };
      map.set(key, {
        ...prev,
        units: prev.units + unitsFromRecord(row),
        ingresos: prev.ingresos + (row.ingresos ?? currencyFromRecord(row, 'ingresos')),
        margen: prev.margen + (row.margen ?? currencyFromRecord(row, 'margen')),
      });
    });
    return Array.from(map.values());
  }, [activeMonth, activeYear, normalized, windowMonths]);

  const lines = useMemo(() => {
    const set = new Set(trainingMonthly.map((row) => row.linea));
    normalized.forEach((row) => set.add(businessLineFromRecord(row) || 'Sin línea'));
    return Array.from(set);
  }, [normalized, trainingMonthly]);

  const [metas, setMetas] = useState(() => buildMetaState(lines, trainingMonthly));

  useEffect(() => {
    setMetas((prev) => {
      const defaults = buildMetaState(lines, trainingMonthly);
      return defaults.map((meta) => {
        const found = prev.find((item) => item.linea === meta.linea);
        return found ? { ...meta, ...found } : meta;
      });
    });
  }, [lines, trainingMonthly]);

  const activeMonthAggregates = useMemo(() => {
    const map = new Map();
    normalized.forEach((row) => {
      if (yearFromRecord(row) !== activeYear || monthFromRecord(row) !== activeMonth) return;
      const linea = businessLineFromRecord(row) || 'Sin línea';
      const vendedor = sellerFromRecord(row) || '—';
      const key = `${linea}|${vendedor}`;
      const prev = map.get(key) || { linea, vendedor, n_obs: 0, ing_obs: 0, mar_obs: 0 };
      map.set(key, {
        ...prev,
        n_obs: prev.n_obs + unitsFromRecord(row),
        ing_obs: prev.ing_obs + (row.ingresos ?? currencyFromRecord(row, 'ingresos')),
        mar_obs: prev.mar_obs + (row.margen ?? currencyFromRecord(row, 'margen')),
      });
    });
    return Array.from(map.values());
  }, [activeMonth, activeYear, normalized]);

  const vendorModels = useMemo(() => {
    const metaByLine = Object.fromEntries(metas.map((meta) => [meta.linea, meta]));
    const vendorKeys = new Map();
    trainingMonthly.forEach((row) => {
      const key = `${row.linea}|${row.vendedor}`;
      if (!vendorKeys.has(key)) vendorKeys.set(key, []);
      vendorKeys.get(key).push(row);
    });

    return Array.from(vendorKeys.entries()).map(([key, rows]) => {
      const [linea, vendedor] = key.split('|');
      const totals = rows.reduce(
        (acc, row) => ({
          n: acc.n + 1,
          sumUnits: acc.sumUnits + row.units,
          sumIncome: acc.sumIncome + row.ingresos,
          sumMargin: acc.sumMargin + row.margen,
          sumSq: acc.sumSq + row.units * row.units,
        }),
        { n: 0, sumUnits: 0, sumIncome: 0, sumMargin: 0, sumSq: 0 },
      );
      const mean = totals.n ? totals.sumUnits / totals.n : 0;
      const variance = totals.n ? totals.sumSq / totals.n - mean * mean : 0;
      const lambdaScaled = mean * (1 - exposure);
      const family = variance > 1.5 * mean ? 'NB' : 'Poisson';
      const meta = metaByLine[linea] || { k_unid_mes: 1, meta_ing_mes: 0, meta_mar_mes: 0 };
      const observed = activeMonthAggregates.find((row) => row.linea === linea && row.vendedor === vendedor) || {
        n_obs: 0,
        ing_obs: 0,
        mar_obs: 0,
      };
      const remainingTarget = Math.max(0, meta.k_unid_mes - observed.n_obs);
      const scaledVar = Math.max(lambdaScaled, variance * (1 - exposure));
      const { r, p } = fitNegBinMoment(lambdaScaled, scaledVar);
      const probUnits =
        family === 'NB' ? negbinPAtLeastK(remainingTarget, r, p) : poissonPAtLeastK(remainingTarget, lambdaScaled);

      return {
        linea,
        vendedor,
        mean,
        variance,
        lambdaScaled,
        family,
        observed,
        meta,
        probUnits: Math.max(0, Math.min(1, probUnits)),
      };
    });
  }, [activeMonthAggregates, metas, trainingMonthly, exposure]);

  const lineSimulations = useMemo(() => {
    const exposureRest = 1 - exposure;
    return lines.map((linea) => {
      const meta = metas.find((item) => item.linea === linea) || {
        k_unid_mes: 1,
        meta_ing_mes: 0,
        meta_mar_mes: 0,
      };
      const history = trainingMonthly.filter((row) => row.linea === linea);
      const totals = history.reduce(
        (acc, row) => ({
          n: acc.n + 1,
          sumUnits: acc.sumUnits + row.units,
          sumIncome: acc.sumIncome + row.ingresos,
          sumMargin: acc.sumMargin + row.margen,
          sumSq: acc.sumSq + row.units * row.units,
        }),
        { n: 0, sumUnits: 0, sumIncome: 0, sumMargin: 0, sumSq: 0 },
      );
      const mean = totals.n ? totals.sumUnits / totals.n : 0;
      const variance = totals.n ? totals.sumSq / totals.n - mean * mean : 0;
      const family = variance > 1.5 * mean ? 'NB' : 'Poisson';

      const observed = activeMonthAggregates
        .filter((row) => row.linea === linea)
        .reduce(
          (acc, row) => ({
            n_obs: acc.n_obs + row.n_obs,
            ing_obs: acc.ing_obs + row.ing_obs,
            mar_obs: acc.mar_obs + row.mar_obs,
          }),
          { n_obs: 0, ing_obs: 0, mar_obs: 0 },
        );

      const marginUnits = normalized
        .filter((row) => businessLineFromRecord(row) === linea)
        .map((row) => (row.margen ?? currencyFromRecord(row, 'margen')) / (unitsFromRecord(row) || 1))
        .filter((v) => Number.isFinite(v));
      const ingresoUnits = normalized
        .filter((row) => businessLineFromRecord(row) === linea)
        .map((row) => (row.ingresos ?? currencyFromRecord(row, 'ingresos')) / (unitsFromRecord(row) || 1))
        .filter((v) => Number.isFinite(v));

      const cleanMargins = trimOutliers(marginUnits, outlierRule, includeOutliers);
      const cleanIngresos = trimOutliers(ingresoUnits, outlierRule, includeOutliers);

      if (!cleanMargins.length) cleanMargins.push(0);
      if (!cleanIngresos.length) cleanIngresos.push(0);

      const counts = [];
      const ingresosSim = [];
      const margenSim = [];

      for (let i = 0; i < mcRuns; i += 1) {
        const rem = simulateCounts(mean, variance, exposureRest);
        const sampledMargins = Array.from({ length: rem }, () => cleanMargins[Math.floor(Math.random() * cleanMargins.length)]);
        const sampledIngresos = Array.from({ length: rem }, () =>
          cleanIngresos[Math.floor(Math.random() * cleanIngresos.length)],
        );
        const marTotal = observed.mar_obs + sampledMargins.reduce((acc, v) => acc + v, 0);
        const ingTotal = observed.ing_obs + sampledIngresos.reduce((acc, v) => acc + v, 0);
        const totalUnits = observed.n_obs + rem;

        counts.push(totalUnits);
        ingresosSim.push(ingTotal);
        margenSim.push(marTotal);
      }

      const probUnits = counts.filter((v) => v >= meta.k_unid_mes).length / mcRuns;
      const probIng = ingresosSim.filter((v) => v >= meta.meta_ing_mes).length / mcRuns;
      const probMar = margenSim.filter((v) => v >= meta.meta_mar_mes).length / mcRuns;

      return {
        linea,
        family,
        mean,
        variance,
        meta,
        observed,
        probUnits,
        probIng,
        probMar,
        nP50: quantile(counts, 0.5),
        nP10: quantile(counts, 0.1),
        nP90: quantile(counts, 0.9),
        ingP50: quantile(ingresosSim, 0.5),
        ingP10: quantile(ingresosSim, 0.1),
        ingP90: quantile(ingresosSim, 0.9),
        marP50: quantile(margenSim, 0.5),
        marP10: quantile(margenSim, 0.1),
        marP90: quantile(margenSim, 0.9),
      };
    });
  }, [activeMonthAggregates, exposure, includeOutliers, lines, mcRuns, metas, normalized, outlierRule, trainingMonthly]);

  const actions = useMemo(() => {
    const exposureRest = 1 - exposure;
    const marginByModel = new Map();
    normalized.forEach((row) => {
      const linea = businessLineFromRecord(row) || 'Sin línea';
      const modelo = row.modelName || row['Nombre modelo'] || 'Modelo sin nombre';
      const marginUnit = (row.margen ?? currencyFromRecord(row, 'margen')) / (unitsFromRecord(row) || 1);
      if (!Number.isFinite(marginUnit)) return;
      if (!marginByModel.has(linea)) marginByModel.set(linea, new Map());
      const map = marginByModel.get(linea);
      if (!map.has(modelo)) map.set(modelo, []);
      map.get(modelo).push(marginUnit);
    });

    const activeRows = normalized.filter(
      (row) => yearFromRecord(row) === activeYear && monthFromRecord(row) === activeMonth,
    );

    const mix = Array.from(marginByModel.entries()).map(([linea, models]) => {
      const candidates = Array.from(models.entries())
        .map(([modelo, values]) => ({
          modelo,
          mediana: quantile(values, 0.5),
          cap: quantile(values, 0.9),
        }))
        .filter((item) => item.cap > 0)
        .sort((a, b) => b.mediana - a.mediana)
        .slice(0, 3)
        .map((item, idx) => ({ ...item, delta: idx + 1, impacto: item.mediana * (idx + 1) }));
      return { linea, items: candidates };
    });

    const fugas = activeRows.flatMap((row) => {
      const linea = businessLineFromRecord(row) || 'Sin línea';
      const modelo = row.modelName || row['Nombre modelo'] || 'Modelo sin nombre';
      const unit = unitsFromRecord(row) || 1;
      const marginUnit = (row.margen ?? currencyFromRecord(row, 'margen')) / unit;
      const reference = marginByModel.get(linea)?.get(modelo) || [];
      const mediana = quantile(reference, 0.5);
      const p10 = quantile(reference, 0.1);
      if (marginUnit < p10) {
        const recuperable = Math.max(0, mediana - marginUnit) * unit;
        return {
          linea,
          vendedor: sellerFromRecord(row) || '—',
          modelo,
          marginUnit,
          recuperable,
        };
      }
      return null;
    });

    const enfoque = vendorModels
      .filter((item) => item.probUnits >= 0.6 && item.mean > 0)
      .map((item) => ({
        ...item,
        impacto: item.mean * exposureRest,
      }));

    return { mix, fugas: fugas.filter(Boolean).slice(0, 5), enfoque };
  }, [activeMonth, activeMonthAggregates, activeYear, exposure, normalized, vendorModels]);

  const handleMetaChange = (linea, field, value) => {
    setMetas((prev) => prev.map((meta) => (meta.linea === linea ? { ...meta, [field]: Number(value) } : meta)));
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pronóstico de fin de mes</p>
            <h2 className="text-2xl font-semibold text-slate-900">FOM y semáforo por línea y vendedor</h2>
            <p className="text-sm text-slate-600">
              Proyecta el cierre del mes combinando lo vendido hasta hoy + una simulación del resto del mes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTech((prev) => !prev)}
            className="text-xs inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:border-celeste-200"
          >
            <Info size={14} /> Ver detalle técnico
          </button>
        </div>
        {showTech && (
          <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1">
            <p>
              Conteos: Poisson/NB con E_restante. Montos: Monte Carlo (remuestreo de margen_unit). B=
              {mcRuns.toLocaleString()}.
            </p>
            <p>La exposición del mes E_parcial la define el usuario y controla cuánto se simula del resto del mes.</p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Paso 1 – Configurar el mes</p>
              <SlidersHorizontal size={16} className="text-slate-400" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Mes a proyectar</label>
              <div className="flex items-center gap-2">
                <select
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  value={activeYear}
                  onChange={(e) => setActiveYear(Number(e.target.value))}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  value={activeMonth}
                  onChange={(e) => setActiveMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      Mes {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <SliderControl
                label="Progreso del mes"
                value={exposure}
                onChange={setExposure}
                hint="Ejemplo: 0.50 = ha pasado la mitad del mes."
                step={0.05}
              />
              <p className="text-xs text-slate-600">
                Resto del mes a simular: {Math.round((1 - exposure) * 100)}%
              </p>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Paso 2 – Precisión de la simulación</p>
              <SlidersHorizontal size={16} className="text-slate-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {[6, 9, 12].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setWindowMonths(k)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      windowMonths === k
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                    }`}
                  >
                    {k} meses
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">Período histórico usado para estimar ventas.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {[1000, 5000, 10000].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMcRuns(k)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      mcRuns === k
                        ? 'bg-celeste-600 text-white border-celeste-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                    }`}
                  >
                    {k.toLocaleString()} escenarios simulados
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">Número de escenarios simulados.</p>
            </div>
            <details className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <summary className="flex items-center justify-between cursor-pointer select-none">
                <span>Opciones avanzadas</span>
                <ChevronDown size={14} className="text-slate-500" />
              </summary>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                <p>
                  Por defecto excluimos operaciones extremas para evitar que un solo negocio distorsione el pronóstico.
                </p>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeOutliers}
                    onChange={(e) => setIncludeOutliers(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Incluir outliers
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  <span>Regla:</span>
                  {[{ label: 'P10–P90', value: 'pRange' }, { label: 'Tukey 1.5·IQR', value: 'tukey' }].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setOutlierRule(option.value)}
                      className={`px-2 py-1 rounded-lg border ${
                        outlierRule === option.value
                          ? 'bg-white text-black border-black'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Paso 3 – Revisar o editar metas del mes</p>
            <h3 className="text-lg font-semibold text-slate-900">Unidades, ingresos y margen editables</h3>
          </div>
          <button
            type="button"
            title="Vuelve a las metas sugeridas por el modelo según histórico."
            onClick={() => setMetas(buildMetaState(lines, trainingMonthly))}
            className="text-sm text-celeste-700 hover:text-celeste-800"
          >
            Resetear metas sugeridas
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="px-3 py-2">Línea</th>
                <th className="px-3 py-2">Meta unidades (mes)</th>
                <th className="px-3 py-2">Meta ingresos (mes)</th>
                <th className="px-3 py-2">Meta margen (mes)</th>
              </tr>
            </thead>
            <tbody>
              {metas.map((meta) => (
                <tr key={meta.linea} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-900">{meta.linea}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={meta.k_unid_mes}
                      min={0}
                      onChange={(e) => handleMetaChange(meta.linea, 'k_unid_mes', e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-slate-200"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={meta.meta_ing_mes}
                      min={0}
                      onChange={(e) => handleMetaChange(meta.linea, 'meta_ing_mes', e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-slate-200"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={meta.meta_mar_mes}
                      min={0}
                      onChange={(e) => handleMetaChange(meta.linea, 'meta_mar_mes', e.target.value)}
                      className="w-full px-2 py-1 rounded-lg border border-slate-200"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {lineSimulations.map((line) => (
          <div key={line.linea} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{line.linea} – Semáforo FOM</p>
                <h4 className="text-lg font-semibold text-slate-900">Pronóstico al cierre del mes</h4>
                <div
                  className={`mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${colorForProb(line.probUnits)}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-current" />
                  <p className="text-sm font-semibold text-slate-900">
                    Probabilidad de cumplir la meta: {formatProb(line.probUnits)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                title="El modelo usa Poisson o Binomial Negativa según la dispersión histórica de las ventas."
                className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 inline-flex items-center justify-center text-slate-600"
              >
                <Info size={16} />
              </button>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                Unidades esperadas (P50): {formatNumber(line.nP50, { maximumFractionDigits: 1 })}{' '}
                <span className="text-sm text-slate-600">[{formatNumber(line.nP10)}–{formatNumber(line.nP90)}]</span>
              </p>
              <p className="font-semibold text-slate-900">
                Ingresos esperados (P50): {formatSol(line.ingP50)}{' '}
                <span className="text-sm text-slate-600">[{formatSol(line.ingP10)}–{formatSol(line.ingP90)}]</span>
              </p>
              <p className="font-semibold text-slate-900">
                Margen esperado (P50): {formatSol(line.marP50)}{' '}
                <span className="text-sm text-slate-600">[{formatSol(line.marP10)}–{formatSol(line.marP90)}]</span>
              </p>
            </div>
            <p className="text-[11px] text-slate-600">
              Histórico: {windowMonths} meses · Progreso del mes: {Math.round(exposure * 100)}% · Simulaciones: {mcRuns.toLocaleString()}
              {' '}
              · Outliers: {includeOutliers ? 'incluidos' : outlierRule === 'pRange' ? 'P10–P90' : 'Tukey'}
            </p>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Tabla por vendedor</p>
            <h3 className="text-lg font-semibold text-slate-900">Pronóstico de cierre por vendedor</h3>
            <p className="text-xs text-slate-500">Cada fila muestra el pronóstico de cierre del mes para un vendedor, basado en su histórico y lo que lleva vendido este mes.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <BarChart3 size={14} /> Ordenable y exportable
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="px-3 py-2">Vendedor</th>
                <th className="px-3 py-2">Línea</th>
                <th className="px-3 py-2 text-right">
                  Meses con ventas
                  <Info size={12} className="inline ml-1 text-slate-400" title="Solo cuenta los meses donde realmente vendió." />
                </th>
                <th className="px-3 py-2 text-right">
                  Ventas promedio/mes
                  <Info size={12} className="inline ml-1 text-slate-400" title="Promedio anual según su historial." />
                </th>
                <th className="px-3 py-2 text-right">
                  Prob. cumplir meta de unidades
                  <Info size={12} className="inline ml-1 text-slate-400" title="Probabilidad simulada de llegar a la meta de unidades." />
                </th>
                <th className="px-3 py-2 text-right">
                  Margen acumulado (mes)
                  <Info size={12} className="inline ml-1 text-slate-400" title="Margen observado del mes activo." />
                </th>
                <th className="px-3 py-2 text-right">
                  Ingresos acumulados (mes)
                  <Info size={12} className="inline ml-1 text-slate-400" title="Ingresos observados del mes activo." />
                </th>
              </tr>
            </thead>
            <tbody>
              {vendorModels.map((item) => (
                <tr key={`${item.linea}-${item.vendedor}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-900">{item.vendedor}</td>
                  <td className="px-3 py-2 text-slate-700">{item.linea}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatNumber(item.observed.n_obs)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatNumber(item.mean, { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right">
                    <div className={`px-3 py-1.5 rounded-xl border ${tableBadgeColor(item.probUnits)} text-xs font-semibold inline-flex items-center gap-2 justify-end min-w-[130px]`}>
                      <span className="h-2.5 w-2.5 rounded-full bg-current" />
                      <span>{formatProb(item.probUnits)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatSol(item.observed.mar_obs)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatSol(item.observed.ing_obs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopActionCard
          title="Empuje de mix"
          subtitle="Modelos donde sumar 1–3 unidades mejora más el margen del mes."
          icon={LineChart}
        >
          {actions.mix.map((line) => (
            <div key={line.linea} className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-2">
              <p className="text-xs uppercase text-slate-500">{line.linea}</p>
              {line.items.length ? (
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {line.items.map((item) => (
                    <li key={item.modelo} className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{item.modelo}</span>
                      <span className="text-xs text-slate-500">
                        +{item.delta} unid · Δ$ {formatSol(item.impacto)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Sin historial suficiente</p>
              )}
            </div>
          ))}
        </TopActionCard>

        <TopActionCard
          title="Corte de fugas"
          subtitle="Ventas con margen muy bajo donde se puede recuperar valor en precio o mix."
        >
          {actions.fugas.length ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {actions.fugas.map((item) => (
                <li key={`${item.linea}-${item.vendedor}-${item.modelo}`} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{item.modelo}</span>
                    <span className="text-xs text-slate-500">{item.linea} · {item.vendedor}</span>
                  </div>
                  <p className="text-xs text-slate-500">Margen_unit {formatSol(item.marginUnit)} · Δ$ recuperable {formatSol(item.recuperable)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Sin fugas detectadas con la regla actual.</p>
          )}
        </TopActionCard>

        <TopActionCard
          title="Enfoque de vendedor"
          subtitle="Vendedores con alta probabilidad de cerrar más si se les reasignan casos."
        >
          {actions.enfoque.length ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {actions.enfoque.map((item) => (
                <li key={`${item.linea}-${item.vendedor}`} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{item.vendedor}</span>
                    <span className="text-xs text-slate-500">{item.linea}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Precisión {formatProb(item.probUnits)} · Mover {formatNumber(item.impacto, { maximumFractionDigits: 1 })} oportunidades ↑ ~
                    {formatNumber(item.impacto, { maximumFractionDigits: 1 })} puntos de probabilidad de cumplir la meta.
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No hay vendedores con condiciones de enfoque.</p>
          )}
        </TopActionCard>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <AlertCircle size={14} className="text-slate-500" />
        <span>
          Exporta los checklist con pie: “FOM con Poisson/NegBin y SMC (B={mcRuns.toLocaleString()}). E_parcial manual. Fuente: BBDD 2022–2025 H1. Elaboración propia.”
        </span>
        <button type="button" className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-celeste-200">
          <Download size={14} /> Exportar CSV
        </button>
      </div>
    </div>
  );
};

export default FomForecastPanel;
