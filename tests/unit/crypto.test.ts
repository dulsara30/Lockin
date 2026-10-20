import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';

describe('AES-256-GCM Crypto Helper', () => {
  const testSecret = '0123456789abcdef0123456789abcdef';

  it('encrypts and successfully decrypts text', () => {
    const raw = 'AIzaSyA_my_secret_gemini_api_key_123';
    const encrypted = encrypt(raw, testSecret);

    expect(encrypted).not.toBe(raw);
    expect(encrypted.split(':').length).toBe(3); // iv:tag:cipher

    const decrypted = decrypt(encrypted, testSecret);
    expect(decrypted).toBe(raw);
  });

  it('fails decryption with an invalid or incorrect secret', () => {
    const raw = 'top-secret-token';
    const encrypted = encrypt(raw, testSecret);

    const wrongSecret = 'fedcba9876543210fedcba9876543210';
    expect(() => decrypt(encrypted, wrongSecret)).toThrow();
  });

  it('fails decryption if ciphertext payload is malformed', () => {
    expect(() => decrypt('malformed-payload', testSecret)).toThrow();
  });
});
