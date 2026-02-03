const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix Firebase Auth "Component auth has not been registered yet" error
// 1. Add .cjs extension support
config.resolver.sourceExts.push('cjs');

// 2. Unstable module resolution configs to help with Firebase
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
