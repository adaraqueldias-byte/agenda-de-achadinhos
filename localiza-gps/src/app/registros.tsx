import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { estilos, Vazio } from '@/components/ui';
import { dataHora } from '@/lib/formatar';
import { supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';

type Registro = { id: number; acao: string; criado_em: string };

const rotulos: Record<string, string> = {
  termos_aceitos: 'Termos de uso e privacidade aceitos',
  convite_criado: 'Convite de localização enviado',
  convite_recusado: 'Convite recusado',
  consentimento_concedido: 'Acesso à localização autorizado',
  consentimento_revogado: 'Acesso à localização retirado',
  compartilhamento_ativado: 'Compartilhamento ativado',
  compartilhamento_pausado: 'Compartilhamento pausado',
};

/** Transparência (LGPD art. 9º): o titular consulta o histórico dos próprios consentimentos. */
export default function Registros() {
  const [itens, setItens] = useState<Registro[]>([]);
  useEffect(() => {
    void supabase
      .from('registro_consentimentos')
      .select('id, acao, criado_em')
      .order('criado_em', { ascending: false })
      .limit(200)
      .then(({ data }) => setItens((data ?? []) as Registro[]));
  }, []);
  return (
    <FlatList
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      data={itens}
      keyExtractor={(i) => String(i.id)}
      ListEmptyComponent={<Vazio icone="document-text-outline" titulo="Nenhum registro" />}
      renderItem={({ item }) => (
        <View style={{ paddingVertical: espaco.sm, borderBottomWidth: 1, borderBottomColor: cores.borda }}>
          <Text style={estilos.itemTitulo}>{rotulos[item.acao] ?? item.acao}</Text>
          <Text style={estilos.ajuda}>{dataHora(item.criado_em)}</Text>
        </View>
      )}
    />
  );
}
