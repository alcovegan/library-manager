import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(__dirname, '../../src');
const read = (f) => fs.readFileSync(path.join(srcDir, f), 'utf8');
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

function usedKeys() {
  const html = read('index.html');
  const js = read('renderer.js');
  const fromHtml = [...html.matchAll(/data-i18n(?:-placeholder|-title)?="([^"]+)"/g)].map((m) => m[1]);
  const fromJs = [...js.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']\s*[,)]/g)].map((m) => m[1]);
  return [...new Set([...fromHtml, ...fromJs])];
}

describe('locales', () => {
  for (const locale of ['ru', 'en']) {
    it(`should define every key used in the UI for "${locale}"`, () => {
      const defined = new Set(flatten(JSON.parse(read(`locales/${locale}.json`))));
      expect(usedKeys().filter((k) => !defined.has(k))).toEqual([]);
    });
  }
});
