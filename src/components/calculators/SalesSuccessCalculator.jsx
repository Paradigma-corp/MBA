import React, { useMemo, useState } from 'react';

const combination = (n, k) => {
  if (k < 0 || k > n) return 0;
  const adjustedK = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= adjustedK; i += 1) {
    result = (result * (n - adjustedK + i)) / i;
  }
  return result;
};

const binomialProbability = (n, k, p) => combination(n, k) * p ** k * (1 - p) ** (n - k);

const cumulativeAtLeast = (n, k, p) => {
  let total = 0;
  for (let i = k; i <= n; i += 1) {
    total += binomialProbability(n, i, p);
  }
  return total;
};

const SalesSuccessCalculator = () => {
  const [trials, setTrials] = useState(5);
  const [probPercent, setProbPercent] = useState(35);
  const [successes, setSuccesses] = useState(3);
  const [mode, setMode] = useState('exact');

  const safeTrials = useMemo(() => (Number.isFinite(trials) ? Math.max(0, Math.floor(trials)) : 0), [trials]);
  const safeSuccesses = useMemo(
    () => (Number.isFinite(successes) ? Math.max(0, Math.floor(successes)) : 0),
    [successes],
  );
  const safeProb = useMemo(() => {
    const value = Number.isFinite(probPercent) ? Math.max(0, Math.min(probPercent, 100)) : 0;
    return value / 100;
  }, [probPercent]);

  const probability = useMemo(() => {
    if (safeTrials === 0) return 0;
    if (safeSuccesses > safeTrials) return 0;
    if (safeProb <= 0 || safeProb > 1) return 0;
    return mode === 'exact'
      ? binomialProbability(safeTrials, safeSuccesses, safeProb)
      : cumulativeAtLeast(safeTrials, safeSuccesses, safeProb);
  }, [mode, safeProb, safeSuccesses, safeTrials]);

  const probabilityPct = (probability * 100).toFixed(2);

  const explanation = useMemo(() => {
    if (safeTrials === 0) {
      return 'Ingresa el número de oportunidades para calcular la probabilidad.';
    }
    if (safeSuccesses > safeTrials) {
      return 'Los éxitos (k) deben ser menores o iguales a los intentos (N).';
    }
    const closingRate = (safeProb * 100).toFixed(2);
    const targetText = mode === 'exact' ? `exactamente ${safeSuccesses}` : `al menos ${safeSuccesses}`;
    return `Con una tasa de cierre de ${closingRate}%, la probabilidad de lograr ${targetText} ventas de ${safeTrials} oportunidades es ${probabilityPct}%.`;
  }, [mode, probabilityPct, safeProb, safeSuccesses, safeTrials]);

  return (
    <div>
      <div className="card">
        <h3 className="text-base font-semibold text-slate-900 mb-2">Probabilidad binomial de éxito</h3>
        <p className="text-sm text-slate-600 mb-3">
          Estima la probabilidad de que un vendedor alcance su meta de ventas usando las oportunidades disponibles (N),
          los cierres deseados (k) y la tasa de cierre esperada.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <label className="text-slate-700">
            <span className="font-medium">Intentos (N)</span>
            <input
              type="number"
              min="1"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={trials}
              onChange={(e) => setTrials(Number(e.target.value))}
            />
          </label>
          <label className="text-slate-700">
            <span className="font-medium">Éxitos (k)</span>
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={successes}
              onChange={(e) => setSuccesses(Number(e.target.value))}
            />
          </label>
          <label className="text-slate-700">
            <span className="font-medium">Prob. cierre</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={probPercent}
              onChange={(e) => setProbPercent(Number(e.target.value))}
            />
            <span className="text-xs text-slate-500">Ingresa la tasa de cierre en porcentaje (ej. 35 = 35%).</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 mt-3">
          <span className="font-medium">Modo de cálculo</span>
          <button
            type="button"
            onClick={() => setMode('exact')}
            className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${
              mode === 'exact'
                ? 'bg-celeste-600 text-white border-celeste-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            Exactamente k
          </button>
          <button
            type="button"
            onClick={() => setMode('atLeast')}
            className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${
              mode === 'atLeast'
                ? 'bg-celeste-600 text-white border-celeste-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            Al menos k
          </button>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-celeste-50 text-celeste-800 font-semibold">
          Probabilidad {mode === 'exact' ? 'P(X = k)' : 'P(X ≥ k)'}: {probabilityPct}%
        </div>
        <p className="mt-2 text-sm text-slate-700">{explanation}</p>
      </div>
    </div>
  );
};

export default SalesSuccessCalculator;
