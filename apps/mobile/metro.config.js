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

module.exports = config;
