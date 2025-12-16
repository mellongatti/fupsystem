-- Crie as tabelas de clientes e notas
create table if not exists public.clients (
  id text primary key,
  name text not null,
  next_follow_up bigint null,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  text text not null,
  at bigint not null default ((extract(epoch from now()) * 1000)::bigint),
  created_at timestamptz not null default now()
);

-- Habilite RLS
alter table public.clients enable row level security;
alter table public.notes enable row level security;

-- Políticas simples (para uso pessoal). Em produção, restrinja conforme necessário.
-- Permitir leitura/escrita para usuários anônimos (chave anon).
-- Observação: CREATE POLICY não suporta "IF NOT EXISTS". Use DROP POLICY IF EXISTS antes.

drop policy if exists "Allow read clients" on public.clients;
create policy "Allow read clients" on public.clients
  for select
  to anon
  using (true);

drop policy if exists "Allow insert clients" on public.clients;
create policy "Allow insert clients" on public.clients
  for insert
  to anon
  with check (true);

drop policy if exists "Allow update clients" on public.clients;
create policy "Allow update clients" on public.clients
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Allow read notes" on public.notes;
create policy "Allow read notes" on public.notes
  for select
  to anon
  using (true);

drop policy if exists "Allow insert notes" on public.notes;
create policy "Allow insert notes" on public.notes
  for insert
  to anon
  with check (true);

drop policy if exists "Allow delete clients" on public.clients;
create policy "Allow delete clients" on public.clients
  for delete
  to anon
  using (true);

drop policy if exists "Allow delete notes" on public.notes;
create policy "Allow delete notes" on public.notes
  for delete
  to anon
  using (true);

-- Opcional: permitir update de notas
-- Se não quiser permitir edição de notas, remova as duas linhas abaixo.
drop policy if exists "Allow update notes" on public.notes;
create policy "Allow update notes" on public.notes
  for update
  to anon
  using (true)
  with check (true);