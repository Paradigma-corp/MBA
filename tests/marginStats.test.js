import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMarginsByLine } from '../src/utils/marginStats.js';

const syntheticRecords = [
  { businessLine: 'Buses', margen: 10, Año: 2023, nombreVendedor: 'Ana', Modelo: 'X1' },
  { businessLine: 'Buses', margen: 12, Año: 2023, nombreVendedor: 'Ana', Modelo: 'X2' },
  { businessLine: 'Buses', margen: 14, Año: 2023, nombreVendedor: 'Luis', Modelo: 'X3' },
  { businessLine: 'Buses', margen: 15, Año: 2023, nombreVendedor: 'Luis', Modelo: 'X4' },
  { businessLine: 'Buses', margen: 16, Año: 2023, nombreVendedor: 'Luis', Modelo: 'X5' },
  { businessLine: 'Buses', margen: 17, Año: 2023, nombreVendedor: 'Luis', Modelo: 'X6' },
  { businessLine: 'Buses', margen: 18, Año: 2023, nombreVendedor: 'Ana', Modelo: 'X7' },
  { businessLine: 'Buses', margen: 19, Año: 2023, nombreVendedor: 'Ana', Modelo: 'X8' },
  { businessLine: 'Buses', margen: 20, Año: 2023, nombreVendedor: 'Ana', Modelo: 'X9' },
  { businessLine: 'Buses', margen: 120, Año: 2023, nombreVendedor: 'Ana', Modelo: 'X10' },
];

const summarize = (options) => summarizeMarginsByLine(syntheticRecords, { bootstrapSamples: 20, ...options })[0];

test('P10–P90 rule keeps chart and card aligned', () => {
  const summary = summarize({ outlierRule: 'pRange', includeOutliers: true });
  const pctFormula = ((summary.outlierCount / summary.n) * 100).toFixed(1);

  assert.equal(summary.outliers.length, summary.outlierCountVisible);
  assert.equal(summary.outlierPctVisible.toFixed(1), pctFormula);
});

test('Hiding outliers zeros visible counts but preserves raw counts', () => {
  const visibleOff = summarize({ outlierRule: 'tukey', includeOutliers: false });
  const visibleOn = summarize({ outlierRule: 'tukey', includeOutliers: true });

  assert.equal(visibleOff.outliers.length, 0);
  assert.equal(visibleOff.outlierCountVisible, 0);
  assert.equal(visibleOff.outlierPctVisible, 0);
  assert.equal(visibleOn.outlierCount, visibleOff.outlierCount);
});
