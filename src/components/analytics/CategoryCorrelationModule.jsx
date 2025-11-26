import React, { useEffect, useMemo, useState } from 'react';
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
  const [showHeatmapModal, setShowHeatmapModal] = useState(false);
  const [rowSelection, setRowSelection] = useState([]);
  const [colSelection, setColSelection] = useState([]);

  const correlationData = useMemo(() => {
    try {
      return computeCategoryCorrelations(records);
    } catch (error) {
      console.error('Correlation matrix error', error);
      return { categories: [], matrices: {} };
    }
  }, [records]);

  useEffect(() => {
    const cats = correlationData.categories || [];
    setRowSelection(cats);
    setColSelection(cats);
  }, [correlationData.categories]);

  const oneVsMany = useMemo(() => {
    try {
      return computeOneVsManyCorrelations(records);
    } catch (error) {
      console.error('One-vs-many correlation error', error);
      return [];
    }
  }, [records]);

  const activeMatrix = correlationData.matrices?.[metric] || [];
  const selectedRows = rowSelection.length ? rowSelection : correlationData.categories;
  const selectedCols = colSelection.length ? colSelection : correlationData.categories;

  const correlationForPair = (rowCat, colCat) => {
    const rowIndex = correlationData.categories.indexOf(rowCat);
    const colIndex = correlationData.categories.indexOf(colCat);
    if (rowIndex === -1 || colIndex === -1) return 0;
    const value = activeMatrix[rowIndex]?.[colIndex];
    return Number.isFinite(value) ? value : 0;
  };

  const handleSelectChange = (setter) => (event) => {
    const values = Array.from(event.target.selectedOptions).map((opt) => opt.value);
    setter(values);
  };

  const HeatmapGrid = ({
    withLabels = false,
    cellPadding = 'py-3',
    textSize = 'text-xs',
    minWidth = '520px',
  }) => (
    <div
      className={`grid gap-2 text-center font-semibold text-slate-900 ${textSize}`}
      style={{
        gridTemplateColumns: withLabels
          ? `140px repeat(${selectedCols.length || 1}, minmax(0, 1fr))`
          : `repeat(${selectedCols.length || 1}, minmax(0, 1fr))`,
        minWidth,
      }}
    >
      {withLabels && <div className="" />}
      {withLabels &&
        selectedCols.map((cat) => (
          <div key={`col-${cat}`} className="text-slate-600 text-xs uppercase tracking-[0.08em]">
            {cat}
          </div>
        ))}
      {selectedRows.map((rowCat) => (
        <React.Fragment key={rowCat}>
          {withLabels && <div className="text-right pr-2 text-slate-700 font-semibold">{rowCat}</div>}
          {selectedCols.map((colCat, colIdx) => {
            const displayValue = correlationForPair(rowCat, colCat);
            return (
              <div
                key={`${rowCat}-${colCat}`}
                className={`rounded-lg px-2 ${cellPadding}`}
                style={{ backgroundColor: rowCat === colCat ? '#f8fafc' : heatColor(displayValue) }}
              >
                {displayValue.toFixed(2)}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );

  if (!correlationData.categories.length) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-600">
        No hay suficientes registros filtrados para calcular correlaciones entre categorías.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Correlación 1 a 1</p>
          <h4 className="text-base font-semibold text-slate-900">Matriz por métrica</h4>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Filas (eje Y)</p>
          <select
            multiple
            value={rowSelection}
            onChange={handleSelectChange(setRowSelection)}
            className="w-full mt-1 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 p-2"
          >
            {correlationData.categories.map((cat) => (
              <option key={`row-${cat}`} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Selecciona qué categorías aparecen en el eje Y.</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Columnas (eje X)</p>
          <select
            multiple
            value={colSelection}
            onChange={handleSelectChange(setColSelection)}
            className="w-full mt-1 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 p-2"
          >
            {correlationData.categories.map((cat) => (
              <option key={`col-${cat}`} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Elige qué categorías se muestran en el eje X.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-700 border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs uppercase tracking-[0.08em] text-slate-500">Categoría</th>
              {selectedCols.map((cat) => (
                <th key={cat} className="p-2 text-center text-xs uppercase tracking-[0.08em] text-slate-500">
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedRows.map((cat) => (
              <tr key={cat} className="border-t border-slate-100">
                <td className="p-2 font-medium text-slate-900">{cat}</td>
                {selectedCols.map((colCat) => {
                  const displayValue = correlationForPair(cat, colCat);
                  return (
                  <td key={`${cat}-${colCat}`} className="p-1 text-center">
                    <div
                      className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-900"
                      style={{ backgroundColor: cat === colCat ? '#f8fafc' : heatColor(displayValue) }}
                    >
                      {displayValue.toFixed(2)}
                    </div>
                  </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Mapa de calor</p>
              <p className="text-sm text-slate-600">Entre mayor intensidad, más dependencia lineal.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHeatmapModal(true)}
              className="text-sm font-semibold text-celeste-700 hover:text-celeste-900 flex items-center gap-1"
            >
              <span>Ver completo</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-2">Vista compacta (toque para ampliar).</p>
          <div className="overflow-auto max-h-[460px]">
            <HeatmapGrid cellPadding="py-4" minWidth="640px" />
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
                  {[{ label: 'Margen', key: 'margen' }, { label: 'Ingresos', key: 'ingresos' }, { label: 'Costos', key: 'costos' }, { label: 'Unidades', key: 'unidades' }].map(({ label, key }) => {
                    const rho = Number.isFinite(item.correlations?.[key]) ? item.correlations[key] : 0;
                    return (
                      <span key={key} className={`px-3 py-1 rounded-full border ${strengthColor(rho)}`}>
                        {label}: {rho.toFixed(2)} ({formatPercent(rho)})
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      {showHeatmapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
              <div>
                <p className="text-xs uppercase text-slate-500">Mapa de calor ampliado</p>
                <h4 className="text-lg font-semibold text-slate-900">Correlación 1 a 1</h4>
                <p className="text-sm text-slate-600">Vista expandida con etiquetas de filas y columnas para revisar cada par.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHeatmapModal(false)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[70vh]">
              <HeatmapGrid withLabels textSize="text-sm" cellPadding="py-4" minWidth="860px" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CategoryCorrelationModule;
