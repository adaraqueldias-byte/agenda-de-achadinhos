import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AceitarConvite } from '@/components/AceitarConvite';
import { Botao, Cartao, estilos, Paragrafo } from '@/components/ui';
import { mensagemErro, supabase } from '@/lib/supabase';
import type { ConviteRecebido } from '@/lib/tipos';

/** Abre convites recebidos pelo link localizagps://convite/CODIGO */
export default function AbrirConvite() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [convite, setConvite] = useState<ConviteRecebido | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) return;
    void supabase.rpc('resgatar_convite', { p_codigo: codigo }).then(({ data, error }) => {
      if (error) setErro(mensagemErro(error));
      else setConvite(((data ?? []) as ConviteRecebido[])[0] ?? null);
    });
  }, [codigo]);

  if (erro) {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
        <Cartao>
          <Paragrafo>{erro}</Paragrafo>
          <Botao titulo="Voltar" onPress={() => router.replace('/convites')} />
        </Cartao>
      </ScrollView>
    );
  }

  return (
    <View style={[estilos.tela, { justifyContent: 'center' }]}>
      {!convite && <ActivityIndicator />}
      <AceitarConvite convite={convite} onFechar={() => router.replace('/convites')} />
    </View>
  );
}
