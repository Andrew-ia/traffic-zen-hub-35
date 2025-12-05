import crypto from 'crypto';

function getKey(): Buffer {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const secret = process.env.CREDENTIALS_SECRET || process.env.AUTH_SECRET || process.env.VITE_AUTH_SECRET || '';
  if (!secret && isProd) {
    throw new Error('CREDENTIALS_SECRET or AUTH_SECRET must be set in production');
  }
  const material = secret || 'dev-secret-change-me';
  return crypto.createHash('sha256').update(material).digest();
}

export function encryptCredentials(credentials: Record<string, any>): {
  encrypted_credentials: string;
  encryption_iv: string;
} {
  const key = getKey();
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
  if (!encryptionIv) {
    try {
      const parsed = JSON.parse(encryptedCredentials);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, any>;
    } catch (e) { void e; }
    throw new Error('Missing encryption_iv and payload is not valid JSON');
  }

  const key = getKey();
  const iv = Buffer.from(encryptionIv, 'base64');
  const data = Buffer.from(encryptedCredentials, 'base64');
  if (data.length < 17) throw new Error('Invalid encrypted payload');
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}
