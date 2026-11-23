/**
 * Compartilhamento de localização.
 *
 * - Sempre VISÍVEL: no Android roda como serviço em primeiro plano com
 *   notificação fixa; no iOS exibe o indicador azul de localização.
 * - Nunca é iniciado sem ação explícita do usuário (botão "Compartilhar").
 * - Se o titular pausar ou revogar no servidor, o envio é interrompido.
 *
 * IMPORTANTE: este módulo precisa ser importado no escopo global (feito em
 * src/app/_layout.tsx) para que a tarefa exista quando o sistema reabrir o
 * app em segundo plano.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';

import { cores } from './tema';
import { opcoesCofre, supabase } from './supabase';

export const TAREFA_LOCALIZACAO = 'localiza-gps-compartilhamento';
const CHAVE_DISPOSITIVO = 'localiza.dispositivo_atual';
const CHAVE_FILA = 'localiza.fila_pontos';
const MAX_FILA = 500;

type Ponto = {
  lat: number;
  lng: number;
  precisao: number | null;
  velocidade: number | null;
  registrado_em: string;
};

// ---------------------------------------------------------------------
// Aparelho atual (qual registro de "dispositivos" corresponde a este celular)
// ---------------------------------------------------------------------

export type DispositivoLocal = { usuarioId: string; dispositivoId: string };

export async function lerDispositivoLocal(): Promise<DispositivoLocal | null> {
  const bruto = await SecureStore.getItemAsync(CHAVE_DISPOSITIVO, opcoesCofre);
  return bruto ? (JSON.parse(bruto) as DispositivoLocal) : null;
}

export async function salvarDispositivoLocal(valor: DispositivoLocal | null) {
  if (valor) await SecureStore.setItemAsync(CHAVE_DISPOSITIVO, JSON.stringify(valor), opcoesCofre);
  else await SecureStore.deleteItemAsync(CHAVE_DISPOSITIVO, opcoesCofre);
}

// ---------------------------------------------------------------------
// Envio com fila offline
// ---------------------------------------------------------------------

function paraPonto(l: Location.LocationObject): Ponto {
  return {
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    precisao: l.coords.accuracy ?? null,
    velocidade: l.coords.speed ?? null,
    registrado_em: new Date(l.timestamp).toISOString(),
  };
}

async function lerFila(): Promise<Ponto[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CHAVE_FILA)) ?? '[]') as Ponto[];
  } catch {
    return [];
  }
}

let enviando = false;

export async function enviarPontos(novos: Location.LocationObject[]) {
  const fila = [...(await lerFila()), ...novos.map(paraPonto)].slice(-MAX_FILA);
  if (enviando) {
    await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
    return;
  }
  enviando = true;
  try {
    const local = await lerDispositivoLocal();
    const { data: sessao } = await supabase.auth.getSession();
    if (!local || !sessao.session || sessao.session.user.id !== local.usuarioId) {
      // Sem sessão válida: não há a quem enviar. Para o serviço.
      await AsyncStorage.removeItem(CHAVE_FILA);
      await pararAtualizacoes();
      return;
    }
    if (fila.length === 0) return;

    const { error } = await supabase
      .from('localizacoes')
      .insert(fila.map((p) => ({ ...p, dispositivo_id: local.dispositivoId })));

    if (!error) {
      await AsyncStorage.removeItem(CHAVE_FILA);
    } else if (error.code === '42501') {
      // RLS recusou: compartilhamento pausado em outro aparelho ou registro removido.
      await AsyncStorage.removeItem(CHAVE_FILA);
      await pararAtualizacoes();
    } else {
      // Sem internet ou erro temporário: mantém na fila para a próxima tentativa.
      await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
    }
  } catch {
    await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
  } finally {
    enviando = false;
  }
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREFA_LOCALIZACAO, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await enviarPontos(data.locations);
});

// ---------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------

export type EstadoPermissoes = {
  servicosAtivos: boolean;
  primeiroPlano: Location.PermissionStatus;
  segundoPlano: Location.PermissionStatus;
  precisa: boolean; // precisão total (iOS) / fina (Android)
};

export async function lerPermissoes(): Promise<EstadoPermissoes> {
  const [servicosAtivos, fg, bg] = await Promise.all([
    Location.hasServicesEnabledAsync(),
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  const precisa = Platform.OS === 'ios' ? fg.ios?.accuracy !== 'reduced' : fg.android?.accuracy !== 'coarse';
  return { servicosAtivos, primeiroPlano: fg.status, segundoPlano: bg.status, precisa };
}

// ---------------------------------------------------------------------
// Iniciar / parar
// ---------------------------------------------------------------------

let assinaturaEmUso: Location.LocationSubscription | null = null;

const opcoesRastreio: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 60_000, // Android: no máximo 1 ponto por minuto
  distanceInterval: 30, // metros
  deferredUpdatesInterval: 60_000,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Other,
  showsBackgroundLocationIndicator: true, // iOS: indicador azul visível
  foregroundService: {
    notificationTitle: 'Localiza GPS — compartilhando localização',
    notificationBody: 'Sua localização está visível para as pessoas autorizadas. Toque para gerenciar.',
    notificationColor: cores.verde,
    killServiceOnDestroy: false,
  },
};

export type ResultadoInicio = { ok: true; modo: 'sempre' | 'em-uso' } | { ok: false; motivo: 'servicos-desligados' | 'negado' };

/**
 * Pede permissões e inicia o envio. Deve ser chamado somente a partir de uma
 * ação do usuário, depois de exibir a explicação de uso.
 */
export async function iniciarCompartilhamento(): Promise<ResultadoInicio> {
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, motivo: 'servicos-desligados' };

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, motivo: 'negado' };

  // Envia um ponto imediatamente para o mapa não ficar vazio.
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    .then((l) => enviarPontos([l]))
    .catch(() => undefined);

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status === 'granted') {
    if (!(await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO))) {
      await Location.startLocationUpdatesAsync(TAREFA_LOCALIZACAO, opcoesRastreio);
    }
    return { ok: true, modo: 'sempre' };
  }

  // Sem permissão "Sempre": compartilha apenas com o app aberto.
  await iniciarModoEmUso();
  return { ok: true, modo: 'em-uso' };
}

async function iniciarModoEmUso() {
  if (assinaturaEmUso) return;
  assinaturaEmUso = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 30 },
    (l) => void enviarPontos([l]),
  );
}

async function pararAtualizacoes() {
  assinaturaEmUso?.remove();
  assinaturaEmUso = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO)) {
      await Location.stopLocationUpdatesAsync(TAREFA_LOCALIZACAO);
    }
  } catch {
    // tarefa já encerrada
  }
}

export async function pararCompartilhamento() {
  await pararAtualizacoes();
  await AsyncStorage.removeItem(CHAVE_FILA);
}

export async function compartilhamentoLocalAtivo(): Promise<boolean> {
  if (assinaturaEmUso) return true;
  try {
    return await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO);
  } catch {
    return false;
  }
}

/**
 * Sincroniza o estado local com o servidor (fonte da verdade): retoma o
 * modo "em uso" ao abrir o app e encerra o serviço se o compartilhamento
 * foi pausado em outro lugar.
 */
export async function sincronizarComServidor(compartilhandoNoServidor: boolean) {
  if (!compartilhandoNoServidor) {
    await pararCompartilhamento();
    return;
  }
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return;
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === 'granted') {
    if (!(await Location.hasStartedLocationUpdatesAsync(TAREFA_LOCALIZACAO))) {
      await Location.startLocationUpdatesAsync(TAREFA_LOCALIZACAO, opcoesRastreio);
    }
  } else if (AppState.currentState === 'active') {
    await iniciarModoEmUso();
  }
  await enviarPontos([]); // esvazia a fila offline, se houver
}

// O modo "em uso" não deve continuar com o app em segundo plano.
AppState.addEventListener('change', (estado) => {
  if (estado !== 'active' && assinaturaEmUso) {
    assinaturaEmUso.remove();
    assinaturaEmUso = null;
  }
});

/** Endereço aproximado via geocodificador do próprio sistema (Apple/Google). */
export async function enderecoAproximado(lat: number, lng: number): Promise<string | null> {
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!r) return null;
    const rua = [r.street, r.streetNumber].filter(Boolean).join(', ');
    const local = [r.district, r.city ?? r.subregion, r.region].filter(Boolean).join(' - ');
    return [rua, local].filter(Boolean).join(' — ') || r.name || null;
  } catch {
    return null;
  }
}
