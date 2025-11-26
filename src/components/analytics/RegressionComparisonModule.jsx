import React, { useEffect, useMemo, useState } from 'react';
import { buildRegressionModel, recomputeModelWithBetas } from '../../utils/analytics.js';

const formatNumber = (value) =>
  Number.isFinite(value) ? value.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '—';

const significanceTag = (beta, maxAbs) => {
  const abs = Math.abs(beta);
  if (abs >= 0.75 * maxAbs) return 'Alta';
  if (abs >= 0.4 * maxAbs) return 'Media';
  return 'Baja';
};

const fallbackModel = {
  betas: { Automóviles: 0, Vans: 0, Camiones: 0, Buses: 0 },
  rSquared: 0,
  rSquaredWithoutAuto: 0,
  averageOtherBeta: 0,
  deltaR2: 0,
  table: [
    { category: 'Automóviles', beta: 0, impact: 'Sin impacto' },
    { category: 'Vans', beta: 0, impact: 'Sin impacto' },
    { category: 'Camiones', beta: 0, impact: 'Sin impacto' },
    { category: 'Buses', beta: 0, impact: 'Sin impacto' },
  ],
  maxAbsBeta: 1,
  summary: { interpretation: 'Ajusta las β para ver la comparación entre Autos y el grupo.' },
};

const RegressionComparisonModule = ({ records }) => {
  const model = useMemo(() => {
    try {
      return buildRegressionModel(records);
    } catch (error) {
      console.error('Regression model error', error);
      return fallbackModel;
    }
  }, [records]);

  const [betas, setBetas] = useState(model.betas);

  useEffect(() => {
    setBetas(model.betas);
  }, [model.betas]);

  const recalculated = useMemo(() => {
    try {
      return recomputeModelWithBetas(records, betas);
    } catch (error) {
      console.error('Regression recompute error', error);
      return {
        rSquared: 0,
        rSquaredWithoutAuto: 0,
        averageOtherBeta: 0,
        deltaR2: 0,
      };
    }
  }, [records, betas]);

  const autoVsOthers = betas.Automóviles - recalculated.averageOtherBeta;
  const deltaR2Label = recalculated.deltaR2 >= 0 ? 'disminuye' : 'aumenta';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Modelo lineal con dummies</p>
          <h4 className="text-base font-semibold text-slate-900">Independencia y solvencia de Autos</h4>
          <p className="text-sm text-slate-600">
            Ajusta manualmente los coeficientes β para cada categoría y observa el efecto en R² y la contribución relativa de
            Autos frente al grupo.
          </p>
        </div>
        <div className="px-4 py-3 rounded-2xl bg-celeste-50 border border-celeste-100 text-celeste-800 shadow-sm">
          <p className="text-xs uppercase tracking-[0.08em] text-celeste-700">R² del modelo</p>
          <p className="text-2xl font-semibold">{formatNumber(recalculated.rSquared)}</p>
          <p className="text-xs text-celeste-700">Sin Autos: {formatNumber(recalculated.rSquaredWithoutAuto)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-center">
        {[
          ['Automóviles', 'Autos'],
          ['Vans', 'Vans'],
          ['Camiones', 'Camiones'],
          ['Buses', 'Buses'],
        ].map(([key, label]) => (
          <div key={key} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="text-xs uppercase text-slate-500">β {label}</p>
            <input
              type="number"
              step="0.01"
              value={betas[key] ?? 0}
              onChange={(e) => setBetas({ ...betas, [key]: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-celeste-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Significancia: {significanceTag(betas[key] ?? 0, model.maxAbsBeta)}</p>
          </div>
        ))}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-xs uppercase text-slate-500">Conclusión automática</p>
          <p className="text-sm text-slate-700 mt-1">
            El coeficiente de Autos es {formatNumber(betas.Automóviles)}, {autoVsOthers >= 0 ? 'superior' : 'inferior'} al promedio del grupo ({
              formatNumber(recalculated.averageOtherBeta)
            }). El R² {deltaR2Label} {formatNumber(Math.abs(recalculated.deltaR2))} al retirar Autos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="text-xs uppercase text-slate-500">Impacto por variable</p>
          <div className="mt-3 space-y-3">
            {model.table.map((row) => (
              <div key={row.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{row.category}</span>
                  <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                    {row.impact}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-celeste-500"
                    style={{
                      width: `${Math.min(Math.abs(row.beta) / (model.maxAbsBeta || 1), 1) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">β: {formatNumber(row.beta)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <p className="text-xs uppercase text-slate-500">Tabla resumen</p>
          <table className="mt-3 w-full text-sm text-slate-700">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="pb-2">Variable</th>
                <th className="pb-2">β</th>
                <th className="pb-2">Impacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {model.table.map((row) => (
                <tr key={row.category}>
                  <td className="py-2 font-semibold text-slate-900">{row.category}</td>
                  <td className="py-2">{formatNumber(row.beta)}</td>
                  <td className="py-2 text-slate-600">{row.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-slate-500">
            <p>Interpretación generada automáticamente:</p>
            <p className="text-sm text-slate-700">{model.summary.interpretation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegressionComparisonModule;
