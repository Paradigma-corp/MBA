import React, { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  CheckSquare2,
  ClipboardCopy,
  FileText,
  Layers,
  Lightbulb,
  Presentation,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

const Chip = ({ label }) => (
  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs border border-slate-200 font-semibold">
    {label}
  </span>
);

const SummaryCard = ({ icon: Icon, title, bullets }) => (
  <div className="border border-slate-200 rounded-2xl bg-white shadow-sm p-4 space-y-2">
    <div className="flex items-center gap-2">
      <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
        <Icon size={18} />
      </div>
      <p className="font-semibold text-slate-900 text-sm">{title}</p>
    </div>
    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
      {bullets.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  </div>
);

const AccordionItem = ({ title, bullets }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{open ? 'Ocultar detalle' : 'Ver detalle'}</p>
        </div>
        <span className="text-xs text-slate-500">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 px-4 pb-4">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const RecommendationItem = ({ item }) => (
  <div className="flex items-start gap-3 border border-slate-200 rounded-2xl p-3 bg-white shadow-sm">
    <CheckSquare2 className="mt-0.5 text-emerald-600" size={16} />
    <div className="flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
        <span
          className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${
            item.priority === 'Alta'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {item.priority}
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{item.detail}</p>
    </div>
  </div>
);

const ConclusionsPage = () => {
  const [presentationMode, setPresentationMode] = useState(false);

  const executiveCards = [
    {
      icon: BadgeCheck,
      title: 'Gestión basada en datos',
      bullets: [
        'El dashboard permite decisiones cuantitativas y auditables.',
        'Los 5 módulos revelan patrones operativos útiles para la acción.',
      ],
    },
    {
      icon: Target,
      title: 'Líneas independientes',
      bullets: [
        'Dinámicas, estacionalidad y riesgo diferenciados por línea.',
        'Correlaciones débiles/negativas: evitar estrategias transversales.',
      ],
    },
    {
      icon: Users,
      title: 'Heterogeneidad comercial',
      bullets: [
        'Perfiles A/B/C de vendedores consistentes en el tiempo.',
        'Base para metas, asignación de leads y apoyo interno.',
      ],
    },
    {
      icon: Lightbulb,
      title: 'Metas por probabilidad',
      bullets: [
        'Monte Carlo evidencia que metas deben fijarse por probabilidad de cumplimiento.',
        'Cambios pequeños en la meta → cambios grandes en la probabilidad.',
      ],
    },
    {
      icon: TrendingUp,
      title: 'Mix interno > volumen',
      bullets: [
        'Mejoras sustanciales provienen de re-balancear modelos hacia mayor margen unitario.',
        'Reubicar pocas unidades puede subir el margen mensual de forma significativa.',
      ],
    },
    {
      icon: Presentation,
      title: 'FOM operativo',
      bullets: [
        'Proyección de fin de mes + semáforo anticipan el cierre.',
        'Facilita acciones correctivas antes del final de mes.',
      ],
    },
  ];

  const thematicAccordions = [
    {
      title: 'Diferenciación por línea',
      bullets: [
        'Cada línea responde a drivers propios.',
        'Planificación, precios e inventarios deben ser segmentados por línea.',
      ],
    },
    {
      title: 'Perfiles de vendedores',
      bullets: [
        'Perfiles A/B/C estables y reproducibles.',
        'Insumo directo para metas, recursos y coaching.',
      ],
    },
    {
      title: 'Metas y escenarios',
      bullets: [
        'Metas de unidades/ingresos/margen deben definirse por probabilidad.',
        'Visualizar rangos plausibles (P10–P90) mejora la comunicación gerencial.',
      ],
    },
    {
      title: 'Optimización del mix',
      bullets: [
        'Parte relevante de la mejora viene del mix, no del volumen.',
        'Foco en modelos de alto retorno y con capacidad histórica suficiente.',
      ],
    },
    {
      title: 'Pronóstico de fin de mes (FOM)',
      bullets: [
        'Integra avance del mes + estimación de remanente.',
        'Semáforos orientan la priorización operativa semanal.',
      ],
    },
  ];

  const recommendations = [
    {
      title: 'Usar segmentación A/B/C para metas diferenciadas por vendedor.',
      detail: 'Planificación comercial basada en perfiles consistentes.',
      priority: 'Alta',
    },
    {
      title: 'Definir metas mensuales y anuales con escenarios de probabilidad de cumplimiento.',
      detail: 'Metas y escenarios fundamentados en probabilidades.',
      priority: 'Alta',
    },
    {
      title: 'Distribuir leads según Priority Index (éxito + retorno esperado).',
      detail: 'Asignación operativa enfocada en impacto económico.',
      priority: 'Alta',
    },
    {
      title: 'Priorizar en backoffice y autorizaciones a perfiles de mayor impacto económico.',
      detail: 'Secuencia operativa alineada con valor esperado.',
      priority: 'Media',
    },
    {
      title: 'Ejecutar rebalanceos mensuales del mix; priorizar modelos con alto margen unitario y capacidad histórica.',
      detail: 'Mix e inventario guiados por retornos observados.',
      priority: 'Alta',
    },
    {
      title: 'Monitorear y corregir márgenes atípicamente bajos (“fugas”).',
      detail: 'Control de calidad de margen para evitar erosión.',
      priority: 'Alta',
    },
    {
      title: 'Definir inventarios por línea, evitando políticas generales.',
      detail: 'Inventario diferenciado según dinámica de cada línea.',
      priority: 'Media',
    },
    {
      title: 'Enfoque anticíclico: reforzar líneas en fase expansiva cuando otra desacelera.',
      detail: 'Estrategia por línea ajustada al ciclo.',
      priority: 'Media',
    },
    {
      title: 'Diseñar precios/promos por línea, según sensibilidad y estructura de margen.',
      detail: 'Pricing específico para preservar rentabilidad.',
      priority: 'Alta',
    },
    {
      title: 'Institucionalizar el FOM semanal para anticipar desvíos.',
      detail: 'Forecasting y control incorporados al ritmo operativo.',
      priority: 'Alta',
    },
    {
      title: 'Guardar parámetros de ejecución del dashboard para trazabilidad (periodo, metas, reglas, ventanas).',
      detail: 'Trazabilidad para auditoría y reproducibilidad.',
      priority: 'Media',
    },
    {
      title: 'Formar jefaturas y coordinadores en interpretación de distribuciones y probabilidades.',
      detail: 'Cultura analítica para lectura correcta de resultados.',
      priority: 'Media',
    },
  ];

  const copyRecommendations = () => {
    const text = recommendations
      .map((rec) => `- [${rec.priority}] ${rec.title} ${rec.detail ? `— ${rec.detail}` : ''}`)
      .join('\n');
    navigator.clipboard?.writeText(text);
  };

  const exportChecklist = () => {
    const header = ['Prioridad', 'Título', 'Detalle', 'Estado'];
    const lines = recommendations.map((rec) => [rec.priority, rec.title, rec.detail, 'Pendiente'].join(','));
    const blob = new Blob([`${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recomendaciones.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-6 ${presentationMode ? 'text-lg' : 'text-base'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Versión ejecutiva</p>
          <h2 className="text-3xl font-semibold text-slate-900">Conclusiones y Recomendaciones</h2>
          <p className="text-sm text-slate-600">Resumen ejecutivo del análisis y del dashboard de Divemotor</p>
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
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Chip label="Módulos: Conteo con exposición · Monte Carlo · Mix interno · FOM · Correlaciones" />
        <Chip label="Alcance: 2022–2025 (H1) · 4 líneas de negocio (independientes)" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-slate-500" />
          <p className="text-lg font-semibold text-slate-900">Resumen ejecutivo</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {executiveCards.map((card) => (
            <SummaryCard key={card.title} icon={card.icon} title={card.title} bullets={card.bullets} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-slate-500" />
          <p className="text-lg font-semibold text-slate-900">Conclusiones por tema</p>
        </div>
        <div className="space-y-3">
          {thematicAccordions.map((item) => (
            <AccordionItem key={item.title} title={item.title} bullets={item.bullets} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-slate-500" />
          <p className="text-lg font-semibold text-slate-900">Recomendaciones</p>
        </div>
        <div className="space-y-3">
          {recommendations.map((item) => (
            <RecommendationItem key={item.title} item={item} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyRecommendations}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <ClipboardCopy size={16} /> Copiar recomendaciones
          </button>
          <button
            type="button"
            onClick={exportChecklist}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm hover:border-celeste-200"
          >
            <FileText size={16} /> Exportar checklist (CSV)
          </button>
        </div>
      </section>
    </div>
  );
};

export default ConclusionsPage;
