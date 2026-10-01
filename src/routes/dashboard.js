/**
 * Private Owner Dashboard and Google OAuth Handlers for Less of Josh.
 *
 * Provides:
 *   - /dashboard (Owner-only private metrics & settings tool)
 *   - /auth/login (Initiates Google OAuth authorization flow)
 *   - /auth/callback (Validates Google ID token, verifies OWNER_EMAIL allowlist)
 *   - /auth/logout (Clears session cookie)
 *   - /api/dashboard/refresh (Protected manual social metrics refresh)
 *   - /api/dashboard/settings (Protected KV site settings update)
 */

import {
  isEmailAuthorized,
  getGoogleClientId,
  getGoogleEndpoints,
  generateRandomString,
  createOAuthStateCookie,
  verifyOAuthStateCookie,
  clearOAuthStateCookie,
  exchangeCodeForTokens,
  validateGoogleIdToken,
  createAdminSessionCookie,
  verifyAdminSession,
  clearAdminSessionCookie,
  createDashboardCsrfToken,
  verifyDashboardCsrfToken
} from "../auth/google.js";
import { getPublicMetrics, refreshAllMetrics } from "../metrics/index.js";
import siteConfig from "../data/site-config.json" with { type: "json" };
import { escapeHtml, escapeAttr } from "../utilities/security.js";

const KV_STATUS_KEY = "metrics_status_v3";
const KV_SETTINGS_KEY = "site_settings_v1";

export async function handleDashboardAuthLogin(request, env, isHttps) {
  const url = new URL(request.url);
  const state = generateRandomString(32);
  const nonce = generateRandomString(32);
  const requestedRedirect = url.searchParams.get("redirect") || "/dashboard";
  const redirect = ["/dashboard", "/admin", "/commandcenter"].includes(requestedRedirect) ? requestedRedirect : "/dashboard";
  const stateCookie = await createOAuthStateCookie(state, nonce, env, isHttps, redirect);
  const endpoints = await getGoogleEndpoints();
  const clientId = getGoogleClientId(env);
  const redirectUri = `${url.origin}/auth/callback`;

  const authUrl = new URL(endpoints.authorization_endpoint);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": stateCookie,
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

export async function handleDashboardAuthCallback(request, env, isHttps) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const clearState = clearOAuthStateCookie(isHttps);

  if (error || !code || !state) {
    const errorMsg = errorDescription || error || "Authorization cancelled or missing parameters.";
    return new Response(renderAccessDeniedHtml("Google Authorization Failed", errorMsg), {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Set-Cookie": clearState,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const statePayload = await verifyOAuthStateCookie(cookieHeader, state, env);
  if (!statePayload?.nonce) {
    return new Response(renderAccessDeniedHtml("State Verification Failed", "OAuth state verification failed or expired. Please try signing in again."), {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Set-Cookie": clearState,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  try {
    const redirectUri = `${url.origin}/auth/callback`;
    const tokenResult = await exchangeCodeForTokens(code, redirectUri, env);
    if (!tokenResult.id_token) {
      throw new Error("Token exchange response did not include id_token");
    }

    const userInfo = await validateGoogleIdToken(tokenResult.id_token, statePayload.nonce, env);

    if (!isEmailAuthorized(userInfo.email, env)) {
      return new Response(
        renderAccessDeniedHtml(
          "Access Denied — Owner Only",
          `The Google account <strong>${escapeHtml(userInfo.email)}</strong> is not authorized to access this private tool.`
        ),
        {
          status: 403,
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Set-Cookie": clearState,
            "Cache-Control": "private, no-store",
            "X-Robots-Tag": "noindex, nofollow"
          }
        }
      );
    }

    const sessionCookie = await createAdminSessionCookie(userInfo, env, isHttps);
    const headers = new Headers();
    headers.set("Location", `${url.origin}${statePayload.redirect || "/dashboard"}`);
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", clearState);
    headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    headers.set("X-Robots-Tag", "noindex, nofollow");

    return new Response(null, {
      status: 302,
      headers
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(renderAccessDeniedHtml("Authentication Verification Error", message), {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Set-Cookie": clearState,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }
}

export function handleDashboardAuthLogout(request, env, isHttps) {
  const url = new URL(request.url);
  const clearSession = clearAdminSessionCookie(isHttps);
  const clearState = clearOAuthStateCookie(isHttps);

  const headers = new Headers();
  headers.set("Location", `${url.origin}/`);
  headers.append("Set-Cookie", clearSession);
  headers.append("Set-Cookie", clearState);
  headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  headers.set("X-Robots-Tag", "noindex, nofollow");

  return new Response(null, {
    status: 302,
    headers
  });
}

export async function handleDashboardPage(request, env, isHttps) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") || "";
  const session = await verifyAdminSession(cookieHeader, env);

  if (!session) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${url.origin}/auth/login`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  const metrics = await getPublicMetrics(env);
  let statusInfo = {};
  if (env?.LOJ_KV) {
    try {
      statusInfo = (await env.LOJ_KV.get(KV_STATUS_KEY, { type: "json" })) || {};
    } catch {
      statusInfo = {};
    }
  }

  let settings = {
    current_weight_loss: siteConfig.current_weight_loss || "232.6",
    brand_email: siteConfig.brand_email || "colab@lessofus.com",
    media_email: siteConfig.media_email || "media@lessofjosh.com",
    mail_from: siteConfig.mail_from || "josh@lessofjosh.com",
    mailing_address: siteConfig.mailing_address || "1129 Washington ST E #809 Lewisburg WV 24901"
  };
  if (env?.LOJ_KV) {
    try {
      const kvSettings = await env.LOJ_KV.get(KV_SETTINGS_KEY, { type: "json" });
      if (kvSettings && typeof kvSettings === "object") {
        settings = { ...settings, ...kvSettings };
      }
    } catch {
      // Use defaults
    }
  }

  const csrfToken = await createDashboardCsrfToken(session, env);
  const statusParam = url.searchParams.get("status") || "";

  const html = renderDashboardHtml({
    session,
    metrics,
    statusInfo,
    settings,
    csrfToken,
    statusParam,
    origin: url.origin
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

export async function handleDashboardApiRefresh(request, env, isHttps) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST", "Cache-Control": "private, no-store" }
    });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const session = await verifyAdminSession(cookieHeader, env);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized. Owner login required." }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
    });
  }

  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") || "";
  let csrfToken = request.headers.get("x-dashboard-csrf") || "";

  if (!csrfToken && contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    csrfToken = String(formData.get("_csrf") || "");
  }

  if (csrfToken && !(await verifyDashboardCsrfToken(csrfToken, session, env))) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
    });
  }

  const refreshResult = await refreshAllMetrics(env);

  const isJson =
    contentType.includes("application/json") ||
    (request.headers.get("accept") || "").includes("application/json") ||
    (request.headers.get("x-requested-with") || "").toLowerCase() === "xmlhttprequest";

  if (isJson) {
    return new Response(JSON.stringify({ success: true, result: refreshResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/dashboard?status=refreshed`,
      "Cache-Control": "private, no-store"
    }
  });
}

export async function handleDashboardApiSettings(request, env, isHttps) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST", "Cache-Control": "private, no-store" }
    });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const session = await verifyAdminSession(cookieHeader, env);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized. Owner login required." }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
    });
  }

  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") || "";
  let currentWeight = "";
  let brandEmail = "";
  let mediaEmail = "";
  let mailFrom = "";
  let mailingAddress = "";
  let csrfToken = request.headers.get("x-dashboard-csrf") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    currentWeight = String(body.current_weight_loss || "");
    brandEmail = String(body.brand_email || "");
    mediaEmail = String(body.media_email || "");
    mailFrom = String(body.mail_from || "");
    mailingAddress = String(body.mailing_address || "");
    if (!csrfToken) csrfToken = String(body._csrf || "");
  } else {
    const formData = await request.formData();
    currentWeight = String(formData.get("current_weight_loss") || "");
    brandEmail = String(formData.get("brand_email") || "");
    mediaEmail = String(formData.get("media_email") || "");
    mailFrom = String(formData.get("mail_from") || "");
    mailingAddress = String(formData.get("mailing_address") || "");
    if (!csrfToken) csrfToken = String(formData.get("_csrf") || "");
  }

  if (csrfToken && !(await verifyDashboardCsrfToken(csrfToken, session, env))) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
    });
  }

  const weightNum = Number.parseFloat(currentWeight);
  const safeWeight = Number.isFinite(weightNum) && weightNum >= 0 && weightNum <= 715
    ? weightNum.toFixed(1)
    : (siteConfig.current_weight_loss || "232.6");

  const updatedSettings = {
    current_weight_loss: safeWeight,
    brand_email: brandEmail.trim() || siteConfig.brand_email || "colab@lessofus.com",
    media_email: mediaEmail.trim() || siteConfig.media_email || "media@lessofjosh.com",
    mail_from: mailFrom.trim() || siteConfig.mail_from || "josh@lessofjosh.com",
    mailing_address: mailingAddress.trim() || siteConfig.mailing_address || "1129 Washington ST E #809 Lewisburg WV 24901",
    updated_at: new Date().toISOString()
  };

  if (env?.LOJ_KV) {
    await env.LOJ_KV.put(KV_SETTINGS_KEY, JSON.stringify(updatedSettings));
  }

  const isJson =
    contentType.includes("application/json") ||
    (request.headers.get("accept") || "").includes("application/json") ||
    (request.headers.get("x-requested-with") || "").toLowerCase() === "xmlhttprequest";

  if (isJson) {
    return new Response(JSON.stringify({ success: true, settings: updatedSettings }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/dashboard?status=settings_saved`,
      "Cache-Control": "private, no-store"
    }
  });
}

function renderAccessDeniedHtml(title, message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)} — Less of Josh</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f0f11;
      color: #e2e8f0;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .card {
      max-width: 480px;
      width: 90%;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 22px;
      color: #fff;
    }
    p {
      margin: 0 0 24px;
      font-size: 14px;
      line-height: 1.6;
      color: #a1a1aa;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    a.btn {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    a.btn-primary {
      background: #d97706;
      color: #fff;
    }
    a.btn-primary:hover {
      background: #b45309;
    }
    a.btn-secondary {
      background: #27272a;
      color: #e2e8f0;
    }
    a.btn-secondary:hover {
      background: #3f3f46;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Security Protection</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${message}</p>
    <div class="actions">
      <a href="/auth/login" class="btn btn-primary">Try Signing In Again</a>
      <a href="/" class="btn btn-secondary">Return to Site</a>
    </div>
  </div>
</body>
</html>`;
}

function renderDashboardHtml({ session, metrics, statusInfo, settings, csrfToken, statusParam, origin }) {
  const platforms = [
    { key: "tiktok", name: "TikTok", icon: "🎵" },
    { key: "instagram", name: "Instagram", icon: "📸" },
    { key: "facebook", name: "Facebook", icon: "👥" },
    { key: "youtube", name: "YouTube", icon: "▶️" }
  ];

  const noticeHtml = statusParam === "refreshed"
    ? `<div class="notice notice-success">Audience metrics refreshed across all social platforms.</div>`
    : statusParam === "settings_saved"
      ? `<div class="notice notice-success">Site settings and weight loss saved to KV.</div>`
      : "";

  const rowsHtml = platforms.map(({ key, name, icon }) => {
    const data = metrics.platforms?.[key] || {};
    const status = statusInfo[key] || {};
    const followers = data.followers !== null ? Number(data.followers).toLocaleString() : "—";
    const views = data.views !== null ? Number(data.views).toLocaleString() : "—";
    const engagement = data.engagement_rate !== null ? `${data.engagement_rate}%` : "—";
    const isLive = data.verification === "live";
    const lastUpdate = data.updated_at ? new Date(data.updated_at).toLocaleString() : "—";
    const statusMessage = status.message || (isLive ? "Live verified" : "Last good cache");

    return `
      <tr>
        <td class="platform-col">
          <span class="platform-icon">${icon}</span>
          <div>
            <strong>${escapeHtml(name)}</strong>
            <div class="sub-text">${escapeHtml(data.handle || "")}</div>
          </div>
        </td>
        <td>
          <span class="badge ${isLive ? "badge-success" : "badge-neutral"}">
            ${isLive ? "Live Sync" : "Cached"}
          </span>
        </td>
        <td><strong>${followers}</strong></td>
        <td>${views}</td>
        <td>${engagement}</td>
        <td>
          <div class="status-msg">${escapeHtml(statusMessage)}</div>
          <div class="sub-text">${escapeHtml(lastUpdate)}</div>
        </td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Owner Dashboard — Less of Josh</title>
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #141417;
      --card-border: #242429;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --amber: #f59e0b;
      --amber-dark: #d97706;
      --green: #10b981;
      --red: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      background: #111114;
      border-bottom: 1px solid var(--card-border);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-brand h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }
    .header-user {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1c1c21;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 13px;
      border: 1px solid var(--card-border);
    }
    .user-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--amber-dark);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }
    .container {
      max-width: 1100px;
      margin: 32px auto;
      padding: 0 20px;
    }
    .notice {
      padding: 12px 18px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 14px;
      font-weight: 500;
    }
    .notice-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    @media (min-width: 768px) {
      .grid-2 { grid-template-columns: 2fr 1fr; }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
    }
    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .card-title-row h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: #fff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 14px;
    }
    th {
      padding: 10px 12px;
      color: var(--text-muted);
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--card-border);
    }
    td {
      padding: 14px 12px;
      border-bottom: 1px solid #1a1a1f;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    .platform-col {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .platform-icon { font-size: 18px; }
    .sub-text { font-size: 12px; color: var(--text-muted); }
    .status-msg { font-size: 13px; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-neutral { background: rgba(161, 161, 170, 0.2); color: #d4d4d8; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .btn-primary {
      background: var(--amber-dark);
      color: #fff;
    }
    .btn-primary:hover { background: #b45309; }
    .btn-secondary {
      background: #27272a;
      border-color: #3f3f46;
      color: #f4f4f5;
    }
    .btn-secondary:hover { background: #3f3f46; }
    .btn-danger {
      background: transparent;
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.3);
    }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.1); }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
    }
    .form-control {
      width: 100%;
      padding: 9px 12px;
      border-radius: 6px;
      border: 1px solid var(--card-border);
      background: #0f0f11;
      color: #fff;
      font-size: 14px;
    }
    .form-control:focus {
      outline: none;
      border-color: var(--amber);
    }
    .form-help {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .security-banner {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #fde68a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .security-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-brand">
      <span style="font-size: 20px;">⚡</span>
      <h1>Less of Josh — Private Owner Dashboard</h1>
    </div>
    <div class="header-user">
      <div class="user-pill">
        <div class="user-avatar">${escapeHtml(session.name ? session.name.charAt(0).toUpperCase() : "J")}</div>
        <span>${escapeHtml(session.email)}</span>
      </div>
      <a href="/media-kit-download/" class="btn btn-secondary" target="_blank">Download PDF</a>
      <a href="/" class="btn btn-secondary" target="_blank">Public Site ↗</a>
      <a href="/auth/logout" class="btn btn-danger">Log Out</a>
    </div>
  </header>

  <main class="container">
    ${noticeHtml}

    <div class="security-banner">
      <div class="security-badge">
        <span>🔒</span>
        <span>Owner Authentication Active — Google OIDC Allowed Email: ${escapeHtml(session.email)}</span>
      </div>
      <span class="sub-text">Private Area &bull; noindex, nofollow &bull; Not Publicly Cached</span>
    </div>

    <div class="grid grid-2">
      <!-- Left: Social Metrics -->
      <section class="card">
        <div class="card-title-row">
          <h2>Live Social Metrics</h2>
          <form method="POST" action="/api/dashboard/refresh" style="margin: 0;">
            <input type="hidden" name="_csrf" value="${escapeAttr(csrfToken)}">
            <button type="submit" class="btn btn-primary">Refresh Metrics Now</button>
          </form>
        </div>
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Status</th>
              <th>Audience</th>
              <th>Reach / Views</th>
              <th>Eng. Rate</th>
              <th>Last Checked</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </section>

      <!-- Right: Site Settings -->
      <section class="card">
        <div class="card-title-row">
          <h2>Live Site Settings</h2>
        </div>
        <form method="POST" action="/api/dashboard/settings">
          <input type="hidden" name="_csrf" value="${escapeAttr(csrfToken)}">
          
          <div class="form-group">
            <label for="current_weight_loss">Pounds Lost So Far (lb)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="715"
              id="current_weight_loss"
              name="current_weight_loss"
              class="form-control"
              value="${escapeAttr(settings.current_weight_loss)}"
              required
            >
            <div class="form-help">Syncs directly to homepage hero, transformation proof, and PDF download.</div>
          </div>

          <div class="form-group">
            <label for="brand_email">Brand Partnership Inbox</label>
            <input
              type="email"
              id="brand_email"
              name="brand_email"
              class="form-control"
              value="${escapeAttr(settings.brand_email)}"
              required
            >
          </div>

          <div class="form-group">
            <label for="media_email">Media Inquiry Inbox</label>
            <input
              type="email"
              id="media_email"
              name="media_email"
              class="form-control"
              value="${escapeAttr(settings.media_email)}"
              required
            >
          </div>

          <div class="form-group">
            <label for="mail_from">Outbound From Address</label>
            <input
              type="email"
              id="mail_from"
              name="mail_from"
              class="form-control"
              value="${escapeAttr(settings.mail_from)}"
              required
            >
          </div>

          <button type="submit" class="btn btn-secondary" style="width: 100%; margin-top: 8px;">Save Settings to KV</button>
        </form>
      </section>
    </div>
  </main>
</body>
</html>`;
}
