-- Agendamentos com pg_cron (Dashboard → Database → Extensions → pg_cron).
create extension if not exists pg_cron;

-- A cada 5 minutos: alerta de localização desatualizada (> 30 min).
select cron.schedule(
  'localiza-verificar-inativos',
  '*/5 * * * *',
  $$select public.verificar_dispositivos_inativos(interval '30 minutes')$$
);

-- Diariamente às 03:17 (UTC): aplica a política de retenção.
select cron.schedule(
  'localiza-retencao',
  '17 3 * * *',
  $$select public.aplicar_retencao()$$
);
