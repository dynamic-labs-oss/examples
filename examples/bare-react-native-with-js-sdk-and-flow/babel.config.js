// Loads .env into process.env before babel runs, so the plugin below can
// inline the values into the bundle. Copy .env.example to .env and fill it
// in — see README.md.
require('dotenv').config();

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // The Dynamic SDK ships modern JS syntax (`export * as ns from …`,
    // static class blocks) that the stock RN Babel preset doesn't
    // transform on its own — see
    // https://www.dynamic.xyz/docs/javascript/react-native/bare-react-native
    '@babel/plugin-transform-export-namespace-from',
    '@babel/plugin-transform-class-static-block',
    // Inlines process.env.* references at bundle time. This is a bare RN
    // app, so there's no Expo-style EXPO_PUBLIC_* / Metro env substitution
    // — this plugin is the equivalent mechanism.
    'transform-inline-environment-variables',
  ],
};
