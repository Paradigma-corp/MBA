import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Download,
  CloudUpload,
  Home,
  MapPin,
  Menu,
  LayoutDashboard,
  Layers,
  LineChart,
  Percent,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import BarChartComponent from './components/charts/BarChartComponent.jsx';
import ScatterPlot from './components/charts/ScatterPlot.jsx';
import BoxPlot from './components/charts/BoxPlot.jsx';
import ProbabilityCalculator from './components/calculators/ProbabilityCalculator.jsx';
import SalesSuccessCalculator from './components/calculators/SalesSuccessCalculator.jsx';
import SamplingCalculator from './components/calculators/SamplingCalculator.jsx';
import WaterfallCalculator from './components/calculators/WaterfallCalculator.jsx';
import { demoRecords, demoSalespeople } from './data/demoData.js';
import { performBootstrap } from './utils/bootstrap.js';
import {
  computeCorrelations,
  computeStatSummary,
  normalizeRecords,
  transformToCategories,
  transformToSalespeople,
} from './utils/dataParser.js';
import { useAnalyticsData } from './hooks/useAnalyticsData.js';
import {
  clampMarginRange,
  createDefaultFilters,
  deriveFilterOptions,
  deriveMarginBounds,
  parseFiltersFromQuery,
  serializeFiltersToQuery,
} from './utils/filters.js';
import { formatCurrency, formatMillionsUSD, formatNumber, formatPercent } from './utils/formatters.js';
import { summarizeMarginsByLine } from './utils/marginStats.js';
import CorrelationBars from './components/charts/CorrelationBars.jsx';
import CorrelationScatter from './components/charts/CorrelationScatter.jsx';
import Modal from './components/ui/Modal.jsx';
import VendorMultiSelect from './components/ui/VendorMultiSelect.jsx';
import CategoryCorrelationModule from './components/analytics/CategoryCorrelationModule.jsx';
import RegressionComparisonModule from './components/analytics/RegressionComparisonModule.jsx';
import CountingExposurePanel from './components/analytics/CountingExposurePanel.jsx';
import FomForecastPanel from './components/analytics/FomForecastPanel.jsx';
import MixOptimizerPanel from './components/analytics/MixOptimizerPanel.jsx';
import MonteCarloMetaPanel from './components/analytics/MonteCarloMetaPanel.jsx';
import LineCorrelationPanel from './components/analytics/LineCorrelationPanel.jsx';

const heroSlides = [
  {
    title: 'Automóviles',
    subtitle: 'Mercedes-Benz EQS y Clase E para dirección y flotas ejecutivas.',
    image: '/images/hero-automoviles.jpg',
  },
  {
    title: 'Camiones',
    subtitle: 'Tractos Mercedes-Benz Actros listos para logística pesada confiable.',
    image: '/images/hero-camiones.jpg',
  },
  {
    title: 'Vans',
    subtitle: 'Mercedes-Benz Sprinter para reparto urbano y transporte ejecutivo.',
    image: '/images/hero-vans.jpg',
  },
  {
    title: 'Buses',
    subtitle: 'Mercedes-Benz Citaro para rutas con confort y eficiencia.',
    image: '/images/hero-buses.jpg',
  },
];

const App = () => {
  const [rawRecords, setRawRecords] = useState(demoRecords);
  const [dataSource, setDataSource] = useState('demo');
  const initialFilterOptions = useMemo(() => deriveFilterOptions(demoRecords), []);
  const [filterOptions, setFilterOptions] = useState(initialFilterOptions);
  const [filters, setFilters] = useState(() =>
    clampMarginRange(parseFiltersFromQuery(window.location.search, initialFilterOptions), initialFilterOptions.marginRange),
  );
  const [marginBounds, setMarginBounds] = useState(initialFilterOptions.marginRange);
  const [config, setConfig] = useState({
    rSquared: 0.85,
    betaIngreso: 0.75,
    betaCosto: -0.65,
    pearsonCoef: 0.92,
  });
  const INITIAL_BOOTSTRAP = 5000;
  const [bootstrapIterations, setBootstrapIterations] = useState(INITIAL_BOOTSTRAP);
  const [activePage, setActivePage] = useState('dashboard');
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeModal, setActiveModal] = useState(null);
  const [showOutliers, setShowOutliers] = useState(true);
  const [outlierRule, setOutlierRule] = useState('pRange');
  const [reviewQueue, setReviewQueue] = useState([]);
  const chartRef = useRef(null);

  const normalizedDemo = useMemo(() => normalizeRecords(demoRecords), []);
  const demoCategories = useMemo(
    () => transformToCategories(normalizedDemo, { normalized: true }),
    [normalizedDemo],
  );
  const initialData = useMemo(
    () => ({
      categories: performBootstrap(demoCategories, INITIAL_BOOTSTRAP),
      salespeople: transformToSalespeople(normalizedDemo, { normalized: true }),
      correlations: computeCorrelations(normalizedDemo, { normalized: true }),
      statSummary: computeStatSummary(normalizedDemo, { normalized: true }),
    }),
    [demoCategories, normalizedDemo],
  );

  const { categories, salespeople, correlations, statSummary, filteredRecords, pending } = useAnalyticsData({
    rawRecords,
    filters,
    iterations: bootstrapIterations,
    confidenceLevel: 0.95,
    initialData,
  });

  const normalizedFiltered = useMemo(() => normalizeRecords(filteredRecords), [filteredRecords]);

  const handleFile = (file) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.filter((row) => row && Object.keys(row).length > 0);
        const options = deriveFilterOptions(parsed);
        setFilterOptions(options);
        setFilters(createDefaultFilters(options));
        setRawRecords(parsed);
        setDataSource('imported');
      },
      error: (error) => {
        console.error('CSV parse error', error);
      },
    });
  };

  const resetDemo = () => {
    const options = deriveFilterOptions(demoRecords);
    setRawRecords(demoRecords);
    setFilterOptions(options);
    setFilters(createDefaultFilters(options));
    setBootstrapIterations(INITIAL_BOOTSTRAP);
    setDataSource('demo');
  };

  const totals = useMemo(() => {
    const totalIngresos = categories.reduce((acc, item) => acc + (item.totalIngresos || 0), 0);
    const totalCostos = categories.reduce((acc, item) => acc + (item.totalCostos || 0), 0);
    const totalMargen = categories.reduce((acc, item) => acc + (item.totalMargen || 0), 0);
    return {
      totalIngresos,
      totalCostos,
      totalMargen,
      marginPct: totalIngresos ? (totalMargen / totalIngresos) * 100 : 0,
    };
  }, [categories]);

  const stats = useMemo(
    () => ({
      categorias: categories.length,
      vendedores: salespeople.length,
      marginPct: totals.marginPct,
    }),
    [categories, salespeople, totals.marginPct],
  );

  const marginSummaries = useMemo(
    () =>
      summarizeMarginsByLine(normalizedFiltered, {
        bootstrapSamples: 2000,
        outlierRule,
        includeOutliers: showOutliers,
      }),
    [normalizedFiltered, outlierRule, showOutliers],
  );

  useEffect(() => {
    const options = deriveFilterOptions(rawRecords);
    setFilterOptions(options);
  }, [rawRecords]);

  useEffect(() => {
    const bounds = deriveMarginBounds(rawRecords, filters);
    setMarginBounds(bounds);
  }, [filters.condicion, filters.vendedores, filters.years, rawRecords]);

  useEffect(() => {
    setFilters((prev) => {
      const clamped = clampMarginRange(prev, marginBounds);
      if (clamped.mMin === prev.mMin && clamped.mMax === prev.mMax) return prev;
      return clamped;
    });
  }, [marginBounds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = serializeFiltersToQuery(filters);
      const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, '', nextUrl);
    }, 240);
    return () => clearTimeout(timer);
  }, [filters]);

  const APA_FOOTER =
    'Nota. Bigotes = percentiles 10 y 90; banda = IC95% bootstrap (B=2000) de la mediana. Fuente: Divemotor (panel interno).';

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleMarkReview = (record) => {
    const normalized = {
      line: record.line || record.businessLine || 'Sin línea',
      year: record.year ?? record.Año ?? record.año ?? null,
      seller: record.seller || record.sellerName || record.nombreVendedor || '—',
      model: record.model || record.modelName || record.modelo || '—',
      margin: record.margin,
    };

    setReviewQueue((prev) => {
      const exists = prev.some(
        (item) =>
          item.line === normalized.line &&
          item.margin === normalized.margin &&
          item.seller === normalized.seller &&
          item.year === normalized.year &&
          item.model === normalized.model,
      );
      if (exists) return prev;
      return [...prev, normalized];
    });
  };

  const exportCsv = () => {
    if (!marginSummaries.length) return;
    const header = [
      'Linea',
      'N',
      'Mediana',
      'Q1',
      'Q3',
      'IQR',
      'P10',
      'P90',
      'P90-P10',
      'MAD',
      'CV_robusto',
      '%Outliers',
      'IC95_Lower',
      'IC95_Upper',
    ];

    const lines = marginSummaries.map((item) =>
      [
        item.line,
        item.n,
        item.median,
        item.q1,
        item.q3,
        item.iqr,
        item.p10,
        item.p90,
        item.pRange,
        item.mad,
        item.cvRobust,
        item.outlierPctVisible,
        item.ciLower,
        item.ciUpper,
      ].join(','),
    );

    lines.push(`"Pie de nota","${APA_FOOTER.replace(/"/g, '""')}"`);
    const blob = new Blob([`${header.join(',')}` + '\n' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    triggerDownload(blob, 'margenes_boxplot.csv');
  };

  const exportReviewCsv = () => {
    if (!reviewQueue.length) return;
    const header = ['Linea', 'Año', 'Vendedor', 'Modelo', 'Margen'];
    const lines = reviewQueue.map((item) =>
      [item.line, item.year ?? '', item.seller ?? '', item.model ?? '', item.margin ?? ''].join(','),
    );
    lines.push(`"Pie de nota","${APA_FOOTER.replace(/"/g, '""')}"`);
    const blob = new Blob([`${header.join(',')}` + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, 'margenes_marcados.csv');
  };

  const exportPng = () => {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const footerHeight = 50;
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height + footerHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      ctx.fillStyle = '#475569';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.fillText(APA_FOOTER, 12, image.height + 30);
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, 'margenes_boxplot.png');
      });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const marginRange = [filters.mMin, filters.mMax];
  const sliderStep = useMemo(() => {
    const spread = marginBounds.max - marginBounds.min;
    if (!Number.isFinite(spread) || spread === 0) return 1;
    return Math.max(spread / 200, 0.01);
  }, [marginBounds]);

  const modalDetails = useMemo(
    () => ({
      correlations: {
        title: 'Correlaciones y dispersión',
        body: (
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              Coeficientes de Pearson calculados con todas las filas filtradas. Los scatter muestran hasta 1,500 puntos para
              mantener la fluidez, pero las métricas usan el 100% de las filas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[{
                label: 'Margen vs Ingreso',
                value: correlations?.margenIngreso,
              }, {
                label: 'Margen vs Costos',
                value: correlations?.margenCostos,
              }, {
                label: 'Ingreso vs Costos',
                value: correlations?.ingresoCostos,
              }, {
                label: 'Margen vs Unidades',
                value: correlations?.margenUnidades,
              }].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                    <p className="text-base font-semibold text-slate-900">ρ = {item.value?.toFixed(3) ?? '0.000'}</p>
                  </div>
                  <span className="text-xs text-slate-500">Rango [-1, 1]</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Un valor cercano a ±1 indica una relación lineal fuerte; valores cercanos a 0 sugieren poca relación lineal.</p>
          </div>
        ),
      },
              stats: {
        title: 'Resumen estadístico',
        body: (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Medidas de tendencia central y dispersión con las filas actualmente filtradas.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[{
                label: 'Margen (%)',
                format: formatPercent,
                stats: statSummary.marginPct,
              }, {
                label: 'Ingresos (USD)',
                format: formatCurrency,
                stats: statSummary.ingresos,
              }, {
                label: 'Costos (USD)',
                format: formatCurrency,
                stats: statSummary.costos,
              }].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                  <p className="text-base font-semibold text-slate-900">Media: {item.format(item.stats.mean)}</p>
                  <p className="text-sm text-slate-600">
                    Mediana: {item.format(item.stats.median)} · Moda: {item.format(item.stats.mode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Error típico: {item.format(item.stats.stderr)} · Desv. estándar: {item.format(item.stats.stdSample)} · Varianza (muestral):
                    {item.format(item.stats.varianceSample)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Asimetría: {formatNumber(item.stats.skewness, { maximumFractionDigits: 2 })} · Curtosis:
                    {formatNumber(item.stats.kurtosis, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500">Min: {item.format(item.stats.min)} · Max: {item.format(item.stats.max)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Muestras consideradas: {statSummary.muestras.toLocaleString()}</p>
          </div>
        ),
      },
      scatterIngreso: {
        title: 'Margen vs Ingresos — versión completa',
        body: (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Se muestra la nube completa con más puntos y mayor contraste según la cantidad de repeticiones.</p>
            <CorrelationScatter records={filteredRecords} xKey="ingresos" yKey="margen" maxPoints={6000} height={420} />
          </div>
        ),
      },
      scatterCostos: {
        title: 'Margen vs Costos — versión completa',
        body: (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Haz zoom visual en la dispersión de costos versus margen con intensidad por celdas repetidas.</p>
            <CorrelationScatter
              records={filteredRecords}
              xKey="costos"
              yKey="margen"
              color="#0c89aa"
              maxPoints={6000}
              height={420}
            />
          </div>
        ),
      },
      categories: {
        title: 'Detalle por categoría',
        body: (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Sumatoria de ingresos, costos y margen por categoría después de aplicar los filtros activos.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.slice(0, 6).map((cat) => (
                <div key={cat.name} className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{cat.name}</p>
                    <span className="text-[11px] text-slate-500">{cat.n?.toLocaleString() ?? 0} filas</span>
                  </div>
                  <p className="text-xs text-slate-500">Margen medio: {formatNumber(cat.margen, { maximumFractionDigits: 1 })}% | σ: {formatNumber(cat.stdDev)}</p>
                  <p className="text-sm text-slate-700 mt-1">Ingresos: {formatMillionsUSD(cat.totalIngresos)} · Costos: {formatMillionsUSD(cat.totalCostos)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Totales: ingresos {formatMillionsUSD(totals.totalIngresos)} | costos {formatMillionsUSD(totals.totalCostos)} | margen {formatMillionsUSD(totals.totalMargen)}</p>
          </div>
        ),
      },
      dispersion: {
        title: 'Dispersión y relación ingreso-margen',
        body: (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Los puntos provienen de la agregación por categoría; el intervalo muestra el bootstrap 95% aplicado a cada segmento.</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Útil para detectar segmentos con margen alto pero alto costo.</li>
              <li>Haz hover sobre los puntos para ver ingreso, costo y margen estimado.</li>
              <li>Los filtros de año, segmento y vendedor restringen la nube de puntos.</li>
            </ul>
          </div>
        ),
      },
      boxplot: {
        title: 'Distribución de márgenes',
        body: (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Boxplot por línea con bigotes P10–P90, banda IC95% de la mediana (bootstrap B=2000) y opción de mostrar outliers.</p>
            <p className="text-slate-600">Sirve para identificar variabilidad robusta, valores extremos y dispersión intercuartil antes de fijar metas.</p>
          </div>
        ),
      },
    }),
    [categories, correlations, filteredRecords, statSummary, totals],
  );

  const nav = [
    { key: 'dashboard', label: 'Panel principal', icon: LayoutDashboard },
    { key: 'counting', label: 'Modelo de conteo', icon: LineChart },
    { key: 'fom', label: 'Pronóstico FOM', icon: Percent },
    { key: 'correlations', label: 'Correlaciones entre líneas', icon: Activity },
    { key: 'mix', label: 'Optimizador de mix', icon: Layers },
    { key: 'smc', label: 'SMC por meta', icon: BarChart3 },
  ];

  const modalConfig = activeModal ? modalDetails[activeModal] : null;

  const workerBadge = pending ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold">
      <RefreshCw size={14} className="animate-spin" />
      Calculando con filtros activos
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold">
      <ShieldCheck size={14} />
      Worker listo, UI libre de bloqueos
    </span>
  );

  return (
    <div className="min-h-screen text-slate-900 bg-[#f6f7f9]">
      <div className="bg-black text-white border-b border-black/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="h-10 w-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition"
              aria-label="Abrir menú"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white text-black font-semibold flex items-center justify-center">
                D
              </div>
              <div>
                <p className="text-xs text-slate-200 uppercase tracking-[0.18em]">Divemotor</p>
                <p className="text-sm font-semibold">Analytics & Fleet</p>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <span className="hover:text-celeste-200 cursor-pointer">Vehículos</span>
            <span className="hover:text-celeste-200 cursor-pointer">Camiones</span>
            <span className="hover:text-celeste-200 cursor-pointer">Vans</span>
            <span className="hover:text-celeste-200 cursor-pointer">Buses</span>
          </div>
        </div>
      </div>
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2"><MapPin size={16} className="text-black" /> Estamos en todo el Perú</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs">
              Datos {dataSource === 'demo' ? 'demo' : 'CSV importado'}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${pending ? 'bg-amber-500' : 'bg-emerald-500'} shadow`} />
              {pending ? 'Recalculando métricas en background…' : 'Listo para filtrar sin muestreo'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 bg-gradient-to-b from-black/75 via-black/65 to-black/75 text-white backdrop-blur-2xl border-r border-white/15 flex-col p-5 gap-6 shadow-2xl shadow-black/50 saturate-150">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-black to-celeste-600 text-white flex items-center justify-center shadow-md shadow-celeste-500/40">
              <Home size={20} />
            </div>
            <div>
              <p className="text-xs text-white/70">Divemotor</p>
              <p className="font-semibold">Executive Suite</p>
            </div>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActivePage(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm transition border ${
                    active
                      ? 'bg-white text-black border-white shadow-lg shadow-celeste-500/20'
                      : 'text-white/85 hover:bg-white/10 hover:text-white border-white/5'
                  }`}
                >
                  <Icon size={16} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-sm backdrop-blur">
              <p className="text-[11px] uppercase text-white/60">Origen de datos</p>
              <p className="font-semibold text-white">{dataSource === 'demo' ? 'Dataset demo' : 'CSV importado'}</p>
              <p className="text-xs text-white/60 mt-1">10,741 registros procesados vía Web Worker.</p>
            </div>
            <div className="flex items-center gap-2 text-celeste-100 text-sm">
              <ShieldCheck size={16} />
              <span className="text-white">Procesamiento seguro y sin bloqueos</span>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">
            <Header />

            <div className="lg:hidden">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Selecciona pestaña</label>
              <select
                value={activePage}
                onChange={(e) => setActivePage(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {nav.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {activePage === 'dashboard' ? (
              <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                <div className="relative h-[320px] w-full">
                  <img src={heroSlides[activeSlide].image} alt={heroSlides[activeSlide].title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-between p-6 lg:p-8 text-white">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2 max-w-2xl">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/80">Divemotor • Inteligencia comercial</p>
                        <h2 className="text-3xl lg:text-4xl font-semibold leading-tight">{heroSlides[activeSlide].title}</h2>
                        <p className="text-sm lg:text-base text-white/85">{heroSlides[activeSlide].subtitle}</p>
                      </div>
                  <div className="px-4 py-2 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm inline-flex items-center gap-2 text-xs font-semibold">
                    <RefreshCw size={14} className={pending ? 'animate-spin' : ''} />{' '}
                    {dataSource === 'demo' ? 'Dataset demo' : 'CSV importado'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="backdrop-blur-md bg-white/15 border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
                    <Activity size={16} /> Margen medio {formatPercent(stats.marginPct)}
                      </div>
                      <div className="backdrop-blur-md bg-white/15 border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
                        <Users size={16} /> {stats.vendedores} vendedores
                      </div>
                      <div className="backdrop-blur-md bg-white/15 border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
                        <BarChart3 size={16} /> {stats.categorias} categorías
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Líneas de negocio</span>
                  {heroSlides.map((slide, index) => {
                    const active = index === activeSlide;
                    return (
                      <button
                        key={slide.title}
                        type="button"
                        onClick={() => setActiveSlide(index)}
                        className={`flex items-center gap-3 rounded-2xl border px-2 py-1.5 text-left shadow-sm transition ${
                          active ? 'bg-white border-black text-black' : 'bg-white border-slate-200 text-slate-700 hover:border-celeste-200'
                        }`}
                      >
                        <div className="h-12 w-20 rounded-xl overflow-hidden bg-slate-200">
                          <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{slide.title}</p>
                          <p className="text-[11px] text-slate-500">Explorar</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card bg-white border border-slate-200/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center">
                      <CloudUpload size={18} />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Carga de datos</p>
                      <p className="font-semibold">Importa BBDD x.csv</p>
                    </div>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${dataSource === 'demo' ? 'bg-slate-500' : 'bg-celeste-600'} shadow shadow-slate-300/50`} />
                </div>
                <p className="text-sm text-slate-600 mb-4">Procesa en background y cambia instantáneamente entre demo y la base completa.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-black text-white rounded-xl border border-black cursor-pointer shadow-sm hover:-translate-y-0.5 transition">
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    <span className="text-sm font-medium">Seleccionar CSV</span>
                  </label>
                  <button
                    type="button"
                    onClick={resetDemo}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:border-celeste-300 transition"
                  >
                    Volver a demo
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Web Worker aislado evita bloqueos al transformar las 10,741 filas.</p>
                    <p className="text-slate-600">Bootstrap configurable mantiene la precisión; el estado se muestra en vivo.</p>
                  </div>
                  {workerBadge}
                </div>
                <div className="mt-3 p-3 rounded-2xl bg-slate-900/5 border border-slate-200 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-900 text-sm">¿Cómo cargar la base de datos?</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Haz clic en <span className="font-semibold">“Seleccionar CSV”</span> y elige tu archivo <span className="font-semibold">BBDD x.csv</span>.</li>
                    <li>Espera el indicador verde <span className="font-semibold">CSV importado</span>; el worker procesará categorías y vendedores.</li>
                    <li>Usa <span className="font-semibold">“Volver a demo”</span> si necesitas regresar a los datos de ejemplo.</li>
                  </ol>
                  <p className="text-[11px] text-slate-500">Formato requerido: columnas "Nombre segmentación", "Vendedor SAP", "nombreVendedor", "Unidades UN", "ingresos", "costos", "margen".</p>
                </div>
              </div>
            <div className="card border border-slate-200/80 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs uppercase text-slate-500">Filtros de análisis</p>
                  <h3 className="text-lg font-semibold text-slate-900">Año, condición y rango de margen</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFilters(createDefaultFilters(filterOptions))}
                  className="text-sm text-celeste-700 hover:text-celeste-800"
                >
                  Limpiar filtros
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="space-y-3 lg:col-span-2">
                  <label className="text-xs uppercase text-slate-500">Año</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, years: new Set() }))}
                      className={`px-3 py-2 rounded-xl border text-sm transition ${
                        filters.years.size === 0
                          ? 'bg-celeste-50 border-celeste-200 text-celeste-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-celeste-200'
                      }`}
                    >
                      Todos los años
                    </button>
                    {filterOptions.years.map((year) => {
                      const active = filters.years.has(year);
                      return (
                        <button
                          key={year}
                          type="button"
                          onClick={() =>
                            setFilters((prev) => {
                              const nextYears = new Set(prev.years);
                              if (nextYears.has(year)) {
                                nextYears.delete(year);
                              } else {
                                nextYears.add(year);
                              }
                              return { ...prev, years: nextYears };
                            })
                          }
                          className={`px-3 py-2 rounded-xl border text-sm transition ${
                            active
                              ? 'bg-celeste-600 text-white border-celeste-600 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-celeste-200'
                          }`}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">Combina varios años (2022–2025) o usa “Todos los años”.</p>
                </div>
                <div className="space-y-3">
                  <label className="text-xs uppercase text-slate-500">Nuevo / Usado</label>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.conditions.map((condition) => {
                      const active = filters.condicion === condition;
                      return (
                        <button
                          key={condition}
                          type="button"
                          onClick={() => setFilters((prev) => ({ ...prev, condicion: condition }))}
                          className={`px-3 py-2 rounded-xl border text-sm transition ${
                            active
                              ? 'bg-celeste-600 text-white border-celeste-600 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-celeste-200'
                          }`}
                        >
                          {condition}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">La máscara única aplica al boxplot, dispersión y KPIs.</p>
                </div>
                <div className="space-y-3 lg:col-span-2">
                  <VendorMultiSelect
                    options={filterOptions.sellers}
                    valueSet={filters.vendedores}
                    onChange={(nextSet) => setFilters((prev) => ({ ...prev, vendedores: nextSet }))}
                    placeholder="Selecciona vendedores"
                  />
                  <p className="text-xs text-slate-500">Búsqueda rápida (&lt;100 ms) con lista completa y grupos por línea.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-xs uppercase text-slate-500">Rango de margen (slider doble)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={marginBounds.min}
                      max={marginBounds.max}
                      step={sliderStep}
                      value={marginRange[0]}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setFilters((prev) => ({
                          ...prev,
                          mMin: Math.min(next, prev.mMax),
                        }));
                      }}
                      className="flex-1"
                    />
                    <input
                      type="range"
                      min={marginBounds.min}
                      max={marginBounds.max}
                      step={sliderStep}
                      value={marginRange[1]}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setFilters((prev) => ({
                          ...prev,
                          mMax: Math.max(next, prev.mMin),
                        }));
                      }}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Min: {formatCurrency(Math.max(marginRange[0], marginBounds.min))}</span>
                    <span>Max: {formatCurrency(Math.min(marginRange[1], marginBounds.max))}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Al cambiar año/condición se recalculan los límites reales y se hace clamp automático.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase text-slate-500">Preferencias</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.logScale}
                      onChange={(e) => setFilters((prev) => ({ ...prev, logScale: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Escala log en boxplot</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Se aplica solo al gráfico de márgenes.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                  <BarChart3 size={12} /> {filteredRecords.length.toLocaleString()} registros filtrados
                </span>
                {filters.years.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, years: new Set() }))}
                    className="px-2.5 py-1 rounded-full bg-celeste-50 text-celeste-700 text-[11px] border border-celeste-100 hover:bg-celeste-100"
                  >
                    Años {Array.from(filters.years).sort().join(', ')} ✕
                  </button>
                )}
                {filters.condicion !== 'Todos' && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, condicion: 'Todos' }))}
                    className="px-2.5 py-1 rounded-full bg-celeste-50 text-celeste-700 text-[11px] border border-celeste-100 hover:bg-celeste-100"
                  >
                    {filters.condicion} ✕
                  </button>
                )}
                {filters.vendedores.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, vendedores: new Set() }))}
                    className="px-2.5 py-1 rounded-full bg-celeste-50 text-celeste-700 text-[11px] border border-celeste-100 hover:bg-celeste-100"
                  >
                    Vendedores ({filters.vendedores.size}) ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, mMin: marginBounds.min, mMax: marginBounds.max }))}
                  className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 text-[11px] border border-slate-200 hover:bg-slate-100"
                >
                  Márgenes {formatCurrency(marginRange[0])} – {formatCurrency(marginRange[1])} ✕
                </button>
              </div>
            </div>

            {filteredRecords.length === 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                Sin datos bajo estos filtros.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[{
                title: 'Ingresos',
                value: totals.totalIngresos,
                type: 'currency',
                accent: 'from-celeste-50 to-white',
                text: 'text-celeste-700',
                icon: LineChart,
              },
              {
                title: 'Costos',
                value: totals.totalCostos,
                type: 'currency',
                accent: 'from-black/5 to-white',
                text: 'text-slate-900',
                icon: Layers,
              },
              {
                title: 'Margen total',
                value: totals.totalMargen,
                type: 'currency',
                accent: 'from-celeste-100 to-celeste-200',
                text: 'text-celeste-800',
                icon: BarChart3,
              },
              {
                title: 'Margen promedio',
                value: totals.marginPct,
                type: 'percent',
                accent: 'from-white to-celeste-50',
                text: 'text-celeste-700',
                icon: Percent,
              }].map((card) => {
                const Icon = card.icon;
                const displayValue = card.type === 'percent' ? formatPercent(card.value) : formatMillionsUSD(card.value);
                return (
                  <div key={card.title} className={`card bg-gradient-to-br ${card.accent} border-0 shadow-lg shadow-slate-200/50`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase text-slate-500">{card.title}</p>
                        <p className="text-2xl font-semibold text-slate-900">{displayValue}</p>
                      </div>
                      <div className={`h-11 w-11 rounded-2xl bg-white text-slate-700 flex items-center justify-center shadow ${card.text}`}>
                        <Icon size={18} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Montos expresados en millones de USD. Margen promedio en % sobre ingresos.</p>
                  </div>
                );
              })}
            </div>

            <div className="card border border-slate-200/80 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Resumen estadístico</p>
                  <h3 className="text-lg font-semibold text-slate-900">Tendencia central y dispersión</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    <BarChart3 size={14} /> {statSummary.muestras.toLocaleString()} muestras
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModal('stats')}
                    className="text-sm text-celeste-700 hover:text-celeste-800"
                  >
                    Ver popup
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[{
                  label: 'Margen (%)',
                  format: formatPercent,
                  stats: statSummary.marginPct,
                },
                {
                  label: 'Ingresos (USD)',
                  format: formatCurrency,
                  stats: statSummary.ingresos,
                },
                {
                  label: 'Costos (USD)',
                  format: formatCurrency,
                  stats: statSummary.costos,
                }].map((stat) => (
                  <div key={stat.label} className="p-4 rounded-2xl border border-slate-200 bg-white/90 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{stat.label}</p>
                      <span className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">Tendencia · Dispersión</span>
                    </div>
                    <p className="text-xl font-semibold text-slate-900">Media: {stat.format(stat.stats.mean)}</p>
                    <p className="text-sm text-slate-700">Mediana: {stat.format(stat.stats.median)} · Moda: {stat.format(stat.stats.mode)}</p>
                    <p className="text-xs text-slate-600">
                      Error típico: {stat.format(stat.stats.stderr)} · Desv. estándar: {stat.format(stat.stats.stdSample)} · Varianza (muestral):
                      {stat.format(stat.stats.varianceSample)}
                    </p>
                    <p className="text-xs text-slate-600">
                      Asimetría: {formatNumber(stat.stats.skewness, { maximumFractionDigits: 2 })} · Curtosis:
                      {formatNumber(stat.stats.kurtosis, { maximumFractionDigits: 2 })}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">Mínimo</p>
                        <p className="font-semibold text-slate-900">{stat.format(stat.stats.min)}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">Máximo</p>
                        <p className="font-semibold text-slate-900">{stat.format(stat.stats.max)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card border border-slate-200/80 shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Correlaciones</p>
                    <h3 className="text-lg font-semibold text-slate-900">Relación entre márgenes, ingresos y costos</h3>
                    <p className="text-sm text-slate-600">Coeficientes de Pearson recalculados con los filtros activos.</p>
                    <p className="text-xs text-slate-500 mt-1">Las correlaciones se calculan sobre todas las filas filtradas; solo se recortan los scatter a 1,500 puntos para mantener la fluidez visual sin muestrear los cálculos.</p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                      <LineChart size={14} /> ρ(margen, ingreso): {correlations?.margenIngreso?.toFixed(2) ?? '0.00'}
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                      <LineChart size={14} /> ρ(margen, costos): {correlations?.margenCostos?.toFixed(2) ?? '0.00'}
                    </span>
                  <button
                    type="button"
                    onClick={() => setActiveModal('correlations')}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 hover:border-celeste-200 hover:text-celeste-700"
                  >
                    Ver popup detallado
                  </button>
                  </div>
                </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white/90">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-900">Coeficientes clave</p>
                    <span className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">-1 a 1</span>
                  </div>
                  <CorrelationBars correlations={correlations} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white/90">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Margen vs Ingresos</p>
                        <p className="text-[11px] text-slate-500">Tamaño e intensidad según repeticiones de puntos</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveModal('scatterIngreso')}
                        className="text-[11px] px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-celeste-200 hover:text-celeste-700"
                      >
                        Versión completa
                      </button>
                    </div>
                    <CorrelationScatter records={filteredRecords} xKey="ingresos" yKey="margen" />
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white/90">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Margen vs Costos</p>
                        <p className="text-[11px] text-slate-500">Color y tamaño refuerzan la densidad de repeticiones</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveModal('scatterCostos')}
                        className="text-[11px] px-3 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-celeste-200 hover:text-celeste-700"
                      >
                        Versión completa
                      </button>
                    </div>
                    <CorrelationScatter records={filteredRecords} xKey="costos" yKey="margen" color="#0c89aa" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-slate-500">🔍 Correlación y regresión comparativa entre categorías</p>
                  <h3 className="text-lg font-semibold text-slate-900">Interdependencia entre Autos, Vans, Camiones y Buses</h3>
                  <p className="text-sm text-slate-600">
                    Explora qué tan alineadas están las líneas de negocio entre sí y qué tan independiente es Autos frente al resto
                    usando correlaciones y un modelo de regresión con variables dummy.
                  </p>
                </div>
              </div>

              <div className="card border border-slate-200/80 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Correlación entre categorías</p>
                    <h4 className="text-base font-semibold text-slate-900">1 a 1 y 1 vs conjunto</h4>
                    <p className="text-sm text-slate-600">
                      Matrices y textos interpretativos que se recalculan automáticamente con los filtros activos.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600">
                    Incluye margen, ingresos, costos y unidades
                  </span>
                </div>
                <CategoryCorrelationModule records={filteredRecords} />
              </div>

              <div className="card border border-slate-200/80 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Modelo de regresión: independencia y solvencia de Autos</p>
                    <h4 className="text-base font-semibold text-slate-900">Coeficientes β editables y R²</h4>
                    <p className="text-sm text-slate-600">
                      Ajusta los dummies por categoría y obtén una conclusión automática sobre el peso de Autos frente al resto.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600">
                    Conclusión automática y tabla resumen
                  </span>
                </div>
                <RegressionComparisonModule records={filteredRecords} />
              </div>
            </div>

            <div className="card border border-slate-200/80 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Categorías</p>
                  <h3 className="text-lg font-semibold text-slate-900">Ingresos, costos y margen</h3>
                </div>
                <span className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full bg-celeste-50 text-celeste-700 border border-celeste-100">
                  <ArrowUpRight size={14} /> Seguimiento ejecutivo
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModal('categories')}
                  className="text-sm text-celeste-700 hover:text-celeste-800"
                >
                  Ver popup
                </button>
              </div>
              <BarChartComponent data={categories} />
            </div>

            <div className="card border border-slate-200/80 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-slate-900">Dispersión ingreso vs margen</h3>
                <span className="text-xs text-slate-500">Bootstrap 95%</span>
                <button
                  type="button"
                  onClick={() => setActiveModal('dispersion')}
                  className="text-xs text-celeste-700 hover:text-celeste-800"
                >
                  Ver popup
                </button>
              </div>
              <ScatterPlot data={categories} />
            </div>

            <div className="card border border-slate-200/80 shadow-md space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Distribución de márgenes</h3>
                  <p className="text-xs text-slate-500">Bigotes P10–P90 · Banda IC95% mediana (bootstrap 2,000)</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white">
                    <input
                      type="checkbox"
                      checked={showOutliers}
                      onChange={(e) => setShowOutliers(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Outliers incluidos
                  </label>
                  <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[11px] text-slate-500">Regla outliers:</span>
                    {[{ label: 'P10–P90', value: 'pRange' }, { label: 'Tukey', value: 'tukey' }].map((option) => {
                      const active = outlierRule === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setOutlierRule(option.value)}
                          className={`px-2 py-1 rounded-lg border text-xs ${
                            active
                              ? 'bg-celeste-600 text-white border-celeste-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="inline-flex items-center gap-2 text-[11px] px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                    Regla: {outlierRule === 'pRange' ? 'P10–P90' : 'Tukey 1.5·IQR'}
                  </span>
                  <button
                    type="button"
                    onClick={exportPng}
                    className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:border-celeste-200"
                  >
                    <Download size={14} /> PNG
                  </button>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:border-celeste-200"
                  >
                    <Download size={14} /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={exportReviewCsv}
                    disabled={!reviewQueue.length}
                    className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border ${
                      reviewQueue.length
                        ? 'border-slate-200 text-slate-700 bg-white hover:border-celeste-200'
                        : 'border-slate-100 text-slate-400 bg-slate-50 cursor-not-allowed'
                    }`}
                  >
                    <Download size={14} /> Marcados ({reviewQueue.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal('boxplot')}
                    className="text-xs text-celeste-700 hover:text-celeste-800"
                  >
                    Ver popup
                  </button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-2xl bg-white p-3" ref={chartRef}>
                <BoxPlot
                  data={marginSummaries}
                  showOutliers={showOutliers}
                  outlierRule={outlierRule}
                  logScale={filters.logScale}
                  onMarkReview={handleMarkReview}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {marginSummaries.map((item) => (
                  <div key={item.line} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.line}</p>
                        <p className="text-[11px] text-slate-500">Años: {item.years.length ? item.years.join(', ') : '—'}</p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">N {item.n}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">Mediana</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(item.median)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">IQR</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(item.iqr)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">P90 - P10</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(item.pRange)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">CV robusto</p>
                        <p className="font-semibold text-slate-900">{formatPercent(item.cvRobust)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">% outliers</p>
                        {showOutliers ? (
                          <p className="font-semibold text-slate-900">
                            {formatPercent(item.outlierPctVisible)} ({item.outlierCountVisible}/{item.n})
                          </p>
                        ) : (
                          <p className="font-semibold text-slate-900">Ocultos</p>
                        )}
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">IC95% mediana</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(item.ciLower)} – {formatCurrency(item.ciUpper)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-4 items-start">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ProbabilityCalculator salespeople={salespeople.length ? salespeople : demoSalespeople} />
                  <SalesSuccessCalculator />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SamplingCalculator />
                  <WaterfallCalculator />
                </div>
              </div>
              <Sidebar
                config={config}
                setConfig={setConfig}
                bootstrapIterations={bootstrapIterations}
                setBootstrapIterations={setBootstrapIterations}
                onReset={resetDemo}
              />
            </div>

            </div>

          ) : activePage === 'counting' ? (
            <CountingExposurePanel records={filteredRecords} />
          ) : activePage === 'fom' ? (
            <FomForecastPanel records={filteredRecords} />
          ) : activePage === 'correlations' ? (
            <LineCorrelationPanel records={filteredRecords} />
          ) : activePage === 'mix' ? (
            <MixOptimizerPanel records={filteredRecords} />
          ) : activePage === 'smc' ? (
            <MonteCarloMetaPanel records={filteredRecords} />
          ) : (
            <FomForecastPanel records={filteredRecords} />
          )}
      </div>
    </div>
    </div>
    <Modal open={!!modalConfig} title={modalConfig?.title} onClose={() => setActiveModal(null)}>
      {modalConfig?.body}
    </Modal>
  </div>
);
};

export default App;
