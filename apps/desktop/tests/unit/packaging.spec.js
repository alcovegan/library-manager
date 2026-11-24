import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const appDir = path.resolve(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));

describe('electron-builder packaging config', () => {
  it('should point every extraResources source at an existing file', () => {
    const resources = pkg.build.extraResources || [];
    const missing = resources
      .map((r) => (typeof r === 'string' ? r : r.from))
      .filter((from) => !fs.existsSync(path.resolve(appDir, from)));
    expect(missing).toEqual([]);
  });
});

describe('sql.js wasm resolution', () => {
  const resolveSqlWasmPath = (opts) => require('../../src/main/sqlWasm').resolveSqlWasmPath(opts);

  it('should use the packaged resource when it exists', () => {
    const resourcesPath = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-res-'));
    const packaged = path.join(resourcesPath, 'sql-wasm.wasm');
    fs.writeFileSync(packaged, '');
    expect(resolveSqlWasmPath({ isPacked: true, resourcesPath })).toBe(packaged);
  });

  it('should fall back to the sql.js wasm from node_modules when the packaged resource is missing', () => {
    const resolved = resolveSqlWasmPath({ isPacked: true, resourcesPath: '/nonexistent' });
    expect(resolved).toBe(require.resolve('sql.js/dist/sql-wasm.wasm'));
    expect(fs.existsSync(resolved)).toBe(true);
  });

  it('should resolve an existing wasm file in development', () => {
    const resolved = resolveSqlWasmPath({ isPacked: false, resourcesPath: undefined });
    expect(fs.existsSync(resolved)).toBe(true);
  });
});
