import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Info, RefreshCw } from 'lucide-react';
import { normalizeBusinessLine } from '../../utils/dataParser.js';

const RATE_BASE_OPTIONS = [
  { value: 1000, label: 'por 1,000 unidades de exposición' },
  { value: 10000, label: 'por 10,000 unidades de exposición' },
];

const priorityLabel = (rate) => {
  if (rate >= 15) return { label: 'Crítica', tone: 'text-red-700 bg-red-50 border-red-200' };
  if (rate >= 8) return { label: 'Alta', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
  if (rate >= 3) return { label: 'Media', tone: 'text-blue-700 bg-blue-50 border-blue-200' };
  return { label: 'Baja', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
};

const deriveDefaultRows = (records) => {
  const baseLines = ['Automóviles', 'Vans', 'Camiones', 'Buses'];
  const map = new Map(baseLines.map((line) => [line, { eventos: 0, exposicion: 0 }]));

  records.forEach((record) => {
    const line = normalizeBusinessLine(
      record.lineaNegocio ||
        record['Linea de negocio'] ||
        record['Línea de negocio'] ||
        record['lineaNegocio'] ||
        record['Linea Negocio'] ||
        record['Línea Negocio'] ||
        record['linea de negocio'] ||
        record['línea de negocio'] ||
        record['Nombre segmentación'],
    );
    if (!line) return;
    const exposicion = Number(record['Unidades UN'] ?? record.unidades ?? record.unidadesVendidas ?? record.unidades) || 0;
    const prev = map.get(line) || { eventos: 0, exposicion: 0 };
    map.set(line, {
      eventos: prev.eventos + 1,
      exposicion: prev.exposicion + exposicion,
    });
  });

  const rows = Array.from(map.entries()).map(([line, data]) => ({
    line,
    eventos: data.eventos || 1,
    exposicion: data.exposicion || 100,
  }));

  return rows.length ? rows : baseLines.map((line) => ({ line, eventos: 3, exposicion: 120 }));
};

const CountingExposurePanel = ({ records = [] }) => {
  const [rateBase, setRateBase] = useState(1000);
  const [rows, setRows] = useState(() => deriveDefaultRows(records));

  const defaultRows = useMemo(() => deriveDefaultRows(records), [records]);

  useEffect(() => {
    setRows(defaultRows);
  }, [defaultRows]);

  const updateRow = (index, key, value) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, { line: 'Nueva línea', eventos: 0, exposicion: 100 }]);
  };

  const sortedRows = useMemo(() => {
    return rows
      .map((row) => {
        const eventos = Number(row.eventos) || 0;
        const exposicion = Number(row.exposicion) || 0;
        const rate = exposicion > 0 ? (eventos / exposicion) * rateBase : 0;
        const priority = priorityLabel(rate);
        return { ...row, eventos, exposicion, rate, priority };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [rateBase, rows]);

  const top = sortedRows[0];
  const interpretation = top
    ? `La mayor tasa se observa en ${top.line} con ${top.rate.toFixed(1)} eventos ${RATE_BASE_OPTIONS.find((o) => o.value === rateBase)?.label || ''}, por lo que debe priorizarse en alertas y recursos operativos.`
    : 'Aún no hay datos para priorizar.';

  return (
    <div className="space-y-5">
      <div className="card border border-slate-200 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="space-y-1">
            <p className="text-xs uppercase text-slate-500">Nuevo panel</p>
            <h2 className="text-xl font-semibold text-slate-900">Modelo de conteo con exposición por línea de negocio</h2>
            <p className="text-sm text-slate-600 max-w-3xl">
              Ingresa eventos y la exposición (horas operativas, recorridos, unidades atendidas) para cada línea. Calculamos la tasa
              ajustada por exposición y ordenamos para priorizar intervenciones.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={rateBase}
              onChange={(e) => setRateBase(Number(e.target.value))}
              className="text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-celeste-500"
            >
              {RATE_BASE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Tasa {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setRows(defaultRows)}
              className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-celeste-200 hover:text-celeste-800"
            >
              <RefreshCw size={16} /> Cargar datos filtrados
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <BarChart3 size={18} />
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              <p className="text-xs uppercase text-slate-500">Priorización operativa</p>
              <p className="font-semibold">Ordena por tasa ajustada</p>
              <p className="text-slate-600">La tabla clasifica de mayor a menor tasa para asignar recursos donde el riesgo es mayor.</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <Info size={18} />
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              <p className="text-xs uppercase text-slate-500">Modelo de conteo con exposición</p>
              <p className="font-semibold">Tasa = eventos / exposición</p>
              <p className="text-slate-600">Normalizamos por la exposición que definas (km, horas, órdenes) para comparar líneas con tamaños distintos.</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
              <AlertTriangle size={18} />
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              <p className="text-xs uppercase text-slate-500">Interpretación automática</p>
              <p className="font-semibold">Detecta la línea crítica</p>
              <p className="text-slate-600">Mostramos la línea con mayor tasa y sugiere priorizarla en alertas y asignación operativa.</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-slate-700">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] tracking-[0.08em]">
              <tr>
                <th className="px-4 py-3 rounded-tl-2xl">Línea de negocio</th>
                <th className="px-4 py-3 text-right">Eventos</th>
                <th className="px-4 py-3 text-right">Exposición</th>
                <th className="px-4 py-3 text-right">Tasa ajustada</th>
                <th className="px-4 py-3 rounded-tr-2xl">Prioridad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {sortedRows.map((row, index) => (
                <tr key={`${row.line}-${index}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <input
                      type="text"
                      value={row.line}
                      onChange={(e) => updateRow(index, 'line', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-celeste-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.eventos}
                      onChange={(e) => updateRow(index, 'eventos', Number(e.target.value))}
                      className="w-full text-right rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-celeste-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.exposicion}
                      onChange={(e) => updateRow(index, 'exposicion', Number(e.target.value))}
                      className="w-full text-right rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-celeste-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{row.rate.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${row.priority.tone}`}>
                      {row.priority.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <p className="font-semibold">Interpretación</p>
            <p className="text-slate-600 mt-1">{interpretation}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-celeste-700 font-semibold hover:border-celeste-200 hover:text-celeste-800"
            >
              Agregar línea
            </button>
            <span className="text-xs text-slate-500">Edita eventos y exposición para reflejar tu operación.</span>
          </div>
        </div>
      </div>

      <div className="card border border-slate-200 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Cómo usar este modelo</p>
            <h3 className="text-base font-semibold text-slate-900">Pasos rápidos</h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-600 border border-slate-200">Conteos + exposición</span>
        </div>
        <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
          <li>Revisa la exposición: puede ser horas-hombre, kilómetros recorridos, órdenes atendidas o flota activa.</li>
          <li>Ingresa los eventos operativos relevantes (incidencias, fallas, reclamos, atenciones) por línea.</li>
          <li>Observa la tasa ajustada y prioriza las líneas con etiqueta Crítica o Alta para asignar recursos y mitigación.</li>
          <li>Usa la opción "Cargar datos filtrados" para reutilizar la exposición del CSV y luego ajustar manualmente.</li>
        </ol>
      </div>
    </div>
  );
};

export default CountingExposurePanel;
