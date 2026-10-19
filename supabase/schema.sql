-- Vriddhi production database (Supabase / PostgreSQL)
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.app_docs (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  path       text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);

-- Row Level Security: a signed-in user can only touch their own rows.
alter table public.app_docs enable row level security;

drop policy if exists "own rows: read"   on public.app_docs;
drop policy if exists "own rows: insert" on public.app_docs;
drop policy if exists "own rows: update" on public.app_docs;
drop policy if exists "own rows: delete" on public.app_docs;

create policy "own rows: read"   on public.app_docs for select to authenticated using (auth.uid() = user_id);
create policy "own rows: insert" on public.app_docs for insert to authenticated with check (auth.uid() = user_id);
create policy "own rows: update" on public.app_docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.app_docs for delete to authenticated using (auth.uid() = user_id);

-- No access at all for the anonymous (not signed in) role.
revoke all on public.app_docs from anon;
grant select, insert, update, delete on public.app_docs to authenticated;

-- ---------------------------------------------------------------------------
-- Advisers (who may manage client logins from the Users tab). Safe to re-run.
create table if not exists public.advisers (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.advisers enable row level security;
drop policy if exists "own adviser row: read" on public.advisers;
create policy "own adviser row: read" on public.advisers for select to authenticated using (auth.uid() = user_id);
-- A login can only check whether IT is an adviser. Nobody can add advisers through the app.
revoke all on public.advisers from anon, authenticated;
grant select on public.advisers to authenticated;

-- RUN ONCE, with your own adviser email, to mark your login as adviser:
-- insert into public.advisers (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Holding snapshots: dated copies of a login's holdings, searchable by date. Safe to re-run.
create table if not exists public.vr_holding_snapshots (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  label          text        not null default '',
  note           text        not null default '',
  plan           text        not null default '',
  holdings_count integer     not null default 0,
  total_value    numeric     not null default 0,
  data           jsonb       not null check (jsonb_typeof(data) = 'object'),
  created_at     timestamptz not null default now()
);
create index if not exists vr_holding_snapshots_user_created on public.vr_holding_snapshots (user_id, created_at desc);

alter table public.vr_holding_snapshots enable row level security;
drop policy if exists "own snapshots: read"   on public.vr_holding_snapshots;
drop policy if exists "own snapshots: insert" on public.vr_holding_snapshots;
drop policy if exists "own snapshots: delete" on public.vr_holding_snapshots;
create policy "own snapshots: read"   on public.vr_holding_snapshots for select to authenticated using (auth.uid() = user_id);
create policy "own snapshots: insert" on public.vr_holding_snapshots for insert to authenticated with check (auth.uid() = user_id);
create policy "own snapshots: delete" on public.vr_holding_snapshots for delete to authenticated using (auth.uid() = user_id);

-- No access for the anonymous role. Snapshots cannot be edited, only added or deleted.
revoke all on public.vr_holding_snapshots from anon;
grant select, insert, delete on public.vr_holding_snapshots to authenticated;
