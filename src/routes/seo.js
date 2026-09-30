/**
 * Sitemap & SEO routes preserving exact WordPress sitemap URLs and XML output:
 *   - /wp-sitemap.xml
 *   - /sitemap.xml
 *   - /wp-sitemap-posts-page-1.xml
 */

export function handleSitemapIndex(request) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="https://lessofjosh.com/wp-sitemap-index.xsl" ?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://lessofjosh.com/wp-sitemap-posts-page-1.xml</loc></sitemap></sitemapindex>
`;
  return new Response(request.method === "HEAD" ? null : xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, follow"
    }
  });
}

export function handlePagesSitemap(request) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="https://lessofjosh.com/wp-sitemap.xsl" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://lessofjosh.com/</loc><lastmod>2026-08-27T09:56:23-04:00</lastmod></url></urlset>
`;
  return new Response(request.method === "HEAD" ? null : xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex, follow"
    }
  });
}
