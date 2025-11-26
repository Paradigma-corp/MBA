import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

const CorrelationBars = ({ correlations }) => {
  const data = [
    {
      pair: 'Margen vs Ingreso',
      correlacion: correlations?.margenIngreso ?? 0,
    },
    {
      pair: 'Margen vs Costos',
      correlacion: correlations?.margenCostos ?? 0,
    },
    {
      pair: 'Ingreso vs Costos',
      correlacion: correlations?.ingresoCostos ?? 0,
    },
    {
      pair: 'Margen vs Unidades',
      correlacion: correlations?.margenUnidades ?? 0,
    },
  ];

  return (
    <div style={{ height: 280 }}>
      <ResponsiveBar
        data={data}
        keys={["correlacion"]}
        indexBy="pair"
        layout="horizontal"
        margin={{ top: 10, right: 20, bottom: 40, left: 140 }}
        padding={0.35}
        colors={(bar) => (bar.data.correlacion >= 0 ? '#0ea5e9' : '#ef4444')}
        minValue={-1}
        maxValue={1}
        axisBottom={{ legend: 'Coeficiente de correlación', legendOffset: 32, legendPosition: 'middle' }}
        axisLeft={null}
        enableGridY={false}
        label={(bar) => bar.value.toFixed(2)}
        labelSkipWidth={12}
        labelSkipHeight={12}
        theme={{
          textColor: '#0f172a',
          fontSize: 12,
        }}
        tooltip={({ data, value }) => (
          <div className="bg-white/95 rounded-lg shadow px-3 py-2 text-sm text-slate-800">
            <p className="font-semibold">{data.pair}</p>
            <p>ρ: {value.toFixed(3)}</p>
          </div>
        )}
      />
    </div>
  );
};

export default CorrelationBars;
