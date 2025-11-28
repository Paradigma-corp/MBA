import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const LINE_COLORS = {
  Automóviles: '#0ea5e9',
  Vans: '#f97316',
  Camiones: '#22c55e',
  Buses: '#a855f7',
};

const median = (values = []) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const quantile = (values = [], q) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
};

const normalCdf = (x) => {
  // Abramowitz & Stegun approximation for Φ(x)
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - prob : prob;
};

const computeOLS = (points) => {
  if (!points || points.length < 2) return null;
  const n = points.length;
  const meanX = points.reduce((acc, p) => acc + p.x, 0) / n;
  const meanY = points.reduce((acc, p) => acc + p.y, 0) / n;
  const sxx = points.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
  const syy = points.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);
  const sxy = points.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const r = sxy / Math.sqrt(sxx * syy);
  const r2 = r * r;
  const r2Adj = n > 2 ? 1 - (1 - r2) * ((n - 1) / (n - 2)) : r2;
  const residuals = points.map((p) => p.y - (intercept + slope * p.x));
  const sse = residuals.reduce((acc, rVal) => acc + rVal ** 2, 0);
  const mse = n > 2 ? sse / (n - 2) : undefined;
  const seSlope = mse && sxx ? Math.sqrt(mse / sxx) : undefined;
  const tStat = seSlope ? slope / seSlope : undefined;
  const pValue = tStat !== undefined ? 2 * (1 - normalCdf(Math.abs(tStat))) : undefined;
  const cook = mse
    ? points.map((p, idx) => {
        const leverage = 1 / n + ((p.x - meanX) ** 2) / sxx;
        return (residuals[idx] ** 2 / (2 * mse)) * (leverage / (1 - leverage) ** 2);
      })
    : [];

  return { slope, intercept, r, r2, r2Adj, residuals, cook, seSlope, pValue, mse, meanX, meanY, sxx };
};

const computeTheilSen = (points) => {
  if (!points || points.length < 2) return null;
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      if (dx === 0) continue;
      slopes.push((points[j].y - points[i].y) / dx);
    }
  }
  if (!slopes.length) return null;
  const slope = median(slopes);
  const intercept = median(points.map((p) => p.y - slope * p.x));
  return { slope, intercept };
};

const bootstrapBand = (points, model, iterations = 2000) => {
  if (!points || points.length < 3 || !model) return null;
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const preds = [];

  for (let i = 0; i < iterations; i++) {
    const sample = Array.from({ length: points.length }, () => points[Math.floor(Math.random() * points.length)]);
    const fitted = computeOLS(sample);
    const alt = computeTheilSen(sample);
    const useModel = model.type === 'theilsen' && alt ? alt : fitted;
    if (!useModel || useModel.slope === undefined) continue;
    const y1 = useModel.intercept + useModel.slope * minX;
    const y2 = useModel.intercept + useModel.slope * maxX;
    preds.push({ y1, y2 });
  }

  if (!preds.length) return null;
  return {
    x1: minX,
    x2: maxX,
    lowerY1: quantile(preds.map((p) => p.y1), 0.025),
    upperY1: quantile(preds.map((p) => p.y1), 0.975),
    lowerY2: quantile(preds.map((p) => p.y2), 0.025),
    upperY2: quantile(preds.map((p) => p.y2), 0.975),
    centerY1: quantile(preds.map((p) => p.y1), 0.5),
    centerY2: quantile(preds.map((p) => p.y2), 0.5),
  };
};

const numberFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const percentFmt = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 2,
  minimumFractionDigits: 1,
});
const currencyFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const sizeScale = (value, min, max) => {
  if (!Number.isFinite(value)) return 8;
  if (min === max) return 10;
  return 4 + ((value - min) / (max - min)) * 10;
};

const formatProbability = (value) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const pct = value * 100;
  if (pct < 0.1) return '< 0.1%';
  if (pct < 10) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
};

const ScatterPlot = ({ data }) => {
  const [selectedLines, setSelectedLines] = useState([]);
  const [excludeOutliers, setExcludeOutliers] = useState(false);
  const [useRobust, setUseRobust] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [perUnit, setPerUnit] = useState(false);
  const [showOutliers, setShowOutliers] = useState(false);
  const [incomeRange, setIncomeRange] = useState([undefined, undefined]);

  const basePoints = useMemo(() => {
    const points = [];
    data.forEach((cat) => {
      const line = cat.name || cat.businessLine || 'Categoría';
      if (Array.isArray(cat.records) && cat.records.length) {
        const vendorMap = cat.records.reduce((acc, rec) => {
          const vendedor = rec.vendedorSAP || rec.Vendedor || '—';
          if (!acc[vendedor]) acc[vendedor] = [];
          acc[vendedor].push(rec);
          return acc;
        }, {});
        Object.entries(vendorMap).forEach(([vendor, list]) => {
          const ingresoVals = list.map((item) => Number(item.ingresos) || 0);
          const margenVals = list.map((item) => Number(item.margen) || 0);
          const unitVals = list.map((item) => Number(item.unidades) || 0);
          const unitsTotal = unitVals.reduce((acc, val) => acc + val, 0) || list.length;
          const meanIngreso = ingresoVals.reduce((acc, val) => acc + val, 0) / (list.length || 1);
          const meanMargen = margenVals.reduce((acc, val) => acc + val, 0) / (list.length || 1);
          if (!Number.isFinite(meanIngreso) || !Number.isFinite(meanMargen)) return;
          points.push({
            x: meanIngreso,
            y: meanMargen,
            rawIngreso: meanIngreso,
            rawMargen: meanMargen,
            units: unitsTotal,
            line,
            label: vendor,
          });
        });
      } else {
        points.push({
          x: Number(cat.ingreso) || 0,
          y: Number(cat.margen) || 0,
          rawIngreso: Number(cat.ingreso) || 0,
          rawMargen: Number(cat.margen) || 0,
          units: cat.totalUnidades || cat.unidades || cat.n || 1,
          line,
          label: cat.name || line,
        });
      }
    });
    return points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }, [data]);

  const linesAvailable = useMemo(
    () => Array.from(new Set(basePoints.map((p) => p.line))),
    [basePoints],
  );

  useEffect(() => {
    if (linesAvailable.length && selectedLines.length === 0) {
      setSelectedLines(linesAvailable);
    }
  }, [linesAvailable, selectedLines.length]);

  const incomeDomain = useMemo(() => {
    if (!basePoints.length) return [0, 0];
    const xs = basePoints.map((p) => p.x);
    return [Math.min(...xs), Math.max(...xs)];
  }, [basePoints]);

  useEffect(() => {
    if (incomeDomain[0] !== undefined && incomeDomain[1] !== undefined) {
      setIncomeRange(incomeDomain);
    }
  }, [incomeDomain[0], incomeDomain[1]]);

  const filteredPoints = useMemo(() => {
    let pts = basePoints.filter((p) =>
      selectedLines.length ? selectedLines.includes(p.line) : true,
    );

    pts = pts.filter((p) => {
      const [minInc, maxInc] = incomeRange;
      const withinMin = minInc === undefined || p.x >= minInc;
      const withinMax = maxInc === undefined || p.x <= maxInc;
      return withinMin && withinMax;
    });

    const transformed = pts
      .map((p) => {
        const baseX = perUnit && p.units ? p.x / p.units : p.x;
        const baseY = perUnit && p.units ? p.y / p.units : p.y;
        if (logScale && baseX <= 0) return null;
        const xVal = logScale ? Math.log10(baseX) : baseX;
        const yVal = baseY;
        return {
          ...p,
          x: xVal,
          y: yVal,
          displayX: baseX,
          displayY: baseY,
        };
      })
      .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));

    if (!excludeOutliers || transformed.length < 4) return transformed;

    const meanX = transformed.reduce((acc, p) => acc + p.x, 0) / transformed.length;
    const meanY = transformed.reduce((acc, p) => acc + p.y, 0) / transformed.length;
    const stdX = Math.sqrt(
      transformed.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0) / (transformed.length - 1 || 1),
    );
    const stdY = Math.sqrt(
      transformed.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0) / (transformed.length - 1 || 1),
    );
    return transformed.filter((p) => {
      const zx = stdX ? Math.abs((p.x - meanX) / stdX) : 0;
      const zy = stdY ? Math.abs((p.y - meanY) / stdY) : 0;
      return zx <= 3 && zy <= 3;
    });
  }, [basePoints, excludeOutliers, incomeRange, logScale, perUnit, selectedLines]);

  const unitRange = useMemo(() => {
    if (!filteredPoints.length) return [1, 1];
    const vals = filteredPoints.map((p) => p.units || 1);
    return [Math.min(...vals), Math.max(...vals)];
  }, [filteredPoints]);

  const regression = useMemo(() => {
    if (!filteredPoints.length) return null;
    const baseModel = computeOLS(filteredPoints);
    const robustModel = computeTheilSen(filteredPoints);
    const correlationBits = baseModel
      ? { r: baseModel.r, r2: baseModel.r2, r2Adj: baseModel.r2Adj }
      : {};
    const chosen =
      useRobust && robustModel
        ? { ...robustModel, type: 'theilsen', ...correlationBits }
        : { ...baseModel, type: 'ols' };
    return chosen?.slope !== undefined ? chosen : null;
  }, [filteredPoints, useRobust]);

  const diagnostics = useMemo(() => {
    const ols = computeOLS(filteredPoints);
    if (!ols) return null;
    const cookScores = ols.cook || [];
    const sorted = cookScores
      .map((value, idx) => ({ value, idx }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return { ...ols, topCook: sorted };
  }, [filteredPoints]);

  const band = useMemo(
    () => bootstrapBand(filteredPoints, regression, 2000),
    [filteredPoints, regression],
  );

  const marginRate = useMemo(() => {
    const totalIngreso = filteredPoints.reduce((acc, p) => acc + p.displayX, 0);
    const totalMargen = filteredPoints.reduce((acc, p) => acc + p.displayY, 0);
    return totalIngreso > 0 ? totalMargen / totalIngreso : 0;
  }, [filteredPoints]);

  const marginPercentiles = useMemo(() => {
    const ys = filteredPoints.map((p) => p.displayY).filter((val) => Number.isFinite(val));
    return { p50: quantile(ys, 0.5), p75: quantile(ys, 0.75) };
  }, [filteredPoints]);

  const series = useMemo(() => {
    const grouped = new Map();
    filteredPoints.forEach((p) => {
      if (!grouped.has(p.line)) grouped.set(p.line, []);
      grouped.get(p.line).push({
        x: p.x,
        y: p.y,
        label: p.label,
        displayX: p.displayX,
        displayY: p.displayY,
        units: p.units,
        color: LINE_COLORS[p.line] || '#475569',
      });
    });
    return Array.from(grouped.entries()).map(([id, values]) => ({ id, data: values }));
  }, [filteredPoints]);

  const xLabel = `${perUnit ? 'Ingreso por unidad' : 'Ingreso promedio'} (USD)`;
  const yLabel = `${perUnit ? 'Margen por unidad' : 'Margen promedio'} (USD)`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center text-xs text-slate-600">
        <div className="flex flex-wrap gap-2 items-center">
          {linesAvailable.map((line) => (
            <label key={line} className="flex items-center gap-1">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={selectedLines.includes(line)}
                onChange={(e) =>
                  setSelectedLines((prev) =>
                    e.target.checked ? [...prev, line] : prev.filter((item) => item !== line),
                  )
                }
              />
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px]" style={{
                backgroundColor: `${(LINE_COLORS[line] || '#94a3b8')}1a`,
                color: LINE_COLORS[line] || '#475569',
                border: `1px solid ${(LINE_COLORS[line] || '#cbd5e1')}`,
              }}>
                {line}
              </span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={excludeOutliers}
              onChange={(e) => setExcludeOutliers(e.target.checked)}
            />
            <span>Excluir outliers (|z|&gt;3)</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={useRobust}
              onChange={(e) => setUseRobust(e.target.checked)}
            />
            <span>Regresión robusta (Theil–Sen)</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={logScale}
              onChange={(e) => setLogScale(e.target.checked)}
            />
            <span>Escala log en X</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={perUnit}
              onChange={(e) => setPerUnit(e.target.checked)}
            />
            <span>Promedios / por unidad</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-slate-500">Ingreso mín.</span>
            <input
              type="number"
              value={incomeRange[0] ?? ''}
              onChange={(e) =>
                setIncomeRange(([_, max]) => [e.target.value === '' ? undefined : Number(e.target.value), max])
              }
              className="w-28 rounded border border-slate-200 px-2 py-1 text-slate-700 text-xs"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-slate-500">Ingreso máx.</span>
            <input
              type="number"
              value={incomeRange[1] ?? ''}
              onChange={(e) =>
                setIncomeRange(([min]) => [min, e.target.value === '' ? undefined : Number(e.target.value)])
              }
              className="w-28 rounded border border-slate-200 px-2 py-1 text-slate-700 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowOutliers((prev) => !prev)}
            className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 bg-amber-50"
          >
            {showOutliers ? 'Ocultar outliers' : 'Ver outliers (Cook)'}
          </button>
        </div>
        <div className="ml-auto text-xs text-slate-500 font-medium">
          Banda: Predicción 95% • Bootstrap (B = 2,000)
        </div>
      </div>

      <div style={{ height: 380 }}>
        <ResponsiveScatterPlot
          data={series}
          colors={({ serie }) => LINE_COLORS[serie.id] || '#475569'}
          margin={{ top: 40, right: 80, bottom: 64, left: 76 }}
          xScale={{
            type: logScale ? 'log' : 'linear',
            min: 'auto',
            max: 'auto',
            base: 10,
          }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          blendMode="multiply"
          nodeSize={(node) => {
            const units = node.data.units || 1;
            return sizeScale(units, unitRange[0], unitRange[1]);
          }}
          theme={{
            axis: {
              ticks: { text: { fill: '#475569', fontSize: 12 } },
              legend: { text: { fill: '#334155', fontSize: 12, fontWeight: 600 } },
            },
            grid: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
            crosshair: { line: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' } },
          }}
          axisBottom={{
            legend: xLabel,
            legendOffset: 50,
            legendPosition: 'middle',
            format: (v) => currencyFmt.format(logScale ? 10 ** v : v),
          }}
          axisLeft={{
            legend: yLabel,
            legendOffset: -64,
            legendPosition: 'middle',
            format: (v) => currencyFmt.format(v),
          }}
          tooltip={({ node }) => (
            <div className="bg-white shadow-sm rounded px-3 py-2 text-sm text-slate-800 space-y-0.5">
              <p className="font-semibold">{node.data.label}</p>
              <p className="text-slate-600">{node.serieId}</p>
              <p>Ingreso: {currencyFmt.format(node.data.displayX)}</p>
              <p>Margen: {currencyFmt.format(node.data.displayY)}</p>
              <p>Unidades: {numberFmt.format(node.data.units || 0)}</p>
            </div>
          )}
          legends={[
            {
              anchor: 'top-right',
              direction: 'column',
              translateX: 64,
              itemWidth: 120,
              itemHeight: 18,
              symbolSize: 10,
              itemTextColor: '#475569',
            },
          ]}
          layers={[
            'grid',
            'axes',
            ({ xScale, yScale, innerWidth }) =>
              marginPercentiles.p50 !== undefined ? (
                <g>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(marginPercentiles.p50)}
                    y2={yScale(marginPercentiles.p50)}
                    stroke="#cbd5e1"
                    strokeDasharray="6 4"
                  />
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(marginPercentiles.p75)}
                    y2={yScale(marginPercentiles.p75)}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                  />
                </g>
              ) : null,
            ({ xScale, yScale, innerWidth }) =>
              regression && band ? (
                <g>
                  <path
                    d={`M ${xScale(band.x1)} ${yScale(band.upperY1)}
                        L ${xScale(band.x2)} ${yScale(band.upperY2)}
                        L ${xScale(band.x2)} ${yScale(band.lowerY2)}
                        L ${xScale(band.x1)} ${yScale(band.lowerY1)} Z`}
                    fill="#0ea5e9"
                    opacity={0.12}
                  />
                  <line
                    x1={xScale(band.x1)}
                    y1={yScale(band.centerY1)}
                    x2={xScale(band.x2)}
                    y2={yScale(band.centerY2)}
                    stroke="#0284c7"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    opacity={0.9}
                  />
                  <text
                    x={innerWidth - 10}
                    y={16}
                    textAnchor="end"
                    fill="#0f172a"
                    fontSize={12}
                    fontWeight={600}
                  >
                    Banda: Predicción 95%
                  </text>
                </g>
              ) : null,
            ({ xScale, yScale, innerWidth }) =>
              regression ? (
                <g>
                  {(() => {
                    const xVals = filteredPoints.map((p) => p.x);
                    const minX = Math.min(...xVals);
                    const maxX = Math.max(...xVals);
                    const rawMinX = logScale ? 10 ** minX : minX;
                    const rawMaxX = logScale ? 10 ** maxX : maxX;
                    return (
                      <>
                        <line
                          x1={xScale(minX)}
                          y1={yScale(regression.intercept + regression.slope * minX)}
                          x2={xScale(maxX)}
                          y2={yScale(regression.intercept + regression.slope * maxX)}
                          stroke="#0ea5e9"
                          strokeWidth={2}
                        />
                        <line
                          x1={xScale(minX)}
                          y1={yScale(marginRate * rawMinX)}
                          x2={xScale(maxX)}
                          y2={yScale(marginRate * rawMaxX)}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                        />
                      </>
                    );
                  })()}
                  <text x={innerWidth - 10} y={32} textAnchor="end" fill="#f59e0b" fontSize={11}>
                    Línea referencia margen medio
                  </text>
                </g>
              ) : null,
            ({ xScale, yScale }) =>
              showOutliers && diagnostics?.topCook?.length
                ? diagnostics.topCook.map((item) => {
                    const point = filteredPoints[item.idx];
                    return (
                      <circle
                        key={`${point.label}-${item.idx}`}
                        cx={xScale(point.x)}
                        cy={yScale(point.y)}
                        r={12}
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="none"
                      />
                    );
                  })
                : null,
            'nodes',
            'markers',
            'mesh',
            'legends',
          ]}
          xFormat={(v) => currencyFmt.format(logScale ? 10 ** v : v)}
          yFormat={(v) => currencyFmt.format(v)}
          nodeBorderColor="#0f172a"
          nodeBorderWidth={1}
          motionConfig="gentle"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Puntos</p>
          <p className="text-slate-900 font-semibold">{filteredPoints.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Correlación (r)</p>
          <p className="text-slate-900 font-semibold">
            {regression?.r !== undefined ? numberFmt.format(regression.r) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">R² ajustado</p>
          <p className="text-slate-900 font-semibold">
            {regression?.r2Adj !== undefined ? percentFmt.format(regression.r2Adj) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Pendiente</p>
          <p className="text-slate-900 font-semibold">
            {regression?.slope !== undefined
              ? `${currencyFmt.format(regression.slope)} margen / ingreso`
              : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">SE(β₁)</p>
          <p className="text-slate-900 font-semibold">
            {diagnostics?.seSlope !== undefined ? currencyFmt.format(diagnostics.seSlope) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">p-valor β₁</p>
          <p className="text-slate-900 font-semibold">
            {diagnostics?.pValue !== undefined ? formatProbability(diagnostics.pValue) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScatterPlot;
