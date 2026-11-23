import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ResultadoPush =
  | { ok: true }
  | { ok: false; motivo: 'simulador' | 'negado' | 'sem-project-id' | 'erro'; detalhe?: string };

/**
 * Pede permissão de notificação e registra o token Expo Push no perfil.
 * Requer build de desenvolvimento/produção e EAS_PROJECT_ID configurado.
 */
export async function registrarNotificacoes(): Promise<ResultadoPush> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alertas', {
      name: 'Alertas de localização',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#2EC4B6',
    });
  }

  if (!Device.isDevice) return { ok: false, motivo: 'simulador' };

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return { ok: false, motivo: 'negado' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { ok: false, motivo: 'sem-project-id' };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('salvar_push_token', { p_token: token });
    if (error) return { ok: false, motivo: 'erro', detalhe: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: 'erro', detalhe: e instanceof Error ? e.message : String(e) };
  }
}

export async function desativarNotificacoes() {
  await supabase.rpc('salvar_push_token', { p_token: null });
}
