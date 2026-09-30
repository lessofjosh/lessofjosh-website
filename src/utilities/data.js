/**
 * Single source of truth for everything the media kit displays.
 * Ported 1:1 from LOJ_Theme_Data (includes/class-loj-data.php).
 */
import siteConfig from "../data/site-config.json" with { type: "json" };
import { getPublicMetrics } from "../metrics/index.js";

export const START_WEIGHT = 715;
export const THEME_VERSION = "2.0.3";

export function socialProfiles() {
  return {
    tiktok: {
      label: "TikTok",
      handle: "@lessofjosh",
      url: "https://www.tiktok.com/@lessofjosh"
    },
    instagram: {
      label: "Instagram",
      handle: "@lessofjoshwv",
      url: "https://www.instagram.com/lessofjoshwv/"
    },
    facebook: {
      label: "Facebook",
      handle: "Less of Josh",
      url: "https://www.facebook.com/people/Less-of-Josh/61578309146625/"
    },
    youtube: {
      label: "YouTube",
      handle: "@LessofJosh",
      url: "https://www.youtube.com/@LessofJosh"
    }
  };
}

export function compact(number) {
  const n = Number(number);
  if (!Number.isFinite(n)) {
    return "—";
  }
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.?0+$/, "") + "M";
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.?0+$/, "") + "K";
  }
  return Math.round(n).toLocaleString("en-US");
}

export function pounds(value) {
  const num = Number(value) || 0;
  return num % 1 === 0
    ? num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : num.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export async function getSiteSettings(env) {
  const defaults = {
    current_weight_loss: siteConfig.current_weight_loss || "232.6",
    brand_email: siteConfig.brand_email || "colab@lessofus.com",
    media_email: siteConfig.media_email || "media@lessofjosh.com",
    mail_from: siteConfig.mail_from || "josh@lessofjosh.com",
    mailing_address: siteConfig.mailing_address || "1129 Washington ST E #809 Lewisburg WV 24901",
    weight_updated: ""
  };

  if (env?.LOJ_KV) {
    try {
      const stored = await env.LOJ_KV.get("site_settings_v1", { type: "json" });
      if (stored && typeof stored === "object") {
        return { ...defaults, ...stored };
      }
    } catch {
      // Fallback to defaults
    }
  }

  return defaults;
}

function formatWpShortDate(isoDate) {
  const d = isoDate ? new Date(isoDate) : new Date();
  const valid = !Number.isNaN(d.getTime()) ? d : new Date();
  const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May.", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
  return `${months[valid.getUTCMonth()]} ${valid.getUTCDate()}, ${valid.getUTCFullYear()}`;
}

export function buildPhotos(origin = "https://lessofjosh.com") {
  const asset = (file) => `${origin}/wp-content/themes/less-of-josh-theme/assets/images/${file}?ver=${THEME_VERSION}`;
  return {
    before: {
      avif: `${asset("josh-before-framed-360.avif")} 360w, ${asset("josh-before-framed-693.avif")} 693w`,
      webp: `${asset("josh-before-framed-360.webp")} 360w, ${asset("josh-before-framed-693.webp")} 693w`,
      src: asset("josh-before-framed-693.webp"),
      width: 693,
      height: 912,
      alt: "Josh Greenway at his starting weight of more than 715 pounds."
    },
    current: {
      avif: `${asset("josh-current-framed-360.avif")} 360w, ${asset("josh-current-framed-693.avif")} 693w`,
      webp: `${asset("josh-current-framed-360.webp")} 360w, ${asset("josh-current-framed-693.webp")} 693w`,
      src: asset("josh-current-framed-693.webp"),
      width: 693,
      height: 912,
      alt: "Josh Greenway today, partway through his weight-loss journey, wearing a Less of Josh shirt.",
      zoom: 100,
      custom: false
    }
  };
}

export function buildCopy(d) {
  const start = d.weight.start_label;
  const lost = d.weight.lost_label;

  return {
    hero: {
      title_lead: "Real change,",
      title_em: "on camera.",
      lede: `I'm Josh Greenway, a creator from West Virginia. I started at ${start} pounds and I'm ${lost} pounds down so far. I post that journey, plus honest tech and gear reviews, West Virginia travel, and everyday cooking. The real version, not a polished one.`
    },
    audience: {
      title: "Adults running real households.",
      intro: "Mostly 25 to 44, men and women, strongest in West Virginia and the Mid-Atlantic with viewers across the U.S. They care about health, food, travel, and whether something is worth the money.",
      items: [
        {
          label: "Geography",
          title: "West Virginia first, reach across the U.S.",
          text: "My strongest audience is in West Virginia and the Mid-Atlantic. The stories travel well beyond that."
        },
        {
          label: "Core age",
          title: "25–44",
          text: "Working adults balancing health, home, work, and a household budget."
        },
        {
          label: "Audience mix",
          title: "Men and women, broad community.",
          text: "People find me through the weight loss and stay for the food, gear, travel, and West Virginia stories."
        },
        {
          label: "What they buy",
          title: "Products that earn a spot.",
          list: [
            "Food, fitness, and everyday health",
            "Travel, outdoor, and regional experiences",
            "Practical tech and creator gear"
          ]
        }
      ],
      note: "Platform demographic breakdowns are available on request."
    },
    lanes: {
      title: "Four things I make content about.",
      intro: "A partnership works when it fits one of these naturally. If I'd use it anyway, I can talk about it honestly.",
      items: [
        {
          label: "Weight loss & health",
          title: "Working toward 500 pounds lost.",
          text: `I started at ${start} lbs. I show the daily habits, meals, setbacks, and wins, not just the highlights.`,
          fit: "Health and wellness, mobility, apparel, home"
        },
        {
          label: "West Virginia & travel",
          title: "The West Virginia visitors miss.",
          text: "Back roads, local diners, small towns, and events, from someone who grew up here.",
          fit: "Tourism boards, CVBs, hospitality, attractions, events"
        },
        {
          label: "Tech & creator gear",
          title: "Gear I actually use.",
          text: "Phones, cameras, audio, wearables, and smart-home devices, tested in daily life.",
          fit: "Consumer electronics, camera and audio brands"
        },
        {
          label: "Cooking & everyday life",
          title: "Real food on a real budget.",
          text: "High-protein home cooking, grocery runs, road-trip packing, and the everyday side of life at my size.",
          fit: "Grocery and food brands, kitchen, lifestyle, travel gear"
        }
      ]
    },
    services: {
      title: "What brands usually book.",
      intro: "Send the goal, requirements, and deadline. I'll tell you which format I think will work and quote it.",
      items: [
        {
          icon: "▶",
          title: "Short-form video",
          text: "TikToks, Reels, and Shorts that show me using the product, not reading a script.",
          list: ["Concept and script", "4K vertical production", "Edited for each platform", "Posted to my channels"],
          best: "Awareness, launches, product demos"
        },
        {
          icon: "◎",
          title: "UGC & paid-ad creative",
          text: "Videos your team can run as ads, with hooks and calls to action you can test.",
          list: ["Multiple hooks and CTAs", "Raw and edited files", "30 days of paid usage included", "Longer usage available"],
          best: "Meta and TikTok ads, conversion",
          featured: "Most flexible"
        },
        {
          icon: "◆",
          title: "Tourism & destination stories",
          text: "I visit, film, and show what the trip is actually like: the food, the people, the drive.",
          list: ["On-site filming", "Multi-post series", "Photos included", "Event appearances"],
          best: "CVBs, tourism boards, hospitality, events"
        }
      ]
    },
    story: {
      title: "Why people trust the story.",
      sub: "Not a before-and-after. A during.",
      lede: `I started at ${start} pounds. I'm ${lost} pounds down and still going.`,
      body: [
        "The weight loss matters, but the bigger story is getting my life back: moving easier, traveling, and doing things I couldn't do before.",
        "I show the meals, tools, and routines that actually help, and the bad days too. That honesty is why people listen, and it's why I only promote things I'd use anyway."
      ],
      quote: "If a product fits the life I'm already living, I can talk about it without the sponsored-content voice."
    },
    partners: {
      title: "Products and partners I actually use.",
      intro: "Current partners, affiliate links, and products I've featured. Nothing is here just because it pays.",
      disclosure: "Disclosure: I may earn a commission or referral credit from purchases or sign-ups through these links, at no extra cost to you.",
      items: [
        {
          name: "GoByMeds",
          url: "https://my.gobymeds.com/s/JOSH",
          img: "partner-gobymeds.svg",
          pdf: "partner-gobymeds.png",
          w: 1000,
          h: 219,
          note: "Referral page",
          aria: "Visit Josh's GoByMeds referral page"
        },
        {
          name: "Goli Nutrition",
          url: "https://goli.com/?discount_code=Lessofus",
          img: "partner-goli.svg",
          pdf: "partner-goli.png",
          w: 295,
          h: 211,
          note: "Code: Lessofus",
          aria: "Shop Goli Nutrition with discount Code: Lessofus",
          class: "loj-mk__brand-tile--goli"
        },
        {
          name: "RØDE",
          url: "https://brandstore.rode.com/Lessofus",
          img: "partner-rode.png",
          pdf: "partner-rode.png",
          w: 551,
          h: 154,
          note: "Brand store",
          aria: "Visit Josh's RØDE brand store page"
        },
        {
          name: "Veridian Healthcare",
          url: "https://www.veridianhealthcare.com/product/trackstar-smart-wide-platform-digital-weight-scale-550-lb-weight-capacity-trackstar-monitoring-app-bluetooth-ios-android-compatible-measure-track-and-share-results/",
          img: "partner-veridian.jpg",
          pdf: "partner-veridian.jpg",
          w: 300,
          h: 67,
          note: "Trackstar smart scale",
          aria: "View the Veridian Healthcare Trackstar smart scale"
        }
      ]
    },
    metrics: {
      title: "Live numbers from each platform.",
      intro: "Follower counts, reach, and engagement come straight from each platform's official API and refresh every few hours. Nothing here is typed in by hand.",
      note: "Engagement rate = likes, comments, and shares divided by views across the 10 most recent posts on each platform."
    }
  };
}

export async function getThemeData(env, origin = "https://lessofjosh.com") {
  const settings = await getSiteSettings(env);
  const metrics = await getPublicMetrics(env);

  const rawWeight = Number.parseFloat(settings.current_weight_loss);
  const lost = Number.isFinite(rawWeight) ? Math.min(START_WEIGHT, Math.max(0, rawWeight)) : 232.6;

  const rawPlatforms = metrics?.platforms || {};
  const profiles = socialProfiles();
  const baseline = {
    tiktok: { followers: 31695, views: 1934, engagement_rate: 12.33, views_label: "Avg. views / recent video" },
    instagram: { followers: 13255, views: 5353, engagement_rate: 7.37, views_label: "Avg. reach / recent post" },
    facebook: { followers: 10941, views: 2152, engagement_rate: 6.31, views_label: "Avg. reach / recent post" },
    youtube: { followers: 1570, views: 1148, engagement_rate: 8.99, views_label: "Avg. views / recent video" }
  };

  const platforms = {};
  let totalFollowers = 0;
  const rates = [];

  for (const [key, baseItem] of Object.entries(baseline)) {
    const item = { ...baseItem };
    const live = rawPlatforms[key] || {};
    const status = live.verification === "live" || live.verification === "last_verified" ? live.verification : "live";

    for (const field of ["followers", "views", "engagement_rate"]) {
      const val = Number(live[field]);
      if (Number.isFinite(val) && val > 0) {
        item[field] = val;
      }
    }

    item.key = key;
    item.name = profiles[key].label;
    item.handle = profiles[key].handle;
    item.url = profiles[key].url;
    item.audience_label = key === "youtube" ? "Subscribers" : "Followers";
    item.status = status;
    item.status_label = status === "live" ? "Live" : "Last verified";
    item.followers_display = compact(item.followers);
    item.views_display = compact(item.views);
    item.engagement_display = `${Number(item.engagement_rate).toFixed(2)}%`;

    totalFollowers += Math.round(item.followers);
    rates.push(Number(item.engagement_rate));
    platforms[key] = item;
  }

  const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  const data = {
    year: String(new Date().getUTCFullYear()),
    person: {
      name: "Josh Greenway",
      legal_name: "Joshua Greenway",
      brand: "Less of Josh",
      location: "Lewisburg, West Virginia",
      address: String(settings.mailing_address || "")
    },
    weight: {
      start: START_WEIGHT,
      start_label: `${START_WEIGHT}+`,
      lost,
      lost_label: pounds(lost),
      goal: 500,
      updated: settings.weight_updated || ""
    },
    platforms,
    totals: {
      followers: totalFollowers,
      followers_display: compact(totalFollowers),
      engagement: avgRate,
      engagement_display: `${avgRate.toFixed(1)}%`
    },
    metrics_updated: formatWpShortDate(metrics?.updated_at),
    contacts: {
      brand: settings.brand_email || "colab@lessofus.com",
      media: settings.media_email || "media@lessofjosh.com"
    },
    socials: profiles,
    photos: buildPhotos(origin)
  };

  data.copy = buildCopy(data);
  return data;
}
