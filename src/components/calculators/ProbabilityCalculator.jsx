import React, { useMemo, useState } from 'react';

const normalRandom = (mean, stdDev) => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
};

const ProbabilityCalculator = ({ salespeople }) => {
  const [selected, setSelected] = useState(salespeople[0]?.sapCode || '');
  const [target, setTarget] = useState(salespeople[0]?.target || 0);
  const iterations = 10000;

  const probability = useMemo(() => {
    const seller = salespeople.find((item) => item.sapCode === selected);
    if (!seller) return 0;
    let successes = 0;
    for (let i = 0; i < iterations; i += 1) {
      const sample = normalRandom(seller.averageSales, seller.stdDev || 1);
      if (sample >= target) successes += 1;
    }
    return (successes / iterations) * 100;
  }, [salespeople, selected, target]);

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-slate-900 mb-2">Simulación Monte Carlo</h3>
      <p className="text-sm text-slate-600 mb-3">
        Probabilidad de alcanzar una meta de ingresos usando 10,000 simulaciones.
      </p>
      <div className="flex flex-col gap-3">
        <label className="text-sm text-slate-700">
          <span className="font-medium">Vendedor</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {salespeople.map((seller) => (
              <option key={seller.sapCode} value={seller.sapCode}>
                {seller.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          <span className="font-medium">Meta de ingresos</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-indigo-50 text-indigo-800 font-semibold">
        Probabilidad estimada: {probability.toFixed(2)}%
      </div>
    </div>
  );
};

export default ProbabilityCalculator;
