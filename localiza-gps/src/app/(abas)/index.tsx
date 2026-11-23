import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import { BannerCompartilhamento } from '@/components/BannerCompartilhamento';
import { Botao, corDaSituacao, estilos as ui, Selo, Vazio } from '@/components/ui';
import { coordenadas, dataHora, rotuloSituacao, situacao, tempoRelativo } from '@/lib/formatar';
import { enderecoAproximado } from '@/lib/localizacao';
import { cores, espaco, raio } from '@/lib/tema';
import { useAparelhos, type AparelhoMapa } from '@/lib/useAparelhos';

// Visão inicial ampla do Brasil, usada apenas enquanto não há nenhuma
// localização real para exibir (não representa a posição de ninguém).
const REGIAO_BRASIL: Region = { latitude: -14.235, longitude: -51.925, latitudeDelta: 35, longitudeDelta: 35 };

export default function Mapa() {
  const { itens, carregando, erro } = useAparelhos();
  const mapa = useRef<MapView>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [endereco, setEndereco] = useState<string | null>(null);
  const centralizou = useRef(false);

  const comPosicao = useMemo(() => itens.filter((i) => i.lat != null && i.lng != null), [itens]);
  const atual = itens.find((i) => i.id === selecionado) ?? null;

  // Enquadra todos os aparelhos na primeira carga.
  useEffect(() => {
    if (centralizou.current || comPosicao.length === 0 || !mapa.current) return;
    centralizou.current = true;
    mapa.current.fitToCoordinates(
      comPosicao.map((i) => ({ latitude: i.lat!, longitude: i.lng! })),
      { edgePadding: { top: 80, right: 60, bottom: 260, left: 60 }, animated: false },
    );
  }, [comPosicao]);

  // Endereço aproximado do aparelho selecionado.
  useEffect(() => {
    setEndereco(null);
    if (atual?.lat == null || atual.lng == null) return;
    let vivo = true;
    void enderecoAproximado(atual.lat, atual.lng).then((e) => vivo && setEndereco(e));
    return () => {
      vivo = false;
    };
  }, [atual?.id, atual?.lat, atual?.lng]);

  function focar(a: AparelhoMapa) {
    setSelecionado(a.id);
    if (a.lat != null && a.lng != null) {
      mapa.current?.animateToRegion({ latitude: a.lat, longitude: a.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <BannerCompartilhamento />
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapa}
          style={StyleSheet.absoluteFill}
          initialRegion={REGIAO_BRASIL}
          showsUserLocation
          showsMyLocationButton
          onPress={() => setSelecionado(null)}
        >
          {comPosicao.map((a) => {
            const s = situacao(a.compartilhando, a.atualizado);
            return (
              <Marker
                key={a.id}
                coordinate={{ latitude: a.lat!, longitude: a.lng! }}
                onPress={(e) => {
                  e.stopPropagation();
                  focar(a);
                }}
                tracksViewChanges={false}
              >
                <View style={[estilos.pino, { backgroundColor: corDaSituacao(s) }]}>
                  <Ionicons name={a.meu ? 'phone-portrait' : 'person'} size={18} color={cores.branco} />
                </View>
              </Marker>
            );
          })}
          {atual?.lat != null && atual.lng != null && atual.precisao != null && (
            <Circle
              center={{ latitude: atual.lat, longitude: atual.lng }}
              radius={atual.precisao}
              strokeColor={cores.verde}
              fillColor={cores.verde + '33'}
            />
          )}
        </MapView>

        {carregando && (
          <View style={estilos.carregando}>
            <ActivityIndicator color={cores.azulEscuro} />
          </View>
        )}

        <View style={estilos.painel}>
          {erro ? (
            <Vazio
              icone="cloud-offline-outline"
              titulo="Não foi possível carregar"
              texto="Verifique sua conexão com a internet."
            />
          ) : atual ? (
            <Detalhe aparelho={atual} endereco={endereco} onFechar={() => setSelecionado(null)} />
          ) : itens.length === 0 && !carregando ? (
            <View>
              <Vazio
                icone="location-outline"
                titulo="Nenhum aparelho ainda"
                texto="Cadastre este celular ou convide alguém para compartilhar a localização com você."
              />
              <Botao titulo="Convidar alguém" icone="person-add-outline" onPress={() => router.navigate('/convites')} />
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 220 }}>
              {itens.map((a) => {
                const s = situacao(a.compartilhando, a.atualizado);
                return (
                  <Pressable key={a.id} onPress={() => focar(a)} style={estilos.item}>
                    <View style={[estilos.avatar, { backgroundColor: corDaSituacao(s) }]}>
                      <Ionicons name={a.meu ? 'phone-portrait' : 'person'} size={18} color={cores.branco} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.itemTitulo} numberOfLines={1}>
                        {a.nome}
                        {a.esteCelular ? ' (este celular)' : ''}
                      </Text>
                      <Text style={ui.ajuda} numberOfLines={1}>
                        {a.meu ? 'Seu aparelho' : a.titular} · {rotuloSituacao[s]} · {tempoRelativo(a.atualizado)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={cores.inativo} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

function Detalhe({ aparelho: a, endereco, onFechar }: { aparelho: AparelhoMapa; endereco: string | null; onFechar: () => void }) {
  const s = situacao(a.compartilhando, a.atualizado);
  return (
    <View>
      <View style={[ui.linha, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[ui.itemTitulo, { fontSize: 18 }]} numberOfLines={1}>
            {a.nome}
          </Text>
          <Text style={ui.ajuda}>{a.meu ? 'Seu aparelho' : `Compartilhado por ${a.titular}`}</Text>
        </View>
        <Pressable accessibilityLabel="Fechar" onPress={onFechar} hitSlop={12}>
          <Ionicons name="close" size={22} color={cores.textoSuave} />
        </Pressable>
      </View>

      <View style={{ marginVertical: espaco.sm }}>
        <Selo texto={rotuloSituacao[s]} cor={corDaSituacao(s)} />
      </View>

      {a.lat != null && a.lng != null && a.atualizado ? (
        <>
          <Linha icone="navigate-outline" texto={endereco ?? 'Buscando endereço aproximado…'} />
          <Linha
            icone="locate-outline"
            texto={`${coordenadas(a.lat, a.lng)}${a.precisao ? `  (± ${Math.round(a.precisao)} m)` : ''}`}
          />
          <Linha icone="time-outline" texto={`Última atualização: ${dataHora(a.atualizado)} (${tempoRelativo(a.atualizado)})`} />
        </>
      ) : (
        <Linha icone="hourglass-outline" texto="Ainda não há localização registrada após a autorização." />
      )}

      {(s === 'offline' || s === 'desatualizado') && (
        <Text style={[ui.ajuda, { color: cores.aviso }]}>
          O aparelho pode estar sem internet, desligado ou com a localização desativada.
        </Text>
      )}

      <View style={[ui.linha, { marginTop: espaco.sm, gap: espaco.sm }]}>
        <Botao
          titulo="Histórico"
          icone="analytics-outline"
          variante="secundario"
          estilo={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/historico/[id]', params: { id: a.id, nome: a.nome } })}
        />
        <Botao
          titulo="Criar alerta"
          icone="notifications-outline"
          variante="secundario"
          estilo={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/cerca/nova', params: { dispositivo: a.id, nome: a.nome } })}
        />
      </View>
    </View>
  );
}

function Linha({ icone, texto }: { icone: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={[ui.linha, { alignItems: 'flex-start', marginBottom: 6 }]}>
      <Ionicons name={icone} size={16} color={cores.textoSuave} style={{ marginRight: 8, marginTop: 2 }} />
      <Text style={{ flex: 1, color: cores.texto, fontSize: 14 }}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pino: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: cores.branco,
  },
  painel: {
    position: 'absolute',
    left: espaco.md,
    right: espaco.md,
    bottom: espaco.md,
    backgroundColor: cores.branco,
    borderRadius: raio.lg,
    padding: espaco.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: espaco.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: espaco.md },
  carregando: {
    position: 'absolute',
    top: espaco.md,
    alignSelf: 'center',
    backgroundColor: cores.branco,
    padding: 8,
    borderRadius: 20,
  },
});
