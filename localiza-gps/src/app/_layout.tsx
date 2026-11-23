// Registra a tarefa de localização no escopo global (obrigatório para o
// sistema reabrir o app em segundo plano). Não remova.
import '@/lib/localizacao';
import '@/lib/notificacoes';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProvedorSessao, useSessao } from '@/contexto/Sessao';
import { supabaseConfigurado } from '@/lib/supabase';
import { cores } from '@/lib/tema';

function Navegacao() {
  const { carregando, sessao, perfil } = useSessao();

  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.azulEscuro }}>
        <ActivityIndicator color={cores.verde} size="large" />
      </View>
    );
  }

  const logado = !!sessao;
  const termosOk = !!perfil?.termos_aceitos_em;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.azulEscuro },
        headerTintColor: cores.branco,
        headerTitleStyle: { fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Stack.Protected guard={!supabaseConfigurado}>
        <Stack.Screen name="configuracao-pendente" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={supabaseConfigurado && !logado}>
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
        <Stack.Screen name="cadastro" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="recuperar-senha" options={{ title: 'Recuperar senha' }} />
      </Stack.Protected>

      <Stack.Protected guard={logado && !termosOk}>
        <Stack.Screen name="termos" options={{ title: 'Privacidade e consentimento', headerBackVisible: false }} />
      </Stack.Protected>

      <Stack.Protected guard={logado && termosOk}>
        <Stack.Screen name="(abas)" options={{ headerShown: false }} />
        <Stack.Screen name="historico/[id]" options={{ title: 'Histórico' }} />
        <Stack.Screen name="cerca/nova" options={{ title: 'Nova área de alerta' }} />
        <Stack.Screen name="convite/[codigo]" options={{ title: 'Convite' }} />
        <Stack.Screen name="registros" options={{ title: 'Registro de consentimentos' }} />
      </Stack.Protected>

      <Stack.Screen name="privacidade" options={{ title: 'Política de privacidade', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProvedorSessao>
        <StatusBar style="light" />
        <Navegacao />
      </ProvedorSessao>
    </SafeAreaProvider>
  );
}
