# Iron Log — Tracker Allenamenti Palestra

App web (PWA) per registrare gli allenamenti in palestra, con login persistente
tramite Supabase e un report mensile con statistiche.

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → crea un nuovo progetto (gratuito).
2. Nel dashboard vai su **Project Settings → API** e copia:
   - **Project URL**
   - **anon public key**
3. Apri `js/config.js` in questo progetto e incolla i due valori:

```js
window.SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "eyJhbGciOi..."
};
```

## 2. Crea la tabella nel database

1. Nel dashboard Supabase vai su **SQL Editor**.
2. Apri il file `supabase-schema.sql` incluso in questo progetto, copia tutto
   il contenuto ed eseguilo. Crea la tabella `workouts` con le regole di
   sicurezza (RLS) che garantiscono che ogni utente veda solo i propri dati.

> **Nota sul checkbox "Automatically expose new tables":** dal 30 maggio
> 2026 Supabase lo disattiva di default sui nuovi progetti. Puoi lasciarlo
> **spento** (scelta consigliata, più sicura): lo script SQL sopra include
> già i `GRANT` necessari per la tabella `workouts`, quindi l'app funziona
> comunque. Se in futuro aggiungi altre tabelle, ricorda di aggiungere un
> `GRANT ... TO authenticated;` simile, oppure riattiva il checkbox per
> farlo automaticamente (ma questo esporrebbe anche le tabelle future per
> errore, se dimentichi di proteggerle con RLS).

## 3. Configura l'autenticazione

Per impostazione predefinita Supabase richiede la conferma email per i nuovi
account. Per test rapidi puoi disattivarla in **Authentication → Providers →
Email → "Confirm email"**. Per un'app in produzione ti consigliamo di
lasciarla attiva.

## 4. Pubblica l'app (hosting statico)

L'app è composta solo da file statici (HTML/CSS/JS), quindi puoi ospitarla
gratuitamente su uno di questi servizi (basta trascinare la cartella):

- **Netlify** → [app.netlify.com/drop](https://app.netlify.com/drop)
- **Vercel** → `vercel deploy` dalla cartella del progetto
- **GitHub Pages** → carica i file in un repository e attiva Pages

⚠️ **Importante:** la PWA (installazione su Chrome/Android, service worker)
funziona correttamente solo se l'app è servita tramite **HTTPS** (tutti i
servizi sopra lo garantiscono automaticamente). Aprendo `index.html`
direttamente da file locale, il login e l'installazione non funzioneranno.

Dopo aver pubblicato, in Supabase vai su **Authentication → URL
Configuration** e imposta l'URL del tuo sito come "Site URL" per far
funzionare correttamente eventuali link di conferma email.

## 5. Attiva il sistema PRO (365 giorni + attivazione admin)

1. Apri `supabase-schema-pro-upgrade.sql` e sostituisci **entrambe** le
   occorrenze di `ADMIN_EMAIL_HERE` con la tua email esatta (quella con cui
   accedi all'app), es. `'mario.rossi@gmail.com'`.
2. Esegui lo script nell'SQL Editor di Supabase (stesso procedimento usato
   per `supabase-schema.sql`). Crea la tabella `profiles`, un trigger che
   registra automaticamente la data di iscrizione di ogni utente, e due
   funzioni protette che solo tu puoi eseguire.
3. In `js/config.js` imposta `window.ADMIN_EMAIL` con la stessa email usata
   nello script SQL — serve solo a mostrarti il pannello admin nell'app;
   il controllo di sicurezza vero è lato server.
4. Ripubblica l'app. Da **Profilo**, se accedi con l'email admin, vedrai
   in fondo un pannello con l'elenco di tutti gli utenti registrati e un
   pulsante per attivare/disattivare il PRO su ciascuno.

Ogni utente diventa PRO automaticamente **365 giorni dopo la registrazione**
del proprio account, oppure prima se tu lo attivi manualmente dal pannello
admin. Per ora l'unica funzione riservata al PRO è l'export CSV del report
mensile (nella schermata Report) — puoi aggiungerne altre gating-ando altre
sezioni dell'app con `computeProStatus(state.profile).isPro`.

## 6. Aggiungi l'app alla schermata Home (Chrome)

- **Android**: apri il sito in Chrome → menu (⋮) → "Aggiungi a schermata
  Home" / "Installa app".
- **Desktop (Chrome)**: apri il sito → icona di installazione nella barra
  degli indirizzi (o menu ⋮ → "Installa Iron Log...").
- **iOS (Safari)**: apri il sito → pulsante Condividi → "Aggiungi a Home".

L'app si comporta come un'app nativa: si apre a schermo intero, senza barra
del browser, e resta collegata tra un accesso e l'altro grazie alla sessione
Supabase salvata sul dispositivo.

## Struttura del progetto

```
index.html              punto di ingresso, contiene tutte le schermate
css/style.css            stile dell'app
js/config.js              ⬅️ inserisci qui le tue credenziali Supabase
js/supabaseClient.js     inizializzazione client Supabase (sessione persistente)
js/stats.js               calcolo delle statistiche mensili
js/app.js                 logica dell'app: login, navigazione, CRUD, rendering
manifest.json             manifest PWA (icone, nome, colori)
service-worker.js         cache offline per l'app shell
icons/                     icone dell'app (standard + maskable)
supabase-schema.sql       schema SQL da eseguire su Supabase
```

## Funzionalità

- **Login/registrazione** email+password via Supabase Auth, sessione
  persistente (rimani collegato ad ogni visita).
- **Aggiunta allenamenti**: esercizio, categoria, serie, ripetizioni, peso,
  durata, note.
- **Storico** allenamenti raggruppato per giorno, con possibilità di
  eliminare una voce.
- **Dashboard** con statistiche rapide del mese in corso.
- **Report mensile** navigabile (mese precedente/successivo) con:
  - numero di allenamenti e giorni attivi
  - media allenamenti/settimana e confronto % col mese precedente
  - andamento settimanale (grafico a barre)
  - distribuzione per categoria muscolare
  - esercizio più frequente ed esercizio con maggior volume totale
  - minuti totali di attività cardio/a tempo
- **PWA**: installabile su Android/desktop/iOS, funziona offline per la
  parte di interfaccia (i dati richiedono comunque una connessione a
  Supabase).

## Personalizzare le categorie

Le categorie di allenamento (Petto, Schiena, Gambe, ecc.) e i loro colori
sono definiti in `js/stats.js`, nell'array `CATEGORIES` — modificale a
piacere.
