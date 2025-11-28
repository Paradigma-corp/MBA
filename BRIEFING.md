# Divemotor Dashboard – Technical Briefing

This repository will hold the Divemotor sales analytics dashboard. The goal is to deliver a React + Vite single-page application that can load and analyze the full 10,741-record dataset without UI freezes or crashes.

## 1. Objective
- Provide advanced statistical analysis for automotive sales with category- and seller-level insights.
- Support Monte Carlo simulations, bootstrap confidence intervals, waterfall variance analysis, binomial success probabilities, and sampling calculators.
- Visualize results with interactive bar, scatter, and box plots.
- Target users: Divemotor leadership making evidence-based decisions.

## 2. Stack Requirements
- **Frontend:** React 18 + Vite, TailwindCSS, Nivo (@nivo/bar, @nivo/scatterplot, @nivo/boxplot), Lucide React for icons.
- **Data parsing:** PapaParse for CSV, XLSX for Excel.
- **Runtime command:** `npm run dev` → http://localhost:5173.

## 3. Data Model
- Source file: `public/BBDD x.csv` (~10,741 rows, ≥14 columns).
- Important columns:
  - `Año` (number)
  - `Mes` (number)
  - `Nombre segmentación` → mapped to `segmentacionIGD`
  - `Vendedor SAP` → mapped to `vendedorSAP`
  - `nombreVendedor`
  - `Unidades UN`
  - `ingresos`
  - `costos`
  - `margen`

### Category transformation (`transformToCategories` in `src/utils/dataParser.js`)
For each `segmentacionIGD` group, compute:
- Averages: `margen`, `ingreso`, `costo` (means)
- Dispersion: `stdDev` (population)
- Aggregates: `n`, `totalIngresos`, `totalCostos`, `totalMargen`
- Bootstrap CI: `lower`, `upper` (95%)

### Salespeople transformation (`transformToSalespeople` in `src/utils/dataParser.js`)
Group by `vendedorSAP` to produce 186 sellers with:
- `id`, `name`, `sapCode`
- `specialization` (top category or "X y N más")
- `averageSales`, `stdDev`, `target` (=120% of average), `totalSales`

## 4. Statistical Algorithms
- **Bootstrap (`src/utils/bootstrap.js`):** 10k iterations by default; resample margins per category, compute mean each iteration, store percentile 2.5%/97.5% bounds as CI.
- **Monte Carlo (`ProbabilityCalculator.jsx`):** 10k draws from normal(mean=`averageSales`, std=`stdDev`); success count vs. `targetSales` to produce probability (%). Box–Muller used for normal sampling.
- **Additional calculators:** Waterfall variance, binomial sales success, sampling CI/size calculators.

## 5. Current Architecture (target state)
- `App.jsx` holds state for categories (demo by default), data source (`demo | imported`), raw imported data, model config (R², β ingreso/costo, Pearson), bootstrap iterations, and derived `allSalespeople` via `transformToSalespeople`.
- `Sidebar.jsx` exposes model metrics, bootstrap iteration control, dark-mode and language toggles.
- Charts: grouped bar, scatter, and box plot components via Nivo.
- Calculators: waterfall, Monte Carlo probability, binomial sales success, sampling.

## 6. Known Critical Issue
- Loading the full CSV (10,741 rows) causes a white-screen crash. Demo data (~80 rows) works.
- Root cause: synchronous heavy transforms run during render. `setRawImportedData` triggers an immediate `useMemo` for `transformToSalespeople`, taking ~300–500 ms. Components render with inconsistent `categories` vs. seller data before category transforms complete. A follow-up `useEffect` meant to update categories never catches up, leaving the tree in an invalid state.

## 7. Recommended Fix (Web Worker)
Offload expensive transforms to a worker so React stays responsive and receives coherent data in a single message.

### Worker outline (`src/workers/dataWorker.js`)
```js
self.onmessage = (event) => {
  const { records } = event.data;
  const categories = transformToCategories(records);
  const salespeople = transformToSalespeople(records);
  self.postMessage({ categories, salespeople });
};
```

### App integration
1. Create the worker with `new Worker(new URL('./workers/dataWorker.js', import.meta.url), { type: 'module' })`.
2. On CSV import, send parsed records to the worker instead of setting state directly.
3. In `onmessage`, update `categories`, `rawImportedData`, and a dedicated `salespeople` state together, then set `dataSource` to `imported`.
4. Guard the worker lifecycle with cleanup in `useEffect` to avoid leaks.
5. Keep bootstrap iteration state configurable; run bootstrap after worker-loaded categories arrive.

Benefits: avoids main-thread blocking and prevents the race condition that was observed with the 10k+ dataset.

## 8. Alternative Options
- **Backend aggregation (Supabase):** push data to SQL and query aggregates server-side for categories/sellers.
- **In-app optimization:** memoize by seller/category, pre-index records, or process in chunks; still keep worker-based offloading for best UI responsiveness.

## 9. Getting Started
1. Install dependencies once the Vite project is scaffolded: `npm install`.
2. Place the CSV at `public/BBDD x.csv`.
3. Start the dev server: `npm run dev` → http://localhost:5173.
4. Use demo data first, then enable the worker-backed importer to validate the fix.

## 10. Next Steps
- Scaffold the Vite/Tailwind/Nivo project structure.
- Implement the worker and integrate import flow per the steps above.
- Re-enable automatic CSV loading once the worker path is wired and tested.

This briefing captures the functional requirements, data model, existing algorithms, the crash root cause, and the recommended remediation plan to support the full dataset without UI failures.
