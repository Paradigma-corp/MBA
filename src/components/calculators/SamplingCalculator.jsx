import React, { useMemo, useState } from 'react';

const zScore = {
  0.9: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};

const SamplingCalculator = () => {
  const [confidence, setConfidence] = useState(0.95);
  const [stdDev, setStdDev] = useState(25000);
  const [marginError, setMarginError] = useState(5000);

  const sampleSize = useMemo(() => {
    const z = zScore[confidence] || 1.96;
    return Math.ceil(((z * stdDev) / marginError) ** 2);
  }, [confidence, stdDev, marginError]);

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-slate-900 mb-2">Tamaño de muestra</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <label className="text-slate-700">
          <span className="font-medium">Confianza</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
          >
            <option value={0.9}>90%</option>
            <option value={0.95}>95%</option>
            <option value={0.99}>99%</option>
          </select>
        </label>
        <label className="text-slate-700">
          <span className="font-medium">Desviación estándar</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={stdDev}
            onChange={(e) => setStdDev(Number(e.target.value))}
          />
        </label>
        <label className="text-slate-700">
          <span className="font-medium">Error máximo</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={marginError}
            onChange={(e) => setMarginError(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-amber-50 text-amber-800 font-semibold">
        Tamaño mínimo: {sampleSize} observaciones
      </div>
    </div>
  );
};

export default SamplingCalculator;
