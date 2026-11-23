import type { ExpoConfig } from 'expo/config';

// Valores lidos de variáveis de ambiente (.env local ou "EAS environment variables").
// Veja docs/CONFIGURACAO.md.
const GOOGLE_MAPS_ANDROID = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '';
const GOOGLE_MAPS_IOS = process.env.GOOGLE_MAPS_IOS_API_KEY ?? '';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Localiza GPS',
  slug: 'localiza-gps',
  scheme: 'localizagps',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'br.com.localizagps.app',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'br.com.localizagps.app',
    adaptiveIcon: {
      backgroundColor: '#0B2545',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Remove permissões que o app não usa.
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0B2545',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'O Localiza GPS usa sua localização para exibi-la no mapa e compartilhá-la somente com as pessoas que você autorizou.',
        locationAlwaysAndWhenInUsePermission:
          'Permita "Sempre" para continuar compartilhando sua localização com as pessoas autorizadas mesmo com o app fechado. Você pode pausar a qualquer momento no app.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#2EC4B6',
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: GOOGLE_MAPS_ANDROID,
        // Opcional: só necessário se usar PROVIDER_GOOGLE no iOS (o padrão é Apple Maps).
        ...(GOOGLE_MAPS_IOS ? { iosGoogleMapsApiKey: GOOGLE_MAPS_IOS } : {}),
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
  },
};

export default config;
