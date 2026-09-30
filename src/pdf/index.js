/**
 * Media Kit PDF download & print redirect handler ported from LOJ_Theme_PDF (includes/class-loj-pdf.php)
 * and loj_theme_handle_special_requests (functions.php).
 *
 * Endpoints:
 *   - /media-kit-download/  → Serves 5-page US Letter PDF (Less-of-Josh-Media-Kit.pdf)
 *   - /download-pdf         → Serves 5-page US Letter PDF
 *   - /?loj_download_pdf=1  → Serves 5-page US Letter PDF
 *   - /media-kit/print      → 301 Redirect to /media-kit-download/
 *   - /?loj_view=print      → 301 Redirect to /media-kit-download/
 */

const KV_PDF_BINARY_KEY = "media_kit_pdf_v1";
const STATIC_PDF_PATH = "/assets/pdf/Less-of-Josh-Media-Kit.pdf";
export const PDF_FILENAME = "Less-of-Josh-Media-Kit.pdf";

export function isPrintRedirectRequest(url) {
  const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
  if (cleanPath === "/media-kit/print") {
    return true;
  }
  if (url.searchParams.get("loj_view") === "print") {
    return true;
  }
  return false;
}

export function handlePrintRedirect(url) {
  return new Response(null, {
    status: 301,
    headers: {
      Location: `${url.origin}/media-kit-download/`,
      "Cache-Control": "public, max-age=3600"
    }
  });
}

export function isPdfDownloadRequest(url) {
  const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
  if (cleanPath === "/media-kit-download" || cleanPath === "/download-pdf") {
    return true;
  }
  if (url.searchParams.has("loj_download_pdf")) {
    return true;
  }
  return false;
}

function buildPdfHeaders(byteLength) {
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${PDF_FILENAME}"`,
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "X-Robots-Tag": "noindex",
    "X-Content-Type-Options": "nosniff"
  });
  if (typeof byteLength === "number" && byteLength > 0) {
    headers.set("Content-Length", String(byteLength));
  }
  return headers;
}

export async function handlePdfDownload(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  // 1. Prefer Static Assets binding (zero-latency edge asset)
  if (env?.ASSETS) {
    try {
      const assetUrl = new URL(STATIC_PDF_PATH, request.url);
      const assetRes = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: "GET" }));
      if (assetRes.ok) {
        const bytes = await assetRes.arrayBuffer();
        if (bytes.byteLength > 1000) {
          const headers = buildPdfHeaders(bytes.byteLength);
          return new Response(request.method === "HEAD" ? null : bytes, {
            status: 200,
            headers
          });
        }
      }
    } catch {
      // Fall through to KV cache
    }
  }

  // 2. Fallback to Cloudflare KV binary cache (media_kit_pdf_v1)
  if (env?.LOJ_KV) {
    try {
      const kvBytes = await env.LOJ_KV.get(KV_PDF_BINARY_KEY, { type: "arrayBuffer" });
      if (kvBytes && kvBytes.byteLength > 1000) {
        const headers = buildPdfHeaders(kvBytes.byteLength);
        return new Response(request.method === "HEAD" ? null : kvBytes, {
          status: 200,
          headers
        });
      }
    } catch {
      // Fall through
    }
  }

  return new Response("The media kit PDF could not be generated right now. Please try again in a minute.", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}
