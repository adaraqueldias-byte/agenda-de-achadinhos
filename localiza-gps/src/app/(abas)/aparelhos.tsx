import * as Device from 'expo-device';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';

import { BannerCompartilhamento } from '@/components/BannerCompartilhamento';
import { Botao, Campo, Cartao, corDaSituacao, estilos, LinhaOpcao, Paragrafo, Selo, TituloSecao, Vazio } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { dataHora, rotuloSituacao, situacao, tempoRelativo } from '@/lib/formatar';
import { iniciarCompartilhamento, pararCompartilhamento } from '@/lib/localizacao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';
import type { AparelhoAcompanhado, Dispositivo, QuemMeVe } from '@/lib/tipos';

export default function Aparelhos() {
  const { sessao, esteAparelho, definirEsteAparelho, recarregarAparelho } = useSessao();
  const [meus, setMeus] = useState<Dispositivo[]>([]);
  const [quemVe, setQuemVe] = useState<QuemMeVe[]>([]);
  const [acompanho, setAcompanho] = useState<AparelhoAcompanhado[]>([]);
  const [atualizando, setAtualizando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState(Device.modelName ?? '');
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('dispositivos').select('*').order('criado_em'),
      supabase.rpc('quem_me_ve'),
      supabase.rpc('aparelhos_que_acompanho'),
    ]);
    setMeus((a.data ?? []) as Dispositivo[]);
    setQuemVe((b.data ?? []) as QuemMeVe[]);
    setAcompanho((c.data ?? []) as AparelhoAcompanhado[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      void recarregarAparelho();
    }, [carregar, recarregarAparelho]),
  );

  async function atualizar() {
    setAtualizando(true);
    await Promise.all([carregar(), recarregarAparelho()]);
    setAtualizando(false);
  }

  async function cadastrarEste() {
    if (!sessao) return;
    const nome = nomeNovo.trim();
    if (!nome) return Alert.alert('Dê um nome para este aparelho.', 'Exemplo: “Celular da Ana”.');
    setOcupado(true);
    const { data, error } = await supabase
      .from('dispositivos')
      .insert({ dono_id: sessao.user.id, nome, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' })
      .select()
      .single();
    setOcupado(false);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    await definirEsteAparelho(data as Dispositivo);
    await carregar();
  }

  function pedirAtivacao() {
    if (!esteAparelho) return;
    Alert.alert(
      'Compartilhar localização?',
      `A localização de “${esteAparelho.nome}” será enviada periodicamente e ficará visível apenas para as pessoas que você autorizou` +
        (quemVe.length ? ` (${quemVe.length}).` : ' — por enquanto ninguém.') +
        '\n\nNa próxima tela o sistema pedirá permissão de localização. Para continuar compartilhando com o app fechado, escolha “Permitir o tempo todo” / “Sempre”.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => void ativar() },
      ],
    );
  }

  async function ativar() {
    if (!esteAparelho) return;
    setOcupado(true);
    // O servidor só aceita pontos com "compartilhando = true".
    const { error } = await supabase.from('dispositivos').update({ compartilhando: true }).eq('id', esteAparelho.id);
    if (error) {
      setOcupado(false);
      return Alert.alert('Erro', mensagemErro(error));
    }
    const r = await iniciarCompartilhamento();
    if (!r.ok) {
      await supabase.from('dispositivos').update({ compartilhando: false }).eq('id', esteAparelho.id);
      setOcupado(false);
      await recarregarAparelho();
      return r.motivo === 'servicos-desligados'
        ? Alert.alert('Localização desligada', 'Ative os serviços de localização do aparelho e tente novamente.')
        : Alert.alert(
            'Permissão negada',
            'Sem a permissão de localização não é possível compartilhar. Você pode alterá-la nos ajustes do sistema.',
            [
              { text: 'Agora não', style: 'cancel' },
              { text: 'Abrir ajustes', onPress: () => void Linking.openSettings() },
            ],
          );
    }
    setOcupado(false);
    await recarregarAparelho();
    if (r.modo === 'em-uso') {
      Alert.alert(
        'Compartilhando com o app aberto',
        'Você permitiu a localização apenas durante o uso. Ela será enviada enquanto o Localiza GPS estiver aberto. Para enviar também em segundo plano, altere para “Sempre” nos ajustes do sistema.',
      );
    }
  }

  async function desativar() {
    if (!esteAparelho) return;
    setOcupado(true);
    await pararCompartilhamento();
    const { error } = await supabase.from('dispositivos').update({ compartilhando: false }).eq('id', esteAparelho.id);
    setOcupado(false);
    if (error)
      Alert.alert(
        'Erro',
        `O envio foi interrompido neste celular, mas não foi possível avisar o servidor: ${mensagemErro(error)}`,
      );
    await recarregarAparelho();
  }

  function remover(d: Dispositivo) {
    Alert.alert(
      'Remover aparelho?',
      `“${d.nome}” será removido junto com todo o histórico de localização e os acessos concedidos. Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (d.id === esteAparelho?.id) {
              await pararCompartilhamento();
              await definirEsteAparelho(null);
            }
            const { error } = await supabase.from('dispositivos').delete().eq('id', d.id);
            if (error) Alert.alert('Erro', mensagemErro(error));
            await carregar();
          },
        },
      ],
    );
  }

  function revogar(id: string, pergunta: string) {
    Alert.alert('Confirmar', pergunta, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('revogar_compartilhamento', { p_compartilhamento: id });
          if (error) Alert.alert('Erro', mensagemErro(error));
          await carregar();
        },
      },
    ]);
  }

  const outros = meus.filter((d) => d.id !== esteAparelho?.id);

  return (
    <View style={{ flex: 1 }}>
      <BannerCompartilhamento />
      <ScrollView
        style={estilos.tela}
        contentContainerStyle={estilos.conteudo}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} />}
      >
        <TituloSecao>Este celular</TituloSecao>
        {esteAparelho ? (
          <Cartao>
            <Text style={[estilos.itemTitulo, { fontSize: 18 }]}>{esteAparelho.nome}</Text>
            <View style={{ marginVertical: espaco.sm }}>
              {(() => {
                const s = situacao(esteAparelho.compartilhando, esteAparelho.ultima_atualizacao);
                return <Selo texto={rotuloSituacao[s]} cor={corDaSituacao(s)} />;
              })()}
            </View>
            <LinhaOpcao
              titulo="Compartilhar minha localização"
              descricao={
                esteAparelho.compartilhando
                  ? `Visível para ${quemVe.filter((q) => q.dispositivo_id === esteAparelho.id).length} pessoa(s) autorizada(s).`
                  : 'Desligado. Ninguém recebe sua localização.'
              }
              valor={esteAparelho.compartilhando}
              desabilitado={ocupado}
              onChange={(v) => (v ? pedirAtivacao() : void desativar())}
            />
            {esteAparelho.ultima_atualizacao && (
              <Text style={estilos.ajuda}>Último envio: {dataHora(esteAparelho.ultima_atualizacao)}</Text>
            )}
          </Cartao>
        ) : (
          <Cartao>
            <Paragrafo>
              Cadastre este celular para poder compartilhar a localização dele com pessoas que você autorizar.
            </Paragrafo>
            <Campo
              rotulo="Nome do aparelho"
              value={nomeNovo}
              onChangeText={setNomeNovo}
              placeholder="Ex.: Celular da Ana"
              maxLength={60}
            />
            <Botao titulo="Cadastrar este celular" icone="add-circle-outline" onPress={cadastrarEste} carregando={ocupado} />
          </Cartao>
        )}

        <TituloSecao>Quem vê minha localização</TituloSecao>
        <Cartao>
          {quemVe.length === 0 ? (
            <Vazio icone="eye-off-outline" titulo="Ninguém" texto="Quando você aceitar um convite, a pessoa aparecerá aqui." />
          ) : (
            quemVe.map((q) => (
              <View key={q.compartilhamento_id} style={[estilos.linha, { paddingVertical: espaco.sm }]}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.itemTitulo}>{q.observador_nome}</Text>
                  <Text style={estilos.ajuda}>
                    Vê “{q.dispositivo_nome}” desde {dataHora(q.consentido_em)}
                  </Text>
                </View>
                <Botao
                  titulo="Retirar"
                  variante="secundario"
                  onPress={() =>
                    revogar(
                      q.compartilhamento_id,
                      `${q.observador_nome} deixará de ver a localização de “${q.dispositivo_nome}” imediatamente.`,
                    )
                  }
                />
              </View>
            ))
          )}
        </Cartao>

        <TituloSecao>Aparelhos que acompanho</TituloSecao>
        <Cartao>
          {acompanho.length === 0 ? (
            <Vazio icone="people-outline" titulo="Nenhum" texto="Envie um convite na aba Convites." />
          ) : (
            acompanho.map((a) => {
              const s = situacao(a.compartilhando, a.ultima_atualizacao);
              return (
                <View
                  key={a.compartilhamento_id}
                  style={{ paddingVertical: espaco.sm, borderBottomWidth: 1, borderBottomColor: cores.borda }}
                >
                  <Text style={estilos.itemTitulo}>
                    {a.dispositivo_nome} <Text style={estilos.ajuda}>· {a.titular_nome}</Text>
                  </Text>
                  <Text style={estilos.ajuda}>
                    {rotuloSituacao[s]} · {tempoRelativo(a.ultima_atualizacao)}
                  </Text>
                  <View style={[estilos.linha, { gap: espaco.sm, marginTop: espaco.xs }]}>
                    <Botao
                      titulo="Histórico"
                      variante="secundario"
                      estilo={{ flex: 1 }}
                      onPress={() =>
                        router.push({ pathname: '/historico/[id]', params: { id: a.dispositivo_id, nome: a.dispositivo_nome } })
                      }
                    />
                    <Botao
                      titulo="Deixar de seguir"
                      variante="texto"
                      estilo={{ flex: 1 }}
                      onPress={() =>
                        revogar(a.compartilhamento_id, `Você deixará de ver a localização de “${a.dispositivo_nome}”.`)
                      }
                    />
                  </View>
                </View>
              );
            })
          )}
        </Cartao>

        {outros.length > 0 && (
          <>
            <TituloSecao>Meus outros aparelhos</TituloSecao>
            <Cartao>
              {outros.map((d) => (
                <View key={d.id} style={[estilos.linha, { paddingVertical: espaco.sm }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.itemTitulo}>{d.nome}</Text>
                    <Text style={estilos.ajuda}>
                      {d.plataforma === 'ios' ? 'iPhone' : 'Android'} · {d.compartilhando ? 'compartilhando' : 'pausado'} ·{' '}
                      {tempoRelativo(d.ultima_atualizacao)}
                    </Text>
                  </View>
                  <Botao titulo="Remover" variante="texto" onPress={() => remover(d)} />
                </View>
              ))}
            </Cartao>
          </>
        )}

        {esteAparelho && <Botao titulo="Remover este celular da conta" variante="texto" onPress={() => remover(esteAparelho)} />}
      </ScrollView>
    </View>
  );
}
