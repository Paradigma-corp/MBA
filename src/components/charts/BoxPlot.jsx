import React from 'react';
import { ResponsiveBoxPlot } from '@nivo/boxplot';

const BoxPlot = ({ data }) => {
  const items = data.map((item) => {
    const observations = item.margins
      ? item.margins.filter((value) => Number.isFinite(value)).map((value) => Number(value))
      : item.records?.map((r) => Number(r.margen) || 0) || [];
    return {
      group: 'Margen',
      subgroup: item.name,
      observations,
    };
  });

  const hasData = items.some((item) => item.observations.length > 0);

  if (!hasData) {
    return (
      <div className="h-[320px] flex items-center justify-center text-sm text-slate-500">
        Sin datos de márgenes para el filtro actual.
      </div>
    );
  }

  return (
    <div style={{ height: 320 }}>
      <ResponsiveBoxPlot
        data={items}
        margin={{ top: 20, right: 30, bottom: 50, left: 60 }}
        padding={0.4}
        enableGridX={false}
        axisBottom={{ legend: 'Categoría', legendOffset: 36, legendPosition: 'middle' }}
        axisLeft={{ legend: 'Margen', legendOffset: -45, legendPosition: 'middle' }}
        colors={() => '#22c7f2'}
      />
    </div>
  );
};

export default BoxPlot;
