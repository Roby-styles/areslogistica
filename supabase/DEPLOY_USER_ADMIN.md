# Pubblicazione controllata: Gestione Utenti ARES

Questa procedura va eseguita soltanto dopo aver verificato la relativa pull request. L'ordine evita che il browser possa chiamare una funzione non ancora protetta.

## 1. Migrazione database

1. Aprire il progetto Supabase ARES.
2. Aprire **SQL Editor > New query**.
3. Copiare tutto `migrations/003_admin_user_management.sql`.
4. Premere **Run** una sola volta.
5. Il risultato atteso e `Success. No rows returned`.

La migrazione:

- crea `ares_admin_audit` con RLS;
- rende l'elenco completo dei profili leggibile soltanto dal Super Amministratore;
- non crea, modifica o elimina account esistenti.

## 2. Edge Function protetta

1. Aprire **Edge Functions** nel progetto Supabase.
2. Creare la funzione `ares-admin-users`.
3. Mantenere attiva la verifica JWT.
4. Usare il contenuto versionato di `functions/ares-admin-users/index.ts`.
5. Aggiungere soltanto questo segreto applicativo:

   ```text
   ARES_SITE_URL=https://roby-styles.github.io/areslogistica/
   ```

6. Distribuire la funzione.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` sono segreti predefiniti dell'ambiente Supabase ospitato. Non vanno copiati nel sito, nel repository o in una conversazione.

## 3. Collaudo prima della pubblicazione del sito

1. Aprire la versione locale del ramo.
2. Accedere con il Super Amministratore.
3. Aprire **Amministratore Super**.
4. Invitare un indirizzo email di prova non usato in precedenza.
5. Aprire l'email di invito in una finestra anonima.
6. Impostare una password di almeno 12 caratteri.
7. Verificare accesso, ruolo, cliente/cantiere e disattivazione.
8. Cancellare l'account di prova da Supabase soltanto al termine del collaudo.

## 4. Verifica database

```sql
select email, username, role, active, client_id, default_site_id
from public.ares_profiles
order by created_at desc;

select target_email, action, created_at
from public.ares_admin_audit
order by created_at desc
limit 20;
```

## Ripristino di emergenza

Prima di pubblicare la nuova pagina e sufficiente disabilitare o eliminare la Edge Function: il sito attuale non la usa. Non cancellare la tabella di audit se contiene gia operazioni reali.
