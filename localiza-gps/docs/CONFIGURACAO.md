# Configuração — chaves de API e serviços externos

O app **não funciona sem estas configurações**. Nenhuma chave real está no
repositório. Siga na ordem.

| # | Serviço | Obrigatório? | Para quê |
|---|---------|--------------|----------|
| 1 | Supabase | Sim | Login, banco de dados, regras de acesso, tempo real |
| 2 | Google Maps (Android) | Sim, para Android | Exibir o mapa no Android |
| 3 | Expo / EAS | Sim, para builds e push | Gerar os apps e enviar notificações |
| 4 | Provedor de SMS (Twilio etc.) | Opcional | Verificar o telefone do usuário |
| 5 | Webhook + Edge Function | Opcional, recomendado | Notificações push dos alertas |

---

## 1. Supabase

1. Crie um projeto em <https://supabase.com/dashboard> (região sugerida: **São Paulo — sa-east-1**,
   que mantém os dados no Brasil).
2. **Banco de dados** — no painel, abra **SQL Editor** e execute, nesta ordem, o conteúdo de:
   1. `supabase/migrations/20261123000001_esquema_inicial.sql`
   2. `supabase/migrations/20261123000002_rotinas_agendadas.sql`
      (antes, ative a extensão **pg_cron** em *Database → Extensions*).

   Alternativa pela CLI: `npx supabase login`, `npx supabase init`,
   `npx supabase link --project-ref SEU_REF` e `npx supabase db push`.
3. **Chaves** — em *Project Settings → API* copie a **Project URL** e a chave **anon public**.
   Crie o arquivo `.env` na raiz do projeto (copie de `.env.example`):

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   A chave *anon* é pública por design: a segurança vem das políticas RLS do banco.
   **Nunca** coloque a chave `service_role` no app.
4. **Autenticação** — em *Authentication → Providers → Email*: mantenha ativo e deixe
   **Confirm email** ligado. Em *Authentication → Email Templates* traduza os e-mails
   para português. Em produção, configure um SMTP próprio (*Authentication → SMTP Settings*);
   o SMTP padrão do Supabase tem limite baixo de envios.
5. **Realtime** — já habilitado pela migração para as tabelas `localizacoes` e `alertas`.
   Confira em *Database → Publications → supabase_realtime*.

## 2. Google Maps (Android)

No iOS o app usa o Apple Maps, que não precisa de chave.

1. Em <https://console.cloud.google.com> crie um projeto e ative a cobrança (há cota gratuita mensal).
2. Em *APIs e serviços → Biblioteca*, ative **Maps SDK for Android**.
3. Em *Credenciais → Criar credenciais → Chave de API*. Restrinja a chave:
   * **Restrição de aplicativo**: *Apps Android*. Adicione o pacote `br.com.localizagps.app` e a
     impressão digital SHA-1 do certificado. Use as duas SHA-1: a do EAS (`npx eas-cli credentials`)
     e a da **Google Play App Signing** (*Play Console → Configuração → Integridade do app*).
   * **Restrição de API**: somente *Maps SDK for Android*.
4. Coloque a chave em `.env` como `GOOGLE_MAPS_ANDROID_API_KEY`. Para builds na nuvem, cadastre a
   mesma variável em *expo.dev → projeto → Environment variables*.

A chave entra no app em tempo de build (é um plugin nativo), então é preciso **gerar um novo build** depois de alterá-la.

## 3. Expo / EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # cria o projeto e mostra o Project ID
```

Copie o **Project ID** para `EAS_PROJECT_ID` no `.env` e nas *Environment variables* do EAS.
Ele é necessário para gerar o token de push.

**Push no Android** exige credenciais FCM v1: crie um projeto no Firebase, gere uma chave de conta
de serviço (*Configurações do projeto → Contas de serviço*) e envie-a com
`npx eas-cli credentials` → Android → *Google Service Account Key for Push Notifications (FCM V1)*.
Também é preciso adicionar o `google-services.json` do Firebase (`android.googleServicesFile` no `app.config.ts`).

**Push no iOS**: o `eas build` cria a chave APNs automaticamente (requer conta Apple Developer paga).

## 4. Verificação de telefone por SMS (opcional)

Sem SMS, os convites funcionam pelo **código** (enviado por WhatsApp, SMS etc.). Com SMS, o pedido
aparece automaticamente para quem verificou o número.

1. Crie uma conta no Twilio (ou MessageBird, Vonage, TextLocal).
2. Supabase → *Authentication → Providers → Phone*: ative e preencha Account SID, Auth Token e
   Message Service SID.
3. Em *Authentication → Settings*, ative **Secure phone change**, se disponível.

O app nunca usa o número para localizar ninguém: ele serve apenas para entregar o convite ao titular
certo, que precisa aceitar no próprio aparelho.

## 5. Notificações push dos alertas

Os alertas (cercas, compartilhamento pausado, localização desatualizada, convites) são gravados na
tabela `alertas` e aparecem no app em tempo real. Para também enviar **push**:

```bash
npx supabase functions deploy enviar-push --no-verify-jwt
npx supabase secrets set WEBHOOK_SECRET="$(openssl rand -hex 32)"
# Opcional: se ativar "Enhanced Push Security" no expo.dev
npx supabase secrets set EXPO_ACCESS_TOKEN=seu_token
```

No painel: *Database → Webhooks → Create a new hook*:

* Tabela: `alertas` · Evento: **Insert**
* Tipo: **Supabase Edge Functions** → `enviar-push` · Método POST
* Cabeçalho HTTP: `x-webhook-secret` = o mesmo valor de `WEBHOOK_SECRET`

## Resumo do `.env`

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
GOOGLE_MAPS_ANDROID_API_KEY=
GOOGLE_MAPS_IOS_API_KEY=        # opcional
EAS_PROJECT_ID=
```

Depois de alterar o `.env`, reinicie com `npx expo start -c`. Para variáveis usadas por plugins
nativos (Maps, Project ID), gere um novo build.
