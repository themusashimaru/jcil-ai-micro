import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.jcil.app',
  appName: 'JCIL AI',
  webDir: 'out',
  server: {
    // Load the live website instead of local files
    url: 'https://jcil.ai',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'JCIL AI',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
};

export default config;
