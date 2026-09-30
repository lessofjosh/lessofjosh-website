/**
 * Social platform metrics service ported 1:1 from LOJ_Theme_Metrics (includes/class-loj-metrics.php).
 *
 * Architecture:
 *   Cloudflare Cron Trigger (0 *\/3 * * *)
 *     → Platform APIs (TikTok, Instagram, Facebook, YouTube)
 *     → Cloudflare KV (LOJ_KV: metrics_last_good_v2, metrics_status_v3, tiktok_tokens_v1)
 *     → Worker JSON endpoint (/wp-json/less_of_josh_theme/v1/metrics)
 */
import siteConfig from "../data/site-config.json" with { type: "json" };
import { escapeHtml } from "../utilities/security.js";

const KV_LAST_GOOD_KEY = "metrics_last_good_v2";
const KV_STATUS_KEY = "metrics_status_v3";
const KV_TIKTOK_TOKENS_KEY = "tiktok_tokens_v1";
const CACHE_SECONDS = 14400;
const RECENT_CONTENT = 10;
const GRAPH_VERSION = "v26.0";
const PLATFORMS = ["tiktok", "instagram", "facebook", "youtube"];
const REST_PLATFORMS = ["facebook", "instagram", "youtube", "tiktok"];

function formatPhpIsoDate(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function getEnvSecret(env, name, fallback = "") {
  const lojKey = name.startsWith("LOJ_") ? name : `LOJ_${name}`;
  const bareKey = name.replace(/^LOJ_/, "");
  return String(env?.[lojKey] || env?.[bareKey] || fallback).trim();
}

export function getDefaultMetrics() {
  return structuredClone(siteConfig.metrics_fallback);
}

export function sanitizePublicPayload(payload) {
  const defaults = getDefaultMetrics();
  const raw = payload && typeof payload === "object" ? payload : defaults;
  const publicData = {
    updated_at: String(raw.updated_at || defaults.updated_at || ""),
    platforms: {}
  };

  const nowSec = Math.floor(Date.now() / 1000);

  for (const key of PLATFORMS) {
    const defItem = defaults.platforms?.[key] || {};
    const item = raw.platforms?.[key] || defItem;
    const updatedAt = String(item.updated_at || defItem.updated_at || "");
    const updatedTs = updatedAt ? Math.floor(new Date(updatedAt).getTime() / 1000) : 0;
    const source = String(item.source || "api");
    const followers = Number.isFinite(Number(item.followers)) ? Math.max(0, Math.round(Number(item.followers))) : null;
    const views = Number.isFinite(Number(item.views ?? item.avg_views))
      ? Math.max(0, Math.round(Number(item.views ?? item.avg_views)))
      : null;
    const engagementRate = Number.isFinite(Number(item.engagement_rate))
      ? Math.max(0, Math.round(Number(item.engagement_rate) * 100) / 100)
      : null;

    const hasData = followers !== null || views !== null;
    let verification = "unavailable";
    if (source === "api" && hasData) {
      verification = updatedTs && updatedTs >= nowSec - CACHE_SECONDS * 2 ? "live" : "last_verified";
    }

    publicData.platforms[key] = {
      name: String(item.name || defItem.name || key),
      handle: String(item.handle || defItem.handle || ""),
      url: String(item.url || defItem.url || ""),
      audience_label: key === "youtube" ? "Subscribers" : "Followers",
      followers,
      views,
      views_label: String(item.views_label || defItem.views_label || "avg. views / recent post"),
      engagement_rate: engagementRate,
      updated_at: updatedAt,
      verification
    };
  }

  return publicData;
}

export function sanitizeRestPayload(publicPayload) {
  const rest = { platforms: {} };
  for (const key of REST_PLATFORMS) {
    const item = publicPayload?.platforms?.[key] || {};
    rest.platforms[key] = {
      followers: Number.isFinite(Number(item.followers)) ? Math.max(0, Math.round(Number(item.followers))) : null,
      views: Number.isFinite(Number(item.views)) ? Math.max(0, Math.round(Number(item.views))) : null,
      engagement_rate: Number.isFinite(Number(item.engagement_rate))
        ? Math.round(Math.max(0, Number(item.engagement_rate)) * 100) / 100
        : null
    };
  }
  return rest;
}

export async function getPublicMetrics(env) {
  if (env?.LOJ_KV) {
    try {
      const cached = await env.LOJ_KV.get(KV_LAST_GOOD_KEY, { type: "json" });
      if (cached && typeof cached === "object" && cached.platforms) {
        return sanitizePublicPayload(cached);
      }
    } catch {
      // Fall through to bundled default metrics
    }
  }
  return sanitizePublicPayload(getDefaultMetrics());
}

export async function handleMetricsRestRequest(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Allow: "GET, HEAD"
      }
    });
  }

  const publicMetrics = await getPublicMetrics(env);
  const restPayload = sanitizeRestPayload(publicMetrics);
  const body = request.method === "HEAD" ? null : JSON.stringify(restPayload);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function hmacSha256Hex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function remoteJson(urlStr, options = {}, env = null) {
  let finalUrl = urlStr;
  const parsed = new URL(urlStr);
  const headers = {
    Accept: "application/json",
    "User-Agent": "LessOfJoshMetrics/2.0.3 (+https://lessofjosh.com)",
    ...(options.headers || {})
  };

  if (parsed.hostname === "graph.facebook.com") {
    const auth = headers.Authorization || "";
    const appSecret = getEnvSecret(env, "LOJ_META_APP_SECRET");
    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (appSecret && match) {
      parsed.searchParams.set("appsecret_proof", await hmacSha256Hex(appSecret, match[1]));
      finalUrl = parsed.toString();
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(finalUrl, {
      method: options.method || "GET",
      headers,
      body: options.body,
      signal: controller.signal
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON (HTTP ${response.status})`);
    }
    if (!response.ok || (body?.error?.code && body.error.code !== "ok")) {
      const msg = body?.error?.message || body?.message || `HTTP ${response.status}`;
      throw new Error(String(msg).slice(0, 240));
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function calculatePerformance(rows) {
  let totalViews = 0;
  let totalInteractions = 0;
  let count = 0;

  for (const row of rows) {
    const views = Math.max(0, Number.parseInt(row.views ?? 0, 10) || 0);
    if (views <= 0) continue;
    totalViews += views;
    totalInteractions += Math.max(0, Number.parseInt(row.interactions ?? 0, 10) || 0);
    count++;
  }

  return {
    views: count > 0 ? Math.round(totalViews / count) : null,
    engagement_rate: totalViews > 0 ? Math.round((totalInteractions / totalViews) * 100 * 100) / 100 : null,
    content_count: count
  };
}

function normalizeGraphVersion(version) {
  const match = /^v(\d{1,2})\.(\d{1,2})$/.exec(String(version || "").trim());
  if (!match) return GRAPH_VERSION;
  return Number.parseInt(match[1], 10) >= 25 ? match[0] : GRAPH_VERSION;
}

/**
 * YouTube Data API v3
 */
async function fetchYouTube(env) {
  const key = getEnvSecret(env, "LOJ_YOUTUBE_API_KEY");
  const channelId = getEnvSecret(env, "LOJ_YOUTUBE_CHANNEL_ID");
  const handle = getEnvSecret(env, "LOJ_YOUTUBE_HANDLE", "@LessofJosh");

  if (!key) {
    throw new Error("YouTube API key is not configured.");
  }

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "statistics,contentDetails");
  channelUrl.searchParams.set("key", key);
  if (channelId) {
    channelUrl.searchParams.set("id", channelId);
  } else {
    channelUrl.searchParams.set("forHandle", handle);
  }

  const channel = await remoteJson(channelUrl.toString(), {}, env);
  const item = channel?.items?.[0];
  if (!item?.statistics) {
    throw new Error("YouTube returned no matching channel.");
  }

  const uploads = String(item?.contentDetails?.relatedPlaylists?.uploads || "");
  let videoItems = [];

  if (uploads) {
    try {
      const plUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      plUrl.searchParams.set("part", "contentDetails");
      plUrl.searchParams.set("playlistId", uploads);
      plUrl.searchParams.set("maxResults", String(RECENT_CONTENT));
      plUrl.searchParams.set("key", key);
      const playlist = await remoteJson(plUrl.toString(), {}, env);
      const ids = (playlist?.items || [])
        .map((i) => i?.contentDetails?.videoId)
        .filter((id) => typeof id === "string" && id !== "");

      if (ids.length > 0) {
        const vUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        vUrl.searchParams.set("part", "statistics");
        vUrl.searchParams.set("id", ids.join(","));
        vUrl.searchParams.set("key", key);
        const videos = await remoteJson(vUrl.toString(), {}, env);
        videoItems = Array.isArray(videos?.items) ? videos.items : [];
      }
    } catch {
      // Keep subscriber count even if playlist/videos fetch fails
    }
  }

  const rows = videoItems.map((v) => ({
    views: Number.parseInt(v?.statistics?.viewCount ?? 0, 10) || 0,
    interactions:
      (Number.parseInt(v?.statistics?.likeCount ?? 0, 10) || 0) +
      (Number.parseInt(v?.statistics?.commentCount ?? 0, 10) || 0)
  }));
  const perf = calculatePerformance(rows);

  return {
    name: "YouTube",
    handle: "@LessofJosh",
    url: "https://www.youtube.com/@LessofJosh",
    followers:
      item.statistics.subscriberCount !== undefined
        ? Number.parseInt(item.statistics.subscriberCount, 10) || 0
        : null,
    views: perf.views ?? (Number.parseInt(item.statistics.viewCount ?? 0, 10) || null),
    views_label: perf.content_count > 0 ? "avg. views / recent video" : "total channel views",
    engagement_rate: perf.engagement_rate
  };
}

/**
 * TikTok Display API v2 with automatic token rotation in KV
 */
async function resolveTikTokAccessToken(env) {
  const staticToken = getEnvSecret(env, "LOJ_TIKTOK_ACCESS_TOKEN");
  const clientKey = getEnvSecret(env, "LOJ_TIKTOK_CLIENT_KEY");
  const secret = getEnvSecret(env, "LOJ_TIKTOK_CLIENT_SECRET");
  const seedRefresh = getEnvSecret(env, "LOJ_TIKTOK_REFRESH_TOKEN");

  let stored = null;
  if (env?.LOJ_KV) {
    try {
      stored = await env.LOJ_KV.get(KV_TIKTOK_TOKENS_KEY, { type: "json" });
    } catch {
      stored = null;
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (stored?.access && Number(stored.expires || 0) > nowSec + 600) {
    return stored.access;
  }

  const refresh = stored?.refresh || seedRefresh;
  if (!refresh || !clientKey || !secret) {
    if (stored?.access) return stored.access;
    if (staticToken) return staticToken;
    throw new Error("TikTok OAuth is not configured.");
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: secret,
    grant_type: "refresh_token",
    refresh_token: refresh
  });

  const result = await remoteJson(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    },
    env
  );

  const newAccess = String(result?.access_token || "");
  const newRefresh = String(result?.refresh_token || refresh);
  if (!newAccess) {
    throw new Error("TikTok returned no access token.");
  }

  if (env?.LOJ_KV) {
    await env.LOJ_KV.put(
      KV_TIKTOK_TOKENS_KEY,
      JSON.stringify({
        access: newAccess,
        refresh: newRefresh,
        expires: nowSec + (Number.parseInt(result?.expires_in, 10) || 86400),
        refresh_expires: nowSec + (Number.parseInt(result?.refresh_expires_in, 10) || 31536000)
      })
    );
  }

  return newAccess;
}

async function fetchTikTok(env) {
  const token = await resolveTikTokAccessToken(env);
  const headers = { Authorization: `Bearer ${token}` };

  const user = await remoteJson(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,follower_count,likes_count,video_count",
    { headers },
    env
  );

  const videos = await remoteJson(
    "https://open.tiktokapis.com/v2/video/list/?fields=id,view_count,like_count,comment_count,share_count",
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ max_count: RECENT_CONTENT })
    },
    env
  );

  const profile = user?.data?.user || {};
  const videoSet = Array.isArray(videos?.data?.videos) ? videos.data.videos : [];
  const rows = videoSet.map((v) => ({
    views: Number.parseInt(v?.view_count ?? 0, 10) || 0,
    interactions:
      (Number.parseInt(v?.like_count ?? 0, 10) || 0) +
      (Number.parseInt(v?.comment_count ?? 0, 10) || 0) +
      (Number.parseInt(v?.share_count ?? 0, 10) || 0)
  }));
  const perf = calculatePerformance(rows);

  return {
    name: "TikTok",
    handle: "@lessofjosh",
    url: "https://www.tiktok.com/@lessofjosh",
    followers: profile.follower_count !== undefined ? Number.parseInt(profile.follower_count, 10) || 0 : null,
    views: perf.views,
    views_label: "avg. views / recent video",
    engagement_rate: perf.engagement_rate
  };
}

/**
 * Instagram Graph API
 */
function extractInstagramInsightValues(payload) {
  const output = {};
  for (const metric of payload?.data || []) {
    const name = String(metric?.name || "").toLowerCase();
    if (!name) continue;
    if (metric?.total_value?.value !== undefined && Number.isFinite(Number(metric.total_value.value))) {
      output[name] = Math.max(0, Math.round(Number(metric.total_value.value)));
      continue;
    }
    const values = Array.isArray(metric?.values) ? [...metric.values].reverse() : [];
    for (const row of values) {
      if (row?.value !== undefined && Number.isFinite(Number(row.value))) {
        output[name] = Math.max(0, Math.round(Number(row.value)));
        break;
      }
    }
  }
  return output;
}

async function fetchInstagram(env) {
  const token = getEnvSecret(env, "LOJ_INSTAGRAM_ACCESS_TOKEN");
  const userId = getEnvSecret(env, "LOJ_INSTAGRAM_USER_ID", "me");
  const version = normalizeGraphVersion(getEnvSecret(env, "LOJ_INSTAGRAM_GRAPH_VERSION", GRAPH_VERSION));
  const host = getEnvSecret(env, "LOJ_INSTAGRAM_API_HOST", "https://graph.instagram.com").replace(/\/+$/, "");

  if (!token) {
    throw new Error("Instagram access token is not configured.");
  }

  const headers = { Authorization: `Bearer ${token}` };
  const id = userId === "me" ? "me" : encodeURIComponent(String(Number.parseInt(userId, 10) || userId));
  const base = `${host}/${encodeURIComponent(version)}`;

  const profile = await remoteJson(`${base}/${id}?fields=username,followers_count,media_count`, { headers }, env);
  const username = String(profile?.username || "lessofjoshwv").replace(/^@/, "");

  let media;
  try {
    media = await remoteJson(
      `${base}/${id}/media?fields=id,like_count,comments_count,media_type,media_product_type,timestamp,permalink&limit=${RECENT_CONTENT}`,
      { headers },
      env
    );
  } catch (err) {
    return {
      name: "Instagram",
      handle: `@${username}`,
      url: `https://www.instagram.com/${encodeURIComponent(username)}/`,
      followers: profile?.followers_count !== undefined ? Number.parseInt(profile.followers_count, 10) || 0 : null,
      views: null,
      engagement_rate: null,
      _status_message: `Profile updated; recent-media analytics failed: ${err.message}`
    };
  }

  const rows = [];
  for (const post of media?.data || []) {
    const fallbackInteractions =
      (Number.parseInt(post?.like_count ?? 0, 10) || 0) +
      (Number.parseInt(post?.comments_count ?? 0, 10) || 0);

    let insights = null;
    try {
      insights = await remoteJson(
        `${base}/${encodeURIComponent(post.id)}/insights?metric=views,total_interactions&metric_type=total_value`,
        { headers },
        env
      );
    } catch {
      try {
        insights = await remoteJson(
          `${base}/${encodeURIComponent(post.id)}/insights?metric=views&metric_type=total_value`,
          { headers },
          env
        );
      } catch {
        insights = null;
      }
    }

    if (!insights) {
      rows.push({ views: 0, interactions: fallbackInteractions });
      continue;
    }

    const values = extractInstagramInsightValues(insights);
    rows.push({
      views: values.views || 0,
      interactions: values.total_interactions ?? fallbackInteractions
    });
  }

  const perf = calculatePerformance(rows);
  return {
    name: "Instagram",
    handle: `@${username}`,
    url: `https://www.instagram.com/${encodeURIComponent(username)}/`,
    followers: profile?.followers_count !== undefined ? Number.parseInt(profile.followers_count, 10) || 0 : null,
    views: perf.views,
    views_label: "avg. views / recent post",
    engagement_rate: perf.engagement_rate
  };
}

/**
 * Facebook Graph API
 */
function extractMetaInsightValue(payload, metricName) {
  const target = metricName.toLowerCase();
  for (const insight of payload?.data || []) {
    if (String(insight?.name || "").toLowerCase() !== target) continue;
    if (insight?.total_value?.value !== undefined && Number.isFinite(Number(insight.total_value.value))) {
      return Math.max(0, Math.round(Number(insight.total_value.value)));
    }
    const values = Array.isArray(insight?.values) ? [...insight.values].reverse() : [];
    for (const row of values) {
      if (row?.value !== undefined && Number.isFinite(Number(row.value))) {
        return Math.max(0, Math.round(Number(row.value)));
      }
    }
  }
  return null;
}

async function fetchFacebookPostViews(base, postId, headers, env) {
  for (const metric of ["post_total_media_view_unique", "post_media_view"]) {
    try {
      const insights = await remoteJson(
        `${base}/${encodeURIComponent(postId)}/insights?metric=${metric}&period=lifetime`,
        { headers },
        env
      );
      const val = extractMetaInsightValue(insights, metric);
      if (val !== null && val > 0) {
        return val;
      }
    } catch {
      // Try next metric
    }
  }
  return null;
}

async function fetchFacebook(env) {
  const token =
    getEnvSecret(env, "LOJ_FACEBOOK_PAGE_ACCESS_TOKEN") || getEnvSecret(env, "LOJ_FACEBOOK_PAGE_TOKEN");
  const pageId = getEnvSecret(env, "LOJ_FACEBOOK_PAGE_ID", "680647665137577");
  const version = normalizeGraphVersion(getEnvSecret(env, "LOJ_FACEBOOK_GRAPH_VERSION", GRAPH_VERSION));
  const defaultUrl = "https://www.facebook.com/people/Less-of-Josh/61578309146625/";

  if (!token || !pageId) {
    throw new Error("Facebook Page access token or Page ID is not configured.");
  }

  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://graph.facebook.com/${encodeURIComponent(version)}`;

  const profile = await remoteJson(
    `${base}/${encodeURIComponent(pageId)}?fields=id,name,fan_count,followers_count,link`,
    { headers },
    env
  );

  const followers = Math.max(
    Number.parseInt(profile?.followers_count ?? 0, 10) || 0,
    Number.parseInt(profile?.fan_count ?? 0, 10) || 0
  );

  let posts;
  try {
    posts = await remoteJson(
      `${base}/${encodeURIComponent(pageId)}/published_posts?fields=id,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares&limit=${RECENT_CONTENT}`,
      { headers },
      env
    );
  } catch (err) {
    return {
      name: "Facebook",
      handle: String(profile?.name || "Less of Josh"),
      url: String(profile?.link || defaultUrl),
      followers: followers || null,
      views: null,
      engagement_rate: null,
      _status_message: `Page profile updated; post analytics failed: ${err.message}`
    };
  }

  let totalEngagements = 0;
  let viewEngagements = 0;
  let totalViews = 0;
  let viewCount = 0;
  let postCount = 0;
  let viewsLabel = "avg. reach / recent post";

  for (const post of (posts?.data || []).slice(0, RECENT_CONTENT)) {
    postCount++;
    const postId = String(post?.id || "");
    const engagements =
      (Number.parseInt(post?.shares?.count ?? 0, 10) || 0) +
      (Number.parseInt(post?.reactions?.summary?.total_count ?? 0, 10) || 0) +
      (Number.parseInt(post?.comments?.summary?.total_count ?? 0, 10) || 0);

    totalEngagements += engagements;
    if (!postId) continue;

    const views = await fetchFacebookPostViews(base, postId, headers, env);
    if (views !== null && views > 0) {
      totalViews += views;
      viewEngagements += engagements;
      viewCount++;
    }
  }

  let calculatedViews = viewCount > 0 ? Math.round(totalViews / viewCount) : null;

  if (viewCount === 0) {
    try {
      const pageInsights = await remoteJson(
        `${base}/${encodeURIComponent(pageId)}/insights?metric=page_total_media_view_unique&period=days_28`,
        { headers },
        env
      );
      const pageViewers = extractMetaInsightValue(pageInsights, "page_total_media_view_unique");
      if (pageViewers) {
        calculatedViews = pageViewers;
        viewsLabel = "28-day unique viewers";
      }
    } catch {
      // Preserve existing views on failure
    }
  }

  let engagementRate = null;
  if (totalViews > 0 && viewEngagements > 0) {
    engagementRate = Math.round((viewEngagements / totalViews) * 100 * 100) / 100;
  } else if (followers > 0 && postCount > 0 && totalEngagements > 0) {
    const avgInteractions = totalEngagements / postCount;
    engagementRate = Math.round((avgInteractions / followers) * 100 * 100) / 100;
  }

  return {
    name: "Facebook",
    handle: String(profile?.name || "Less of Josh"),
    url: String(profile?.link || defaultUrl),
    followers: followers || null,
    views: calculatedViews,
    views_label: viewsLabel,
    engagement_rate: engagementRate
  };
}

/**
 * Scheduled refresh across all 4 platforms.
 */
export async function refreshAllMetrics(env) {
  let current = getDefaultMetrics();
  if (env?.LOJ_KV) {
    try {
      const stored = await env.LOJ_KV.get(KV_LAST_GOOD_KEY, { type: "json" });
      if (stored && typeof stored === "object" && stored.platforms) {
        current = stored;
      }
    } catch {
      // Use defaults
    }
  }

  const status = {};
  let updated = false;
  const fetchers = {
    tiktok: () => fetchTikTok(env),
    instagram: () => fetchInstagram(env),
    facebook: () => fetchFacebook(env),
    youtube: () => fetchYouTube(env)
  };

  for (const platform of PLATFORMS) {
    try {
      const result = await fetchers[platform]();
      const statusMessage = result._status_message || "Updated successfully.";
      delete result._status_message;

      const merged = { ...(current.platforms?.[platform] || {}) };
      for (const [k, v] of Object.entries(result)) {
        if (v !== null && v !== undefined) {
          merged[k] = v;
        }
      }
      merged.updated_at = formatPhpIsoDate();
      merged.source = "api";
      current.platforms[platform] = merged;
      updated = true;

      status[platform] = {
        ok: true,
        message: statusMessage,
        time: Math.floor(Date.now() / 1000)
      };
    } catch (err) {
      status[platform] = {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        time: Math.floor(Date.now() / 1000)
      };
    }
  }

  if (updated) {
    current.updated_at = formatPhpIsoDate();
    if (env?.LOJ_KV) {
      await env.LOJ_KV.put(KV_LAST_GOOD_KEY, JSON.stringify(current));
    }
  }

  if (env?.LOJ_KV) {
    await env.LOJ_KV.put(KV_STATUS_KEY, JSON.stringify(status));
  }

  return { payload: current, status, anySuccess: updated };
}

export function handleOAuthCallback(url) {
  const pathname = url.pathname.replace(/\/+$/, "");
  const isTikTok = pathname.includes("tiktok");
  const provider = isTikTok ? "TikTok" : "Meta (Instagram & Facebook)";
  const code = url.searchParams.get("code") || "";
  const error = url.searchParams.get("error") || "";
  const errorDescription = url.searchParams.get("error_description") || "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(provider)} OAuth Callback — Less of Josh</title>
</head>
<body>
  <main style="max-width:640px;margin:40px auto;font-family:system-ui,sans-serif;padding:24px;">
    <h1>${escapeHtml(provider)} OAuth Callback</h1>
    ${
      error
        ? `<p>Authorization error: <strong>${escapeHtml(error)}</strong> ${escapeHtml(errorDescription)}</p>`
        : code
          ? `<p>Authorization code received.</p>`
          : `<p>OAuth callback endpoint is active.</p>`
    }
    <p><a href="/">Return to Less of Josh</a></p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
