/**
 * 404 Not Found fallback route ported from index.php ("Nothing found").
 */
import { CRITICAL_CSS } from "../data/critical-css.js";

export function handleNotFound(request) {
  const html = `<!doctype html>
<html lang="en-US">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex, follow">
	<title>Page not found &#8211; Less of Josh</title>
	<style id="loj-theme-critical-css">${CRITICAL_CSS}</style>
</head>
<body class="error404 wp-embed-responsive wp-theme-less-of-josh-theme">
<main class="loj-theme-fallback" id="primary">
	<h1>Nothing found</h1>
	<p>There is no content here yet.</p>
	<p><a href="https://lessofjosh.com/">Go to the Less of Josh media kit</a></p>
</main>
</body>
</html>`;

  return new Response(request.method === "HEAD" ? null : html, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
