import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const privatePath = resolve(process.cwd(), 'private.pem');
const publicPath = resolve(process.cwd(), 'public.pem');

if (existsSync(privatePath) || existsSync(publicPath)) {
  console.error(
    `Refusing to overwrite existing key files at ${privatePath} / ${publicPath}.`,
  );
  console.error('Delete them first if you really want to regenerate.');
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const privatePem = privateKey.export({
  format: 'pem',
  type: 'pkcs8',
}) as string;
const publicPem = publicKey.export({ format: 'pem', type: 'spki' }) as string;

writeFileSync(privatePath, privatePem, { mode: 0o600 });
writeFileSync(publicPath, publicPem, { mode: 0o644 });

console.log(`Wrote ${privatePath}`);
console.log(`Wrote ${publicPath}`);
console.log('');
console.log('Paste the following into the Dynamic dashboard');
console.log('  -> Wallets -> Transaction Review');
console.log('  -> Response Verification Key:');
console.log('');
console.log(publicPem);
