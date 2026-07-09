# ARES Logistica - Resoconto e Architettura del Progetto

## 📌 Scopo del Progetto
**ARES Logistica** è una web application (Single Page Application, eseguita principalmente lato client tramite HTML/JS locale) destinata alla gestione operativa, economica e logistica dell'azienda ARES. L'app funge da vero e proprio "ERP Master" con cruscotti e interfacce multiple.

## 🏗 Architettura e Struttura
L'applicazione è interamente contenuta e orchestrata in `index.html` (che fa da entry point per UI e logica) e si appoggia ad alcuni script/dati accessori.

### Componenti Principali:
1. **Preventivatore (Modulo Core)**: 
   - **Gestione Voci:** Calcolo in tempo reale di Margine, ROI, Subtotale Voci e Totale Fatturato tramite un "tachimetro" visivo.
   - **Spese e Costi Fissi:** Inserimento di costi legati a mezzi (Furgone), Manodopera, Attrezzature e personalizzate.
   - **Trasferte e Diarie:** Sezione calcolo chilometrico, pedaggi e diaria staff.
   - **Appalti Ricorrenti:** L'utente può specificare se un contratto è ricorrente per N mesi. Le singole spese (furgone, manodopera, custom, ecc.) possono essere contrassegnate con una spunta `[ ] /mese` per essere moltiplicate per la durata dell'appalto.
   - **Canvas Planimetrie:** Tool di disegno per layout e logistica cantieri.
   - **Salvataggio:** I preventivi vengono salvati in `localStorage` (`ares_preventivi`).

2. **Dossier / Cantieri (Modulo Operativo)**:
   - Dashboard per la gestione dei cantieri aperti.
   - Stato avanzamento lavori e fascicoli integrati.
   - Collegamento tramite l'API `File System Access` per associare cartelle reali su Windows al cantiere (Radar DB).

3. **Pannello Scadenze & HR**:
   - Gestione delle scadenze e notifiche (visibile nei widget della Home).

4. **Home Page & Dashboard (Widget)**:
   - Cruscotti riassuntivi per un rapido colpo d'occhio su preventivi aperti, meteo, stato cantieri.

## 💾 Gestione Dati (Storage)
Non essendoci un backend tradizionale, l'applicazione fa largo uso di:
- `localStorage`: Per salvare impostazioni (es. `ares-font-size`, zoom), Preventivi (`ares_preventivi`), Note e Task.
- `IndexedDB` (`ares_radar_db`): Per memorizzare i permessi persistenti alle cartelle locali in modo da poter accedere ai file PDF/DWG relativi ai singoli cantieri direttamente dal browser.

## 🚀 Ultime Implementazioni Rilevanti (Giugno 2026)
- **Logica "Ricorrente Avanzata"**: Il Preventivatore supporta contratti multimese. Modificata in profondità la funzione `recalculateTotals()` per applicare selettivamente il moltiplicatore temporale alle singole spese (grazie alle checkbox `/mese`).
- **Risoluzione conflitti JS**: Risolti errori legati a funzioni duplicate (es. `addCustomExpenseRow`) che interrompevano l'inizializzazione del DOM.
- **Raffinamento UI**: Aggiunti stili dark-mode, glassmorphism e focus visivo su campi essenziali (margine, ROI, tachimetro).

## 💡 Istruzioni per AI e Sviluppatori Futuri
- **Attenzione a `recalculateTotals()`**: È il cuore pulsante del Preventivatore. Qualsiasi nuovo input di costo deve scatenare questa funzione per aggiornare i totali.
- **Salvataggio Preventivi (`savePreventivo`)**: Utilizza un array dinamico di stringhe (`__FURGONE__:`, `__REC_FURGONE__:`) salvate nel campo `voci` del JSON per memorizzare i valori dei campi di input accessori. Assicurarsi di mappare correttamente il salvataggio e il recupero (`editPreventivo`) di qualsiasi nuovo input.
- **Niente Backend**: Qualsiasi integrazione futura che richiede condivisione cloud dovrà probabilmente interfacciarsi o con Firebase/Supabase, oppure esportare JSON tramite File System Access API.

---
*File di riepilogo generato automaticamente per mantenere un contesto chiaro tra le sessioni di sviluppo.*
