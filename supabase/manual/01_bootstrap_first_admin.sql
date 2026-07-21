-- Eseguire una sola volta nel Supabase SQL Editor dopo aver creato l'account Auth.
-- Sostituire l'indirizzo di esempio prima di avviare lo script.

do $$
declare
    admin_email constant text := 'SOSTITUISCI_CON_EMAIL_ADMIN';
    changed_rows integer;
begin
    if admin_email = 'SOSTITUISCI_CON_EMAIL_ADMIN' then
        raise exception 'Prima sostituisci SOSTITUISCI_CON_EMAIL_ADMIN con la vera email dell amministratore';
    end if;

    update public.ares_profiles
       set role = 'super_admin', active = true, updated_at = now()
     where lower(email) = lower(admin_email);

    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
        raise exception 'Profilo non trovato oppure email non univoca: %', admin_email;
    end if;
end;
$$;
