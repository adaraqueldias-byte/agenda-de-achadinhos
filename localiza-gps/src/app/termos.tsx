import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Botao, Cartao, estilos, Paragrafo } from '@/components/ui';
import { useSessao } from '@/contexto/Sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';

const PONTOS: {
  icone: 'hand-left-outline' | 'eye-outline' | 'pause-circle-outline' | 'time-outline' | 'trash-outline';
  texto: string;
}[] = [
  {
    icone: 'hand-left-outline',
    texto: 'Sua localização só é compartilhada depois que VOCÊ aceitar um convite e escolher o aparelho.',
  },
  {
    icone: 'eye-outline',
    texto: 'Enquanto compartilha, o app mostra um aviso fixo na tela e uma notificação/indicador do sistema.',
  },
  {
    icone: 'pause-circle-outline',
    texto: 'Você pode pausar o compartilhamento ou retirar o acesso de qualquer pessoa a qualquer momento.',
  },
  { icone: 'time-outline', texto: 'O histórico é apagado automaticamente após o prazo que você escolher (padrão: 30 dias).' },
  { icone: 'trash-outline', texto: 'Você pode apagar seu histórico ou excluir sua conta e todos os dados quando quiser.' },
];

export default function Termos() {
  const { recarregarPerfil, sair } = useSessao();
  const [li, setLi] = useState(false);
  const [maior, setMaior] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function aceitar() {
    setCarregando(true);
    const { error } = await supabase.rpc('aceitar_termos');
    if (error) {
      setCarregando(false);
      return Alert.alert('Erro', mensagemErro(error));
    }
    await recarregarPerfil();
    setCarregando(false);
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Paragrafo>
        O Localiza GPS permite que pessoas vejam a localização umas das outras{' '}
        <Text style={{ fontWeight: '700' }}>somente com autorização expressa</Text> do dono de cada celular. Antes de continuar,
        confira como tratamos seus dados:
      </Paragrafo>

      <Cartao>
        {PONTOS.map((p) => (
          <View key={p.texto} style={[estilos.linha, { alignItems: 'flex-start', marginBottom: espaco.md }]}>
            <Ionicons name={p.icone} size={22} color={cores.verdeEscuro} style={{ marginRight: espaco.md, marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: cores.texto }}>{p.texto}</Text>
          </View>
        ))}
        <Botao titulo="Ler a política de privacidade completa" variante="texto" onPress={() => router.push('/privacidade')} />
      </Cartao>

      <Caixa marcado={li} onPress={() => setLi(!li)}>
        Li e concordo com a Política de Privacidade e com o tratamento dos meus dados de localização para as finalidades descritas
        (LGPD, art. 7º, I e art. 8º).
      </Caixa>
      <Caixa marcado={maior} onPress={() => setMaior(!maior)}>
        Tenho 18 anos ou mais, ou estou usando o app com autorização do meu responsável legal.
      </Caixa>

      <Botao titulo="Aceitar e continuar" onPress={aceitar} carregando={carregando} desabilitado={!li || !maior} />
      <Botao titulo="Não aceito — sair" variante="texto" onPress={sair} />
    </ScrollView>
  );
}

function Caixa({ marcado, onPress, children }: { marcado: boolean; onPress: () => void; children: string | string[] }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      onPress={onPress}
      style={[estilos.linha, { alignItems: 'flex-start', marginBottom: espaco.lg }]}
    >
      <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={24} color={marcado ? cores.verdeEscuro : cores.textoSuave} />
      <Text style={{ flex: 1, marginLeft: espaco.sm, fontSize: 14, lineHeight: 20, color: cores.texto }}>{children}</Text>
    </Pressable>
  );
}
