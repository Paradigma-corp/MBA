import React, { useMemo } from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const ScatterPlot = ({ data }) => {
  const points = data.map((item) => ({
    x: item.ingreso,
    y: item.margen,
    label: item.name,
  }));

  const regression = useMemo(() => {
    if (points.length < 2) return null;
    const meanX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const meanY = points.reduce((acc, p) => acc + p.y, 0) / points.length;
    const numerator = points.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
    const denominator = points.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
    if (denominator === 0) return null;
    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    const xs = points.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return { slope, intercept, minX, maxX };
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

  return (
    <div style={{ height: 320 }}>
      <ResponsiveScatterPlot
        data={[{ id: 'categorias', data: points }]}
        margin={{ top: 30, right: 40, bottom: 50, left: 60 }}
        xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        blendMode="multiply"
        colors={['#0ea5e9']}
        nodeSize={12}
        axisBottom={{ legend: 'Ingreso promedio', legendOffset: 36, legendPosition: 'middle' }}
        axisLeft={{ legend: 'Margen promedio', legendOffset: -45, legendPosition: 'middle' }}
        tooltip={({ node }) => (
          <div className="bg-white shadow-sm rounded px-3 py-2 text-sm text-slate-800">
            <p className="font-semibold">{node.data.label}</p>
            <p>Ingreso: {node.data.xFormatted}</p>
            <p>Margen: {node.data.yFormatted}</p>
          </div>
        )}
        layers={[
          'grid',
          'axes',
          ({ xScale, yScale }) =>
            bootstrapBand ? (
              <g>
                <path
                  d={`M ${xScale(bootstrapBand.x1)} ${yScale(bootstrapBand.upperY1)}
                      L ${xScale(bootstrapBand.x2)} ${yScale(bootstrapBand.upperY2)}
                      L ${xScale(bootstrapBand.x2)} ${yScale(bootstrapBand.lowerY2)}
                      L ${xScale(bootstrapBand.x1)} ${yScale(bootstrapBand.lowerY1)} Z`}
                  fill="#0ea5e9"
                  opacity={0.08}
                />
                <line
                  x1={xScale(bootstrapBand.x1)}
                  y1={yScale(bootstrapBand.centerY1)}
                  x2={xScale(bootstrapBand.x2)}
                  y2={yScale(bootstrapBand.centerY2)}
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  opacity={0.9}
                />
              </g>
            ) : null,
          'nodes',
          'markers',
          'mesh',
          'legends',
        ]}
      />
    </div>
  );
};

export default ScatterPlot;
