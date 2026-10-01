/**
 * Google OAuth 2.0 / OpenID Connect Authentication for Less of Josh Owner Dashboard.
 *
 * Implements strict owner-only access:
 *   - Google login only (no username/password, no arbitrary registrations)
 *   - Server-side email allowlist verification (OWNER_EMAIL, default: jwgreenway@gmail.com)
 *   - PKCE / state / nonce CSRF protection
 *   - RS256 JWKS Google ID token signature verification
 *   - Web Crypto HMAC-SHA256 signed session cookies (HttpOnly, Secure, SameSite=Lax)
 */

export const DEFAULT_OWNER_EMAIL = "jwgreenway@gmail.com";
export const DEFAULT_GOOGLE_CLIENT_ID = "348581884026-ml7gknmetgv26n63oj4ujo37qmp8p1le.apps.googleusercontent.com";
export const STATE_COOKIE_NAME = "__loj_oauth_state";
export const SESSION_COOKIE_NAME = "loj_admin_session";
export const STATE_TTL_SECONDS = 600; // 10 minutes
export const SESSION_TTL_SECONDS = 7 * 24 * 3600; // 7 days

export function getOwnerEmail(env) {
  return String(env?.OWNER_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
}

export function getGoogleClientId(env) {
  return String(env?.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID).trim();
}

export function getGoogleClientSecret(env) {
  return String(env?.GOOGLE_CLIENT_SECRET || "").trim();
}

export function getAuthSecret(env) {
  return String(
    env?.AUTH_SECRET ||
    env?.LOJ_NONCE_SECRET ||
    "loj-default-auth-secret-change-in-production-min32chars"
  ).trim();
}

export function base64UrlEncode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(str) {
  if (!str || typeof str !== "string") return null;
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function generateRandomString(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function hmacSha256(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifyHmacSha256(secret, data, signatureBase64Url) {
  const sigBytes = base64UrlDecode(signatureBase64Url);
  if (!sigBytes) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(data));
  } catch {
    return false;
  }
}

export async function signPayload(payload, secret) {
  const enc = new TextEncoder();
  const jsonStr = JSON.stringify(payload);
  const dataBase64 = base64UrlEncode(enc.encode(jsonStr));
  const signature = await hmacSha256(secret, dataBase64);
  return `${dataBase64}.${signature}`;
}

export async function verifyPayload(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [dataBase64, signature] = parts;
  try {
    const valid = await verifyHmacSha256(secret, dataBase64, signature);
    if (!valid) return null;
    const decodedBytes = base64UrlDecode(dataBase64);
    if (!decodedBytes) return null;
    const jsonStr = new TextDecoder().decode(decodedBytes);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let cachedEndpoints = null;
export async function getGoogleEndpoints() {
  if (cachedEndpoints) return cachedEndpoints;
  try {
    const res = await fetch("https://accounts.google.com/.well-known/openid-configuration", {
      headers: { "User-Agent": "LessOfJosh-Auth/2.0.3" },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      cachedEndpoints = {
        authorization_endpoint: data.authorization_endpoint,
        token_endpoint: data.token_endpoint,
        jwks_uri: data.jwks_uri,
        issuer: data.issuer
      };
      return cachedEndpoints;
    }
  } catch {
    // Fall back to standard Google endpoints
  }
  return {
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: "https://oauth2.googleapis.com/token",
    jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
    issuer: "https://accounts.google.com"
  };
}

export async function createOAuthStateCookie(state, nonce, env, isHttps = true) {
  const secret = getAuthSecret(env);
  const signed = await signPayload(
    { state, nonce, exp: Date.now() + STATE_TTL_SECONDS * 1000 },
    secret
  );
  const secureFlag = isHttps ? "; Secure" : "";
  return `${STATE_COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${STATE_TTL_SECONDS}`;
}

export async function verifyOAuthStateCookie(cookieHeader, expectedState, env) {
  const raw = parseCookie(cookieHeader, STATE_COOKIE_NAME);
  if (!raw) return null;
  const secret = getAuthSecret(env);
  const payload = await verifyPayload(raw, secret);
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;
  if (!payload.state || payload.state !== expectedState) return null;
  return payload.nonce || null;
}

export function clearOAuthStateCookie(isHttps = true) {
  const secureFlag = isHttps ? "; Secure" : "";
  return `${STATE_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`;
}

export async function createAdminSessionCookie(userInfo, env, isHttps = true) {
  const secret = getAuthSecret(env);
  const payload = {
    sub: userInfo.sub,
    email: userInfo.email.trim().toLowerCase(),
    name: userInfo.name || "Josh Greenway",
    picture: userInfo.picture || "",
    role: "owner",
    exp: Date.now() + SESSION_TTL_SECONDS * 1000
  };
  const signed = await signPayload(payload, secret);
  const secureFlag = isHttps ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${SESSION_TTL_SECONDS}`;
}

export async function verifyAdminSession(cookieHeader, env) {
  const raw = parseCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (!raw) return null;
  const secret = getAuthSecret(env);
  const payload = await verifyPayload(raw, secret);
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;

  const allowedOwner = getOwnerEmail(env);
  if (payload.email !== allowedOwner) {
    return null;
  }
  return payload;
}

export function clearAdminSessionCookie(isHttps = true) {
  const secureFlag = isHttps ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`;
}

export async function exchangeCodeForTokens(code, redirectUri, env) {
  const endpoints = await getGoogleEndpoints();
  const clientId = getGoogleClientId(env);
  const clientSecret = getGoogleClientSecret(env);

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const res = await fetch(endpoints.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "LessOfJosh-Auth/2.0.3"
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  return await res.json();
}

export async function validateGoogleIdToken(idToken, expectedNonce, env, jwksOverride = null) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing or invalid ID token");
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported JWT algorithm or missing kid");
  }

  let keys = jwksOverride;
  if (!keys) {
    const endpoints = await getGoogleEndpoints();
    const res = await fetch(endpoints.jwks_uri, {
      headers: { "User-Agent": "LessOfJosh-Auth/2.0.3" },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Google JWKS (${res.status})`);
    }
    const jwks = await res.json();
    keys = jwks.keys;
  }

  const keyJwk = keys?.find((k) => k.kid === header.kid);
  if (!keyJwk) {
    throw new Error(`Key ID ${header.kid} not found in Google JWKS`);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    keyJwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlDecode(signatureB64);
  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signatureBytes,
    signedData
  );

  if (!isValid) {
    throw new Error("Google ID token signature invalid");
  }

  const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
  if (!validIssuers.includes(payload.iss)) {
    throw new Error(`Invalid token issuer: ${payload.iss}`);
  }

  const expectedClientId = getGoogleClientId(env);
  if (payload.aud !== expectedClientId) {
    throw new Error(`Invalid token audience: ${payload.aud}`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowSec) {
    throw new Error("Google ID token expired");
  }

  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("Google ID token nonce mismatch");
  }

  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new Error("Google account email is not verified");
  }

  return {
    sub: payload.sub,
    email: String(payload.email || "").trim().toLowerCase(),
    name: payload.name || "Josh Greenway",
    picture: payload.picture || ""
  };
}

export async function createDashboardCsrfToken(session, env) {
  const secret = getAuthSecret(env);
  const tick = Math.floor(Date.now() / (3600 * 1000)); // 1-hour window
  const raw = `${session.sub}|${session.email}|${tick}`;
  return (await hmacSha256(secret, raw)).slice(0, 16);
}

export async function verifyDashboardCsrfToken(token, session, env) {
  if (!token || typeof token !== "string" || !session) return false;
  const secret = getAuthSecret(env);
  const tick = Math.floor(Date.now() / (3600 * 1000));
  const current = (await hmacSha256(secret, `${session.sub}|${session.email}|${tick}`)).slice(0, 16);
  if (timingSafeEqual(token, current)) return true;
  const previous = (await hmacSha256(secret, `${session.sub}|${session.email}|${tick - 1}`)).slice(0, 16);
  return timingSafeEqual(token, previous);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
