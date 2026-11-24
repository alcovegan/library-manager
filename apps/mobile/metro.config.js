const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Корень монорепозитория
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Смотреть node_modules и в mobile, и в корне монорепо
config.watchFolders = [monorepoRoot];

// Резолвить модули из обоих мест
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Убедиться что extraNodeModules указывает на правильные пути
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
};

// Для shared пакетов
config.resolver.disableHierarchicalLookup = false;

// @aws-sdk v3 >= 3.9xx ships one CJS bundle that pulls the Node HTTP handler (node:https).
// Its "react-native" field only redirects the ESM build (dist-es/runtimeConfig -> .native),
// so resolve AWS SDK clients to dist-es for native platforms.
const AWS_ESM_PACKAGES = ['@aws-sdk/client-s3'];
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (platform !== 'web' && AWS_ESM_PACKAGES.includes(moduleName)) {
    return resolve(context, `${moduleName}/dist-es/index.js`, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
