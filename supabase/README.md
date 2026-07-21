# Supabase sicuro per ARES

Le modifiche iniziali sono state divise in due migrazioni; la gestione utenti usa una terza migrazione e una Edge Function versionata nel repository.

1. `001_prepare_auth_schema.sql` crea profili, clienti, cantieri e collegamenti senza interrompere la versione oggi online.
2. Si creano gli utenti in **Authentication > Users** e si promuove il primo amministratore con `manual/01_bootstrap_first_admin.sql`.
3. Per ogni cliente si esegue `manual/02_link_client_and_site.sql`, dopo aver sostituito email, codice cliente, nome cliente e nome cantiere.
4. Si collauda il ramo dell'app che usa Supabase Auth.
5. Solo quando il collaudo e concluso si esegue `002_enable_rls_cutover.sql` e si pubblica la nuova app nello stesso intervallo di manutenzione.
6. `003_admin_user_management.sql` aggiunge il registro protetto delle operazioni e limita la lettura dell'elenco profili al Super Amministratore.
7. `functions/ares-admin-users/index.ts` invia gli inviti e modifica lo stato degli account. Va distribuita come Edge Function `ares-admin-users` con verifica JWT attiva.

La Edge Function usa i segreti Supabase forniti dall'ambiente (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). La service-role key non deve mai essere copiata in `index.html`, in GitHub o nella configurazione del browser. Il valore opzionale `ARES_SITE_URL` deve essere:

```text
https://roby-styles.github.io/areslogistica/
```

Non inserire password, service-role key o altri segreti in questi file. La chiave `anon` usata dal browser e pubblica per definizione; la sicurezza dipende da Auth e dalle policy RLS.

## Percorsi Storage

- documenti: `<client_uuid>/<Categoria>/<nome-file>`
- galleria: `<client_uuid>/<nome-file>`

I vecchi file organizzati per nome utente devono essere spostati nei nuovi percorsi prima di modificare la struttura dei bucket. I bucket sono privati e le operazioni passano attraverso Auth e policy RLS.
