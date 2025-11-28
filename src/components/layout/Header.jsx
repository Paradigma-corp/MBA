import React from 'react';

const Header = () => (
  <header className="flex flex-wrap items-center justify-between gap-4">
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Divemotor dashboard</p>
      <h1 className="text-3xl font-semibold text-slate-900">Panel ejecutivo de desempeño</h1>
      <p className="text-sm text-slate-600 max-w-3xl">
        Inspirado en el portal corporativo: visuales claros, contrastes negro/blanco y acentos celestes para presentar métricas confiables.
      </p>
    </div>
    <div className="flex items-center gap-3 text-sm">
      <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-800">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        <span>Actualizado al último CSV</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white shadow-sm">
        <span className="text-xs uppercase tracking-[0.14em]">Vista gerencial</span>
      </div>
    </div>
  </header>
);

export default Header;
