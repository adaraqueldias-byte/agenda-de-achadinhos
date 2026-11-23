import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { cores, espaco, raio } from '@/lib/tema';
import type { Situacao } from '@/lib/formatar';

export type NomeIcone = ComponentProps<typeof Ionicons>['name'];

type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'texto';

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando,
  desabilitado,
  icone,
  estilo,
}: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBotao;
  carregando?: boolean;
  desabilitado?: boolean;
  icone?: NomeIcone;
  estilo?: StyleProp<ViewStyle>;
}) {
  const corTexto =
    variante === 'primario' || variante === 'perigo' ? cores.branco : variante === 'texto' ? cores.azulClaro : cores.azulEscuro;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desabilitado || carregando }}
      onPress={onPress}
      disabled={desabilitado || carregando}
      style={({ pressed }) => [
        estilos.botao,
        estilos[variante],
        (desabilitado || carregando) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <View style={estilos.linha}>
          {icone && <Ionicons name={icone} size={18} color={corTexto} style={{ marginRight: espaco.sm }} />}
          <Text style={[estilos.textoBotao, { color: corTexto }]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Campo({ rotulo, ajuda, ...props }: TextInputProps & { rotulo: string; ajuda?: string }) {
  return (
    <View style={{ marginBottom: espaco.lg }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput placeholderTextColor={cores.inativo} style={estilos.campo} {...props} />
      {ajuda && <Text style={estilos.ajuda}>{ajuda}</Text>}
    </View>
  );
}

export function Cartao({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.cartao, estilo]}>{children}</View>;
}

export function TituloSecao({ children }: { children: ReactNode }) {
  return <Text style={estilos.tituloSecao}>{children}</Text>;
}

export function Paragrafo({ children, suave }: { children: ReactNode; suave?: boolean }) {
  return <Text style={[estilos.paragrafo, suave && { color: cores.textoSuave }]}>{children}</Text>;
}

export function Vazio({ icone, titulo, texto }: { icone: NomeIcone; titulo: string; texto?: string }) {
  return (
    <View style={estilos.vazio}>
      <Ionicons name={icone} size={40} color={cores.inativo} />
      <Text style={estilos.vazioTitulo}>{titulo}</Text>
      {texto && <Text style={estilos.vazioTexto}>{texto}</Text>}
    </View>
  );
}

export function LinhaOpcao({
  titulo,
  descricao,
  valor,
  onChange,
  desabilitado,
}: {
  titulo: string;
  descricao?: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  desabilitado?: boolean;
}) {
  return (
    <View style={[estilos.linha, { paddingVertical: espaco.sm }]}>
      <View style={{ flex: 1, paddingRight: espaco.md }}>
        <Text style={estilos.itemTitulo}>{titulo}</Text>
        {descricao && <Text style={estilos.ajuda}>{descricao}</Text>}
      </View>
      <Switch
        value={valor}
        onValueChange={onChange}
        disabled={desabilitado}
        trackColor={{ true: cores.verde, false: cores.borda }}
        thumbColor={cores.branco}
      />
    </View>
  );
}

const corSituacao: Record<Situacao, string> = {
  online: cores.verde,
  desatualizado: cores.aviso,
  offline: cores.inativo,
  pausado: cores.inativo,
  'sem-dados': cores.inativo,
};

export function corDaSituacao(s: Situacao) {
  return corSituacao[s];
}

export function Selo({ texto, cor }: { texto: string; cor: string }) {
  return (
    <View style={[estilos.selo, { backgroundColor: cor + '22' }]}>
      <View style={[estilos.ponto, { backgroundColor: cor }]} />
      <Text style={[estilos.seloTexto, { color: cores.texto }]}>{texto}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center' },
  botao: {
    minHeight: 48,
    borderRadius: raio.md,
    paddingHorizontal: espaco.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: espaco.xs,
  },
  primario: { backgroundColor: cores.verdeEscuro },
  secundario: { backgroundColor: cores.branco, borderWidth: 1, borderColor: cores.borda },
  perigo: { backgroundColor: cores.perigo },
  texto: { backgroundColor: 'transparent' },
  textoBotao: { fontSize: 16, fontWeight: '600' },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.texto, marginBottom: espaco.xs },
  campo: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.md,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.md,
    fontSize: 16,
    backgroundColor: cores.branco,
    color: cores.texto,
  },
  ajuda: { fontSize: 13, color: cores.textoSuave, marginTop: espaco.xs },
  cartao: {
    backgroundColor: cores.branco,
    borderRadius: raio.lg,
    padding: espaco.lg,
    marginBottom: espaco.md,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  tituloSecao: {
    fontSize: 13,
    fontWeight: '700',
    color: cores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: espaco.lg,
    marginBottom: espaco.sm,
  },
  paragrafo: { fontSize: 15, lineHeight: 22, color: cores.texto, marginBottom: espaco.md },
  itemTitulo: { fontSize: 16, fontWeight: '600', color: cores.texto },
  vazio: { alignItems: 'center', padding: espaco.xl },
  vazioTitulo: { fontSize: 16, fontWeight: '600', color: cores.texto, marginTop: espaco.md, textAlign: 'center' },
  vazioTexto: { fontSize: 14, color: cores.textoSuave, marginTop: espaco.xs, textAlign: 'center' },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: espaco.sm,
    paddingVertical: 2,
    borderRadius: raio.pill,
  },
  ponto: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  seloTexto: { fontSize: 12, fontWeight: '600' },
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espaco.lg, paddingBottom: espaco.xxl },
});
