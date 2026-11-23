import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSessao } from '@/contexto/Sessao';
import { cores, espaco } from '@/lib/tema';

/**
 * Faixa sempre visível enquanto ESTE aparelho compartilha a localização.
 * Requisito de transparência: o titular nunca deve ter dúvida se está
 * compartilhando.
 */
export function BannerCompartilhamento() {
  const { esteAparelho } = useSessao();
  if (!esteAparelho?.compartilhando) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Compartilhamento de localização ativo. Toque para gerenciar."
      onPress={() => router.navigate('/aparelhos')}
      style={estilos.banner}
    >
      <View style={estilos.pulso}>
        <Ionicons name="radio-outline" size={16} color={cores.azulEscuro} />
      </View>
      <Text style={estilos.texto} numberOfLines={1}>
        Compartilhando a localização de “{esteAparelho.nome}”
      </Text>
      <Text style={estilos.acao}>Gerenciar</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.verde,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.sm,
  },
  pulso: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF88',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: espaco.sm,
  },
  texto: { flex: 1, color: cores.azulEscuro, fontWeight: '600', fontSize: 14 },
  acao: { color: cores.azulEscuro, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
});
