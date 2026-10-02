import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import {
  createAdminSessionCookie,
  createOAuthStateCookie,
  base64UrlEncode,
  base64UrlDecode,
  DEFAULT_ALLOWED_EMAILS,
  DEFAULT_OWNER_EMAIL,
  DEFAULT_GOOGLE_CLIENT_ID,
  createDashboardCsrfToken,
  verifyOAuthStateCookie
} from "../src/auth/google.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

function createMockEnv(overrides = {}) {
  const kvStore = new Map();
  const sentEmails = [];

  return {
    SITE_URL: "https://lessofjosh.com",
    SITE_NAME: "Less of Josh",
    THEME_VERSION: "2.0.3",
    TURNSTILE_SITE_KEY: "test-site-key",
    LOJ_NONCE_SECRET: "unit-test-nonce-secret-2026",
    LOJ_KV: {
      async get(key, opts) {
        if (!kvStore.has(key)) return null;
        const val = kvStore.get(key);
        if (opts?.type === "json") return JSON.parse(val);
        if (opts?.type === "arrayBuffer") return val;
        return val;
      },
      async put(key, val) {
        kvStore.set(key, val);
      },
      async delete(key) {
        kvStore.delete(key);
      }
    },
    ASSETS: {
      async fetch(req) {
        const url = new URL(req.url);
        const filePath = path.join(publicDir, url.pathname);
        if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return new Response("Not Found", { status: 404 });
        }
        const bytes = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = {
          ".pdf": "application/pdf",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".webp": "image/webp",
          ".avif": "image/avif",
          ".woff2": "font/woff2",
          ".css": "text/css; charset=UTF-8",
          ".js": "application/javascript; charset=UTF-8",
          ".txt": "text/plain; charset=UTF-8"
        };
        return new Response(bytes, {
          status: 200,
          headers: { "Content-Type": mimeMap[ext] || "application/octet-stream" }
        });
      }
    },
    SEND_EMAIL: async (mail) => {
      sentEmails.push(mail);
    },
    _sentEmails: sentEmails,
    _kvStore: kvStore,
    ...overrides
  };
}

function createTurnstileFetch() {
  const used = new Set();
  return async (url, init) => {
    assert.equal(String(url), "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const token = new URLSearchParams(init.body).get("response");
    if (token === "network-token") throw new Error("siteverify unavailable");
    if (used.has(token)) return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
    used.add(token);
    const result = {
      "brand-token": { success: true, action: "loj_brand", hostname: "lessofjosh.com" },
      "media-token": { success: true, action: "loj_media", hostname: "lessofjosh.com" },
      "nojs-token": { success: true, action: "loj_media", hostname: "lessofjosh.com" },
      "contact-token": { success: true, action: "media_contact", hostname: "3563media.com" },
      "bad-action-token": { success: true, action: "wrong", hostname: "lessofjosh.com" }
    }[token];
    return Response.json(result || { success: false });
  };
}

function createMockD1() {
  const tables = {
    sponsorships: [],
    revenue_entries: [],
    notes: [],
    attachments: [],
    record_relationships: [],
    custom_field_definitions: [],
    custom_field_values: [],
    user_permissions: [
      { id: 1, email: "jwgreenway@gmail.com", name: "Josh Greenway", role: "owner", allowed_modules: "*", can_export: 1, can_delete: 1 },
      { id: 2, email: "ritagreenway304@gmail.com", name: "Rita Greenway", role: "admin", allowed_modules: "*", can_export: 1, can_delete: 1 }
    ],
    content_pipeline: [],
    business_projects: [],
    tasks: [],
    media_outreach: [],
    affiliates: [],
    goals: [],
    cookbook_recipes: [],
    printing_projects: [],
    reference_documents: []
  };

  return {
    tables,
    prepare(sql) {
      let values = [];
      return {
        bind(...bound) { values = bound; return this; },
        async all() {
          const matchTable = sql.match(/FROM\s+(\w+)/i);
          const table = matchTable ? matchTable[1] : null;
          let rows = [...(tables[table] || [])];

          if (sql.includes("FROM custom_field_definitions d") && sql.includes("LEFT JOIN custom_field_values")) {
            const targetRecId = Number(values[0]);
            const targetEntity = values[1];
            rows = (tables.custom_field_definitions || [])
              .filter((d) => (d.entity_type === targetEntity || d.table_name === targetEntity))
              .map((d) => {
                const val = (tables.custom_field_values || []).find((v) => v.definition_id === d.id && v.record_id === targetRecId);
                return {
                  definition_id: d.id,
                  field_name: d.field_name,
                  field_label: d.field_label,
                  field_type: d.field_type,
                  options_json: d.options_json,
                  default_value: d.default_value,
                  is_required: d.is_required,
                  value_id: val?.id || null,
                  value_text: val?.value_text || null,
                  value_number: val?.value_number || null,
                  value_json: val?.value_json || null,
                  updated_at: val?.updated_at || null
                };
              });
            return { results: rows };
          }

          if (/WHERE\s+is_archived\s*=\s*0/i.test(sql)) {
            rows = rows.filter((r) => !r.is_archived);
          }
          if (/WHERE\s+(?:entity_type|table_name)\s*=\s*\?/i.test(sql)) {
            rows = rows.filter((r) => r.entity_type === values[0] || r.table_name === values[0]);
          }
          if (/WHERE\s+record_type\s*=\s*\?\s+AND\s+record_id\s*=\s*\?/i.test(sql)) {
            rows = rows.filter((r) => r.record_type === values[0] && r.record_id === Number(values[1]));
          }
          if (/WHERE\s+\(source_type\s*=\s*\?\s+AND\s+source_id\s*=\s*\?\)\s+OR\s+\(target_type\s*=\s*\?\s+AND\s+target_id\s*=\s*\?\)/i.test(sql)) {
            rows = rows.filter((r) =>
              (r.source_type === values[0] && r.source_id === Number(values[1])) ||
              (r.target_type === values[2] && r.target_id === Number(values[3]))
            );
          }

          return { results: rows };
        },
        async first() {
          const matchTable = sql.match(/FROM\s+(\w+)/i);
          const table = matchTable ? matchTable[1] : null;
          const rows = tables[table] || [];

          if (/WHERE id = \?/i.test(sql)) return rows.find((row) => row.id === Number(values[0])) || null;
          if (/WHERE (?:entity_type|table_name) = \? AND field_name = \?/i.test(sql)) {
            return rows.find((row) => (row.entity_type === values[0] || row.table_name === values[0]) && row.field_name === values[1]) || null;
          }
          if (/WHERE email = \?/i.test(sql)) return rows.find((row) => row.email === values[0]) || null;
          if (/WHERE sponsorship_id = \?/i.test(sql)) return rows.find((row) => row.sponsorship_id === Number(values[0]) && row.source === "sponsorship-sync") || null;
          if (/ORDER BY id DESC LIMIT 1/i.test(sql)) return rows.at(-1) || null;
          return rows[0] || null;
        },
        async run() {
          const insertCF = sql.match(/^INSERT INTO custom_field_values/i);
          if (insertCF) {
            if (!tables.custom_field_values) tables.custom_field_values = [];
            const [defId, entType, recId, valText, valNum, valJson, now] = values;
            let existing = tables.custom_field_values.find((v) => v.definition_id === Number(defId) && v.record_id === Number(recId));
            if (existing) {
              existing.value_text = valText;
              existing.value_number = valNum;
              existing.value_json = valJson;
              existing.updated_at = now;
            } else {
              tables.custom_field_values.push({
                id: tables.custom_field_values.length + 1,
                definition_id: Number(defId),
                entity_type: entType,
                record_id: Number(recId),
                value_text: valText,
                value_number: valNum,
                value_json: valJson,
                updated_at: now
              });
            }
            return { meta: { changes: 1 } };
          }

          const insert = sql.match(/^INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
          if (insert) {
            const table = insert[1];
            if (!tables[table]) tables[table] = [];
            const columns = insert[2].split(",").map((c) => c.trim());
            const row = Object.fromEntries(columns.map((c, i) => [c, values[i]]));
            row.id = Math.max(0, ...tables[table].map((item) => item.id || 0)) + 1;
            if (table === "notes") {
              row.is_pinned = Number(row.is_pinned || 0);
              row.is_archived = Number(row.is_archived || 0);
            }
            tables[table].push(row);
            return { meta: { last_row_id: row.id, changes: 1 } };
          }

          const update = sql.match(/^UPDATE (\w+) SET (.+) WHERE id = \?/i);
          if (update) {
            const table = update[1];
            const columns = update[2].split(",").map((p) => p.split("=")[0].trim());
            const row = tables[table]?.find((item) => item.id === Number(values.at(-1)));
            if (!row) return { meta: { changes: 0 } };
            columns.forEach((col, idx) => { row[col] = values[idx]; });
            return { meta: { changes: 1 } };
          }

          const deletion = sql.match(/^DELETE FROM (\w+) WHERE id = \?/i);
          if (deletion) {
            const table = deletion[1];
            const index = (tables[table] || []).findIndex((row) => row.id === Number(values[0]));
            if (index < 0) return { meta: { changes: 0 } };
            tables[table].splice(index, 1);
            return { meta: { changes: 1 } };
          }

          const sponsorshipDeletion = sql.match(/^DELETE FROM (\w+) WHERE sponsorship_id = \?/i);
          if (sponsorshipDeletion) {
            const table = sponsorshipDeletion[1];
            const before = tables[table].length;
            tables[table] = tables[table].filter((row) => row.sponsorship_id !== Number(values[0]) || row.source !== "sponsorship-sync");
            return { meta: { changes: before - tables[table].length } };
          }

          return { meta: { changes: 1 } };
        }
      };
    },
    async batch(stmts) {
      const results = [];
      for (const s of stmts) {
        results.push(await s.run());
      }
      return results;
    }
  };
}

describe("Less of Josh Cloudflare Worker", () => {
  it("redirects www.lessofjosh.com and http://lessofjosh.com to https://lessofjosh.com with 301", async () => {
    const env = createMockEnv();
    const res1 = await worker.fetch(new Request("https://www.lessofjosh.com/"), env);
    assert.equal(res1.status, 301);
    assert.equal(res1.headers.get("Location"), "https://lessofjosh.com/");

    const res2 = await worker.fetch(new Request("http://lessofjosh.com/"), env);
    assert.equal(res2.status, 301);
    assert.equal(res2.headers.get("Location"), "https://lessofjosh.com/");
  });

  it("renders the homepage with preserved SEO, JSON-LD, weight loss 232.6, metrics, and forms", async () => {
    const env = createMockEnv();
    const res = await worker.fetch(new Request("https://lessofjosh.com/"), env);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Content-Type") || "", /text\/html/);
    assert.ok(res.headers.get("Content-Security-Policy")?.includes("default-src 'self'"));
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(res.headers.get("X-Frame-Options"), "SAMEORIGIN");

    const html = await res.text();
    assert.ok(html.includes("<title>Josh Greenway (Less of Josh) | Creator Media Kit</title>"));
    assert.ok(html.includes("232.6 pounds down so far"));
    assert.ok(html.includes("<strong>232.6 lb</strong>"));
    assert.ok(html.includes('link rel="canonical" href="https://lessofjosh.com/"'));
    assert.ok(html.includes('id="loj-partner-form"'));
    assert.ok(html.includes('id="loj-media-form"'));
    assert.ok(html.includes('data-sitekey="test-site-key"'));
    assert.ok(html.includes('data-action="loj_brand"'));
    assert.ok(html.includes('data-action="loj_media"'));
    assert.ok(res.headers.get("Content-Security-Policy")?.includes("https://challenges.cloudflare.com"));
    assert.ok(html.includes("application/ld+json"));
    assert.ok(html.includes("1129 Washington ST E #809"));
  });

  it("serves social metrics JSON on /wp-json/less_of_josh_theme/v1/metrics", async () => {
    const env = createMockEnv();
    const res = await worker.fetch(
      new Request("https://lessofjosh.com/wp-json/less_of_josh_theme/v1/metrics"),
      env
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.platforms);
    for (const key of ["facebook", "instagram", "youtube", "tiktok"]) {
      assert.equal(typeof json.platforms[key].followers, "number");
      assert.equal(typeof json.platforms[key].views, "number");
      assert.equal(typeof json.platforms[key].engagement_rate, "number");
    }
    assert.equal(json.platforms.tiktok.followers, 31748);
  });

  it("handles Brand Partnership, Media Inquiry, and 3563media relay submissions", async () => {
    const env = createMockEnv({
      TURNSTILE_SECRET_KEY: "test-secret",
      FETCH: createTurnstileFetch()
    });
    const futureDate = new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10);

    // 1. Fetch fresh nonce
    const nonceRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-ajax.php?action=loj_theme_intake_nonce"),
      env
    );
    assert.equal(nonceRes.status, 200);
    const nonceJson = await nonceRes.json();
    assert.equal(nonceJson.success, true);
    const nonce = nonceJson.data.nonce;
    assert.match(nonce, /^[a-f0-9]{10}$/);

    // 2. Submit Brand Partnership form (also identical to 3563media.com relay)
    const brandBody = new URLSearchParams({
      action: "loj_theme_intake",
      loj_theme_nonce: nonce,
      brand: "Acme Outdoor Co",
      contact_name: "Jane Doe",
      contact_email: "jane@acmeoutdoor.com",
      budget: "2500-5000",
      target_date: futureDate,
      campaign_goals: "Launch Q4 campaign on TikTok and Reels",
      details: "Source: 35/63 Media inbound partnership brief (3563media.com)",
      company_website: "",
      "cf-turnstile-response": "brand-token"
    });

    const brandRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: brandBody.toString()
      }),
      env
    );
    assert.equal(brandRes.status, 200);
    const brandJson = await brandRes.json();
    assert.equal(brandJson.success, true);
    assert.equal(env._sentEmails.length, 1);
    assert.equal(env._sentEmails[0].toEmail, "colab@lessofus.com");
    assert.equal(env._sentEmails[0].subject, "[Brand partnership] Acme Outdoor Co");

    const replayRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: brandBody.toString()
      }),
      env
    );
    assert.equal(replayRes.status, 400);
    assert.equal(env._sentEmails.length, 1);

    // 3. Submit Media Inquiry form
    const mediaBody = new URLSearchParams({
      action: "loj_theme_media",
      loj_theme_nonce: nonce,
      media_name: "Alex Reporter",
      outlet: "WV Gazette",
      media_email: "alex@wvgazette.com",
      request_type: "podcast",
      deadline: futureDate,
      request: "Feature interview on sustainable weight loss.",
      company_website: "",
      "cf-turnstile-response": "media-token"
    });

    const mediaRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: mediaBody.toString()
      }),
      env
    );
    assert.equal(mediaRes.status, 200);
    const mediaJson = await mediaRes.json();
    assert.equal(mediaJson.success, true);
    assert.equal(env._sentEmails.length, 2);
    assert.equal(env._sentEmails[1].toEmail, "media@lessofjosh.com");
    assert.equal(env._sentEmails[1].subject, "[Media inquiry] WV Gazette: Podcast");

    // 4. Honeypot trap should return success without sending email
    const botBody = new URLSearchParams({
      action: "loj_theme_media",
      loj_theme_nonce: nonce,
      media_name: "Spam Bot",
      outlet: "Spam",
      media_email: "spam@bot.net",
      request_type: "other",
      request: "Buy links",
      company_website: "https://spambot.example"
    });
    const botRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: botBody.toString()
      }),
      env
    );
    assert.equal(botRes.status, 200);
    const botJson = await botRes.json();
    assert.equal(botJson.success, true);
    assert.equal(env._sentEmails.length, 2);

    const contactBody = new URLSearchParams(brandBody);
    contactBody.set("cf-turnstile-response", "contact-token");
    const contactRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: contactBody.toString()
      }),
      env
    );
    assert.equal(contactRes.status, 200);
    assert.equal(env._sentEmails.length, 3);

    // 5. A normal form POST still works when JavaScript submits a fresh widget token.
    const noJsBody = new URLSearchParams(mediaBody);
    noJsBody.set("cf-turnstile-response", "nojs-token");
    const noJsRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-post.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: noJsBody.toString()
      }),
      env
    );
    assert.equal(noJsRes.status, 302);
    assert.equal(noJsRes.headers.get("Location"), "/?loj-intake=success&loj-form=media#media");
  });

  it("fails closed for missing, mismatched, and unavailable Turnstile validation", async () => {
    const env = createMockEnv({ TURNSTILE_SECRET_KEY: "test-secret", FETCH: createTurnstileFetch() });
    const nonceRes = await worker.fetch(
      new Request("https://lessofjosh.com/wp-admin/admin-ajax.php?action=loj_theme_intake_nonce"),
      env
    );
    const nonce = (await nonceRes.json()).data.nonce;
    const base = {
      action: "loj_theme_intake",
      loj_theme_nonce: nonce,
      brand: "Acme",
      contact_name: "Jane Doe",
      contact_email: "jane@acme.example",
      budget: "2500-5000",
      target_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      campaign_goals: "Launch campaign",
      company_website: ""
    };

    for (const token of [undefined, "bad-action-token", "network-token"]) {
      const body = new URLSearchParams(base);
      if (token) body.set("cf-turnstile-response", token);
      const response = await worker.fetch(
        new Request("https://lessofjosh.com/wp-admin/admin-ajax.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body
        }),
        env
      );
      assert.equal(response.status, 400);
    }
    assert.equal(env._sentEmails.length, 0);
  });

  it("serves the Media Kit PDF on /media-kit-download/ and redirects /media-kit/print", async () => {
    const env = createMockEnv();
    const pdfRes = await worker.fetch(new Request("https://lessofjosh.com/media-kit-download/"), env);
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers.get("Content-Type"), "application/pdf");
    assert.match(pdfRes.headers.get("Content-Disposition") || "", /Less-of-Josh-Media-Kit\.pdf/);
    const bytes = new Uint8Array(await pdfRes.arrayBuffer());
    assert.ok(bytes.byteLength > 600000);
    assert.equal(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");

    const printRes = await worker.fetch(new Request("https://lessofjosh.com/media-kit/print"), env);
    assert.equal(printRes.status, 301);
    assert.equal(printRes.headers.get("Location"), "https://lessofjosh.com/media-kit-download/");
  });

  it("serves sitemaps, robots.txt, legacy /wp-content/ assets, and 404 for unknown routes", async () => {
    const env = createMockEnv();
    const robots = await worker.fetch(new Request("https://lessofjosh.com/robots.txt"), env);
    assert.equal(robots.status, 200);
    assert.ok((await robots.text()).includes("Sitemap: https://lessofjosh.com/wp-sitemap.xml"));

    const sitemap = await worker.fetch(new Request("https://lessofjosh.com/wp-sitemap.xml"), env);
    assert.equal(sitemap.status, 200);
    assert.ok((await sitemap.text()).includes("wp-sitemap-posts-page-1.xml"));

    const legacySvg = await worker.fetch(
      new Request("https://lessofjosh.com/wp-content/themes/less-of-josh-theme/assets/images/less-of-josh-mark-64.svg?ver=2.0.3"),
      env
    );
    assert.equal(legacySvg.status, 200);

    const notFound = await worker.fetch(new Request("https://lessofjosh.com/non-existent-page"), env);
    assert.equal(notFound.status, 404);
  });

  it("redirects unauthenticated /dashboard and /admin requests to /auth/login with 302 and no-store headers", async () => {
    const env = createMockEnv();
    const dashRes = await worker.fetch(new Request("https://lessofjosh.com/dashboard"), env);
    assert.equal(dashRes.status, 302);
    assert.equal(dashRes.headers.get("Location"), "https://lessofjosh.com/auth/login");
    assert.equal(dashRes.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
    assert.equal(dashRes.headers.get("X-Robots-Tag"), "noindex, nofollow");

    const adminRes = await worker.fetch(new Request("https://lessofjosh.com/admin"), env);
    assert.equal(adminRes.status, 302);
    assert.equal(adminRes.headers.get("Location"), "https://lessofjosh.com/auth/login");

    // Tampered session cookie
    const tamperedRes = await worker.fetch(
      new Request("https://lessofjosh.com/dashboard", {
        headers: { Cookie: "loj_admin_session=forged.signature" }
      }),
      env
    );
    assert.equal(tamperedRes.status, 302);
    assert.equal(tamperedRes.headers.get("Location"), "https://lessofjosh.com/auth/login");
  });

  it("protects /api/dashboard/* endpoints requiring owner authentication (401)", async () => {
    const env = createMockEnv();
    const refreshRes = await worker.fetch(
      new Request("https://lessofjosh.com/api/dashboard/refresh", { method: "POST" }),
      env
    );
    assert.equal(refreshRes.status, 401);
    const refreshJson = await refreshRes.json();
    assert.match(refreshJson.error, /Unauthorized/);
    assert.equal(refreshRes.headers.get("Cache-Control"), "private, no-store");

    const settingsRes = await worker.fetch(
      new Request("https://lessofjosh.com/api/dashboard/settings", { method: "POST" }),
      env
    );
    assert.equal(settingsRes.status, 401);
  });

  it("protects every Command Center page, asset, hostname, and API entry point", async () => {
    const env = createMockEnv();
    for (const pathName of ["/commandcenter", "/commandcenter/", "/commandcenter//?view=tasks", "/commandcenter/app.js", "/commandcenter/private.json"]) {
      const response = await worker.fetch(new Request(`https://lessofjosh.com${pathName}`), env);
      assert.equal(response.status, 302, pathName);
      assert.equal(response.headers.get("Location"), "https://lessofjosh.com/auth/login?redirect=/commandcenter");
      assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    }

    const www = await worker.fetch(new Request("https://www.lessofjosh.com/commandcenter?view=tasks"), env);
    assert.equal(www.status, 301);
    assert.equal(www.headers.get("Location"), "https://lessofjosh.com/commandcenter?view=tasks");

    for (const request of [
      new Request("https://lessofjosh.com/api/commandcenter/dashboard"),
      new Request("https://lessofjosh.com/api/commandcenter/sponsorships/", { method: "POST" }),
      new Request("https://lessofjosh.com/api/commandcenter/sponsorships/1", { method: "DELETE" })
    ]) {
      const response = await worker.fetch(request, env);
      assert.equal(response.status, 401);
      assert.match((await response.json()).error, /Unauthorized/);
    }

    assert.equal((await worker.fetch(new Request("https://lessofjosh.com/CommandCenter"), env)).status, 404);
    assert.equal((await worker.fetch(new Request("https://lessofjosh.com/%63ommandcenter-secret"), env)).status, 404);
  });

  it("allows both listed Google accounts and rejects a signed session for any other account", async () => {
    const env = createMockEnv();
    for (const email of DEFAULT_ALLOWED_EMAILS) {
      const sessionCookie = await createAdminSessionCookie({ sub: `sub-${email}`, email, name: email }, env, true);
      const cookie = sessionCookie.split(";")[0];
      const page = await worker.fetch(new Request("https://lessofjosh.com/commandcenter/", { headers: { Cookie: cookie } }), env);
      assert.equal(page.status, 200, email);
      assert.match(await page.text(), /Less of Josh Command Center/);

      const asset = await worker.fetch(new Request("https://lessofjosh.com/commandcenter/app.js", { headers: { Cookie: cookie } }), env);
      assert.equal(asset.status, 200, email);
      assert.match(await asset.text(), /api\/commandcenter\/meta/);
    }

    const unauthorizedCookie = (await createAdminSessionCookie({ sub: "stranger", email: "stranger@gmail.com" }, env, true)).split(";")[0];
    const page = await worker.fetch(new Request("https://lessofjosh.com/commandcenter", { headers: { Cookie: unauthorizedCookie } }), env);
    assert.equal(page.status, 302);
    const api = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/meta", { headers: { Cookie: unauthorizedCookie } }), env);
    assert.equal(api.status, 401);
  });

  it("requires CSRF for Command Center mutations and supports authenticated CRUD", async () => {
    const DB = createMockD1();
    const env = createMockEnv({ DB });
    const session = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const cookie = (await createAdminSessionCookie(session, env, true)).split(";")[0];
    const csrf = await createDashboardCsrfToken(session, env);

    const missingCsrf = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/sponsorships", {
      method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ brand: "Test Brand" })
    }), env);
    assert.equal(missingCsrf.status, 403);

    const created = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/sponsorships", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-Dashboard-Csrf": csrf },
      body: JSON.stringify({ brand: "Test Brand", status: "Prospect", notes: "Create check" })
    }), env);
    assert.equal(created.status, 201);
    const item = await created.json();
    assert.equal(item.brand, "Test Brand");

    const updated = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/sponsorships/${item.id}`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-Dashboard-Csrf": csrf },
      body: JSON.stringify({ notes: "Update check" })
    }), env);
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).notes, "Update check");

    const fetched = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/sponsorships/${item.id}`, { headers: { Cookie: cookie } }), env);
    assert.equal(fetched.status, 200);
    assert.equal((await fetched.json()).brand, "Test Brand");

    const deleted = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/sponsorships/${item.id}`, {
      method: "DELETE", headers: { Cookie: cookie, "X-Dashboard-Csrf": csrf }
    }), env);
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json()).deleted, true);
  });

  it("initiates Google OAuth flow on /auth/login and /api/auth/google/login with signed state cookie", async () => {
    const env = createMockEnv();
    const loginRes = await worker.fetch(new Request("https://lessofjosh.com/auth/login"), env);
    assert.equal(loginRes.status, 302);
    const location = loginRes.headers.get("Location");
    assert.ok(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
    const locUrl = new URL(location);
    assert.equal(locUrl.searchParams.get("client_id"), DEFAULT_GOOGLE_CLIENT_ID);
    assert.equal(locUrl.searchParams.get("redirect_uri"), "https://lessofjosh.com/auth/callback");
    assert.equal(locUrl.searchParams.get("response_type"), "code");
    assert.equal(locUrl.searchParams.get("scope"), "openid email profile");
    assert.ok(locUrl.searchParams.get("state"));
    assert.ok(locUrl.searchParams.get("nonce"));

    const setCookie = loginRes.headers.get("Set-Cookie");
    assert.ok(setCookie.includes("__loj_oauth_state="));
    assert.ok(setCookie.includes("HttpOnly"));
    assert.ok(setCookie.includes("SameSite=Lax"));
    assert.ok(setCookie.includes("Secure"));

    const commandCenterLogin = await worker.fetch(new Request("https://lessofjosh.com/auth/login?redirect=/commandcenter"), env);
    const commandCenterUrl = new URL(commandCenterLogin.headers.get("Location"));
    const statePayload = await verifyOAuthStateCookie(
      commandCenterLogin.headers.get("Set-Cookie").split(";")[0],
      commandCenterUrl.searchParams.get("state"),
      env
    );
    assert.equal(statePayload.redirect, "/commandcenter");
  });

  it("handles Google OAuth callback: rejects invalid state, rejects unauthorized emails, and authorizes owner", async () => {
    const env = createMockEnv();

    // 1. Missing code/state
    const missingRes = await worker.fetch(new Request("https://lessofjosh.com/auth/callback"), env);
    assert.equal(missingRes.status, 403);
    assert.ok((await missingRes.text()).includes("Google Authorization Failed"));

    // 2. Invalid / missing state cookie
    const badStateRes = await worker.fetch(
      new Request("https://lessofjosh.com/auth/callback?code=test-code&state=bad-state"),
      env
    );
    assert.equal(badStateRes.status, 403);
    assert.ok((await badStateRes.text()).includes("State Verification Failed"));

    // 3. Setup mock RSA keypair and tokens
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["sign", "verify"]
    );
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    publicJwk.kid = "test-jwt-kid-1";

    const testState = "state-abc-123";
    const testNonce = "nonce-xyz-789";
    const stateCookieHeader = (await createOAuthStateCookie(testState, testNonce, env, true)).split(";")[0];

    async function makeIdToken(email, nonce = testNonce, verified = true) {
      const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: "RS256", kid: "test-jwt-kid-1" })));
      const now = Math.floor(Date.now() / 1000);
      const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
        iss: "https://accounts.google.com",
        aud: DEFAULT_GOOGLE_CLIENT_ID,
        sub: "google-uid-" + email,
        email,
        email_verified: verified,
        nonce,
        exp: now + 3600
      })));
      const sig = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        keyPair.privateKey,
        new TextEncoder().encode(`${header}.${payload}`)
      );
      return `${header}.${payload}.${base64UrlEncode(new Uint8Array(sig))}`;
    }

    const originalFetch = globalThis.fetch;
    let nextTokenResponse = null;

    globalThis.fetch = async (input, init) => {
      const urlStr = String(input);
      if (urlStr.includes("openid-configuration")) {
        return Response.json({
          authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
          token_endpoint: "https://oauth2.googleapis.com/token",
          jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
          issuer: "https://accounts.google.com"
        });
      }
      if (urlStr.includes("oauth2.googleapis.com/token") || urlStr === "https://oauth2.googleapis.com/token") {
        return Response.json(nextTokenResponse);
      }
      if (urlStr.includes("oauth2/v3/certs")) {
        return Response.json({ keys: [publicJwk] });
      }
      return originalFetch(input, init);
    };

    try {
      // 4. Unauthorized email rejection (stranger@gmail.com)
      nextTokenResponse = {
        access_token: "mock-access-token",
        id_token: await makeIdToken("stranger@gmail.com")
      };

      const unauthorizedRes = await worker.fetch(
        new Request(`https://lessofjosh.com/auth/callback?code=valid-code&state=${testState}`, {
          headers: { Cookie: stateCookieHeader }
        }),
        env
      );
      assert.equal(unauthorizedRes.status, 403);
      const deniedHtml = await unauthorizedRes.text();
      assert.ok(deniedHtml.includes("Access Denied — Owner Only"));
      assert.ok(deniedHtml.includes("stranger@gmail.com"));
      assert.ok(!unauthorizedRes.headers.get("Set-Cookie").includes("loj_admin_session="));

      // 5. Authorized owner email approval (jwgreenway@gmail.com)
      nextTokenResponse = {
        access_token: "mock-access-token-owner",
        id_token: await makeIdToken(DEFAULT_OWNER_EMAIL)
      };

      const authorizedRes = await worker.fetch(
        new Request(`https://lessofjosh.com/auth/callback?code=valid-owner-code&state=${testState}`, {
          headers: { Cookie: stateCookieHeader }
        }),
        env
      );
      assert.equal(authorizedRes.status, 302);
      assert.equal(authorizedRes.headers.get("Location"), "https://lessofjosh.com/dashboard");
      const cookies = authorizedRes.headers.getSetCookie();
      const sessionCookie = cookies.find((c) => c.startsWith("loj_admin_session="));
      assert.ok(sessionCookie);
      assert.ok(sessionCookie.includes("HttpOnly"));
      assert.ok(sessionCookie.includes("SameSite=Lax"));
      assert.ok(sessionCookie.includes("Secure"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders the private owner dashboard on /dashboard when authenticated with valid session cookie", async () => {
    const env = createMockEnv();
    const sessionCookieStr = await createAdminSessionCookie(
      { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" },
      env,
      true
    );
    const cookieHeader = sessionCookieStr.split(";")[0];

    const res = await worker.fetch(
      new Request("https://lessofjosh.com/dashboard", {
        headers: { Cookie: cookieHeader }
      }),
      env
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/html; charset=UTF-8");
    assert.equal(res.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");

    const html = await res.text();
    assert.ok(html.includes("Less of Josh — Private Owner Dashboard"));
    assert.ok(html.includes(DEFAULT_OWNER_EMAIL));
    assert.ok(html.includes("TikTok"));
    assert.ok(html.includes("Instagram"));
    assert.ok(html.includes("Facebook"));
    assert.ok(html.includes("YouTube"));
    assert.ok(html.includes("Pounds Lost So Far"));
    assert.ok(html.includes("noindex, nofollow"));
  });

  it("allows authenticated owner to refresh social metrics and update site settings in KV", async () => {
    const env = createMockEnv();
    const session = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const sessionCookieStr = await createAdminSessionCookie(session, env, true);
    const cookieHeader = sessionCookieStr.split(";")[0];
    const csrfToken = await createDashboardCsrfToken(session, env);

    // 1. Settings update via JSON/API
    const updateRes = await worker.fetch(
      new Request("https://lessofjosh.com/api/dashboard/settings", {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
          "X-Dashboard-Csrf": csrfToken
        },
        body: JSON.stringify({
          current_weight_loss: "235.5",
          brand_email: "colab@lessofus.com",
          media_email: "media@lessofjosh.com"
        })
      }),
      env
    );
    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.success, true);
    assert.equal(updateJson.settings.current_weight_loss, "235.5");

    // Verify stored in KV
    const kvSettings = await env.LOJ_KV.get("site_settings_v1", { type: "json" });
    assert.equal(kvSettings.current_weight_loss, "235.5");

    // 2. Metrics refresh via API
    const refreshRes = await worker.fetch(
      new Request("https://lessofjosh.com/api/dashboard/refresh", {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          Accept: "application/json",
          "X-Dashboard-Csrf": csrfToken
        }
      }),
      env
    );
    assert.equal(refreshRes.status, 200);
    const refreshJson = await refreshRes.json();
    assert.equal(refreshJson.success, true);
  });

  it("clears the session cookie on /auth/logout and redirects to /", async () => {
    const env = createMockEnv();
    const logoutRes = await worker.fetch(new Request("https://lessofjosh.com/auth/logout"), env);
    assert.equal(logoutRes.status, 302);
    assert.equal(logoutRes.headers.get("Location"), "https://lessofjosh.com/");
    const setCookie = logoutRes.headers.get("Set-Cookie");
    assert.ok(setCookie.includes("loj_admin_session=;"));
    assert.ok(setCookie.includes("Max-Age=0"));
  });

  it("supports Notes and Documents CRUD, pinning, and archiving", async () => {
    const DB = createMockD1();
    const env = createMockEnv({ DB });
    const session = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const cookie = (await createAdminSessionCookie(session, env, true)).split(";")[0];
    const csrf = await createDashboardCsrfToken(session, env);

    // 1. Create Note
    const createRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/notes", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-Dashboard-Csrf": csrf },
      body: JSON.stringify({
        title: "Q4 Sponsorship Strategy Playbook",
        category: "Strategy",
        tags: "sponsorship,q4,playbook",
        body: "# Q4 Strategy\n\nDeliverables for Q4 brand partnerships."
      })
    }), env);
    assert.equal(createRes.status, 201);
    const { note } = await createRes.json();
    assert.equal(note.title, "Q4 Sponsorship Strategy Playbook");
    assert.equal(note.is_pinned, 0);

    // 2. Pin Note
    const pinRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/notes/${note.id}/pin`, {
      method: "POST",
      headers: { Cookie: cookie, "X-Dashboard-Csrf": csrf }
    }), env);
    assert.equal(pinRes.status, 200);
    const pinJson = await pinRes.json();
    assert.equal(pinJson.pinned, 1);

    // 3. Update Note
    const updateRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/notes/${note.id}`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-Dashboard-Csrf": csrf },
      body: JSON.stringify({
        body: "# Q4 Strategy Updated\n\nRevised pricing and rate card."
      })
    }), env);
    assert.equal(updateRes.status, 200);

    // 4. Archive Note
    const archiveRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/notes/${note.id}/archive`, {
      method: "POST",
      headers: { Cookie: cookie, "X-Dashboard-Csrf": csrf }
    }), env);
    assert.equal(archiveRes.status, 200);
    const archiveJson = await archiveRes.json();
    assert.equal(archiveJson.archived, 1);

    // 5. Delete Note
    const delRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/notes/${note.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie, "X-Dashboard-Csrf": csrf }
    }), env);
    assert.equal(delRes.status, 200);
    assert.equal((await delRes.json()).success, true);
  });

  it("supports Universal Search across multiple entity tables with token matching", async () => {
    const DB = createMockD1();
    DB.tables.sponsorships.push({
      id: 1,
      brand: "Goli Nutrition",
      category: "Supplements",
      status: "Contracted",
      notes: "Dedicated YouTube integration with custom discount code"
    });
    DB.tables.notes.push({
      id: 1,
      title: "Goli Campaign Talking Points",
      category: "Sponsorships",
      body: "Emphasize daily routine and weight loss journey consistency",
      is_archived: 0
    });

    const env = createMockEnv({ DB });
    const session = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const cookie = (await createAdminSessionCookie(session, env, true)).split(";")[0];

    const searchRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/search?q=Goli", {
      headers: { Cookie: cookie }
    }), env);
    assert.equal(searchRes.status, 200);
    const data = await searchRes.json();
    assert.ok(data.total >= 2);
    assert.ok(data.results.some((r) => r.type === "sponsorships" && r.title.includes("Goli")));
    assert.ok(data.results.some((r) => r.type === "notes" && r.title.includes("Goli")));
  });

  it("manages secure file attachments backed by KV and blocks unauthenticated access", async () => {
    const DB = createMockD1();
    const env = createMockEnv({ DB });
    const session = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const cookie = (await createAdminSessionCookie(session, env, true)).split(";")[0];
    const csrf = await createDashboardCsrfToken(session, env);

    // 1. Upload File (multipart/form-data)
    const formData = new FormData();
    formData.append("file", new File(["Test contract PDF binary bytes"], "goli_contract_2026.pdf", { type: "application/pdf" }));
    formData.append("record_type", "sponsorships");
    formData.append("record_id", "1");
    formData.append("category", "contract");
    formData.append("description", "Executed sponsorship agreement");

    const uploadRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/files/upload", {
      method: "POST",
      headers: { Cookie: cookie, "X-Dashboard-Csrf": csrf },
      body: formData
    }), env);
    assert.equal(uploadRes.status, 201);
    const { attachment } = await uploadRes.json();
    assert.equal(attachment.filename, "goli_contract_2026.pdf");
    assert.equal(attachment.mime_type, "application/pdf");

    // 2. Verify unauthenticated access to file is blocked (security requirement)
    const unauthRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/files/${attachment.id}/view`), env);
    assert.equal(unauthRes.status, 401);

    // 3. Authenticated view
    const viewRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/files/${attachment.id}/view`, {
      headers: { Cookie: cookie }
    }), env);
    assert.equal(viewRes.status, 200);
    assert.equal(viewRes.headers.get("Content-Type"), "application/pdf");
    assert.equal(await viewRes.text(), "Test contract PDF binary bytes");

    // 4. Authenticated download
    const dlRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/files/${attachment.id}/download`, {
      headers: { Cookie: cookie }
    }), env);
    assert.equal(dlRes.status, 200);
    assert.ok(dlRes.headers.get("Content-Disposition").includes("attachment;"));

    // 5. Delete file
    const delRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/files/${attachment.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie, "X-Dashboard-Csrf": csrf }
    }), env);
    assert.equal(delRes.status, 200);
    assert.equal((await delRes.json()).success, true);
  });

  it("supports bidirectional record relationships", async () => {
    const DB = createMockD1();
    const env = createMockEnv({ DB });
    const session = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const cookie = (await createAdminSessionCookie(session, env, true)).split(";")[0];
    const csrf = await createDashboardCsrfToken(session, env);

    // 1. Create Relationship
    const linkRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/relationships", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-Dashboard-Csrf": csrf },
      body: JSON.stringify({
        source_type: "sponsorships",
        source_id: 1,
        target_type: "content",
        target_id: 10,
        relationship_type: "relates_to"
      })
    }), env);
    assert.equal(linkRes.status, 201);
    const { relationship } = await linkRes.json();
    assert.equal(relationship.source_type, "sponsorships");
    assert.equal(relationship.target_id, 10);

    // 2. Query relationships for source
    const getRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/relationships?record_type=sponsorships&record_id=1", {
      headers: { Cookie: cookie }
    }), env);
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.relationships.length, 1);

    // 3. Delete Relationship
    const delRes = await worker.fetch(new Request(`https://lessofjosh.com/api/commandcenter/relationships/${relationship.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie, "X-Dashboard-Csrf": csrf }
    }), env);
    assert.equal(delRes.status, 200);
    assert.equal((await delRes.json()).success, true);
  });

  it("supports custom field definitions and record values", async () => {
    const DB = createMockD1();
    const env = createMockEnv({ DB });
    const session = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const cookie = (await createAdminSessionCookie(session, env, true)).split(";")[0];
    const csrf = await createDashboardCsrfToken(session, env);

    // 1. Create Definition
    const defRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/custom-fields/definitions", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-Dashboard-Csrf": csrf },
      body: JSON.stringify({
        table_name: "sponsorships",
        field_name: "target_roi",
        field_label: "Target ROI",
        field_type: "currency",
        default_value: "5000.00"
      })
    }), env);
    assert.equal(defRes.status, 201);

    // 2. Save Values
    const saveRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/custom-fields/values", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-Dashboard-Csrf": csrf },
      body: JSON.stringify({
        record_type: "sponsorships",
        record_id: 1,
        values: { target_roi: "7500.00" }
      })
    }), env);
    assert.equal(saveRes.status, 200);

    // 3. Fetch Definitions
    const fetchDefRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/custom-fields/definitions?table_name=sponsorships", {
      headers: { Cookie: cookie }
    }), env);
    assert.equal(fetchDefRes.status, 200);
    assert.equal((await fetchDefRes.json()).definitions.length, 1);
  });

  it("enforces Josh & Rita permissions and module access controls", async () => {
    const DB = createMockD1();
    const env = createMockEnv({ DB });
    const ownerSession = { sub: "12345", email: DEFAULT_OWNER_EMAIL, name: "Josh Greenway" };
    const ownerCookie = (await createAdminSessionCookie(ownerSession, env, true)).split(";")[0];

    // Owner can view users
    const usersRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/users", {
      headers: { Cookie: ownerCookie }
    }), env);
    assert.equal(usersRes.status, 200);
    const usersJson = await usersRes.json();
    assert.equal(usersJson.users.length, 2);

    // Test authorized user with restricted modules
    const ritaSession = { sub: "67890", email: "ritagreenway304@gmail.com", name: "Rita Greenway" };
    const ritaCookie = (await createAdminSessionCookie(ritaSession, env, true)).split(";")[0];
    const ritaRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/meta", {
      headers: { Cookie: ritaCookie }
    }), env);
    assert.equal(ritaRes.status, 200);

    // Backup restore guide is available to authorized users
    const guideRes = await worker.fetch(new Request("https://lessofjosh.com/api/commandcenter/backup/restore-guide", {
      headers: { Cookie: ownerCookie }
    }), env);
    assert.equal(guideRes.status, 200);
    const guideJson = await guideRes.json();
    assert.ok(guideJson.guide_markdown.includes("Command Center"));
  });
});
