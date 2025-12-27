import fs from 'fs';
import os from 'os';
import path from 'path';
import dbLayer from '../../src/main/db.js';

export async function createTestContext() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-db-test-'));
  const ctx = await dbLayer.openDb(tmpDir);
  await dbLayer.migrate(ctx);
  const cleanup = () => {
    try {
      ctx.db.close();
    } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  };
  return { ctx, cleanup, tmpDir };
}

export { dbLayer };
