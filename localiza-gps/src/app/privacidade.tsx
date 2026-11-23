import { ScrollView, Text } from 'react-native';

import { estilos, Paragrafo } from '@/components/ui';
import { cores } from '@/lib/tema';

// MODELO — revise com sua assessoria jurídica e preencha os dados do
// controlador antes de publicar. Publique também em uma URL pública (exigência
// da Google Play e da App Store).
const SECOES: [string, string][] = [
  [
    '1. Quem somos',
    '[RAZÃO SOCIAL], inscrita no CNPJ [NÚMERO], com sede em [ENDEREÇO], é a controladora dos dados tratados pelo Localiza GPS. Encarregado (DPO): [NOME] — [E-MAIL DO ENCARREGADO].',
  ],
  [
    '2. Dados que coletamos',
    'Cadastro: nome, e-mail e, opcionalmente, telefone verificado. Localização: latitude, longitude, precisão, velocidade e horário, somente dos aparelhos em que você ativar o compartilhamento. Técnicos: token de notificação e plataforma do aparelho.',
  ],
  [
    '3. Finalidade e base legal',
    'Exibir a sua localização às pessoas que você autorizou, manter o histórico de trajetos e gerar alertas que você ou elas configurarem. Base legal: consentimento (LGPD, art. 7º, I), que pode ser revogado a qualquer momento.',
  ],
  [
    '4. Com quem compartilhamos',
    'Somente com os usuários que você aprovou, aparelho por aparelho, e apenas a partir do momento do aceite. Operadores: Supabase (hospedagem e banco de dados), Expo (envio de notificações) e Google/Apple (mapas e geocodificação). Não vendemos dados.',
  ],
  [
    '5. Transparência',
    'Enquanto o compartilhamento estiver ativo, o app exibe um aviso fixo; no Android há uma notificação permanente e no iOS o indicador de localização do sistema. Não existe modo oculto.',
  ],
  [
    '6. Retenção',
    'Pontos de localização são excluídos automaticamente após o prazo que você escolher (7 a 365 dias; padrão 30). Alertas: 90 dias. Convites encerrados: 30 dias. Registros de consentimento: 5 anos, para cumprimento de obrigação legal.',
  ],
  [
    '7. Seus direitos',
    'Você pode, pelo próprio app: consultar quem vê sua localização, pausar ou revogar acessos, apagar o histórico, alterar o prazo de retenção, consultar seus registros de consentimento e excluir a conta. Outros pedidos (LGPD, art. 18): [E-MAIL DO ENCARREGADO].',
  ],
  [
    '8. Segurança',
    'Conexões criptografadas (HTTPS/TLS), sessão armazenada cifrada no aparelho (Keychain/Keystore), banco de dados com regras de acesso por linha (RLS) que impedem a leitura de aparelhos não autorizados, e criptografia em repouso no provedor.',
  ],
  [
    '9. Crianças e adolescentes',
    'O uso por menores de 18 anos deve ocorrer com autorização e acompanhamento do responsável legal, no melhor interesse da criança ou adolescente (LGPD, art. 14).',
  ],
  ['10. Alterações', 'Avisaremos no app sobre mudanças relevantes nesta política. Versão 1.0.'],
];

export default function Privacidade() {
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      {SECOES.map(([titulo, texto]) => (
        <Text key={titulo}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: cores.texto }}>
            {titulo}
            {'\n'}
          </Text>
          <Paragrafo>{texto}</Paragrafo>
        </Text>
      ))}
    </ScrollView>
  );
}
