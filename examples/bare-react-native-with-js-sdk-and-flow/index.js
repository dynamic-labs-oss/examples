/**
 * @format
 */

// Must run before anything else touches crypto/URL/Buffer globals — see
// polyfills.ts for why.
import './polyfills';

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
