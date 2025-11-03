import crypto from 'crypto';

/**
 * Encryption service for securely storing sensitive credentials
 * Uses AES-256-GCM encryption algorithm
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variable
 * In production, this should be stored securely (e.g., AWS Secrets Manager, HashiCorp Vault)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Ensure the key is 32 bytes (256 bits) for AES-256
  if (key.length !== 64) { // 32 bytes = 64 hex characters
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypts data using AES-256-GCM
 * @param plaintext - The data to encrypt (will be JSON stringified)
 * @returns Object containing encrypted data, IV, and auth tag
 */
export function encrypt(plaintext: any): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintextString = typeof plaintext === 'string'
    ? plaintext
    : JSON.stringify(plaintext);

  let encrypted = cipher.update(plaintextString, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts data using AES-256-GCM
 * @param encrypted - The encrypted data (hex string)
 * @param iv - The initialization vector (hex string)
 * @param authTag - The authentication tag (hex string)
 * @returns The decrypted data (parsed as JSON if possible)
 */
export function decrypt(
  encrypted: string,
  iv: string,
  authTag: string
): any {
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  // Try to parse as JSON, if it fails return as string
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}

/**
 * Encrypts credentials in a format ready for database storage
 * Combines encrypted data, IV, and auth tag into a single string
 */
export function encryptCredentials(credentials: Record<string, any>): {
  encrypted_credentials: string;
  encryption_iv: string;
} {
  const { encrypted, iv, authTag } = encrypt(credentials);

  // Store encrypted data + auth tag together
  return {
    encrypted_credentials: `${encrypted}:${authTag}`,
    encryption_iv: iv,
  };
}

/**
 * Decrypts credentials from database format
 */
export function decryptCredentials(
  encryptedCredentials: string,
  encryptionIv: string
): Record<string, any> {
  let encrypted: string | undefined;
  let authTag: string | undefined;

  if (encryptedCredentials.includes(':')) {
    // New format stores ciphertext and auth tag separated by colon
    [encrypted, authTag] = encryptedCredentials.split(':');
  } else if (encryptedCredentials.length > AUTH_TAG_LENGTH * 2) {
    // Legacy format stores auth tag appended to ciphertext
    authTag = encryptedCredentials.slice(-AUTH_TAG_LENGTH * 2);
    encrypted = encryptedCredentials.slice(0, -AUTH_TAG_LENGTH * 2);
  }

  if (!encrypted || !authTag) {
    throw new Error('Invalid encrypted credentials format');
  }

  return decrypt(encrypted, encryptionIv, authTag);
}

/**
 * Generates a new encryption key (for initial setup)
 * Run this once and store the result securely
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
