# Less of Josh — Cloudflare Workers Migration & Operations Guide

## 1. Architecture Overview

`lessofjosh.com` runs entirely on **Cloudflare Workers** (`less-of-josh`) with:
- **Worker Custom Domains**: `lessofjosh.com` and `www.lessofjosh.com` (`www` 301-redirects to `https://lessofjosh.com`).
- **Cloudflare Workers Static Assets (`ASSETS`)**: Serves fonts, AVIF/WebP/SVG images, `media-kit.js`, `robots.txt`, and the cached `Less-of-Josh-Media-Kit.pdf` from `./public` (including legacy `/wp-content/themes/less-of-josh-theme/assets/*` and `/wp-content/uploads/2026/06/*` URL aliases).
- **Cloudflare KV (`LOJ_KV`, ID `e8ee96e002e74988aba0dbe55f86115f`)**:
  - `metrics_last_good_v2`: Cached live audience metrics across TikTok, Instagram, Facebook, and YouTube.
  - `metrics_status_v3`: Per-platform refresh diagnostics and timestamps.
  - `tiktok_tokens_v1`: Rotating TikTok OAuth2 `access` and `refresh` tokens.
  - `site_settings_v1`: Site configuration (`current_weight_loss`, `brand_email`, `media_email`, `mail_from`, `mailing_address`).
  - `media_kit_pdf_v1`: Binary fallback cache of `Less-of-Josh-Media-Kit.pdf`.
- **Cloudflare Cron Trigger (`0 */3 * * *`)**: Refreshes TikTok, Instagram, Facebook, and YouTube metrics every 3 hours via `scheduled()` in `src/worker.js` → `refreshAllMetrics()` in `src/metrics/index.js`.
- **Outbound Mail (`src/forms/smtp.js`)**: Sends authenticated STARTTLS SMTP emails via `cloudflare:sockets` through `smtp.mail.me.com:587` (`From: "Less of Josh Website" <josh@lessofjosh.com>`), preserving Microsoft 365 DNS records untouched.

---

## 2. How to Deploy

```bash
npx wrangler deploy
```

---

## 3. How to Update `current_weight_loss` (and Other Site Settings)

`current_weight_loss` is read dynamically from Cloudflare KV (`site_settings_v1`) with fallback to `src/data/site-config.json` (current value: `"232.6"`).

### Option A: Instant KV Update (No Redeploy Required)
```bash
npx wrangler kv key put --namespace-id=e8ee96e002e74988aba0dbe55f86115f "site_settings_v1" '{
  "current_weight_loss": "235.0",
  "brand_email": "colab@lessofus.com",
  "media_email": "media@lessofjosh.com",
  "mail_from": "josh@lessofjosh.com",
  "mailing_address": "1129 Washington ST E #809 Lewisburg WV 24901"
}' --remote
```

### Option B: Version-Controlled Update + PDF Rebuild
1. Edit `"current_weight_loss"` in `src/data/site-config.json`.
2. Rebuild the 5-page US Letter PDF:
   ```bash
   npm run build:pdf
   ```
3. Update KV and deploy:
   ```bash
   npx wrangler kv key put --namespace-id=e8ee96e002e74988aba0dbe55f86115f "media_kit_pdf_v1" --path=public/assets/pdf/Less-of-Josh-Media-Kit.pdf --remote
   npx wrangler deploy
   ```

---

## 4. Cloudflare Worker Secrets

Secrets are stored in Cloudflare Workers Secrets (never in Git). Manage them via `npx wrangler secret put <SECRET_NAME>`:

| Secret Name | Purpose |
| :--- | :--- |
| `LOJ_NONCE_SECRET` | HMAC-SHA256 key for form nonces and IP rate-limit hashing |
| `LOJ_SMTP_USERNAME` | iCloud Mail primary username for `smtp.mail.me.com:587` |
| `LOJ_SMTP_PASSWORD` | iCloud Mail app-specific password |
| `LOJ_YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `LOJ_YOUTUBE_CHANNEL_ID` | YouTube Channel ID |
| `LOJ_YOUTUBE_HANDLE` | YouTube handle (`@LessofJosh`) |
| `LOJ_TIKTOK_CLIENT_KEY` | TikTok Login Kit / Display API client key |
| `LOJ_TIKTOK_CLIENT_SECRET` | TikTok client secret |
| `LOJ_TIKTOK_ACCESS_TOKEN` | Initial TikTok access token (rotated in KV `tiktok_tokens_v1`) |
| `LOJ_TIKTOK_REFRESH_TOKEN` | Initial TikTok refresh token (rotated in KV `tiktok_tokens_v1`) |
| `LOJ_META_APP_ID` | Meta App ID |
| `LOJ_META_APP_SECRET` | Meta App Secret (used for `appsecret_proof` HMAC signing) |
| `LOJ_INSTAGRAM_ACCESS_TOKEN` | Instagram Graph API token |
| `LOJ_INSTAGRAM_USER_ID` | Instagram professional account ID (`17841475966820642`) |
| `LOJ_INSTAGRAM_API_HOST` | `https://graph.facebook.com` or `https://graph.instagram.com` |
| `LOJ_FACEBOOK_PAGE_ACCESS_TOKEN` | Facebook Page access token |
| `LOJ_FACEBOOK_PAGE_ID` | Facebook Page ID (`680647665137577`) |

---

## 5. Forms & `3563media.com` Contact Relay

Both public forms on `lessofjosh.com` and the external `https://3563media.com/contact` Worker relay submit through:
- `GET https://lessofjosh.com/wp-admin/admin-ajax.php?action=loj_theme_intake_nonce` → issues a fresh 12-hour HMAC nonce (`{ "success": true, "data": { "nonce": "..." } }`).
- `POST https://lessofjosh.com/wp-admin/admin-ajax.php` (AJAX) or `POST https://lessofjosh.com/wp-admin/admin-post.php` (No-JS fallback):
  - `action=loj_theme_intake` → Brand Partnership Inquiry → `colab@lessofus.com`
  - `action=loj_theme_media` → Media Inquiry → `media@lessofjosh.com`

---

## 6. Pre-Cutover Backup & Rollback Procedure

### Backup Location
`/Users/joshuagreenway/Documents/lessofjosh-checkpoints/pre-cloudflare-cutover-20260930/` (`chmod 700`, verified via `SHA256SUMS`):
- `db.sql.gz` — Full MySQL dump of `dbnqfslfhpgimt`
- `site-files.tgz` — Full `/home/customer/www/lessofjosh.com/public_html` archive
- `less-of-josh-theme.tgz` — Active WordPress theme (`v2.0.3`)
- `uploads.tgz` — `wp-content/uploads`
- `Less-of-Josh-Media-Kit-live.pdf` — Pre-cutover 5-page PDF binary
- `dns-records.txt`, `htaccess.txt`, `environment-inventory.json`, `ROLLBACK.md`

### Instant Rollback to SiteGround
SiteGround (`35.212.85.40`) remains untouched. To revert traffic back to SiteGround:
1. Remove the `routes` block (`lessofjosh.com` and `www.lessofjosh.com`) from `wrangler.jsonc` and run `npx wrangler deploy` (or delete the Custom Domains in the Cloudflare Dashboard under **Workers & Pages → less-of-josh → Settings → Domains & Routes**).
2. Re-add the proxied Cloudflare DNS records pointing to SiteGround (`35.212.85.40`):
   - `A` `lessofjosh.com` → `35.212.85.40` (Proxied)
   - `CNAME` `www` → `lessofjosh.com` (Proxied)
3. See `/Users/joshuagreenway/Documents/lessofjosh-checkpoints/pre-cloudflare-cutover-20260930/ROLLBACK.md` for full details.
