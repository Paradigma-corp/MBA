import React from 'react';
import { Gauge, Rocket } from 'lucide-react';

const Header = () => (
  <header className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 ring-1 ring-white/30">
        <Rocket className="" />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200">Divemotor Dashboard</p>
        <h1 className="text-2xl font-semibold text-white">Análisis estadístico avanzado</h1>
        <p className="text-sm text-slate-300">Insights de margen, ingresos y probabilidad de cierre en segundos.</p>
      </div>
    </div>
    <div className="flex items-center gap-3 text-sm text-indigo-100 bg-white/10 border border-white/15 px-3 py-2 rounded-xl">
      <Gauge size={18} />
      <span>Rendimiento en tiempo real</span>
    </div>
  </header>
);

export default Header;
