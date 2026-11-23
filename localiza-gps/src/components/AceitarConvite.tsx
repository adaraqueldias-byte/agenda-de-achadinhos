import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Botao, Cartao, estilos, Paragrafo } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { dataHora } from '@/lib/formatar';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';
import type { ConviteRecebido, Dispositivo } from '@/lib/tipos';

/**
 * Tela de consentimento explícito: o titular escolhe QUAIS aparelhos
 * compartilhar e confirma que entende o que está autorizando.
 */
export function AceitarConvite({
  convite,
  onFechar,
}: {
  convite: ConviteRecebido | null;
  onFechar: (respondido: boolean) => void;
}) {
  const { esteAparelho } = useSessao();
  const [aparelhos, setAparelhos] = useState<Dispositivo[]>([]);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [entendi, setEntendi] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!convite) return;
    setEntendi(false);
    void supabase
      .from('dispositivos')
      .select('*')
      .order('criado_em')
      .then(({ data }) => {
        const lista = (data ?? []) as Dispositivo[];
        setAparelhos(lista);
        setEscolhidos(esteAparelho && lista.some((d) => d.id === esteAparelho.id) ? [esteAparelho.id] : []);
      });
  }, [convite, esteAparelho]);

  async function responder(aceitar: boolean) {
    if (!convite) return;
    setOcupado(true);
    const { error } = await supabase.rpc('responder_convite', {
      p_convite: convite.id,
      p_aceitar: aceitar,
      p_dispositivos: aceitar ? escolhidos : [],
    });
    setOcupado(false);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    onFechar(true);
    if (aceitar) {
      const algumDesligado = aparelhos.some((d) => escolhidos.includes(d.id) && !d.compartilhando);
      Alert.alert(
        'Acesso concedido',
        `${convite.remetente_nome} agora pode ver a localização dos aparelhos escolhidos.` +
          (algumDesligado ? '\n\nLembre-se de ativar “Compartilhar minha localização” na aba Aparelhos.' : ''),
      );
    }
  }

  const alternar = (id: string) => setEscolhidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  return (
    <Modal visible={!!convite} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onFechar(false)}>
      {convite && (
        <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { paddingTop: espaco.xl }]}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: cores.texto, marginBottom: espaco.sm }}>
            Pedido de localização
          </Text>
          <Paragrafo>
            <Text style={{ fontWeight: '700' }}>{convite.remetente_nome}</Text> quer ver a sua localização.
          </Paragrafo>
          {convite.mensagem && (
            <Cartao>
              <Text style={{ fontStyle: 'italic', color: cores.texto }}>“{convite.mensagem}”</Text>
            </Cartao>
          )}
          <Text style={estilos.ajuda}>
            Enviado em {dataHora(convite.criado_em)} · expira em {dataHora(convite.expira_em)}
          </Text>

          <Text style={estilos.tituloSecao}>Quais aparelhos compartilhar?</Text>
          <Cartao>
            {aparelhos.length === 0 ? (
              <>
                <Paragrafo>Você ainda não cadastrou nenhum aparelho. Cadastre este celular primeiro.</Paragrafo>
                <Botao
                  titulo="Cadastrar este celular"
                  onPress={() => {
                    onFechar(false);
                    router.navigate('/aparelhos');
                  }}
                />
              </>
            ) : (
              aparelhos.map((d) => (
                <Pressable
                  key={d.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: escolhidos.includes(d.id) }}
                  onPress={() => alternar(d.id)}
                  style={[estilos.linha, { paddingVertical: espaco.sm }]}
                >
                  <Ionicons
                    name={escolhidos.includes(d.id) ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={escolhidos.includes(d.id) ? cores.verdeEscuro : cores.textoSuave}
                  />
                  <Text style={[estilos.itemTitulo, { marginLeft: espaco.sm }]}>
                    {d.nome}
                    {d.id === esteAparelho?.id ? ' (este celular)' : ''}
                  </Text>
                </Pressable>
              ))
            )}
          </Cartao>

          <Cartao estilo={{ backgroundColor: '#EAF8F6', borderColor: cores.verde }}>
            <Text style={[estilos.itemTitulo, { marginBottom: espaco.sm }]}>O que você está autorizando</Text>
            <Text style={estilos.paragrafo}>
              • {convite.remetente_nome} verá a localização atual e o histórico dos aparelhos escolhidos, somente a partir de
              agora.{'\n'}• A pessoa poderá criar alertas de chegada e saída de locais.{'\n'}• Você pode pausar o compartilhamento
              ou retirar este acesso a qualquer momento em Aparelhos.
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: entendi }}
              onPress={() => setEntendi(!entendi)}
              style={[estilos.linha, { alignItems: 'flex-start' }]}
            >
              <Ionicons
                name={entendi ? 'checkbox' : 'square-outline'}
                size={24}
                color={entendi ? cores.verdeEscuro : cores.textoSuave}
              />
              <Text style={{ flex: 1, marginLeft: espaco.sm, color: cores.texto, fontWeight: '600' }}>
                Eu sou o dono destes aparelhos e autorizo {convite.remetente_nome} a ver a localização deles.
              </Text>
            </Pressable>
          </Cartao>

          <Botao
            titulo="Autorizar"
            icone="checkmark-circle-outline"
            onPress={() => void responder(true)}
            carregando={ocupado}
            desabilitado={!entendi || escolhidos.length === 0}
          />
          <Botao titulo="Recusar convite" variante="secundario" onPress={() => void responder(false)} desabilitado={ocupado} />
          <Botao titulo="Decidir depois" variante="texto" onPress={() => onFechar(false)} />
        </ScrollView>
      )}
    </Modal>
  );
}
