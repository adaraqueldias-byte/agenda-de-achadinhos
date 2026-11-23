import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anonKey);

// Opções do Keychain/Keystore: AFTER_FIRST_UNLOCK permite que a tarefa de
// localização em segundo plano leia a sessão com a tela bloqueada.
export const opcoesCofre: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Armazenamento criptografado da sessão.
 * A sessão do Supabase pode passar de 2 KB (limite do SecureStore), então ela
 * é cifrada com AES-256 (CTR) e gravada no AsyncStorage; a chave fica no
 * SecureStore (Keychain no iOS, Keystore no Android).
 */
class ArmazenamentoSeguro {
  private async cifrar(chave: string, valor: string) {
    const bytesChave = Crypto.getRandomBytes(256 / 8);
    const cifra = new aesjs.ModeOfOperation.ctr(bytesChave, new aesjs.Counter(1));
    const cifrado = cifra.encrypt(aesjs.utils.utf8.toBytes(valor));
    await SecureStore.setItemAsync(chave, aesjs.utils.hex.fromBytes(bytesChave), opcoesCofre);
    return aesjs.utils.hex.fromBytes(cifrado);
  }

  private async decifrar(chave: string, valor: string) {
    const chaveHex = await SecureStore.getItemAsync(chave, opcoesCofre);
    if (!chaveHex) return null;
    const cifra = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(chaveHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cifra.decrypt(aesjs.utils.hex.toBytes(valor)));
  }

  async getItem(chave: string) {
    const cifrado = await AsyncStorage.getItem(chave);
    if (!cifrado) return null;
    return this.decifrar(chave, cifrado);
  }

  async setItem(chave: string, valor: string) {
    const cifrado = await this.cifrar(chave, valor);
    await AsyncStorage.setItem(chave, cifrado);
  }

  async removeItem(chave: string) {
    await AsyncStorage.removeItem(chave);
    await SecureStore.deleteItemAsync(chave, opcoesCofre);
  }
}

export const supabase = createClient(url ?? 'https://nao-configurado.supabase.co', anonKey ?? 'nao-configurado', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : new ArmazenamentoSeguro(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renova o token apenas com o app em primeiro plano (recomendação do Supabase).
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Traduz mensagens de erro comuns do Supabase para português. */
export function mensagemErro(erro: unknown): string {
  const msg =
    erro instanceof Error
      ? erro.message
      : typeof erro === 'object' && erro && 'message' in erro
        ? String((erro as { message: unknown }).message)
        : String(erro);
  const mapa: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
    'User already registered': 'Já existe uma conta com este e-mail.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Network request failed': 'Sem conexão com a internet.',
    'Token has expired or is invalid': 'Código inválido ou expirado.',
  };
  for (const [en, pt] of Object.entries(mapa)) if (msg.includes(en)) return pt;
  return msg || 'Ocorreu um erro inesperado.';
}
