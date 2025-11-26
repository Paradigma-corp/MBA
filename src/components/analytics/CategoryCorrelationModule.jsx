import React, { useMemo, useState } from 'react';
import { computeCategoryCorrelations, computeOneVsManyCorrelations } from '../../utils/analytics.js';

const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const strengthColor = (value) => {
  const abs = Math.abs(value);
  if (abs < 0.3) return 'bg-emerald-50 text-emerald-700';
  if (abs < 0.7) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
};

const heatColor = (value) => {
  const abs = Math.min(Math.abs(value), 1);
  const intensity = Math.round(abs * 80) + 20;
  return `rgba(14, 116, 144, ${intensity / 100})`;
};

const CategoryCorrelationModule = ({ records }) => {
  const [metric, setMetric] = useState('margen');

  const correlationData = useMemo(() => computeCategoryCorrelations(records), [records]);
  const oneVsMany = useMemo(() => computeOneVsManyCorrelations(records), [records]);
  const activeMatrix = correlationData.matrices?.[metric] || [];

  if (!correlationData.categories.length) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-600">
        No hay suficientes registros filtrados para calcular correlaciones entre categorías.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Correlación 1 a 1</p>
          <h4 className="text-base font-semibold text-slate-900">Matriz 4x4 por métrica</h4>
          <p className="text-sm text-slate-600">Coeficientes de Pearson recalculados con los filtros activos.</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-100 border border-slate-200 rounded-full px-2 py-1">
          {[
            ['margen', 'Margen'],
            ['ingresos', 'Ingresos'],
            ['costos', 'Costos'],
            ['unidades', 'Unidades'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMetric(value)}
              className={`px-3 py-1 rounded-full transition text-sm font-medium ${
                metric === value
                  ? 'bg-celeste-600 text-white shadow'
                  : 'text-slate-700 hover:bg-white hover:shadow-sm'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-700 border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs uppercase tracking-[0.08em] text-slate-500">Categoría</th>
              {correlationData.categories.map((cat) => (
                <th key={cat} className="p-2 text-center text-xs uppercase tracking-[0.08em] text-slate-500">
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correlationData.categories.map((cat, rowIdx) => (
              <tr key={cat} className="border-t border-slate-100">
                <td className="p-2 font-medium text-slate-900">{cat}</td>
                {activeMatrix[rowIdx]?.map((value, colIdx) => (
                  <td key={`${cat}-${colIdx}`} className="p-1 text-center">
                    <div
                      className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-900"
                      style={{ backgroundColor: rowIdx === colIdx ? '#f8fafc' : heatColor(value) }}
                    >
                      {value.toFixed(2)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="text-xs uppercase text-slate-500">Mapa de calor</p>
          <p className="text-sm text-slate-600 mb-3">Entre mayor intensidad, más dependencia lineal.</p>
          <div
            className="grid gap-2 text-center text-xs font-semibold text-slate-900"
            style={{ gridTemplateColumns: `repeat(${correlationData.categories.length || 1}, minmax(0, 1fr))` }}
          >
            {correlationData.categories.map((cat, rowIdx) => (
              <React.Fragment key={cat}>
                {activeMatrix[rowIdx]?.map((value, colIdx) => (
                  <div
                    key={`${cat}-${colIdx}`}
                    className="rounded-lg px-2 py-3"
                    style={{ backgroundColor: rowIdx === colIdx ? '#f8fafc' : heatColor(value) }}
                  >
                    {value.toFixed(2)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="text-xs uppercase text-slate-500">Correlación 1 vs varias</p>
          <p className="text-sm text-slate-600 mb-3">
            La categoría individual se compara contra el agregado de las otras tres en ingresos, costos, margen y unidades.
          </p>
          <div className="space-y-2">
            {oneVsMany.map((item) => (
              <div
                key={item.category}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.category}</p>
                  <p className="text-sm text-slate-600">{item.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[{ label: 'Margen', key: 'margen' }, { label: 'Ingresos', key: 'ingresos' }, { label: 'Costos', key: 'costos' }, { label: 'Unidades', key: 'unidades' }].map(({ label, key }) => (
                    <span key={key} className={`px-3 py-1 rounded-full border ${strengthColor(item.correlations[key])}`}>
                      {label}: {item.correlations[key].toFixed(2)} ({formatPercent(item.correlations[key])})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryCorrelationModule;
