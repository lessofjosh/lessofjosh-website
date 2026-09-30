/**
 * 5-Page US Letter Media Kit PDF HTML template ported 1:1 from templates/media-kit-pdf.php.
 */
import { escapeHtml, escapeAttr } from "../utilities/security.js";

export function buildMediaKitPdfHtml(data, siteUrl = "https://lessofjosh.com") {
  const copy = data.copy;
  const weight = data.weight;
  const totals = data.totals;
  const img = (file) => `${siteUrl}/assets/pdf-images/${file}`;
  const font = (file) => `${siteUrl}/assets/fonts/pdf/${file}`;
  const asOf = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });

  const platformRows = Object.entries(data.platforms)
    .map(
      ([key, p]) => `<tr>
        <td>
          <table><tr>
            <td style="width:24pt;vertical-align:middle"><img src="${escapeAttr(img(`icon-${key}.png`))}" style="width:16pt;height:16pt" alt=""></td>
            <td style="vertical-align:middle"><span class="b" style="font-size:10.4pt">${escapeHtml(p.name)}</span> <span class="muted small">${escapeHtml(p.handle)}</span></td>
          </tr></table>
        </td>
        <td class="num">${escapeHtml(p.followers_display)}</td>
        <td class="num">${escapeHtml(p.views_display)}</td>
        <td class="rate">${escapeHtml(p.engagement_display)}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Josh Greenway (Less of Josh) Media Kit</title>
<style>
@font-face { font-family: 'Manrope'; font-style: normal; font-weight: normal; src: url('${escapeAttr(font("Manrope-Regular.ttf"))}') format('truetype'); }
@font-face { font-family: 'Manrope'; font-style: normal; font-weight: bold; src: url('${escapeAttr(font("Manrope-ExtraBold.ttf"))}') format('truetype'); }
@font-face { font-family: 'Manrope Semi'; font-style: normal; font-weight: normal; src: url('${escapeAttr(font("Manrope-SemiBold.ttf"))}') format('truetype'); }
@page { size: letter portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Manrope', 'DejaVu Sans', sans-serif; font-size: 9.6pt; line-height: 1.45; color: #071a2f; }
.page { position: relative; page-break-after: always; }
.page.last { page-break-after: auto; }
.pad { padding: 30pt 40pt 0 40pt; }
table { border-collapse: collapse; width: 100%; }
td { vertical-align: top; padding: 0; }
p { margin: 0; }
</style>
</head>
<body>
<div class="footer"><table><tr><td>Josh Greenway · Less of Josh · Creator media kit · ${escapeHtml(asOf)}</td><td style="text-align:right">lessofjosh.com · <span class="pnum"></span></td></tr></table></div>
<div class="page">
  <div class="topbar">
    <table><tr>
      <td style="width:34pt"><img src="${escapeAttr(img("less-of-josh-mark.png"))}" style="width:28pt;height:28pt;border-radius:5pt" alt=""></td>
      <td><div class="brand-name">Less of Josh</div><div class="brand-sub">Creator media kit · ${escapeHtml(asOf)}</div></td>
      <td style="text-align:right;font-weight:bold;font-size:9pt">lessofjosh.com</td>
    </tr></table>
  </div>
  <div class="hero">
    <div class="hero-name" style="margin-top:4pt">Josh Greenway <span style="color:rgba(255,255,255,0.4)">/</span> Less of Josh</div>
    <div class="hero-title">${escapeHtml(copy.hero.title_lead)}<br><span class="gold">${escapeHtml(copy.hero.title_em)}</span></div>
    <p class="hero-lede">${escapeHtml(copy.hero.lede)}</p>
  </div>
  <div class="stats">
    <table><tr>
      <td><div class="stat-num">${escapeHtml(totals.followers_display)}</div><div class="stat-label">followers on 4 platforms</div></td>
      <td><div class="stat-num">${escapeHtml(weight.lost_label)} lb</div><div class="stat-label">lost since ${escapeHtml(weight.start_label)}</div></td>
      <td><div class="stat-num">${escapeHtml(totals.engagement_display)}</div><div class="stat-label">avg. engagement rate</div></td>
      <td><div class="stat-num" style="font-size:15pt;line-height:1.45">West Virginia</div><div class="stat-label">born and raised</div></td>
    </tr></table>
  </div>
  <div class="pad" style="padding-top:16pt">
    <div class="kicker"><span class="bar"></span>Audience numbers</div>
    <h2 style="font-size:18pt">${escapeHtml(copy.metrics.title)}</h2>
    <table class="platforms">
      <tr><th style="width:38%">Platform</th><th>Followers</th><th>Avg. views / reach per post</th><th>Engagement</th></tr>
      ${platformRows}
    </table>
    <p class="note">Figures from each platform’s official API as of ${escapeHtml(data.metrics_updated)}. ${escapeHtml(copy.metrics.note)} Current numbers: lessofjosh.com</p>
  </div>
</div>
</body>
</html>`;
}
