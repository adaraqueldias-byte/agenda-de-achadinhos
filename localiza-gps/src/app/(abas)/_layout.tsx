import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { useSessao } from '@/contexto/Sessao';
import { supabase } from '@/lib/supabase';
import { cores } from '@/lib/tema';

type Icone = React.ComponentProps<typeof Ionicons>['name'];

function icone(ativo: Icone, inativo: Icone) {
  return ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? ativo : inativo} color={color as string} size={size} />
  );
}

function useNaoLidos() {
  const { sessao } = useSessao();
  const [total, setTotal] = useState(0);
  const contar = useCallback(async () => {
    const { count } = await supabase.from('alertas').select('id', { count: 'exact', head: true }).eq('lido', false);
    setTotal(count ?? 0);
  }, []);
  useEffect(() => {
    if (!sessao) return;
    void contar();
    const canal = supabase
      .channel('contador-alertas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, () => void contar())
      .subscribe();
    return () => void supabase.removeChannel(canal);
  }, [sessao, contar]);
  return total;
}

export default function LayoutAbas() {
  const naoLidos = useNaoLidos();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.azulEscuro },
        headerTintColor: cores.branco,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: cores.verdeEscuro,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarStyle: { backgroundColor: cores.branco, borderTopColor: cores.borda },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Mapa', tabBarIcon: icone('map', 'map-outline') }} />
      <Tabs.Screen
        name="aparelhos"
        options={{ title: 'Aparelhos', tabBarIcon: icone('phone-portrait', 'phone-portrait-outline') }}
      />
      <Tabs.Screen name="convites" options={{ title: 'Convites', tabBarIcon: icone('mail', 'mail-outline') }} />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarIcon: icone('notifications', 'notifications-outline'),
          tabBarBadge: naoLidos > 0 ? naoLidos : undefined,
          tabBarBadgeStyle: { backgroundColor: cores.verde, color: cores.azulEscuro },
        }}
      />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: icone('settings', 'settings-outline') }} />
    </Tabs>
  );
}
