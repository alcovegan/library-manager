const path = require('path');
const fs = require('fs');

const USER_DATA_ENV = 'LIBRARY_MANAGER_USER_DATA_DIR';

/**
 * Redirect app data (library.db, covers, settings) to a custom directory.
 * Used by e2e tests and docs screenshots so they never touch the real library.
 * Must be called before anything reads app.getPath('userData').
 */
function applyUserDataOverride(app, env = process.env) {
  const dir = env[USER_DATA_ENV];
  if (!dir) return null;
  const resolved = path.resolve(dir);
  fs.mkdirSync(resolved, { recursive: true });
  app.setPath('userData', resolved);
  return resolved;
}

module.exports = { applyUserDataOverride, USER_DATA_ENV };
