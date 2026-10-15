const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const jetpackComposeStub = path.resolve(__dirname, 'src/stubs/jetpack-compose.tsx');
const jetpackComposeModifiersStub = path.resolve(__dirname, 'src/stubs/jetpack-compose-modifiers.ts');

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@expo/ui/jetpack-compose' ||
    moduleName === '../src/jetpack-compose' ||
    moduleName.endsWith('/src/jetpack-compose') ||
    moduleName.endsWith('\\src\\jetpack-compose')
  ) {
    return {
      filePath: jetpackComposeStub,
      type: 'sourceFile',
    };
  }

  if (
    moduleName === '@expo/ui/jetpack-compose/modifiers' ||
    moduleName === '../src/jetpack-compose/modifiers' ||
    moduleName.endsWith('/src/jetpack-compose/modifiers') ||
    moduleName.endsWith('\\src\\jetpack-compose\\modifiers')
  ) {
    return {
      filePath: jetpackComposeModifiersStub,
      type: 'sourceFile',
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
