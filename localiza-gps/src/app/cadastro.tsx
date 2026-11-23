import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { Botao, Campo, Cartao, estilos, Paragrafo } from '@/components/ui';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores } from '@/lib/tema';

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function cadastrar() {
    if (nome.trim().length < 2) return Alert.alert('Informe seu nome.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('Informe um e-mail válido.');
    if (senha.length < 8) return Alert.alert('A senha deve ter pelo menos 8 caracteres.');
    if (senha !== confirmacao) return Alert.alert('As senhas não conferem.');

    setCarregando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    setCarregando(false);
    if (error) return Alert.alert('Não foi possível criar a conta', mensagemErro(error));
    // Se a confirmação de e-mail estiver ativa, não há sessão ainda.
    if (!data.session) setEnviado(true);
  }

  if (enviado) {
    return (
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
        <Cartao>
          <Text style={[estilos.itemTitulo, { fontSize: 20, marginBottom: 8 }]}>Confirme seu e-mail</Text>
          <Paragrafo>Enviamos um link de confirmação para {email.trim()}. Abra o link e depois volte aqui para entrar.</Paragrafo>
          <Botao titulo="Ir para o login" onPress={() => router.replace('/entrar')} />
        </Cartao>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Cartao>
          <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" placeholder="Como as pessoas vão te ver" />
          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete="new-password"
            ajuda="Mínimo de 8 caracteres."
          />
          <Campo
            rotulo="Confirmar senha"
            value={confirmacao}
            onChangeText={setConfirmacao}
            secureTextEntry
            autoComplete="new-password"
          />
          <Botao titulo="Criar conta" onPress={cadastrar} carregando={carregando} />
        </Cartao>
        <Paragrafo suave>
          Ao criar a conta você poderá ler e aceitar os termos de uso de localização antes de usar o app. Nenhuma localização é
          compartilhada sem sua autorização.{' '}
          <Link href="/privacidade" style={{ color: cores.azulClaro, textDecorationLine: 'underline' }}>
            Política de privacidade
          </Link>
        </Paragrafo>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
