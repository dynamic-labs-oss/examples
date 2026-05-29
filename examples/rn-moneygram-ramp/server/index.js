/**
 * MoneyGram xRamps — session proxy server
 *
 * Holds the secret key server-side and returns only
 * { sessionToken, sessionId, widgetUrl } to the React Native app.
 *
 * Run:  node index.js
 *
 * iOS Simulator  → app reaches this at http://localhost:3001
 * Physical device → set EXPO_PUBLIC_SESSION_URL to your LAN IP
 *   e.g. http://192.168.1.42:3001/api/moneygram-session
 */
import 'dotenv/config';
import { createServer } from 'http';

const SK   = process.env.MONEYGRAM_SK;
const PORT = Number(process.env.PORT ?? 3001);

const MG_SESSION_URL = 'https://playground.xramps.moneygram.com/api/v1/sessions';

if (!SK) {
  console.error('[server] MONEYGRAM_SK is not set — edit server/.env');
  process.exit(1);
}

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/moneygram-session') {
    res.writeHead(404);
    res.end();
    return;
  }

  try {
    const mgRes = await fetch(MG_SESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': SK },
      body: JSON.stringify({}),
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
      sessionId: data.sessionId,
      widgetUrl: data.widgetUrl,
    }));
  } catch (err) {
    console.error('[server] Unexpected error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('[server] Unhandled error:', err);
    res.writeHead(500);
    res.end();
  });
}).listen(PORT, () => {
  console.log(`\nMoneyGram session proxy → http://localhost:${PORT}/api/moneygram-session\n`);
});
