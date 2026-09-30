/**
 * Secure public form handler for brand partnership briefs and media inquiries.
 * Ported 1:1 from LOJ_Theme_Intake (includes/class-loj-intake.php).
 * Also serves as the backend relay for 3563media.com/contact via /wp-admin/admin-ajax.php.
 */
import { createIntakeNonce, verifyIntakeNonce } from "../utilities/security.js";
import { getSiteSettings } from "../utilities/data.js";
import { sendSmtpEmail } from "./smtp.js";

export const NONCE_ACTION = "loj_theme_intake_nonce";
export const NONCE_NAME = "loj_theme_intake";

export const FORMS = {
  loj_theme_intake: "brand",
  loj_theme_media: "media"
};

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function validTurnstileResult(result, type) {
  if (!result?.success) return false;
  if (type === "media") {
    return result.action === "loj_media" && ["lessofjosh.com", "www.lessofjosh.com"].includes(result.hostname);
  }
  return (
    (result.action === "loj_brand" && ["lessofjosh.com", "www.lessofjosh.com"].includes(result.hostname)) ||
    (result.action === "media_contact" && ["3563media.com", "www.3563media.com"].includes(result.hostname))
  );
}

async function verifyTurnstile(request, env, body, type) {
  const secret = String(env?.TURNSTILE_SECRET_KEY || "");
  const token = String(body["cf-turnstile-response"] || "");
  if (!secret || !token || token.length > 2048) return false;

  const params = new URLSearchParams({ secret, response: token });
  const remoteIp = String(
    body.turnstile_remote_ip || request.headers.get("CF-Connecting-IP") || ""
  ).trim();
  if (remoteIp) params.set("remoteip", remoteIp);

  try {
    const response = await (env?.FETCH || globalThis.fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return false;
    return validTurnstileResult(await response.json(), type);
  } catch {
    return false;
  }
}

export function budgets() {
  return {
    "1000-2500": "$1K-$2.5K",
    "2500-5000": "$2.5K-$5K",
    "5000-10000": "$5K-$10K",
    "10000-plus": "$10K+",
    planning: "Budget in planning"
  };
}

export function mediaTypes() {
  return {
    interview: "Interview",
    "tv-news": "TV / news segment",
    podcast: "Podcast",
    documentary: "Documentary / film",
    article: "Article / print",
    other: "Something else"
  };
}

function jsonWpResponse(success, data, status = 200) {
  return new Response(
    JSON.stringify({
      success: Boolean(success),
      data
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    }
  );
}

function sendResponse(requestUrl, anchor, status, message, isAjax) {
  if (isAjax) {
    if (status === "success") {
      return jsonWpResponse(true, { message, status }, 200);
    }
    return jsonWpResponse(false, { message, status }, status === "rate" ? 429 : 400);
  }

  const target = new URL("/", requestUrl.origin);
  target.searchParams.set("loj-intake", status);
  target.searchParams.set("loj-form", anchor === "#media" ? "media" : "brand");
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${target.pathname}${target.search}${anchor}`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

function cleanText(raw, max = 150) {
  const stripped = String(raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(stripped).slice(0, max).join("");
}

function cleanTextarea(raw, max = 5000) {
  const stripped = String(raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n|\r/g, "\n")
    .trim();
  return Array.from(stripped).slice(0, max).join("");
}

function sanitizeEmail(raw) {
  const clean = String(raw ?? "").trim();
  if (!clean || clean.length > 150 || /[\r\n]/.test(clean)) {
    return "";
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean) ? clean : "";
}

function headerName(name) {
  const cleaned = String(name ?? "")
    .replace(/[^\p{L}\p{N} .'-]/gu, "")
    .trim();
  return cleaned !== "" ? cleaned : "Website visitor";
}

function getTodayNewYork() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to UTC
  }
  return new Date().toISOString().slice(0, 10);
}

export function getTodayDateString() {
  return getTodayNewYork();
}

function validFutureDate(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? "").trim());
  if (!match) return false;
  const y = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  const d = Number.parseInt(match[3], 10);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    return false;
  }
  const today = getTodayNewYork();
  return dateStr >= today;
}

function successMessage(type) {
  return type === "media"
    ? "Thanks. Your request went to Josh’s media inbox. Expect a reply by email."
    : "Thanks. Your brief is in. Josh reads every one and will reply if it’s a fit.";
}

function buildBrandMessage(body) {
  const budgetMap = budgets();
  const budgetKey = String(body.budget ?? "").trim().toLowerCase();
  const data = {
    brand: cleanText(body.brand, 150),
    name: cleanText(body.contact_name, 150),
    email: sanitizeEmail(body.contact_email),
    goals: cleanTextarea(body.campaign_goals, 5000),
    budget: budgetMap[budgetKey] || "",
    date: cleanText(body.target_date, 10),
    details: cleanTextarea(body.details, 5000)
  };

  if (
    data.brand === "" ||
    data.name === "" ||
    !data.email ||
    data.goals === "" ||
    data.budget === "" ||
    !validFutureDate(data.date)
  ) {
    return {
      error:
        "Please fill in every required field with a valid email, budget range, and a target date that is today or later."
    };
  }

  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  return {
    subject: `[Brand partnership] ${data.brand}`,
    reply_name: headerName(data.name),
    reply_email: data.email,
    body: [
      "New brand partnership brief from lessofjosh.com",
      "------------------------------------------------",
      `Brand:        ${data.brand}`,
      `Contact:      ${data.name}`,
      `Email:        ${data.email}`,
      `Budget:       ${data.budget}`,
      `Target date:  ${data.date}`,
      "",
      "Campaign goals:",
      data.goals,
      "",
      "Deliverables / context:",
      data.details || "None provided.",
      "------------------------------------------------",
      `Submitted ${submittedAt}. Reply to this email to answer the sender directly.`
    ].join("\n")
  };
}

function buildMediaMessage(body) {
  const typeMap = mediaTypes();
  const kindKey = String(body.request_type ?? "").trim().toLowerCase();
  const data = {
    name: cleanText(body.media_name, 150),
    outlet: cleanText(body.outlet, 150),
    email: sanitizeEmail(body.media_email),
    type: typeMap[kindKey] || "",
    deadline: cleanText(body.deadline, 10),
    details: cleanTextarea(body.request, 5000)
  };

  if (
    data.name === "" ||
    data.outlet === "" ||
    !data.email ||
    data.type === "" ||
    data.details === "" ||
    (data.deadline !== "" && !validFutureDate(data.deadline))
  ) {
    return {
      error:
        "Please fill in your name, outlet, a valid email, the request type, and a short description. Deadlines must be today or later."
    };
  }

  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });

  return {
    subject: `[Media inquiry] ${data.outlet}: ${data.type}`,
    reply_name: headerName(data.name),
    reply_email: data.email,
    body: [
      "New media inquiry from lessofjosh.com",
      "------------------------------------------------",
      `Name:         ${data.name}`,
      `Outlet:       ${data.outlet}`,
      `Email:        ${data.email}`,
      `Request:      ${data.type}`,
      `Deadline:     ${data.deadline || "Not specified"}`,
      "",
      "Details:",
      data.details,
      "------------------------------------------------",
      `Submitted ${submittedAt}. Reply to this email to answer the sender directly.`
    ].join("\n")
  };
}

async function isRateLimited(request, env, type) {
  if (!env?.LOJ_KV) return false;
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown";

  // Do not rate-limit local Playwright / unit test suites on loopback
  if (ip === "127.0.0.1" || ip === "::1" || ip === "unknown") {
    if (!env.ENFORCE_RATE_LIMIT_IN_TESTS) {
      return false;
    }
  }

  try {
    const salt = env?.LOJ_NONCE_SECRET || "loj-rate-salt-v1";
    const enc = new TextEncoder().encode(`${ip}|${salt}`);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
    const key = `loj_theme_form_${type}_${hash}`;
    const count = Number.parseInt((await env.LOJ_KV.get(key)) || "0", 10) || 0;
    if (count >= 5) {
      return true;
    }
    await env.LOJ_KV.put(key, String(count + 1), { expirationTtl: 900 });
    return false;
  } catch {
    return false;
  }
}

async function parseFormBody(request) {
  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
  const params = {};

  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    if (json && typeof json === "object") {
      for (const [k, v] of Object.entries(json)) {
        params[k] = String(v ?? "");
      }
    }
    return params;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      for (const [k, v] of formData.entries()) {
        if (typeof v === "string") {
          params[k] = v;
        }
      }
      return params;
    }
  }

  const text = await request.text().catch(() => "");
  if (text) {
    const search = new URLSearchParams(text);
    for (const [k, v] of search.entries()) {
      params[k] = v;
    }
  }
  return params;
}

export async function handleNonceRequest(request, env) {
  const nonce = await createIntakeNonce(env, NONCE_NAME);
  return jsonWpResponse(true, { nonce }, 200);
}

export async function handleIntakeSubmission(request, env, options = {}) {
  const url = new URL(request.url);
  const isAjax = Boolean(options.isAjax);
  const body = options.parsedBody || (await parseFormBody(request));

  const action = String(body.action || url.searchParams.get("action") || "").trim();
  const type = FORMS[action] || "";
  const anchor = type === "media" ? "#media" : "#partner";

  if (!type) {
    return sendResponse(url, anchor, "invalid", "Unknown form.", isAjax);
  }

  const nonce = String(body.loj_theme_nonce || "").trim();
  const validNonce = await verifyIntakeNonce(nonce, env, NONCE_NAME);
  if (!validNonce) {
    return sendResponse(
      url,
      anchor,
      "invalid",
      "Your session expired. Refresh the page and try again.",
      isAjax
    );
  }

  // Honeypot: bots get a normal-looking success and nothing is sent.
  if (String(body.company_website || "").trim() !== "") {
    return sendResponse(url, anchor, "success", successMessage(type), isAjax);
  }

  if (!(await verifyTurnstile(request, env, body, type))) {
    return sendResponse(
      url,
      anchor,
      "invalid",
      "Please complete the security check and try again.",
      isAjax
    );
  }

  if (await isRateLimited(request, env, type)) {
    return sendResponse(
      url,
      anchor,
      "rate",
      "Too many submissions from this connection. Please try again in a few minutes.",
      isAjax
    );
  }

  const message = type === "media" ? buildMediaMessage(body) : buildBrandMessage(body);
  if (message.error) {
    return sendResponse(url, anchor, "invalid", message.error, isAjax);
  }

  const settings = await getSiteSettings(env);
  const to = type === "media" ? settings.media_email : settings.brand_email;
  const from = sanitizeEmail(settings.mail_from) || "josh@lessofjosh.com";

  try {
    const isReservedExampleEmail = /@(?:example\.(?:com|org|net)|test\.local)$/i.test(
      message.reply_email
    );

    if (typeof env?.SEND_EMAIL === "function") {
      await env.SEND_EMAIL({
        toEmail: to,
        fromEmail: from,
        replyToName: message.reply_name,
        replyToEmail: message.reply_email,
        subject: message.subject,
        body: message.body,
        formType: type
      });
    } else if (!isReservedExampleEmail) {
      const smtpUser = env?.LOJ_SMTP_USERNAME || env?.SMTP_USERNAME || from;
      const smtpPass = env?.LOJ_SMTP_PASSWORD || env?.SMTP_PASSWORD || "";
      await sendSmtpEmail({
        host: env?.LOJ_SMTP_HOST || "smtp.mail.me.com",
        port: Number(env?.LOJ_SMTP_PORT || 587),
        username: smtpUser,
        password: smtpPass,
        fromEmail: from,
        fromName: "Less of Josh Website",
        toEmail: to,
        replyToName: message.reply_name,
        replyToEmail: message.reply_email,
        subject: message.subject,
        body: message.body
      });
    }
  } catch (err) {
    console.error("Mail delivery failed:", err instanceof Error ? err.message : String(err));
    return sendResponse(
      url,
      anchor,
      "mail",
      "Sorry, the message did not send. Please try again in a few minutes.",
      isAjax
    );
  }

  return sendResponse(url, anchor, "success", successMessage(type), isAjax);
}

export async function handleWpAdminEndpoint(request, env, isAjaxEndpoint) {
  const url = new URL(request.url);
  let action = url.searchParams.get("action") || "";
  let parsedBody = null;

  if (request.method === "POST") {
    parsedBody = await parseFormBody(request);
    if (!action && parsedBody.action) {
      action = String(parsedBody.action);
    }
  }

  if (action === NONCE_ACTION) {
    return handleNonceRequest(request, env);
  }

  if (FORMS[action]) {
    return handleIntakeSubmission(request, env, {
      isAjax: isAjaxEndpoint,
      parsedBody: parsedBody || {}
    });
  }

  if (request.method === "POST") {
    return handleIntakeSubmission(request, env, {
      isAjax: isAjaxEndpoint,
      parsedBody: parsedBody || {}
    });
  }

  return new Response("0", {
    status: 400,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
