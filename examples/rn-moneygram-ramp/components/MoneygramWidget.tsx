/**
 * MoneygramWidget — MoneyGram xRamps off-ramp (Solana / USDC)
 *
 * Flow:
 *  1. On mount, POST to EXPO_PUBLIC_SESSION_URL (your proxy server) to get
 *     { sessionToken, sessionId, widgetUrl } — the server holds the secret key.
 *  2. Load widgetUrl in a WebView.
 *  3. On RAMPS_READY, send RAMPS_CONFIG with the sessionToken.
 *  4. Handle balance checks, Solana signing, and lifecycle events.
 *
 * Per the integration guide, the widget origin is playground.xramps.moneygram.com.
 * All messages TO the widget use injectJavaScript + dispatchEvent.
 * All messages FROM the widget arrive via the onMessage prop.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';
import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import { dynamicClient } from '@/lib/dynamic';
import { CHAINS } from '@/lib/chains';

// Sandbox widget domain — update WIDGET_ORIGIN to the production domain for prod
const WIDGET_ORIGIN    = 'https://playground.xramps.moneygram.com';
const RAMPS_API_BASE   = process.env.EXPO_PUBLIC_RAMPS_API_URL ?? `${WIDGET_ORIGIN}/api`;
const SESSION_URL      = process.env.EXPO_PUBLIC_SESSION_URL ?? 'http://localhost:3001/api/moneygram-session';
const SOLANA_RPC       = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const USDC_MINT        = process.env.EXPO_PUBLIC_SOLANA_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

interface Session {
  sessionToken: string;
  sessionId:    string;
  widgetUrl:    string;
}

async function fetchSession(): Promise<Session> {
  const res = await fetch(SESSION_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Session creation failed: HTTP ${res.status}`);
  return res.json();
}

export interface MoneygramWidgetProps {
  open:              boolean;
  walletAddress:     string;   // Solana address
  usdcBalance:       number;   // current USDC balance (fetched by parent)
  onClose:           () => void;
  onSuccess?:        (amount: string) => void;
}

export function MoneygramWidget({
  open,
  walletAddress,
  usdcBalance,
  onClose,
  onSuccess,
}: MoneygramWidgetProps) {
  const webViewRef       = useRef<WebView>(null);
  const sessionRef       = useRef<Session | null>(null);
  const pendingAmountRef = useRef('');

  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [signing,   setSigning]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Fetch session each time the modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setWidgetUrl(null);
    sessionRef.current = null;

    fetchSession()
      .then((session) => {
        sessionRef.current = session;
        // Cache-bust so we always get fresh widget JS
        const url = new URL(session.widgetUrl);
        url.searchParams.set('_t', String(Date.now()));
        setWidgetUrl(url.toString());
        console.log('[MG Widget] Session created:', session.sessionId);
        console.log('[MG Widget] Widget URL:', url.toString());
      })
      .catch((err) => {
        console.error('[MG Widget] Session fetch failed:', err.message);
        setError(err.message);
        setLoading(false);
      });
  }, [open]);

  // ── Send a message INTO the WebView ────────────────────────────────────────
  // Base64-encode the payload so special characters can't break the JS context.
  function post(type: string, payload?: Record<string, unknown>) {
    const json    = JSON.stringify(payload ? { type, payload } : { type });
    const encoded = btoa(unescape(encodeURIComponent(json)));
    console.log('[MG Widget] → send', type, payload ?? '');
    webViewRef.current?.injectJavaScript(`
      (function() {
        var data = JSON.parse(decodeURIComponent(escape(atob('${encoded}'))));
        window.dispatchEvent(new MessageEvent('message', {
          data:   data,
          origin: window.location.origin,
        }));
      })();
      true;
    `);
  }

  // ── Handle messages FROM the WebView ───────────────────────────────────────
  async function handleMessage(event: WebViewMessageEvent) {
    // Validate source URL — reject messages not from the MoneyGram widget
    const sourceUrl = event.nativeEvent.url ?? '';
    if (!sourceUrl.startsWith(WIDGET_ORIGIN)) {
      console.warn('[MG Widget] Ignoring message from unexpected origin:', sourceUrl);
      return;
    }

    let parsed: { type?: string; payload?: Record<string, unknown> } & Record<string, unknown>;
    try { parsed = JSON.parse(event.nativeEvent.data); } catch { return; }
    const { type, payload } = parsed;

    // Network debug events from the fetch interceptor
    if (type === '__NET__') {
      const d = parsed as any;
      if (d.dir === '→') {
        console.log(`[MG Net] ${d.method} ${d.url}${d.body ? `\n  body: ${d.body}` : ''}`);
      } else if (d.dir === '←') {
        const logFn = d.status >= 400 ? console.error : console.log;
        logFn(`[MG Net] ${d.status} ${d.url}\n${d.body}`);
      } else {
        console.error(`[MG Net] FAIL ${d.url}: ${d.err}`);
      }
      return;
    }

    console.log('[MG Widget] ← recv', type, payload ?? '');

    switch (type) {
      // ── A. Widget ready — send config with sessionToken ─────────────────────
      case 'RAMPS_READY': {
        const session = sessionRef.current;
        if (!session) { console.error('[MG Widget] RAMPS_READY but no session'); break; }
        post('RAMPS_CONFIG', {
          sessionToken: session.sessionToken,
          wallet: {
            address:    walletAddress,
            chain:      'solana',
            asset:      'USDC',
            walletType: 'non-custodial',
          },
          devConfig: {
            mockMode:   false,
            apiBaseUrl: RAMPS_API_BASE,
          },
          theme: 'dark',
        });
        break;
      }

      // ── B. Balance check ────────────────────────────────────────────────────
      case 'RAMPS_CHECK_BALANCE':
        post('RAMPS_BALANCE_RESULT', {
          walletAddress,
          balance:    usdcBalance,
          asset:      'USDC',
          sufficient: usdcBalance >= ((payload?.amount as number) ?? 0),
        });
        break;

      // ── C. Sign and broadcast USDC transfer ─────────────────────────────────
      case 'RAMPS_SIGN_TRANSACTION': {
        const to     = payload?.to as string;
        const amount = payload?.amount as string;
        if (!to || !amount) {
          post('RAMPS_SIGN_ERROR', { error: 'Missing transaction parameters' });
          break;
        }
        pendingAmountRef.current = amount;

        // Sandbox: MoneyGram may return a placeholder address before the Solana
        // deposit wallet is provisioned for your agent ID. Stub it in dev mode.
        if (__DEV__) {
          const isPlaceholder = to.toLowerCase().includes('stub') || to.length < 32;
          if (isPlaceholder) {
            console.warn('[MG Widget] Placeholder address — bypassing signing in dev');
            post('RAMPS_SIGN_SUCCESS', { txHash: `SANDBOX_${Date.now()}`, walletAddress });
            break;
          }
        }

        setSigning(true);
        try {
          const txHash = await sendUsdcViaDynamic(walletAddress, to, amount);
          post('RAMPS_SIGN_SUCCESS', { txHash, walletAddress });
        } catch (err) {
          console.error('[MG Widget] Signing failed:', err);
          post('RAMPS_SIGN_ERROR', { error: (err as Error).message });
        } finally {
          setSigning(false);
        }
        break;
      }

      // ── D. Transaction complete — do NOT close; widget shows its own screen ──
      case 'RAMPS_TRANSACTION_COMPLETE': {
        const p = (payload ?? {}) as Record<string, unknown>;
        console.log('[MG Widget] Transaction complete — ref:', p.referenceNumber);
        onSuccess?.(pendingAmountRef.current || '0');
        // Don't close — widget shows completion screen; RAMPS_CLOSE fires on dismiss
        break;
      }

      case 'RAMPS_SIGN_ERROR':
        setSigning(false);
        break;

      case 'RAMPS_CLOSE':
        onClose();
        break;

      case 'RAMPS_OPEN_URL': {
        const url = String(payload?.url ?? '');
        if (url.startsWith('https://')) Linking.openURL(url);
        break;
      }
    }
  }

  if (!open) return null;

  if (error) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.overlay}>
          <Text style={styles.errorTitle}>Unable to load MoneyGram</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity onPress={onClose} style={styles.btn}>
            <Text style={styles.btnText}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Cash Pickup</Text>
            <Text style={styles.headerSub}>Solana · USDC</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Widget WebView — only render once widgetUrl is ready */}
        {widgetUrl && (
          <WebView
            ref={webViewRef}
            source={{ uri: widgetUrl }}
            style={styles.webview}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
            onError={(e: WebViewErrorEvent) => {
              console.error('[MG Widget] WebView error:', e.nativeEvent.code, e.nativeEvent.description);
              setError(`WebView error: ${e.nativeEvent.description}`);
              setLoading(false);
            }}
            onHttpError={(e: WebViewHttpErrorEvent) => {
              console.error('[MG Widget] HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.url);
            }}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // Override window.parent so widget's parent.postMessage reaches onMessage.
            // Also intercept fetch so every API call + response is logged in Metro.
            injectedJavaScriptBeforeContentLoaded={`
              (function() {
                var _rn = function(d) {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                    typeof d === 'string' ? d : JSON.stringify(d)
                  );
                };
                Object.defineProperty(window, 'parent', {
                  configurable: true,
                  get: function() { return { postMessage: _rn }; },
                });
                var _origPost = window.postMessage.bind(window);
                window.postMessage = function(data, origin) {
                  if (data && data.type && String(data.type).indexOf('RAMPS_') === 0) {
                    _rn(data);
                  }
                  _origPost(data, origin || '*');
                };
                // ── Fetch interceptor — logs every API call the widget makes ──
                var _origFetch = window.fetch.bind(window);
                window.fetch = function(url, opts) {
                  var method = (opts && opts.method) || 'GET';
                  var reqBody = (opts && opts.body) ? String(opts.body).slice(0, 400) : '';
                  _rn(JSON.stringify({ type: '__NET__', dir: '→', method: method, url: String(url), body: reqBody }));
                  return _origFetch(url, opts).then(function(res) {
                    var status = res.status;
                    res.clone().text().then(function(body) {
                      _rn(JSON.stringify({ type: '__NET__', dir: '←', status: status, url: String(url), body: body.slice(0, 600) }));
                    });
                    return res;
                  }).catch(function(err) {
                    _rn(JSON.stringify({ type: '__NET__', dir: '✗', url: String(url), err: String(err) }));
                    throw err;
                  });
                };
              })();
              true;
            `}
          />
        )}

        {/* Loading overlay — shown while session fetches + WebView loads */}
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#14b8a6" />
            <Text style={styles.loadingText}>Loading MoneyGram…</Text>
          </View>
        )}

        {/* Signing overlay — shown while broadcasting the Solana transaction */}
        {signing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#14b8a6" />
            <Text style={styles.loadingText}>Signing transaction…</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Solana USDC transfer via Dynamic ──────────────────────────────────────────
async function sendUsdcViaDynamic(
  fromAddress: string,
  to: string,
  amount: string,
): Promise<string> {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const mint       = new PublicKey(USDC_MINT);
  const fromKey    = new PublicKey(fromAddress);
  const toKey      = new PublicKey(to);
  const fromATA    = await getAssociatedTokenAddress(mint, fromKey);
  const toATA      = await getAssociatedTokenAddress(mint, toKey, true);

  // Precision-safe USDC amount (6 decimals, avoid float drift)
  const [whole, frac = ''] = amount.split('.');
  const lamports = BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, '0').slice(0, 6));

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(fromKey, toATA, toKey, mint));
  tx.add(createTransferInstruction(fromATA, toATA, fromKey, lamports));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = fromKey;

  // Sign via Dynamic's Solana extension
  const solanaExt = (dynamicClient as any).solana;
  if (!solanaExt) throw new Error('Solana extension not available on Dynamic client');

  const signedTx = await solanaExt.signTransaction({ transaction: tx });
  const sig = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  return sig;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#f9fafb' },
  headerSub:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText:   { color: '#f9fafb', fontSize: 14, fontWeight: '600' },
  webview:     { flex: 1, backgroundColor: '#030712' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#030712',
    gap: 12,
    zIndex: 10,
  },
  loadingText: { color: '#9ca3af', fontSize: 14 },
  errorTitle:  { color: '#f9fafb', fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  errorDetail: { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginBottom: 20, paddingHorizontal: 24 },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.3)',
  },
  btnText: { color: '#14b8a6', fontSize: 14, fontWeight: '600' },
});
