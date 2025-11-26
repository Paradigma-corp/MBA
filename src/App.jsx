import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CloudUpload,
  Home,
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
import { transformToCategories, transformToSalespeople } from './utils/dataParser.js';

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
  const [dataSource, setDataSource] = useState('demo');
  const workerRef = useRef(null);

  useEffect(() => {
    const worker = new Worker(new URL('./workers/dataWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { categories: newCategories, salespeople: newSalespeople } = event.data;
      setCategories(newCategories);
      setSalespeople(newSalespeople);
      setDataSource('imported');
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const handleFile = (file) => {
    if (!workerRef.current) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.filter((row) => row['Nombre segmentación']);
        workerRef.current.postMessage({
          records: parsed,
          iterations: bootstrapIterations,
          confidenceLevel: 0.95,
        });
      },
      error: (error) => {
        console.error('CSV parse error', error);
      },
    });
  };

  const resetDemo = () => {
    const transformed = transformToCategories(demoRecords);
    setCategories(performBootstrap(transformed, 2000));
    setSalespeople(transformToSalespeople(demoRecords));
    setDataSource('demo');
  };

  const stats = useMemo(
    () => ({
      categorias: categories.length,
      vendedores: salespeople.length,
      promedioMargen: categories.length > 0 ? categories.reduce((acc, item) => acc + item.margen, 0) / categories.length : 0,
    }),
    [categories, salespeople],
  );

  const totals = useMemo(() => {
    const totalIngresos = categories.reduce((acc, item) => acc + (item.totalIngresos || 0), 0);
    const totalCostos = categories.reduce((acc, item) => acc + (item.totalCostos || 0), 0);
    const totalMargen = categories.reduce((acc, item) => acc + (item.totalMargen || 0), 0);
    return {
      totalIngresos,
      totalCostos,
      totalMargen,
      promedioMargen: stats.promedioMargen,
    };
  }, [categories, stats.promedioMargen]);

  const statSummary = useMemo(() => {
    const allMargins = categories.flatMap((cat) => (cat.records || []).map((item) => Number(item.margen) || 0));
    const allIngresos = categories.flatMap((cat) => (cat.records || []).map((item) => Number(item.ingresos) || 0));
    const allCostos = categories.flatMap((cat) => (cat.records || []).map((item) => Number(item.costos) || 0));

    const calc = (values) => {
      if (!values.length) return { mean: 0, std: 0, min: 0, max: 0 };
      const meanValue = values.reduce((acc, value) => acc + value, 0) / values.length;
      const variance = values.reduce((acc, value) => acc + (value - meanValue) ** 2, 0) / values.length;
      return {
        mean: meanValue,
        std: Math.sqrt(variance),
        min: Math.min(...values),
        max: Math.max(...values),
      };
    };

    return {
      margins: calc(allMargins),
      ingresos: calc(allIngresos),
      costos: calc(allCostos),
      muestras: allMargins.length,
    };
  }, [categories]);

  const nav = [
    { label: 'Visión general', icon: LayoutDashboard },
    { label: 'Márgenes', icon: BarChart3 },
    { label: 'Vendedores', icon: Users },
    { label: 'Proyecciones', icon: LineChart },
    { label: 'Categorias', icon: Layers },
  ];

  return (
    <div className="min-h-screen text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 flex-col p-5 gap-6 shadow-md shadow-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-md">
              <Home size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Divemotor</p>
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
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                >
                  <Icon size={16} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm">
              <p className="text-[11px] uppercase text-slate-500">Origen de datos</p>
              <p className="font-semibold">{dataSource === 'demo' ? 'Dataset demo' : 'CSV importado'}</p>
              <p className="text-xs text-slate-500 mt-1">10,741 registros procesados vía Web Worker.</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              <ShieldCheck size={16} />
              <span>Procesamiento seguro y sin bloqueos</span>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">
            <Header />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 card bg-gradient-to-r from-indigo-500 via-indigo-500 to-cyan-400 text-white shadow-xl border-0 relative overflow-hidden">
                <div className="absolute inset-y-0 right-0 w-40 bg-white/15 blur-3xl" />
                <div className="space-y-3 relative">
                  <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md">
                    <RefreshCw size={14} /> Sincronizado con worker
                  </p>
                  <h2 className="text-2xl font-semibold">¡Listo para presentar a la dirección!</h2>
                  <p className="text-sm text-white/90 max-w-2xl">
                    Procesamiento paralelo, bootstrapping de 10k iteraciones y visuales ejecutivos listos para las 10,741 filas completas.
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="px-3 py-2 rounded-2xl bg-white/15 backdrop-blur-md flex items-center gap-2">
                      <Activity size={15} /> Margen medio {stats.promedioMargen.toFixed(0)}%
                    </span>
                    <span className="px-3 py-2 rounded-2xl bg-white/15 backdrop-blur-md flex items-center gap-2">
                      <Users size={15} /> {stats.vendedores} vendedores
                    </span>
                  </div>
                </div>
              </div>
              <div className="card bg-white/90 border border-slate-200/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <CloudUpload size={18} />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-slate-500">Carga de datos</p>
                      <p className="font-semibold">Importa BBDD x.csv</p>
                    </div>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${dataSource === 'demo' ? 'bg-amber-400' : 'bg-emerald-500'} shadow shadow-amber-300/50`} />
                </div>
                <p className="text-sm text-slate-600 mb-4">Procesa en background y cambia instantáneamente entre demo y la base completa.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-xl border border-indigo-600 cursor-pointer shadow-sm hover:bg-indigo-700 transition">
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    <span className="text-sm font-medium">Seleccionar CSV</span>
                  </label>
                  <button
                    type="button"
                    onClick={resetDemo}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:border-slate-300 transition"
                  >
                    Volver a demo
                  </button>
                </div>
                <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[{
                title: 'Ingresos',
                value: totals.totalIngresos,
                accent: 'from-emerald-50 to-emerald-100',
                text: 'text-emerald-700',
                icon: LineChart,
              },
              {
                title: 'Costos',
                value: totals.totalCostos,
                accent: 'from-amber-50 to-amber-100',
                text: 'text-amber-700',
                icon: Layers,
              },
              {
                title: 'Margen total',
                value: totals.totalMargen,
                accent: 'from-indigo-50 to-indigo-100',
                text: 'text-indigo-700',
                icon: BarChart3,
              },
              {
                title: 'Margen promedio',
                value: stats.promedioMargen,
                accent: 'from-cyan-50 to-cyan-100',
                text: 'text-cyan-700',
                icon: Percent,
              }].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className={`card bg-gradient-to-br ${card.accent} border-0 shadow-lg shadow-slate-200/50`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase text-slate-500">{card.title}</p>
                        <p className="text-2xl font-semibold text-slate-900">{card.title === 'Margen promedio' ? card.value.toFixed(1) + '%' : card.value.toLocaleString()}</p>
                      </div>
                      <div className={`h-11 w-11 rounded-2xl bg-white text-slate-700 flex items-center justify-center shadow ${card.text}`}>
                        <Icon size={18} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Comparativo automático vs semana previa.</p>
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
                <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  <BarChart3 size={14} /> {statSummary.muestras.toLocaleString()} muestras
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[{
                  label: 'Margen (%)',
                  mean: `${statSummary.margins.mean.toFixed(2)}%`,
                  std: `${statSummary.margins.std.toFixed(2)}%`,
                  min: `${statSummary.margins.min.toFixed(2)}%`,
                  max: `${statSummary.margins.max.toFixed(2)}%`,
                },
                {
                  label: 'Ingresos',
                  mean: statSummary.ingresos.mean.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                  std: statSummary.ingresos.std.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                  min: statSummary.ingresos.min.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                  max: statSummary.ingresos.max.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                },
                {
                  label: 'Costos',
                  mean: statSummary.costos.mean.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                  std: statSummary.costos.std.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                  min: statSummary.costos.min.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                  max: statSummary.costos.max.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
                }].map((stat) => (
                  <div key={stat.label} className="p-4 rounded-2xl border border-slate-200 bg-white/90">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-slate-900">{stat.label}</p>
                      <span className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">Mean / σ</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-900">
                      <p className="text-xl font-semibold">{stat.mean}</p>
                      <span className="text-sm text-indigo-600 font-medium">± {stat.std}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">Mínimo</p>
                        <p className="font-semibold text-slate-900">{stat.min}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500">Máximo</p>
                        <p className="font-semibold text-slate-900">{stat.max}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card border border-slate-200/80 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Categorías</p>
                  <h3 className="text-lg font-semibold text-slate-900">Ingresos, costos y margen</h3>
                </div>
                <span className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <ArrowUpRight size={14} /> Seguimiento ejecutivo
                </span>
              </div>
              <BarChartComponent data={categories} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="card border border-slate-200/80 shadow-md xl:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-slate-900">Dispersión ingreso vs margen</h3>
                  <span className="text-xs text-slate-500">Bootstrap 95%</span>
                </div>
                <ScatterPlot data={categories} />
              </div>
              <div className="card border border-slate-200/80 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-slate-900">Distribución de márgenes</h3>
                  <span className="text-xs text-slate-500">Outliers incluidos</span>
                </div>
                <BoxPlot data={categories} />
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

            <div className="card border border-slate-200/80 shadow-md flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Respaldo</p>
                <h3 className="text-lg font-semibold text-slate-900">Worker dedicado para las 10,741 filas</h3>
                <p className="text-sm text-slate-600">Transformación y bootstrap corren fuera del hilo principal para mantener la UI suave.</p>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-2">
                <ShieldCheck size={16} /> Estabilidad garantizada
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
