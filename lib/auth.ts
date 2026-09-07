/**
 * Cryptographic session token generation and verification using Web Crypto API (crypto.subtle).
 * Fully compatible with both Next.js Edge Middleware and Node.js Serverless runtimes.
 */

export interface SessionPayload {
  username: string;
  createdAt: number; // Unix timestamp in ms
  expiresAt: number; // Unix timestamp in ms
}

const DEFAULT_SECRET_FALLBACK = 'vimtech-dev-session-secret-change-in-prod';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * Resolves the active cryptographic secret key.
 */
function getActiveSecret(secret?: string): string {
  return (
    secret ||
    process.env.SESSION_SECRET ||
    process.env.LAB_ADMIN_PASSWORD ||
    DEFAULT_SECRET_FALLBACK
  );
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 * Operates without short-circuiting to ensure uniform execution time.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const aLen = a.length;
  const bLen = b.length;
  const maxLen = Math.max(aLen, bLen);

  let mismatch = aLen ^ bLen;
  for (let i = 0; i < maxLen; i++) {
    const charA = i < aLen ? a.charCodeAt(i) : 0;
    const charB = i < bLen ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

/**
 * Converts a UTF-8 string to base64 encoding using standard Web APIs.
 */
function stringToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string back to a UTF-8 string using standard Web APIs.
 */
function base64ToString(b64: string): string {
  let standardB64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (standardB64.length % 4 !== 0) {
    standardB64 += '=';
  }
  const binary = atob(standardB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Converts an ArrayBuffer to a lowercase hexadecimal string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Computes HMAC-SHA256 signature using the Web Crypto API (crypto.subtle).
 */
async function computeHmacSignature(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bufferToHex(signatureBuffer);
}

/**
 * Creates an HMAC-SHA256 signed session token formatted as `<base64Payload>.<hexSignature>`.
 */
export async function createSessionToken(username: string, secret?: string): Promise<string> {
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required to create session token');
  }

  const now = Date.now();
  const payload: SessionPayload = {
    username: username.trim(),
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };

  const payloadJson = JSON.stringify(payload);
  const base64Payload = stringToBase64(payloadJson);
  const activeSecret = getActiveSecret(secret);
  const hexSignature = await computeHmacSignature(base64Payload, activeSecret);

  return `${base64Payload}.${hexSignature}`;
}

/**
 * Verifies the HMAC-SHA256 signature and expiration timestamp of a session token.
 * Returns the decoded SessionPayload if valid and unexpired, or null otherwise.
 */
export async function verifySessionToken(
  token: string,
  secret?: string
): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [base64Payload, hexSignature] = parts;
  if (!base64Payload || !hexSignature) {
    return null;
  }

  const activeSecret = getActiveSecret(secret);
  const expectedHexSignature = await computeHmacSignature(base64Payload, activeSecret);

  if (!timingSafeEqualStr(hexSignature.toLowerCase(), expectedHexSignature.toLowerCase())) {
    return null;
  }

  let payload: SessionPayload;
  try {
    const jsonStr = base64ToString(base64Payload);
    payload = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (
    !payload ||
    typeof payload.username !== 'string' ||
    !payload.username.trim() ||
    typeof payload.createdAt !== 'number' ||
    typeof payload.expiresAt !== 'number'
  ) {
    return null;
  }

  // Check expiration
  if (Date.now() > payload.expiresAt) {
    return null;
  }

  return payload;
}
