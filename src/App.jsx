import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { BarChart3, Percent, RefreshCw, Users } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <Header />

        <div className="card flex flex-wrap items-center justify-between gap-4 border border-slate-200/90 shadow-sm">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold border border-indigo-100">
              <RefreshCw size={14} /> Flujo garantizado
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">Procesa los 10,741 registros sin bloquear la UI</h2>
            <p className="text-sm text-slate-600">
              Web Worker + Bootstrap para resultados consistentes con un acabado ejecutivo.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-800 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
            <span className={`h-2.5 w-2.5 rounded-full ${dataSource === 'demo' ? 'bg-amber-400 shadow-amber-300/80' : 'bg-emerald-500 shadow-emerald-300/80'} shadow`} />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Origen de datos</p>
              <p className="font-semibold">{dataSource === 'demo' ? 'Dataset demo (80 filas)' : 'CSV importado (10,741 filas)'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <main className="space-y-5">
            <div className="card border border-slate-200/90 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">Carga de datos</h2>
                  <p className="text-sm text-slate-600">Importa el CSV completo y procesa en background con Web Worker.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Origen: {dataSource === 'demo' ? 'Demo' : 'CSV importado'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg border border-indigo-600 cursor-pointer shadow-sm hover:bg-indigo-700 transition">
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <span className="text-sm font-medium">Seleccionar CSV</span>
                </label>
                <button
                  type="button"
                  onClick={resetDemo}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:border-slate-300 transition"
                >
                  Volver a demo
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                El procesamiento se realiza fuera del hilo principal para mantener la interfaz fluida incluso con las 10,741 filas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card bg-white border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Categorías</p>
                    <p className="text-2xl font-semibold">{stats.categorias}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                    <BarChart3 size={18} />
                  </div>
                </div>
              </div>
              <div className="card bg-white border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Vendedores</p>
                    <p className="text-2xl font-semibold">{stats.vendedores}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                    <Users size={18} />
                  </div>
                </div>
              </div>
              <div className="card bg-white border border-slate-200/90 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Margen promedio</p>
                    <p className="text-2xl font-semibold">{stats.promedioMargen.toFixed(0)}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                    <Percent size={18} />
                  </div>
                </div>
              </div>
            </div>

            <div className="card border border-slate-200/90 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Ingresos, costos y margen por categoría</h3>
              <BarChartComponent data={categories} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card border border-slate-200/90 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Dispersión ingreso vs margen</h3>
                <ScatterPlot data={categories} />
              </div>
              <div className="card border border-slate-200/90 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Distribución de márgenes</h3>
                <BoxPlot data={categories} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProbabilityCalculator salespeople={salespeople.length ? salespeople : demoSalespeople} />
              <SalesSuccessCalculator />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SamplingCalculator />
              <WaterfallCalculator />
            </div>
          </main>
          <Sidebar
            config={config}
            setConfig={setConfig}
            bootstrapIterations={bootstrapIterations}
            setBootstrapIterations={setBootstrapIterations}
            onReset={resetDemo}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
