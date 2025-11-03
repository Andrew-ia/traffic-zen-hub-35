import crypto from 'crypto';

/**
 * Credentials storage service
 * Simplified: stores plaintext JSON while keeping backward compatibility
 * with previously encrypted records (AES-256-GCM).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES IV length
const AUTH_TAG_LENGTH = 16; // 16 bytes = 32 hex chars

function getEncryptionKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    return null; // Optional for backward compatibility only
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
  return Buffer.from(key, 'hex');
}

// Kept for backward compatibility (encrypted records)
export function encrypt(plaintext: any): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('ENCRYPTION_KEY is required for encryption (backward compatibility mode)');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintextString = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  let encrypted = cipher.update(plaintextString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

// Kept for backward compatibility (encrypted records)
export function decrypt(encrypted: string, iv: string, authTag: string): any {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('ENCRYPTION_KEY is required for decryption (backward compatibility mode)');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

/**
 * Store credentials in plaintext JSON for simplicity.
 * This avoids encryption while remaining compatible with the existing schema.
 */
export function encryptCredentials(credentials: Record<string, any>): {
  encrypted_credentials: string;
  encryption_iv: string;
} {
  return {
    encrypted_credentials: JSON.stringify(credentials),
    encryption_iv: '', // no IV in plaintext mode
  };
}

/**
 * Read credentials from database.
 * - First try to parse as JSON (plaintext mode)
 * - If parsing fails, attempt legacy/encrypted formats
 */
export function decryptCredentials(
  encryptedCredentials: string,
  encryptionIv: string
): Record<string, any> {
  // 1) Try plaintext JSON
  try {
    const parsed = JSON.parse(encryptedCredentials);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, any>;
    }
  } catch {
    // Not plaintext JSON; continue to encrypted formats
  }

  // 2) Encrypted formats (ciphertext + auth tag)
  let encrypted: string | undefined;
  let authTag: string | undefined;

  if (encryptedCredentials.includes(':')) {
    [encrypted, authTag] = encryptedCredentials.split(':');
  } else if (encryptedCredentials.length > AUTH_TAG_LENGTH * 2) {
    authTag = encryptedCredentials.slice(-AUTH_TAG_LENGTH * 2);
    encrypted = encryptedCredentials.slice(0, -AUTH_TAG_LENGTH * 2);
  }

  if (!encrypted || !authTag) {
    throw new Error('Invalid credentials format: not JSON and missing auth tag');
  }

  if (!encryptionIv) {
    throw new Error('Missing encryption IV for encrypted credentials');
  }

  return decrypt(encrypted, encryptionIv, authTag);
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
