/**
 * Homepage / Media Kit HTML route ported 1:1 from:
 *   - header.php
 *   - functions.php (loj_theme_inline_critical_css, loj_theme_preload_assets, loj_theme_homepage_seo_meta, loj_theme_google_analytics)
 *   - templates/media-kit.php
 *   - footer.php
 */
import { CRITICAL_CSS } from "../data/critical-css.js";
import { getThemeData, THEME_VERSION } from "../utilities/data.js";
import { createIntakeNonce, escapeHtml, escapeAttr } from "../utilities/security.js";
import { budgets, mediaTypes, getTodayDateString, NONCE_NAME } from "../forms/index.js";
import { PDF_FILENAME } from "../pdf/index.js";

const SOCIAL_ICONS = {
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  instagram:
    "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
};

function renderPicture(photo, sizes) {
  const style =
    photo.custom && Number(photo.zoom) !== 100
      ? ` style="--loj-zoom:${escapeAttr(Number(photo.zoom) / 100)}"`
      : "";
  const avifSource = photo.avif
    ? `<source type="image/avif" srcset="${escapeAttr(photo.avif)}" sizes="${escapeAttr(sizes)}">`
    : "";
  const webpSource = photo.webp
    ? `<source type="image/webp" srcset="${escapeAttr(photo.webp)}" sizes="${escapeAttr(sizes)}">`
    : "";
  const srcsetAttr = photo.srcset
    ? ` srcset="${escapeAttr(photo.srcset)}" sizes="${escapeAttr(sizes)}"`
    : "";
  return `<picture>${avifSource}${webpSource}<img src="${escapeAttr(photo.src)}"${srcsetAttr} width="${Number(photo.width)}" height="${Number(photo.height)}" loading="lazy" decoding="async" alt="${escapeAttr(photo.alt)}"${style}></picture>`;
}

function renderFormNotice(forForm, status, activeForm) {
  if (!status || forForm !== activeForm) {
    return "";
  }
  if (status === "success") {
    const detail =
      forForm === "media"
        ? "Your request went to the media inbox."
        : "Your brief is in. Josh will reply if it’s a fit.";
    return `<div class="loj-mk__form-notice is-success" role="status"><strong>Sent.</strong><span>${detail}</span></div>`;
  }
  if (status === "rate") {
    return `<div class="loj-mk__form-notice is-error" role="alert"><strong>Please wait a few minutes.</strong><span>Several submissions came from this connection.</span></div>`;
  }
  return `<div class="loj-mk__form-notice is-error" role="alert"><strong>That didn’t send.</strong><span>Check the required fields and try again.</span></div>`;
}

function buildSchemaJson(data, canonicalOrigin, isHome) {
  const title = isHome
    ? "Josh Greenway (Less of Josh) | Creator Media Kit"
    : "Josh Greenway Creator Media Kit | Less of Josh";
  const description = `West Virginia creator Josh Greenway (Less of Josh): a weight-loss journey from ${data.weight.start_label} lbs, tech reviews, travel, and UGC. Media kit, partnerships, and press.`;
  const canonical = isHome ? `${canonicalOrigin}/` : `${canonicalOrigin}/media-kit/`;
  const profileUrl = `${canonicalOrigin}/`;
  const themeAssetBase = `${canonicalOrigin}/wp-content/themes/less-of-josh-theme/assets`;
  const socialImage = `${themeAssetBase}/images/og-media-kit.jpg?ver=${THEME_VERSION}`;
  const personId = `${profileUrl}#person`;
  const orgId = `${profileUrl}#organization`;
  const websiteId = `${profileUrl}#website`;
  const profileId = `${canonical}#profilepage`;
  const sameAs = Object.values(data.socials).map((s) => s.url);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": profileId,
        url: canonical,
        name: title,
        description,
        inLanguage: "en-US",
        mainEntity: { "@id": personId },
        isPartOf: { "@id": websiteId },
        primaryImageOfPage: socialImage,
        dateModified: "2026-08-27T13:56:23-04:00"
      },
      {
        "@type": "Person",
        "@id": personId,
        name: "Josh Greenway",
        givenName: "Josh",
        familyName: "Greenway",
        alternateName: ["Joshua Greenway", "Less of Josh"],
        url: profileUrl,
        image: `${themeAssetBase}/pdf-images/josh-hero.png?ver=${THEME_VERSION}`,
        jobTitle: "Content creator",
        description: `West Virginia creator behind Less of Josh, documenting a weight-loss journey from ${data.weight.start_label} pounds, plus tech reviews, Appalachian travel, and home cooking.`,
        knowsAbout: [
          "Weight loss",
          "West Virginia travel",
          "Consumer technology",
          "Home cooking",
          "User-generated content"
        ],
        homeLocation: {
          "@type": "Place",
          name: "Lewisburg, West Virginia"
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "1129 Washington ST E #809",
          addressLocality: "Lewisburg",
          addressRegion: "WV",
          postalCode: "24901",
          addressCountry: "US"
        },
        worksFor: { "@id": orgId },
        sameAs
      },
      {
        "@type": "Organization",
        "@id": orgId,
        name: "35/63 Media",
        url: "https://3563media.com/",
        logo: {
          "@type": "ImageObject",
          url: `${themeAssetBase}/pdf-images/3563-media-logo.png`,
          width: 600,
          height: 544
        },
        founder: { "@id": personId },
        address: {
          "@type": "PostalAddress",
          addressLocality: "Lewisburg",
          addressRegion: "WV",
          addressCountry: "US"
        }
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: profileUrl,
        name: "Less of Josh",
        inLanguage: "en-US",
        publisher: { "@id": personId }
      }
    ]
  };

  return { title, description, canonical, socialImage, schemaJson: JSON.stringify(schema) };
}

export async function handleHomeRequest(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const canonicalOrigin =
    url.hostname === "127.0.0.1" || url.hostname === "localhost"
      ? origin
      : env?.SITE_URL || "https://lessofjosh.com";

  const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
  const isHome = cleanPath === "/";

  const data = await getThemeData(env, origin);
  const nonce = await createIntakeNonce(env, NONCE_NAME);
  const turnstileSiteKey = escapeAttr(env?.TURNSTILE_SITE_KEY || "");
  const today = getTodayDateString();
  const budgetChoices = budgets();
  const mediaChoices = mediaTypes();

  const statusParam = (url.searchParams.get("loj-intake") || "").replace(/[^a-z0-9_-]/gi, "");
  const formParam = url.searchParams.get("loj-form") === "media" ? "media" : "brand";

  const imageUrl = (file) =>
    `${origin}/wp-content/themes/less-of-josh-theme/assets/images/${file.replace(/^\/+/, "")}?ver=${THEME_VERSION}`;
  const pdfUrl = `${origin}/media-kit-download/`;
  const adminPostUrl = `${origin}/wp-admin/admin-post.php`;
  const adminAjaxUrl = `${origin}/wp-admin/admin-ajax.php`;
  const metricsRestUrl = `${origin}/wp-json/less_of_josh_theme/v1/metrics`;

  const { title, description, canonical, socialImage, schemaJson } = buildSchemaJson(
    data,
    canonicalOrigin,
    isHome
  );

  const copy = data.copy;
  const weight = data.weight;
  const totals = data.totals;
  const photos = data.photos;
  const aud = copy.audience.items;
  const partners = copy.partners;

  const platformCardsHtml = Object.entries(data.platforms)
    .map(
      ([key, platform]) => `
						<a class="loj-mk__metric-card" data-loj-platform="${escapeAttr(key)}" href="${escapeAttr(platform.url)}" target="_blank" rel="noopener noreferrer">
							<div class="loj-mk__metric-top">
								<span class="loj-mk__platform-mark" aria-hidden="true"><img src="${escapeAttr(imageUrl(`social-${key}.svg`))}" width="28" height="28" alt=""></span>
								<span class="loj-mk__metric-meta"><span class="loj-mk__metric-status is-${escapeAttr(platform.status)}">${escapeHtml(platform.status_label)}</span><span>View profile ↗</span></span>
							</div>
							<h3>${escapeHtml(platform.name)}<small>${escapeHtml(platform.handle)}</small></h3>
							<div class="loj-mk__metric-primary">
								<span>Engagement rate</span>
								<strong data-loj-metric="engagement_rate" data-loj-format="percent" data-value="${escapeAttr(platform.engagement_rate)}">${escapeHtml(platform.engagement_display)}</strong>
							</div>
							<dl class="loj-mk__metric-secondary">
								<div><dt>${escapeHtml(platform.audience_label)}</dt><dd data-loj-metric="followers" data-loj-format="compact" data-value="${escapeAttr(platform.followers)}">${escapeHtml(platform.followers_display)}</dd></div>
								<div><dt>${escapeHtml(platform.views_label)}</dt><dd data-loj-metric="views" data-loj-format="compact" data-value="${escapeAttr(platform.views)}">${escapeHtml(platform.views_display)}</dd></div>
							</dl>
						</a>`
    )
    .join("");

  const lanesHtml = copy.lanes.items
    .map(
      (lane, i) => `
						<article>
							<span>${escapeHtml(`${String(i + 1).padStart(2, "0")} / ${lane.label}`)}</span>
							<h3>${escapeHtml(lane.title)}</h3>
							<p>${escapeHtml(lane.text)}</p>
							<small>Good fit: ${escapeHtml(lane.fit)}</small>
						</article>`
    )
    .join("");

  const servicesHtml = copy.services.items
    .map(
      (service, i) => `
						<article${service.featured ? ' class="is-featured"' : ""}>
							${service.featured ? `<div class="loj-mk__service-badge">${escapeHtml(service.featured)}</div>` : ""}
							<div class="loj-mk__service-icon" aria-hidden="true">${escapeHtml(service.icon)}</div>
							<p class="loj-mk__service-number">${escapeHtml(String(i + 1).padStart(2, "0"))}</p>
							<h3>${escapeHtml(service.title)}</h3>
							<p>${escapeHtml(service.text)}</p>
							<ul>
								${service.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
							</ul>
							<small>Best for: ${escapeHtml(service.best)}</small>
						</article>`
    )
    .join("");

  const partnersHtml = partners.items
    .map(
      (partner) => `
						<a class="loj-mk__brand-tile loj-mk__brand-tile--partner ${escapeAttr(partner.class || "")}" href="${escapeAttr(partner.url)}" target="_blank" rel="sponsored noopener noreferrer" aria-label="${escapeAttr(partner.aria)}">
							<img src="${escapeAttr(imageUrl(partner.img))}" width="${Number(partner.w)}" height="${Number(partner.h)}" loading="lazy" alt="${escapeAttr(partner.name)}">
							<span>${escapeHtml(partner.note)}</span>
						</a>`
    )
    .join("");

  const budgetOptionsHtml = Object.entries(budgetChoices)
    .map(([val, label]) => `<option value="${escapeAttr(val)}">${escapeHtml(label)}</option>`)
    .join("");

  const mediaOptionsHtml = Object.entries(mediaChoices)
    .map(([val, label]) => `<option value="${escapeAttr(val)}">${escapeHtml(label)}</option>`)
    .join("");

  const footerSocialsHtml = ["facebook", "youtube", "instagram", "tiktok"]
    .map((network) => {
      const profile = data.socials[network];
      return `<li><a href="${escapeAttr(profile.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(`Less of Josh on ${profile.label} (opens in a new tab)`)}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${escapeAttr(SOCIAL_ICONS[network])}"/></svg></a></li>`;
    })
    .join("");

  const lojMediaKitConfigJson = JSON.stringify({
    pdfDownloadUrl: pdfUrl,
    metricsEndpoint: metricsRestUrl,
    ajaxUrl: adminAjaxUrl
  });

  const html = `<!doctype html>
<html lang="en-US">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<title>${escapeHtml(title)}</title>
	<style id="loj-theme-critical-css">${CRITICAL_CSS}</style>
	<link rel="preload" href="${escapeAttr(`${origin}/wp-content/themes/less-of-josh-theme/assets/fonts/manrope-variable.woff2`)}" as="font" type="font/woff2" crossorigin>
	<link rel="preload" href="${escapeAttr(imageUrl("josh-hero.avif"))}" as="image" type="image/avif" fetchpriority="high">
	<meta name="description" content="${escapeAttr(description)}">
	<meta name="author" content="Josh Greenway">
	<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
	<link rel="canonical" href="${escapeAttr(canonical)}">

	<meta property="og:type" content="profile">
	<meta property="og:url" content="${escapeAttr(canonical)}">
	<meta property="og:title" content="${escapeAttr(title)}">
	<meta property="og:description" content="${escapeAttr(description)}">
	<meta property="og:site_name" content="Less of Josh">
	<meta property="og:image" content="${escapeAttr(socialImage)}">
	<meta property="og:image:width" content="1200">
	<meta property="og:image:height" content="630">
	<meta property="og:image:alt" content="Josh Greenway, Less of Josh: creator media kit">
	<meta property="og:locale" content="en_US">
	<meta property="profile:first_name" content="Josh">
	<meta property="profile:last_name" content="Greenway">

	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:title" content="${escapeAttr(title)}">
	<meta name="twitter:description" content="${escapeAttr(description)}">
	<meta name="twitter:image" content="${escapeAttr(socialImage)}">
	<meta name="twitter:image:alt" content="Josh Greenway, Less of Josh: creator media kit">

	<meta name="theme-color" content="#002855">

	<script type="application/ld+json">${schemaJson}</script>
	<link rel="icon" href="${escapeAttr(`${origin}/wp-content/uploads/2026/06/cropped-IMG_8335-32x32.png`)}" sizes="32x32" />
	<link rel="icon" href="${escapeAttr(`${origin}/wp-content/uploads/2026/06/cropped-IMG_8335-192x192.png`)}" sizes="192x192" />
	<link rel="apple-touch-icon" href="${escapeAttr(`${origin}/wp-content/uploads/2026/06/cropped-IMG_8335-180x180.png`)}" />
	<meta name="msapplication-TileImage" content="${escapeAttr(`${origin}/wp-content/uploads/2026/06/cropped-IMG_8335-270x270.png`)}" />
</head>
<body class="home wp-singular page-template-default page page-id-16 wp-embed-responsive wp-theme-less-of-josh-theme">
<div class="loj-mk" id="loj-media-kit">
	<a class="loj-mk__skip" href="#loj-main">Skip to content</a>

	<header class="loj-mk__bar" aria-label="Site header">
		<div class="loj-mk__shell loj-mk__bar-inner">
			<a class="loj-mk__brand" href="#loj-media-kit">
				<img src="${escapeAttr(imageUrl("less-of-josh-mark-64.svg"))}" srcset="${escapeAttr(`${imageUrl("less-of-josh-mark-64.svg")} 64w, ${imageUrl("less-of-josh-mark-96.svg")} 96w, ${imageUrl("less-of-josh-mark-128.svg")} 128w`)}" sizes="44px" width="64" height="64" alt="" decoding="async">
				<span><strong>Less of Josh</strong><small>Creator media kit<span class="loj-mk__brand-year"> · ${escapeHtml(data.year)}</span></small></span>
			</a>
			<nav class="loj-mk__nav" aria-label="Sections">
				<a href="#audience">Numbers</a>
				<a href="#demographics">Audience</a>
				<a href="#lanes">Content</a>
				<a href="#deliverables">Services</a>
				<a href="#the-story">Story</a>
				<a href="#partners">Brands</a>
				<a href="#partner">Partner</a>
				<a href="#media">Press</a>
			</nav>
			<a class="loj-mk__bar-cta" href="#partner">Work with me <span aria-hidden="true">↘</span></a>
		</div>
	</header>

	<main id="loj-main">
		<section class="loj-mk__hero" aria-labelledby="hero-title">
			<div class="loj-mk__shell loj-mk__hero-grid">
				<div class="loj-mk__hero-copy">
					<p class="loj-mk__eyebrow"><span>Creator media kit</span> ${escapeHtml(data.year)}</p>
					<h1 id="hero-title"><span class="loj-mk__hero-name">Josh Greenway <span aria-hidden="true">/</span> Less of Josh</span><span class="loj-mk__hero-title">${escapeHtml(copy.hero.title_lead)} <em>${escapeHtml(copy.hero.title_em)}</em></span></h1>
					<p class="loj-mk__hero-lede">${escapeHtml(copy.hero.lede)}</p>
					<div class="loj-mk__actions">
						<a class="loj-mk__button loj-mk__button--gold" href="#partner">Work with me <span aria-hidden="true">↓</span></a>
						<a class="loj-mk__button loj-mk__button--outline" href="${escapeAttr(pdfUrl)}" download="${escapeAttr(PDF_FILENAME)}" data-loj-pdf-download>Download media kit (PDF) <span aria-hidden="true">↓</span></a>
					</div>
					<ul class="loj-mk__proof-line" aria-label="Key numbers">
						<li><strong>${escapeHtml(totals.followers_display)}</strong><span>followers on 4 platforms</span></li>
						<li><strong>${escapeHtml(weight.lost_label)} lb</strong><span>lost since ${escapeHtml(weight.start_label)}</span></li>
						<li><strong>${escapeHtml(totals.engagement_display)}</strong><span>avg. engagement rate</span></li>
						<li><strong>West Virginia</strong><span>born and raised</span></li>
					</ul>
				</div>

				<div class="loj-mk__hero-visual">
					<div class="loj-mk__portrait-frame">
						<div class="loj-mk__wv-backdrop" aria-hidden="true">
							<img class="loj-mk__wv-outline-img" src="${escapeAttr(imageUrl("west-virginia-gold-outline.svg"))}" width="1000" height="914" alt="" decoding="async">
						</div>
						<picture>
							<source type="image/avif" srcset="${escapeAttr(imageUrl("josh-hero.avif"))}">
							<img class="loj-mk__hero-portrait" src="${escapeAttr(imageUrl("josh-hero.webp"))}" width="403" height="749" alt="Josh Greenway smiling in front of a gold outline of West Virginia." fetchpriority="high" decoding="async">
						</picture>
					</div>
					<p class="loj-mk__hero-caption"><span>Independent creator</span> Lewisburg, West Virginia</p>
				</div>
			</div>
			<div class="loj-mk__marquee" aria-hidden="true">
				<div>
					<span>Weight loss &amp; health</span><i>◆</i>
					<span>West Virginia travel</span><i>◆</i>
					<span>Tech &amp; gear reviews</span><i>◆</i>
					<span>Home cooking</span><i>◆</i>
					<span>UGC for paid social</span><i>◆</i>
					<span>Appalachian stories</span>
				</div>
			</div>
		</section>

		<section class="loj-mk__section loj-mk__audience" id="audience" aria-labelledby="audience-title">
			<div class="loj-mk__shell">
				<div class="loj-mk__section-head loj-mk__section-head--light">
					<div>
						<p class="loj-mk__kicker">Audience numbers</p>
						<h2 id="audience-title">${escapeHtml(copy.metrics.title)}</h2>
					</div>
					<p>${escapeHtml(copy.metrics.intro)}</p>
				</div>

				<div class="loj-mk__metrics" data-loj-metrics aria-label="Platform numbers" aria-busy="false">
					${platformCardsHtml}
				</div>
				<p class="loj-mk__updated">Updated ${escapeHtml(data.metrics_updated)}. ${escapeHtml(copy.metrics.note)}</p>
			</div>
		</section>

		<section class="loj-mk__section loj-mk__demographics" id="demographics" aria-labelledby="demographics-title">
			<div class="loj-mk__shell">
				<div class="loj-mk__section-head">
					<div>
						<p class="loj-mk__kicker">Who's watching</p>
						<h2 id="demographics-title">${escapeHtml(copy.audience.title)}</h2>
					</div>
					<p>${escapeHtml(copy.audience.intro)}</p>
				</div>

				<div class="loj-mk__persona-grid">
					<article class="loj-mk__persona loj-mk__persona--map">
						<span class="loj-mk__persona-number">01</span><p class="loj-mk__persona-label">${escapeHtml(aud[0].label)}</p>
						<div class="loj-mk__map-art" aria-hidden="true"><img src="${escapeAttr(imageUrl("continental-us-outline.svg"))}" width="959" height="593" alt="" loading="lazy"><i></i><b>WV</b></div>
						<h3>${escapeHtml(aud[0].title)}</h3>
						<p>${escapeHtml(aud[0].text)}</p>
					</article>
					<article class="loj-mk__persona">
						<span class="loj-mk__persona-number">02</span><p class="loj-mk__persona-label">${escapeHtml(aud[1].label)}</p>
						<div class="loj-mk__age"><strong>${escapeHtml(aud[1].title)}</strong><span>Core age range</span></div>
						<div class="loj-mk__age-bars" aria-hidden="true"><i></i><i class="is-core"></i><i class="is-core"></i><i></i></div>
						<p>${escapeHtml(aud[1].text)}</p>
					</article>
					<article class="loj-mk__persona">
						<span class="loj-mk__persona-number">03</span><p class="loj-mk__persona-label">${escapeHtml(aud[2].label)}</p>
						<h3>${escapeHtml(aud[2].title)}</h3>
						<p>${escapeHtml(aud[2].text)}</p>
						<small>${escapeHtml(copy.audience.note)}</small>
					</article>
					<article class="loj-mk__persona loj-mk__persona--intent">
						<span class="loj-mk__persona-number">04</span><p class="loj-mk__persona-label">${escapeHtml(aud[3].label)}</p>
						<h3>${escapeHtml(aud[3].title)}</h3>
						<ul>
							${aud[3].list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
						</ul>
					</article>
				</div>
			</div>
		</section>

		<section class="loj-mk__section loj-mk__lanes" id="lanes" aria-labelledby="lanes-title">
			<div class="loj-mk__shell">
				<div class="loj-mk__section-head">
					<div>
						<p class="loj-mk__kicker">Content</p>
						<h2 id="lanes-title">${escapeHtml(copy.lanes.title)}</h2>
					</div>
					<p>${escapeHtml(copy.lanes.intro)}</p>
				</div>
				<div class="loj-mk__pillar-grid">
					${lanesHtml}
				</div>
			</div>
		</section>

		<section class="loj-mk__section loj-mk__services" id="deliverables" aria-labelledby="deliverables-title">
			<div class="loj-mk__shell">
				<div class="loj-mk__section-head loj-mk__section-head--light">
					<div>
						<p class="loj-mk__kicker">Ways to work together</p>
						<h2 id="deliverables-title">${escapeHtml(copy.services.title)}</h2>
					</div>
					<p>${escapeHtml(copy.services.intro)}</p>
				</div>
				<div class="loj-mk__service-grid">
					${servicesHtml}
				</div>
			</div>
		</section>

		<section class="loj-mk__section loj-mk__story" id="the-story" aria-labelledby="story-title">
			<div class="loj-mk__shell">
				<div class="loj-mk__story-grid">
					<div class="loj-mk__transformation">
						<figure class="loj-mk__transform-photo loj-mk__transform-photo--before">
							${renderPicture(photos.before, "(min-width: 940px) 300px, calc((100vw - 52px) / 2)")}
							<figcaption>Before · ${escapeHtml(weight.start_label)} lbs</figcaption>
						</figure>
						<figure class="loj-mk__transform-photo loj-mk__transform-photo--current">
							${renderPicture(photos.current, "(min-width: 940px) 300px, calc((100vw - 52px) / 2)")}
							<figcaption>Now · ${escapeHtml(weight.lost_label)} lbs down</figcaption>
						</figure>
					</div>
					<div class="loj-mk__story-copy">
						<p class="loj-mk__kicker">The story</p>
						<h2 id="story-title">${escapeHtml(copy.story.title)}</h2>
						<p class="loj-mk__story-sub">${escapeHtml(copy.story.sub)}</p>
						<p class="loj-mk__story-lede">${escapeHtml(copy.story.lede)}</p>
						${copy.story.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
						<blockquote>“${escapeHtml(copy.story.quote)}”</blockquote>
					</div>
				</div>
			</div>
		</section>

		<section class="loj-mk__brands" id="partners" aria-labelledby="brands-title">
			<div class="loj-mk__shell">
				<div class="loj-mk__section-head loj-mk__section-head--compact">
					<div><p class="loj-mk__kicker">Brands I use</p><h2 id="brands-title">${escapeHtml(partners.title)}</h2></div>
					<p>${escapeHtml(partners.intro)}</p>
				</div>
				<div class="loj-mk__brand-grid">
					${partnersHtml}
				</div>
				<p class="loj-mk__brand-note">${escapeHtml(partners.disclosure)}</p>
			</div>
		</section>

		<section class="loj-mk__contact" id="partner" aria-labelledby="partner-title">
			<div class="loj-mk__shell loj-mk__contact-grid">
				<div class="loj-mk__contact-copy">
					<p class="loj-mk__kicker">Brand partnerships</p>
					<h2 id="partner-title"><span>Tell me the goal.</span><em>I’ll tell you if it fits.</em></h2>
					<p>Send the goal, deadline, deliverables, and budget. I read every brief myself. If it’s a fit for my audience, I’ll reply with availability, rates, and next steps.</p>
					<a class="loj-mk__button loj-mk__button--navy loj-mk__contact-download" href="${escapeAttr(pdfUrl)}" download="${escapeAttr(PDF_FILENAME)}" data-loj-pdf-download>Download media kit (PDF) <span aria-hidden="true">↓</span></a>
					<div class="loj-mk__contact-details"><span>Based in West Virginia</span><span>Regional + national campaigns</span><span>Creator content + UGC</span></div>
				</div>

				<div class="loj-mk__form-card">
					${renderFormNotice("brand", statusParam, formParam)}
					<form class="loj-mk__form" id="loj-partner-form" data-loj-form action="${escapeAttr(adminPostUrl)}" method="post">
						<input type="hidden" name="action" value="loj_theme_intake">
						<input type="hidden" name="loj_theme_nonce" value="${escapeAttr(nonce)}">
						<div class="loj-mk__honeypot" aria-hidden="true"><label>Company website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label></div>
						<div class="loj-mk__field-grid">
							<label><span>Brand name <abbr title="required">*</abbr></span><input type="text" name="brand" autocomplete="organization" maxlength="150" required></label>
							<label><span>Your name <abbr title="required">*</abbr></span><input type="text" name="contact_name" autocomplete="name" maxlength="150" required></label>
						</div>
						<label><span>Business email <abbr title="required">*</abbr></span><input type="email" name="contact_email" autocomplete="email" maxlength="150" required></label>
						<label><span>Campaign goals <abbr title="required">*</abbr></span><textarea name="campaign_goals" rows="4" maxlength="5000" placeholder="What should people know, feel, or do after seeing it?" required></textarea></label>
						<div class="loj-mk__field-grid">
							<label><span>Budget range <abbr title="required">*</abbr></span><select name="budget" required><option value="">Select a range</option>${budgetOptionsHtml}</select></label>
							<label><span>Target date <abbr title="required">*</abbr></span><input type="date" name="target_date" min="${escapeAttr(today)}" required></label>
						</div>
						<label><span>Deliverables or other details</span><textarea name="details" rows="4" maxlength="5000" placeholder="Platforms, usage rights, exclusivity, location, product"></textarea></label>
						<div class="loj-mk__turnstile" data-loj-turnstile data-sitekey="${turnstileSiteKey}" data-action="loj_brand"></div>
						<noscript><p class="loj-mk__form-note">JavaScript is required for the security check.</p></noscript>
						<button class="loj-mk__button loj-mk__button--navy" type="submit">Submit</button>
						<p class="loj-mk__form-note">Goes straight to Josh. You won’t be added to a mailing list.</p>
					</form>
				</div>
			</div>
		</section>

		<section class="loj-mk__media" id="media" aria-labelledby="media-title">
			<div class="loj-mk__shell loj-mk__media-grid">
				<div class="loj-mk__media-copy">
					<p class="loj-mk__kicker">Press &amp; media</p>
					<h2 id="media-title">Media inquiries</h2>
					<p>For interviews, TV and news, podcasts, documentaries, and articles. This goes to a separate media inbox, not the brand-deal queue. Include your outlet and deadline.</p>
					<p class="loj-mk__media-alt">Prefer email? <a href="${escapeAttr(`mailto:${data.contacts.media}`)}">${escapeHtml(data.contacts.media)}</a></p>
					<p class="loj-mk__media-alt">Need a bio, photos, or numbers? <a href="${escapeAttr(pdfUrl)}" download="${escapeAttr(PDF_FILENAME)}" data-loj-pdf-download>Download the media kit (PDF)</a></p>
				</div>
				<div class="loj-mk__form-card loj-mk__form-card--media">
					${renderFormNotice("media", statusParam, formParam)}
					<form class="loj-mk__form" id="loj-media-form" data-loj-form action="${escapeAttr(adminPostUrl)}" method="post">
						<input type="hidden" name="action" value="loj_theme_media">
						<input type="hidden" name="loj_theme_nonce" value="${escapeAttr(nonce)}">
						<div class="loj-mk__honeypot" aria-hidden="true"><label>Company website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label></div>
						<div class="loj-mk__field-grid">
							<label><span>Your name <abbr title="required">*</abbr></span><input type="text" name="media_name" autocomplete="name" maxlength="150" required></label>
							<label><span>Outlet or organization <abbr title="required">*</abbr></span><input type="text" name="outlet" autocomplete="organization" maxlength="150" required></label>
						</div>
						<div class="loj-mk__field-grid">
							<label><span>Email <abbr title="required">*</abbr></span><input type="email" name="media_email" autocomplete="email" maxlength="150" required></label>
							<label><span>Type of request <abbr title="required">*</abbr></span><select name="request_type" required><option value="">Select one</option>${mediaOptionsHtml}</select></label>
						</div>
						<label><span>Deadline</span><input type="date" name="deadline" min="${escapeAttr(today)}"></label>
						<label><span>What do you need? <abbr title="required">*</abbr></span><textarea name="request" rows="4" maxlength="5000" placeholder="The story, format, timing, and where it will run" required></textarea></label>
						<div class="loj-mk__turnstile" data-loj-turnstile data-sitekey="${turnstileSiteKey}" data-action="loj_media"></div>
						<noscript><p class="loj-mk__form-note">JavaScript is required for the security check.</p></noscript>
						<button class="loj-mk__button loj-mk__button--gold" type="submit">Submit</button>
					</form>
				</div>
			</div>
		</section>
	</main>

	<footer class="loj-mk__footer">
		<div class="loj-mk__shell loj-mk__footer-grid">
			<a class="loj-mk__brand loj-mk__brand--footer" href="#loj-media-kit"><img src="${escapeAttr(imageUrl("less-of-josh-mark-64.svg"))}" srcset="${escapeAttr(`${imageUrl("less-of-josh-mark-64.svg")} 64w, ${imageUrl("less-of-josh-mark-96.svg")} 96w, ${imageUrl("less-of-josh-mark-128.svg")} 128w`)}" sizes="44px" width="64" height="64" alt="" loading="lazy" decoding="async"><span><strong>Less of Josh</strong><small>Progress, not perfection.</small></span></a>
			<ul class="loj-mk__socials" aria-label="Less of Josh on social media">
				${footerSocialsHtml}
			</ul>
			<p>© ${escapeHtml(data.year)} 35/63 Media · Lewisburg, West Virginia<br>Independent. Intentional. Unbought.</p>
		</div>
	</footer>
</div>
<script id="loj-theme-media-kit-js-extra">var lojMediaKitConfig = ${lojMediaKitConfigJson};</script>
<script defer src="${escapeAttr(`${origin}/wp-content/themes/less-of-josh-theme/assets/js/media-kit.js?ver=${THEME_VERSION}`)}"></script>
<script>
(function () {
	'use strict';
	var analyticsId = "G-LH91BXQ2D1";
	var loaded = false;
	window.dataLayer = window.dataLayer || [];
	window.gtag = window.gtag || function () { window.dataLayer.push( arguments ); };

	function loadAnalytics() {
		if ( loaded ) {
			return;
		}
		loaded = true;
		var script = document.createElement( 'script' );
		script.async = true;
		script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent( analyticsId );
		script.onload = function () {
			window.gtag( 'js', new Date() );
			window.gtag( 'config', analyticsId );
		};
		document.head.appendChild( script );
	}

	[ 'pointerdown', 'keydown', 'touchstart', 'scroll' ].forEach( function (eventName) {
		window.addEventListener( eventName, loadAnalytics, { once: true, passive: true } );
	} );
	window.addEventListener( 'load', function () {
		window.setTimeout( loadAnalytics, 30000 );
	}, { once: true } );
}());
</script>
</body>
</html>`;

  return new Response(request.method === "HEAD" ? null : html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": statusParam ? "no-store, no-cache, must-revalidate, max-age=0" : "public, max-age=300"
    }
  });
}
