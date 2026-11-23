# Localiza GPS

Aplicativo Android e iOS para **compartilhar a localização com consentimento expresso** entre
pessoas que se conhecem (família, amigos, equipes). Totalmente em português.

> Não existe modo oculto. A localização de um aparelho só fica visível depois que o **dono do
> aparelho** aceita o convite no próprio celular, e ele pode pausar ou revogar a qualquer momento.

## Funcionalidades (MVP)

| Área | O que faz |
|------|-----------|
| Conta | Cadastro e login por e-mail, recuperação de senha, aceite de termos (LGPD), exclusão de conta |
| Aparelhos | Cadastro de vários celulares, compartilhamento liga/desliga, remoção, "quem vê minha localização" |
| Convites | Pedido por telefone ou código, aceite com escolha dos aparelhos e confirmação explícita |
| Mapa | Últimas posições em tempo real, endereço aproximado, coordenadas, horário e situação (online/desatualizado/offline/pausado) |
| Histórico | Trajeto por dia no mapa, lista de pontos, exclusão por dia ou total |
| Alertas | Entrada e saída de áreas (cercas), compartilhamento pausado, localização desatualizada, convites; push opcional |
| Privacidade | Faixa e notificação visíveis enquanto compartilha, prazo de retenção configurável, registro de consentimentos |

## Arquitetura

```
App (Expo / React Native / TypeScript)
 ├─ expo-location + expo-task-manager → envia pontos (serviço visível em 1º plano no Android)
 ├─ react-native-maps                 → Google Maps (Android) / Apple Maps (iOS)
 ├─ expo-notifications                → token Expo Push
 └─ @supabase/supabase-js             → sessão cifrada (AES-256 + Keychain/Keystore)
        │ HTTPS/TLS
Supabase
 ├─ Auth (e-mail; telefone opcional por SMS)
 ├─ Postgres com RLS em todas as tabelas
 │    ├─ funções de convite/consentimento (SECURITY DEFINER, validam auth.uid())
 │    ├─ gatilho: último ponto + avaliação de cercas → alertas
 │    └─ pg_cron: aparelhos inativos (5 min) e retenção de dados (diária)
 ├─ Realtime (respeita RLS) → mapa e contador de alertas
 └─ Edge Function enviar-push ← Database Webhook (INSERT em alertas)
```

### Modelo de dados

`perfis` · `dispositivos` · `convites` · `compartilhamentos` (dispositivo → observador, com data do
consentimento) · `localizacoes` · `cercas` · `alertas` · `registro_consentimentos` (auditoria).
Veja `supabase/migrations/20261123000001_esquema_inicial.sql`.

### Garantias de segurança (verificadas por `npm run test:db`)

* O observador só lê pontos com `registrado_em >= consentido_em` e apenas enquanto o compartilhamento estiver ativo.
* Só o dono insere pontos, e apenas com `compartilhando = true`; o último ponto é mantido por gatilho, não pelo cliente.
* Compartilhamentos só nascem de `responder_convite`, chamada pelo próprio titular.
* O telefone apenas entrega o convite (comparado com o telefone **verificado** em `auth.users`); ele nunca dá acesso a localização.
* `push_token` não é legível por outros usuários; usuários anônimos não acessam nenhuma tabela.

## Como rodar

```bash
cd localiza-gps
npm install
cp .env.example .env            # preencha — veja docs/CONFIGURACAO.md
npx expo start
```

O Expo Go serve para testar telas, login, convites e mapa (iOS). Para localização em segundo plano,
Google Maps no Android e push, gere um *development build*: veja `docs/TESTES_E_PUBLICACAO.md`.

## Estrutura

```
src/app/            rotas (Expo Router)
  (abas)/           Mapa, Aparelhos, Convites, Alertas, Ajustes
  historico/[id]    histórico por dia
  cerca/nova        criar área de alerta
  convite/[codigo]  link localizagps://convite/CODIGO
  entrar, cadastro, recuperar-senha, termos, privacidade, registros
src/lib/            supabase, localização (tarefa em 2º plano + fila offline), notificações, formatação
src/components/     UI, faixa de compartilhamento ativo, tela de consentimento
supabase/           migrações SQL, Edge Function, testes de RLS
docs/               configuração de chaves, testes e publicação nas lojas
```

## Documentação

* [Configuração de chaves e serviços](docs/CONFIGURACAO.md)
* [Testes e publicação (Google Play / App Store)](docs/TESTES_E_PUBLICACAO.md)

## Próximos passos sugeridos

* Links universais (`https://seu-dominio/convite/CODIGO`) para o convite abrir direto do WhatsApp
* Titular iniciar o compartilhamento ("compartilhar minha localização com…"), além do pedido
* Compartilhamento temporário (por 1 h, até as 18 h etc.)
* Cercas avaliadas no aparelho (`startGeofencingAsync`) para alertas com menos consumo de bateria
* Painel web para observadores
