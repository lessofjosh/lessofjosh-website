/**
 * Security headers and HMAC token helpers ported from functions.php (loj_theme_security_headers).
 */

const BASE_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://cloudflareinsights.com",
  "media-src 'self'",
  "frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://www.instagram.com https://www.facebook.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
];

export function applySecurityHeaders(headers, isHttps = true) {
  const csp = isHttps
    ? [...BASE_CSP_DIRECTIVES, "upgrade-insecure-requests"].join("; ")
    : BASE_CSP_DIRECTIVES.join("; ");

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("X-XSS-Protection", "0");
  headers.set("Content-Security-Policy", csp);
  if (isHttps) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  return headers;
}

export function withSecurityHeaders(response, isHttps = true) {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers, isHttps);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Generate or verify a time-windowed HMAC nonce (compatible with WordPress nonce semantics:
 * 12-hour tick window, valid for current or previous tick).
 */
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createIntakeNonce(env, action = "loj_theme_intake", nowMs = Date.now()) {
  const secret = env?.LOJ_NONCE_SECRET || "loj-default-intake-nonce-secret-v1";
  const tick = Math.ceil(nowMs / (12 * 3600 * 1000));
  const digest = await hmacHex(secret, `${tick}|${action}`);
  return digest.slice(0, 10);
}

export async function verifyIntakeNonce(nonce, env, action = "loj_theme_intake", nowMs = Date.now()) {
  if (!nonce || typeof nonce !== "string") {
    return false;
  }
  const clean = nonce.trim();
  if (!/^[a-f0-9]{10}$/i.test(clean)) {
    return false;
  }
  const secret = env?.LOJ_NONCE_SECRET || "loj-default-intake-nonce-secret-v1";
  const tick = Math.ceil(nowMs / (12 * 3600 * 1000));
  const current = (await hmacHex(secret, `${tick}|${action}`)).slice(0, 10);
  if (timingSafeEqual(clean.toLowerCase(), current.toLowerCase())) {
    return true;
  }
  const previous = (await hmacHex(secret, `${tick - 1}|${action}`)).slice(0, 10);
  if (timingSafeEqual(clean.toLowerCase(), previous.toLowerCase())) {
    return true;
  }
  return false;
}

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}
