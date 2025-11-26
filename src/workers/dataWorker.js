import {
  transformToCategories,
  transformToSalespeople,
  computeCorrelations,
} from '../utils/dataParser.js';
import { performBootstrap } from '../utils/bootstrap.js';

self.onmessage = (event) => {
  const { records, iterations, confidenceLevel } = event.data;
  const categories = transformToCategories(records);
  const bootstrapped = performBootstrap(categories, iterations, confidenceLevel);
  const salespeople = transformToSalespeople(records);
  const correlations = computeCorrelations(records);
  self.postMessage({ categories: bootstrapped, salespeople, correlations });
};
