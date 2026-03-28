import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lab.echa.app',
  appName: 'ECHA',
  webDir: 'www',
  server: {
    // We'll handle navigation in native code
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
