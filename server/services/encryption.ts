/**
 * Credentials storage service - Plaintext mode only
 * Stores credentials as plaintext JSON for simplicity and reliability
 */

/**
 * Store credentials in plaintext JSON format
 */
export function encryptCredentials(credentials: Record<string, any>): {
  encrypted_credentials: string;
  encryption_iv: string;
} {
  return {
    encrypted_credentials: JSON.stringify(credentials),
    encryption_iv: '', // no IV needed in plaintext mode
  };
}

/**
 * Read credentials from database as plaintext JSON
 */
export function decryptCredentials(
  encryptedCredentials: string,
  encryptionIv: string
): Record<string, any> {
  try {
    const parsed = JSON.parse(encryptedCredentials);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, any>;
    }
    throw new Error('Invalid credentials format: not a valid object');
  } catch (error) {
    throw new Error(`Failed to parse credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
