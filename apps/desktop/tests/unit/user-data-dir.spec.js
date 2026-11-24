import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const applyUserDataOverride = (app, env) =>
  require('../../src/main/userDataDir').applyUserDataOverride(app, env);

describe('user data directory override', () => {
  it('should store app data in LIBRARY_MANAGER_USER_DATA_DIR when it is set', () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lm-ud-')), 'nested');
    const app = { setPath: vi.fn() };

    const applied = applyUserDataOverride(app, { LIBRARY_MANAGER_USER_DATA_DIR: dir });

    expect(applied).toBe(path.resolve(dir));
    expect(app.setPath).toHaveBeenCalledWith('userData', path.resolve(dir));
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('should keep the default data directory when the variable is not set', () => {
    const app = { setPath: vi.fn() };

    expect(applyUserDataOverride(app, {})).toBeNull();
    expect(app.setPath).not.toHaveBeenCalled();
  });
});
