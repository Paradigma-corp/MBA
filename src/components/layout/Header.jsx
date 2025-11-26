import React from 'react';
import { Bell, CalendarDays, Rocket, Sparkles } from 'lucide-react';

const Header = () => (
  <header className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-black via-black to-celeste-600 text-white flex items-center justify-center shadow-lg shadow-celeste-200/60">
        <Rocket />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Divemotor Dashboard</p>
        <h1 className="text-2xl font-semibold text-slate-900">Panel ejecutivo de desempeño</h1>
        <p className="text-sm text-slate-600">Monitorea márgenes, ingresos y metas de cierre con exactitud estadística.</p>
      </div>
    </div>
    <div className="flex items-center gap-3 text-sm">
      <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 border border-slate-200 shadow-sm text-slate-800">
        <CalendarDays size={18} className="text-celeste-700" />
        <span>Semana analizada: Hoy</span>
      </div>
      <button type="button" className="h-10 w-10 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-celeste-700">
        <Bell size={18} />
      </button>
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-gradient-to-r from-black to-celeste-600 text-white shadow-md">
        <Sparkles size={16} />
        <span className="text-sm font-semibold">Live insights</span>
      </div>
    </div>
  </header>
);

export default Header;
