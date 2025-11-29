import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  ClipboardCopy,
  Download,
  Info,
  Save,
  Search,
  AlertTriangle,
  Layers,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CORE_LINES,
  aggregateVentaAnual,
  buildPriorityModel,
  deriveMetasFromData,
  exportCsv,
  formatPercentage,
  priorityLabel,
  scenarioRowsFromLineResults,
  summarizeDiff,
} from '../../utils/countingModel.js';

const defaultExposure = { 2022: 1, 2023: 1, 2024: 1 };

const ScenarioSlider = ({ label, value, onChange, min, max, step, suffix = '' }) => (
  <label className="flex flex-col gap-1 text-sm text-slate-700">
    <div className="flex items-center justify-between">
      <span className="font-medium">{label}</span>
      <span className="text-slate-500 text-xs">{value}{suffix}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="accent-black"
    />
  </label>
);

const Pill = ({ children }) => (
  <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
    {children}
  </span>
);

const formatProbDisplay = (prob) => {
  if (prob >= 0.999) return '≥ 99.9%';
  if (prob < 0.001) return '< 0.1%';
  if (prob < 0.1) return `${(prob * 100).toFixed(2)}%`;
  return `${(prob * 100).toFixed(1)}%`;
};

const formatMedianDisplay = (value) => {
  const rounded = Number((value * 100).toFixed(1));
  if (rounded === 0 && value >= 0) return '≈0%';
  return `${rounded}%`;
};

const quartileTooltip = (q1, q3) =>
  `Mediana P y rango intercuartil [${(q1 * 100).toFixed(1)}% – ${(q3 * 100).toFixed(1)}%]`;

const safeExposure = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 1;
};

const sanitizeExposure = (raw = {}) => ({
  2022: safeExposure(raw[2022] ?? 1),
  2023: safeExposure(raw[2023] ?? 1),
  2024: safeExposure(raw[2024] ?? 1),
});

const scenarioName = (label, horizon, umbralA, umbralB, family) =>
  `${label}: E=${horizon.toFixed(2)}, A=${umbralA.toFixed(2)}, B=${umbralB.toFixed(2)}, ${family}`;

const prepareMetasForScenario = (metas, kByLinea = {}) =>
  metas.map((meta) => ({ ...meta, k: kByLinea[meta.linea] ?? meta.k }));

const scenarioConfigFromState = ({ metas, exposure, horizon, umbralA, umbralB, family, lambdaScale, kShift }, label) => ({
  name: scenarioName(label, horizon, umbralA, umbralB, family),
  kByLinea: Object.fromEntries(metas.map((meta) => [meta.linea, meta.k])),
  exposicion: exposure,
  familyMode: family,
  thresholds: { A: umbralA, B: umbralB },
  horizon,
  lambdaScale,
  kShift,
});

const buildScenarioResult = (config, metas, ventasAnuales) => {
  const metasForScenario = prepareMetasForScenario(metas, config.kByLinea || {});
  const result = buildPriorityModel({
    ventasAnuales,
    metas: metasForScenario,
    exposicion: sanitizeExposure(config.exposicion || {}),
    horizon: config.horizon ?? 1,
    thresholds: { a: config.thresholds?.A ?? 0.6, b: config.thresholds?.B ?? 0.35 },
    family: config.familyMode || 'auto',
    lambdaScale: config.lambdaScale ?? 1,
    kShift: config.kShift ?? 0,
  });

  return {
    name: config.name || 'Escenario',
    config,
    lineResults: result.lineResults,
    rows: scenarioRowsFromLineResults(result.lineResults),
  };
};

const ChartBar = ({ label, value, color, maxValue = 1 }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs text-slate-600">
      <span className="font-semibold text-slate-800">{label}</span>
      <span>{formatPercentage(value)}</span>
    </div>
    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={color}
        style={{ width: `${Math.min(100, (value / maxValue) * 100)}%` }}
      />
    </div>
  </div>
);

  const PrecisionBadge = ({ level }) => {
    const colors = {
      Alta: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Media: 'bg-amber-50 text-amber-700 border-amber-200',
      Baja: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    const label = level || 'Baja';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold ${colors[label] || colors.Baja}`}
        title="Regla: Alta si ΣE ≥ 3 y λ̂ ≥ 5; Media si ΣE ∈ [2,3) o λ̂ ∈ [2,5); Baja en caso contrario"
      >
        Precisión {label}
      </span>
    );
  };

const ProbabilityCell = ({ entry }) => {
  const warning = entry.overconfident && entry.exposureUsada < 3;
  const errorText = entry.familia === 'negbin' && entry.errorMargin
    ? ` ± ${(entry.errorMargin * 100).toFixed(entry.prob < 0.1 ? 2 : 1)}%`
    : '';
  const tooltip = entry.overconfident
    ? 'Alta certeza por λ≫k'
    : entry.prob < 0.001
    ? 'Baja probabilidad por k alto respecto a λ̂ y horizonte E'
    : entry.familia === 'negbin'
    ? 'NB con banda de error por momentos'
    : 'Poisson con exposición';
  return (
    <div className="flex items-center justify-end gap-2">
      {warning && <AlertTriangle size={14} className="text-amber-500" title="Historial corto (&lt;3 años efectivos)" />}
      <div className="text-right">
        <span className="font-semibold text-slate-900" title={tooltip}>
          {formatProbDisplay(entry.prob)}
        </span>
        {errorText && <span className="text-slate-500 text-xs">{errorText}</span>}
        {Number.isFinite(entry.deltaProb) && (
          <div className="text-[11px] text-slate-500" title="Comparación vs escenario A">
            ΔP {entry.deltaProb >= 0 ? '+' : ''}{(entry.deltaProb * 100).toFixed(1)} pp
          </div>
        )}
      </div>
      <PrecisionBadge level={entry.precisionLevel} />
    </div>
  );
};

const PriorityBar = ({ entry, maxValue }) => {
  const badge = priorityLabel(entry.segmento);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="font-semibold text-slate-800 flex items-center gap-2">
          {entry.vendedor}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${badge.color}`}
            title={`Segmento ${entry.segmento}`}
          >
            {badge.label}
          </span>
        </span>
        <span title="0.60·P + 0.25·MargenRel + 0.15·(1−Variab)">{entry.priority.toFixed(3)}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden" title="0.60P + 0.25MargenRel + 0.15(1−Variab)">
        <div
          className="h-full bg-violet-500"
          style={{ width: `${Math.min(100, (entry.priority / maxValue) * 100)}%` }}
        />
      </div>
    </div>
  );
};

const PriorityRow = ({ entry }) => {
  const badge = priorityLabel(entry.segmento);
  return (
    <tr className="hover:bg-slate-50 text-sm">
      <td className="px-3 py-2 font-semibold text-slate-900 flex items-center gap-2">
        <button
          type="button"
          onClick={entry.onPin}
          className={`text-slate-400 hover:text-slate-900 ${entry.pinned ? 'text-slate-900' : ''}`}
          title={entry.pinned ? 'Desanclar' : 'Fijar (📌 Pinned)'}
        >
          📌
        </button>
        {entry.vendedor}
      </td>
      <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px]"
          title="Auto decide con σ² vs μ (usa NB si Var(X) > Media(X)); también puedes forzar Poisson o NB"
        >
          {entry.modeloLabel}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{entry.lambda.toFixed(2)}</td>
      <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{entry.exposureUsada.toFixed(2)}</td>
        <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{entry.kTarget}</td>
        <td className="px-3 py-2 text-right text-slate-700"><ProbabilityCell entry={entry} /></td>
        <td className="px-3 py-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${badge.color}`}>
            {badge.label}
          </span>
          {entry.baselineSegment && entry.baselineSegment !== entry.segmento && (
            <div className="text-[11px] text-slate-500">{entry.baselineSegment} → {entry.segmento}</div>
          )}
        </td>
        <td className="px-3 py-2 text-right text-slate-900 font-semibold font-mono tabular-nums">
          {entry.priority.toFixed(3)}
          {Number.isFinite(entry.deltaPriority) && (
            <div className="text-[11px] text-slate-500" title="Comparación vs escenario A">
              Δ {entry.deltaPriority >= 0 ? '+' : ''}{entry.deltaPriority.toFixed(3)}
            </div>
          )}
        </td>
      </tr>
    );
  };

const SegmentStack = ({ item, formatMedianDisplay, quartileTooltip }) => (
  <div className="space-y-2 p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
      <span>{item.linea}</span>
      <span className="text-xs text-slate-500 flex items-center gap-1" title={quartileTooltip(item.q1, item.q3)}>
        Mediana P
        <span className="h-3 w-[1px] bg-celeste-500 inline-block" title="Mediana P" />
        {formatMedianDisplay(item.median)}
      </span>
    </div>
    <div className="h-4 rounded-full bg-slate-100 overflow-hidden flex relative">
      <div className="bg-emerald-500/80" style={{ width: `${item.A * 100}%` }} title="Segmento A" />
      <div className="bg-amber-400/80" style={{ width: `${item.B * 100}%` }} title="Segmento B" />
      <div className="bg-rose-400/80" style={{ width: `${item.C * 100}%` }} title="Segmento C" />
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-celeste-500"
        style={{ left: `${item.median * 100}%` }}
        title="Mediana de P"
      />
    </div>
    <div className="flex justify-between text-[11px] text-slate-600">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />A: {formatPercentage(item.A)}</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />B: {formatPercentage(item.B)}</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />C: {formatPercentage(item.C)}</span>
    </div>
  </div>
);

const downloadCsv = (entries) => {
  const csv = exportCsv(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'prioridad_operativa.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const copyTable = (tableSummary) => {
  const lines = ['Linea | # Vendedores | % Vend. | Mediana P | IQR | % Ventas | % Margen'];
  lines.push('---|---|---|---|---|---|---');
  tableSummary.forEach((row) => {
    lines.push(
      `${row.linea} | ${row.nVendedores} | ${formatPercentage(row.pctVendedores)} | ${formatPercentage(row.median)} | ${row.iqr.toFixed(3)} | ${formatPercentage(row.pctVentas)} | ${formatPercentage(row.pctMargen)}`,
    );
  });
  navigator.clipboard.writeText(lines.join('\n'));
};

const exportImages = (lineEntries, stackedSegments) => {
  const apaFooter = 'Estimación Poisson/NB con exposición. Fuente: 2022–2024. Elaboración propia.';
  const createCanvasDownload = (title, bars) => {
    if (!bars.length) return;
    const width = 640;
    const height = 360;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(title, 24, 32);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('0.60·P + 0.25·MargenRel + 0.15·(1−Variab)', 24, 50);

    const maxValue = Math.max(...bars.map((bar) => bar.value), 0.0001);
    bars.forEach((bar, idx) => {
      const y = 70 + idx * 28;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(24, y, width - 48, 18);
      ctx.fillStyle = bar.color;
      ctx.fillRect(24, y, ((width - 48) * bar.value) / maxValue, 18);
      ctx.fillStyle = '#0f172a';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(bar.label, 28, y + 13);
      ctx.fillText(`${(bar.value * 100).toFixed(1)}%`, width - 120, y + 13);
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(apaFooter, 24, height - 16);

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_').toLowerCase()}.png`;
    link.click();
  };

  const formatMedianForExport = (value) => {
    const rounded = Number((value * 100).toFixed(1));
    return rounded === 0 && value > 0 ? '≈0%' : `${rounded}%`;
  };

  createCanvasDownload(
    'Figura 3.1 - Probabilidad por vendedor',
    lineEntries.slice(0, 15).map((entry) => ({ label: entry.vendedor, value: entry.prob, color: '#0ea5e9' })),
  );

  if (stackedSegments.length) {
    const width = 640;
    const height = 360;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('Figura 3.2 - Segmentos A/B/C por línea', 24, 32);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Mediana de P indicada con línea vertical', 24, 52);

    stackedSegments.forEach((item, idx) => {
      const y = 70 + idx * 50;
      const barWidth = width - 120;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(80, y, barWidth, 26);

      const segments = [
        { value: item.A, color: '#10b981', label: `A ${formatPercentage(item.A)}` },
        { value: item.B, color: '#f59e0b', label: `B ${formatPercentage(item.B)}` },
        { value: item.C, color: '#f43f5e', label: `C ${formatPercentage(item.C)}` },
      ];
      let offset = 80;
      segments.forEach((seg) => {
        const w = barWidth * seg.value;
        ctx.fillStyle = seg.color;
        ctx.fillRect(offset, y, w, 26);
        offset += w;
      });

      const medianX = 80 + barWidth * item.median;
      ctx.strokeStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.moveTo(medianX, y);
      ctx.lineTo(medianX, y + 26);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(item.linea, 24, y + 17);
      ctx.fillText(`Mediana P: ${formatMedianForExport(item.median)}`, width - 220, y + 17);
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(apaFooter, 24, height - 16);

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = 'figura_3_2_segmentos.png';
    link.click();
  }

  createCanvasDownload(
    'Figura 3.3 - Índice de prioridad',
    lineEntries
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 15)
      .map((entry) => ({ label: entry.vendedor, value: entry.priority, color: '#8b5cf6' })),
  );
};

const CountingExposurePanel = ({ records = [] }) => {
  const ventasAnuales = useMemo(() => aggregateVentaAnual(records), [records]);
  const metasBase = useMemo(() => deriveMetasFromData(ventasAnuales), [ventasAnuales]);
  const [metas, setMetas] = useState(metasBase);
  const [selectedLine, setSelectedLine] = useState('Automóviles');
  const [family, setFamily] = useState('auto');
  const [horizon, setHorizon] = useState(1);
  const [umbralA, setUmbralA] = useState(0.6);
  const [umbralB, setUmbralB] = useState(0.35);
  const [lambdaScale, setLambdaScale] = useState(1);
  const [kShift, setKShift] = useState(0);
  const [exposure, setExposure] = useState(defaultExposure);
  const [segmentFilters, setSegmentFilters] = useState({ A: true, B: true, C: true });
  const [search, setSearch] = useState('');
  const [pinned, setPinned] = useState([]);
  const [scenarioA, setScenarioA] = useState(null);
  const [scenarioB, setScenarioB] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const scenarioDiff = useMemo(
    () => (scenarioA && scenarioB ? summarizeDiff(scenarioA.rows, scenarioB.rows) : null),
    [scenarioA, scenarioB],
  );
  const scenarioDiffRows = useMemo(
    () => (scenarioDiff ? scenarioDiff.diffEntries.slice().sort((a, b) => b.dIndice - a.dIndice) : []),
    [scenarioDiff],
  );
  const deltaClass = (value) => {
    if (value > 0.05) return 'text-emerald-600';
    if (value < -0.05) return 'text-rose-600';
    return 'text-slate-700';
  };

  useEffect(() => {
    setMetas(metasBase);
  }, [metasBase]);

  useEffect(() => {
    if (umbralB >= umbralA) {
      setUmbralB(Math.max(0, umbralA - 0.01));
    }
  }, [umbralA, umbralB]);

  const results = useMemo(
    () =>
      buildPriorityModel({
        ventasAnuales,
        metas,
        exposicion: exposure,
        horizon,
        thresholds: { a: umbralA, b: umbralB },
        family,
        lambdaScale,
        kShift,
      }),
    [ventasAnuales, metas, exposure, horizon, umbralA, umbralB, family, lambdaScale, kShift],
  );

  const currentLine = results.lineResults.find((line) => line.linea === selectedLine);
  const currentMeta = metas.find((meta) => meta.linea === selectedLine);
  const vendorKey = (linea, vendedor) => `${linea}-${vendedor}`;
  const scenarioAMap = useMemo(() => {
    if (!scenarioA?.rows?.length) return null;
    return new Map(scenarioA.rows.map((row) => [vendorKey(row.linea, row.vendedor), row]));
  }, [scenarioA]);
  const filteredEntries = useMemo(() => {
    const base = currentLine?.entries || [];
    const filtered = base
      .filter(
        (entry) => segmentFilters[entry.segmento] && entry.vendedor.toLowerCase().includes(search.toLowerCase()),
      )
      .map((entry) => {
        const key = vendorKey(entry.linea, entry.vendedor);
        const baseline = compareMode && scenarioAMap ? scenarioAMap.get(key) || null : null;
        return {
          ...entry,
          pinned: pinned.includes(key),
          onPin: () => togglePin(entry.linea, entry.vendedor),
          deltaProb: baseline ? entry.prob - baseline.P : null,
          deltaPriority: baseline ? entry.priority - baseline.indice : null,
          baselineSegment: baseline?.segmento || baseline?.segA,
        };
      });
    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.priority - a.priority;
    });
  }, [currentLine, search, segmentFilters, pinned, compareMode, scenarioA, selectedLine]);
  const tableTotals = useMemo(() => {
    const ventas = results.tableSummary.reduce((acc, row) => acc + row.pctVentas, 0);
    const margen = results.tableSummary.reduce((acc, row) => acc + row.pctMargen, 0);
    return { ventas, margen };
  }, [results.tableSummary]);

  const updateMeta = (linea, key, value) => {
    setMetas((prev) => prev.map((meta) => (meta.linea === linea ? { ...meta, [key]: value } : meta)));
  };

  const resetScenarios = () => {
    setLambdaScale(1);
    setKShift(0);
    setHorizon(1);
  };

  const toggleSegment = (seg) => {
    setSegmentFilters((prev) => ({ ...prev, [seg]: !prev[seg] }));
  };

  const togglePin = (linea, vendedor) => {
    const key = vendorKey(linea, vendedor);
    setPinned((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const captureScenarioSlot = (slot) => {
    const config = scenarioConfigFromState(
      { metas, exposure: sanitizeExposure(exposure), horizon, umbralA, umbralB, family, lambdaScale, kShift },
      slot,
    );
    const scenario = buildScenarioResult(config, metas, ventasAnuales);
    if (slot === 'A') {
      setScenarioA(scenario);
      setCompareMode(false);
    } else {
      setScenarioB(scenario);
    }
  };

  const loadScenarioConfig = (config) => {
    const normalized = {
      name: config.name || 'Escenario cargado',
      kByLinea: config.kByLinea || config.k || {},
      exposicion: config.exposicion || config.exposure || {},
      familyMode: config.familyMode || config.family || 'auto',
      thresholds: {
        A: config.thresholds?.A ?? config.umbralA ?? 0.6,
        B: config.thresholds?.B ?? config.umbralB ?? 0.35,
      },
      horizon: config.horizon ?? config.E ?? 1,
      lambdaScale: config.lambdaScale ?? 1,
      kShift: config.kShift ?? 0,
    };
    const scenario = buildScenarioResult(normalized, metas, ventasAnuales);
    setScenarioB(scenario);
  };

  const handleLoadScenario = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        loadScenarioConfig(parsed);
      } catch (err) {
        console.error('No se pudo cargar el escenario', err);
      }
    };
    reader.readAsText(file);
  };

  const saveScenario = () => {
    const payload = scenarioConfigFromState(
      { metas, exposure: sanitizeExposure(exposure), horizon, umbralA, umbralB, family, lambdaScale, kShift },
      'Escenario',
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'escenario_conteo_exposicion.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="card border border-slate-200 shadow-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Nueva vista</p>
            <h2 className="text-2xl font-semibold text-slate-900">Modelo de conteo con exposición</h2>
            <p className="text-sm text-slate-600 max-w-3xl">
              Calcula P(X ≥ k) por vendedor dentro de cada línea (Autos, Vans, Camiones, Buses) usando Poisson o Negativa
              Binomial con exposición anual (E). Segmentar A/B/C, estimar el Índice de Prioridad Operativa y exportar Tabla
              3.1 y Figuras 3.1–3.3 para discusión en clase.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
              <Layers size={16} /> Sin reasignación entre líneas
            </div>
            <p className="text-xs text-slate-600 max-w-xs text-right">
              Estimación de P(X ≥ k) por vendedor con Poisson (o NB si hay sobredispersión) y exposición anual. Segmentos A/B/C y
              PriorityIndex integran probabilidad, margen relativo y riesgo por línea.
            </p>
            <Pill>E = {horizon.toFixed(2)} años</Pill>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <Activity size={18} />
            </div>
            <div className="text-sm text-slate-700">
              <p className="text-xs uppercase text-slate-500">Probabilidad con exposición</p>
              <p className="font-semibold">Poisson o NB según sobredispersión</p>
              <p>Diagnóstico σ² vs μ y cálculo de P(X ≥ k) con E definido.</p>
            </div>
          </div>
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <BarChart3 size={18} />
            </div>
            <div className="text-sm text-slate-700">
              <p className="text-xs uppercase text-slate-500">Segmentación A/B/C</p>
              <p className="font-semibold">Umbrales configurables</p>
              <p>Clasificación directa por probabilidad de cumplimiento.</p>
            </div>
          </div>
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <Info size={18} />
            </div>
            <div className="text-sm text-slate-700">
              <p className="text-xs uppercase text-slate-500">Índice de Prioridad</p>
              <p className="font-semibold">0.60·P + 0.25·MargenRel + 0.15·(1-Variab)</p>
              <p>Resume riesgo, margen relativo y variabilidad por línea.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div className="card border border-slate-200 shadow-md">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {CORE_LINES.map((line) => (
                <option key={line}>{line}</option>
              ))}
            </select>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="auto">Familia: Auto (σ² vs μ)</option>
              <option value="poisson">Forzar Poisson</option>
              <option value="negbin">Forzar NegBin</option>
            </select>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <label className="font-medium">E (años)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={horizon}
                onChange={(e) => setHorizon(Math.max(0.1, Number(e.target.value)))}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <label className="font-medium">Umbral A</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={umbralA}
                onChange={(e) => setUmbralA(Math.min(1, Math.max(0, Number(e.target.value))))}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1"
              />
              <label className="font-medium">Umbral B</label>
              <input
                type="number"
                min="0"
                max={umbralA}
                step="0.01"
                value={umbralB}
                onChange={(e) => setUmbralB(Math.min(umbralA - 0.01, Math.max(0, Number(e.target.value))))}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setUmbralA(0.6);
                setUmbralB(0.35);
                setFamily('auto');
              }}
              className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-slate-200 text-slate-700"
            >
              <RefreshCw size={14} /> Valores curso
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                <ArrowUpRight size={16} />
              </div>
              <div className="text-sm text-slate-700">
                <p className="font-semibold">Meta k{currentMeta ? ` (${selectedLine})` : ''}</p>
                <p className="text-slate-600">Ajusta la meta anual de unidades para esta línea.</p>
                <input
                  type="number"
                  min="0"
                  value={currentMeta?.k ?? 0}
                  onChange={(e) => updateMeta(selectedLine, 'k', Number(e.target.value))}
                  className="mt-2 w-32 rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                <SlidersHorizontal size={16} />
              </div>
              <div className="text-sm text-slate-700 space-y-1">
                <p className="font-semibold">Exposición por año (E=1.0)</p>
                <div className="flex gap-2 flex-wrap text-xs">
                  {Object.entries(exposure).map(([year, value]) => (
                    <label key={year} className="flex items-center gap-1">
                      <span className="text-slate-500">{year}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={value}
                        onChange={(e) =>
                          setExposure((prev) => ({ ...prev, [year]: Math.max(0, Number(e.target.value)) }))
                        }
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScenarioSlider label="Escenario λ (±50%)" value={lambdaScale} onChange={setLambdaScale} min={0.5} max={1.5} step={0.05} />
            <ScenarioSlider label="Ajuste k (±3)" value={kShift} onChange={setKShift} min={-3} max={3} step={1} suffix=" u." />
            <ScenarioSlider label="Horizonte E (años)" value={horizon} onChange={setHorizon} min={0.5} max={2} step={0.1} />
          </div>
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={resetScenarios}
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full border border-slate-200 text-slate-700"
            >
              <RefreshCw size={14} /> Reset escenarios
            </button>
          </div>
        </div>

        <div className="card border border-slate-200 shadow-md space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase text-slate-500">Nota metodológica</p>
              <h3 className="text-base font-semibold text-slate-900">Poisson / NegBin con exposición</h3>
            </div>
            <AlertCircle className="text-slate-400" size={20} />
          </div>
          <p className="text-sm text-slate-700">
            P(X ≥ k) se estima con Poisson (o NB si hay sobredispersión). λ̂ = Σ ventas / Σ exposición; NB usa método de momentos
            (r̂, p̂). Segmentos: A ≥ {formatPercentage(umbralA)}, B entre {formatPercentage(umbralB)} y {formatPercentage(umbralA)}.
            Índice de Prioridad = 0.60·P + 0.25·MargenRelℓ + 0.15·(1−Variabℓ). Exporta Tabla 3.1 y Figuras 3.1–3.3.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <Pill>E=1.0 por defecto</Pill>
            <Pill>Sin reasignación entre líneas</Pill>
            <Pill>Períodos 2022–2024</Pill>
          </div>
        </div>
      </div>

        <div className="card border border-slate-200 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] uppercase text-slate-500">Resultados por línea</p>
              <h3 className="text-lg font-semibold text-slate-900">Prioridad operativa — {selectedLine}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadCsv(filteredEntries)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => copyTable(results.tableSummary)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
            >
              <ClipboardCopy size={16} /> Copiar Tabla 3.1
            </button>
            <button
              type="button"
              onClick={() => exportImages(currentLine?.entries || [], results.stackedSegments)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
            >
              <Download size={16} /> PNG Fig. 3.1–3.3
            </button>
            <button
              type="button"
              onClick={saveScenario}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
            >
              <Save size={16} /> Guardar escenario
            </button>
            <button
              type="button"
              onClick={() => captureScenarioSlot('A')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
            >
              <Save size={16} /> Guardar escenario A (comparar)
            </button>
            <button
              type="button"
              onClick={() => captureScenarioSlot('B')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
            >
              <Save size={16} /> Guardar escenario B (comparar)
            </button>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 cursor-pointer">
              <Download size={16} /> Cargar escenario en B
              <input type="file" accept="application/json" className="hidden" onChange={handleLoadScenario} />
            </label>
            <button
              type="button"
              disabled={!scenarioA}
              onClick={() => setCompareMode((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 disabled:opacity-50"
              title="Resalta cambios de P, segmento e índice frente al escenario A guardado"
            >
              <RefreshCw size={16} /> {compareMode ? 'Salir de comparación' : 'Comparar con A en la tabla'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-600">Filtro rápido:</span>
              {['A', 'B', 'C'].map((seg) => {
                const colors = {
                  A: segmentFilters[seg]
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-emerald-700 border-emerald-200',
                  B: segmentFilters[seg]
                    ? 'bg-amber-400 text-white border-amber-400'
                    : 'bg-white text-amber-700 border-amber-200',
                  C: segmentFilters[seg]
                    ? 'bg-rose-400 text-white border-rose-400'
                    : 'bg-white text-rose-700 border-rose-200',
                };
                return (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => toggleSegment(seg)}
                    className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${
                      colors[seg] || 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {seg}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-600">Mostrando {filteredEntries.length}/{currentLine?.entries?.length || 0}</span>
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar vendedor"
                  className="focus:outline-none"
                />
              </label>
            </div>
          </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-[0.08em]">
              <tr>
                <th className="px-3 py-3 text-left">Vendedor</th>
                <th className="px-3 py-3 text-right">Familia</th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    Tasa λ̂ (ventas/año)
                    <Info size={12} className="text-slate-400" title="λ̂ = Σ ventas / Σ exposición" />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    Exposición ΣE
                    <Info size={12} className="text-slate-400" title="Años efectivos considerados" />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    k meta (unid/año)
                    <Info size={12} className="text-slate-400" title="Meta anual definida para la línea" />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    Prob. de cumplir la meta
                    <Info
                      size={12}
                      className="text-slate-400"
                      title="Poisson o NB con exposición; si NB muestra banda de error"
                    />
                  </span>
                </th>
                <th className="px-3 py-3 text-left">Segmento</th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    Índice
                    <Info
                      size={12}
                      className="text-slate-400"
                      title="0.60·P + 0.25·MargenRel + 0.15·(1−Variab)"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredEntries.length ? (
                filteredEntries.map((entry) => (
                  <PriorityRow key={`${entry.vendedor}-${entry.linea}`} entry={entry} />
                ))
              ) : (
                <tr>
                  <td className="px-3 py-3" colSpan={8}>
                    <p className="text-sm text-slate-600">No hay datos cargados para esta línea.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 items-start">
        <div className="card border border-slate-200 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase text-slate-500">Tabla 3.1</p>
              <h4 className="text-base font-semibold text-slate-900">Segmentación y distribución por línea</h4>
            </div>
            <Pill>Mediana + IQR</Pill>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-[0.08em]">
                <tr>
                  <th className="px-3 py-3 text-left">Línea</th>
                  <th className="px-3 py-3 text-right"># Vend.</th>
                  <th className="px-3 py-3 text-right">% Vend.</th>
                  <th className="px-3 py-3 text-right">Mediana P</th>
                  <th className="px-3 py-3 text-right">IQR</th>
                  <th className="px-3 py-3 text-right">% Ventas</th>
                  <th className="px-3 py-3 text-right">% Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {results.tableSummary.map((row) => (
                  <tr key={row.linea} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.linea}</td>
                    <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{row.nVendedores}</td>
                    <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{formatPercentage(row.pctVendedores)}</td>
                    <td
                      className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums"
                      title={quartileTooltip(row.q1, row.q3)}
                    >
                      {formatMedianDisplay(row.median)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{row.iqr.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{formatPercentage(row.pctVentas)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">{formatPercentage(row.pctMargen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Totales: ventas ≈100%, margen ≈100% (redondeo).
          </p>
        </div>

        <div className="space-y-3">
          <div className="card border border-slate-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] uppercase text-slate-500">Figura 3.1</p>
                <h4 className="text-base font-semibold text-slate-900">P(X ≥ k) por vendedor</h4>
              </div>
              <Pill>Umbrales A/B/C</Pill>
            </div>
            <div className="space-y-2">
              {(currentLine?.entries || []).slice(0, 6).map((entry) => (
                <ChartBar key={entry.vendedor} label={entry.vendedor} value={entry.prob} color="h-3 bg-celeste-500" />
              ))}
              <p className="text-xs text-slate-500">Muestra top 6 por probabilidad. Descarga PNG para versión completa.</p>
            </div>
          </div>

          <div className="card border border-slate-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] uppercase text-slate-500">Figura 3.2</p>
                <h4 className="text-base font-semibold text-slate-900">Stack A/B/C por línea</h4>
              </div>
              <Pill>Segmentación</Pill>
            </div>
            <div className="space-y-2">
              {results.stackedSegments.map((item) => (
                <SegmentStack
                  key={item.linea}
                  item={item}
                  formatMedianDisplay={formatMedianDisplay}
                  quartileTooltip={quartileTooltip}
                />
              ))}
            </div>
          </div>

          <div className="card border border-slate-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] uppercase text-slate-500">Figura 3.3</p>
                <h4 className="text-base font-semibold text-slate-900">Ranking Índice de Prioridad</h4>
              </div>
              <Pill>0.60·P + 0.25·MargenRel + 0.15·(1−Variab)</Pill>
            </div>
            <div className="space-y-2">
              {(currentLine?.entries || [])
                .slice()
                .sort((a, b) => b.priority - a.priority)
                .slice(0, 6)
                .map((entry) => (
                  <PriorityBar
                    key={`${entry.vendedor}-prio`}
                    entry={entry}
                    maxValue={Math.max(...(currentLine?.entries || []).map((e) => e.priority), 1)}
                  />
                ))}
              <p className="text-xs text-slate-500">Ordenado de mayor a menor prioridad.</p>
            </div>
          </div>
        </div>
      </div>

      {scenarioDiff && (
        <div className="card border border-slate-200 shadow-md space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase text-slate-500">Comparador de escenarios A vs B</p>
              <h4 className="text-lg font-semibold text-slate-900">Movimientos de probabilidad, segmento e índice</h4>
              <p className="text-sm text-slate-600">
                Usa dos configuraciones (k, E, umbrales, familia) y resalta ΔP, ΔÍndice y cambios de segmento por vendedor.
              </p>
            </div>
            <div className="text-xs text-right text-slate-600">
              <div className="font-semibold text-slate-800">Escenario A: {scenarioA?.name || '—'}</div>
              <div className="font-semibold text-slate-800">Escenario B: {scenarioB?.name || '—'}</div>
              <div className="text-slate-500">Coincidencias: {scenarioDiffRows.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-[0.08em]">
                    <tr>
                      <th className="px-3 py-2 text-left">Línea</th>
                      <th className="px-3 py-2 text-right">%A → %B (A)</th>
                      <th className="px-3 py-2 text-right">%A → %B (B)</th>
                      <th className="px-3 py-2 text-right">ΔP prom.</th>
                      <th className="px-3 py-2 text-right">ΔÍndice prom.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {scenarioDiff.lineTotals.map((line) => (
                      <tr key={`line-${line.linea}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-900">{line.linea}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                          A {formatPercentage(line.segmentsA.A)} · B {formatPercentage(line.segmentsA.B)} · C {formatPercentage(line.segmentsA.C)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                          A {formatPercentage(line.segmentsB.A)} · B {formatPercentage(line.segmentsB.B)} · C {formatPercentage(line.segmentsB.C)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono tabular-nums ${deltaClass(line.avgDeltaP)}`}>
                          {(line.avgDeltaP * 100).toFixed(1)} pp
                        </td>
                        <td className={`px-3 py-2 text-right font-mono tabular-nums ${deltaClass(line.avgDeltaIndice)}`}>
                          {line.avgDeltaIndice.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-semibold text-slate-900">Movimientos de segmento (Sankey ligero)</h5>
                    <Pill>Conteo</Pill>
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    {Object.keys(scenarioDiff.transitionsByLine).length ? (
                      Object.entries(scenarioDiff.transitionsByLine).map(([linea, moves]) => (
                        <div key={`move-${linea}`} className="space-y-1">
                          <p className="font-semibold">{linea}</p>
                          {Object.entries(moves).map(([move, count]) => (
                            <div key={`${linea}-${move}`} className="flex items-center gap-2">
                              <span className="w-20 text-xs text-slate-600">{move}</span>
                              <div className="h-2 rounded-full bg-slate-100 flex-1 overflow-hidden">
                                <div
                                  className="h-full bg-violet-400"
                                  style={{ width: `${Math.min(100, count * 12)}%` }}
                                  title={`${count} movimientos ${move}`}
                                />
                              </div>
                              <span className="text-xs font-mono tabular-nums">{count}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">Sin movimientos detectados.</p>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-semibold text-slate-900">Histograma ΔP</h5>
                    <Pill>ΔP en puntos porcentuales</Pill>
                  </div>
                  <div className="space-y-1 text-xs text-slate-700">
                    {(() => {
                      const maxCount = Math.max(...scenarioDiff.histogramBuckets.map((b) => b.count), 1);
                      return scenarioDiff.histogramBuckets.map((bucket, idx) => (
                        <div key={`hist-${idx}`} className="flex items-center gap-2">
                          <span className="w-20 font-mono tabular-nums text-slate-600">
                            {(bucket.min * 100).toFixed(0)} to {(bucket.max * 100).toFixed(0)}
                          </span>
                          <div className="h-2 rounded-full bg-slate-100 flex-1 overflow-hidden">
                            <div
                              className="h-full bg-slate-500"
                              style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono tabular-nums">{bucket.count}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-slate-900">Top alzas de Índice</h5>
                  <Pill>Top 10 ↑</Pill>
                </div>
                <div className="space-y-1 text-sm text-slate-700">
                  {scenarioDiff.topIncreases.map((item) => (
                    <div key={`inc-${item.linea}-${item.vendedor}`} className="flex items-center justify-between">
                      <span className="font-semibold">{item.vendedor} ({item.linea})</span>
                      <span className="font-mono tabular-nums text-emerald-600">
                        +{item.dIndice.toFixed(3)} · ΔP {(item.dP * 100).toFixed(1)} pp
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-slate-900">Top caídas de Índice</h5>
                  <Pill>Top 10 ↓</Pill>
                </div>
                <div className="space-y-1 text-sm text-slate-700">
                  {scenarioDiff.topDrops.map((item) => (
                    <div key={`drop-${item.linea}-${item.vendedor}`} className="flex items-center justify-between">
                      <span className="font-semibold">{item.vendedor} ({item.linea})</span>
                      <span className="font-mono tabular-nums text-rose-600">
                        {item.dIndice.toFixed(3)} · ΔP {(item.dP * 100).toFixed(1)} pp
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-[0.08em]">
                <tr>
                  <th className="px-3 py-3 text-left">Vendedor</th>
                  <th className="px-3 py-3 text-left">Línea</th>
                  <th className="px-3 py-3 text-left">Segmento A</th>
                  <th className="px-3 py-3 text-left">Segmento B</th>
                  <th className="px-3 py-3 text-right">ΔP</th>
                  <th className="px-3 py-3 text-right">ΔÍndice</th>
                  <th className="px-3 py-3 text-right">Familia A/B</th>
                  <th className="px-3 py-3 text-right">Precisión B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {scenarioDiffRows.length ? (
                  scenarioDiffRows.map((row) => (
                    <tr key={`${row.linea}-${row.vendedor}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-900">{row.vendedor}</td>
                      <td className="px-3 py-2 text-slate-700">{row.linea}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${priorityLabel(row.segA).color}`}>
                          {priorityLabel(row.segA).label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${priorityLabel(row.segB).color}`}>
                          {priorityLabel(row.segB).label}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono tabular-nums ${deltaClass(row.dP)}`}>
                        {(row.dP * 100).toFixed(1)} pp
                      </td>
                      <td className={`px-3 py-2 text-right font-mono tabular-nums ${deltaClass(row.dIndice)}`}>
                        {row.dIndice >= 0 ? '+' : ''}{row.dIndice.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 font-mono tabular-nums">
                        {row.famA} → {row.famB}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        <PrecisionBadge level={row.precisionB} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-3" colSpan={8}>
                      <p className="text-sm text-slate-600">Guarda los escenarios A y B para ver la comparación.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountingExposurePanel;
