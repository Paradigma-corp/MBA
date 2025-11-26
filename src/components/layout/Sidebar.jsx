import React from 'react';
import { Repeat, Settings2 } from 'lucide-react';

const Sidebar = ({ config, setConfig, bootstrapIterations, setBootstrapIterations, onReset }) => {
  return (
    <aside className="card w-full lg:w-80 h-max sticky top-4 p-0 overflow-hidden">
      <div className="bg-gradient-to-r from-black to-celeste-600 text-white px-5 py-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
          <Settings2 size={18} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/80">Modelo</p>
          <h2 className="font-semibold text-sm">Ajustes avanzados</h2>
        </div>
      </div>
      <div className="p-5 space-y-4 text-sm">
        {[
          { key: 'rSquared', label: 'R²' },
          { key: 'betaIngreso', label: 'β Ingreso' },
          { key: 'betaCosto', label: 'β Costo' },
          { key: 'pearsonCoef', label: 'Coef. Pearson' },
        ].map((field) => (
          <label key={field.key} className="block text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-medium">{field.label}</span>
              <span className="text-[11px] text-slate-500">Editable</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={config[field.key]}
              onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-celeste-500"
            />
          </label>
        ))}
        <label className="block text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium">Iteraciones Bootstrap</span>
            <span className="text-[11px] text-slate-500">Precisión</span>
          </div>
            <input
              type="number"
              min="100"
              step="100"
              value={bootstrapIterations}
              onChange={(e) => setBootstrapIterations(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-celeste-500"
          />
        </label>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 text-celeste-700 font-semibold hover:text-celeste-900"
        >
          <Repeat size={16} /> Reiniciar a demo
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
