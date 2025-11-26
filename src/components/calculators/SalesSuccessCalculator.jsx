import React, { useMemo, useState } from 'react';

const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));
const combination = (n, k) => factorial(n) / (factorial(k) * factorial(n - k));

const SalesSuccessCalculator = () => {
  const [trials, setTrials] = useState(5);
  const [prob, setProb] = useState(0.35);
  const [successes, setSuccesses] = useState(3);

  const probability = useMemo(() => {
    if (successes > trials) return 0;
    const p = Number(prob);
    return combination(trials, successes) * p ** successes * (1 - p) ** (trials - successes);
  }, [trials, prob, successes]);

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-slate-900 mb-2">Probabilidad binomial de éxito</h3>
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
            step="0.01"
            min="0"
            max="1"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={prob}
            onChange={(e) => setProb(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-celeste-50 text-celeste-800 font-semibold">
        Probabilidad: {(probability * 100).toFixed(2)}%
      </div>
    </div>
  );
};

export default SalesSuccessCalculator;
