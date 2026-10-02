/**
 * Less of Josh (lessofjosh.com) Cloudflare Worker Entrypoint.
 *
 * Replaces SiteGround / WordPress / PHP / MySQL with Cloudflare Workers + Static Assets + KV + Cron Triggers.
 */
import { withSecurityHeaders } from "./utilities/security.js";
import { handleMetricsRestRequest, refreshAllMetrics, handleOAuthCallback } from "./metrics/index.js";
import { handleWpAdminEndpoint } from "./forms/index.js";
import { isPrintRedirectRequest, handlePrintRedirect, isPdfDownloadRequest, handlePdfDownload } from "./pdf/index.js";
import { handleHomeRequest } from "./routes/home.js";
import {
  handleDashboardAuthLogin,
  handleDashboardAuthCallback,
  handleDashboardAuthLogout,
  handleDashboardPage,
  handleDashboardApiRefresh,
  handleDashboardApiSettings
} from "./routes/dashboard.js";
import { handleCommandCenterPage, handleCommandCenterApi, autoBackupCommandCenter } from "./routes/commandcenter.js";
import { handleSitemapIndex, handlePagesSitemap } from "./routes/seo.js";
import { handleNotFound } from "./routes/not-found.js";

function mapLegacyAssetPath(pathname) {
  if (pathname === "/wp-content/themes/less-of-josh-theme/loj-theme.min.css") {
    return "/assets/css/loj-theme.min.css";
  }
  if (pathname === "/wp-content/themes/less-of-josh-theme/style.css") {
    return "/assets/css/style.css";
  }
  if (pathname.startsWith("/wp-content/themes/less-of-josh-theme/assets/")) {
    return pathname.replace("/wp-content/themes/less-of-josh-theme/assets/", "/assets/");
  }
  if (pathname.startsWith("/wp-content/uploads/2026/06/")) {
    return pathname.replace("/wp-content/uploads/2026/06/", "/assets/icons/");
  }
  return null;
}

async function serveStaticAsset(request, env, targetPathname) {
  if (!env?.ASSETS) {
    return null;
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = targetPathname;
  assetUrl.search = "";
  const assetRequest = new Request(assetUrl.toString(), {
    method: request.method === "HEAD" ? "GET" : request.method,
    headers: request.headers
  });
  const res = await env.ASSETS.fetch(assetRequest);
  if (!res || res.status === 404) {
    return null;
  }
  const headers = new Headers(res.headers);
  if (
    targetPathname.startsWith("/assets/") ||
    targetPathname.startsWith("/images/") ||
    targetPathname.startsWith("/fonts/")
  ) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  return new Response(request.method === "HEAD" ? null : res.body, {
    status: res.status,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isLocal =
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      request.headers.get("cf-connecting-ip") === "127.0.0.1" ||
      request.headers.get("cf-connecting-ip") === "::1";
    const isHttps = url.protocol === "https:" || !isLocal;

    // 1. Canonical domain & HTTPS redirect (www.lessofjosh.com -> https://lessofjosh.com)
    if (!isLocal && (url.hostname === "www.lessofjosh.com" || (url.hostname === "lessofjosh.com" && url.protocol !== "https:"))) {
      const target = new URL(url.toString());
      target.hostname = "lessofjosh.com";
      target.protocol = "https:";
      return withSecurityHeaders(
        new Response(null, {
          status: 301,
          headers: { Location: target.toString() }
        }),
        true
      );
    }

    const pathname = url.pathname;
    const cleanPath = pathname.replace(/\/+$/, "") || "/";

    // 2. Author archive enumeration protection (?author=... or /author/...) -> 301 to /
    if (url.searchParams.has("author") || cleanPath.startsWith("/author/")) {
      return withSecurityHeaders(
        new Response(null, {
          status: 301,
          headers: { Location: `${url.origin}/` }
        }),
        isHttps
      );
    }

    // 3. Print view redirects (/media-kit/print or ?loj_view=print) -> 301 to /media-kit-download/
    if (isPrintRedirectRequest(url)) {
      return withSecurityHeaders(handlePrintRedirect(url), isHttps);
    }

    // 4. Media Kit PDF download (/media-kit-download/, /download-pdf, ?loj_download_pdf=1)
    if (isPdfDownloadRequest(url)) {
      const pdfRes = await handlePdfDownload(request, env);
      return withSecurityHeaders(pdfRes, isHttps);
    }

    // 5. Social Metrics REST API endpoints
    if (
      cleanPath === "/wp-json/less_of_josh_theme/v1/metrics" ||
      cleanPath === "/wp-json/less-of-josh-theme/v1/metrics" ||
      cleanPath === "/api/metrics"
    ) {
      const metricsRes = await handleMetricsRestRequest(request, env);
      return withSecurityHeaders(metricsRes, isHttps);
    }

    // 6. OAuth callbacks for TikTok and Meta
    if (
      cleanPath === "/wp-json/less_of_josh_theme/v1/tiktok/callback" ||
      cleanPath === "/wp-json/less_of_josh_theme/v1/meta/callback" ||
      cleanPath === "/oauth/tiktok/callback" ||
      cleanPath === "/oauth/meta/callback"
    ) {
      return withSecurityHeaders(handleOAuthCallback(url), isHttps);
    }

    // 7. Private Owner Dashboard & Google Authentication (Owner-Only)
    if (cleanPath === "/auth/login" || cleanPath === "/api/auth/google/login") {
      const res = await handleDashboardAuthLogin(request, env, isHttps);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/auth/callback" || cleanPath === "/api/auth/google/callback") {
      const res = await handleDashboardAuthCallback(request, env, isHttps);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/auth/logout" || cleanPath === "/api/auth/google/logout") {
      const res = handleDashboardAuthLogout(request, env, isHttps);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/api/dashboard/refresh") {
      const res = await handleDashboardApiRefresh(request, env, isHttps);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/api/dashboard/settings") {
      const res = await handleDashboardApiSettings(request, env, isHttps);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/dashboard" || cleanPath === "/admin") {
      const res = await handleDashboardPage(request, env, isHttps);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/api/commandcenter" || cleanPath.startsWith("/api/commandcenter/")) {
      const res = await handleCommandCenterApi(request, env);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/commandcenter" || cleanPath.startsWith("/commandcenter/")) {
      const res = await handleCommandCenterPage(request, env, isHttps);
      return withSecurityHeaders(res, isHttps);
    }

    // 8. Form intake & nonce endpoints (/wp-admin/admin-ajax.php, /wp-admin/admin-post.php, /api/intake)
    if (cleanPath === "/wp-admin/admin-ajax.php" || cleanPath === "/api/intake") {
      const res = await handleWpAdminEndpoint(request, env, true);
      return withSecurityHeaders(res, isHttps);
    }
    if (cleanPath === "/wp-admin/admin-post.php") {
      const isAjaxHeader =
        (request.headers.get("X-Requested-With") || "").toLowerCase() === "xmlhttprequest" ||
        (request.headers.get("Accept") || "").includes("application/json");
      const res = await handleWpAdminEndpoint(request, env, isAjaxHeader);
      return withSecurityHeaders(res, isHttps);
    }

    // 8. Sitemaps & robots.txt
    if (cleanPath === "/wp-sitemap.xml" || cleanPath === "/sitemap.xml" || cleanPath === "/sitemap_index.xml") {
      return withSecurityHeaders(handleSitemapIndex(request), isHttps);
    }
    if (cleanPath === "/wp-sitemap-posts-page-1.xml" || cleanPath === "/page-sitemap.xml") {
      return withSecurityHeaders(handlePagesSitemap(request), isHttps);
    }
    if (cleanPath === "/robots.txt") {
      const assetRes = await serveStaticAsset(request, env, "/robots.txt");
      if (assetRes) {
        return withSecurityHeaders(assetRes, isHttps);
      }
    }

    // 9. Legacy WordPress theme & upload asset paths (/wp-content/...)
    const mappedAsset = mapLegacyAssetPath(pathname);
    if (mappedAsset) {
      const assetRes = await serveStaticAsset(request, env, mappedAsset);
      if (assetRes) {
        return withSecurityHeaders(assetRes, isHttps);
      }
    }

    // 10. Direct static assets (/assets/*, /images/*, /fonts/*, /favicon.ico)
    if (
      pathname.startsWith("/assets/") ||
      pathname.startsWith("/images/") ||
      pathname.startsWith("/fonts/") ||
      pathname === "/favicon.ico"
    ) {
      const assetRes = await serveStaticAsset(request, env, pathname);
      if (assetRes) {
        return withSecurityHeaders(assetRes, isHttps);
      }
    }

    // 11. Homepage & Media Kit page
    if (cleanPath === "/" || cleanPath === "/media-kit") {
      if (cleanPath === "/media-kit" && !pathname.endsWith("/")) {
        return withSecurityHeaders(
          new Response(null, {
            status: 301,
            headers: { Location: `${url.origin}/media-kit/${url.search}` }
          }),
          isHttps
        );
      }
      const homeRes = await handleHomeRequest(request, env);
      return withSecurityHeaders(homeRes, isHttps);
    }

    // 12. Block user enumeration REST routes (/wp-json/wp/v2/users) with 404
    // and return 404 for all unknown routes
    return withSecurityHeaders(handleNotFound(request), isHttps);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.allSettled([
      refreshAllMetrics(env),
      autoBackupCommandCenter(env)
    ]));
  }
};
