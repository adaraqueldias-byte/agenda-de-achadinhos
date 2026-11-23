-- Testes de segurança (RLS e fluxo de consentimento). Saída esperada: "OK: ..."
\set ON_ERROR_STOP on
set client_min_messages = notice;

insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com',  '5511900000001', now(), '{"nome":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@exemplo.com', '5511900000002', now(), '{"nome":"Bruno"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carla@exemplo.com', null, null, '{"nome":"Carla"}');

create or replace function pg_temp.como(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
end $$;

-- Bruno (B) cadastra o aparelho e ativa o compartilhamento
set role authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
insert into dispositivos (id, dono_id, nome, plataforma, compartilhando)
values ('d0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Celular do Bruno', 'android', true);
-- ponto ANTERIOR a qualquer consentimento
insert into localizacoes (dispositivo_id, lat, lng, registrado_em)
values ('d0000000-0000-0000-0000-00000000000b', -23.55, -46.63, now() - interval '1 hour');

-- Ana (A) não vê nada antes do consentimento
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from localizacoes) <> 0 then raise exception 'FALHA: A viu localização sem consentimento'; end if;
  if (select count(*) from dispositivos) <> 0 then raise exception 'FALHA: A viu aparelho alheio'; end if;
  if (select count(*) from aparelhos_que_acompanho()) <> 0 then raise exception 'FALHA: A acompanha sem consentimento'; end if;
  raise notice 'OK: sem consentimento, nenhum acesso';
end $$;

-- A não consegue inserir localização em aparelho alheio
do $$ begin
  begin
    insert into localizacoes (dispositivo_id, lat, lng, registrado_em)
    values ('d0000000-0000-0000-0000-00000000000b', 0, 0, now());
    raise exception 'FALHA: inseriu localização alheia';
  exception when insufficient_privilege then raise notice 'OK: inserção alheia bloqueada';
  end;
end $$;

-- A não consegue criar compartilhamento diretamente
do $$ begin
  begin
    insert into compartilhamentos (dispositivo_id, observador_id)
    values ('d0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
    raise exception 'FALHA: criou compartilhamento sem consentimento';
  exception when insufficient_privilege then raise notice 'OK: autoaprovação bloqueada';
  end;
end $$;

-- A não lê push_token de ninguém
do $$ begin
  begin
    perform push_token from perfis;
    raise exception 'FALHA: leu push_token';
  exception when insufficient_privilege then raise notice 'OK: push_token protegido';
  end;
end $$;

-- A envia convite pelo telefone de B
select id as convite_id from criar_convite('(11) 90000-0002', 'Oi, é a Ana') \gset

-- Carla (sem telefone verificado) não vê o convite nem consegue aceitá-lo
select pg_temp.como('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from convites_recebidos()) <> 0 then raise exception 'FALHA: C viu convite de outro número'; end if;
  raise notice 'OK: convite invisível para terceiros';
end $$;
do $$ begin
  begin
    perform responder_convite((select id from convites limit 1), true, '{}');
    raise exception 'FALHA: C respondeu convite alheio';
  exception when others then
    if sqlerrm like 'FALHA%' then raise; end if;
    raise notice 'OK: terceiro não responde convite';
  end;
end $$;

-- B vê o convite pelo telefone verificado e aceita compartilhando o aparelho
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from convites_recebidos()) <> 1 then raise exception 'FALHA: B não viu o convite'; end if;
  raise notice 'OK: convite recebido pelo telefone verificado';
end $$;
select responder_convite(:'convite_id', true, array['d0000000-0000-0000-0000-00000000000b']::uuid[]);
insert into localizacoes (dispositivo_id, lat, lng, registrado_em)
values ('d0000000-0000-0000-0000-00000000000b', -23.56, -46.64, now());

-- A agora vê apenas o ponto posterior ao consentimento
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from localizacoes) <> 1 then raise exception 'FALHA: A deveria ver exatamente 1 ponto, viu %', (select count(*) from localizacoes); end if;
  if (select ultima_lat from aparelhos_que_acompanho()) <> -23.56 then raise exception 'FALHA: último ponto incorreto'; end if;
  raise notice 'OK: observador vê só pontos após o consentimento';
end $$;

-- A cria cerca em volta do ponto atual; B sai da área -> alerta de saída
insert into cercas (criador_id, dispositivo_id, nome, lat, lng, raio_m)
values ('00000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000b', 'Casa', -23.56, -46.64, 200);
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
insert into localizacoes (dispositivo_id, lat, lng, registrado_em)
values ('d0000000-0000-0000-0000-00000000000b', -23.5601, -46.6401, now() + interval '1 second'); -- dentro (estado inicial)
insert into localizacoes (dispositivo_id, lat, lng, registrado_em)
values ('d0000000-0000-0000-0000-00000000000b', -23.60, -46.70, now() + interval '2 seconds');   -- fora
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if not exists (select 1 from alertas where tipo = 'saida_cerca') then raise exception 'FALHA: sem alerta de saída'; end if;
  raise notice 'OK: alerta de saída de cerca gerado';
end $$;

-- B pausa o compartilhamento -> A é avisada; B não pode mais enviar pontos
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
update dispositivos set compartilhando = false where id = 'd0000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    insert into localizacoes (dispositivo_id, lat, lng, registrado_em)
    values ('d0000000-0000-0000-0000-00000000000b', 0, 0, now());
    raise exception 'FALHA: envio com compartilhamento pausado';
  exception when insufficient_privilege then raise notice 'OK: pausa bloqueia novos envios';
  end;
  begin
    update dispositivos set ultima_lat = 0 where id = 'd0000000-0000-0000-0000-00000000000b';
    raise exception 'FALHA: cliente alterou ultima_lat';
  exception when insufficient_privilege then raise notice 'OK: último ponto só via gatilho';
  end;
end $$;
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if not exists (select 1 from alertas where tipo = 'compartilhamento_parado') then raise exception 'FALHA: sem alerta de pausa'; end if;
  raise notice 'OK: observador avisado da pausa';
end $$;

-- B revoga o acesso -> A perde tudo imediatamente
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select revogar_compartilhamento((select compartilhamento_id from quem_me_ve() limit 1));
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from localizacoes) <> 0 then raise exception 'FALHA: A ainda vê pontos após revogação'; end if;
  if (select count(*) from aparelhos_que_acompanho()) <> 0 then raise exception 'FALHA: A ainda acompanha'; end if;
  raise notice 'OK: revogação remove o acesso';
end $$;

-- Convite por código: Carla resgata um novo convite de Ana
select codigo from criar_convite(null, null) \gset
select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select count(*) as resgatado from resgatar_convite(:'codigo');
do $$ begin
  if (select count(*) from convites_recebidos()) <> 1 then raise exception 'FALHA: código não vinculou convite'; end if;
  raise notice 'OK: convite por código';
end $$;

-- B apaga seu histórico
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
delete from localizacoes where dispositivo_id = 'd0000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from localizacoes) <> 0 then raise exception 'FALHA: histórico não apagado'; end if;
  raise notice 'OK: titular apaga o histórico';
end $$;

reset role;
-- Rotinas de servidor
select verificar_dispositivos_inativos() >= 0 as inativos_ok;
select aplicar_retencao();
\echo 'TODOS OS TESTES PASSARAM'
