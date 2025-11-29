import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BarChart3, Download, Info, Thermometer } from 'lucide-react';
import { normalizeRecords, monthFromRecord, yearFromRecord } from '../../utils/dataParser.js';
import Modal from '../ui/Modal.jsx';
import RegressionComparisonModule from './RegressionComparisonModule.jsx';

const LINES = ['Automóviles', 'Vans', 'Camiones', 'Buses'];
const METRIC_OPTIONS = [
  { value: 'margen', label: 'Margen' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'costos', label: 'Costos' },
  { value: 'unidades', label: 'Unidades' },
];

const strengthLabel = (r) => {
  const abs = Math.abs(r);
  if (!Number.isFinite(abs)) return 'N/A';
  if (abs >= 0.7) return 'correlación fuerte';
  if (abs >= 0.4) return 'correlación moderada';
  if (abs >= 0.2) return 'correlación débil';
  return 'casi independiente';
};

const formatR = (r) => (Number.isFinite(r) ? r.toFixed(2) : 'N/A');

const lerp = (a, b, t) => a + (b - a) * t;

const heatColor = (r) => {
  if (!Number.isFinite(r)) return 'rgb(226, 232, 240)';
  const clamped = Math.max(-1, Math.min(1, r));
  const t = (clamped + 1) / 2; // 0→azul, 0.5→gris claro, 1→verde
  const startNeg = { r: 59, g: 130, b: 246 }; // azul
  const neutral = { r: 226, g: 232, b: 240 }; // gris claro
  const startPos = { r: 34, g: 197, b: 94 }; // verde
  let red;
  let green;
  let blue;
  if (t < 0.5) {
    const nt = t / 0.5;
    red = Math.round(lerp(startNeg.r, neutral.r, nt));
    green = Math.round(lerp(startNeg.g, neutral.g, nt));
    blue = Math.round(lerp(startNeg.b, neutral.b, nt));
  } else {
    const pt = (t - 0.5) / 0.5;
    red = Math.round(lerp(neutral.r, startPos.r, pt));
    green = Math.round(lerp(neutral.g, startPos.g, pt));
    blue = Math.round(lerp(neutral.b, startPos.b, pt));
  }
  return `rgb(${red}, ${green}, ${blue})`;
};

const heatTextColor = (r) => {
  if (!Number.isFinite(r)) return '#0f172a';
  const bg = heatColor(r)
    .replace('rgb(', '')
    .replace(')', '')
    .split(',')
    .map((v) => parseInt(v.trim(), 10));
  const [red, green, blue] = bg;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance < 0.55 ? '#ffffff' : '#0f172a';
};

const regularizedIncompleteBeta = (x, a, b) => {
  const bt =
    x === 0 || x === 1
      ? 0
      : Math.exp(
          logGamma(a + b) - logGamma(a) - logGamma(b) +
            a * Math.log(x) +
            b * Math.log(1 - x),
        );

  const EPS = 1e-10;
  const flip = x < (a + 1) / (a + b + 2);
  const cf = betacf(flip ? x : 1 - x, a, b);
  const front = bt / a;
  return flip ? front * cf : 1 - front * cf;
};

const betacf = (x, a, b) => {
  const MAX_ITER = 200;
  const EPS = 3e-7;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < EPS) d = EPS;
  d = 1 / d;
  let h = d;
  for (let m = 1, m2 = 2; m <= MAX_ITER; m += 1, m2 += 2) {
    const aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < EPS) d = EPS;
    c = 1 + aa / c;
    if (Math.abs(c) < EPS) c = EPS;
    d = 1 / d;
    h *= d * c;
    const aa2 = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa2 * d;
    if (Math.abs(d) < EPS) d = EPS;
    c = 1 + aa2 / c;
    if (Math.abs(c) < EPS) c = EPS;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < EPS) break;
  }
  return h;
};

const logGamma = (z) => {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j += 1) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
};

const pearsonCorrelation = (x = [], y = []) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { r: Number.NaN, p: Number.NaN };
  const meanX = x.reduce((acc, val) => acc + val, 0) / n;
  const meanY = y.reduce((acc, val) => acc + val, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return { r: Number.NaN, p: Number.NaN };
  const r = num / Math.sqrt(denX * denY);
  const df = n - 2;
  const t = r * Math.sqrt(df / Math.max(1e-9, 1 - r * r));
  const xVal = df / (df + t * t);
  const ib = regularizedIncompleteBeta(xVal, df / 2, 0.5);
  const cdf = t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
  const p = Math.max(0, Math.min(1, 2 * (1 - cdf)));
  return { r, p };
};

const bootstrapCI = (pairs, B = 2000) => {
  const n = pairs.length;
  if (n < 6) return null;
  const rs = [];
  for (let b = 0; b < B; b += 1) {
    const x = [];
    const y = [];
    for (let i = 0; i < n; i += 1) {
      const idx = Math.floor(Math.random() * n);
      x.push(pairs[idx][0]);
      y.push(pairs[idx][1]);
    }
    rs.push(pearsonCorrelation(x, y).r);
  }
  rs.sort((a, b) => a - b);
  const lo = rs[Math.floor(0.025 * rs.length)] ?? Number.NaN;
  const hi = rs[Math.floor(0.975 * rs.length)] ?? Number.NaN;
  return [lo, hi];
};

const interpretLineText = (line, metric, r, p, n) => {
  if (!Number.isFinite(r) || n < 6) return `${line} vs conjunto: sin datos suficientes.`;
  return `${line} vs conjunto: ${strengthLabel(r)} (r=${formatR(r)}; p=${p.toFixed(3)}; n=${n}).`;
};

const FOOTER_TEXT =
  'Correlación de Pearson mensual por línea. Agregación: Σ(métrica) por Año–Mes–Línea de Negocio. IC95% por bootstrap (B=2,000) opcional. Fuente: 2022–2025 H1.';

const LineCorrelationPanel = ({ records = [] }) => {
  const [metric, setMetric] = useState('margen');
  const [withCI, setWithCI] = useState(true);
  const [bootstrapRuns, setBootstrapRuns] = useState(2000);
  const chartRef = useRef(null);
  const [openModal, setOpenModal] = useState(false);

  const normalized = useMemo(() => normalizeRecords(records), [records]);

  const monthlyAggregates = useMemo(() => {
    const map = new Map();
    normalized.forEach((row) => {
      const line = row.businessLine || row['Línea de Negocio'];
      const year = yearFromRecord(row);
      const month = monthFromRecord(row);
      if (!line || !Number.isFinite(year) || !Number.isFinite(month)) return;
      const yyyymm = year * 100 + month;
      if (!map.has(line)) map.set(line, new Map());
      const byMonth = map.get(line);
      const current = byMonth.get(yyyymm) || { margen: 0, ingresos: 0, costos: 0, unidades: 0 };
      const unidades = Number(row['Unidades UN']) || 0;
      byMonth.set(yyyymm, {
        margen: current.margen + (Number(row.margen) || 0),
        ingresos: current.ingresos + (Number(row.ingresos) || 0),
        costos: current.costos + (Number(row.costos) || 0),
        unidades: current.unidades + unidades,
      });
    });
    return map;
  }, [normalized]);

  const availableLines = useMemo(
    () => LINES.filter((line) => monthlyAggregates.has(line)),
    [monthlyAggregates],
  );

  const seriesByLine = useMemo(() => {
    const key = metric === 'unidades' ? 'unidades' : metric;
    const result = new Map();
    availableLines.forEach((line) => {
      const byMonth = monthlyAggregates.get(line);
      if (!byMonth) return;
      const sorted = Array.from(byMonth.entries()).sort((a, b) => a[0] - b[0]);
      result.set(line, {
        months: sorted.map(([ym]) => ym),
        values: sorted.map(([, agg]) => agg[key] ?? 0),
      });
    });
    return result;
  }, [availableLines, metric, monthlyAggregates]);

  const alignSeries = useCallback((lineA, lineB) => {
    const a = seriesByLine.get(lineA);
    const b = seriesByLine.get(lineB);
    if (!a || !b) return { pairs: [], n: 0 };
    const mapB = new Map();
    b.months.forEach((m, idx) => mapB.set(m, b.values[idx]));
    const pairs = [];
    a.months.forEach((m, idx) => {
      if (mapB.has(m)) pairs.push([a.values[idx], mapB.get(m)]);
    });
    return { pairs, n: pairs.length };
  }, [seriesByLine]);

  const pairwise = useMemo(() => {
    const rows = availableLines.map((row) => {
      const cols = availableLines.map((col) => {
        if (row === col) return { r: 1, p: 0, n: seriesByLine.get(row)?.months.length ?? 0, ci: null };
        const { pairs, n } = alignSeries(row, col);
        if (n < 6) return { r: Number.NaN, p: Number.NaN, n, ci: null };
        const { r, p } = pearsonCorrelation(
          pairs.map(([x]) => x),
          pairs.map(([, y]) => y),
        );
        const ci = withCI ? bootstrapCI(pairs, bootstrapRuns) : null;
        return { r, p, n, ci };
      });
      return { line: row, cols };
    });
    return rows;
  }, [alignSeries, availableLines, bootstrapRuns, seriesByLine, withCI]);

  const oneVsAll = useMemo(() => {
    const key = metric === 'unidades' ? 'unidades' : metric;
    return availableLines.map((line) => {
      const target = seriesByLine.get(line);
      if (!target) return { line, r: Number.NaN, p: Number.NaN, n: 0, ci: null };
      const otherMonths = new Map();
      availableLines
        .filter((l) => l !== line)
        .forEach((other) => {
          const series = seriesByLine.get(other);
          if (!series) return;
          series.months.forEach((m, idx) => {
            const val = series.values[idx];
            otherMonths.set(m, (otherMonths.get(m) || 0) + val);
          });
        });
      const pairs = [];
      target.months.forEach((m, idx) => {
        if (otherMonths.has(m)) pairs.push([target.values[idx], otherMonths.get(m)]);
      });
      if (pairs.length < 6) return { line, r: Number.NaN, p: Number.NaN, n: pairs.length, ci: null };
      const { r, p } = pearsonCorrelation(
        pairs.map(([x]) => x),
        pairs.map(([, y]) => y),
      );
      return { line, r, p, n: pairs.length, ci: withCI ? bootstrapCI(pairs, bootstrapRuns) : null };
    });
  }, [availableLines, bootstrapRuns, metric, seriesByLine, withCI]);

  const exportCsv = () => {
    if (!availableLines.length) return;
    const header = ['Linea', ...availableLines];
    const lines = pairwise.map((row) => {
      const values = row.cols.map((cell) => formatR(cell.r));
      return [row.line, ...values].join(',');
    });
    const meta = pairwise
      .map((row) =>
        row.cols
          .map(
            (cell, idx) =>
              `${row.line}-${availableLines[idx]}: r=${formatR(cell.r)}; p=${Number.isFinite(cell.p) ? cell.p.toFixed(3) : 'N/A'}; n=${cell.n}` +
              (cell.ci ? `; CI95=[${formatR(cell.ci[0])}, ${formatR(cell.ci[1])}]` : ''),
          )
          .join('; '),
      )
      .join('\n');
    const blob = new Blob([`${header.join(',')}\n${lines.join('\n')}\n"Pie","${FOOTER_TEXT}"\n"Detalle","${meta}"`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'correlaciones_lineas.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPng = () => {
    if (!chartRef.current) return;
    const canvas = document.createElement('canvas');
    const width = 900;
    const height = 600;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText('Correlaciones entre líneas', 20, 32);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(`Métrica: ${metric}`, 20, 58);
    const gridSize = 60;
    const startX = 20;
    const startY = 90;
    ctx.font = '12px Inter, sans-serif';
    availableLines.forEach((line, idx) => {
      ctx.fillStyle = '#475569';
      ctx.fillText(line, startX, startY + (idx + 1) * gridSize - 20);
      ctx.fillText(line, startX + (idx + 1) * gridSize, startY - 10);
    });
    pairwise.forEach((row, rIdx) => {
      row.cols.forEach((cell, cIdx) => {
        const x = startX + (cIdx + 1) * gridSize;
        const y = startY + rIdx * gridSize;
        ctx.fillStyle = heatColor(cell.r);
        ctx.fillRect(x, y, gridSize - 8, gridSize - 8);
        ctx.fillStyle = heatTextColor(cell.r);
        ctx.fillText(formatR(cell.r), x + 8, y + gridSize / 2);
      });
    });
    const cardStartY = startY + (availableLines.length + 1) * gridSize;
    ctx.font = '14px Inter, sans-serif';
    oneVsAll.forEach((item, idx) => {
      const cx = 20 + idx * 210;
      const cy = cardStartY + Math.floor(idx / 2) * 90;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(cx, cy, 190, 80);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(item.line, cx + 10, cy + 22);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(`r=${formatR(item.r)}; p=${Number.isFinite(item.p) ? item.p.toFixed(3) : 'N/A'}; n=${item.n}`, cx + 10, cy + 42);
      if (item.ci) ctx.fillText(`IC95% [${formatR(item.ci[0])}, ${formatR(item.ci[1])}]`, cx + 10, cy + 60);
      ctx.font = '14px Inter, sans-serif';
    });
    ctx.fillStyle = '#475569';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(FOOTER_TEXT, 20, height - 16);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'correlaciones_lineas.png';
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6" ref={chartRef}>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Correlaciones entre líneas</h2>
        <p className="text-sm text-slate-600">
          Coeficientes de Pearson por métrica mensual. Opcional: IC95% por bootstrap.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">Métrica</p>
          <div className="flex flex-wrap gap-2">
            {METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMetric(opt.value)}
                className={`px-3 py-2 rounded-full border text-sm ${
                  metric === opt.value
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200 hover:text-celeste-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">IC95% bootstrap</p>
          <div className="flex items-center gap-2">
            <input
              id="toggle-ci"
              type="checkbox"
              checked={withCI}
              onChange={(e) => setWithCI(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="toggle-ci" className="text-sm text-slate-700">
              Incluir IC95% (B=2,000)
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">Exportables</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-celeste-200 hover:text-celeste-700"
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              type="button"
              onClick={exportPng}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-celeste-200 hover:text-celeste-700"
            >
              <BarChart3 size={16} /> Export PNG
            </button>
            <button
              type="button"
              onClick={() => setOpenModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:border-celeste-200 hover:text-celeste-700"
            >
              <Info size={16} /> Ver popup
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase text-slate-500">Notas</p>
          <p className="text-sm text-slate-600 flex items-center gap-2">
            <Info size={14} className="text-celeste-600" />
            La correlación se calcula sobre la serie mensual de la métrica seleccionada (suma por mes y línea).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Matriz 1↔1</p>
              <p className="text-sm text-slate-700">r de Pearson, p-value y n_meses comunes.</p>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Thermometer size={14} />
              <span>Fuerte ≥0.70 · Moderada 0.40–0.70 · Débil 0.20–0.40 · Casi independiente &lt;0.20</span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-slate-500">Línea</th>
                  {availableLines.map((line) => (
                    <th key={line} className="p-2 text-left text-slate-500">
                      {line}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pairwise.map((row) => (
                  <tr key={row.line} className="border-t border-slate-100">
                    <td className="p-2 font-semibold text-slate-900">{row.line}</td>
                    {row.cols.map((cell, idx) => (
                      <td key={`${row.line}-${availableLines[idx]}`} className="p-1">
                        <div
                          className="rounded-xl border border-slate-100 px-2 py-1 text-xs shadow-sm"
                          style={{ backgroundColor: heatColor(cell.r), color: heatTextColor(cell.r) }}
                          title={
                            Number.isFinite(cell.r) && cell.n >= 6
                              ? `r=${formatR(cell.r)}; p=${Number.isFinite(cell.p) ? cell.p.toFixed(3) : 'N/A'}; n=${cell.n}` +
                                (cell.ci ? `; IC95% [${formatR(cell.ci[0])}, ${formatR(cell.ci[1])}]` : '')
                              : 'Sin datos suficientes'
                          }
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold" style={{ color: heatTextColor(cell.r) }}>
                              {formatR(cell.r)}
                            </span>
                            <span className="text-[10px]" style={{ color: heatTextColor(cell.r) }}>
                              {cell.n >= 6 ? strengthLabel(cell.r) : 'N/A'}
                            </span>
                          </div>
                          <div className="text-[10px]" style={{ color: heatTextColor(cell.r) }}>
                            {cell.n >= 6
                              ? `p=${Number.isFinite(cell.p) ? cell.p.toFixed(3) : 'N/A'} • n=${cell.n}`
                              : 'n<6'}
                          </div>
                          {cell.ci && (
                            <div className="text-[10px]" style={{ color: heatTextColor(cell.r) }}>
                              IC95% [{formatR(cell.ci[0])}, {formatR(cell.ci[1])}]
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">1 vs conjunto</p>
              <p className="text-sm text-slate-700">Cada línea vs la suma de las otras tres.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {oneVsAll.map((item) => (
              <div key={item.line} className="p-3 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                <p className="text-xs uppercase text-slate-500">{item.line}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatR(item.r)} {item.ci ? <span className="text-xs text-slate-600">IC95% [{formatR(item.ci[0])}, {formatR(item.ci[1])}]</span> : null}
                </p>
                <p className="text-sm text-slate-700">p={Number.isFinite(item.p) ? item.p.toFixed(3) : 'N/A'} • n={item.n}</p>
                <p className="text-xs text-slate-600 mt-1">{interpretLineText(item.line, metric, item.r, item.p, item.n)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs uppercase text-slate-500">Modelo de regresión: independencia y solvencia de Autos</p>
            <h4 className="text-base font-semibold text-slate-900">Coeficientes β editables y R²</h4>
            <p className="text-sm text-slate-600">
              Ajusta los dummies por categoría y obtén una conclusión automática sobre el peso de Autos frente al resto.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
            Conclusión automática y tabla resumen
          </span>
        </div>
        <RegressionComparisonModule records={records} />
      </div>

      <Modal open={openModal} title="Metodología de correlación" onClose={() => setOpenModal(false)}>
        <div className="space-y-2 text-sm text-slate-700">
          <p>r de Pearson (−1 a 1). Positivo: co-movimiento; negativo: movimiento opuesto; 0: independencia lineal.</p>
          <p>
            La correlación se calcula sobre la serie mensual de la métrica seleccionada (suma por mes y línea). El p-value evalúa
            la hipótesis nula r=0. IC95% opcional por bootstrap (B=2,000) remuestreando parejas (Xi, Yi).
          </p>
          <p>Se alinean solo los meses comunes; si n_meses &lt; 6 se devuelve N/A y no se calcula el intervalo.</p>
          <p className="text-xs text-slate-500">{FOOTER_TEXT}</p>
        </div>
      </Modal>
    </div>
  );
};

export default LineCorrelationPanel;
