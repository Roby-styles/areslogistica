-- ARES Logistica - preparazione Supabase Auth (fase non distruttiva)
-- Questa migrazione NON modifica le policy delle tabelle ERP esistenti.
-- Puo essere eseguita mentre la versione attuale dell'app e ancora online.

begin;

create extension if not exists pgcrypto;

create table if not exists public.ares_clients (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ares_sites (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.ares_clients(id) on delete cascade,
    name text not null,
    address text,
    latitude double precision,
    longitude double precision,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (client_id, name)
);

create table if not exists public.ares_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    username text not null,
    full_name text,
    role text not null default 'cliente'
        check (role in ('super_admin', 'admin', 'operatore', 'user', 'cliente')),
    client_id uuid references public.ares_clients(id) on delete set null,
    default_site_id uuid references public.ares_sites(id) on delete set null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ares_profiles_email_lower_idx
    on public.ares_profiles (lower(email));
create index if not exists ares_profiles_username_lower_idx
    on public.ares_profiles (lower(username));

create table if not exists public.ares_memberships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.ares_profiles(id) on delete cascade,
    client_id uuid not null references public.ares_clients(id) on delete cascade,
    site_id uuid references public.ares_sites(id) on delete cascade,
    membership_role text not null default 'viewer'
        check (membership_role in ('owner', 'manager', 'operator', 'viewer')),
    created_at timestamptz not null default now(),
    unique (user_id, client_id, site_id)
);

create or replace function public.ares_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists ares_clients_set_updated_at on public.ares_clients;
create trigger ares_clients_set_updated_at
before update on public.ares_clients
for each row execute function public.ares_set_updated_at();

drop trigger if exists ares_sites_set_updated_at on public.ares_sites;
create trigger ares_sites_set_updated_at
before update on public.ares_sites
for each row execute function public.ares_set_updated_at();

drop trigger if exists ares_profiles_set_updated_at on public.ares_profiles;
create trigger ares_profiles_set_updated_at
before update on public.ares_profiles
for each row execute function public.ares_set_updated_at();

-- Ogni account Auth riceve sempre il ruolo minimo. La promozione ad amministratore
-- deve essere fatta esplicitamente dal proprietario del progetto.
create or replace function public.ares_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    proposed_username text;
begin
    proposed_username := coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'utente-' || left(new.id::text, 8)
    );

    insert into public.ares_profiles (id, email, username, full_name, role, active)
    values (
        new.id,
        coalesce(new.email, new.id::text || '@utente.ares'),
        proposed_username,
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        'cliente',
        true
    )
    on conflict (id) do update
       set email = excluded.email,
           updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.ares_handle_new_auth_user();

-- Recupera eventuali account Auth gia presenti nel progetto.
insert into public.ares_profiles (id, email, username, full_name, role, active)
select
    u.id,
    coalesce(u.email, u.id::text || '@utente.ares'),
    coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
        'utente-' || left(u.id::text, 8)
    ),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    'cliente',
    true
from auth.users u
on conflict (id) do nothing;

-- Funzioni usate dalle policy. Il ruolo deriva dal database e mai dal browser.
create or replace function public.current_ares_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select p.role
    from public.ares_profiles p
    where p.id = auth.uid() and p.active = true
    limit 1;
$$;

create or replace function public.is_ares_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_ares_role() in ('super_admin', 'admin', 'operatore', 'user'), false);
$$;

create or replace function public.can_access_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        public.is_ares_staff()
        or exists (
            select 1
            from public.ares_memberships m
            where m.user_id = auth.uid()
              and m.client_id = target_client_id
        )
        or exists (
            select 1
            from public.ares_profiles p
            where p.id = auth.uid()
              and p.active = true
              and p.client_id = target_client_id
        );
$$;

revoke all on function public.current_ares_role() from public;
revoke all on function public.is_ares_staff() from public;
revoke all on function public.can_access_client(uuid) from public;
grant execute on function public.current_ares_role() to authenticated;
grant execute on function public.is_ares_staff() to authenticated;
grant execute on function public.can_access_client(uuid) to authenticated;

-- Le nuove tabelle sono protette da subito; la vecchia app non le usa ancora.
alter table public.ares_clients enable row level security;
alter table public.ares_sites enable row level security;
alter table public.ares_profiles enable row level security;
alter table public.ares_memberships enable row level security;

drop policy if exists ares_profiles_select_self_or_staff on public.ares_profiles;
create policy ares_profiles_select_self_or_staff
on public.ares_profiles for select to authenticated
using (id = auth.uid() or public.is_ares_staff());

drop policy if exists ares_clients_select_authorized on public.ares_clients;
create policy ares_clients_select_authorized
on public.ares_clients for select to authenticated
using (public.can_access_client(id));

drop policy if exists ares_sites_select_authorized on public.ares_sites;
create policy ares_sites_select_authorized
on public.ares_sites for select to authenticated
using (public.can_access_client(client_id));

drop policy if exists ares_memberships_select_self_or_staff on public.ares_memberships;
create policy ares_memberships_select_self_or_staff
on public.ares_memberships for select to authenticated
using (user_id = auth.uid() or public.is_ares_staff());

revoke all on public.ares_clients, public.ares_sites, public.ares_profiles, public.ares_memberships from anon;
grant select on public.ares_clients, public.ares_sites, public.ares_profiles, public.ares_memberships to authenticated;

-- Colonne di collegamento aggiunte senza cancellare o trasformare i dati esistenti.
alter table if exists public.ares_crm
    add column if not exists client_id uuid references public.ares_clients(id) on delete set null,
    add column if not exists site_id uuid references public.ares_sites(id) on delete set null;

alter table if exists public.ares_resources
    add column if not exists client_id uuid references public.ares_clients(id) on delete set null,
    add column if not exists site_id uuid references public.ares_sites(id) on delete set null;

alter table if exists public.ares_planning
    add column if not exists client_id uuid references public.ares_clients(id) on delete set null,
    add column if not exists site_id uuid references public.ares_sites(id) on delete set null;

alter table if exists public.ares_preventivi
    add column if not exists client_id uuid references public.ares_clients(id) on delete set null,
    add column if not exists site_id uuid references public.ares_sites(id) on delete set null;

alter table if exists public.ares_cameras
    add column if not exists client_id uuid references public.ares_clients(id) on delete set null,
    add column if not exists site_id uuid references public.ares_sites(id) on delete set null;

alter table if exists public.ares_fascicoli
    add column if not exists client_id uuid references public.ares_clients(id) on delete set null,
    add column if not exists site_id uuid references public.ares_sites(id) on delete set null;

alter table if exists public.ares_presence
    add column if not exists user_id uuid references auth.users(id) on delete cascade,
    add column if not exists client_id uuid references public.ares_clients(id) on delete set null;

commit;
