import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  ClipboardCopy,
  Download,
  Info,
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

const PriorityRow = ({ entry }) => {
  const badge = priorityLabel(entry.segmento);
  return (
    <tr className="hover:bg-slate-50 text-sm">
      <td className="px-3 py-2 font-semibold text-slate-900">{entry.vendedor}</td>
      <td className="px-3 py-2 text-right text-slate-700">{entry.lambda.toFixed(2)}</td>
      <td className="px-3 py-2 text-right text-slate-700">{entry.exposureUsada.toFixed(2)}</td>
      <td className="px-3 py-2 text-right text-slate-700">{entry.kTarget}</td>
      <td className="px-3 py-2 text-right text-slate-700">{formatPercentage(entry.prob)}</td>
      <td className="px-3 py-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${badge.color}`}>
          {badge.label}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-slate-900 font-semibold">{entry.priority.toFixed(3)}</td>
    </tr>
  );
};

const SegmentStack = ({ item }) => (
  <div className="space-y-2 p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
      <span>{item.linea}</span>
      <span className="text-xs text-slate-500">Mediana P: {formatPercentage(item.median)}</span>
    </div>
    <div className="h-4 rounded-full bg-slate-100 overflow-hidden flex">
      <div className="bg-emerald-500/80" style={{ width: `${item.A * 100}%` }} />
      <div className="bg-amber-400/80" style={{ width: `${item.B * 100}%` }} />
      <div className="bg-rose-400/80" style={{ width: `${item.C * 100}%` }} />
    </div>
    <div className="flex justify-between text-[11px] text-slate-600">
      <span>A: {formatPercentage(item.A)}</span>
      <span>B: {formatPercentage(item.B)}</span>
      <span>C: {formatPercentage(item.C)}</span>
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

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_').toLowerCase()}.png`;
    link.click();
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

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(item.linea, 24, y + 17);
      ctx.fillText(`Mediana P: ${formatPercentage(item.median)}`, width - 220, y + 17);
    });

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

  const updateMeta = (linea, key, value) => {
    setMetas((prev) => prev.map((meta) => (meta.linea === linea ? { ...meta, [key]: value } : meta)));
  };

  const resetScenarios = () => {
    setLambdaScale(1);
    setKShift(0);
    setHorizon(1);
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
              onClick={() => downloadCsv(currentLine?.entries || [])}
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
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-[0.08em]">
              <tr>
                <th className="px-3 py-3 text-left">Vendedor</th>
                <th className="px-3 py-3 text-right">λ̂</th>
                <th className="px-3 py-3 text-right">ΣE</th>
                <th className="px-3 py-3 text-right">k meta</th>
                <th className="px-3 py-3 text-right">P(X ≥ k)</th>
                <th className="px-3 py-3 text-left">Segmento</th>
                <th className="px-3 py-3 text-right">Índice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {currentLine?.entries.map((entry) => (
                <PriorityRow key={`${entry.vendedor}-${entry.linea}`} entry={entry} />
              )) || (
                <tr>
                  <td className="px-3 py-3" colSpan={7}>
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
                    <td className="px-3 py-2 text-right text-slate-700">{row.nVendedores}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatPercentage(row.pctVendedores)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatPercentage(row.median)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.iqr.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatPercentage(row.pctVentas)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatPercentage(row.pctMargen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <SegmentStack key={item.linea} item={item} />
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
                  <ChartBar key={`${entry.vendedor}-prio`} label={entry.vendedor} value={entry.priority} color="h-3 bg-violet-500" maxValue={Math.max(...(currentLine?.entries || []).map((e) => e.priority), 1)} />
                ))}
              <p className="text-xs text-slate-500">Ordenado de mayor a menor prioridad.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountingExposurePanel;
