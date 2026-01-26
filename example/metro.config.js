const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace root
const projectRoot = __dirname;
// Since we are in example/, the library is one level up
const libraryRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the library source code and the example app
config.watchFolders = [projectRoot, libraryRoot];

// 2. Prevent Metro from looking at the library's node_modules
// This is the CRITICAL fix for "Invalid hook call"
config.resolver.blockList = [
  new RegExp(`${libraryRoot}/node_modules/.*`),
];

// 3. Let Metro know where to find packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// 3. Force Metro to resolve specific packages to the example app's versions
config.resolver.extraNodeModules = {
  '@minhnc/nitro-app-updater': libraryRoot,
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-native-nitro-modules': path.resolve(projectRoot, 'node_modules/react-native-nitro-modules'),
};

module.exports = config;
