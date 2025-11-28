import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
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
  businessLineFromRecord,
  computeCorrelations,
  normalizeFinancialRecord,
  transformToCategories,
  transformToSalespeople,
  yearFromRecord,
} from './utils/dataParser.js';
import CorrelationBars from './components/charts/CorrelationBars.jsx';
import CorrelationScatter from './components/charts/CorrelationScatter.jsx';
import Modal from './components/ui/Modal.jsx';
import CategoryCorrelationModule from './components/analytics/CategoryCorrelationModule.jsx';
import RegressionComparisonModule from './components/analytics/RegressionComparisonModule.jsx';
import CountingExposurePanel from './components/analytics/CountingExposurePanel.jsx';

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
  const [config, setConfig] = useState({
    rSquared: 0.85,
    betaIngreso: 0.75,
    betaCosto: -0.65,
    pearsonCoef: 0.92,
  });
  const [bootstrapIterations, setBootstrapIterations] = useState(2000);
  const [categories, setCategories] = useState(() => {
    const transformed = transformToCategories(demoRecords);
    return performBootstrap(transformed, 5000);
  });
  const [salespeople, setSalespeople] = useState(transformToSalespeople(demoRecords));
  const [correlations, setCorrelations] = useState(computeCorrelations(demoRecords));
  const [rawRecords, setRawRecords] = useState(demoRecords);
  const [dataSource, setDataSource] = useState('demo');
  const [workerReady, setWorkerReady] = useState(false);
  const [filters, setFilters] = useState({
    years: [],
    businessLine: 'all',
  });
  const [activePage, setActivePage] = useState('dashboard');
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeModal, setActiveModal] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    const worker = new Worker(new URL('./workers/dataWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { categories: newCategories, salespeople: newSalespeople, correlations: newCorrelations } = event.data;
      setCategories(newCategories);
      setSalespeople(newSalespeople);
      setCorrelations(newCorrelations);
    };
    workerRef.current = worker;
    setWorkerReady(true);
    return () => worker.terminate();
  }, []);

  const businessLineOf = (record) => businessLineFromRecord(record);

  const filteredRecords = useMemo(() => {
    return rawRecords.filter((record) => {
      const year = yearFromRecord(record);
      const matchYear = filters.years.length === 0 || (year !== undefined && filters.years.includes(year));
      const line = businessLineOf(record);
      const matchBusiness = filters.businessLine === 'all' || (line && line === filters.businessLine);
      return matchYear && matchBusiness;
    });
  }, [filters, rawRecords]);

  useEffect(() => {
    if (!workerReady || !workerRef.current) return;
    workerRef.current.postMessage({
      records: filteredRecords,
      iterations: bootstrapIterations,
      confidenceLevel: 0.95,
    });
  }, [filteredRecords, bootstrapIterations, workerReady]);

  const handleFile = (file) => {
    if (!workerRef.current) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.filter((row) => row['Nombre segmentación']);
        setFilters({ years: [], businessLine: 'all' });
        setRawRecords(parsed);
        setDataSource('imported');
      },
      error: (error) => {
        console.error('CSV parse error', error);
      },
    });
  };

  const resetDemo = () => {
    const transformed = transformToCategories(demoRecords);
    setCategories(performBootstrap(transformed, bootstrapIterations));
    setSalespeople(transformToSalespeople(demoRecords));
    setCorrelations(computeCorrelations(demoRecords));
    setRawRecords(demoRecords);
    setFilters({ years: [], businessLine: 'all' });
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

  const statSummary = useMemo(() => {
    const marginPercents = [];
    const ingresos = [];
    const costos = [];

    filteredRecords.forEach((item) => {
      const normalized = normalizeFinancialRecord(item);
      const ingreso = normalized.ingresos;
      const costo = normalized.costos;
      const margen = normalized.margen;

      if (Number.isFinite(ingreso)) ingresos.push(ingreso);
      if (Number.isFinite(costo)) costos.push(costo);
      if (Number.isFinite(ingreso) && ingreso !== 0 && Number.isFinite(margen)) {
        marginPercents.push((margen / ingreso) * 100);
      }
    });

    const calc = (values) => {
      const n = values.length;
      if (!n) {
        return {
          mean: 0,
          median: 0,
          mode: 0,
          stdSample: 0,
          varianceSample: 0,
          stderr: 0,
          skewness: 0,
          kurtosis: 0,
          min: 0,
          max: 0,
        };
      }

      const sorted = [...values].sort((a, b) => a - b);
      const meanValue = values.reduce((acc, value) => acc + value, 0) / n;
      const varianceSample = n > 1 ? values.reduce((acc, value) => acc + (value - meanValue) ** 2, 0) / (n - 1) : 0;
      const stdSample = Math.sqrt(varianceSample);
      const stderr = n > 0 ? stdSample / Math.sqrt(n) : 0;
      const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

      const frequency = new Map();
      let mode = sorted[0];
      let maxCount = 0;
      sorted.forEach((value) => {
        const count = (frequency.get(value) || 0) + 1;
        frequency.set(value, count);
        if (count > maxCount) {
          maxCount = count;
          mode = value;
        }
      });

      const centered = values.map((value) => value - meanValue);
      const denom = stdSample > 0 ? stdSample ** 3 : 0;
      const skewness = n > 2 && denom
        ? (n / ((n - 1) * (n - 2))) * (centered.reduce((acc, value) => acc + value ** 3, 0) / denom)
        : 0;
      const kurtosis =
        n > 3 && stdSample > 0
          ?
            (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) *
              (centered.reduce((acc, value) => acc + value ** 4, 0) / (stdSample ** 4)) -
            (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
          : 0;

      return {
        mean: meanValue,
        median,
        mode,
        stdSample,
        varianceSample,
        stderr,
        skewness,
        kurtosis,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    };

    return {
      marginPct: calc(marginPercents),
      ingresos: calc(ingresos),
      costos: calc(costos),
      muestras: marginPercents.length,
    };
  }, [filteredRecords]);

  const boxPlotData = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, record) => {
      const name = record['Nombre segmentación'] || record.segmentacionIGD;
      if (!name) return acc;
      const marginValue = Number(record.margen);
      if (!Number.isFinite(marginValue)) return acc;
      if (!acc[name]) acc[name] = [];
      acc[name].push(marginValue);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, margins]) => ({ name, margins }));
  }, [filteredRecords]);

  const filterOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        rawRecords
          .map((item) => yearFromRecord(item))
          .filter((year) => year !== undefined && year !== null && !Number.isNaN(year)),
      ),
    ).sort((a, b) => a - b);
    const businessLines = Array.from(
      new Set(
        rawRecords
          .map((item) => businessLineOf(item))
          .filter((value) => value !== undefined && value !== null)
          .map((value) => value.toString()),
      ),
    )
      .filter((value) => value)
      .sort((a, b) => a.localeCompare(b));
    return { years, businessLines };
  }, [rawRecords]);

  const formatNumber = (value, options = {}) =>
    Number.isFinite(value) ? value.toLocaleString('es-ES', { maximumFractionDigits: 2, ...options }) : '—';

  const formatCurrency = (value) =>
    Number.isFinite(value) ? `$${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}` : '—';

  const formatMillionsUSD = (value) => {
    if (!Number.isFinite(value)) return '—';
    const millions = value / 1_000_000;
    return `$${millions.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  };

  const formatPercent = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}%` : '—');
  const recordCount = rawRecords.length;

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
            <p>Boxplot por categoría con mediana, cuartiles y valores extremos para márgenes.</p>
            <p className="text-slate-600">Sirve para identificar outliers y amplitud de variación entre segmentos antes de fijar metas.</p>
          </div>
        ),
      },
    }),
    [categories, correlations, filteredRecords, statSummary, totals],
  );

  const nav = [
    { label: 'Visión general', icon: LayoutDashboard },
    { label: 'Márgenes', icon: BarChart3 },
    { label: 'Vendedores', icon: Users },
    { label: 'Proyecciones', icon: LineChart },
    { label: 'Categorias', icon: Layers },
  ];

  const modalConfig = activeModal ? modalDetails[activeModal] : null;

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
            <span className="flex items-center gap-2"><MapPin size={16} className="text-black" /> Operación nacional · panel interno de analítica</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs">
              Fuente de datos: {dataSource === 'demo' ? 'demo de referencia' : 'CSV cargado'}
            </span>
            <span className="text-xs text-slate-500">Registros actuales: {formatNumber(recordCount, { maximumFractionDigits: 0 })}</span>
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
              return (
                <button
                  key={item.label}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm text-white/85 hover:bg-white/10 hover:text-white transition border border-white/5"
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

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setActivePage('dashboard')}
                className={`px-4 py-2 rounded-full border transition ${
                  activePage === 'dashboard'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200 hover:text-celeste-700'
                }`}
              >
                Panel principal
              </button>
              <button
                type="button"
                onClick={() => setActivePage('counting')}
                className={`px-4 py-2 rounded-full border transition ${
                  activePage === 'counting'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-celeste-200 hover:text-celeste-700'
                }`}
              >
                Modelo de conteo con exposición
              </button>
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
                        <RefreshCw size={14} /> {dataSource === 'demo' ? 'Dataset demo' : 'CSV importado'}
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
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  Web Worker aislado evita bloqueos de UI al transformar las 10,741 filas. Bootstrap configurable mantiene la precisión.
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
                  <h3 className="text-lg font-semibold text-slate-900">Nuevos / Usados y años relevantes</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFilters({ years: [], businessLine: 'all' })}
                  className="text-sm text-celeste-700 hover:text-celeste-800"
                >
                  Limpiar filtros
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-xs uppercase text-slate-500">Nuevos / Usados (línea de negocio)</label>
                  <div className="flex flex-wrap gap-2">
                    {[{ label: 'Todos', value: 'all' }, ...filterOptions.businessLines.map((line) => ({ label: line, value: line }))].map(
                      (option) => {
                        const active = filters.businessLine === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setFilters((prev) => ({ ...prev, businessLine: option.value }))}
                            className={`px-3 py-2 rounded-xl border text-sm transition ${
                              active
                                ? 'bg-celeste-600 text-white border-celeste-600 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-celeste-200'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      },
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Selecciona si quieres ver solo unidades nuevas, usadas o todo.</p>
                </div>
                <div className="space-y-3">
                  <label className="text-xs uppercase text-slate-500">Año (selección múltiple)</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, years: [] }))}
                      className={`px-3 py-2 rounded-xl border text-sm transition ${
                        filters.years.length === 0
                          ? 'bg-celeste-50 border-celeste-200 text-celeste-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-celeste-200'
                      }`}
                    >
                      Todos los años
                    </button>
                    {filterOptions.years.map((year) => {
                      const active = filters.years.includes(year);
                      return (
                        <button
                          key={year}
                          type="button"
                          onClick={() =>
                            setFilters((prev) => {
                              const exists = prev.years.includes(year);
                              const nextYears = exists ? prev.years.filter((y) => y !== year) : [...prev.years, year];
                              return { ...prev, years: nextYears.sort((a, b) => a - b) };
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
                  <p className="text-xs text-slate-500">Puedes combinar varios años para un análisis acumulado.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                  <BarChart3 size={12} /> {filteredRecords.length.toLocaleString()} registros filtrados
                </span>
                {filters.years.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-celeste-50 text-celeste-700 text-[11px] border border-celeste-100">
                    Años {filters.years.join(', ')}
                  </span>
                )}
                {filters.businessLine !== 'all' && (
                  <span className="px-2.5 py-1 rounded-full bg-celeste-50 text-celeste-700 text-[11px] border border-celeste-100">
                    {filters.businessLine}
                  </span>
                )}
              </div>
            </div>

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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="card border border-slate-200/80 shadow-md xl:col-span-2">
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
              <div className="card border border-slate-200/80 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-slate-900">Distribución de márgenes</h3>
                  <span className="text-xs text-slate-500">Outliers incluidos</span>
                  <button
                    type="button"
                    onClick={() => setActiveModal('boxplot')}
                    className="text-xs text-celeste-700 hover:text-celeste-800"
                  >
                    Ver popup
                  </button>
                </div>
                <BoxPlot data={boxPlotData} />
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

          ) : (
            <CountingExposurePanel records={filteredRecords} />
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
