# PerTe — Guida completa: test locale e deploy online

## 📦 Cosa contiene questa cartella

```
perte-app/
├── public/
│   └── index.html      ← il frontend (interfaccia che vede l'utente)
├── server.js            ← il backend (proxy sicuro verso l'API Claude)
├── package.json          ← dipendenze
├── .env.example          ← modello per la tua chiave API
├── .gitignore
└── COME_AVVIARE.md       ← questo file
```

**Funzionalità incluse in questa versione:**
- ✅ Bug del flag regex duplicato corretto (`/i/i` → `/i`)
- ✅ 8 lingue: Italiano, Inglese, Spagnolo, Francese, Russo, Portoghese, Tedesco, Romeno
- ✅ Selettore lingua anche nella schermata iniziale (traduce tutta la home)
- ✅ Le risposte di Claude (chat + lettera finale) seguono la lingua selezionata
- ✅ Email finta rimossa dall'informativa privacy
- ✅ Backend con rate limiting, validazione input, logging su file
- ✅ Chiave API protetta sul server, mai esposta al browser

---

## 🖥️ PARTE 1 — Testare sul tuo PC

### Requisiti
- **Node.js** versione 18 o superiore. Se non l'hai: https://nodejs.org (scarica la versione "LTS")

### Passi

1. Estrai/copia questa cartella `perte-app` dove vuoi sul tuo PC

2. Apri il terminale (su Windows: PowerShell o Prompt dei comandi) dentro la cartella

3. Installa le dipendenze:
   ```bash
   npm install
   ```

4. Crea il file con la tua chiave API:
   - Copia `.env.example` e rinominalo in `.env`
   - Apri `.env` con un editor di testo e sostituisci `sk-ant-xxxx...` con la tua vera chiave Anthropic
   - La trovi qui: https://console.anthropic.com/settings/keys (devi avere un account Anthropic con credito)

5. Avvia il server:
   ```bash
   npm start
   ```
   Deve apparire: `✅ Server PerTe avviato su http://localhost:3000`

6. Apri il browser su:
   ```
   http://localhost:3000
   ```

7. Verifica che la chiave sia letta correttamente visitando:
   ```
   http://localhost:3000/api/health
   ```
   Deve rispondere `{"ok":true,"hasApiKey":true,...}`

### ⚠️ Errori comuni
- **"npm: comando non trovato"** → Node.js non è installato, scaricalo dal link sopra
- **`hasApiKey:false`** → il file `.env` non è stato creato/compilato correttamente, o non è nella cartella giusta (deve stare nella stessa cartella di `server.js`)
- **Pagina bianca o non si carica** → controlla che il terminale mostri il server avviato senza errori

---

## 🌐 PARTE 2 — Metterlo online (deploy)

Hai bisogno di un servizio che faccia girare codice Node.js 24/7. Ecco le opzioni più semplici, dalla più facile:

### Opzione A — Render.com (gratuito per iniziare, consigliato)

1. Crea un account su https://render.com
2. Carica questo progetto su GitHub (vedi sotto "Come caricare su GitHub" se non l'hai mai fatto)
3. Su Render: **New + → Web Service**
4. Collega il tuo repository GitHub
5. Impostazioni:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. In **Environment Variables**, aggiungi:
   - `ANTHROPIC_API_KEY` = la tua chiave vera
7. Clicca **Create Web Service**
8. Dopo qualche minuto avrai un indirizzo tipo `https://perte-app.onrender.com` — funzionante da qualsiasi telefono o computer, ovunque

### Opzione B — Railway.app

Stessa logica di Render:
1. Account su https://railway.app
2. **New Project → Deploy from GitHub repo**
3. Aggiungi la variabile d'ambiente `ANTHROPIC_API_KEY`
4. Railway rileva automaticamente che è un'app Node.js e la avvia

### Opzione C — Un VPS proprio (DigitalOcean, Hetzner, ecc.)

Se hai già un server Linux:
```bash
git clone <tuo-repository>
cd perte-app
npm install
echo "ANTHROPIC_API_KEY=sk-ant-xxxx" > .env
npm install -g pm2
pm2 start server.js --name perte
pm2 save
```
`pm2` mantiene il server attivo anche se chiudi la sessione SSH, e lo riavvia se va in crash.

Serve poi configurare un reverse proxy (nginx) con certificato HTTPS (es. via Certbot/Let's Encrypt) per avere un indirizzo `https://tuodominio.it` pulito.

---

## 📤 Come caricare su GitHub (se non l'hai mai fatto)

```bash
cd perte-app
git init
git add .
git commit -m "Prima versione PerTe"
```
Poi crea un repository vuoto su https://github.com/new, e segui le istruzioni che GitHub mostra per collegare la cartella locale (di solito 2-3 comandi `git remote add` e `git push`).

**Importante:** il file `.gitignore` incluso impedisce che `.env` (con la tua chiave segreta) venga caricato per errore su GitHub. Controlla sempre, prima del primo `git push`, che `.env` non compaia nell'elenco dei file con `git status`.

---

## 🔒 Checklist sicurezza prima di andare online davvero

- [ ] La chiave API è solo nel `.env` del server, mai nel codice di `index.html`
- [ ] `.env` non è su GitHub (verificato con `.gitignore`)
- [ ] HTTPS attivo (Render/Railway lo danno automaticamente; un VPS proprio richiede Certbot)
- [ ] Hai testato `/api/health` e risponde `hasApiKey:true`
- [ ] Hai provato la chat dal vivo almeno una volta dopo il deploy

---

## ❓ Problemi dopo il deploy

Se online la chat non risponde, controlla in ordine:
1. I log del servizio (Render/Railway hanno una sezione "Logs" nella dashboard) — cercano errori
2. La variabile `ANTHROPIC_API_KEY` è stata davvero salvata nelle Environment Variables del servizio (non solo nel tuo `.env` locale, che resta solo sul tuo PC)
3. Hai credito disponibile sul tuo account Anthropic (console.anthropic.com → Billing)
