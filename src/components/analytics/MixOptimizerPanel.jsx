import React, { useMemo, useState } from 'react';
import { ArrowDownUp, BarChart3, Download, Info, Shuffle, SlidersHorizontal } from 'lucide-react';
import { businessLineFromRecord, monthFromRecord, normalizeRecords, parseNumber, yearFromRecord } from '../../utils/dataParser.js';
import { formatCurrency, formatNumber } from '../../utils/formatters.js';

const quantile = (arr = [], q = 0.5) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
};

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
  const p10 = quantile(sorted, 0.1);
  const p90 = quantile(sorted, 0.9);
  return sorted.filter((v) => v >= p10 && v <= p90);
};

const median = (values = []) => {
  if (!values.length) return 0;
  return quantile(values, 0.5);
};

const groupBy = (items = [], keyFn = () => '') =>
  items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

const computeModelStats = (records = [], { outlierRule, includeOutliers }) => {
  const byModel = groupBy(records, (row) => row['Nombre modelo'] || row.modelName || 'N/D');
  return Object.entries(byModel).map(([modelo, rows]) => {
    const byMonth = groupBy(rows, (r) => yearFromRecord(r) * 100 + monthFromRecord(r));
    const mensual = Object.values(byMonth).map((arr) => arr.reduce((acc, r) => acc + (parseNumber(r['Unidades UN']) || 0), 0));
    const cap_m = quantile(mensual, 0.9) || 0;
    const marginsUnit = rows
      .map((r) => (parseNumber(r.margen) || 0) / Math.max(1, parseNumber(r['Unidades UN']) || 0))
      .filter((v) => Number.isFinite(v));
    const trimmed = trimOutliers(marginsUnit, outlierRule, includeOutliers);
    const r_m = median(trimmed) || 0;
    const iqr = quantile(trimmed, 0.75) - quantile(trimmed, 0.25);
    return { modelo, cap_m, r_m, risk: iqr };
  });
};

const currentMix = (records = []) => {
  const byModel = groupBy(records, (row) => row['Nombre modelo'] || row.modelName || 'N/D');
  return Object.entries(byModel).map(([modelo, rows]) => {
    const units = rows.reduce((acc, r) => acc + (parseNumber(r['Unidades UN']) || 0), 0);
    const margin = rows.reduce((acc, r) => acc + (parseNumber(r.margen) || 0), 0);
    return { modelo, u_m_actual: units, margen_actual: margin };
  });
};

const rebalanceGreedy = ({ cur, stats, moveBudget, totalUnits, minShare, maxShare }) => {
  const minUnits = Math.floor(minShare * totalUnits);
  const maxUnits = Math.floor(maxShare * totalUnits);
  const statMap = new Map(stats.map((s) => [s.modelo, s]));
  const donors = cur
    .map((c) => ({ ...c, r: statMap.get(c.modelo)?.r_m || 0, cap: statMap.get(c.modelo)?.cap_m || Infinity }))
    .sort((a, b) => a.r - b.r);
  const takers = cur
    .map((c) => ({ ...c, r: statMap.get(c.modelo)?.r_m || 0, cap: statMap.get(c.modelo)?.cap_m || Infinity }))
    .sort((a, b) => b.r - a.r);
  const deltas = cur.map((c) => ({ modelo: c.modelo, du: 0 }));
  let remaining = moveBudget;
  let di = 0;
  let ti = 0;
  while (remaining > 0 && di < donors.length && ti < takers.length) {
    const d = donors[di];
    const t = takers[ti];
    const retirable = Math.max(0, d.u_m_actual - minUnits);
    const agregable = Math.max(0, Math.min(t.cap, maxUnits) - t.u_m_actual);
    if (retirable <= 0) {
      di += 1;
      continue;
    }
    if (agregable <= 0 || d.modelo === t.modelo) {
      ti += 1;
      continue;
    }
    d.u_m_actual -= 1;
    t.u_m_actual += 1;
    remaining -= 1;
    const donorDelta = deltas.find((x) => x.modelo === d.modelo);
    const takerDelta = deltas.find((x) => x.modelo === t.modelo);
    if (donorDelta) donorDelta.du -= 1;
    if (takerDelta) takerDelta.du += 1;
    if (d.u_m_actual <= minUnits) di += 1;
    if (t.u_m_actual >= Math.min(t.cap, maxUnits)) ti += 1;
  }
  const recomendacion = deltas.map((d) => {
    const stat = statMap.get(d.modelo) || { r_m: 0, cap_m: 0 };
    const current = cur.find((c) => c.modelo === d.modelo)?.u_m_actual || 0;
    return {
      modelo: d.modelo,
      u_m_actual: current,
      u_m_nuevo: current + d.du,
      du: d.du,
      r_m: stat.r_m,
      cap_m: stat.cap_m,
      delta_margen: d.du * stat.r_m,
    };
  });
  const deltaMargen = recomendacion.reduce((acc, row) => acc + row.delta_margen, 0);
  return { recomendacion, deltaMargen };
};

const growthGreedy = ({ cur, stats, extraUnits, totalUnits, maxShare }) => {
  const statMap = new Map(stats.map((s) => [s.modelo, s]));
  const curMap = new Map(cur.map((c) => [c.modelo, c.u_m_actual]));
  const ordered = stats
    .map((s) => ({ ...s, u: curMap.get(s.modelo) || 0, du: 0 }))
    .sort((a, b) => b.r_m - a.r_m);
  const maxUnits = Math.floor(maxShare * (totalUnits + extraUnits));
  let remaining = extraUnits;
  let idx = 0;
  while (remaining > 0 && idx < ordered.length) {
    const it = ordered[idx];
    const capLimit = Math.min(it.cap_m ?? Infinity, maxUnits);
    if (it.u + it.du < capLimit) {
      it.du += 1;
      remaining -= 1;
    } else {
      idx += 1;
    }
  }
  const recomendacion = ordered.map((it) => {
    const current = curMap.get(it.modelo) || 0;
    return {
      modelo: it.modelo,
      u_m_actual: current,
      u_m_nuevo: current + it.du,
      du: it.du,
      r_m: it.r_m,
      cap_m: it.cap_m,
      delta_margen: it.du * it.r_m,
    };
  });
  const deltaMargen = recomendacion.reduce((acc, row) => acc + row.delta_margen, 0);
  return { recomendacion, deltaMargen };
};

const MixOptimizerPanel = ({ records = [] }) => {
  const normalized = useMemo(() => normalizeRecords(records), [records]);
  const uniqueYears = useMemo(() => Array.from(new Set(normalized.map((r) => yearFromRecord(r)).filter(Boolean))).sort(), [
    normalized,
  ]);
  const uniqueMonths = useMemo(
    () => Array.from(new Set(normalized.map((r) => monthFromRecord(r)).filter(Boolean))).sort((a, b) => a - b),
    [normalized],
  );
  const businessLines = useMemo(
    () => Array.from(new Set(normalized.map((r) => businessLineFromRecord(r)).filter(Boolean))).sort(),
    [normalized],
  );
  const [activeYear, setActiveYear] = useState(uniqueYears.at(-1) || 2025);
  const [activeMonth, setActiveMonth] = useState(uniqueMonths.at(-1) || 6);
  const [trainingWindow, setTrainingWindow] = useState(6);
  const [mode, setMode] = useState('rebalance');
  const [linea, setLinea] = useState(businessLines[0] || 'Automóviles');
  const [condition, setCondition] = useState('Todos');
  const [selectedSellers, setSelectedSellers] = useState([]);
  const [outlierRule, setOutlierRule] = useState('pRange');
  const [includeOutliers, setIncludeOutliers] = useState(true);
  const [moveBudget, setMoveBudget] = useState(5);
  const [extraUnits, setExtraUnits] = useState(3);
  const [minShare, setMinShare] = useState(0);
  const [maxShare, setMaxShare] = useState(0.4);
  const [marginRange, setMarginRange] = useState(() => {
    const margins = normalized.map((r) => parseNumber(r.margen)).filter((v) => Number.isFinite(v));
    return { min: Math.min(...margins, 0), max: Math.max(...margins, 1) };
  });
  const sellerOptions = useMemo(
    () => Array.from(new Set(normalized.map((r) => r.nombreVendedor || r.sellerName).filter(Boolean))).sort(),
    [normalized],
  );

  const filteredBase = useMemo(() => {
    return normalized.filter((row) => {
      const y = yearFromRecord(row);
      const m = monthFromRecord(row);
      const conditionMatch = condition === 'Todos' || row.condition === condition || row['Nuevo/Usado'] === condition;
      const sellerMatch = selectedSellers.length === 0 || selectedSellers.includes(row.nombreVendedor || row.sellerName);
      const margin = parseNumber(row.margen) || 0;
      return (
        businessLineFromRecord(row) === linea &&
        conditionMatch &&
        sellerMatch &&
        y &&
        m &&
        margin >= marginRange.min &&
        margin <= marginRange.max
      );
    });
  }, [condition, linea, marginRange.max, marginRange.min, normalized, selectedSellers]);

  const activeKey = activeYear * 100 + activeMonth;
  const trainingRangeMin = activeKey - trainingWindow + 1;

  const trainingRecords = useMemo(
    () =>
      filteredBase.filter((r) => {
        const key = yearFromRecord(r) * 100 + monthFromRecord(r);
        return key < activeKey && key >= trainingRangeMin;
      }),
    [activeKey, filteredBase, trainingRangeMin],
  );

  const activeRecords = useMemo(
    () => filteredBase.filter((r) => yearFromRecord(r) === activeYear && monthFromRecord(r) === activeMonth),
    [activeMonth, activeYear, filteredBase],
  );

  const stats = useMemo(
    () => computeModelStats(trainingRecords, { outlierRule, includeOutliers }),
    [includeOutliers, outlierRule, trainingRecords],
  );

  const curMix = useMemo(() => currentMix(activeRecords), [activeRecords]);
  const totalUnits = curMix.reduce((acc, row) => acc + row.u_m_actual, 0);
  const totalMargin = curMix.reduce((acc, row) => acc + row.margen_actual, 0);

  const result = useMemo(() => {
    if (!curMix.length) return { recomendacion: [], deltaMargen: 0 };
    if (mode === 'rebalance') {
      return rebalanceGreedy({
        cur: curMix,
        stats,
        moveBudget,
        totalUnits,
        minShare,
        maxShare,
      });
    }
    return growthGreedy({ cur: curMix, stats, extraUnits, totalUnits, maxShare });
  }, [curMix, extraUnits, maxShare, minShare, mode, moveBudget, stats, totalUnits]);

  const exportCSV = () => {
    const header = ['Año', 'Mes', 'Línea de Negocio', 'Nombre modelo', 'u_m_actual', 'u_m_nuevo', 'Δu', 'Δ$ margen'];
    const rows = result.recomendacion.map((row) => [
      activeYear,
      activeMonth,
      linea,
      row.modelo,
      row.u_m_actual,
      row.u_m_nuevo,
      row.du,
      row.delta_margen,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `plan_mix_${linea}_${activeYear}_${activeMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
              <Shuffle size={18} />
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Optimización de mix</p>
              <h2 className="text-lg font-semibold">OPTIMIZADOR DE MIX INTERNO POR LÍNEA DE NEGOCIO</h2>
            </div>
          </div>
          <div className="flex gap-2 text-xs text-slate-600">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1">
              <Info size={14} /> r_m = mediana del margen unitario (trimming {outlierRule === 'pRange' ? 'P10–P90' : 'Tukey'}
              {includeOutliers ? ' con outliers' : ''})
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Línea de negocio
              <select
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={linea}
                onChange={(e) => setLinea(e.target.value)}
              >
                {businessLines.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Año activo
              <select
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={activeYear}
                onChange={(e) => setActiveYear(Number(e.target.value))}
              >
                {uniqueYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Mes activo
              <select
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={activeMonth}
                onChange={(e) => setActiveMonth(Number(e.target.value))}
              >
                {uniqueMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Ventana entrenamiento (meses)
              <div className="flex items-center gap-2 mt-1">
                {[6, 9, 12].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTrainingWindow(k)}
                    className={`px-3 py-2 rounded-lg border text-xs ${
                      trainingWindow === k
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                    }`}
                  >
                    {k}m
                  </button>
                ))}
              </div>
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Modo
              <select
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="rebalance">Rebalanceo (total fijo)</option>
                <option value="growth">Crecimiento (extra ΔU)</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 items-center text-sm">
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Nuevo/Usado
              <select
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {['Todos', 'Nuevo', 'Usado', 'Nuevos', 'Usados'].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              nombreVendedor (multi)
              <select
                multiple
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[180px] h-24"
                value={selectedSellers}
                onChange={(e) =>
                  setSelectedSellers(Array.from(e.target.selectedOptions).map((opt) => opt.value))
                }
              >
                {sellerOptions.map((seller) => (
                  <option key={seller} value={seller}>
                    {seller}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Rango de margen (USD)
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={marginRange.min}
                  onChange={(e) => setMarginRange((prev) => ({ ...prev, min: Number(e.target.value) }))}
                />
                <span className="text-slate-500">a</span>
                <input
                  type="number"
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={marginRange.max}
                  onChange={(e) => setMarginRange((prev) => ({ ...prev, max: Number(e.target.value) }))}
                />
              </div>
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Regla de outliers
              <div className="flex items-center gap-2 mt-1">
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={outlierRule}
                  onChange={(e) => setOutlierRule(e.target.value)}
                >
                  <option value="pRange">P10–P90</option>
                  <option value="tukey">Tukey 1.5·IQR</option>
                </select>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={includeOutliers}
                    onChange={(e) => setIncludeOutliers(e.target.checked)}
                  />
                  Incluir outliers
                </label>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 items-center text-sm">
            {mode === 'rebalance' ? (
              <label className="flex flex-col text-slate-700 text-xs font-semibold">
                Presupuesto de movimiento (X unidades)
                <input
                  type="number"
                  min={0}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm w-32"
                  value={moveBudget}
                  onChange={(e) => setMoveBudget(Number(e.target.value))}
                />
              </label>
            ) : (
              <label className="flex flex-col text-slate-700 text-xs font-semibold">
                Unidades adicionales (ΔU)
                <input
                  type="number"
                  min={0}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm w-32"
                  value={extraUnits}
                  onChange={(e) => setExtraUnits(Number(e.target.value))}
                />
              </label>
            )}
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Min share por modelo
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm w-28"
                value={minShare}
                onChange={(e) => setMinShare(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col text-slate-700 text-xs font-semibold">
              Max share por modelo
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm w-28"
                value={maxShare}
                onChange={(e) => setMaxShare(Number(e.target.value))}
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <SlidersHorizontal size={16} />
            <span className="text-sm font-semibold">Indicadores clave</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Modelos en entrenamiento</span>
              <span className="font-semibold">{stats.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total unidades mes activo</span>
              <span className="font-semibold">{formatNumber(totalUnits)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Margen mes activo</span>
              <span className="font-semibold">{formatCurrency(totalMargin)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Δ$ margen estimado</span>
              <span className={`font-semibold ${result.deltaMargen >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(result.deltaMargen)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:border-celeste-200 hover:text-celeste-700"
          >
            <Download size={16} /> Exportar plan CSV
          </button>
          <div className="text-[11px] text-slate-500 leading-relaxed">
            Optimización de mix por línea. r_m = mediana del margen unitario (entrenamiento, trimming seleccionado). Capacidad =
            P90 unidades/mes por modelo.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <BarChart3 size={16} />
            <span className="text-sm font-semibold">Estimadores por modelo</span>
          </div>
          <div className="text-xs text-slate-500">Capacidad = P90 de unidades mensuales con la máscara seleccionada</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Nombre modelo</th>
                <th className="py-2">cap_m</th>
                <th className="py-2">r_m (mediana margen/unit)</th>
                <th className="py-2">Riesgo (IQR)</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.modelo} className="border-t border-slate-100 text-slate-700">
                  <td className="py-2 font-semibold">{row.modelo}</td>
                  <td className="py-2">{formatNumber(row.cap_m)}</td>
                  <td className="py-2">{formatCurrency(row.r_m)}</td>
                  <td className="py-2">{formatCurrency(row.risk)}</td>
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500 py-4">
                    Sin datos en la ventana seleccionada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <ArrowDownUp size={16} />
            <span className="text-sm font-semibold">Recomendación de mix</span>
          </div>
          <div className="text-xs text-slate-500">Ordenado por Δ$ margen</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Nombre modelo</th>
                <th className="py-2">u_m_actual</th>
                <th className="py-2">cap_m</th>
                <th className="py-2">r_m</th>
                <th className="py-2">Δu</th>
                <th className="py-2">u_m_nuevo</th>
                <th className="py-2">Δ$ margen</th>
              </tr>
            </thead>
            <tbody>
              {result.recomendacion
                .slice()
                .sort((a, b) => b.delta_margen - a.delta_margen)
                .map((row) => (
                  <tr key={row.modelo} className="border-t border-slate-100 text-slate-700">
                    <td className="py-2 font-semibold">{row.modelo}</td>
                    <td className="py-2">{formatNumber(row.u_m_actual)}</td>
                    <td className="py-2">{formatNumber(row.cap_m)}</td>
                    <td className="py-2">{formatCurrency(row.r_m)}</td>
                    <td className={`py-2 font-semibold ${row.du >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {row.du >= 0 ? `+${row.du}` : row.du}
                    </td>
                    <td className="py-2">{formatNumber(row.u_m_nuevo)}</td>
                    <td className={`py-2 font-semibold ${row.delta_margen >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(row.delta_margen)}
                    </td>
                  </tr>
                ))}
              {!result.recomendacion.length && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-4">
                    No hay recomendación disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-700">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">Total actual</p>
            <p className="font-semibold">{formatNumber(totalUnits)} unidades · {formatCurrency(totalMargin)} margen</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">Δ esperado</p>
            <p className="font-semibold text-emerald-700">{formatCurrency(result.deltaMargen)}</p>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">Total nuevo</p>
            <p className="font-semibold">
              {formatNumber(totalUnits + (mode === 'growth' ? extraUnits : 0))} unidades ·
              {` ${formatCurrency(totalMargin + result.deltaMargen)}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MixOptimizerPanel;
