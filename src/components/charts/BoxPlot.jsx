import React from 'react';
import { ResponsiveBoxPlot } from '@nivo/boxplot';

const BoxPlot = ({ data }) => {
  const items = data.map((item) => ({
    group: 'Margen',
    subgroup: item.name,
    observations: item.records?.map((r) => Number(r.margen) || 0) || [],
  }));

  return (
    <div style={{ height: 320 }}>
      <ResponsiveBoxPlot
        data={items}
        margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
        padding={0.4}
        enableGridX={false}
        axisBottom={{ legend: 'Categoría', legendOffset: 36, legendPosition: 'middle' }}
        axisLeft={{ legend: 'Margen', legendOffset: -45, legendPosition: 'middle' }}
        colors={{ scheme: 'paired' }}
      />
    </div>
  );
};

export default BoxPlot;
