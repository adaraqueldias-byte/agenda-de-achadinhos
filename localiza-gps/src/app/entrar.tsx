import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao, Campo, Cartao, estilos as ui } from '@/components/ui';
import { mensagemErro, supabase } from '@/lib/supabase';
import { cores, espaco } from '@/lib/tema';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!email.trim() || !senha) return Alert.alert('Preencha e-mail e senha.');
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) Alert.alert('Não foi possível entrar', mensagemErro(error));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.azulEscuro }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.marca}>
          <View style={estilos.logo}>
            <Ionicons name="location" size={44} color={cores.azulEscuro} />
          </View>
          <Text style={estilos.titulo}>Localiza GPS</Text>
          <Text style={estilos.subtitulo}>Localização compartilhada com quem você confia — sempre com consentimento.</Text>
        </View>

        <Cartao>
          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="voce@exemplo.com"
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="Sua senha"
            onSubmitEditing={entrar}
          />
          <Botao titulo="Entrar" onPress={entrar} carregando={carregando} />
          <Botao titulo="Esqueci minha senha" variante="texto" onPress={() => router.push('/recuperar-senha')} />
        </Cartao>

        <View style={[ui.linha, { justifyContent: 'center', marginTop: espaco.md }]}>
          <Text style={{ color: cores.branco }}>Ainda não tem conta? </Text>
          <Link href="/cadastro" style={{ color: cores.verde, fontWeight: '700' }}>
            Criar conta
          </Link>
        </View>
        <Link href="/privacidade" style={estilos.politica}>
          Política de privacidade
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: espaco.xl },
  marca: { alignItems: 'center', marginBottom: espaco.xl },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: cores.verde,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espaco.md,
  },
  titulo: { color: cores.branco, fontSize: 30, fontWeight: '800' },
  subtitulo: { color: '#C9D6E8', fontSize: 15, textAlign: 'center', marginTop: espaco.sm, lineHeight: 21 },
  politica: { color: '#C9D6E8', textAlign: 'center', marginTop: espaco.lg, textDecorationLine: 'underline' },
});
