# Less of Josh (`lessofjosh.com`)

Production Cloudflare Worker for **[lessofjosh.com](https://lessofjosh.com)** — creator media kit, live cross-platform social metrics, downloadable 5-page US Letter PDF media kit, brand partnership & media inquiry intake forms, and the `3563media.com` contact relay.

## Architecture

```text
lessofjosh/
├── src/
│   ├── worker.js              # Main fetch() & scheduled() Worker entrypoint
│   ├── data/
│   │   ├── critical-css.js    # Inlined critical CSS (loj-theme + media-kit)
│   │   └── site-config.json   # Default weight loss, contact destinations, and fallback metrics
│   ├── routes/
│   │   ├── home.js            # Media kit homepage, SEO meta, Open Graph, and JSON-LD @graph
│   │   ├── seo.js             # /wp-sitemap.xml, /sitemap.xml, /wp-sitemap-posts-page-1.xml
│   │   └── not-found.js       # 404 fallback route
│   ├── metrics/
│   │   └── index.js           # Cron trigger (0 */3 * * *) + KV cache + /wp-json/less_of_josh_theme/v1/metrics
│   ├── forms/
│   │   ├── index.js           # /wp-admin/admin-ajax.php & /wp-admin/admin-post.php + 3563media.com relay
│   │   └── smtp.js            # Authenticated STARTTLS SMTP over cloudflare:sockets (smtp.mail.me.com:587)
│   ├── pdf/
│   │   ├── index.js           # /media-kit-download/ & /download-pdf PDF delivery + print redirects
│   │   └── template.js        # 5-page US Letter media kit HTML template
│   └── utilities/
│       ├── data.js            # Canonical data model & formatting utilities (LOJ_Theme_Data port)
│       └── security.js        # CSP, HSTS, security headers, and HMAC nonces
├── public/
│   ├── assets/                # Fonts, images, CSS, JS, icons, and pre-built Media Kit PDF
│   ├── images/                # Public image mirrors
│   ├── fonts/                 # Self-hosted Manrope variable & static fonts
│   ├── favicon.ico            # Site icon
│   └── robots.txt             # Search crawler directives
├── scripts/
│   └── build-pdf.php          # Regenerates public/assets/pdf/Less-of-Josh-Media-Kit.pdf via Dompdf
├── tests/
│   └── worker.test.js         # Automated unit & HTTP integration tests
├── wrangler.jsonc             # Cloudflare Worker configuration (Custom Domains, KV, Cron)
├── MIGRATION.md               # Architecture, operations, and rollback documentation
└── package.json
```

## Development & Testing

```bash
# Run unit & integration tests
npm test

# Start local Cloudflare Worker dev server
npm run dev

# Deploy to production (lessofjosh.com)
npm run deploy
```

See [MIGRATION.md](./MIGRATION.md) for full operational procedures, secret management, weight-loss value updates, PDF regeneration, and rollback steps.
