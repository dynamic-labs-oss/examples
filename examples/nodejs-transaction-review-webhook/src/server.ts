import 'dotenv/config';

import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  timingSafeEqual,
} from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';

type Mode = 'allow' | 'deny' | 'slow' | 'crash';
const SUPPORTED_MODES: ReadonlyArray<Mode> = ['allow', 'deny', 'slow', 'crash'];

const PORT = Number(process.env.PORT ?? 4040);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '';

// Preferred in hosted/containerized deploys: pass the PEM directly as a
// base64-encoded env var so there's no key file on disk to mount or leak.
// Takes precedence over the file path below when set.
const PRIVATE_KEY_PEM_B64 = process.env.WEBHOOK_PRIVATE_KEY_PEM;

// If WEBHOOK_PRIVATE_KEY_PATH isn't set, fall back to ./private.pem when it
// exists. Most local dev setups run `npm run keygen` (which writes
// private.pem in cwd) and then expect signing to "just work" without a .env
// file. Set WEBHOOK_PRIVATE_KEY_PATH= explicitly (empty) to opt out.
const AUTO_KEY_PATH = './private.pem';
const PRIVATE_KEY_PATH = (() => {
  const fromEnv = process.env.WEBHOOK_PRIVATE_KEY_PATH;
  if (fromEnv !== undefined) return fromEnv;
  return existsSync(resolve(process.cwd(), AUTO_KEY_PATH)) ? AUTO_KEY_PATH : '';
})();
const PRIVATE_KEY_AUTO_DETECTED =
  process.env.WEBHOOK_PRIVATE_KEY_PATH === undefined && PRIVATE_KEY_PATH !== '';

const RAW_MODE = (process.env.MODE ?? 'allow').toLowerCase();
const IS_KNOWN_MODE = (SUPPORTED_MODES as readonly string[]).includes(RAW_MODE);
if (!IS_KNOWN_MODE) {
  console.warn(
    `[CONFIG] Unknown MODE="${RAW_MODE}" — expected one of ${SUPPORTED_MODES.join(
      ', ',
    )}. Falling back to "allow".`,
  );
}
const DEFAULT_MODE: Mode = IS_KNOWN_MODE ? (RAW_MODE as Mode) : 'allow';
const DENY_REASON = process.env.DENY_REASON ?? 'Denied by example webhook';
const SLOW_MS = Number(process.env.SLOW_MS ?? 10_000);
// Off by default: request bodies carry transaction data (wallet addresses,
// calldata, user IDs). Opt in with LOG_BODIES=true for local debugging only.
const LOG_BODIES = (process.env.LOG_BODIES ?? 'false').toLowerCase() === 'true';
const LOG_COLOR = (process.env.LOG_COLOR ?? 'true').toLowerCase() !== 'false';

const C = {
  bold: LOG_COLOR ? '\x1b[1m' : '',
  cyan: LOG_COLOR ? '\x1b[36m' : '',
  dim: LOG_COLOR ? '\x1b[2m' : '',
  gray: LOG_COLOR ? '\x1b[90m' : '',
  green: LOG_COLOR ? '\x1b[32m' : '',
  magenta: LOG_COLOR ? '\x1b[35m' : '',
  red: LOG_COLOR ? '\x1b[31m' : '',
  reset: LOG_COLOR ? '\x1b[0m' : '',
  yellow: LOG_COLOR ? '\x1b[33m' : '',
};

const HORIZ = '─'.repeat(72);

const privateKey = PRIVATE_KEY_PEM_B64
  ? (() => {
      try {
        return createPrivateKey(
          Buffer.from(PRIVATE_KEY_PEM_B64, 'base64').toString('utf8'),
        );
      } catch {
        console.error(
          `${C.red}WEBHOOK_PRIVATE_KEY_PEM is set but is not a valid base64-encoded PEM private key.${C.reset}\nEncode with: base64 -w0 private.pem`,
        );
        process.exit(1);
      }
    })()
  : PRIVATE_KEY_PATH
  ? (() => {
      const abs = resolve(process.cwd(), PRIVATE_KEY_PATH);
      if (!existsSync(abs)) {
        console.error(
          `${C.red}WEBHOOK_PRIVATE_KEY_PATH=${PRIVATE_KEY_PATH} does not exist (resolved to ${abs}).${C.reset}\nRun \`npm run keygen\` first, or unset WEBHOOK_PRIVATE_KEY_PATH to send unsigned responses.`,
        );
        process.exit(1);
      }
      return createPrivateKey(readFileSync(abs, 'utf8'));
    })()
  : null;

// Derive the matching public key from the loaded private key so we can show
// it to the operator on startup. The dashboard config's Response Verification
// Key MUST match this exactly, or signature verification will fail.
const publicKeyPem = privateKey
  ? (createPublicKey(privateKey)
      .export({ format: 'pem', type: 'spki' })
      .toString('utf8')
      .trim() as string)
  : '';

const isMode = (value: unknown): value is Mode =>
  typeof value === 'string' && SUPPORTED_MODES.includes(value as Mode);

const resolveMode = (req: Request): { mode: Mode; source: 'query' | 'env' } => {
  const fromQuery = req.query.mode;
  if (isMode(fromQuery)) return { mode: fromQuery, source: 'query' };
  return { mode: DEFAULT_MODE, source: 'env' };
};

const redact = (value: string): string => {
  if (!value) return '<unset>';
  if (value.length <= 6) return `${value[0]}***`;
  return `${value.slice(0, 3)}…${value.slice(-3)} (${value.length} chars)`;
};

type SignatureResult = 'ok' | 'mismatch' | 'missing' | 'skipped';

const verifyRequestSignature = (
  req: Request,
  rawBody: Buffer,
): { result: SignatureResult; expected?: string; received?: string } => {
  if (!WEBHOOK_SECRET) return { result: 'skipped' };

  const received = req.header('x-dynamic-signature');
  if (!received) return { result: 'missing' };

  const expected = createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(received, 'hex');

  if (
    expectedBuf.length !== receivedBuf.length ||
    !timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    return { expected, received, result: 'mismatch' };
  }
  return { expected, received, result: 'ok' };
};

const writeSignedJson = (
  res: Response,
  body: Record<string, unknown>,
  status = 200,
): { signed: boolean; signature?: string; bodyBytes: number } => {
  const json = JSON.stringify(body);
  let signed = false;
  let signatureB64: string | undefined;
  if (privateKey) {
    const signature = cryptoSign(null, Buffer.from(json, 'utf8'), privateKey);
    signatureB64 = signature.toString('base64');
    res.setHeader('x-dynamic-response-signature', signatureB64);
    signed = true;
  }
  res.status(status).setHeader('Content-Type', 'application/json').send(json);
  return {
    bodyBytes: Buffer.byteLength(json, 'utf8'),
    signature: signatureB64,
    signed,
  };
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const formatJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
  } catch {
    return `  <unprintable: ${typeof value}>`;
  }
};

const pickKnownFields = (
  payload: Record<string, unknown> | null,
): Record<string, unknown> => {
  if (!payload) return {};
  const fields: Record<string, unknown> = {};
  // Order chosen so the most useful at-a-glance fields print first.
  for (const key of [
    'requestId',
    'timestamp',
    'chain',
    'chainId',
    'operation',
    'walletAddress',
    'origin',
    'environmentId',
    'projectId',
    'walletId',
    'userId',
    'shareSetType',
    'message',
  ]) {
    if (key in payload) fields[key] = payload[key];
  }
  if (
    payload.context &&
    typeof payload.context === 'object' &&
    payload.context !== null
  ) {
    fields.contextKeys = Object.keys(
      payload.context as Record<string, unknown>,
    );
  }
  return fields;
};

type Decision = {
  body: Record<string, unknown>;
  status: number;
};

const buildDecision = (mode: Mode): Decision | null => {
  switch (mode) {
    case 'allow':
      return { body: { proceed: true }, status: 200 };
    case 'deny':
      return {
        body: { proceed: false, reason: DENY_REASON },
        status: 200,
      };
    case 'slow':
      return { body: { proceed: true }, status: 200 };
    case 'crash':
      return null;
    default:
      return { body: { proceed: true }, status: 200 };
  }
};

const signatureStatusColor = (result: SignatureResult): string => {
  if (result === 'ok') return C.green;
  if (result === 'skipped') return C.gray;
  return C.red;
};

let requestCounter = 0;

const app = express();
app.disable('x-powered-by');

// Health is a liveness probe only — keep it minimal. The security posture
// (HMAC / signing / mode) is printed to the operator's console on startup, so
// there's no need to expose it over an unauthenticated HTTP endpoint.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});

// Express 4 does not catch rejected promises from async route handlers, so an
// unhandled rejection (e.g. writeSignedJson throwing after the client hung up
// during `slow` mode) would crash the process. This wrapper funnels rejections
// into the error middleware below.
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

// Minimal dependency-free fixed-window rate limiter for the webhook endpoint.
// It's a defence-in-depth nicety for a local reference server, so the default
// ceiling is deliberately generous — high enough that normal dashboard "Send
// test" usage never trips it, low enough to blunt an accidental flood / DoS.
// Tune with RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 600);
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const rateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const now = Date.now();
  const key = req.ip ?? 'unknown';
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    next();
    return;
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    res.setHeader(
      'Retry-After',
      String(Math.ceil((bucket.resetAt - now) / 1000)),
    );
    res.status(429).json({ proceed: false, reason: 'Too many requests' });
    return;
  }

  next();
};

app.post(
  '/webhook',
  rateLimit,
  express.raw({ limit: '1mb', type: 'application/json' }),
  asyncHandler(async (req, res) => {
    requestCounter += 1;
    const requestNo = requestCounter;
    const receivedAt = new Date();
    const start = Date.now();

    // express.raw only populates req.body (as a Buffer) for requests whose
    // Content-Type matches application/json; any other or missing type leaves
    // it unset, which would throw a TypeError deeper in the handler. Reject
    // cleanly with a 415 instead.
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      res.status(415).json({
        proceed: false,
        reason: 'Expected Content-Type: application/json',
      });
      return;
    }

    const signature = verifyRequestSignature(req, rawBody);
    const { mode, source: modeSource } = resolveMode(req);

    const payload: Record<string, unknown> | null = (() => {
      try {
        const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
        // Minimal shape guard — the handler only understands a JSON object. A
        // production webhook should enforce a strict schema here (e.g. zod)
        // before touching any field.
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          return null;
        }
        return parsed as Record<string, unknown>;
      } catch {
        return null;
      }
    })();

    // ── Request header ──────────────────────────────────────────────
    console.log('');
    console.log(`${C.dim}${HORIZ}${C.reset}`);
    console.log(
      `${C.bold}${C.cyan}▶ Request #${requestNo}${C.reset}  ${
        C.gray
      }${receivedAt.toISOString()}${C.reset}`,
    );
    console.log(
      `  ${C.gray}from${C.reset} ${
        req.ip ?? req.socket.remoteAddress ?? 'unknown'
      }  ${C.gray}ua${C.reset} ${req.header('user-agent') ?? '<none>'}`,
    );
    console.log(
      `  ${C.gray}body${C.reset} ${rawBody.length} bytes  ${
        C.gray
      }content-type${C.reset} ${req.header('content-type') ?? '<none>'}`,
    );

    // ── Signature ───────────────────────────────────────────────────
    const sigColor = signatureStatusColor(signature.result);
    console.log(
      `  ${C.gray}signature${C.reset} ${sigColor}${signature.result}${C.reset}` +
        (signature.received
          ? `  ${C.gray}received${C.reset} ${signature.received.slice(0, 12)}…`
          : '') +
        (signature.expected && signature.result === 'mismatch'
          ? `  ${C.gray}expected${C.reset} ${signature.expected.slice(0, 12)}…`
          : ''),
    );

    // ── Mode ────────────────────────────────────────────────────────
    console.log(
      `  ${C.gray}mode${C.reset} ${C.bold}${mode}${C.reset} ${C.gray}(${modeSource})${C.reset}`,
    );

    // ── Payload ─────────────────────────────────────────────────────
    if (payload) {
      const known = pickKnownFields(payload);
      const knownEntries = Object.entries(known);
      if (knownEntries.length > 0) {
        const summary = knownEntries
          .map(([k, v]) => `${C.gray}${k}${C.reset}=${JSON.stringify(v)}`)
          .join('  ');
        console.log(`  ${summary}`);
      }
      if (LOG_BODIES) {
        console.log(`${C.gray}  body:${C.reset}`);
        console.log(`${C.dim}${formatJson(payload)}${C.reset}`);
      }
    } else {
      console.log(`  ${C.red}body: <unparseable JSON>${C.reset}`);
    }

    // ── Short-circuit on bad signature ──────────────────────────────
    if (signature.result === 'mismatch' || signature.result === 'missing') {
      const { signed } = writeSignedJson(
        res,
        { proceed: false, reason: 'Invalid signature' },
        401,
      );
      console.log(
        `${C.red}◀ Response${C.reset}  HTTP 401  ${C.gray}signed${
          C.reset
        } ${signed}  ${C.gray}elapsed${C.reset} ${Date.now() - start}ms`,
      );
      console.log(
        `${C.dim}  body: {"proceed":false,"reason":"Invalid signature"}${C.reset}`,
      );
      return;
    }

    const decision = buildDecision(mode);

    // ── Crash mode ──────────────────────────────────────────────────
    if (!decision) {
      console.log(
        `${C.red}◀ Response${C.reset}  ${C.bold}TCP destroyed${C.reset}  ${
          C.gray
        }elapsed${C.reset} ${Date.now() - start}ms`,
      );
      req.socket.destroy();
      return;
    }

    // ── Slow mode (sleep before responding) ─────────────────────────
    if (mode === 'slow') {
      console.log(
        `  ${C.yellow}sleeping ${SLOW_MS}ms before responding…${C.reset}`,
      );
      await sleep(SLOW_MS);
    }

    // ── Decision ────────────────────────────────────────────────────
    const {
      signed,
      signature: responseSignature,
      bodyBytes,
    } = writeSignedJson(res, decision.body, decision.status);
    const decisionColor = decision.body.proceed ? C.green : C.red;
    console.log(
      `${decisionColor}◀ Response${C.reset}  HTTP ${decision.status}  ${C.gray}proceed${C.reset} ${decisionColor}${decision.body.proceed}${C.reset}` +
        (decision.body.reason
          ? `  ${C.gray}reason${C.reset} ${JSON.stringify(
              decision.body.reason,
            )}`
          : '') +
        `  ${C.gray}signed${C.reset} ${
          signed ? `${C.green}yes${C.reset}` : `${C.gray}no${C.reset}`
        }` +
        `  ${C.gray}body${C.reset} ${bodyBytes}b` +
        `  ${C.gray}elapsed${C.reset} ${Date.now() - start}ms`,
    );
    if (responseSignature) {
      console.log(
        `  ${C.gray}x-dynamic-response-signature${C.reset} ${responseSignature}`,
      );
    }
    if (LOG_BODIES) {
      console.log(`${C.dim}${formatJson(decision.body)}${C.reset}`);
    }
  }),
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Bound + strip control chars from the message so a crafted error can't
  // flood or inject escape sequences into log aggregation.
  const safeMessage = String(err.message ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .slice(0, 200);
  console.error(
    `${C.red}${C.bold}✗ Unhandled error in webhook handler:${C.reset} ${safeMessage}`,
  );
  try {
    if (!res.headersSent) {
      res.status(500).json({ proceed: false, reason: 'Internal error' });
    } else {
      res.end();
    }
  } catch {
    // Connection already torn down (e.g. crash/slow-mode socket destroy) —
    // nothing more we can safely write.
  }
});

const server = app.listen(PORT, () => {
  console.log('');
  console.log(`${C.bold}${C.cyan}${HORIZ}${C.reset}`);
  console.log(
    `${C.bold}${C.cyan}  Transaction Review example webhook${C.reset}`,
  );
  console.log(`${C.bold}${C.cyan}${HORIZ}${C.reset}`);
  console.log(
    `  ${C.gray}endpoint${C.reset}              POST http://localhost:${PORT}/webhook`,
  );
  console.log(
    `  ${C.gray}health${C.reset}                GET  http://localhost:${PORT}/health`,
  );
  console.log(
    `  ${C.gray}default mode${C.reset}          ${C.bold}${DEFAULT_MODE}${C.reset}`,
  );
  console.log(
    `  ${C.gray}HMAC verify${C.reset}           ${
      WEBHOOK_SECRET ? `${C.green}on${C.reset}` : `${C.yellow}off${C.reset}`
    } ${C.gray}secret=${redact(WEBHOOK_SECRET)}${C.reset}`,
  );
  let keyLabel = PRIVATE_KEY_PATH || '<unset>';
  if (PRIVATE_KEY_AUTO_DETECTED) {
    keyLabel += ' (auto-detected)';
  }
  if (PRIVATE_KEY_PEM_B64) {
    keyLabel = '<env:WEBHOOK_PRIVATE_KEY_PEM>';
  }
  console.log(
    `  ${C.gray}Response signing${C.reset}      ${
      privateKey ? `${C.green}on${C.reset}` : `${C.yellow}off${C.reset}`
    } ${C.gray}key=${keyLabel}${C.reset}`,
  );
  console.log(`  ${C.gray}slow mode sleep${C.reset}       ${SLOW_MS}ms`);
  console.log(
    `  ${C.gray}deny reason${C.reset}           ${JSON.stringify(DENY_REASON)}`,
  );
  console.log(`  ${C.gray}log bodies${C.reset}            ${LOG_BODIES}`);
  console.log('');

  if (publicKeyPem) {
    console.log(
      `${C.bold}${C.cyan}  Public key${C.reset} ${C.gray}(paste into dashboard → Response Verification Key)${C.reset}`,
    );
    publicKeyPem.split('\n').forEach((line) => {
      console.log(`  ${C.green}${line}${C.reset}`);
    });
    console.log('');
  }

  console.log(`${C.gray}  Override per-request:${C.reset}`);
  console.log(
    `  ${C.dim}?mode=allow|deny|slow|crash  → switch decision mode${C.reset}`,
  );
  console.log('');
  console.log(`${C.gray}  Env knobs:${C.reset}`);
  console.log(
    `  ${C.dim}LOG_BODIES=true    → log request/response bodies (off by default)${C.reset}`,
  );
  console.log(`  ${C.dim}LOG_COLOR=false    → disable ANSI colors${C.reset}`);
  console.log(
    `  ${C.dim}RATE_LIMIT_MAX=600 → max /webhook requests per RATE_LIMIT_WINDOW_MS per IP${C.reset}`,
  );
  console.log('');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(
      `${C.red}${C.bold}✗ Port ${PORT} is already in use.${C.reset}`,
    );
    console.error(
      `${C.gray}  Likely a stale instance of this server. Find and kill it:${C.reset}`,
    );
    console.error(`${C.dim}    lsof -nP -iTCP:${PORT} -sTCP:LISTEN${C.reset}`);
    console.error(`${C.dim}    kill <PID>${C.reset}`);
    console.error('');
    console.error(
      `${C.gray}  Or run on a different port:${C.reset} ${C.dim}PORT=4041 npm run dev${C.reset}`,
    );
    console.error('');
    process.exit(1);
  }
  throw err;
});
