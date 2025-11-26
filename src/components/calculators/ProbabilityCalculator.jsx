import React, { useMemo, useState } from 'react';

const normalRandom = (mean, stdDev) => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
};

const ProbabilityCalculator = ({ salespeople }) => {
  const [selected, setSelected] = useState(salespeople[0]?.sapCode || '');
  const [metric, setMetric] = useState('ingresos');
  const [target, setTarget] = useState(salespeople[0]?.target || 0);
  const iterations = 10000;

  const seller = useMemo(
    () => salespeople.find((item) => item.sapCode === selected),
    [salespeople, selected],
  );

  const metricConfig = useMemo(() => {
    if (metric === 'margen') {
      const mean = seller?.averageMargin ?? 0;
      const stdDev = seller?.marginStdDev ?? 0;
      const defaultTarget = seller?.marginTarget ?? mean * 1.2;
      return { label: 'Meta de margen (USD)', mean, stdDev, defaultTarget };
    }
    const mean = seller?.averageSales ?? 0;
    const stdDev = seller?.stdDev ?? 0;
    const defaultTarget = seller?.target ?? mean * 1.2;
    return { label: 'Meta de ingresos (USD)', mean, stdDev, defaultTarget };
  }, [metric, seller]);

  React.useEffect(() => {
    setTarget(metricConfig.defaultTarget || 0);
  }, [metricConfig.defaultTarget]);

  const sliderConfig = useMemo(() => {
    const mean = Number.isFinite(metricConfig.mean) ? metricConfig.mean : 0;
    const stdDev = Number.isFinite(metricConfig.stdDev) ? metricConfig.stdDev : 0;
    const suggestedMin = mean - stdDev * 2;
    const min = Math.max(0, Math.floor(Number.isFinite(suggestedMin) ? suggestedMin : 0));
    const suggestedMax = mean + stdDev * 4;
    const max = Math.max(min + 1, Math.ceil(Number.isFinite(suggestedMax) ? suggestedMax : min + 1), target || 0);
    const step = Math.max(1, Math.round((max - min) / 50));
    return { min, max, step };
  }, [metricConfig.mean, metricConfig.stdDev, target]);

  const probability = useMemo(() => {
    if (!seller) return 0;
    let successes = 0;
    const mean = metric === 'margen' ? seller.averageMargin : seller.averageSales;
    const stdDev = metric === 'margen' ? seller.marginStdDev : seller.stdDev;
    const safeMean = Number.isFinite(mean) ? mean : 0;
    const safeStd = Number.isFinite(stdDev) && stdDev > 0 ? stdDev : 1;
    for (let i = 0; i < iterations; i += 1) {
      const sample = normalRandom(safeMean, safeStd);
      if (sample >= target) successes += 1;
    }
    return (successes / iterations) * 100;
  }, [iterations, metric, seller, target]);

  const formatUSD = (value) =>
    Number.isFinite(value)
      ? `$${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
      : '—';

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-slate-900 mb-2">Simulación Monte Carlo</h3>
      <p className="text-sm text-slate-600 mb-3">
        Ejecuta 10,000 simulaciones por vendedor. Elige si la meta es por ingresos o margen y ajusta el monto con el
        slider.
      </p>
      <div className="flex flex-col gap-3">
        <label className="text-sm text-slate-700">
          <span className="font-medium">Vendedor</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {salespeople.map((sellerOption) => (
              <option key={sellerOption.sapCode} value={sellerOption.sapCode}>
                {sellerOption.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <span className="font-medium mr-2">Tipo de meta</span>
          <button
            type="button"
            onClick={() => setMetric('ingresos')}
            className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${
              metric === 'ingresos'
                ? 'bg-celeste-600 text-white border-celeste-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            Ingresos
          </button>
          <button
            type="button"
            onClick={() => setMetric('margen')}
            className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${
              metric === 'margen'
                ? 'bg-celeste-600 text-white border-celeste-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            Margen
          </button>
        </div>

        <div className="text-sm text-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">{metricConfig.label}</span>
            <span className="text-celeste-700 font-semibold">{formatUSD(target)}</span>
          </div>
          <input
            type="range"
            className="w-full accent-celeste-600"
            min={sliderConfig.min}
            max={sliderConfig.max}
            step={sliderConfig.step}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
            <span>{formatUSD(sliderConfig.min)}</span>
            <span>{formatUSD(sliderConfig.max)}</span>
          </div>
          <input
            type="number"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-celeste-50 text-celeste-800 font-semibold">
        Probabilidad estimada: {probability.toFixed(2)}%
      </div>
    </div>
  );
};

export default ProbabilityCalculator;
