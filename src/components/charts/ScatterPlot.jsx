import React from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const ScatterPlot = ({ data }) => {
  const points = data.map((item) => ({
    x: item.ingreso,
    y: item.margen,
    label: item.name,
  }));

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
      />
    </div>
  );
};

export default ScatterPlot;
