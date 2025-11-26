import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

const BarChartComponent = ({ data }) => {
  const chartData = data.map((item) => ({
    category: item.name,
    Ingreso: item.ingreso,
    Costo: item.costo,
    Margen: item.margen,
  }));

  return (
    <div style={{ height: 320 }}>
      <ResponsiveBar
        data={chartData}
        keys={['Ingreso', 'Costo', 'Margen']}
        indexBy="category"
        margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
        padding={0.3}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={['#22c7f2', '#0b0b0f', '#8adfff']}
        labelSkipHeight={12}
        labelTextColor="#fff"
        legends={[
          {
            dataFrom: 'keys',
            anchor: 'bottom',
            direction: 'row',
            translateY: 40,
            itemWidth: 80,
            itemHeight: 14,
          },
        ]}
      />
    </div>
  );
};

export default BarChartComponent;
