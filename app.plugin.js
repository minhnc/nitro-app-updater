try {
  module.exports = require('./lib/expo-plugin').default;
} catch (e) {
  // Fallback for cases where the module might be exported differently
  module.exports = require('./lib/expo-plugin');
}
