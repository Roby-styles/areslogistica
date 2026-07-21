-- Collega un account Auth a un cliente e al suo primo cantiere.
-- Sostituire tutti i valori SOSTITUISCI_* prima di eseguire.

do $$
declare
    target_email constant text := 'SOSTITUISCI_EMAIL_CLIENTE';
    target_code constant text := 'SOSTITUISCI_CODICE_CLIENTE';
    target_name constant text := 'SOSTITUISCI_NOME_CLIENTE';
    target_site constant text := 'SOSTITUISCI_NOME_CANTIERE';
    new_client_id uuid;
    new_site_id uuid;
    target_user_id uuid;
begin
    if target_email like 'SOSTITUISCI_%'
       or target_code like 'SOSTITUISCI_%'
       or target_name like 'SOSTITUISCI_%'
       or target_site like 'SOSTITUISCI_%' then
        raise exception 'Sostituisci prima tutti i valori SOSTITUISCI_*';
    end if;

    select id into target_user_id
    from public.ares_profiles
    where lower(email) = lower(target_email)
    limit 1;

    if target_user_id is null then
        raise exception 'Account Auth non trovato per: %', target_email;
    end if;

    insert into public.ares_clients (code, name, active)
    values (target_code, target_name, true)
    on conflict (code) do update
       set name = excluded.name, active = true, updated_at = now()
    returning id into new_client_id;

    insert into public.ares_sites (client_id, name, active)
    values (new_client_id, target_site, true)
    on conflict (client_id, name) do update
       set active = true, updated_at = now()
    returning id into new_site_id;

    update public.ares_profiles
       set role = 'cliente',
           client_id = new_client_id,
           default_site_id = new_site_id,
           active = true,
           updated_at = now()
     where id = target_user_id;

    insert into public.ares_memberships (user_id, client_id, site_id, membership_role)
    values (target_user_id, new_client_id, new_site_id, 'owner')
    on conflict (user_id, client_id, site_id) do update
       set membership_role = excluded.membership_role;
end;
$$;
