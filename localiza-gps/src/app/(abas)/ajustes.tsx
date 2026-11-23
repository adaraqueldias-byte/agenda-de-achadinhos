import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { BannerCompartilhamento } from '@/components/BannerCompartilhamento';
import { Botao, Campo, Cartao, estilos, LinhaOpcao, Paragrafo, TituloSecao } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { mascaraTelefone, telefoneE164 } from '@/lib/formatar';
import { lerPermissoes, pararCompartilhamento, type EstadoPermissoes } from '@/lib/localizacao';
import { desativarNotificacoes, registrarNotificacoes } from '@/lib/notificacoes';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco, raio } from '@/lib/tema';

const PRAZOS = [7, 15, 30, 90, 365];

const rotuloPermissao: Record<string, string> = {
  granted: 'Permitida',
  denied: 'Negada',
  undetermined: 'Não solicitada',
};

export default function Ajustes() {
  const { sessao, perfil, recarregarPerfil, recarregarAparelho, sair } = useSessao();
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [permissoes, setPermissoes] = useState<EstadoPermissoes | null>(null);
  const [push, setPush] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [codigoSms, setCodigoSms] = useState('');
  const [aguardandoSms, setAguardandoSms] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const telefoneVerificado = sessao?.user.phone ? `+${sessao.user.phone}` : null;

  const carregar = useCallback(async () => {
    setPermissoes(await lerPermissoes());
    const n = await Notifications.getPermissionsAsync();
    setPush(n.status === 'granted');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function salvarNome() {
    if (!sessao || !nome.trim()) return;
    setOcupado('nome');
    const { error } = await supabase.from('perfis').update({ nome: nome.trim() }).eq('id', sessao.user.id);
    setOcupado(null);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    await recarregarPerfil();
    Alert.alert('Nome atualizado');
  }

  async function alterarPrazo(dias: number) {
    if (!sessao) return;
    const { error } = await supabase.from('perfis').update({ retencao_dias: dias }).eq('id', sessao.user.id);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    await recarregarPerfil();
  }

  async function alternarPush(ativar: boolean) {
    if (!ativar) {
      await desativarNotificacoes();
      setPush(false);
      return;
    }
    const r = await registrarNotificacoes();
    if (r.ok) return setPush(true);
    const msg = {
      simulador: 'Notificações push só funcionam em um aparelho físico.',
      negado: 'Permissão negada. Ative as notificações nos ajustes do sistema.',
      'sem-project-id': 'O app não tem EAS_PROJECT_ID configurado (veja docs/CONFIGURACAO.md).',
      erro: `Não foi possível registrar: ${r.detalhe ?? ''}`,
    }[r.motivo];
    Alert.alert('Notificações', msg);
  }

  async function enviarSms() {
    const e164 = telefoneE164(telefone);
    if (!e164) return Alert.alert('Telefone inválido', 'Informe o número com DDD.');
    setOcupado('sms');
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    setOcupado(null);
    if (error) return Alert.alert('Não foi possível enviar o SMS', mensagemErro(error));
    setAguardandoSms(e164);
  }

  async function confirmarSms() {
    if (!aguardandoSms) return;
    setOcupado('sms');
    const { error } = await supabase.auth.verifyOtp({ phone: aguardandoSms, token: codigoSms.trim(), type: 'phone_change' });
    setOcupado(null);
    if (error) return Alert.alert('Código inválido', mensagemErro(error));
    setAguardandoSms(null);
    setCodigoSms('');
    setTelefone('');
    await supabase.auth.refreshSession();
    Alert.alert('Telefone verificado', 'Agora convites enviados para este número aparecerão automaticamente para você.');
  }

  function pararTudo() {
    Alert.alert(
      'Parar todo compartilhamento?',
      'Todos os seus aparelhos deixarão de enviar a localização. Os acessos concedidos continuam salvos e você pode reativar depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Parar agora',
          style: 'destructive',
          onPress: async () => {
            await pararCompartilhamento();
            const { error } = await supabase
              .from('dispositivos')
              .update({ compartilhando: false })
              .eq('dono_id', sessao!.user.id);
            if (error) Alert.alert('Erro', mensagemErro(error));
            await recarregarAparelho();
          },
        },
      ],
    );
  }

  function excluirConta() {
    Alert.alert(
      'Excluir conta?',
      'Sua conta, aparelhos, histórico de localização, convites, alertas e acessos serão apagados definitivamente. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir definitivamente',
          style: 'destructive',
          onPress: async () => {
            await pararCompartilhamento();
            const { error } = await supabase.rpc('excluir_minha_conta');
            if (error) return Alert.alert('Erro', mensagemErro(error));
            await sair();
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <BannerCompartilhamento />
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <TituloSecao>Perfil</TituloSecao>
        <Cartao>
          <Campo
            rotulo="Seu nome"
            value={nome}
            onChangeText={setNome}
            maxLength={80}
            ajuda="É assim que as pessoas autorizadas veem você."
          />
          <Botao
            titulo="Salvar nome"
            variante="secundario"
            onPress={salvarNome}
            carregando={ocupado === 'nome'}
            desabilitado={nome.trim() === perfil?.nome}
          />
          <Text style={estilos.ajuda}>E-mail: {sessao?.user.email}</Text>
        </Cartao>

        <TituloSecao>Telefone</TituloSecao>
        <Cartao>
          {telefoneVerificado ? (
            <Paragrafo>Verificado: {telefoneVerificado}</Paragrafo>
          ) : (
            <Paragrafo suave>
              Opcional. Com o telefone verificado, os pedidos enviados para o seu número aparecem automaticamente na aba Convites.
              Sem ele, você ainda pode aceitar convites pelo código.
            </Paragrafo>
          )}
          {aguardandoSms ? (
            <>
              <Campo
                rotulo={`Código enviado para ${aguardandoSms}`}
                value={codigoSms}
                onChangeText={setCodigoSms}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Botao titulo="Confirmar código" onPress={confirmarSms} carregando={ocupado === 'sms'} />
              <Botao titulo="Cancelar" variante="texto" onPress={() => setAguardandoSms(null)} />
            </>
          ) : (
            <>
              <Campo
                rotulo={telefoneVerificado ? 'Trocar número' : 'Seu celular'}
                value={telefone}
                onChangeText={(t) => setTelefone(mascaraTelefone(t))}
                keyboardType="phone-pad"
                placeholder="(11) 91234-5678"
              />
              <Botao titulo="Enviar código por SMS" variante="secundario" onPress={enviarSms} carregando={ocupado === 'sms'} />
            </>
          )}
        </Cartao>

        <TituloSecao>Permissões</TituloSecao>
        <Cartao>
          {permissoes && (
            <>
              <Linha rotulo="Serviços de localização" valor={permissoes.servicosAtivos ? 'Ligados' : 'Desligados'} />
              <Linha rotulo="Localização durante o uso" valor={rotuloPermissao[permissoes.primeiroPlano]} />
              <Linha rotulo="Localização em segundo plano" valor={rotuloPermissao[permissoes.segundoPlano]} />
              <Linha rotulo="Precisão" valor={permissoes.precisa ? 'Exata' : 'Aproximada'} />
            </>
          )}
          <LinhaOpcao titulo="Notificações de alertas" valor={push} onChange={(v) => void alternarPush(v)} />
          <Botao
            titulo="Abrir ajustes do sistema"
            variante="secundario"
            icone="open-outline"
            onPress={() => void Linking.openSettings()}
          />
        </Cartao>

        <TituloSecao>Privacidade</TituloSecao>
        <Cartao>
          <Text style={estilos.rotulo}>Guardar histórico de localização por</Text>
          <View style={[estilos.linha, { flexWrap: 'wrap', gap: espaco.sm, marginBottom: espaco.sm }]}>
            {PRAZOS.map((d) => {
              const ativo = perfil?.retencao_dias === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => void alterarPrazo(d)}
                  style={{
                    borderWidth: 1,
                    borderColor: ativo ? cores.azulEscuro : cores.borda,
                    backgroundColor: ativo ? cores.azulEscuro : cores.branco,
                    borderRadius: raio.pill,
                    paddingHorizontal: espaco.md,
                    paddingVertical: espaco.sm,
                  }}
                >
                  <Text style={{ color: ativo ? cores.branco : cores.texto, fontWeight: '600' }}>
                    {d === 365 ? '1 ano' : `${d} dias`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[estilos.ajuda, { marginBottom: espaco.md }]}>
            Registros mais antigos são apagados automaticamente todos os dias.
          </Text>
          <Botao titulo="Parar todo compartilhamento" variante="perigo" icone="stop-circle-outline" onPress={pararTudo} />
          <Botao titulo="Meus registros de consentimento" variante="secundario" onPress={() => router.push('/registros')} />
          <Botao titulo="Política de privacidade" variante="texto" onPress={() => router.push('/privacidade')} />
        </Cartao>

        <TituloSecao>Conta</TituloSecao>
        <Cartao>
          <Botao titulo="Sair" variante="secundario" icone="log-out-outline" onPress={() => void sair()} />
          <Botao titulo="Excluir minha conta e dados" variante="texto" onPress={excluirConta} />
        </Cartao>
        <Text style={[estilos.ajuda, { textAlign: 'center' }]}>Localiza GPS · versão {Constants.expoConfig?.version}</Text>
      </ScrollView>
    </View>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={[estilos.linha, { justifyContent: 'space-between', paddingVertical: 6 }]}>
      <Text style={{ color: cores.texto }}>{rotulo}</Text>
      <Text style={{ color: cores.textoSuave, fontWeight: '600' }}>{valor}</Text>
    </View>
  );
}
