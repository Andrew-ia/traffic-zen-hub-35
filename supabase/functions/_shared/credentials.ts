import { defaultLogger, Logger } from './db.ts';

const AUTH_TAG_HEX_LENGTH = 32; // 16 bytes => 32 hex chars

function getEnvVariable(key: string): string | undefined {
  // Deno runtime (Edge Functions)
  if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Deno?.env?.get === 'function') {
    return (globalThis as any).Deno.env.get(key);
  }
  // Node.js runtime
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

async function decryptLegacyCredentials(
  encryptedHex: string,
  ivHex: string,
  logger: Logger,
): Promise<Record<string, any>> {
  const encryptionKey = getEnvVariable('ENCRYPTION_KEY');

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is required to decrypt legacy credentials');
  }

  if (encryptionKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte (64 hex chars) string');
  }

  let ciphertextHex = encryptedHex;
  let authTagHex: string | undefined;

  if (encryptedHex.includes(':')) {
    [ciphertextHex, authTagHex] = encryptedHex.split(':');
  } else if (encryptedHex.length > AUTH_TAG_HEX_LENGTH * 2) {
    authTagHex = encryptedHex.slice(-AUTH_TAG_HEX_LENGTH * 2);
    ciphertextHex = encryptedHex.slice(0, -AUTH_TAG_HEX_LENGTH * 2);
  }

  if (!authTagHex) {
    throw new Error('Invalid legacy credentials format (missing auth tag)');
  }

  if (!ivHex) {
    throw new Error('Legacy credentials missing encryption IV');
  }

  const keyBytes = hexToBytes(encryptionKey);
  const ivBytes = hexToBytes(ivHex);
  const ciphertextBytes = hexToBytes(ciphertextHex);
  const authTagBytes = hexToBytes(authTagHex);
  const payload = concatUint8Arrays(ciphertextBytes, authTagBytes);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    payload,
  );

  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded);
}

export async function readIntegrationCredentials(
  encryptedCredentials: string,
  encryptionIv: string | null,
  logger: Logger = defaultLogger,
): Promise<Record<string, any>> {
  try {
    const parsed = JSON.parse(encryptedCredentials);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Not plaintext JSON, fall through
  }

  return decryptLegacyCredentials(encryptedCredentials, encryptionIv ?? '', logger);
}
