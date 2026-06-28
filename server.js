require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve il frontend (index.html e eventuali altri file statici)
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️  ATTENZIONE: variabile ANTHROPIC_API_KEY non impostata. Le richieste a /api/chat falliranno.');
}

// === Rate limiting semplice in memoria (per IP) ===
// Per produzione con più server/istanze, sostituire con Redis o simile.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 15; // max richieste per IP per finestra

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: { message: 'Troppe richieste. Riprova più tardi.' } });
  }
  next();
}

// Pulizia periodica della mappa rate limit per non crescere all'infinito
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 5) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// === Endpoint chat: proxy verso Anthropic ===
app.post('/api/chat', rateLimit, async (req, res) => {
  try {
    const { max_tokens, system, messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: 'messages mancante o non valido' } });
    }
    if (messages.length > 100) {
      return res.status(400).json({ error: { message: 'Troppi messaggi nella conversazione' } });
    }
    for (const m of messages) {
      if (typeof m?.content !== 'string' || m.content.length > 8000) {
        return res.status(400).json({ error: { message: 'Messaggio non valido o troppo lungo' } });
      }
    }

    const body = {
      model: ANTHROPIC_MODEL,
      max_tokens: typeof max_tokens === 'number' ? Math.min(max_tokens, 4096) : 300,
      messages,
    };
    if (system && typeof system === 'string') body.system = system;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);

  } catch (err) {
    console.error('Errore /api/chat:', err);
    return res.status(500).json({ error: { message: 'Errore interno del server' } });
  }
});

// === Endpoint log: salva (anonimizzato) il racconto generato ===
// Qui salviamo solo su console/file locale come esempio minimo.
// Per produzione vera, collegare un database (Postgres, MongoDB, ecc).
const fs = require('fs');
const LOG_FILE = path.join(__dirname, 'logs.jsonl');

app.post('/api/log', rateLimit, (req, res) => {
  try {
    const { data, trascrizione, risultato } = req.body || {};
    if (!data || !trascrizione || !risultato) {
      return res.status(400).json({ error: { message: 'Campi mancanti' } });
    }
    const entry = {
      data: String(data).slice(0, 100),
      trascrizione: String(trascrizione).slice(0, 20000),
      risultato: String(risultato).slice(0, 5000),
      receivedAt: new Date().toISOString(),
    };
    fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
      if (err) console.error('Errore scrittura log:', err);
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Errore /api/log:', err);
    res.status(500).json({ error: { message: 'Errore interno del server' } });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: !!ANTHROPIC_API_KEY, model: ANTHROPIC_MODEL });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server PerTe avviato su http://localhost:${PORT}`);
});
