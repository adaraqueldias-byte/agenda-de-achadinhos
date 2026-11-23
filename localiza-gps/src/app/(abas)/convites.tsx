import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, Text, View } from 'react-native';

import { AceitarConvite } from '@/components/AceitarConvite';
import { BannerCompartilhamento } from '@/components/BannerCompartilhamento';
import { Botao, Campo, Cartao, estilos, Paragrafo, TituloSecao, Vazio } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { dataHora, mascaraTelefone } from '@/lib/formatar';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';
import type { Convite, ConviteRecebido } from '@/lib/tipos';

const rotuloStatus: Record<Convite['status'], string> = {
  pendente: 'Aguardando resposta',
  aceito: 'Aceito',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
};

export function compartilharConvite(codigo: string, nome: string) {
  return Share.share({
    message:
      `${nome} está pedindo para ver sua localização pelo app Localiza GPS.\n\n` +
      `Abra o convite: localizagps://convite/${codigo}\n` +
      `ou digite o código ${codigo} na aba Convites.\n\n` +
      'Sua localização só será compartilhada se você aceitar, e você pode cancelar quando quiser.',
  });
}

export default function Convites() {
  const { sessao, perfil } = useSessao();
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviados, setEnviados] = useState<Convite[]>([]);
  const [recebidos, setRecebidos] = useState<ConviteRecebido[]>([]);
  const [aberto, setAberto] = useState<ConviteRecebido | null>(null);
  const [ocupado, setOcupado] = useState<'enviar' | 'codigo' | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    const [env, rec] = await Promise.all([
      supabase.from('convites').select('*').eq('remetente_id', sessao.user.id).order('criado_em', { ascending: false }).limit(30),
      supabase.rpc('convites_recebidos'),
    ]);
    setEnviados((env.data ?? []) as Convite[]);
    setRecebidos((rec.data ?? []) as ConviteRecebido[]);
  }, [sessao]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function enviar() {
    const digitos = telefone.replace(/\D/g, '');
    if (digitos && digitos.length < 10) return Alert.alert('Telefone inválido', 'Informe o número com DDD.');
    setOcupado('enviar');
    const { data, error } = await supabase.rpc('criar_convite', {
      p_telefone: digitos || null,
      p_mensagem: mensagem.trim() || null,
    });
    setOcupado(null);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    const convite = data as Convite;
    setTelefone('');
    setMensagem('');
    await carregar();
    Alert.alert(
      'Convite criado',
      `Código: ${convite.codigo}\n\n` +
        (digitos ? 'Se a pessoa já usa o app com este número verificado, ela verá o pedido na aba Convites. ' : '') +
        'Envie o código para ela por WhatsApp, SMS ou outro meio. A localização só aparecerá depois que ela aceitar.',
      [
        { text: 'Fechar', style: 'cancel' },
        { text: 'Enviar código', onPress: () => void compartilharConvite(convite.codigo, perfil?.nome ?? 'Alguém') },
      ],
    );
  }

  async function resgatar() {
    if (codigo.replace(/[^A-Za-z0-9]/g, '').length < 6) return Alert.alert('Código inválido');
    setOcupado('codigo');
    const { data, error } = await supabase.rpc('resgatar_convite', { p_codigo: codigo });
    setOcupado(null);
    if (error) return Alert.alert('Não foi possível abrir o convite', mensagemErro(error));
    setCodigo('');
    const [convite] = (data ?? []) as ConviteRecebido[];
    await carregar();
    if (convite) setAberto(convite);
  }

  function cancelar(c: Convite) {
    Alert.alert('Cancelar convite?', 'O código deixará de funcionar.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar convite',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('cancelar_convite', { p_convite: c.id });
          if (error) Alert.alert('Erro', mensagemErro(error));
          await carregar();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <BannerCompartilhamento />
      <ScrollView
        style={estilos.tela}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
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
        {recebidos.length > 0 && (
          <>
            <TituloSecao>Pedidos recebidos</TituloSecao>
            {recebidos.map((r) => (
              <Cartao key={r.id} estilo={{ borderColor: cores.verde }}>
                <Text style={estilos.itemTitulo}>{r.remetente_nome} quer ver sua localização</Text>
                {r.mensagem && <Text style={[estilos.ajuda, { fontStyle: 'italic' }]}>“{r.mensagem}”</Text>}
                <Botao titulo="Ver pedido" onPress={() => setAberto(r)} estilo={{ marginTop: espaco.sm }} />
              </Cartao>
            ))}
          </>
        )}

        <TituloSecao>Pedir a localização de alguém</TituloSecao>
        <Cartao>
          <Paragrafo suave>
            O número serve só para identificar a pessoa no app. A localização dela aparece apenas depois que ela aceitar o convite
            no próprio celular.
          </Paragrafo>
          <Campo
            rotulo="Celular (opcional)"
            value={telefone}
            onChangeText={(t) => setTelefone(mascaraTelefone(t))}
            keyboardType="phone-pad"
            placeholder="(11) 91234-5678"
            ajuda="Deixe em branco para gerar apenas um código de convite."
          />
          <Campo
            rotulo="Mensagem (opcional)"
            value={mensagem}
            onChangeText={setMensagem}
            maxLength={200}
            placeholder="Ex.: Oi, é a Ana!"
          />
          <Botao titulo="Criar convite" icone="paper-plane-outline" onPress={enviar} carregando={ocupado === 'enviar'} />
        </Cartao>

        <TituloSecao>Recebi um código</TituloSecao>
        <Cartao>
          <Campo
            rotulo="Código do convite"
            value={codigo}
            onChangeText={(t) => setCodigo(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Ex.: K7M2QX9P"
            maxLength={12}
          />
          <Botao titulo="Abrir convite" variante="secundario" onPress={resgatar} carregando={ocupado === 'codigo'} />
        </Cartao>

        <TituloSecao>Convites enviados</TituloSecao>
        <Cartao>
          {enviados.length === 0 ? (
            <Vazio icone="mail-open-outline" titulo="Nenhum convite enviado" />
          ) : (
            enviados.map((c) => {
              const expirado = c.status === 'pendente' && new Date(c.expira_em) < new Date();
              return (
                <View key={c.id} style={{ paddingVertical: espaco.sm, borderBottomWidth: 1, borderBottomColor: cores.borda }}>
                  <Text style={estilos.itemTitulo}>
                    {c.telefone_destino ? mascaraTelefone(c.telefone_destino.replace(/^55/, '')) : 'Convite por código'} ·{' '}
                    <Text style={{ fontFamily: 'monospace' }}>{c.codigo}</Text>
                  </Text>
                  <Text style={estilos.ajuda}>
                    {expirado ? 'Expirado' : rotuloStatus[c.status]} · {dataHora(c.criado_em)}
                  </Text>
                  {c.status === 'pendente' && !expirado && (
                    <View style={[estilos.linha, { gap: espaco.sm }]}>
                      <Botao
                        titulo="Reenviar código"
                        variante="secundario"
                        estilo={{ flex: 1 }}
                        onPress={() => void compartilharConvite(c.codigo, perfil?.nome ?? 'Alguém')}
                      />
                      <Botao titulo="Cancelar" variante="texto" estilo={{ flex: 1 }} onPress={() => cancelar(c)} />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </Cartao>
      </ScrollView>

      <AceitarConvite
        convite={aberto}
        onFechar={(respondido) => {
          setAberto(null);
          if (respondido) void carregar();
        }}
      />
    </View>
  );
}
