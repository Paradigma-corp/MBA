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
    <div className="h-72">
      <ResponsiveBar
        data={data}
        keys={["correlacion"]}
        indexBy="pair"
        layout="horizontal"
        margin={{ top: 20, right: 28, bottom: 46, left: 160 }}
        padding={0.4}
        colors={(bar) => (bar.data.correlacion >= 0 ? '#22c7f2' : '#0f172a')}
        minValue={-1}
        maxValue={1}
        axisBottom={{
          legend: 'Coeficiente de correlación',
          legendOffset: 36,
          legendPosition: 'middle',
          tickPadding: 8,
          tickSize: 0,
          format: (value) => value.toFixed(1),
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 10,
        }}
        enableGridY={false}
        gridXValues={[-1, -0.5, 0, 0.5, 1]}
        markers={[{
          axis: 'x',
          value: 0,
          lineStyle: { stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' },
        }]}
        label={(bar) => bar.value.toFixed(2)}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor="#0f172a"
        theme={{
          textColor: '#0f172a',
          fontSize: 12,
          grid: {
            line: {
              stroke: '#e2e8f0',
              strokeWidth: 1,
            },
          },
          axis: {
            ticks: {
              text: {
                fontSize: 12,
                fill: '#475569',
              },
            },
            legend: {
              text: {
                fontSize: 12,
                fill: '#1e293b',
                fontWeight: 600,
              },
            },
          },
        }}
        tooltip={({ data, value }) => (
          <div className="bg-white/95 rounded-lg shadow-lg px-3 py-2 text-sm text-slate-800 border border-slate-200">
            <p className="font-semibold">{data.pair}</p>
            <p>ρ: {value.toFixed(3)}</p>
          </div>
        )}
      />
    </div>
  );
};

export default CorrelationBars;
