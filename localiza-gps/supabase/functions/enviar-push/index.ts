// Edge Function: envia notificação push (Expo Push Service) quando um alerta
// é criado. Acionada por um Database Webhook em INSERT na tabela "alertas".
//
// Variáveis (definidas automaticamente pelo Supabase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Variável que você define (supabase secrets set):
//   WEBHOOK_SECRET  — o mesmo valor configurado no cabeçalho do webhook.
//   EXPO_ACCESS_TOKEN (opcional) — se "Enhanced Push Security" estiver ativo.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Alerta = {
  id: number;
  destinatario_id: string;
  dispositivo_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
};

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const segredo = Deno.env.get('WEBHOOK_SECRET');
  if (!segredo || req.headers.get('x-webhook-secret') !== segredo) {
    return new Response('Não autorizado', { status: 401 });
  }

  const corpo = await req.json();
  if (corpo?.type !== 'INSERT' || corpo?.table !== 'alertas') {
    return new Response('Ignorado', { status: 200 });
  }
  const alerta = corpo.record as Alerta;

  const { data: perfil, error } = await supabase.from('perfis').select('push_token').eq('id', alerta.destinatario_id).single();

  if (error || !perfil?.push_token) {
    return new Response('Sem token de push', { status: 200 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const tokenExpo = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (tokenExpo) headers.Authorization = `Bearer ${tokenExpo}`;

  const resposta = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: perfil.push_token,
      title: alerta.titulo,
      body: alerta.mensagem,
      sound: 'default',
      channelId: 'alertas',
      data: { alertaId: alerta.id, tipo: alerta.tipo, dispositivoId: alerta.dispositivo_id },
    }),
  });

  const resultado = await resposta.json();

  // Token inválido (app desinstalado etc.): remove para não tentar de novo.
  if (resultado?.data?.details?.error === 'DeviceNotRegistered') {
    await supabase.from('perfis').update({ push_token: null }).eq('id', alerta.destinatario_id);
  }

  return new Response(JSON.stringify(resultado), {
    status: resposta.ok ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
});
