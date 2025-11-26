import React, { useMemo } from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const formatLabel = (key) => {
  if (key === 'margen') return 'Margen';
  if (key === 'ingresos') return 'Ingresos';
  if (key === 'costos') return 'Costos';
  if (key === 'Unidades UN') return 'Unidades';
  return key;
};

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const CorrelationScatter = ({ records, xKey, yKey, color = '#22c7f2', maxPoints = 1500, height = 320 }) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const trimmed = maxPoints ? safeRecords.slice(0, maxPoints) : safeRecords;
  const bucketed = trimmed
    .map((record, index) => ({
      id: index,
      x: Number(record[xKey]),
      y: Number(record[yKey]),
      label: record.nombreVendedor || record['Vendedor SAP'] || record['Nombre segmentación'],
    }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .reduce((acc, point) => {
      const bucketX = Math.round(point.x * 10) / 10;
      const bucketY = Math.round(point.y * 10) / 10;
      const key = `${bucketX}-${bucketY}`;
      if (!acc.has(key)) {
        acc.set(key, { ...point, x: bucketX, y: bucketY, count: 0, labels: [] });
      }
      const bucket = acc.get(key);
      bucket.count += 1;
      if (bucket.labels.length < 3 && point.label) bucket.labels.push(point.label);
      return acc;
    }, new Map());

  const points = Array.from(bucketed.values());

  const regressionLine = useMemo(() => {
    if (points.length < 2) return null;
    const meanX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
    const meanY = points.reduce((acc, p) => acc + p.y, 0) / points.length;
    const numerator = points.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
    const denominator = points.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
    if (denominator === 0) return null;
    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    const xValues = points.map((p) => p.x);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    return {
      x1: minX,
      y1: slope * minX + intercept,
      x2: maxX,
      y2: slope * maxX + intercept,
    };
  }, [points]);

  const theme = useMemo(
    () => ({
      axis: {
        ticks: {
          text: {
            fill: '#475569',
            fontSize: 12,
            fontWeight: 500,
          },
        },
        legend: {
          text: {
            fill: '#0f172a',
            fontSize: 13,
            fontWeight: 600,
          },
        },
        domain: {
          line: {
            stroke: '#cbd5e1',
            strokeWidth: 1,
          },
        },
      },
      grid: {
        line: {
          stroke: '#e2e8f0',
          strokeWidth: 1,
          strokeDasharray: '4 4',
        },
      },
      legends: {
        text: {
          fill: '#475569',
        },
      },
      tooltip: {
        container: {
          borderRadius: 10,
          boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
          border: '1px solid #e2e8f0',
        },
      },
    }),
    []
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Intensidad y tamaño según repeticiones en la nube (agrupadas a 0.1 unidad)</span>
        <span>{points.length.toLocaleString()} celdas únicas · {trimmed.length.toLocaleString()} puntos</span>
      </div>
      <div style={{ height }}>
      <ResponsiveScatterPlot
        data={[{ id: `${xKey}-${yKey}`, data: points }]}
        margin={{ top: 30, right: 40, bottom: 50, left: 65 }}
        xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        colors={({ data }) => {
          const { r, g, b } = hexToRgb(color);
          const alpha = Math.min(0.2 + (data.count || 1) * 0.08, 0.9);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }}
        nodeSize={(node) => 6 + Math.log1p(node.data.count || 1) * 4}
        nodeOpacity={1}
        blendMode="multiply"
        axisBottom={{
          tickSize: 6,
          tickPadding: 6,
          legend: formatLabel(xKey),
          legendOffset: 40,
          legendPosition: 'middle',
        }}
        axisLeft={{
          tickSize: 6,
          tickPadding: 6,
          legend: formatLabel(yKey),
          legendOffset: -55,
          legendPosition: 'middle',
        }}
        tooltip={({ node }) => (
          <div className="bg-white shadow-sm rounded px-3 py-2 text-sm text-slate-800">
            <p className="font-semibold">{node.data.label}</p>
            <p>
              {formatLabel(xKey)}: {node.data.xFormatted}
            </p>
            <p>
              {formatLabel(yKey)}: {node.data.yFormatted}
            </p>
            <p className="text-xs text-slate-500 mt-1">Repeticiones en esta celda: {node.data.count ?? 1}</p>
          </div>
        )}
        theme={theme}
        nodeBorderColor={{ from: 'color', modifiers: [['brighter', 1.2]] }}
        nodeBorderWidth={1}
        layers={[
          'grid',
          'axes',
          'nodes',
          ({ xScale, yScale }) =>
            regressionLine ? (
              <line
                x1={xScale(regressionLine.x1)}
                y1={yScale(regressionLine.y1)}
                x2={xScale(regressionLine.x2)}
                y2={yScale(regressionLine.y2)}
                stroke="#0c89aa"
                strokeWidth={2}
                opacity={0.9}
              />
            ) : null,
          'markers',
          'mesh',
          'legends',
        ]}
      />
      </div>
    </div>
  );
};

export default CorrelationScatter;
