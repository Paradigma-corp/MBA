import React from 'react';
import { Gauge, Rocket } from 'lucide-react';

const Header = () => (
  <header className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <Rocket className="text-indigo-600" />
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Divemotor Dashboard</p>
        <h1 className="text-xl font-semibold text-slate-900">Análisis estadístico avanzado</h1>
      </div>
    </div>
    <div className="flex items-center gap-3 text-sm text-slate-700">
      <Gauge size={18} />
      <span>Rendimiento en tiempo real</span>
    </div>
  </header>
);

export default Header;
