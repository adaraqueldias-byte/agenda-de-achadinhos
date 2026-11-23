import { ScrollView, Text } from 'react-native';

import { Cartao, estilos, Paragrafo } from '@/components/ui';
import { cores } from '@/lib/tema';

/** Exibida quando as chaves do Supabase não foram configuradas. */
export default function ConfiguracaoPendente() {
  return (
    <ScrollView
      style={[estilos.tela, { backgroundColor: cores.azulEscuro }]}
      contentContainerStyle={[estilos.conteudo, { paddingTop: 80 }]}
    >
      <Text style={{ color: cores.branco, fontSize: 26, fontWeight: '800', marginBottom: 16 }}>Configuração pendente</Text>
      <Cartao>
        <Paragrafo>
          O app ainda não está conectado ao Supabase. Crie o arquivo <Text style={{ fontWeight: '700' }}>.env</Text> na raiz do
          projeto (copie de .env.example) com:
        </Paragrafo>
        <Paragrafo>EXPO_PUBLIC_SUPABASE_URL{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY</Paragrafo>
        <Paragrafo suave>
          Depois reinicie o servidor com “npx expo start -c”. Instruções completas em docs/CONFIGURACAO.md.
        </Paragrafo>
      </Cartao>
    </ScrollView>
  );
}
