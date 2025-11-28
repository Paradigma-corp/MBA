import {
  transformToCategories,
  transformToSalespeople,
  computeCorrelations,
  computeStatSummary,
  normalizeRecords,
} from '../utils/dataParser.js';
import { performBootstrap } from '../utils/bootstrap.js';

self.onmessage = (event) => {
  const { records, iterations, confidenceLevel } = event.data;
  const normalized = normalizeRecords(records);
  const categories = transformToCategories(normalized, { normalized: true });
  const bootstrapped = performBootstrap(categories, iterations, confidenceLevel);
  const salespeople = transformToSalespeople(normalized, { normalized: true });
  const correlations = computeCorrelations(normalized, { normalized: true });
  const statSummary = computeStatSummary(normalized, { normalized: true });
  self.postMessage({ categories: bootstrapped, salespeople, correlations, statSummary });
};
