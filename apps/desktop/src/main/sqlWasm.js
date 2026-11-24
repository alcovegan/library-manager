const path = require('path');
const fs = require('fs');

const WASM_FILENAME = 'sql-wasm.wasm';

/**
 * Resolve sql.js wasm binary path.
 * Packaged app ships it via extraResources (Resources/sql-wasm.wasm); if that copy
 * is missing, fall back to the one bundled with sql.js (readable through asar).
 */
function resolveSqlWasmPath({ isPacked, resourcesPath }) {
  if (isPacked && resourcesPath) {
    const packaged = path.join(resourcesPath, WASM_FILENAME);
    if (fs.existsSync(packaged)) return packaged;
  }
  return require.resolve(`sql.js/dist/${WASM_FILENAME}`);
}

function currentSqlWasmPath() {
  return resolveSqlWasmPath({
    isPacked: __dirname.includes('app.asar'),
    resourcesPath: process.resourcesPath,
  });
}

module.exports = { resolveSqlWasmPath, currentSqlWasmPath };
