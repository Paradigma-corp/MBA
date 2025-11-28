import React, { useMemo } from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const ScatterPlot = ({ data }) => {
  const points = data.map((item) => ({
    x: item.ingreso,
    y: item.margen,
    label: item.name,
  }));

  const baseStats = useMemo(() => {
    if (!points.length) return null;
    const meanX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const meanY = points.reduce((acc, p) => acc + p.y, 0) / points.length;
    const numerator = points.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
    const sumXVar = points.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
    const sumYVar = points.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);
    const xs = points.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    return { meanX, meanY, numerator, sumXVar, sumYVar, minX, maxX };
  }, [points]);

  const regression = useMemo(() => {
    if (!baseStats || points.length < 2) return null;
    if (baseStats.sumXVar === 0) return null;
    const slope = baseStats.numerator / baseStats.sumXVar;
    const intercept = baseStats.meanY - slope * baseStats.meanX;
    return { slope, intercept, minX: baseStats.minX, maxX: baseStats.maxX };
  }, [baseStats, points.length]);

  const correlation = useMemo(() => {
    if (!baseStats || points.length < 2) return null;
    const denom = Math.sqrt(baseStats.sumXVar * baseStats.sumYVar);
    if (denom === 0) return null;
    const r = baseStats.numerator / denom;
    return {
      r,
      r2: r * r,
      count: points.length,
    };
  }, [baseStats, points.length]);

  const paddedDomain = useMemo(() => {
    if (!points.length) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padRange = (min, max) => {
      const span = max - min;
      const pad = span === 0 ? Math.abs(max || 1) * 0.05 : span * 0.05;
      return [min - pad, max + pad];
    };

    return { x: padRange(minX, maxX), y: padRange(minY, maxY) };
  }, [points]);

  const bootstrapBand = useMemo(() => {
    if (!regression || points.length < 3) return null;

    const iterations = 200;
    const samples = [];

    const quantile = (arr, q) => {
      if (!arr.length) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const pos = (sorted.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      }
      return sorted[base];
    };

    for (let i = 0; i < iterations; i++) {
      const boot = Array.from({ length: points.length }, () => points[Math.floor(Math.random() * points.length)]);
      const meanX = boot.reduce((acc, p) => acc + p.x, 0) / boot.length;
      const meanY = boot.reduce((acc, p) => acc + p.y, 0) / boot.length;
      const num = boot.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
      const den = boot.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
      if (den === 0) continue;
      const slope = num / den;
      const intercept = meanY - slope * meanX;
      samples.push({ slope, intercept });
    }

    if (!samples.length) return null;

    const y1 = samples.map((s) => s.slope * regression.minX + s.intercept);
    const y2 = samples.map((s) => s.slope * regression.maxX + s.intercept);

    return {
      x1: regression.minX,
      x2: regression.maxX,
      lowerY1: quantile(y1, 0.025),
      upperY1: quantile(y1, 0.975),
      lowerY2: quantile(y2, 0.025),
      upperY2: quantile(y2, 0.975),
      centerY1: quantile(y1, 0.5),
      centerY2: quantile(y2, 0.5),
    };
  }, [points, regression]);

  const numberFmt = useMemo(
    () =>
      new Intl.NumberFormat('es-ES', {
        maximumFractionDigits: 1,
      }),
    []
  );

  const percentFmt = useMemo(
    () =>
      new Intl.NumberFormat('es-ES', {
        style: 'percent',
        maximumFractionDigits: 2,
        minimumFractionDigits: 1,
      }),
    []
  );

  const axisFmt = useMemo(
    () =>
      new Intl.NumberFormat('es-ES', {
        maximumFractionDigits: 0,
      }),
    []
  );

  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    []
  );

  return (
    <div className="space-y-3">
      <div style={{ height: 340 }}>
        <ResponsiveScatterPlot
          data={[{ id: 'categorias', data: points }]}
          margin={{ top: 40, right: 48, bottom: 54, left: 68 }}
          xScale={{
            type: 'linear',
            min: paddedDomain?.x[0] ?? 'auto',
            max: paddedDomain?.x[1] ?? 'auto',
          }}
          yScale={{
            type: 'linear',
            min: paddedDomain?.y[0] ?? 'auto',
            max: paddedDomain?.y[1] ?? 'auto',
          }}
          blendMode="multiply"
          colors={['#0ea5e9']}
          nodeSize={12}
          theme={{
            axis: {
              ticks: {
                text: {
                  fill: '#475569',
                  fontSize: 12,
                },
              },
              legend: {
                text: {
                  fill: '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                },
              },
            },
            grid: {
              line: {
                stroke: '#e2e8f0',
                strokeWidth: 1,
              },
            },
          }}
          axisBottom={{
            legend: 'Ingreso promedio',
            legendOffset: 38,
            legendPosition: 'middle',
            format: (v) => axisFmt.format(v),
          }}
          axisLeft={{
            legend: 'Margen promedio',
            legendOffset: -54,
            legendPosition: 'middle',
            format: (v) => axisFmt.format(v),
          }}
          tooltip={({ node }) => (
            <div className="bg-white shadow-sm rounded px-3 py-2 text-sm text-slate-800 space-y-0.5">
              <p className="font-semibold">{node.data.label}</p>
              <p>Ingreso: {currencyFmt.format(node.data.x)}</p>
              <p>Margen: {currencyFmt.format(node.data.y)}</p>
            </div>
          )}
          layers={[
            'grid',
            'axes',
            ({ xScale, yScale, innerWidth }) =>
              bootstrapBand ? (
                <g>
                  <path
                    d={`M ${xScale(bootstrapBand.x1)} ${yScale(bootstrapBand.upperY1)}
                        L ${xScale(bootstrapBand.x2)} ${yScale(bootstrapBand.upperY2)}
                        L ${xScale(bootstrapBand.x2)} ${yScale(bootstrapBand.lowerY2)}
                        L ${xScale(bootstrapBand.x1)} ${yScale(bootstrapBand.lowerY1)} Z`}
                    fill="#0ea5e9"
                    opacity={0.12}
                  />
                  <line
                    x1={xScale(bootstrapBand.x1)}
                    y1={yScale(bootstrapBand.centerY1)}
                    x2={xScale(bootstrapBand.x2)}
                    y2={yScale(bootstrapBand.centerY2)}
                    stroke="#0284c7"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    opacity={0.95}
                  />
                  <text
                    x={innerWidth - 10}
                    y={16}
                    textAnchor="end"
                    fill="#0f172a"
                    fontSize={12}
                    fontWeight={600}
                  >
                    Banda bootstrap 95%
                  </text>
                </g>
              ) : null,
            'nodes',
            'markers',
            'mesh',
            'legends',
          ]}
          xFormat={(v) => axisFmt.format(v)}
          yFormat={(v) => axisFmt.format(v)}
          nodeBorderColor="#0369a1"
          nodeBorderWidth={1}
          motionConfig="gentle"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Puntos</p>
          <p className="text-slate-900 font-semibold">{correlation?.count ?? points.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Correlación (r)</p>
          <p className="text-slate-900 font-semibold">
            {correlation ? numberFmt.format(correlation.r) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">R² ajustado</p>
          <p className="text-slate-900 font-semibold">
            {correlation ? percentFmt.format(correlation.r2) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Pendiente</p>
          <p className="text-slate-900 font-semibold">
            {regression ? `${numberFmt.format(regression.slope)} margen / ingreso` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScatterPlot;
