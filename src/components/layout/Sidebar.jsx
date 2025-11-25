import React from 'react';
import { SlidersHorizontal, Repeat } from 'lucide-react';

const Sidebar = ({ config, setConfig, bootstrapIterations, setBootstrapIterations, onReset }) => {
  return (
    <aside className="card w-full lg:w-80 h-max sticky top-4">
      <div className="flex items-center gap-2 mb-3 text-slate-800">
        <SlidersHorizontal size={18} />
        <h2 className="font-semibold">Configuración del modelo</h2>
      </div>
      <div className="space-y-3 text-sm">
        {[
          { key: 'rSquared', label: 'R²' },
          { key: 'betaIngreso', label: 'β Ingreso' },
          { key: 'betaCosto', label: 'β Costo' },
          { key: 'pearsonCoef', label: 'Coef. Pearson' },
        ].map((field) => (
          <label key={field.key} className="block text-slate-700">
            <span className="font-medium">{field.label}</span>
            <input
              type="number"
              step="0.01"
              value={config[field.key]}
              onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        ))}
        <label className="block text-slate-700">
          <span className="font-medium">Iteraciones Bootstrap</span>
          <input
            type="number"
            min="100"
            step="100"
            value={bootstrapIterations}
            onChange={(e) => setBootstrapIterations(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 text-indigo-700 font-semibold hover:text-indigo-900"
        >
          <Repeat size={16} /> Reiniciar a demo
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
