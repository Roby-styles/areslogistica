-- ARES Logistica - attivazione finale RLS
-- ATTENZIONE: eseguire solo dopo il collaudo della versione con Supabase Auth.
-- Da questo momento la vecchia pagina di login non potra piu leggere ares_users.

begin;

-- La tabella legacy delle password viene resa inaccessibile all'applicazione.
alter table if exists public.ares_users enable row level security;
revoke all on table public.ares_users from anon, authenticated;

-- La presenza e uno stato temporaneo: si azzerano le vecchie righe anonime
-- prima di richiedere user_id = auth.uid().
truncate table public.ares_presence;

-- Nessuna tabella ERP deve restare accessibile come visitatore anonimo.
revoke all on table
    public.ares_crm,
    public.ares_resources,
    public.ares_planning,
    public.ares_preventivi,
    public.ares_cameras,
    public.ares_fascicoli,
    public.ares_presence
from anon;

grant select, insert, update, delete on table
    public.ares_crm,
    public.ares_resources,
    public.ares_planning,
    public.ares_preventivi,
    public.ares_cameras,
    public.ares_fascicoli,
    public.ares_presence
to authenticated;

alter table public.ares_crm enable row level security;
alter table public.ares_resources enable row level security;
alter table public.ares_planning enable row level security;
alter table public.ares_preventivi enable row level security;
alter table public.ares_cameras enable row level security;
alter table public.ares_fascicoli enable row level security;
alter table public.ares_presence enable row level security;

-- Lo staff autenticato puo gestire i dati operativi.
drop policy if exists ares_crm_staff_all on public.ares_crm;
create policy ares_crm_staff_all on public.ares_crm
for all to authenticated using (public.is_ares_staff()) with check (public.is_ares_staff());
drop policy if exists ares_resources_staff_all on public.ares_resources;
create policy ares_resources_staff_all on public.ares_resources
for all to authenticated using (public.is_ares_staff()) with check (public.is_ares_staff());
drop policy if exists ares_planning_staff_all on public.ares_planning;
create policy ares_planning_staff_all on public.ares_planning
for all to authenticated using (public.is_ares_staff()) with check (public.is_ares_staff());
drop policy if exists ares_preventivi_staff_all on public.ares_preventivi;
create policy ares_preventivi_staff_all on public.ares_preventivi
for all to authenticated using (public.is_ares_staff()) with check (public.is_ares_staff());
drop policy if exists ares_cameras_staff_all on public.ares_cameras;
create policy ares_cameras_staff_all on public.ares_cameras
for all to authenticated using (public.is_ares_staff()) with check (public.is_ares_staff());
drop policy if exists ares_fascicoli_staff_all on public.ares_fascicoli;
create policy ares_fascicoli_staff_all on public.ares_fascicoli
for all to authenticated using (public.is_ares_staff()) with check (public.is_ares_staff());

-- I clienti vedono solo i record associati alla propria azienda.
drop policy if exists ares_crm_client_select on public.ares_crm;
create policy ares_crm_client_select on public.ares_crm
for select to authenticated using (client_id is not null and public.can_access_client(client_id));
drop policy if exists ares_resources_client_select on public.ares_resources;
create policy ares_resources_client_select on public.ares_resources
for select to authenticated using (client_id is not null and public.can_access_client(client_id));
drop policy if exists ares_planning_client_select on public.ares_planning;
create policy ares_planning_client_select on public.ares_planning
for select to authenticated using (client_id is not null and public.can_access_client(client_id));
drop policy if exists ares_preventivi_client_select on public.ares_preventivi;
create policy ares_preventivi_client_select on public.ares_preventivi
for select to authenticated using (client_id is not null and public.can_access_client(client_id));
drop policy if exists ares_cameras_client_select on public.ares_cameras;
create policy ares_cameras_client_select on public.ares_cameras
for select to authenticated using (client_id is not null and public.can_access_client(client_id));
drop policy if exists ares_fascicoli_client_select on public.ares_fascicoli;
create policy ares_fascicoli_client_select on public.ares_fascicoli
for select to authenticated using (client_id is not null and public.can_access_client(client_id));

-- Presenza: ciascun utente aggiorna solo se stesso; lo staff puo leggere la sala operativa.
drop policy if exists ares_presence_select_staff_or_self on public.ares_presence;
create policy ares_presence_select_staff_or_self on public.ares_presence
for select to authenticated
using (public.is_ares_staff() or user_id = auth.uid());

drop policy if exists ares_presence_insert_self on public.ares_presence;
create policy ares_presence_insert_self on public.ares_presence
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists ares_presence_update_self_or_staff on public.ares_presence;
create policy ares_presence_update_self_or_staff on public.ares_presence
for update to authenticated
using (user_id = auth.uid() or public.is_ares_staff())
with check (user_id = auth.uid() or public.is_ares_staff());

-- I due bucket diventano privati. I percorsi iniziano con l'UUID del cliente.
update storage.buckets
set public = false
where id in ('ares-documenti', 'galleria-lavori');

drop policy if exists ares_storage_read_authorized on storage.objects;
create policy ares_storage_read_authorized
on storage.objects for select to authenticated
using (
    bucket_id in ('ares-documenti', 'galleria-lavori')
    and (
        public.is_ares_staff()
        or exists (
            select 1
            from public.ares_memberships m
            where m.user_id = auth.uid()
              and m.client_id::text = (storage.foldername(name))[1]
        )
        or exists (
            select 1
            from public.ares_profiles p
            where p.id = auth.uid()
              and p.active = true
              and p.client_id::text = (storage.foldername(name))[1]
        )
    )
);

drop policy if exists ares_storage_staff_insert on storage.objects;
create policy ares_storage_staff_insert
on storage.objects for insert to authenticated
with check (
    bucket_id in ('ares-documenti', 'galleria-lavori')
    and public.is_ares_staff()
);

drop policy if exists ares_storage_staff_update on storage.objects;
create policy ares_storage_staff_update
on storage.objects for update to authenticated
using (bucket_id in ('ares-documenti', 'galleria-lavori') and public.is_ares_staff())
with check (bucket_id in ('ares-documenti', 'galleria-lavori') and public.is_ares_staff());

drop policy if exists ares_storage_staff_delete on storage.objects;
create policy ares_storage_staff_delete
on storage.objects for delete to authenticated
using (bucket_id in ('ares-documenti', 'galleria-lavori') and public.is_ares_staff());

commit;
