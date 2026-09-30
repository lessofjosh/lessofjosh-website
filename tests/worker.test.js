import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";

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
});
