import assert from 'node:assert/strict';
import { conditionFromRecord } from '../src/utils/dataParser.js';

assert.equal(
  conditionFromRecord({ 'Nuevo / Usado': 'NUEVO' }),
  'Nuevo',
  'parses condition with spaces around the slash',
);

assert.equal(
  conditionFromRecord({ 'Condición': 'usado' }),
  'Usado',
  'handles accented condition keys',
);

assert.equal(
  conditionFromRecord({ 'Estado nuevo o usado': 'Demo' }),
  'Demo',
  'falls back to free text when value is not recognized',
);
