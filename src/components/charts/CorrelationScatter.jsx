import React from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const formatLabel = (key) => {
  if (key === 'margen') return 'Margen';
  if (key === 'ingresos') return 'Ingresos';
  if (key === 'costos') return 'Costos';
  if (key === 'Unidades UN') return 'Unidades';
  return key;
};

const CorrelationScatter = ({ records, xKey, yKey, color = '#0ea5e9' }) => {
  const trimmed = (records || []).slice(0, 1500);
  const points = trimmed.map((record, index) => ({
    id: index,
    x: Number(record[xKey]),
    y: Number(record[yKey]),
    label: record.nombreVendedor || record['Vendedor SAP'] || record['Nombre segmentación'],
  }));

  return (
    <div style={{ height: 320 }}>
      <ResponsiveScatterPlot
        data={[{ id: `${xKey}-${yKey}`, data: points }]}
        margin={{ top: 30, right: 40, bottom: 50, left: 60 }}
        xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        blendMode="multiply"
        colors={[color]}
        nodeSize={8}
        axisBottom={{ legend: formatLabel(xKey), legendOffset: 36, legendPosition: 'middle' }}
        axisLeft={{ legend: formatLabel(yKey), legendOffset: -45, legendPosition: 'middle' }}
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
      />
    </div>
  );
};

export default CorrelationScatter;
