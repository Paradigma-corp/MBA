import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  CheckSquare,
  ClipboardCopy,
  Download,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  Play,
  Presentation,
  RefreshCw,
  Sparkle,
  Upload,
} from 'lucide-react';
import { buildCorrelationBindings, useBindingsResolver } from '../../hooks/useBindingsResolver.js';
import { formatPercent } from '../../utils/formatters.js';
import { yearFromRecord } from '../../utils/dataParser.js';

const Badge = ({ label, tone = 'info' }) => {
  const toneMap = {
    info: 'bg-sky-100 text-sky-800 border-sky-200',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-rose-100 text-rose-800 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${toneMap[tone] || toneMap.info}`}>{label}</span>;
};

const Callout = ({ tone = 'info', title, children }) => {
  const toneMap = {
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    danger: 'bg-rose-50 border-rose-200 text-rose-900',
  };
  const iconMap = { info: Info, success: BadgeCheck, warn: AlertTriangle, danger: AlertCircle };
  const Icon = iconMap[tone] || Info;
  return (
    <div className={`border rounded-2xl p-3 flex gap-3 items-start ${toneMap[tone] || toneMap.info}`}>
      <div className="mt-0.5">
        <Icon size={16} />
      </div>
      <div className="space-y-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-slate-700">{children}</div>
      </div>
    </div>
  );
};

const FigureCard = ({ figure }) => (
  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
    <div className="p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ImageIcon size={16} className="text-slate-500" />
        <p className="font-semibold text-slate-900 text-sm">{figure.title || 'Evidencia'}</p>
      </div>
      {figure.csv && (
        <a className="text-xs text-celeste-700 hover:underline" href={figure.csv} target="_blank" rel="noreferrer">
          Abrir CSV asociado
        </a>
      )}
    </div>
    {figure.image && <img src={figure.image} alt={figure.title || 'Evidencia'} className="w-full object-cover" />}
    <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 text-[12px] text-slate-600">
      Fuente: BBDD 2022–2025 H1. Parámetros: ver trazabilidad. Exportado desde el dashboard.
    </div>
  </div>
);

const SummaryCard = ({ title, description, badge, metric }) => (
  <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm space-y-2">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs uppercase text-slate-500">{title}</p>
      {badge}
    </div>
    <p className="text-sm text-slate-700 leading-relaxed">{description}</p>
    {metric && (
      <div className="text-2xl font-semibold text-slate-900">
        {typeof metric === 'number' ? metric.toLocaleString('en-US', { maximumFractionDigits: 3 }) : metric}
      </div>
    )}
  </div>
);

const AccordionItem = ({ item, resolveText }) => {
  const [open, setOpen] = useState(false);
  const { text, missing } = resolveText(item.body || '');
  const formatted = text
    .replace(/\n/g, '<br/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
  const hasMissing = missing.length > 0;
  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">{item.subtitle}</p>
        </div>
        <span className="text-xs text-slate-500">{open ? 'Ocultar' : 'Ver'} evidencia</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
          {hasMissing && (
            <Callout tone="warn" title="Alerta tokens vacíos">
              Algunos valores no están disponibles. Ejecute primero los módulos correspondientes y exporte evidencias.
            </Callout>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(item.figures || []).map((figure) => (
              <FigureCard key={figure.id} figure={figure} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RecommendationItem = ({ item }) => (
  <div className="flex items-start gap-3 border border-slate-200 rounded-2xl p-3 bg-white shadow-sm">
    <CheckSquare className="mt-0.5 text-emerald-600" size={16} />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
        <Badge label={item.priority} tone={item.priority === 'Alta' ? 'danger' : item.priority === 'Media' ? 'warn' : 'neutral'} />
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{item.detail}</p>
    </div>
  </div>
);

const TraceabilityPanel = ({ summary }) => (
  <div className="border border-slate-200 rounded-2xl bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <Layers size={16} />
        <p className="font-semibold text-slate-900 text-sm">Parámetros y trazabilidad</p>
      </div>
      <button
        type="button"
        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 hover:border-celeste-200"
        onClick={() => {
          const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'trazabilidad.json';
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        Exportar JSON de trazabilidad
      </button>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left px-4 py-2">Módulo</th>
            <th className="text-left px-4 py-2">Parámetros</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((row) => (
            <tr key={row.module} className="border-t border-slate-200">
              <td className="px-4 py-2 font-semibold text-slate-900">{row.module}</td>
              <td className="px-4 py-2 text-slate-700">{row.params}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const defaultConclusions = [
  {
    id: 'c1',
    title: 'Conclusión 1 — Independencia por línea',
    subtitle: 'Correlaciones débiles refuerzan gestión segmentada',
    body:
      '**Correlación por margen** promedio es baja, lo que indica líneas casi independientes. _Evidencia:_ r promedio |margen| = **{{corr.avg_abs_r_margen}}**; caso más extremo (línea vs conjunto) = **{{corr.min_r_linea_vs_conjunto}}**.',
    figures: [],
  },
  {
    id: 'c2',
    title: 'Conclusión 2 — Heterogeneidad de vendedores',
    subtitle: 'Segmentación A/B/C estable',
    body:
      'Participación A = **{{conteo.segmentacion.share_A}}**, B = **{{conteo.segmentacion.share_B}}**, C = **{{conteo.segmentacion.share_C}}**. Mediana P≥k por línea (ej. Autos) = **{{conteo.p_ge_k.mediana_por_linea.AUTOMÓVILES}}**.',
    figures: [],
  },
];

const defaultRecommendations = [
  {
    id: 'r1',
    title: 'Priorizar coaching a líneas con r mínimo vs conjunto',
    detail: 'Refuerza la independencia ajustando metas y coaches donde la correlación es más negativa.',
    priority: 'Alta',
  },
  {
    id: 'r2',
    title: 'Publicar tabla de segmentación A/B/C',
    detail: 'Mantén visible la mediana P≥k por línea para motivar a los vendedores de cada segmento.',
    priority: 'Media',
  },
  {
    id: 'r3',
    title: 'Alinear evidencias en entregables',
    detail: 'Sube las figuras PNG/CSV más recientes desde /Entregables para cada conclusión.',
    priority: 'Baja',
  },
];

const ConclusionsPage = ({
  records = [],
  marginSummaries = [],
  outlierRule = 'pRange',
  showOutliers = true,
  bootstrapIterations = 2000,
  activeFilterYears = new Set(),
}) => {
  const [presentationMode, setPresentationMode] = useState(false);
  const [conclusions] = useState(defaultConclusions);
  const [recommendations] = useState(defaultRecommendations);
  const [evidence, setEvidence] = useState([
    {
      id: 'fig1',
      title: 'Matriz de correlaciones (PNG)',
      image: '/Entregables/PNG/correlaciones.png',
      csv: '/Entregables/CSV/correlaciones.csv',
    },
  ]);

  const correlationBindings = useMemo(() => buildCorrelationBindings(records, 'margen'), [records]);

  const segmentShares = useMemo(() => {
    if (!records.length) return { share_A: null, share_B: null, share_C: null };
    const total = records.length || 1;
    const counts = records.reduce(
      (acc, row) => {
        const seg = row.segmentacionIGD || row.segmentacion || row['Segmento'] || row['segmento'];
        if (seg === 'A') acc.A += 1;
        else if (seg === 'B') acc.B += 1;
        else if (seg === 'C') acc.C += 1;
        return acc;
      },
      { A: 0, B: 0, C: 0 },
    );
    return {
      share_A: counts.A / total,
      share_B: counts.B / total,
      share_C: counts.C / total,
    };
  }, [records]);

  const bindingMap = useMemo(
    () => ({
      corr: {
        avg_abs_r_margen: correlationBindings.avgAbsR,
        min_r_linea_vs_conjunto: correlationBindings.minOneVsAll,
        n_meses: correlationBindings.monthCount,
      },
      conteo: {
        segmentacion: segmentShares,
        p_ge_k: { mediana_por_linea: {} },
      },
      smc: {
        delta_p_por_delta_meta: {},
        p50_margen: {},
        p10_margen: {},
        p90_margen: {},
      },
      mix: { delta_margen: {} },
      fom: {
        semaforo: {},
        margen_p50_vs_meta: {},
      },
    }),
    [correlationBindings.avgAbsR, correlationBindings.minOneVsAll, correlationBindings.monthCount, segmentShares],
  );

  const { resolveText, refresh, timestamp } = useBindingsResolver(bindingMap);

  const boxplotCoverage = marginSummaries.length;

  const periodYears = useMemo(() => {
    const years = records
      .map((r) => yearFromRecord(r))
      .filter((y) => Number.isFinite(y))
      .sort();
    const activeYears = Array.from(activeFilterYears.values()).sort();
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    return {
      span: years.length ? `${minYear} – ${maxYear}` : 'Sin datos',
      active: activeYears.length ? activeYears.join(', ') : 'Todos',
    };
  }, [activeFilterYears, records]);

  const summaryRows = [
    {
      module: 'Conteo',
      params: `K, familia auto/NB, metas dinámicas. Iteraciones: ${bootstrapIterations}.`,
    },
    {
      module: 'SMC',
      params: 'B, E, K, meta usada: — (ejecuta módulo para poblar)',
    },
    {
      module: 'Mix',
      params: 'Último rebalanceo: — (ejecuta optimizador)',
    },
    {
      module: 'FOM',
      params: 'Metas del mes, E_parcial: — (ejecuta forecast)',
    },
    {
      module: 'Correlaciones',
      params: `Métrica: margen; B=${bootstrapIterations}; n_meses=${correlationBindings.monthCount}`,
    },
    {
      module: 'Outliers',
      params: `${outlierRule === 'tukey' ? 'Tukey (IQR)' : 'P10–P90'} • ${
        showOutliers ? 'Incluye outliers' : 'Oculta outliers'
      } • líneas en boxplot: ${boxplotCoverage}`,
    },
  ];

  const addEvidence = () => {
    const nextId = `fig-${Date.now()}`;
    setEvidence((prev) => [
      ...prev,
      {
        id: nextId,
        title: 'Nueva evidencia',
        image: '/Entregables/PNG/placeholder.png',
        csv: '/Entregables/CSV/placeholder.csv',
      },
    ]);
  };

  const copyRecommendations = () => {
    const text = recommendations
      .map((item) => `- [${item.priority}] ${item.title}: ${item.detail}`)
      .join('\n');
    navigator.clipboard?.writeText(text);
  };

  const exportChecklist = () => {
    const header = ['Prioridad', 'Título', 'Detalle'];
    const lines = recommendations.map((rec) => [rec.priority, rec.title, rec.detail].join(','));
    const blob = new Blob([`${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hoja_de_ruta.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const correlationBadge = useMemo(() => {
    const r = correlationBindings.avgAbsR;
    if (!Number.isFinite(r)) return <Badge label="Sin datos" tone="neutral" />;
    if (r >= 0.7) return <Badge label="Correlación fuerte" tone="danger" />;
    if (r >= 0.4) return <Badge label="Correlación moderada" tone="warn" />;
    if (r >= 0.2) return <Badge label="Correlación débil" tone="info" />;
    return <Badge label="Casi independiente" tone="success" />;
  }, [correlationBindings.avgAbsR]);

  return (
    <div className={`space-y-6 ${presentationMode ? 'text-lg' : 'text-base'}`} key={timestamp}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Capítulo final</p>
          <h2 className="text-3xl font-semibold text-slate-900">Conclusiones y Recomendaciones</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPresentationMode((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <Presentation size={16} /> {presentationMode ? 'Salir de modo presentación' : 'Modo Presentación'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <FileText size={16} /> Exportar a PDF
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <RefreshCw size={16} /> Actualiza tokens
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge label={`Periodo analizado: ${periodYears.span}`} />
        <Badge label={`Años activos: ${periodYears.active}`} tone="neutral" />
        <Badge label={`Outliers: ${outlierRule === 'tukey' ? 'Tukey' : 'P10–P90'}`} tone="neutral" />
        <Badge label={`Familia conteos: auto/NB`} tone="neutral" />
        <Badge label={`Bootstrap B=${bootstrapIterations}`} tone="neutral" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-slate-500" />
          <p className="text-lg font-semibold text-slate-900">Sección A — Resumen ejecutivo</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SummaryCard
            title="Card A1 — Independencia por línea"
            description="Correlación predominante calculada con matriz de margen."
            badge={correlationBadge}
            metric={Number.isFinite(correlationBindings.avgAbsR) ? `${formatPercent(correlationBindings.avgAbsR)}` : '—'}
          />
          <SummaryCard
            title="Card A2 — Heterogeneidad de vendedores"
            description="Distribución porcentual de segmentos A/B/C y mediana P≥k."
            badge={<Badge label="Modelo de conteo" tone="info" />}
            metric={`A: ${formatPercent(segmentShares.share_A || 0)} · B: ${formatPercent(
              segmentShares.share_B || 0,
            )} · C: ${formatPercent(segmentShares.share_C || 0)}`}
          />
          <SummaryCard
            title="Card A3 — Efecto Monte Carlo"
            description="Pendiente local Δp/Δmeta (meta ±1)."
            badge={<Badge label="SMC" tone="warn" />}
            metric="— (actualiza módulo)"
          />
          <SummaryCard
            title="Card A4 — Mix interno"
            description="Último escenario de rebalanceo más reciente por línea."
            badge={<Badge label="Mix" tone="info" />}
            metric="— (sin ejecución reciente)"
          />
          <SummaryCard
            title="Card A5 — FOM"
            description="Semáforo de líneas y P50 vs meta."
            badge={<Badge label="Forecast" tone="success" />}
            metric="— (ejecuta forecast)"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkle size={18} className="text-slate-500" />
          <p className="text-lg font-semibold text-slate-900">Sección B — Conclusiones</p>
        </div>
        <Callout tone="info" title="Nota metodológica">
          Las cifras se vinculan a los últimos resultados de las pestañas analíticas (sin recalcular). Para reproducir, revise
          parámetros en “Trazabilidad”.
        </Callout>
        <div className="space-y-3">
          {conclusions.map((item) => (
            <AccordionItem key={item.id} item={{ ...item, figures: evidence }} resolveText={resolveText} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addEvidence}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <Upload size={16} /> Agregar evidencia (PNG/CSV)
          </button>
          <button
            type="button"
            onClick={() => setEvidence((prev) => (prev.length ? prev.slice(0, -1) : prev))}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <Download size={16} /> Eliminar último adjunto
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Play size={18} className="text-slate-500" />
          <p className="text-lg font-semibold text-slate-900">Sección C — Recomendaciones</p>
        </div>
        <div className="space-y-3">
          {recommendations.map((item) => (
            <RecommendationItem key={item.id} item={item} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyRecommendations}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <ClipboardCopy size={16} /> Copiar a portapapeles
          </button>
          <button
            type="button"
            onClick={exportChecklist}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <Download size={16} /> Exportar hoja de ruta (CSV)
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-slate-500" />
          <p className="text-lg font-semibold text-slate-900">Sección D — Parámetros y trazabilidad</p>
        </div>
        <TraceabilityPanel summary={summaryRows} />
      </section>
    </div>
  );
};

export default ConclusionsPage;
