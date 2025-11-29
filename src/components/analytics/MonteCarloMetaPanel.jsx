import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Info, LineChart, Play, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { marginFromRecord, monthFromRecord, normalizeRecords, yearFromRecord } from '../../utils/dataParser.js';
import { formatCurrency, formatNumber, formatPercent } from '../../utils/formatters.js';

const quantile = (arr = [], q = 0.5) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

const trimSamples = (samples = [], rule = 'pRange', includeOutliers = true) => {
  if (includeOutliers) return samples;
  if (!samples.length) return samples;
  const sorted = [...samples].sort((a, b) => a - b);
  if (rule === 'tukey') {
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const min = q1 - 1.5 * iqr;
    const max = q3 + 1.5 * iqr;
    return sorted.filter((x) => x >= min && x <= max);
  }
  const p10 = quantile(sorted, 0.1);
  const p90 = quantile(sorted, 0.9);
  return sorted.filter((x) => x >= p10 && x <= p90);
};

const samplePoisson = (lambda) => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return Math.max(0, k - 1);
};

const sampleGamma = (shape, scale) => {
  if (shape < 1) {
    const u = Math.random();
    return sampleGamma(1 + shape, scale) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x;
    let v;
    do {
      x = (Math.random() * 2 - 1) * Math.sqrt(2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
};

const sampleNegBin = (mu, r) => {
  const gammaMean = sampleGamma(r, mu / r);
  return samplePoisson(gammaMean);
};

const describeFamily = (mean, variance) => {
  if (!Number.isFinite(mean) || mean <= 0) return { lambda: 0, family: 'poisson', r: null, variance: 0 };
  const family = variance > 1.5 * mean ? 'negbin' : 'poisson';
  const r = family === 'negbin' ? (mean * mean) / Math.max(1e-6, variance - mean) : null;
  return { lambda: mean, variance, family, r };
};

const toYearMonth = (year, month) => (Number.isFinite(year) && Number.isFinite(month) ? year * 100 + month : null);

const chipColor = (p) => {
  if (p >= 0.7) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (p >= 0.4) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-rose-100 text-rose-800 border-rose-200';
};

const ProbabilityBadge = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${chipColor(value)}`}>
    {formatPercent(value)}
  </span>
);

const curveFromSamples = (samples = [], goalKey = 'count', maxPoints = 18) => {
  if (!samples.length) return [];
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const points = [];
  const step = (max - min || 1) / maxPoints;
  for (let i = 0; i <= maxPoints; i++) {
    const meta = min + step * i;
    const idx = sorted.findIndex((x) => x >= meta);
    const prob = idx === -1 ? 0 : 1 - idx / sorted.length;
    points.push({ meta, prob, goalKey });
  }
  return points;
};

const formatGoalLabel = (type) => {
  if (type === 'ingresos') return 'Meta de ingresos (USD)';
  if (type === 'margen') return 'Meta de margen (USD)';
  return 'Meta de unidades';
};

const MonteCarloMetaPanel = ({ records = [] }) => {
  const normalized = useMemo(() => normalizeRecords(records), [records]);
  const lines = useMemo(
    () => Array.from(new Set(normalized.map((row) => row.businessLine).filter(Boolean))).sort(),
    [normalized],
  );

  const vendorsByLine = useMemo(() => {
    const map = new Map();
    normalized.forEach((row) => {
      if (!row.businessLine || !row.sellerName) return;
      if (!map.has(row.businessLine)) map.set(row.businessLine, new Set());
      map.get(row.businessLine).add(row.sellerName);
    });
    return map;
  }, [normalized]);

  const [selectedLine, setSelectedLine] = useState(() => lines[0]);
  const [scope, setScope] = useState('linea');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [metaType, setMetaType] = useState('unidades');
  const [horizon, setHorizon] = useState(1);
  const [windowMonths, setWindowMonths] = useState(12);
  const [runs, setRuns] = useState(5000);
  const [kUnid, setKUnid] = useState(8);
  const [metaIng, setMetaIng] = useState(15000);
  const [metaMar, setMetaMar] = useState(8000);
  const [outlierRule, setOutlierRule] = useState('pRange');
  const [includeOutliers, setIncludeOutliers] = useState(true);
  const [samples, setSamples] = useState({ counts: [], margins: [], ingresos: [] });
  const [result, setResult] = useState({ p: 0, p10: 0, p50: 0, p90: 0, family: 'poisson', lambda: 0, r: null });
  const [curve, setCurve] = useState([]);
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    if (!selectedLine && lines.length) setSelectedLine(lines[0]);
  }, [lines, selectedLine]);

  const activeMonth = useMemo(() => {
    const yms = normalized
      .map((row) => toYearMonth(yearFromRecord(row), monthFromRecord(row)))
      .filter((value) => Number.isFinite(value));
    return yms.length ? Math.max(...yms) : null;
  }, [normalized]);

  const trainingMonths = useMemo(() => {
    if (!activeMonth) return new Set();
    const months = new Set();
    let current = activeMonth - 1;
    let remaining = windowMonths;
    while (remaining > 0 && current > 0) {
      months.add(current);
      const month = current % 100 || 12;
      const year = Math.floor(current / 100);
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      current = toYearMonth(prevYear, prevMonth);
      remaining -= 1;
    }
    return months;
  }, [activeMonth, windowMonths]);

  const trainingRecords = useMemo(
    () =>
      normalized.filter((row) => {
        if (!row.businessLine || row.businessLine !== selectedLine) return false;
        if (scope === 'vendedor' && selectedVendor && row.sellerName !== selectedVendor) return false;
        const ym = toYearMonth(yearFromRecord(row), monthFromRecord(row));
        return ym && trainingMonths.has(ym);
      }),
    [normalized, selectedLine, scope, selectedVendor, trainingMonths],
  );

  const monthlyCounts = useMemo(() => {
    const map = new Map();
    trainingRecords.forEach((row) => {
      const ym = toYearMonth(yearFromRecord(row), monthFromRecord(row));
      if (!ym) return;
      const prev = map.get(ym) || 0;
      map.set(ym, prev + (Number(row['Unidades UN']) || Number(row.unidades) || 1));
    });
    return Array.from(map.values());
  }, [trainingRecords]);

  const stats = useMemo(() => {
    const mean = monthlyCounts.reduce((acc, val) => acc + val, 0) / (monthlyCounts.length || 1);
    const variance =
      monthlyCounts.reduce((acc, val) => acc + (val - mean) ** 2, 0) / Math.max(1, monthlyCounts.length - 1);
    return describeFamily(mean, variance);
  }, [monthlyCounts]);

  const marginSamples = useMemo(() => {
    const margins = trainingRecords
      .map((row) => {
        const units = Number(row['Unidades UN']) || Number(row.unidades) || 1;
        const margin = marginFromRecord(row);
        if (!Number.isFinite(units) || units <= 0) return null;
        if (!Number.isFinite(margin)) return null;
        return margin / units;
      })
      .filter((v) => v !== null);
    return trimSamples(margins, outlierRule, includeOutliers);
  }, [trainingRecords, outlierRule, includeOutliers]);

  const ingresoSamples = useMemo(() => {
    const ingresos = trainingRecords
      .map((row) => {
        const units = Number(row['Unidades UN']) || Number(row.unidades) || 1;
        const ingreso = Number(row.ingresos) || Number(row['ingresos']);
        if (!Number.isFinite(units) || units <= 0) return null;
        if (!Number.isFinite(ingreso)) return null;
        return ingreso / units;
      })
      .filter((v) => v !== null);
    return trimSamples(ingresos, outlierRule, includeOutliers);
  }, [trainingRecords, outlierRule, includeOutliers]);

  const simulate = () => {
    const counts = [];
    const margins = [];
    const ingresos = [];
    const mu = stats.lambda * horizon;
    for (let i = 0; i < runs; i++) {
      const N = stats.family === 'negbin' && stats.r ? sampleNegBin(mu, stats.r) : samplePoisson(mu);
      counts.push(N);
      if (N > 0) {
        let totalMargin = 0;
        let totalIngreso = 0;
        for (let j = 0; j < N; j++) {
          if (marginSamples.length) {
            const idx = Math.floor(Math.random() * marginSamples.length);
            totalMargin += marginSamples[idx];
          }
          if (ingresoSamples.length) {
            const idx = Math.floor(Math.random() * ingresoSamples.length);
            totalIngreso += ingresoSamples[idx];
          }
        }
        margins.push(totalMargin);
        ingresos.push(totalIngreso);
      } else {
        margins.push(0);
        ingresos.push(0);
      }
    }
    setSamples({ counts, margins, ingresos });
  };

  const updateResult = () => {
    if (!samples.counts.length) return;
    let p = 0;
    let p10 = 0;
    let p50 = 0;
    let p90 = 0;
    if (metaType === 'unidades') {
      const sorted = [...samples.counts].sort((a, b) => a - b);
      const idx = sorted.findIndex((x) => x >= kUnid);
      p = idx === -1 ? 0 : 1 - idx / sorted.length;
      p10 = quantile(sorted, 0.1);
      p50 = quantile(sorted, 0.5);
      p90 = quantile(sorted, 0.9);
      setCurve(curveFromSamples(samples.counts, 'unidades'));
    } else if (metaType === 'margen') {
      const sorted = [...samples.margins].sort((a, b) => a - b);
      const idx = sorted.findIndex((x) => x >= metaMar);
      p = idx === -1 ? 0 : 1 - idx / sorted.length;
      p10 = quantile(sorted, 0.1);
      p50 = quantile(sorted, 0.5);
      p90 = quantile(sorted, 0.9);
      setCurve(curveFromSamples(samples.margins, 'margen'));
    } else {
      const sorted = [...samples.ingresos].sort((a, b) => a - b);
      const idx = sorted.findIndex((x) => x >= metaIng);
      p = idx === -1 ? 0 : 1 - idx / sorted.length;
      p10 = quantile(sorted, 0.1);
      p50 = quantile(sorted, 0.5);
      p90 = quantile(sorted, 0.9);
      setCurve(curveFromSamples(samples.ingresos, 'ingresos'));
    }
    setResult({ p, p10, p50, p90, family: stats.family, lambda: stats.lambda, r: stats.r, variance: stats.variance });
  };

  useEffect(() => {
    updateResult();
  }, [metaType, kUnid, metaIng, metaMar, samples]);

  useEffect(() => {
    // recompute ranking when samples change
    const vendors = Array.from(vendorsByLine.get(selectedLine) || []);
    const mu = stats.lambda * horizon;
    const nextRanking = vendors.map((vendor) => {
      const vendorMonthly = trainingRecords
        .filter((row) => row.sellerName === vendor)
        .reduce((map, row) => {
          const ym = toYearMonth(yearFromRecord(row), monthFromRecord(row));
          if (!ym) return map;
          const prev = map.get(ym) || 0;
          map.set(ym, prev + (Number(row['Unidades UN']) || Number(row.unidades) || 1));
          return map;
        }, new Map());
      const counts = Array.from(vendorMonthly.values());
      const vMean = counts.reduce((acc, val) => acc + val, 0) / (counts.length || 1);
      const vVariance = counts.reduce((acc, val) => acc + (val - vMean) ** 2, 0) / Math.max(1, counts.length - 1);
      const fam = describeFamily(vMean, vVariance);
      const simRuns = Math.min(1000, runs);
      const simulated = [];
      for (let i = 0; i < simRuns; i++) {
        const n = fam.family === 'negbin' && fam.r ? sampleNegBin(fam.lambda * horizon, fam.r) : samplePoisson(fam.lambda * horizon);
        simulated.push(n);
      }
      const sorted = simulated.sort((a, b) => a - b);
      const idx = sorted.findIndex((x) => x >= kUnid);
      const pUnits = idx === -1 ? 0 : 1 - idx / sorted.length;
      return { vendor, lambda: fam.lambda, family: fam.family, pUnits };
    });
    setRanking(nextRanking.sort((a, b) => b.pUnits - a.pUnits));
  }, [vendorsByLine, selectedLine, trainingRecords, stats, horizon, runs, kUnid]);

  const exportRanking = () => {
    if (!ranking.length) return;
    const header = ['Vendedor', 'lambda', 'familia', 'P(N>=k_unid)'];
    const lines = ranking.map((row) =>
      [row.vendor, row.lambda.toFixed(2), row.family, formatPercent(row.pUnits)].join(','),
    );
    const footer = '"SMC: conteos Poisson/NB y remuestreo empírico de montos; B=5,000; ventana K meses. Fuente: 2022–2025 H1."';
    const blob = new Blob([header.join(',') + '\n' + lines.join('\n') + '\n' + footer], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ranking_vendedores_smc.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const goalLabel = formatGoalLabel(metaType);

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-500">Simulación Monte Carlo</p>
            <h2 className="text-xl font-semibold text-slate-900">Cumplimiento de meta por línea y vendedor</h2>
            <p className="text-sm text-slate-600">
              Conteos Poisson/NB con horizonte E y remuestreo empírico de montos unitarios. B={runs.toLocaleString()} corridas.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Info size={16} />
            <span>Ventana {windowMonths} meses · Outliers {includeOutliers ? 'incluidos' : 'recortados'}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <p className="text-[11px] uppercase text-slate-500">Objeto de meta</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { key: 'unidades', label: 'Unidades' },
                { key: 'ingresos', label: 'Ingresos' },
                { key: 'margen', label: 'Margen' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMetaType(item.key)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition ${
                    metaType === item.key
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <p className="text-[11px] uppercase text-slate-500">Ámbito</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                type="button"
                onClick={() => setScope('linea')}
                className={`px-3 py-1.5 rounded-full border text-sm transition ${
                  scope === 'linea'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                }`}
              >
                Agregado línea
              </button>
              <button
                type="button"
                onClick={() => setScope('vendedor')}
                className={`px-3 py-1.5 rounded-full border text-sm transition ${
                  scope === 'vendedor'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                }`}
              >
                Por vendedor
              </button>
            </div>
            {scope === 'vendedor' && (
              <div className="mt-3">
                <label className="text-xs text-slate-600">nombreVendedor</label>
                <select
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                >
                  <option value="">Selecciona vendedor</option>
                  {Array.from(vendorsByLine.get(selectedLine) || []).map((vendor) => (
                    <option key={vendor} value={vendor}>
                      {vendor}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <p className="text-[11px] uppercase text-slate-500">Línea de negocio</p>
            <select
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
            >
              {lines.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2 mt-3 text-sm text-slate-700">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Horizonte E (meses)</span>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value) || 1)}
                  className="border border-slate-200 rounded-lg px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Ventana (meses)</span>
                <select
                  value={windowMonths}
                  onChange={(e) => setWindowMonths(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-2 py-1"
                >
                  {[6, 9, 12].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">B corridas</span>
                <select
                  value={runs}
                  onChange={(e) => setRuns(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-2 py-1"
                >
                  {[1000, 5000, 10000].map((b) => (
                    <option key={b} value={b}>
                      {b.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-slate-500">Meta</span>
              <Info size={14} className="text-slate-400" title="Se actualiza en vivo contra las corridas SMC" />
            </div>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>{goalLabel}</span>
                <span className="font-semibold text-slate-900">
                  {metaType === 'unidades'
                    ? kUnid
                    : metaType === 'margen'
                    ? formatCurrency(metaMar)
                    : formatCurrency(metaIng)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={metaType === 'unidades' ? Math.max(50, Math.ceil(stats.lambda * 3)) : 50000}
                step={metaType === 'unidades' ? 1 : 500}
                value={metaType === 'unidades' ? kUnid : metaType === 'margen' ? metaMar : metaIng}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (metaType === 'unidades') setKUnid(val);
                  else if (metaType === 'margen') setMetaMar(val);
                  else setMetaIng(val);
                }}
                className="accent-black"
              />
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="radio"
                  name="outliers"
                  checked={outlierRule === 'pRange'}
                  onChange={() => setOutlierRule('pRange')}
                />
                P10–P90
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="radio" name="outliers" checked={outlierRule === 'tukey'} onChange={() => setOutlierRule('tukey')} />
                Tukey 1.5·IQR
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={includeOutliers}
                  onChange={(e) => setIncludeOutliers(e.target.checked)}
                />
                Incluir outliers
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={simulate}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-sm"
              >
                <Play size={14} /> Simular
              </button>
              <button
                type="button"
                onClick={() => setSamples({ counts: [], margins: [], ingresos: [] })}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
              >
                <RefreshCcw size={14} /> Reset
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Probabilidad de cumplimiento</span>
              <ProbabilityBadge value={result.p} />
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-700">
              <div className="flex-1">
                <p className="text-[11px] uppercase text-slate-500">λ̂</p>
                <p className="text-lg font-semibold text-slate-900">{formatNumber(result.lambda, { maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-500">Familia {result.family === 'negbin' ? 'NegBin' : 'Poisson'}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] uppercase text-slate-500">Horizonte</p>
                <p className="text-lg font-semibold text-slate-900">{horizon} mes(es)</p>
                <p className="text-xs text-slate-500">Varianza {formatNumber(result.variance || 0, { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] uppercase text-slate-500">p̂</p>
                <p className="text-lg font-semibold text-slate-900">{formatPercent(result.p)}</p>
                {metaType === 'unidades' ? (
                  <p className="text-xs text-slate-500">E[N]={formatNumber(result.lambda * horizon, { maximumFractionDigits: 1 })}</p>
                ) : (
                  <p className="text-xs text-slate-500">P50 [{formatCurrency(result.p10)} – {formatCurrency(result.p90)}]</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm text-slate-700">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-[11px] uppercase text-slate-500">P10</p>
                <p className="font-semibold text-slate-900">
                  {metaType === 'unidades' ? formatNumber(result.p10) : formatCurrency(result.p10)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-[11px] uppercase text-slate-500">P50</p>
                <p className="font-semibold text-slate-900">
                  {metaType === 'unidades' ? formatNumber(result.p50) : formatCurrency(result.p50)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-[11px] uppercase text-slate-500">P90</p>
                <p className="font-semibold text-slate-900">
                  {metaType === 'unidades' ? formatNumber(result.p90) : formatCurrency(result.p90)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Curva Probabilidad vs Meta</span>
              <LineChart size={16} className="text-slate-400" />
            </div>
            <div className="h-32 flex items-end gap-1">
              {curve.map((point, idx) => (
                <div key={`${point.goalKey}-${idx}`} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-black/80 to-black/40"
                    style={{ height: `${Math.max(6, point.prob * 100)}%` }}
                    title={`${formatGoalLabel(metaType)} ${formatNumber(point.meta, { maximumFractionDigits: 0 })} → ${formatPercent(
                      point.prob,
                    )}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Monótona decreciente; cada barra representa la probabilidad de cumplir al menos la meta indicada.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <BarChart3 size={16} />
            <h3 className="font-semibold">Ranking por vendedor (línea seleccionada)</h3>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={exportRanking}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>
        <div className="overflow-auto border border-slate-200 rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">nombreVendedor</th>
                <th className="px-3 py-2 text-left">λ̂</th>
                <th className="px-3 py-2 text-left">Familia</th>
                <th className="px-3 py-2 text-left">P(N≥k_unid)</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row) => (
                <tr key={row.vendor} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.vendor}</td>
                  <td className="px-3 py-2 text-slate-700">{formatNumber(row.lambda, { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-slate-700">{row.family === 'negbin' ? 'NegBin' : 'Poisson'}</td>
                  <td className="px-3 py-2 text-slate-700">{formatPercent(row.pUnits)}</td>
                </tr>
              ))}
              {!ranking.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-slate-500 text-sm">
                    No hay vendedores con datos suficientes en la línea seleccionada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">
          Pie: “SMC: conteos Poisson/NB y remuestreo empírico de montos; B=5,000; ventana K meses. Fuente: 2022–2025 H1.”
        </p>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-700">
          <SlidersHorizontal size={16} />
          <h3 className="font-semibold">Contexto y metodología</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-700">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">Tooltip λ̂</p>
            <p className="font-semibold">Promedio mensual de ventas por vendedor-línea (sobredispersión ⇒ NB).</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">Nota metodológica</p>
            <p className="font-semibold">
              Para Unidades: N~Pois/NB con media λ̂·E. Para Margen/Ingresos: remuestreo de montos unitarios (P10–P90 o Tukey).
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">Sobredispersión</p>
            <p className="font-semibold">NB se activa cuando varianza &gt; 1.5·media según ventana seleccionada.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonteCarloMetaPanel;
