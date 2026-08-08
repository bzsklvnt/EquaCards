-- Phase 1: jogosultsági rendszer (roles/profiles) + audit log
-- Séma forrás: docs/architecture/DATA_MODEL.md 1. és 6. szakasz

create table roles (
  id smallint primary key,
  code text unique not null,             -- super_admin | admin | host | viewer
  label text not null
);

insert into roles (id, code, label) values
  (1, 'super_admin', 'Rendszergazda'),
  (2, 'admin', 'Kérdésbank kezelő'),
  (3, 'host', 'Kvízmester (élő lebonyolítás)'),
  (4, 'viewer', 'Csak megtekintés');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role_id smallint references roles(id) not null default 4,
  created_at timestamptz default now()
);

-- Minden auth.users beszúráskor automatikusan létrejön a hozzá tartozó
-- profiles sor, alapértelmezett role_id = 4 (viewer). Az első super_admin-t
-- ezután kézzel kell felléptetni: update profiles set role_id = 1 where id = '<uuid>';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Segédfüggvény: a bejelentkezett felhasználó role_id-ja, security definer,
-- hogy a lenti RLS szabályok ne okozzanak rekurzív policy-kiértékelést a
-- profiles táblán.
create or replace function public.current_user_role_id()
returns smallint
language sql
security definer
stable
set search_path = public
as $$
  select role_id from public.profiles where id = auth.uid();
$$;

alter table roles enable row level security;
alter table profiles enable row level security;

create policy "roles_select_authenticated" on roles
  for select to authenticated
  using (true);

create policy "profiles_select_own" on profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_select_admin" on profiles
  for select to authenticated
  using (public.current_user_role_id() in (1, 2));

create policy "profiles_update_own" on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role_id = public.current_user_role_id());

create policy "profiles_update_super_admin" on profiles
  for update to authenticated
  using (public.current_user_role_id() = 1)
  with check (public.current_user_role_id() = 1);

-- Audit log — docs/architecture/DATA_MODEL.md 6. szakasz

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz default now()
);

create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);
create index idx_audit_logs_actor on audit_logs (actor_id, created_at desc);
create index idx_audit_logs_action on audit_logs (action, created_at desc);

alter table audit_logs enable row level security;

create policy "audit_logs_select_super_admin" on audit_logs
  for select to authenticated
  using (public.current_user_role_id() = 1);

create or replace function public.log_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(NEW) end
  );
  return coalesce(NEW, OLD);
end;
$$;

create trigger trg_audit_profiles
  after insert or update or delete on profiles
  for each row execute function public.log_table_change();

-- Supabase grants EXECUTE on new public-schema functions directly to
-- anon/authenticated/service_role by default, which would expose these as
-- public RPC endpoints (Supabase security advisor: anon/authenticated
-- security-definer function warnings). handle_new_user and log_table_change
-- are trigger-only (they read NEW/OLD/TG_* and are never meant to be called
-- directly) — trigger firing does not require the invoking client role to
-- hold EXECUTE, so revoking it does not break the triggers.
-- current_user_role_id() is used inside the RLS policies above, evaluated as
-- the `authenticated` role, so EXECUTE must stay granted there; only the
-- anon/PUBLIC RPC exposure is removed.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.log_table_change() from anon, authenticated;

revoke execute on function public.current_user_role_id() from anon, authenticated;
grant execute on function public.current_user_role_id() to authenticated;
