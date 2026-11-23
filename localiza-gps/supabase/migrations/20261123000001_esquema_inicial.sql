-- =====================================================================
-- Localiza GPS — esquema inicial
-- Princípios:
--   * Nenhuma localização é visível sem consentimento explícito do dono.
--   * Toda tabela tem RLS habilitado; operações sensíveis passam por
--     funções SECURITY DEFINER que validam o usuário (auth.uid()).
--   * Observadores só veem localizações registradas APÓS o consentimento.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------

-- Mantém apenas dígitos e aplica DDI 55 para números brasileiros sem DDI.
create or replace function public.normalizar_telefone(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) in (10, 11)
      then '55' || regexp_replace(p, '\D', '', 'g')
    else regexp_replace(p, '\D', '', 'g')
  end
$$;

-- Distância em metros entre dois pontos (fórmula de Haversine).
create or replace function public.distancia_metros(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table public.perfis (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome             text not null check (char_length(nome) between 1 and 80),
  push_token       text,
  retencao_dias    integer not null default 30 check (retencao_dias between 1 and 365),
  termos_aceitos_em timestamptz,
  criado_em        timestamptz not null default now()
);

create table public.dispositivos (
  id                     uuid primary key default gen_random_uuid(),
  dono_id                uuid not null references auth.users (id) on delete cascade,
  nome                   text not null check (char_length(nome) between 1 and 60),
  plataforma             text not null check (plataforma in ('android', 'ios')),
  compartilhando         boolean not null default false,
  ultima_lat             double precision,
  ultima_lng             double precision,
  ultima_precisao        double precision,
  ultima_atualizacao     timestamptz,
  ultimo_alerta_inativo  timestamptz,
  criado_em              timestamptz not null default now()
);
create index on public.dispositivos (dono_id);

create table public.convites (
  id               uuid primary key default gen_random_uuid(),
  remetente_id     uuid not null references auth.users (id) on delete cascade,
  telefone_destino text check (telefone_destino ~ '^[0-9]{10,15}$'),
  codigo           text not null unique,
  mensagem         text check (char_length(mensagem) <= 200),
  destinatario_id  uuid references auth.users (id) on delete cascade,
  status           text not null default 'pendente'
                   check (status in ('pendente', 'aceito', 'recusado', 'cancelado')),
  criado_em        timestamptz not null default now(),
  expira_em        timestamptz not null default now() + interval '7 days',
  respondido_em    timestamptz
);
create index on public.convites (remetente_id);
create index on public.convites (telefone_destino) where status = 'pendente';

create table public.compartilhamentos (
  id             uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.dispositivos (id) on delete cascade,
  observador_id  uuid not null references auth.users (id) on delete cascade,
  convite_id     uuid references public.convites (id) on delete set null,
  ativo          boolean not null default true,
  consentido_em  timestamptz not null default now(),
  revogado_em    timestamptz
);
create unique index compartilhamento_ativo_unico
  on public.compartilhamentos (dispositivo_id, observador_id) where ativo;
create index on public.compartilhamentos (observador_id) where ativo;

create table public.localizacoes (
  id             bigint generated always as identity primary key,
  dispositivo_id uuid not null references public.dispositivos (id) on delete cascade,
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  precisao       double precision check (precisao >= 0),
  velocidade     double precision,
  registrado_em  timestamptz not null,
  recebido_em    timestamptz not null default now()
);
create index on public.localizacoes (dispositivo_id, registrado_em desc);

create table public.cercas (
  id              uuid primary key default gen_random_uuid(),
  criador_id      uuid not null references auth.users (id) on delete cascade,
  dispositivo_id  uuid not null references public.dispositivos (id) on delete cascade,
  nome            text not null check (char_length(nome) between 1 and 60),
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  raio_m          integer not null check (raio_m between 50 and 50000),
  alerta_entrada  boolean not null default true,
  alerta_saida    boolean not null default true,
  ativa           boolean not null default true,
  dentro          boolean,  -- estado da última avaliação (null = ainda não avaliado)
  criado_em       timestamptz not null default now()
);
create index on public.cercas (dispositivo_id) where ativa;

create table public.alertas (
  id              bigint generated always as identity primary key,
  destinatario_id uuid not null references auth.users (id) on delete cascade,
  dispositivo_id  uuid references public.dispositivos (id) on delete cascade,
  tipo            text not null check (tipo in (
                    'entrada_cerca', 'saida_cerca', 'compartilhamento_parado',
                    'localizacao_desatualizada', 'convite_recebido',
                    'convite_aceito', 'acesso_revogado')),
  titulo          text not null,
  mensagem        text not null,
  lido            boolean not null default false,
  criado_em       timestamptz not null default now()
);
create index on public.alertas (destinatario_id, criado_em desc);

-- Trilha de auditoria de consentimentos (LGPD, art. 8º §2º: ônus da prova
-- do consentimento é do controlador). Gravada apenas por funções.
create table public.registro_consentimentos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references auth.users (id) on delete set null,
  acao        text not null,
  detalhes    jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Funções de autorização
-- ---------------------------------------------------------------------

create or replace function public.e_dono_dispositivo(p_dispositivo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from dispositivos where id = p_dispositivo and dono_id = auth.uid()
  )
$$;

create or replace function public.pode_ver_dispositivo(p_dispositivo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.e_dono_dispositivo(p_dispositivo) or exists (
    select 1 from compartilhamentos
    where dispositivo_id = p_dispositivo
      and observador_id = auth.uid()
      and ativo
  )
$$;

-- Início da janela visível para o usuário atual (null = sem acesso).
create or replace function public.visivel_desde(p_dispositivo uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.e_dono_dispositivo(p_dispositivo) then '-infinity'::timestamptz
    else (
      select min(consentido_em) from compartilhamentos
      where dispositivo_id = p_dispositivo
        and observador_id = auth.uid()
        and ativo
    )
  end
$$;

-- Há relação de compartilhamento ativa entre o usuário atual e p_usuario?
create or replace function public.tem_vinculo_com(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from compartilhamentos c
    join dispositivos d on d.id = c.dispositivo_id
    where c.ativo and (
      (d.dono_id = auth.uid() and c.observador_id = p_usuario) or
      (d.dono_id = p_usuario and c.observador_id = auth.uid())
    )
  )
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.perfis                  enable row level security;
alter table public.dispositivos            enable row level security;
alter table public.convites                enable row level security;
alter table public.compartilhamentos       enable row level security;
alter table public.localizacoes            enable row level security;
alter table public.cercas                  enable row level security;
alter table public.alertas                 enable row level security;
alter table public.registro_consentimentos enable row level security;

-- perfis
create policy "perfil: ler o próprio ou de vínculos" on public.perfis
  for select using (id = auth.uid() or public.tem_vinculo_com(id));
create policy "perfil: editar o próprio" on public.perfis
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Privilégios por coluna: ninguém lê o push_token pelo cliente, e só nome
-- e prazo de retenção podem ser editados diretamente.
revoke select, insert, update on public.perfis from anon, authenticated;
grant  select (id, nome, retencao_dias, termos_aceitos_em, criado_em)
  on public.perfis to authenticated;
grant  update (nome, retencao_dias) on public.perfis to authenticated;

-- dispositivos
-- Observadores NÃO leem a tabela diretamente (o último ponto poderia ser
-- anterior ao consentimento); usam aparelhos_que_acompanho().
create policy "dispositivo: ver próprios" on public.dispositivos
  for select using (dono_id = auth.uid());
create policy "dispositivo: cadastrar próprio" on public.dispositivos
  for insert with check (dono_id = auth.uid());
create policy "dispositivo: editar próprio" on public.dispositivos
  for update using (dono_id = auth.uid()) with check (dono_id = auth.uid());
create policy "dispositivo: remover próprio" on public.dispositivos
  for delete using (dono_id = auth.uid());

-- O cliente só pode alterar nome e compartilhando; colunas ultima_* são
-- mantidas pelo gatilho de localizações.
revoke update on public.dispositivos from anon, authenticated;
grant  update (nome, compartilhando) on public.dispositivos to authenticated;

-- convites (criação/resposta via funções)
create policy "convite: ver enviados ou recebidos" on public.convites
  for select using (remetente_id = auth.uid() or destinatario_id = auth.uid());

-- compartilhamentos (criação/revogação via funções)
create policy "compartilhamento: ver como dono ou observador" on public.compartilhamentos
  for select using (observador_id = auth.uid() or public.e_dono_dispositivo(dispositivo_id));

-- localizacoes
create policy "localização: dono envia enquanto compartilha" on public.localizacoes
  for insert with check (
    exists (
      select 1 from public.dispositivos d
      where d.id = dispositivo_id and d.dono_id = auth.uid() and d.compartilhando
    )
    and registrado_em <= now() + interval '5 minutes'
    and registrado_em >= now() - interval '7 days'
  );
create policy "localização: ver apenas após consentimento" on public.localizacoes
  for select using (registrado_em >= public.visivel_desde(dispositivo_id));
create policy "localização: dono apaga histórico" on public.localizacoes
  for delete using (public.e_dono_dispositivo(dispositivo_id));
revoke update on public.localizacoes from anon, authenticated;

-- cercas
create policy "cerca: criador ou dono do aparelho vê" on public.cercas
  for select using (criador_id = auth.uid() or public.e_dono_dispositivo(dispositivo_id));
create policy "cerca: criar para aparelho autorizado" on public.cercas
  for insert with check (criador_id = auth.uid() and public.pode_ver_dispositivo(dispositivo_id));
create policy "cerca: criador edita" on public.cercas
  for update using (criador_id = auth.uid()) with check (criador_id = auth.uid());
create policy "cerca: criador remove" on public.cercas
  for delete using (criador_id = auth.uid());
revoke update on public.cercas from anon, authenticated;
grant  update (nome, raio_m, alerta_entrada, alerta_saida, ativa) on public.cercas to authenticated;

-- alertas
create policy "alerta: ver os próprios" on public.alertas
  for select using (destinatario_id = auth.uid());
create policy "alerta: marcar como lido" on public.alertas
  for update using (destinatario_id = auth.uid()) with check (destinatario_id = auth.uid());
create policy "alerta: apagar os próprios" on public.alertas
  for delete using (destinatario_id = auth.uid());
revoke update on public.alertas from anon, authenticated;
grant  update (lido) on public.alertas to authenticated;

-- registro_consentimentos: o titular pode consultar os próprios registros.
create policy "consentimento: ver os próprios" on public.registro_consentimentos
  for select using (usuario_id = auth.uid());

-- Usuários anônimos não acessam nada.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------

-- Cria o perfil automaticamente no cadastro.
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis (id, nome)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), 'Usuário'));
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Ao receber localização: atualiza último ponto e avalia cercas.
create or replace function public.processar_localizacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disp  dispositivos%rowtype;
  v_cerca record;
  v_dentro boolean;
begin
  select * into v_disp from dispositivos where id = new.dispositivo_id;

  -- Só avança o "último ponto" se este for mais recente.
  if v_disp.ultima_atualizacao is null or new.registrado_em > v_disp.ultima_atualizacao then
    update dispositivos
       set ultima_lat = new.lat,
           ultima_lng = new.lng,
           ultima_precisao = new.precisao,
           ultima_atualizacao = new.registrado_em
     where id = new.dispositivo_id;
  else
    return new;  -- ponto atrasado: não reavalia cercas
  end if;

  for v_cerca in
    select c.* from cercas c
    where c.dispositivo_id = new.dispositivo_id
      and c.ativa
      -- o criador ainda precisa ter acesso ao aparelho
      and (c.criador_id = v_disp.dono_id or exists (
            select 1 from compartilhamentos s
            where s.dispositivo_id = c.dispositivo_id
              and s.observador_id = c.criador_id and s.ativo))
  loop
    v_dentro := distancia_metros(new.lat, new.lng, v_cerca.lat, v_cerca.lng) <= v_cerca.raio_m;

    if v_cerca.dentro is distinct from v_dentro then
      update cercas set dentro = v_dentro where id = v_cerca.id;

      -- Na primeira avaliação apenas registra o estado, sem alertar.
      if v_cerca.dentro is not null then
        if v_dentro and v_cerca.alerta_entrada then
          insert into alertas (destinatario_id, dispositivo_id, tipo, titulo, mensagem)
          values (v_cerca.criador_id, new.dispositivo_id, 'entrada_cerca',
                  'Chegada em ' || v_cerca.nome,
                  v_disp.nome || ' entrou na área "' || v_cerca.nome || '".');
        elsif not v_dentro and v_cerca.alerta_saida then
          insert into alertas (destinatario_id, dispositivo_id, tipo, titulo, mensagem)
          values (v_cerca.criador_id, new.dispositivo_id, 'saida_cerca',
                  'Saída de ' || v_cerca.nome,
                  v_disp.nome || ' saiu da área "' || v_cerca.nome || '".');
        end if;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create trigger ao_inserir_localizacao
  after insert on public.localizacoes
  for each row execute function public.processar_localizacao();

-- Ao pausar o compartilhamento: avisa os observadores.
create or replace function public.notificar_mudanca_compartilhamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.compartilhando and not new.compartilhando then
    insert into alertas (destinatario_id, dispositivo_id, tipo, titulo, mensagem)
    select c.observador_id, new.id, 'compartilhamento_parado',
           'Compartilhamento pausado',
           new.nome || ' deixou de compartilhar a localização.'
    from compartilhamentos c
    where c.dispositivo_id = new.id and c.ativo;

    insert into registro_consentimentos (usuario_id, acao, detalhes)
    values (new.dono_id, 'compartilhamento_pausado', jsonb_build_object('dispositivo_id', new.id));
  elsif not old.compartilhando and new.compartilhando then
    insert into registro_consentimentos (usuario_id, acao, detalhes)
    values (new.dono_id, 'compartilhamento_ativado', jsonb_build_object('dispositivo_id', new.id));
  end if;
  return new;
end;
$$;

create trigger ao_alterar_compartilhamento
  after update of compartilhando on public.dispositivos
  for each row execute function public.notificar_mudanca_compartilhamento();

-- ---------------------------------------------------------------------
-- Funções de convite e consentimento (RPC)
-- ---------------------------------------------------------------------

create or replace function public.gerar_codigo_convite()
returns text
language plpgsql
as $$
declare
  -- sem caracteres ambíguos (0/O, 1/I/L)
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(8);
  resultado text := '';
begin
  for i in 0..7 loop
    resultado := resultado || substr(alfabeto, (get_byte(bytes, i) % length(alfabeto)) + 1, 1);
  end loop;
  return resultado;
end;
$$;

-- Cria um convite pedindo que outra pessoa compartilhe a localização.
-- O telefone serve apenas para identificar o destinatário no app; ele NÃO
-- dá acesso a localização alguma sem o aceite do titular.
create or replace function public.criar_convite(p_telefone text default null, p_mensagem text default null)
returns public.convites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel text := normalizar_telefone(p_telefone);
  v_convite convites;
  v_destinatario uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  -- Limite antiabuso: 20 convites por dia.
  if (select count(*) from convites
      where remetente_id = auth.uid() and criado_em > now() - interval '1 day') >= 20 then
    raise exception 'Limite diário de convites atingido. Tente novamente amanhã.';
  end if;

  if v_tel is not null and v_tel !~ '^[0-9]{10,15}$' then
    raise exception 'Número de telefone inválido.';
  end if;

  insert into convites (remetente_id, telefone_destino, codigo, mensagem)
  values (auth.uid(), v_tel, gerar_codigo_convite(), nullif(trim(p_mensagem), ''))
  returning * into v_convite;

  -- Se já houver usuário com esse telefone verificado, avisa no app.
  if v_tel is not null then
    select id into v_destinatario from auth.users
    where phone = v_tel and phone_confirmed_at is not null and id <> auth.uid()
    limit 1;

    if v_destinatario is not null then
      insert into alertas (destinatario_id, tipo, titulo, mensagem)
      values (v_destinatario, 'convite_recebido', 'Novo pedido de localização',
              (select nome from perfis where id = auth.uid()) ||
              ' pediu para ver sua localização. Abra Convites para aceitar ou recusar.');
    end if;
  end if;

  insert into registro_consentimentos (usuario_id, acao, detalhes)
  values (auth.uid(), 'convite_criado', jsonb_build_object('convite_id', v_convite.id));

  return v_convite;
end;
$$;

-- Convites pendentes para o usuário atual: pelo telefone verificado na
-- conta (auth.users.phone) ou já vinculados a ele.
create or replace function public.convites_recebidos()
returns table (id uuid, remetente_nome text, mensagem text, criado_em timestamptz, expira_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, p.nome, c.mensagem, c.criado_em, c.expira_em
  from convites c
  join perfis p on p.id = c.remetente_id
  where c.status = 'pendente'
    and c.expira_em > now()
    and c.remetente_id <> auth.uid()
    and (
      c.destinatario_id = auth.uid() or
      c.telefone_destino = (
        select u.phone from auth.users u
        where u.id = auth.uid() and u.phone_confirmed_at is not null
      )
    )
  order by c.criado_em desc
$$;

-- Busca um convite pelo código recebido fora do app (WhatsApp, SMS etc.)
-- e o vincula ao usuário atual, para que apareça em convites_recebidos().
create or replace function public.resgatar_convite(p_codigo text)
returns table (id uuid, remetente_nome text, mensagem text, criado_em timestamptz, expira_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite convites;
begin
  select cv.* into v_convite from convites cv
  where cv.codigo = upper(regexp_replace(p_codigo, '[^A-Za-z0-9]', '', 'g'))
    and cv.status = 'pendente' and cv.expira_em > now()
  for update;

  if v_convite.id is null then
    raise exception 'Convite não encontrado ou expirado.';
  end if;
  if v_convite.remetente_id = auth.uid() then
    raise exception 'Você não pode aceitar o próprio convite.';
  end if;
  if v_convite.destinatario_id is not null and v_convite.destinatario_id <> auth.uid() then
    raise exception 'Este convite já foi utilizado por outra pessoa.';
  end if;

  update convites cv set destinatario_id = auth.uid() where cv.id = v_convite.id;

  return query
    select v_convite.id, p.nome, v_convite.mensagem, v_convite.criado_em, v_convite.expira_em
    from perfis p where p.id = v_convite.remetente_id;
end;
$$;

-- O titular aceita o convite e escolhe QUAIS aparelhos compartilhar.
create or replace function public.responder_convite(
  p_convite uuid,
  p_aceitar boolean,
  p_dispositivos uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite convites;
  v_meu_tel text;
  v_disp uuid;
begin
  select phone into v_meu_tel from auth.users
  where id = auth.uid() and phone_confirmed_at is not null;

  select * into v_convite from convites
  where id = p_convite and status = 'pendente' and expira_em > now()
    and remetente_id <> auth.uid()
    and (destinatario_id = auth.uid() or (telefone_destino is not null and telefone_destino = v_meu_tel))
  for update;

  if v_convite.id is null then
    raise exception 'Convite não encontrado ou expirado.';
  end if;

  if not p_aceitar then
    update convites set status = 'recusado', destinatario_id = auth.uid(), respondido_em = now()
    where id = p_convite;
    insert into registro_consentimentos (usuario_id, acao, detalhes)
    values (auth.uid(), 'convite_recusado', jsonb_build_object('convite_id', p_convite));
    return;
  end if;

  if coalesce(array_length(p_dispositivos, 1), 0) = 0 then
    raise exception 'Selecione ao menos um aparelho para compartilhar.';
  end if;

  foreach v_disp in array p_dispositivos loop
    if not exists (select 1 from dispositivos where id = v_disp and dono_id = auth.uid()) then
      raise exception 'Aparelho inválido.';
    end if;
    insert into compartilhamentos (dispositivo_id, observador_id, convite_id)
    values (v_disp, v_convite.remetente_id, p_convite)
    on conflict (dispositivo_id, observador_id) where ativo do nothing;
  end loop;

  update convites set status = 'aceito', destinatario_id = auth.uid(), respondido_em = now()
  where id = p_convite;

  insert into registro_consentimentos (usuario_id, acao, detalhes)
  values (auth.uid(), 'consentimento_concedido', jsonb_build_object(
    'convite_id', p_convite,
    'observador_id', v_convite.remetente_id,
    'dispositivos', to_jsonb(p_dispositivos)));

  insert into alertas (destinatario_id, tipo, titulo, mensagem)
  values (v_convite.remetente_id, 'convite_aceito', 'Convite aceito',
          (select nome from perfis where id = auth.uid()) || ' aceitou compartilhar a localização com você.');
end;
$$;

create or replace function public.cancelar_convite(p_convite uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update convites set status = 'cancelado', respondido_em = now()
  where id = p_convite and remetente_id = auth.uid() and status = 'pendente'
$$;

-- Revoga um compartilhamento. Pode ser feito pelo dono do aparelho
-- (retira o acesso) ou pelo observador (deixa de acompanhar).
create or replace function public.revogar_compartilhamento(p_compartilhamento uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c compartilhamentos;
  v_dono uuid;
  v_nome_disp text;
begin
  select c.* into v_c from compartilhamentos c where c.id = p_compartilhamento and c.ativo;
  select dono_id, nome into v_dono, v_nome_disp from dispositivos where id = v_c.dispositivo_id;

  if v_c.id is null or auth.uid() not in (v_dono, v_c.observador_id) then
    raise exception 'Compartilhamento não encontrado.';
  end if;

  update compartilhamentos set ativo = false, revogado_em = now() where id = p_compartilhamento;

  -- Cercas criadas pelo observador deixam de valer.
  update cercas set ativa = false
  where dispositivo_id = v_c.dispositivo_id and criador_id = v_c.observador_id;

  if auth.uid() = v_dono then
    insert into alertas (destinatario_id, dispositivo_id, tipo, titulo, mensagem)
    values (v_c.observador_id, null, 'acesso_revogado', 'Acesso encerrado',
            'O acesso à localização de ' || v_nome_disp || ' foi encerrado pelo titular.');
  end if;

  insert into registro_consentimentos (usuario_id, acao, detalhes)
  values (auth.uid(), 'consentimento_revogado', jsonb_build_object(
    'compartilhamento_id', p_compartilhamento,
    'por', case when auth.uid() = v_dono then 'titular' else 'observador' end));
end;
$$;

-- Lista quem pode ver cada aparelho do usuário (transparência para o titular).
create or replace function public.quem_me_ve()
returns table (compartilhamento_id uuid, dispositivo_id uuid, dispositivo_nome text,
               observador_nome text, consentido_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, d.id, d.nome, p.nome, c.consentido_em
  from compartilhamentos c
  join dispositivos d on d.id = c.dispositivo_id
  join perfis p on p.id = c.observador_id
  where d.dono_id = auth.uid() and c.ativo
  order by c.consentido_em desc
$$;

-- Aparelhos que o usuário acompanha, com o nome do titular. O último ponto
-- só é exposto se tiver sido registrado após o consentimento.
create or replace function public.aparelhos_que_acompanho()
returns table (compartilhamento_id uuid, dispositivo_id uuid, dispositivo_nome text,
               titular_nome text, compartilhando boolean, ultima_lat double precision,
               ultima_lng double precision, ultima_precisao double precision,
               ultima_atualizacao timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, d.id, d.nome, p.nome, d.compartilhando,
         case when d.ultima_atualizacao >= c.consentido_em then d.ultima_lat end,
         case when d.ultima_atualizacao >= c.consentido_em then d.ultima_lng end,
         case when d.ultima_atualizacao >= c.consentido_em then d.ultima_precisao end,
         case when d.ultima_atualizacao >= c.consentido_em then d.ultima_atualizacao end
  from compartilhamentos c
  join dispositivos d on d.id = c.dispositivo_id
  join perfis p on p.id = d.dono_id
  where c.observador_id = auth.uid() and c.ativo
  order by p.nome, d.nome
$$;

-- Salva o token de push (coluna não legível por outros usuários).
create or replace function public.salvar_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update perfis set push_token = p_token where id = auth.uid()
$$;

create or replace function public.aceitar_termos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update perfis set termos_aceitos_em = now() where id = auth.uid();
  insert into registro_consentimentos (usuario_id, acao, detalhes)
  values (auth.uid(), 'termos_aceitos', jsonb_build_object('versao', '1.0'));
end;
$$;

-- Direito de eliminação (LGPD art. 18, VI): apaga a conta e tudo em cascata.
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into registro_consentimentos (usuario_id, acao) values (null, 'conta_excluida');
  delete from auth.users where id = auth.uid();
end;
$$;

-- Funções internas não devem ser chamadas pelo cliente.
revoke execute on function public.processar_localizacao() from public, anon, authenticated;
revoke execute on function public.notificar_mudanca_compartilhamento() from public, anon, authenticated;
revoke execute on function public.criar_perfil_novo_usuario() from public, anon, authenticated;
revoke execute on all functions in schema public from anon;

-- ---------------------------------------------------------------------
-- Rotinas periódicas (agendadas na migração de cron)
-- ---------------------------------------------------------------------

-- Alerta quando a localização estiver desatualizada (> 30 min) enquanto
-- o compartilhamento consta como ativo — aparelho offline, sem bateria,
-- permissão revogada no sistema etc.
create or replace function public.verificar_dispositivos_inativos(p_limite interval default interval '30 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_disp record;
begin
  for v_disp in
    select * from dispositivos
    where compartilhando
      and ultima_atualizacao < now() - p_limite
      and (ultimo_alerta_inativo is null or ultimo_alerta_inativo < ultima_atualizacao)
  loop
    insert into alertas (destinatario_id, dispositivo_id, tipo, titulo, mensagem)
    select c.observador_id, v_disp.id, 'localizacao_desatualizada',
           'Localização desatualizada',
           v_disp.nome || ' não envia localização desde ' ||
           to_char(v_disp.ultima_atualizacao at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') ||
           '. O aparelho pode estar offline ou sem bateria.'
    from compartilhamentos c
    where c.dispositivo_id = v_disp.id and c.ativo;

    update dispositivos set ultimo_alerta_inativo = now() where id = v_disp.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

-- Retenção: apaga localizações mais antigas que o prazo do titular,
-- alertas com mais de 90 dias e convites encerrados/expirados há 30 dias.
create or replace function public.aplicar_retencao()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from localizacoes l
  using dispositivos d, perfis p
  where l.dispositivo_id = d.id and p.id = d.dono_id
    and l.registrado_em < now() - make_interval(days => p.retencao_dias);

  delete from alertas where criado_em < now() - interval '90 days';

  delete from convites
  where (status <> 'pendente' and respondido_em < now() - interval '30 days')
     or (status = 'pendente' and expira_em < now() - interval '30 days');

  -- Auditoria de consentimento é mantida por 5 anos (prazo prescricional).
  delete from registro_consentimentos where criado_em < now() - interval '5 years';
end;
$$;

revoke execute on function public.verificar_dispositivos_inativos(interval) from public, anon, authenticated;
revoke execute on function public.aplicar_retencao() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime (respeita RLS): o mapa recebe novos pontos apenas dos aparelhos
-- autorizados e somente posteriores ao consentimento.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.localizacoes;
alter publication supabase_realtime add table public.alertas;
