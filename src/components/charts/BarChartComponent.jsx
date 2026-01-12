import React, { useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const BarChartComponent = ({ data }) => {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        category: item.name,
        Ingreso: item.ingreso ?? 0,
        Costo: item.costo ?? 0,
        Margen: item.margen ?? 0,
      })),
    [data]
  );

  const tooltip = ({ id, value, indexValue }) => (
    <div className="rounded-md bg-white p-2 shadow border border-slate-200">
      <p className="text-xs font-medium text-slate-800">{indexValue}</p>
      <p className="text-xs text-slate-600">
        {id}: <span className="font-semibold">{currencyFormatter.format(value || 0)}</span>
      </p>
    </div>
  );

  return (
    <div style={{ height: 360 }}>
      <ResponsiveBar
        data={chartData}
        keys={['Ingreso', 'Costo', 'Margen']}
        indexBy="category"
        groupMode="grouped"
        margin={{ top: 20, right: 24, bottom: 50, left: 70 }}
        padding={0.2}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={[ '#22c7f2', '#0b0b0f', '#8adfff' ]}
        enableLabel={false}
        axisLeft={{
          format: (value) => currencyFormatter.format(value),
        }}
        tooltip={tooltip}
        legends={[
          {
            dataFrom: 'keys',
            anchor: 'bottom',
            direction: 'row',
            translateY: 46,
            itemWidth: 90,
            itemHeight: 14,
          },
        ]}
        theme={{
          axis: {
            ticks: {
              text: {
                fontSize: 11,
                fill: '#475569',
              },
            },
            legend: {
              text: {
                fontSize: 11,
                fill: '#334155',
              },
            },
          },
          legends: {
            text: {
              fontSize: 12,
              fill: '#334155',
            },
          },
          tooltip: {
            container: {
              fontSize: 12,
            },
          },
        }}
      />
    </div>
  );
};

export default BarChartComponent;
