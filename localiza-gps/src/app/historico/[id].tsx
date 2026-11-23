import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Botao, estilos as ui, Vazio } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { coordenadas, dataLonga, hora } from '@/lib/formatar';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';
import type { Localizacao } from '@/lib/tipos';

function inicioDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function Historico() {
  const { id, nome } = useLocalSearchParams<{ id: string; nome?: string }>();
  const { sessao } = useSessao();
  const [dia, setDia] = useState(() => inicioDoDia(new Date()));
  const [pontos, setPontos] = useState<Localizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [souDono, setSouDono] = useState(false);
  const mapa = useRef<MapView>(null);

  const hoje = inicioDoDia(new Date());
  const ehHoje = dia.getTime() === hoje.getTime();

  const carregar = useCallback(async () => {
    setCarregando(true);
    const fim = new Date(dia);
    fim.setDate(fim.getDate() + 1);
    const { data, error } = await supabase
      .from('localizacoes')
      .select('*')
      .eq('dispositivo_id', id)
      .gte('registrado_em', dia.toISOString())
      .lt('registrado_em', fim.toISOString())
      .order('registrado_em')
      .limit(5000);
    setCarregando(false);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    const lista = (data ?? []) as Localizacao[];
    setPontos(lista);
    if (lista.length) {
      setTimeout(
        () =>
          mapa.current?.fitToCoordinates(
            lista.map((p) => ({ latitude: p.lat, longitude: p.lng })),
            { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
          ),
        300,
      );
    }
  }, [id, dia]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!sessao) return;
    void supabase
      .from('dispositivos')
      .select('id')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setSouDono(!!data));
  }, [id, sessao]);

  function mudarDia(delta: number) {
    const d = new Date(dia);
    d.setDate(d.getDate() + delta);
    if (d > hoje) return;
    setDia(d);
  }

  function apagar(escopo: 'dia' | 'tudo') {
    Alert.alert(
      escopo === 'dia' ? 'Apagar o histórico deste dia?' : 'Apagar TODO o histórico?',
      'Os pontos de localização serão excluídos permanentemente para você e para quem acompanha este aparelho.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            let q = supabase.from('localizacoes').delete().eq('dispositivo_id', id);
            if (escopo === 'dia') {
              const fim = new Date(dia);
              fim.setDate(fim.getDate() + 1);
              q = q.gte('registrado_em', dia.toISOString()).lt('registrado_em', fim.toISOString());
            }
            const { error } = await q;
            if (error) Alert.alert('Erro', mensagemErro(error));
            await carregar();
          },
        },
      ],
    );
  }

  const coords = pontos.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <View style={ui.tela}>
      <Stack.Screen options={{ title: nome ? `Histórico — ${nome}` : 'Histórico' }} />

      <View style={estilos.seletor}>
        <Pressable accessibilityLabel="Dia anterior" onPress={() => mudarDia(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={cores.azulEscuro} />
        </Pressable>
        <Text style={estilos.dia}>{ehHoje ? 'Hoje' : dataLonga(dia)}</Text>
        <Pressable accessibilityLabel="Próximo dia" onPress={() => mudarDia(1)} disabled={ehHoje} hitSlop={12}>
          <Ionicons name="chevron-forward" size={24} color={ehHoje ? cores.inativo : cores.azulEscuro} />
        </Pressable>
      </View>

      <View style={{ height: 300 }}>
        <MapView ref={mapa} style={StyleSheet.absoluteFill}>
          {coords.length > 1 && <Polyline coordinates={coords} strokeColor={cores.azulClaro} strokeWidth={4} />}
          {coords.length > 0 && (
            <Marker coordinate={coords[0]} pinColor="green" title={`Início ${hora(pontos[0].registrado_em)}`} />
          )}
          {coords.length > 1 && (
            <Marker
              coordinate={coords[coords.length - 1]}
              pinColor="red"
              title={`Fim ${hora(pontos[pontos.length - 1].registrado_em)}`}
            />
          )}
        </MapView>
        {carregando && <ActivityIndicator style={StyleSheet.absoluteFill} color={cores.azulEscuro} />}
      </View>

      <FlatList
        data={[...pontos].reverse()}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: espaco.lg }}
        ListHeaderComponent={
          <Text style={ui.ajuda}>
            {pontos.length} {pontos.length === 1 ? 'registro' : 'registros'} neste dia
          </Text>
        }
        ListEmptyComponent={
          carregando ? undefined : (
            <Vazio icone="footsteps-outline" titulo="Sem registros neste dia" texto="Use as setas para ver outros dias." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              mapa.current?.animateToRegion({
                latitude: item.lat,
                longitude: item.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              })
            }
            style={estilos.ponto}
          >
            <Text style={estilos.hora}>{hora(item.registrado_em)}</Text>
            <Text style={{ flex: 1, color: cores.texto }}>{coordenadas(item.lat, item.lng)}</Text>
            {item.precisao != null && <Text style={ui.ajuda}>± {Math.round(item.precisao)} m</Text>}
          </Pressable>
        )}
        ListFooterComponent={
          souDono ? (
            <View style={{ marginTop: espaco.lg }}>
              {pontos.length > 0 && (
                <Botao titulo="Apagar histórico deste dia" variante="secundario" onPress={() => apagar('dia')} />
              )}
              <Botao titulo="Apagar todo o histórico deste aparelho" variante="texto" onPress={() => apagar('tudo')} />
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  seletor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: espaco.md,
    backgroundColor: cores.branco,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  dia: { fontSize: 16, fontWeight: '700', color: cores.texto, textTransform: 'capitalize' },
  ponto: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: espaco.sm,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  hora: { width: 56, fontWeight: '700', color: cores.azulClaro },
});
