import React from 'react';
import { Gauge, Rocket } from 'lucide-react';

const Header = () => (
  <header className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
        <Rocket />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Divemotor Dashboard</p>
        <h1 className="text-2xl font-semibold text-slate-900">Análisis estadístico avanzado</h1>
        <p className="text-sm text-slate-600">Insights de margen, ingresos y probabilidad de cierre en segundos.</p>
      </div>
    </div>
    <div className="flex items-center gap-3 text-sm text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
      <Gauge size={18} className="text-indigo-600" />
      <span className="font-medium">Rendimiento en tiempo real</span>
    </div>
  </header>
);

export default Header;
