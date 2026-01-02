import crypto from 'crypto';

const DEFAULT_DEV_SECRET = 'dev-secret-change-me';

function getKeyFromSecret(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function getPrimarySecret(): string {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const secret = process.env.CREDENTIALS_SECRET || process.env.AUTH_SECRET || process.env.VITE_AUTH_SECRET || '';
  if (!secret && isProd) {
    throw new Error('CREDENTIALS_SECRET or AUTH_SECRET must be set in production');
  }
  return secret || DEFAULT_DEV_SECRET;
}

function getCandidateSecrets(): string[] {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const primary = process.env.CREDENTIALS_SECRET || process.env.AUTH_SECRET || process.env.VITE_AUTH_SECRET || '';
  const rotationRaw =
    process.env.CREDENTIALS_SECRET_PREVIOUS ||
    process.env.CREDENTIALS_SECRET_ROTATION ||
    process.env.CREDENTIALS_SECRET_FALLBACKS ||
    '';
  const rotation = rotationRaw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const secrets = [primary, ...rotation].filter(Boolean);

  if (!secrets.length) {
    if (isProd) {
      throw new Error('CREDENTIALS_SECRET or AUTH_SECRET must be set in production');
    }
    secrets.push(DEFAULT_DEV_SECRET);
  } else if (!isProd && !secrets.includes(DEFAULT_DEV_SECRET)) {
    secrets.push(DEFAULT_DEV_SECRET);
  }

  return Array.from(new Set(secrets));
}

export function encryptCredentials(credentials: Record<string, any>): {
  encrypted_credentials: string;
  encryption_iv: string;
} {
  const key = getKeyFromSecret(getPrimarySecret());
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([ciphertext, tag]).toString('base64');
  return {
    encrypted_credentials: payload,
    encryption_iv: iv.toString('base64'),
  };
}

export function decryptCredentials(encryptedCredentials: string, encryptionIv: string): Record<string, any> {
  const normalizedIv = String(encryptionIv || '').trim();
  if (!normalizedIv || normalizedIv === 'plain' || normalizedIv === 'none') {
    try {
      const parsed = JSON.parse(encryptedCredentials);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, any>;
    } catch (e) { void e; }
    throw new Error('Missing encryption_iv and payload is not valid JSON');
  }

  const secrets = getCandidateSecrets();
  let lastError: unknown = null;

  for (const secret of secrets) {
    try {
      const key = getKeyFromSecret(secret);
      const iv = Buffer.from(normalizedIv, 'base64');
      const data = Buffer.from(encryptedCredentials, 'base64');
      if (data.length < 17) throw new Error('Invalid encrypted payload');
      const tag = data.subarray(data.length - 16);
      const ciphertext = data.subarray(0, data.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      return JSON.parse(plaintext);
    } catch (error) {
      lastError = error;
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('Failed to decrypt credentials'));
}
