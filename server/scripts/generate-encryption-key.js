#!/usr/bin/env node
/**
 * Generate a secure encryption key for credential storage
 * Run this once and add the output to your .env.local as ENCRYPTION_KEY
 */

import crypto from 'crypto';

const key = crypto.randomBytes(32).toString('hex');

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔑 Generated Encryption Key');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Add this to your .env.local file:');
console.log('');
console.log(`ENCRYPTION_KEY=${key}`);
console.log('');
console.log('⚠️  IMPORTANT:');
console.log('  - Keep this key secret and secure');
console.log('  - Never commit this to version control');
console.log('  - If you lose this key, you cannot decrypt existing credentials');
console.log('  - In production, use a secrets manager (AWS Secrets Manager, etc.)');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
