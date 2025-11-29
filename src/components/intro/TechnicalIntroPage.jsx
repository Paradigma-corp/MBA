import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CloudDownload,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { businessLineFromRecord, conditionFromRecord, yearFromRecord } from '../../utils/dataParser.js';

const Pill = ({ label, tone = 'info' }) => {
  const toneMap = {
    info: 'bg-sky-100 text-sky-800 border-sky-200',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-100 text-amber-800 border-amber-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${toneMap[tone] || toneMap.info}`}>
      {label}
    </span>
  );
};

const Card = ({ title, icon: Icon, children }) => (
  <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm space-y-2">
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-xl bg-black text-white flex items-center justify-center shadow-sm">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs uppercase text-slate-500">{title}</p>
        <p className="text-sm text-slate-800">{children}</p>
      </div>
    </div>
  </div>
);

const Section = ({ title, children, actions }) => (
  <section className="border border-slate-200 rounded-3xl bg-white shadow-sm p-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-slate-500">Pestaña informativa</p>
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const ArchitectureDiagram = () => (
  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
    <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
      <Network size={16} />
      <p>
        Esta pestaña NO recalcula; solo lee parámetros/resultados ya ejecutados. Tracea el flujo desde ingesta hasta
        exportables.
      </p>
    </div>
    <svg viewBox="0 0 800 260" className="w-full" role="img" aria-label="Diagrama de arquitectura analítica">
      <defs>
        <linearGradient id="ingest" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
        <linearGradient id="state" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id="modules" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#99f6e4" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <rect x="20" y="40" width="170" height="80" rx="14" fill="url(#ingest)" stroke="#1e293b" opacity="0.95" />
      <text x="105" y="70" textAnchor="middle" fontSize="13" fill="#0f172a" fontWeight="700">
        Ingesta
      </text>
      <text x="105" y="90" textAnchor="middle" fontSize="11" fill="#0f172a">
        CSV/Excel → Validador
      </text>
      <text x="105" y="110" textAnchor="middle" fontSize="11" fill="#0f172a">
        Columnas obligatorias
      </text>

      <rect x="240" y="40" width="170" height="80" rx="14" fill="url(#state)" stroke="#1e293b" opacity="0.95" />
      <text x="325" y="70" textAnchor="middle" fontSize="13" fill="#0f172a" fontWeight="700">
        Capa de estado
      </text>
      <text x="325" y="90" textAnchor="middle" fontSize="11" fill="#0f172a">
        filters · params · results
      </text>
      <text x="325" y="110" textAnchor="middle" fontSize="11" fill="#0f172a">
        K/E/B/metas/outliers/familia
      </text>

      <rect x="460" y="40" width="220" height="80" rx="14" fill="url(#modules)" stroke="#0f172a" opacity="0.95" />
      <text x="570" y="68" textAnchor="middle" fontSize="13" fill="#0f172a" fontWeight="700">
        Módulos analíticos
      </text>
      <text x="570" y="88" textAnchor="middle" fontSize="11" fill="#0f172a">
        Conteo · SMC · Mix · FOM
      </text>
      <text x="570" y="108" textAnchor="middle" fontSize="11" fill="#0f172a">
        Correlaciones (timestamp)
      </text>

      <rect x="700" y="40" width="80" height="80" rx="14" fill="#fef9c3" stroke="#ca8a04" opacity="0.95" />
      <text x="740" y="70" textAnchor="middle" fontSize="12" fill="#92400e" fontWeight="700">
        Export
      </text>
      <text x="740" y="90" textAnchor="middle" fontSize="11" fill="#92400e">
        CSV · PNG
      </text>
      <text x="740" y="110" textAnchor="middle" fontSize="11" fill="#92400e">
        PDF trazable
      </text>

      <path d="M190 80 H230" stroke="#0f172a" strokeWidth="2" markerEnd="url(#arrow)" />
      <path d="M410 80 H452" stroke="#0f172a" strokeWidth="2" markerEnd="url(#arrow)" />
      <path d="M680 80 H695" stroke="#0f172a" strokeWidth="2" markerEnd="url(#arrow)" />
      <path d="M570 122 V180 H105 V122" stroke="#0f172a" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />

      <rect x="100" y="180" width="460" height="54" rx="12" fill="#e2e8f0" stroke="#1e293b" opacity="0.9" />
      <text x="330" y="210" textAnchor="middle" fontSize="12" fill="#0f172a" fontWeight="700">
        /Entregables/CSV · /Entregables/PNG · Export PDF (pies APA)
      </text>

      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#0f172a" />
        </marker>
      </defs>
    </svg>
  </div>
);

const Accordion = ({ items }) => {
  const [openIndex, setOpenIndex] = useState(null);
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <div key={item.title} className="border border-slate-200 rounded-2xl bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.tldr}</p>
              </div>
              <span className="text-xs text-slate-500">{open ? 'Ocultar' : 'Ver detalle'}</span>
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-2 text-sm text-slate-700 leading-relaxed">
                <p className="font-semibold text-slate-900">TL;DR</p>
                <p>{item.summary}</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                {item.link && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-celeste-700 text-sm font-semibold hover:underline"
                    onClick={item.link.onClick}
                  >
                    <ArrowRightIcon /> {item.link.label}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ArrowRightIcon = () => <span aria-hidden className="text-celeste-700 font-semibold">→</span>;

const TechBadge = ({ label }) => (
  <span className="px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700">
    {label}
  </span>
);

const GovernanceList = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {items.map((item) => (
      <div key={item.title} className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex gap-3">
        <ShieldCheck size={18} className="text-emerald-600 mt-0.5" />
        <div className="text-sm text-slate-700 space-y-1">
          <p className="font-semibold text-slate-900">{item.title}</p>
          <p>{item.body}</p>
        </div>
      </div>
    ))}
  </div>
);

const TechnicalIntroPage = ({
  records = [],
  filters,
  outlierRule,
  showOutliers,
  bootstrapIterations,
  onNavigate,
}) => {
  const [presentationMode, setPresentationMode] = useState(false);

  const context = useMemo(() => {
    const filterYears = filters?.years instanceof Set ? Array.from(filters.years) : [];
    const years = filterYears.length
      ? filterYears
      : records.map((record) => yearFromRecord(record)).filter((year) => Number.isFinite(year));
    const minYear = years.length ? Math.min(...years) : '—';
    const maxYear = years.length ? Math.max(...years) : '—';
    const lines = new Set(records.map((record) => businessLineFromRecord(record) || 'Sin línea'));
    const conditions = new Set(records.map((record) => conditionFromRecord(record) || '—'));
    if (filters?.condicion && filters.condicion !== 'Todos') conditions.add(filters.condicion);
    return {
      minYear,
      maxYear,
      lines: Array.from(lines).filter(Boolean),
      conditions: Array.from(conditions).filter(Boolean),
    };
  }, [filters, records]);

  const columns = [
    'Año',
    'Mes',
    'Nuevo/Usado',
    'Línea de Negocio',
    'Marca',
    'Nombre marca',
    'Nombre modelo',
    'Modelo Estándar',
    'nombreVendedor',
    'Unidades UN',
    'ingresos',
    'costos',
    'margen',
  ];

  const methodologyItems = [
    {
      title: 'Modelo de conteo con exposición (Poisson/NB)',
      tldr: 'P(N≥k) por línea y vendedor usando λ̂ y exposición E.',
      summary: 'Probabilidad de cumplir k en horizonte E. Incluye criterio NB por varianza>1.5×media y CDF monótona.',
      points: [
        'Entrada: Unidades UN por mes (Año–Mes–Línea–vendedor).',
        'Exposición E; en FOM se usa E_parcial al no tener campo “día”.',
        'Salida: P(N≥k), λ̂, familia (Poisson/NB) y r (método de momentos).',
      ],
      link: { label: 'Ir a Modelo de conteo', onClick: () => onNavigate?.('counting') },
    },
    {
      title: 'Simulación Monte Carlo (SMC)',
      tldr: 'Conteos con distribución de conteo y remuestreo de montos.',
      summary: 'N ~ Poisson/NB con μ = λ̂·E; montos via trimming P10–P90 o Tukey. Devuelve p̂ y percentiles.',
      points: [
        'Permite ver cómo cambia p̂ al ajustar meta ±1 unidad/US$.',
        'P50 [P10–P90] de margen_unit y precio_unit (opcional).',
        'Alertas cuando el módulo no se ha ejecutado con filtros vigentes.',
      ],
      link: { label: 'Ir a SMC', onClick: () => onNavigate?.('smc') },
    },
    {
      title: 'Optimizador de mix interno (knapsack ligero)',
      tldr: 'Rebalanceo/cresc. respetando min/max share y cap_m.',
      summary: 'Usa mediana de margen_unit (tras trimming) como retorno r_m y P90 unidades como cap_m. Genera plan modelo–unidades.',
      points: [
        'Rebalanceo: mover hasta X unidades sin violar restricciones.',
        'Crecimiento: asignar ΔU a mejores r_m.',
        'Salida: Δ$ margen y plan exportable a CSV.',
      ],
      link: { label: 'Ir a Mix', onClick: () => onNavigate?.('mix') },
    },
    {
      title: 'FOM — Pronóstico de fin de mes',
      tldr: 'Observado + remanente simulado con E_restante = 1 − E_parcial.',
      summary: 'Semáforo por probabilidad de cumplir metas (Verde ≥70%, Ámbar 40–70%, Rojo <40%). Ajuste manual de E_parcial.',
      points: [
        'Integra metas editables y exposición parcial.',
        'Reporta p̂, P50 y p-bands alineados a metas vigentes.',
        'Trazabilidad lista para exportar con pies APA.',
      ],
      link: { label: 'Ir a FOM', onClick: () => onNavigate?.('fom') },
    },
    {
      title: 'Correlaciones entre líneas',
      tldr: 'Pearson r (1↔1 y 1 vs conjunto) con bootstrap B=2,000.',
      summary: 'Alinea meses comunes, exige n_meses≥6, reporta r, p-value e IC95% bootstrap. Incluye métrica configurable.',
      points: [
        'Promedio |r| y r mínimo línea vs conjunto para diagnosticar independencia.',
        'Usa serie mensual por métrica (margen/ingresos/costos/unidades).',
        'Exporta heatmaps y CSV en /Entregables.',
      ],
      link: { label: 'Ir a Correlaciones', onClick: () => onNavigate?.('correlations') },
    },
  ];

  const techStack = [
    'React + Tailwind',
    'lucide-react UI',
    'shadcn/ui opcional',
    'Charts (Recharts/echarts)',
    'Web Workers (SMC/Bootstrap)',
    'CSV/Excel ingest',
    'Bootstrap 2,000–5,000',
    'Poisson/NB, MAD/IQR, quantiles',
    'Export CSV/PNG/PDF',
    'Trazabilidad JSON',
  ];

  const governance = [
    {
      title: 'QA numérico',
      body: 'Conteo: CDF monótona; NB solo si var≫mean. SMC: Prob vs meta decreciente; percentiles consistentes.',
    },
    {
      title: 'Mix y FOM',
      body: 'Mix respeta min/max share y cap_m; Δ$ = Σ(du * r_m). FOM coherente con E_parcial y semáforos documentados.',
    },
    {
      title: 'Correlaciones',
      body: 'Meses alineados, n_meses<6 → N/A, IC95% bootstrap. Auditoría de parámetros por ejecución.',
    },
  ];

  const presentationClasses = presentationMode ? 'text-[17px] leading-8' : '';

  return (
    <div className={`space-y-6 ${presentationClasses}`}>
      <Section
        title="Introducción técnica y guía de navegación"
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={presentationMode}
                onChange={(e) => setPresentationMode(e.target.checked)}
                className="rounded border-slate-300 text-celeste-600 focus:ring-celeste-500"
              />
              Modo Presentación
            </label>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:border-celeste-200"
            >
              <FileText size={16} /> Exportar Introducción (PDF)
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-lg text-slate-700">
              Metodologías, arquitectura y criterios de calidad del sistema analítico. Pestaña de solo lectura enlazada al mismo
              estado global de filtros y parámetros (Año, Mes, Línea, Nuevo/Usado, outliers, K/E/B, metas, familia Poisson/NB).
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <Pill label={`Periodo: ${context.minYear}–${context.maxYear}`} />
              <Pill label={`Líneas: ${context.lines.join(', ') || '—'}`} tone="neutral" />
              <Pill label={`Condición: ${context.conditions.join(', ') || '—'}`} tone="neutral" />
              <Pill label={`Outliers: ${showOutliers ? 'Mostrar' : 'Ocultar'} (${outlierRule === 'tukey' ? 'Tukey' : 'P10–P90'})`} tone="warn" />
              <Pill label={`Bootstrap B=${bootstrapIterations.toLocaleString('en-US')}`} tone="info" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card title="Alcance" icon={Sparkles}>
                Periodo 2022–2025 H1; líneas independientes: Autos, Vans, Camiones, Buses.
              </Card>
              <Card title="Módulos" icon={LayoutDashboard}>
                Conteo (Poisson/NB), SMC, Mix (knapsack ligero), FOM, Correlaciones.
              </Card>
              <Card title="Datos" icon={Server}>
                Transacciones mensuales sin campo “día”; metas editables; outliers configurables.
              </Card>
              <Card title="Exportables" icon={CloudDownload}>
                CSV/PNG/PDF con trazabilidad (K/E/B/outliers/metas) y pies APA.
              </Card>
            </div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 shadow-inner space-y-3">
            <div className="flex items-center gap-2 text-slate-700">
              <BookOpen size={18} />
              <p className="font-semibold">Datos (solo lectura en esta pestaña)</p>
            </div>
            <p className="text-sm text-slate-600">
              Cada fila es una transacción. El análisis agrega por Año–Mes–Línea o por vendedor–línea según el módulo.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
              {columns.map((col) => (
                <div key={col} className="px-3 py-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                  <HelpCircle size={14} className="text-slate-400" />
                  <span className="font-semibold">{col}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Nota de datos</p>
              <p>
                La base es transaccional a nivel mensual; no existe campo “día”. La exposición parcial del mes (E_parcial) se
                facilita manualmente en FOM.
              </p>
              <p>
                Outliers: Trimming P10–P90 o Tukey 1.5·IQR aplica a montos unitarios; reportamos versión sin recorte cuando es
                relevante.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Arquitectura del sistema" actions={<Pill label="Tooltip: solo lectura" tone="warn" />}>
        <ArchitectureDiagram />
      </Section>

      <Section title="Metodologías estadísticas">
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 mb-3">
          <p className="font-semibold text-slate-800">Nota de elección NB</p>
          <p>Se adopta Negativa Binomial si la varianza de los conteos excede 1.5× la media (criterio operativo).</p>
        </div>
        <Accordion items={methodologyItems} />
      </Section>

      <Section title="Tecnologías y componentes">
        <div className="flex flex-wrap gap-2">
          {techStack.map((item) => (
            <TechBadge key={item} label={item} />
          ))}
        </div>
      </Section>

      <Section title="Gobernanza, QA y trazabilidad">
        <GovernanceList items={governance} />
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Trazabilidad</p>
          <p>
            Cada exportable incluye pie APA y los parámetros de ejecución (K/E/B/outliers/metas/familia). Si falta algún
            resultado, mostrar advertencia sutil: “Ejecuta el módulo X y exporta sus resultados”.
          </p>
        </div>
      </Section>

    </div>
  );
};

export default TechnicalIntroPage;
