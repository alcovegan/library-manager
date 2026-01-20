/**
 * @library-manager/shared
 * Shared constants, types, and schema definitions for Library Manager
 */

const { SCHEMA_VERSION, SCHEMA_SQL, MIGRATIONS } = require('./schema');
const { READING_STATUS, VALID_READING_STATUSES } = require('./constants');
const { PALETTES, PALETTE_IDS, DEFAULT_PALETTE, toCssVariables, getPaletteCssVars } = require('./palettes');

module.exports = {
  // Schema
  SCHEMA_VERSION,
  SCHEMA_SQL,
  MIGRATIONS,

  // Constants
  READING_STATUS,
  VALID_READING_STATUSES,

  // Palettes
  PALETTES,
  PALETTE_IDS,
  DEFAULT_PALETTE,
  toCssVariables,
  getPaletteCssVars,
};
