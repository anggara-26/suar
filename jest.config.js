module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '\\.css$': require.resolve('./jest/cssMock.js'),
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
      '@react-native/jest-preset/jest/assetFileTransformer.js',
    ),
  },
  setupFiles: [
    require.resolve('@react-native/jest-preset/jest/setup.js'),
    require.resolve('./jest/setupNativewind.js'),
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native' +
      '|@react-native(-community)?' +
      // Ships untranspiled ESM, and the pattern above stops at `@react-native/`
      // so it would otherwise never be transformed.
      '|@react-native-async-storage/.*' +
      '|@react-navigation/.*' +
      '|@gluestack-ui/.*' +
      '|@legendapp/.*' +
      '|nativewind' +
      '|react-native-css-interop' +
      '|react-native-reanimated' +
      '|react-native-worklets' +
      '|react-native-gesture-handler' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      '|react-native-svg)/)',
  ],
};
