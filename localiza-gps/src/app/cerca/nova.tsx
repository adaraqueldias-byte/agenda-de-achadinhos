import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type LatLng } from 'react-native-maps';

import { Botao, Campo, estilos as ui, LinhaOpcao } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco, raio as raios } from '@/lib/tema';

const RAIOS = [100, 200, 500, 1000, 2000];

export default function NovaCerca() {
  const { dispositivo, nome: nomeAparelho } = useLocalSearchParams<{ dispositivo: string; nome?: string }>();
  const { sessao } = useSessao();
  const [centro, setCentro] = useState<LatLng | null>(null);
  const [raio, setRaio] = useState(200);
  const [nome, setNome] = useState('');
  const [entrada, setEntrada] = useState(true);
  const [saida, setSaida] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [regiao, setRegiao] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapa = useRef<MapView>(null);

  // Começa centralizado na última posição real do aparelho, se houver.
  useEffect(() => {
    void (async () => {
      const [meu, outros] = await Promise.all([
        supabase.from('dispositivos').select('ultima_lat, ultima_lng').eq('id', dispositivo).maybeSingle(),
        supabase.rpc('aparelhos_que_acompanho'),
      ]);
      const a =
        meu.data ??
        ((outros.data ?? []) as { dispositivo_id: string; ultima_lat: number | null; ultima_lng: number | null }[]).find(
          (x) => x.dispositivo_id === dispositivo,
        );
      if (a?.ultima_lat != null && a.ultima_lng != null) setRegiao({ latitude: a.ultima_lat, longitude: a.ultima_lng });
    })();
  }, [dispositivo]);

  useEffect(() => {
    if (regiao) mapa.current?.animateToRegion({ ...regiao, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }, [regiao]);

  async function salvar() {
    if (!sessao) return;
    if (!centro) return Alert.alert('Toque no mapa para escolher o local.');
    if (!nome.trim()) return Alert.alert('Dê um nome para a área.', 'Exemplo: Casa, Escola, Trabalho.');
    if (!entrada && !saida) return Alert.alert('Escolha ao menos um tipo de aviso.');
    setSalvando(true);
    const { error } = await supabase.from('cercas').insert({
      criador_id: sessao.user.id,
      dispositivo_id: dispositivo,
      nome: nome.trim(),
      lat: centro.latitude,
      lng: centro.longitude,
      raio_m: raio,
      alerta_entrada: entrada,
      alerta_saida: saida,
    });
    setSalvando(false);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    Alert.alert('Área criada', `Você será avisado sobre “${nomeAparelho ?? 'o aparelho'}” nesta área.`);
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ height: 320 }}>
        <MapView
          ref={mapa}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: -14.235, longitude: -51.925, latitudeDelta: 35, longitudeDelta: 35 }}
          showsUserLocation
          onPress={(e) => setCentro(e.nativeEvent.coordinate)}
        >
          {centro && (
            <>
              <Marker coordinate={centro} draggable onDragEnd={(e) => setCentro(e.nativeEvent.coordinate)} />
              <Circle center={centro} radius={raio} strokeColor={cores.verdeEscuro} fillColor={cores.verde + '33'} />
            </>
          )}
        </MapView>
        {!centro && (
          <View style={estilos.dica}>
            <Text style={{ color: cores.branco, fontWeight: '600' }}>Toque no mapa para marcar o centro da área</Text>
          </View>
        )}
      </View>

      <ScrollView style={ui.tela} contentContainerStyle={ui.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={ui.ajuda}>Aparelho: {nomeAparelho ?? '—'}</Text>
        <Campo rotulo="Nome da área" value={nome} onChangeText={setNome} placeholder="Ex.: Casa" maxLength={60} />
        <Text style={ui.rotulo}>Raio</Text>
        <View style={[ui.linha, { flexWrap: 'wrap', gap: espaco.sm, marginBottom: espaco.md }]}>
          {RAIOS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRaio(r)}
              style={[estilos.chip, raio === r && { backgroundColor: cores.azulEscuro, borderColor: cores.azulEscuro }]}
            >
              <Text style={{ color: raio === r ? cores.branco : cores.texto, fontWeight: '600' }}>
                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
              </Text>
            </Pressable>
          ))}
        </View>
        <LinhaOpcao titulo="Avisar quando chegar" valor={entrada} onChange={setEntrada} />
        <LinhaOpcao titulo="Avisar quando sair" valor={saida} onChange={setSaida} />
        <Text style={[ui.ajuda, { marginBottom: espaco.md }]}>
          O titular do aparelho pode ver as áreas criadas para ele. Os avisos dependem do aparelho estar compartilhando a
          localização.
        </Text>
        <Botao titulo="Salvar área" onPress={salvar} carregando={salvando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  dica: {
    position: 'absolute',
    bottom: espaco.md,
    alignSelf: 'center',
    backgroundColor: cores.azulEscuro + 'DD',
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.sm,
    borderRadius: raios.pill,
  },
  chip: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raios.pill,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.sm,
    backgroundColor: cores.branco,
  },
});
