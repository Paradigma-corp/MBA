import React, { useMemo, useState } from 'react';

const WaterfallCalculator = () => {
  const [base, setBase] = useState(100000);
  const [priceEffect, setPriceEffect] = useState(12000);
  const [volumeEffect, setVolumeEffect] = useState(8000);
  const [mixEffect, setMixEffect] = useState(-5000);

  const total = useMemo(() => base + priceEffect + volumeEffect + mixEffect, [base, priceEffect, volumeEffect, mixEffect]);

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-slate-900 mb-2">Análisis waterfall simple</h3>
      <p className="text-sm text-slate-600 mb-3">Descompón la variación del margen en efectos aditivos.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="text-slate-700">
          <span className="font-medium">Margen base</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
          />
        </label>
        <label className="text-slate-700">
          <span className="font-medium">Efecto precio</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={priceEffect}
            onChange={(e) => setPriceEffect(Number(e.target.value))}
          />
        </label>
        <label className="text-slate-700">
          <span className="font-medium">Efecto volumen</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={volumeEffect}
            onChange={(e) => setVolumeEffect(Number(e.target.value))}
          />
        </label>
        <label className="text-slate-700">
          <span className="font-medium">Efecto mix</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            value={mixEffect}
            onChange={(e) => setMixEffect(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-sky-50 text-sky-800 font-semibold">Margen proyectado: {total}</div>
    </div>
  );
};

export default WaterfallCalculator;
