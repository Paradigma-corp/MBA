import assert from 'node:assert/strict';
import { selectSample, createDefaultFilters, deriveMarginBounds, clampMarginRange } from '../src/utils/filters.js';

const sampleRows = [
  { Año: 2022, 'Nuevo/Usado': 'Nuevo', nombreVendedor: 'Ana', margen: 120, 'Línea de Negocio': 'Autos' },
  { Año: 2023, 'Nuevo/Usado': 'Usado', nombreVendedor: 'Ana', margen: -50, 'Línea de Negocio': 'Buses' },
  { Año: 2023, 'Nuevo/Usado': 'Nuevo', nombreVendedor: 'Luis', margen: 300, 'Línea de Negocio': 'Autos' },
  { Año: 2024, 'Nuevo/Usado': 'Nuevo', nombreVendedor: 'Carla', margen: 25, 'Línea de Negocio': 'Vans' },
];

const options = { years: [2022, 2023, 2024], marginRange: { min: -50, max: 300 } };

const baseFilters = {
  ...createDefaultFilters(options),
  years: new Set([2023]),
  condicion: 'Nuevo',
  vendedores: new Set(['Luis']),
  mMin: 0,
  mMax: 400,
};

assert.equal(selectSample(sampleRows, baseFilters).length, 1, 'applies year/condición/vendedor filters');
assert.deepEqual(
  selectSample(sampleRows, { ...baseFilters, vendedores: new Set(), years: new Set([2023, 2024]) }).map((r) => r.margen),
  [300, 25],
  'returns all vendedores when set is empty',
);

const bounds = deriveMarginBounds(sampleRows, { ...baseFilters, years: new Set([2022, 2023]) });
assert.equal(bounds.min, 300, 'deriveMarginBounds follows the current máscara (years/condición/vendedores)');
assert.equal(bounds.max, 300, 'bounds are computed before applying the slider clamp');

const clamped = clampMarginRange({ ...baseFilters, mMin: -200, mMax: 999 }, bounds);
assert.equal(clamped.mMin, 300, 'clamps min to bound');
assert.equal(clamped.mMax, 300, 'clamps max to bound');
