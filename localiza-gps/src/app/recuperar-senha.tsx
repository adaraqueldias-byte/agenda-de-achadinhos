import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { Botao, Campo, Cartao, estilos, Paragrafo } from '@/components/ui';
import { mensagemErro, supabase } from '@/lib/supabase';

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    if (!email.trim()) return Alert.alert('Informe seu e-mail.');
    setCarregando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setCarregando(false);
    if (error) return Alert.alert('Erro', mensagemErro(error));
    Alert.alert('Verifique seu e-mail', 'Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.');
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Cartao>
        <Paragrafo>Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</Paragrafo>
        <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Botao titulo="Enviar link" onPress={enviar} carregando={carregando} />
      </Cartao>
    </ScrollView>
  );
}
