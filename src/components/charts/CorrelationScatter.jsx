import React, { useMemo } from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const formatLabel = (key) => {
  if (key === 'margen') return 'Margen';
  if (key === 'ingresos') return 'Ingresos';
  if (key === 'costos') return 'Costos';
  if (key === 'Unidades UN') return 'Unidades';
  return key;
};

const CorrelationScatter = ({ records, xKey, yKey, color = '#22c7f2' }) => {
  const trimmed = (records || []).slice(0, 1500);
  const points = trimmed
    .map((record, index) => ({
      id: index,
      x: Number(record[xKey]),
      y: Number(record[yKey]),
      label: record.nombreVendedor || record['Vendedor SAP'] || record['Nombre segmentación'],
    }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));

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
    <div style={{ height: 320 }}>
      <ResponsiveScatterPlot
        data={[{ id: `${xKey}-${yKey}`, data: points }]}
        margin={{ top: 30, right: 40, bottom: 50, left: 65 }}
        xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        colors={[color]}
        nodeSize={9}
        nodeOpacity={0.28}
        blendMode="normal"
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
  );
};

export default CorrelationScatter;
