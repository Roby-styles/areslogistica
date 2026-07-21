# Supabase sicuro per ARES

Le modifiche sono volutamente divise in due migrazioni.

1. `001_prepare_auth_schema.sql` crea profili, clienti, cantieri e collegamenti senza interrompere la versione oggi online.
2. Si creano gli utenti in **Authentication > Users** e si promuove il primo amministratore con `manual/01_bootstrap_first_admin.sql`.
3. Per ogni cliente si esegue `manual/02_link_client_and_site.sql`, dopo aver sostituito email, codice cliente, nome cliente e nome cantiere.
4. Si collauda il ramo dell'app che usa Supabase Auth.
5. Solo quando il collaudo e concluso si esegue `002_enable_rls_cutover.sql` e si pubblica la nuova app nello stesso intervallo di manutenzione.

Non inserire password, service-role key o altri segreti in questi file. La chiave `anon` usata dal browser e pubblica per definizione; la sicurezza dipende da Auth e dalle policy RLS.

## Percorsi Storage

- documenti: `<client_uuid>/<Categoria>/<nome-file>`
- galleria: `<client_uuid>/<nome-file>`

I vecchi file organizzati per nome utente dovranno essere spostati nei nuovi percorsi prima del cutover. Al momento i bucket del progetto risultano vuoti, quindi non e prevista perdita di file.
