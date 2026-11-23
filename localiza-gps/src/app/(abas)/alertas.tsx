import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert as Dialogo, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { BannerCompartilhamento } from '@/components/BannerCompartilhamento';
import { Botao, Cartao, estilos, LinhaOpcao, TituloSecao, Vazio, type NomeIcone } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { dataHora } from '@/lib/formatar';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';
import type { Alerta, Cerca } from '@/lib/tipos';

const iconeTipo: Record<Alerta['tipo'], NomeIcone> = {
  entrada_cerca: 'enter-outline',
  saida_cerca: 'exit-outline',
  compartilhamento_parado: 'pause-circle-outline',
  localizacao_desatualizada: 'cloud-offline-outline',
  convite_recebido: 'mail-unread-outline',
  convite_aceito: 'checkmark-done-outline',
  acesso_revogado: 'remove-circle-outline',
};

export default function Alertas() {
  const { sessao } = useSessao();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cercas, setCercas] = useState<(Cerca & { dispositivo_nome?: string })[]>([]);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    const [a, c, aparelhos, meus] = await Promise.all([
      supabase.from('alertas').select('*').order('criado_em', { ascending: false }).limit(100),
      supabase.from('cercas').select('*').eq('criador_id', sessao.user.id).order('criado_em', { ascending: false }),
      supabase.rpc('aparelhos_que_acompanho'),
      supabase.from('dispositivos').select('id, nome'),
    ]);
    const nomes = new Map<string, string>();
    for (const x of (aparelhos.data ?? []) as { dispositivo_id: string; dispositivo_nome: string }[])
      nomes.set(x.dispositivo_id, x.dispositivo_nome);
    for (const x of (meus.data ?? []) as { id: string; nome: string }[]) nomes.set(x.id, x.nome);
    setAlertas((a.data ?? []) as Alerta[]);
    setCercas(((c.data ?? []) as Cerca[]).map((x) => ({ ...x, dispositivo_nome: nomes.get(x.dispositivo_id) })));
  }, [sessao]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function marcarTodosLidos() {
    await supabase.from('alertas').update({ lido: true }).eq('lido', false);
    await carregar();
  }

  async function marcarLido(a: Alerta) {
    if (a.lido) return;
    await supabase.from('alertas').update({ lido: true }).eq('id', a.id);
    setAlertas((l) => l.map((x) => (x.id === a.id ? { ...x, lido: true } : x)));
  }

  function limpar() {
    Dialogo.alert('Apagar todos os alertas?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('alertas').delete().eq('destinatario_id', sessao!.user.id);
          await carregar();
        },
      },
    ]);
  }

  async function alterarCerca(c: Cerca, campos: Partial<Pick<Cerca, 'ativa' | 'alerta_entrada' | 'alerta_saida'>>) {
    const { error } = await supabase.from('cercas').update(campos).eq('id', c.id);
    if (error) return Dialogo.alert('Erro', mensagemErro(error));
    setCercas((l) => l.map((x) => (x.id === c.id ? { ...x, ...campos } : x)));
  }

  function removerCerca(c: Cerca) {
    Dialogo.alert('Remover área?', `A área “${c.nome}” deixará de gerar alertas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('cercas').delete().eq('id', c.id);
          await carregar();
        },
      },
    ]);
  }

  const naoLidos = alertas.filter((a) => !a.lido).length;

  return (
    <View style={{ flex: 1 }}>
      <BannerCompartilhamento />
      <ScrollView
        style={estilos.tela}
        contentContainerStyle={estilos.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar();
              setAtualizando(false);
            }}
          />
        }
      >
        <TituloSecao>Áreas de alerta (cercas virtuais)</TituloSecao>
        <Cartao>
          {cercas.length === 0 ? (
            <Vazio
              icone="radio-button-on-outline"
              titulo="Nenhuma área criada"
              texto="No mapa, toque em um aparelho e em “Criar alerta” para ser avisado quando ele chegar ou sair de um local."
            />
          ) : (
            cercas.map((c) => (
              <View key={c.id} style={{ paddingVertical: espaco.sm, borderBottomWidth: 1, borderBottomColor: cores.borda }}>
                <View style={[estilos.linha, { justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.itemTitulo}>{c.nome}</Text>
                    <Text style={estilos.ajuda}>
                      {c.dispositivo_nome ?? 'Aparelho sem acesso'} · raio de {c.raio_m} m
                      {c.dentro == null ? '' : c.dentro ? ' · dentro agora' : ' · fora agora'}
                    </Text>
                  </View>
                  <Botao titulo="Remover" variante="texto" onPress={() => removerCerca(c)} />
                </View>
                <LinhaOpcao titulo="Ativa" valor={c.ativa} onChange={(v) => void alterarCerca(c, { ativa: v })} />
                <LinhaOpcao
                  titulo="Avisar na chegada"
                  valor={c.alerta_entrada}
                  onChange={(v) => void alterarCerca(c, { alerta_entrada: v })}
                />
                <LinhaOpcao
                  titulo="Avisar na saída"
                  valor={c.alerta_saida}
                  onChange={(v) => void alterarCerca(c, { alerta_saida: v })}
                />
              </View>
            ))
          )}
        </Cartao>

        <View style={[estilos.linha, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
          <TituloSecao>Alertas {naoLidos ? `(${naoLidos} novos)` : ''}</TituloSecao>
          {alertas.length > 0 && (
            <View style={estilos.linha}>
              {naoLidos > 0 && <Botao titulo="Marcar lidos" variante="texto" onPress={marcarTodosLidos} />}
              <Botao titulo="Limpar" variante="texto" onPress={limpar} />
            </View>
          )}
        </View>
        {alertas.length === 0 ? (
          <Cartao>
            <Vazio icone="notifications-off-outline" titulo="Nenhum alerta" />
          </Cartao>
        ) : (
          alertas.map((a) => (
            <Pressable key={a.id} onPress={() => void marcarLido(a)}>
              <Cartao estilo={!a.lido && { borderColor: cores.verde, backgroundColor: '#F2FBFA' }}>
                <View style={[estilos.linha, { alignItems: 'flex-start' }]}>
                  <Ionicons name={iconeTipo[a.tipo]} size={22} color={cores.azulClaro} style={{ marginRight: espaco.md }} />
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.itemTitulo}>{a.titulo}</Text>
                    <Text style={{ color: cores.texto, marginTop: 2 }}>{a.mensagem}</Text>
                    <Text style={estilos.ajuda}>{dataHora(a.criado_em)}</Text>
                  </View>
                </View>
              </Cartao>
            </Pressable>
          ))
        )}
        <Text style={[estilos.ajuda, { textAlign: 'center' }]}>Alertas são apagados automaticamente após 90 dias.</Text>
      </ScrollView>
    </View>
  );
}
