import React, { useMemo, useState } from 'react';

const Checkbox = ({ checked }) => (
  <span
    className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition ${
      checked ? 'bg-celeste-600 border-celeste-600' : 'bg-white border-slate-300'
    }`}
    aria-hidden="true"
  >
    {checked && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
  </span>
);

const VendorMultiSelect = ({ options = [], valueSet = new Set(), onChange, placeholder = 'Selecciona vendedores' }) => {
  const [query, setQuery] = useState('');

  const groupedOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
      : options;

    const grouped = filtered.reduce((acc, option) => {
      const key = option.line || '—';
      if (!acc[key]) acc[key] = [];
      acc[key].push(option);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, opts]) => ({ label, options: opts.sort((x, y) => x.label.localeCompare(y.label)) }));
  }, [options, query]);

  const selected = useMemo(() => new Set(Array.from(valueSet).filter(Boolean)), [valueSet]);

  const toggleVendor = (vendor) => {
    const next = new Set(selected);
    if (next.has(vendor)) {
      next.delete(vendor);
    } else {
      next.add(vendor);
    }
    onChange(next);
  };

  const selectAll = () => onChange(new Set(options.map((opt) => opt.value)));
  const clearAll = () => onChange(new Set());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Vendedor</span>
        <div className="flex items-center gap-2">
          <button type="button" className="text-celeste-700 hover:text-celeste-800" onClick={clearAll}>
            Limpiar
          </button>
          <button type="button" className="text-celeste-700 hover:text-celeste-800" onClick={selectAll}>
            Seleccionar todos
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-celeste-400 focus:outline-none"
          aria-label="Buscar vendedor"
        />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {groupedOptions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">Sin coincidencias</p>
        ) : (
          groupedOptions.map((group) => (
            <div key={group.label} className="border-b border-slate-100 last:border-b-0">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{group.label}</p>
              <ul className="divide-y divide-slate-100">
                {group.options.map((option) => {
                  const checked = selected.has(option.value);
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        onClick={() => toggleVendor(option.value)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                          checked ? 'bg-celeste-50 text-celeste-900' : 'text-slate-800'
                        }`}
                      >
                        <Checkbox checked={checked} />
                        <span>{option.label}</span>
                        {option.line && <span className="ml-auto text-[11px] text-slate-500">{option.line}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VendorMultiSelect;
