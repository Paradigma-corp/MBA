import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
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

  const stats = useMemo(() => ({
    categorias: categories.length,
    vendedores: salespeople.length,
    promedioMargen: categories.length > 0 ? categories.reduce((acc, item) => acc + item.margen, 0) / categories.length : 0,
  }), [categories, salespeople]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Header />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <main className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Carga de datos</h2>
                  <p className="text-sm text-slate-600">Importa el CSV completo y procesa en background con Web Worker.</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Origen: {dataSource === 'demo' ? 'Demo' : 'CSV importado'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <span>Seleccionar CSV</span>
                </label>
                <button
                  type="button"
                  onClick={resetDemo}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Volver a demo
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                El procesamiento se realiza fuera del hilo principal para evitar bloqueos con las 10,741 filas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card">
                <p className="text-xs text-slate-500 uppercase">Categorías</p>
                <p className="text-2xl font-semibold text-slate-900">{stats.categorias}</p>
              </div>
              <div className="card">
                <p className="text-xs text-slate-500 uppercase">Vendedores</p>
                <p className="text-2xl font-semibold text-slate-900">{stats.vendedores}</p>
              </div>
              <div className="card">
                <p className="text-xs text-slate-500 uppercase">Margen promedio</p>
                <p className="text-2xl font-semibold text-slate-900">{stats.promedioMargen.toFixed(0)}</p>
              </div>
            </div>

            <div className="card">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Ingresos, costos y margen por categoría</h3>
              <BarChartComponent data={categories} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-base font-semibold text-slate-900 mb-2">Dispersión ingreso vs margen</h3>
                <ScatterPlot data={categories} />
              </div>
              <div className="card">
                <h3 className="text-base font-semibold text-slate-900 mb-2">Distribución de márgenes</h3>
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
