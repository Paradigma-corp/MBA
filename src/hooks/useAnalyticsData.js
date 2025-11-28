import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeCorrelations,
  computeStatSummary,
  normalizeRecords,
  transformToCategories,
  transformToSalespeople,
} from '../utils/dataParser.js';
import { performBootstrap } from '../utils/bootstrap.js';
import { selectSample } from '../utils/filters.js';

const DEBOUNCE_MS = 240;

export const useAnalyticsData = ({ rawRecords, filters, iterations, confidenceLevel = 0.95, initialData }) => {
  const [categories, setCategories] = useState(initialData?.categories ?? []);
  const [salespeople, setSalespeople] = useState(initialData?.salespeople ?? []);
  const [correlations, setCorrelations] = useState(initialData?.correlations ?? {});
  const [statSummary, setStatSummary] = useState(initialData?.statSummary ?? {});
  const [pending, setPending] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const workerRef = useRef(null);

  const filteredRecords = useMemo(() => selectSample(rawRecords, filters), [rawRecords, filters]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/dataWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { categories: newCategories, salespeople: newSalespeople, correlations: newCorrelations, statSummary: newStatSummary } =
        event.data;
      setCategories(newCategories);
      setSalespeople(newSalespeople);
      setCorrelations(newCorrelations);
      if (newStatSummary) setStatSummary(newStatSummary);
      setPending(false);
    };
    workerRef.current = worker;
    setWorkerReady(true);

    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!workerReady || !workerRef.current) return undefined;

    const timer = setTimeout(() => {
      setPending(true);
      workerRef.current.postMessage({ records: filteredRecords, iterations, confidenceLevel });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filteredRecords, iterations, confidenceLevel, workerReady]);

  useEffect(() => {
    if (initialData) return;

    const normalized = normalizeRecords(rawRecords);
    const categoriesSnapshot = transformToCategories(normalized, { normalized: true });
    setCategories(performBootstrap(categoriesSnapshot, iterations, confidenceLevel));
    setSalespeople(transformToSalespeople(normalized, { normalized: true }));
    setCorrelations(computeCorrelations(normalized, { normalized: true }));
    setStatSummary(computeStatSummary(normalized, { normalized: true }));
  }, [confidenceLevel, initialData, iterations, rawRecords]);

  return { categories, salespeople, correlations, statSummary, filteredRecords, pending };
};
