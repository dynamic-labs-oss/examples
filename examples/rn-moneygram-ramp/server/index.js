/**
 * MoneyGram xRamps — session proxy server
 *
 * The MoneyGram secret key must never live in the app binary.
 * This server holds the sk, calls MoneyGram's session API, and returns only
 * { sessionToken, sessionId, widgetUrl } to the React Native app.
 *
 * Run:  node index.js
 *       PORT=3001  MONEYGRAM_SK=ramps_sk_sbox_...  node index.js
 *
 * iOS Simulator  → app reaches this at http://localhost:3001
 * Physical device on same WiFi → set EXPO_PUBLIC_SESSION_URL to your LAN IP
 *   e.g. http://192.168.1.42:3001/api/moneygram-session
 */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

// ── Load .env (no dependencies needed) ──────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const SK   = process.env.MONEYGRAM_SK;
const PORT = parseInt(process.env.PORT || '3001', 10);

const MG_SESSION_URL = 'https://playground.xramps.moneygram.com/api/v1/sessions';

if (!SK) {
  console.error('[server] MONEYGRAM_SK is not set — edit server/.env');
  process.exit(1);
}

// ── Request handler ──────────────────────────────────────────────────────────
async function handleRequest(req, res) {
  // CORS — accept all origins for local dev (tighten for production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/moneygram-session') {
    try {
      const mgRes = await fetch(MG_SESSION_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SK },
        body:    JSON.stringify({}),
      });

      const data = await mgRes.json();

      if (!mgRes.ok) {
        console.error('[server] MoneyGram session API error:', mgRes.status, data);
        res.writeHead(mgRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }

      console.log('[server] Session created:', data.sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sessionToken: data.sessionToken,
        sessionId:    data.sessionId,
        widgetUrl:    data.widgetUrl,
      }));
    } catch (err) {
      console.error('[server] Unexpected error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
}

// ── Start ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('[server] Unhandled error:', err);
    res.writeHead(500);
    res.end();
  });
});

server.listen(PORT, () => {
  console.log(`\nMoneyGram session proxy listening on http://localhost:${PORT}`);
  console.log(`Session endpoint: POST http://localhost:${PORT}/api/moneygram-session\n`);
});
