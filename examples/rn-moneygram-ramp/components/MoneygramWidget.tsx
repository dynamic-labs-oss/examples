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
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import { dynamicClient } from '@/lib/dynamic';
import { type MgiRecord, saveRecord } from '@/lib/moneygram';

// Sandbox widget domain — update WIDGET_ORIGIN to the production domain for prod
const WIDGET_ORIGIN    = 'https://playground.xramps.moneygram.com';
const RAMPS_API_BASE   = process.env.EXPO_PUBLIC_RAMPS_API_URL ?? `${WIDGET_ORIGIN}/api`;
const SESSION_URL      = process.env.EXPO_PUBLIC_SESSION_URL ?? 'http://localhost:3001/api/moneygram-session';
const DEFAULT_USDC_MINT = process.env.EXPO_PUBLIC_SOLANA_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

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
  usdcMint?:         string;   // override mint for the active Solana network
  onClose:           () => void;
  onSuccess?:        (amount: string) => void;
  // View mode — reopen an existing transaction to show its current status,
  // pickup instructions, and refund option (if eligible). When set, the widget
  // is read-only: no balance check or signing happens.
  viewTransactionId?: string;
  // Fired once a completed transaction has been persisted locally.
  onTransactionSaved?: (record: MgiRecord) => void;
}

export function MoneygramWidget({
  open,
  walletAddress,
  usdcBalance,
  usdcMint,
  onClose,
  onSuccess,
  viewTransactionId,
  onTransactionSaved,
}: MoneygramWidgetProps) {
  const webViewRef       = useRef<WebView>(null);
  const sessionRef       = useRef<Session | null>(null);
  const pendingAmountRef = useRef('');

  const isViewMode = Boolean(viewTransactionId);

  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [signing,   setSigning]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

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
        // View mode: tell the widget which existing transaction to reopen.
        if (isViewMode && viewTransactionId) {
          url.searchParams.set('transactionId', viewTransactionId);
        }
        setWidgetUrl(url.toString());
        console.log('[MG Widget] Session created:', session.sessionId);
        console.log('[MG Widget] Widget URL:', url.toString());
      })
      .catch((err) => {
        console.error('[MG Widget] Session fetch failed:', err.message);
        setError(err.message);
        setLoading(false);
      });
  }, [open, isViewMode, viewTransactionId]);

  // Base64-encode payload so special characters can't break the JS context.
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

  async function handleMessage(event: WebViewMessageEvent) {
    const sourceUrl = event.nativeEvent.url ?? '';
    if (!sourceUrl.startsWith(WIDGET_ORIGIN)) {
      console.warn('[MG Widget] Ignoring message from unexpected origin:', sourceUrl);
      return;
    }

    let parsed: { type?: string; payload?: Record<string, unknown> } & Record<string, unknown>;
    try { parsed = JSON.parse(event.nativeEvent.data); } catch { return; }
    const { type, payload } = parsed;

    if (type === '__NET__') {
      const dir = String(parsed.dir);
      const url = String(parsed.url);
      if (dir === '→') {
        const body = parsed.body ? `\n  body: ${String(parsed.body)}` : '';
        console.log(`[MG Net] ${String(parsed.method)} ${url}${body}`);
      } else if (dir === '←') {
        const status = Number(parsed.status);
        // 500 on profiles/by-wallet is expected for new wallets — suppress it
        const isExpected = status === 500 && url.includes('/profiles/by-wallet/');
        const logFn = status >= 400 && !isExpected ? console.error : console.log;
        logFn(`[MG Net] ${status} ${url}\n${String(parsed.body ?? '')}`);
      } else {
        console.error(`[MG Net] FAIL ${url}: ${String(parsed.err)}`);
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
          // View mode: show status + pickup instructions + refund flow for an
          // existing transaction instead of starting a new off-ramp.
          ...(isViewMode && viewTransactionId
            ? { mode: 'view', transactionId: viewTransactionId }
            : {}),
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
          const txHash = await sendUsdcViaDynamic(walletAddress, to, amount, usdcMint);
          post('RAMPS_SIGN_SUCCESS', { txHash, walletAddress });
        } catch (err) {
          console.error('[MG Widget] Signing failed:', err);
          post('RAMPS_SIGN_ERROR', { error: err instanceof Error ? err.message : String(err) });
        } finally {
          setSigning(false);
        }
        break;
      }

      // ── D. Transaction complete — persist the record, then do NOT close ──────
      // The widget shows its own completion screen with the reference number;
      // RAMPS_CLOSE fires when the user dismisses it. We persist the record now
      // so it shows up in history and can be reopened in view mode later.
      case 'RAMPS_TRANSACTION_COMPLETE': {
        const p = (payload ?? {}) as Record<string, unknown>;
        console.log('[MG Widget] Transaction complete — ref:', p.referenceNumber);
        const record: MgiRecord = {
          id:              String(p.id ?? `mg-${Date.now()}`),
          referenceNumber: String(p.referenceNumber ?? ''),
          amount:          pendingAmountRef.current || '0',
          asset:           'USDC',
          createdAt:       Date.now(),
        };
        try {
          await saveRecord(record);
          onTransactionSaved?.(record);
        } catch (err) {
          console.error('[MG Widget] Failed to persist record:', err);
        }
        onSuccess?.(record.amount);
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
            <Text style={styles.headerTitle}>
              {isViewMode ? 'Transaction status' : 'Cash Pickup'}
            </Text>
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

        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#14b8a6" />
            <Text style={styles.loadingText}>Loading MoneyGram…</Text>
          </View>
        )}

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

async function sendUsdcViaDynamic(
  fromAddress: string,
  to: string,
  amount: string,
  usdcMint?: string,
): Promise<string> {
  const TAG = '[MG Sign]';
  console.log(TAG, 'start — from:', fromAddress, 'to:', to, 'amount:', amount, 'mint:', usdcMint ?? DEFAULT_USDC_MINT);

  const userWallets = dynamicClient.wallets.userWallets ?? [];
  const solanaWallet = userWallets.find(w => w.chain === 'SOL');
  if (!solanaWallet) throw new Error('No Solana wallet found');
  console.log(TAG, 'wallet found:', solanaWallet.id ?? solanaWallet.address);

  // getConnection() always reflects the network Dynamic is currently on
  const connection = dynamicClient.solana.getConnection();
  console.log(TAG, 'connection rpcEndpoint:', connection.rpcEndpoint);

  const mint    = new PublicKey(usdcMint ?? DEFAULT_USDC_MINT);
  const fromKey = new PublicKey(fromAddress);
  const toKey   = new PublicKey(to);
  const fromATA = await getAssociatedTokenAddress(mint, fromKey);
  const toATA   = await getAssociatedTokenAddress(mint, toKey, true);
  console.log(TAG, 'ATAs — from:', fromATA.toBase58(), 'to:', toATA.toBase58());

  // Precision-safe USDC amount (6 decimals, avoid float drift)
  const [whole, frac = ''] = amount.split('.');
  const lamports = BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, '0').slice(0, 6));
  console.log(TAG, 'lamports:', lamports.toString());

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  console.log(TAG, 'blockhash:', blockhash, 'lastValidBlockHeight:', lastValidBlockHeight);

  const messageV0 = new TransactionMessage({
    payerKey: fromKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      createAssociatedTokenAccountIdempotentInstruction(fromKey, toATA, toKey, mint),
      createTransferInstruction(fromATA, toATA, fromKey, lamports),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(messageV0);

  console.log(TAG, 'getting signer…');
  const signer = dynamicClient.solana.getSigner({ wallet: solanaWallet });
  console.log(TAG, 'calling signAndSendTransaction…');

  const signTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('signAndSendTransaction timed out after 30s')), 30_000),
  );
  const { signature: sig } = await Promise.race([
    signer.signAndSendTransaction(tx),
    signTimeout,
  ]);
  console.log(TAG, 'sent — sig:', sig);

  console.log(TAG, 'waiting for confirmation…');
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log(TAG, 'confirmed ✓');
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
