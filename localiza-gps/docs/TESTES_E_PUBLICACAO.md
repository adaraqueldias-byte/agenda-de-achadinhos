# Testes e publicação

## 1. Testes automatizados

```bash
npm run typecheck      # TypeScript
npm run test:db        # políticas de segurança (RLS) e fluxo de consentimento
```

`test:db` sobe um PostgreSQL local descartável (precisa do PostgreSQL 14+ instalado; sem Docker),
aplica a migração e verifica 15 cenários, entre eles:

* sem consentimento, ninguém vê aparelhos nem localizações de outra pessoa;
* ninguém consegue criar um compartilhamento para si mesmo nem enviar pontos para aparelho alheio;
* um convite enviado para um número não aparece para outra pessoa;
* o observador só vê pontos registrados **depois** do aceite;
* pausar bloqueia novos envios e avisa os observadores;
* revogar remove o acesso na hora;
* cercas geram alerta de saída; o titular consegue apagar o histórico.

Rode-o sempre que alterar o SQL. Em Linux como root, rode como usuário `postgres`.

## 2. Teste manual (dois aparelhos reais)

O compartilhamento em segundo plano, o mapa Google no Android e o push **não funcionam no Expo Go**.
Use um *development build*:

```bash
npx eas-cli build --profile development --platform android   # ou ios
npx expo start --dev-client
```

(Os perfis `development`, `preview` e `production` já estão em `eas.json`.)

Roteiro com duas contas (A observa, B compartilha):

1. **Cadastro/login** — crie as contas A e B, confirme os e-mails e aceite os termos.
2. **B** → Aparelhos → *Cadastrar este celular* → ative *Compartilhar*. Confirme:
   explicação antes do pedido do sistema; faixa verde no topo; notificação fixa (Android) ou
   indicador azul (iOS).
3. **A** → Convites → crie um convite (com ou sem telefone) → envie o código para B.
4. **B** → Convites → digite o código → escolha o aparelho → marque a confirmação → *Autorizar*.
5. **A** → Mapa: o aparelho de B aparece com endereço aproximado, coordenadas e horário. Ande
   alguns quarteirões com B e confira a atualização (cerca de 1 ponto/min ou a cada 30 m).
6. **A** → no mapa, *Criar alerta* em volta do local atual de B (raio de 200 m). B se afasta, e A
   recebe *Saída de…*.
7. **B** pausa → A recebe *Compartilhamento pausado*. **B** desliga a internet por 30 min com o
   compartilhamento ativo → A recebe *Localização desatualizada*.
8. **B** → Aparelhos → *Quem vê minha localização* → *Retirar*: A deixa de ver o aparelho imediatamente.
9. **Histórico** — consulte dias anteriores; como B, apague um dia e depois todo o histórico.
10. **Exclusão de conta** — em B, *Excluir minha conta*; confira no Supabase que os dados sumiram.

Teste também: permissão negada, permissão só "durante o uso", localização aproximada (iOS),
modo avião (a fila offline deve enviar os pontos ao voltar), reinício do aparelho com o compartilhamento ativo.

## 3. Builds de produção

```bash
npx eas-cli build --profile production --platform android   # gera .aab
npx eas-cli build --profile production --platform ios       # gera .ipa
```

Antes, preencha os dados reais do controlador e do encarregado em `src/app/privacidade.tsx` e publique
a mesma política em uma URL pública (as duas lojas exigem).

## 4. Google Play

1. Crie o app no Play Console (conta de desenvolvedor: taxa única de US$ 25).
2. **Teste fechado obrigatório** para contas pessoais novas: 12 testadores por 14 dias antes da produção.
3. **Declaração de localização em segundo plano** (*Conteúdo do app → Permissões de localização*).
   A Google revisa manualmente. Informe:
   * Finalidade: compartilhar a localização com contatos que o titular autorizou explicitamente.
   * A funcionalidade é iniciada pelo usuário, visível o tempo todo (notificação persistente) e
     pode ser desligada no app.
   * Envie um **vídeo** (≤ 30 s, link do YouTube) mostrando: o aviso explicativo, o pedido de
     permissão, a notificação persistente e onde desligar.
4. **Segurança dos dados**: declare *Localização aproximada e exata* (coletada, compartilhada com
   outros usuários por escolha do usuário, criptografada em trânsito, exclusão disponível), além de
   *Nome*, *E-mail*, *Telefone* (opcional) e *IDs do dispositivo* (token de push).
5. **Serviço em primeiro plano**: declare o tipo `location` com a mesma justificativa e o mesmo vídeo.
6. Política de **Stalkerware**: o app cumpre os requisitos (sem ícone oculto, notificação persistente,
   consentimento do titular). Não altere esses comportamentos, ou o app será removido.
7. Classificação de conteúdo, público-alvo (recomendado: 18+) e envio: `npx eas-cli submit -p android`.

## 5. App Store

1. Conta Apple Developer (US$ 99/ano). Crie o app no App Store Connect com o bundle `br.com.localizagps.app`.
2. **Privacidade do app** (*App Privacy*): *Localização exata* e *Informações de contato* (nome,
   e-mail, telefone), vinculadas ao usuário, sem rastreamento (*tracking*: **não**). Isso dispensa o
   pedido de ATT.
3. **Notas para a revisão**: crie duas contas de teste já vinculadas e informe as credenciais. Explique
   que a localização em segundo plano serve para compartilhar com contatos autorizados e que o usuário
   controla a função (diretriz 5.1.1 e 2.5.4).
4. O app oferece **exclusão de conta** dentro do app (diretriz 5.1.1(v)), já implementada em Ajustes.
5. Textos de permissão já estão em português no `app.config.ts`.
6. Envio: `npx eas-cli submit -p ios`, depois TestFlight e envio para revisão.

## 6. Checklist LGPD antes do lançamento

- [ ] Dados reais do controlador e do encarregado (DPO) na política
- [ ] Política publicada em URL pública e linkada nas lojas
- [ ] Projeto Supabase em região brasileira ou cláusulas de transferência internacional (art. 33)
- [ ] Contratos com operadores (Supabase, Expo, Google/Apple)
- [ ] Relatório de Impacto (RIPD) — recomendado por se tratar de geolocalização contínua
- [ ] Canal para requisições de titulares
- [ ] Plano de resposta a incidentes (comunicação à ANPD)
