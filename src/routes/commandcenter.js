import {
  createDashboardCsrfToken,
  verifyAdminSession,
  verifyDashboardCsrfToken
} from "../auth/google.js";
import {
  SPONSORSHIP_STATUSES,
  CONTENT_STAGES,
  CONTENT_FORMATS,
  FILMING_STATUSES,
  EDITING_STATUSES,
  REVENUE_CATEGORIES,
  MEDIA_OUTREACH_STATUSES,
  MEDIA_OUTREACH_TYPES,
  GOAL_STATUSES,
  TASK_STATUSES,
  addDaysISO,
  applyContentStageAutomation,
  buildWeeklyPriorityDashboard,
  calculateFollowUpDate,
  enrichMediaOutreach,
  enrichSponsorship
} from "../commandcenter/automation.js";

const fields = (value) => value.split(" ");
const TABLES = {
  sponsorships: {
    table: "sponsorships",
    required: "brand",
    order: "id ASC",
    columns: fields("brand contact_name contact_email website category priority date_first_contacted last_contact_date follow_up_date status original_status pitch_sent response product_offered products_requested cash_offered agreed_rate usage_rights_fee deliverables due_date contract_signed content_posted invoice_sent payment_received needs_review notes source source_id source_url source_record_url source_updated_at imported_at created_at updated_at"),
    search: fields("brand contact_name contact_email website category priority status response product_offered products_requested deliverables notes")
  },
  media: {
    table: "media_outreach",
    required: "outlet",
    order: "id ASC",
    columns: fields("outlet type contact_name contact_email cc_alternate website pitch_subject story_angle status original_status priority last_contact_date follow_up_date notes needs_review source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("outlet type contact_name contact_email website pitch_subject story_angle status priority notes")
  },
  affiliates: {
    table: "affiliates",
    required: "program",
    order: "id ASC",
    columns: fields("program category status affiliate_url coupon_code discount_code commission payout_terms contact last_promoted revenue clicks conversion_info notes source source_id source_url source_updated_at imported_at last_updated created_at"),
    search: fields("program category status affiliate_url coupon_code discount_code commission payout_terms contact conversion_info notes")
  },
  content: {
    table: "content_items",
    required: "title",
    order: "id ASC",
    columns: fields("parent_idea_id title content_pillar platform format stage original_status priority hook cta filming_status editing_status scheduled_date published_date url views ctr avg_view_duration subscribers_gained revenue winner sponsor sponsorship_id affiliate_connection affiliate_id notes source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("title content_pillar platform format stage priority hook cta sponsor affiliate_connection notes")
  },
  revenue: {
    table: "revenue_entries",
    required: "category entry_date",
    order: "entry_date DESC, id DESC",
    columns: fields("category source_name amount entry_date status cycle sponsorship_id affiliate_id notes source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("category source_name entry_date status cycle notes")
  },
  growth: {
    table: "growth_snapshots",
    required: "snapshot_date",
    order: "snapshot_date DESC, id DESC",
    columns: fields("snapshot_date label tiktok instagram facebook youtube threads combined_audience youtube_watch_hours revenue cycle notes source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("snapshot_date label cycle notes")
  },
  goals: {
    table: "goals",
    required: "goal",
    order: "id ASC",
    columns: fields("goal cycle area current_value target_value deadline status weekly_action notes is_historical source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("goal cycle area deadline status weekly_action notes")
  },
  tasks: {
    table: "tasks",
    required: "task_name",
    order: "id ASC",
    columns: fields("task_name status due_date assignee category notes needs_review is_historical source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("task_name status due_date assignee category notes")
  },
  projects: {
    table: "business_projects",
    required: "name",
    order: "id ASC",
    columns: fields("name category status pricing_model platforms url description next_milestone notes source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("name category status pricing_model platforms url description next_milestone notes")
  },
  cookbook: {
    table: "cookbook_recipes",
    required: "recipe",
    order: "id ASC",
    columns: fields("recipe status category ingredients cooking_instructions photo_ready recipe_card_ready source_post notes body source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("recipe status category ingredients cooking_instructions source_post notes body")
  },
  printing: {
    table: "printing_projects",
    required: "project",
    order: "id ASC",
    columns: fields("project category status material printer file_url next_step notes source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("project category status material printer file_url next_step notes")
  },
  reference: {
    table: "reference_documents",
    required: "title",
    order: "id ASC",
    columns: fields("title category source source_id source_url content created_at updated_at imported_at"),
    search: fields("title category content")
  },
  health: {
    table: "health_records",
    required: "entry",
    order: "entry_date DESC, id DESC",
    columns: fields("entry_date entry weight change_lbs milestone medication_notes mobility_win workout content_opportunity notes source source_id source_url source_updated_at imported_at created_at updated_at"),
    search: fields("entry_date entry milestone medication_notes mobility_win workout notes")
  },
  import_logs: {
    table: "import_logs",
    required: "run_at source",
    order: "run_at DESC, id DESC",
    columns: fields("run_at source records_found inserted updated skipped conflicts failures details_json"),
    search: fields("run_at source details_json")
  }
};

const API_TO_ENTITY = Object.fromEntries(Object.keys(TABLES).map((key) => [key, key]));
const CSV_ENTITIES = new Set(["sponsorships", "affiliates", "content", "revenue", "media", "growth", "goals", "tasks"]);
const SNAPSHOT_INDEX_KEY = "commandcenter:backup:index";
const NULLABLE_NUMBERS = new Set(["usage_rights_fee", "revenue", "clicks", "parent_idea_id", "views", "ctr", "avg_view_duration", "subscribers_gained", "sponsorship_id", "affiliate_id", "tiktok", "instagram", "facebook", "youtube", "threads", "combined_audience", "youtube_watch_hours", "current_value", "target_value", "weight", "change_lbs"]);
const ZERO_NUMBERS = new Set(["cash_offered", "agreed_rate", "amount"]);
const BOOLEAN_FIELDS = new Set(["pitch_sent", "contract_signed", "content_posted", "invoice_sent", "payment_received", "needs_review", "winner", "is_historical", "photo_ready", "recipe_card_ready", "content_opportunity"]);
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", ...PRIVATE_HEADERS, ...headers }
  });
}

function cleanError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 300);
}

function todayInNewYork() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeInput(entity, input, existing = null) {
  const config = TABLES[entity];
  const data = {};
  for (const column of config.columns) {
    if (!Object.prototype.hasOwnProperty.call(input, column)) continue;
    const value = normalizeValue(input[column]);
    if (NULLABLE_NUMBERS.has(column)) data[column] = value === "" || value === null ? null : Number(value);
    else if (ZERO_NUMBERS.has(column)) data[column] = Number(value) || 0;
    else if (BOOLEAN_FIELDS.has(column)) data[column] = Number(value) || value === true ? 1 : 0;
    else data[column] = value;
  }

  const now = new Date().toISOString();
  if (!existing && config.columns.includes("created_at") && !data.created_at) data.created_at = now;
  if (config.columns.includes("updated_at")) data.updated_at = data.updated_at || now;
  if (entity === "affiliates") data.last_updated = data.last_updated || todayInNewYork();
  if (entity === "affiliates" && data.coupon_code !== undefined) data.discount_code = data.coupon_code;

  if (entity === "content" && data.stage) {
    Object.assign(data, applyContentStageAutomation({ ...(existing || {}), ...data }, existing?.stage || null, todayInNewYork()));
    delete data.id;
  }
  if (entity === "sponsorships" && (data.follow_up_date === undefined || data.follow_up_date === "")) {
    data.follow_up_date = calculateFollowUpDate({ ...(existing || {}), ...data });
  }
  if (entity === "growth" && (data.combined_audience === undefined || data.combined_audience === "")) {
    data.combined_audience = ["tiktok", "instagram", "facebook", "youtube", "threads"]
      .reduce((sum, key) => sum + (Number(data[key] ?? existing?.[key]) || 0), 0);
  }

  for (const required of config.required.split(" ")) {
    const value = data[required] ?? existing?.[required];
    if (value === undefined || value === null || String(value).trim() === "") {
      throw new Error(`${required.replaceAll("_", " ")} is required`);
    }
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => config.columns.includes(key)));
}

async function getRow(env, entity, id) {
  return env.DB.prepare(`SELECT * FROM ${TABLES[entity].table} WHERE id = ?`).bind(id).first();
}

async function insertRow(env, entity, input) {
  const config = TABLES[entity];
  const data = normalizeInput(entity, input);
  const keys = Object.keys(data);
  const result = await env.DB.prepare(
    `INSERT INTO ${config.table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`
  ).bind(...keys.map((key) => data[key])).run();
  const id = Number(result?.meta?.last_row_id || result?.meta?.last_row_id === 0 ? result.meta.last_row_id : 0);
  return id ? getRow(env, entity, id) : env.DB.prepare(`SELECT * FROM ${config.table} ORDER BY id DESC LIMIT 1`).first();
}

async function updateRow(env, entity, id, input) {
  const existing = await getRow(env, entity, id);
  if (!existing) return null;
  const data = normalizeInput(entity, input, existing);
  delete data.created_at;
  const keys = Object.keys(data);
  if (keys.length) {
    await env.DB.prepare(`UPDATE ${TABLES[entity].table} SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`)
      .bind(...keys.map((key) => data[key]), id).run();
  }
  return getRow(env, entity, id);
}

async function deleteRow(env, entity, id) {
  const result = await env.DB.prepare(`DELETE FROM ${TABLES[entity].table} WHERE id = ?`).bind(id).run();
  return Number(result?.meta?.changes || 0) > 0;
}

async function getRawRows(env, entity) {
  const config = TABLES[entity];
  const result = await env.DB.prepare(`SELECT * FROM ${config.table} ORDER BY ${config.order}`).all();
  return result.results || [];
}

function enrichGrowth(rows) {
  const ascending = [...rows].sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)) || a.id - b.id);
  const baseline = ascending.find((row) => row.snapshot_date === "2026-09-01") || ascending.find((row) => row.cycle === "Cycle 2");
  return ascending.map((row, index) => {
    const previous = ascending[index - 1];
    const combined = row.combined_audience ?? ["tiktok", "instagram", "facebook", "youtube", "threads"].reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
    const previousCombined = previous ? previous.combined_audience ?? ["tiktok", "instagram", "facebook", "youtube", "threads"].reduce((sum, key) => sum + (Number(previous[key]) || 0), 0) : null;
    return {
      ...row,
      combined_audience: combined,
      delta_prev: previous ? {
        combined: combined - previousCombined,
        tiktok: (row.tiktok || 0) - (previous.tiktok || 0),
        instagram: (row.instagram || 0) - (previous.instagram || 0),
        facebook: (row.facebook || 0) - (previous.facebook || 0),
        youtube: (row.youtube || 0) - (previous.youtube || 0)
      } : null,
      delta_cycle2_baseline: baseline && row.snapshot_date >= "2026-09-01" ? {
        combined: combined - (baseline.combined_audience || 0),
        tiktok: (row.tiktok || 0) - (baseline.tiktok || 0),
        instagram: (row.instagram || 0) - (baseline.instagram || 0),
        facebook: (row.facebook || 0) - (baseline.facebook || 0),
        youtube: (row.youtube || 0) - (baseline.youtube || 0)
      } : null
    };
  }).reverse();
}

function enrichRows(entity, rows, today) {
  if (entity === "sponsorships") return rows.map((row) => enrichSponsorship(row, today));
  if (entity === "media") return rows.map((row) => enrichMediaOutreach(row, today));
  if (entity === "growth") return enrichGrowth(rows);
  if (entity === "goals") return rows.map((row) => ({
    ...row,
    progress_pct: row.target_value ? Math.min(100, (Number(row.current_value || 0) / Number(row.target_value)) * 100) : 0
  }));
  return rows;
}

function filterRows(entity, rows, url) {
  const config = TABLES[entity];
  const params = url.searchParams;
  const exact = ["status", "category", "cycle", "stage", "platform", "format", "type"];
  let result = rows;
  for (const key of exact) {
    const value = params.get(key);
    if (value && value !== "all" && config.columns.includes(key)) result = result.filter((row) => String(row[key]) === value);
  }
  for (const key of ["needs_review", "is_historical"]) {
    if (params.has(key) && config.columns.includes(key)) {
      const expected = params.get(key) === "true" ? 1 : 0;
      result = result.filter((row) => Number(row[key]) === expected);
    }
  }
  if (params.get("needs_followup") === "true") result = result.filter((row) => row.needs_followup);
  if (params.get("overdue_deliverables") === "true") result = result.filter((row) => row.is_overdue_deliverable);
  if (params.get("unpaid_invoices") === "true") result = result.filter((row) => row.is_unpaid_invoice || row.is_ready_to_invoice);
  if (params.get("has_code") === "true") result = result.filter((row) => row.coupon_code || row.discount_code);
  if (params.get("has_revenue") === "true") result = result.filter((row) => Number(row.revenue) > 0);

  const query = String(params.get("search") || "").trim().toLowerCase();
  if (query) result = result.filter((row) => config.search.some((key) => String(row[key] ?? "").toLowerCase().includes(query)));

  const sortBy = params.get("sort_by");
  if (sortBy && config.columns.includes(sortBy)) {
    const direction = params.get("sort_dir") === "desc" ? -1 : 1;
    result = [...result].sort((a, b) => String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""), undefined, { numeric: true }) * direction);
  }
  return result;
}

async function listRows(env, entity, url, today = todayInNewYork()) {
  // ponytail: in-memory filtering is fine for 182 rows; move filters into indexed SQL if this grows materially.
  return filterRows(entity, enrichRows(entity, await getRawRows(env, entity), today), url);
}

function growthSummary(snapshots) {
  const latest = snapshots[0] || null;
  const targets = { combined_audience: 87500, tiktok: 40000, instagram: 20000, facebook: 25000, youtube: 2500, youtube_watch_hours: 4000, cycle2_revenue: 7500 };
  const progress = (current, target) => current === null || current === undefined ? null : { current, target, remaining: Math.max(0, target - current), pct: Number(((current / target) * 100).toFixed(1)) };
  return {
    latest,
    cycle1_final: snapshots.find((row) => row.snapshot_date === "2026-08-29") || null,
    cycle2_baseline: snapshots.find((row) => row.snapshot_date === "2026-09-01") || null,
    targets,
    progress: latest ? Object.fromEntries(Object.entries(targets).filter(([key]) => key !== "cycle2_revenue").map(([key, target]) => [key, progress(latest[key], target)])) : null,
    snapshots
  };
}

function revenueSummary(entries, sponsorships, affiliates, today) {
  const currentYear = today.slice(0, 4);
  const currentMonthLabel = today.slice(0, 7);
  const date = new Date(`${currentMonthLabel}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  const previousMonthLabel = date.toISOString().slice(0, 7);
  const byCategory = Object.fromEntries(REVENUE_CATEGORIES.map((category) => [category, { category, current_month: 0, previous_month: 0, ytd: 0, all_time: 0 }]));
  const totals = { current_month: 0, previous_month: 0, ytd: 0, all_time: 0, cycle2_recorded_revenue: 0 };
  const linkedAffiliateIds = new Set();
  const linkedAffiliateNames = new Set();

  for (const entry of entries.filter((row) => row.status === "Received")) {
    const amount = Number(entry.amount) || 0;
    const category = REVENUE_CATEGORIES.includes(entry.category) ? entry.category : "Other";
    const entryDate = String(entry.entry_date || "");
    if (entry.affiliate_id) linkedAffiliateIds.add(Number(entry.affiliate_id));
    if (category === "Affiliates" && entry.source_name) linkedAffiliateNames.add(entry.source_name.toLowerCase().trim());
    byCategory[category].all_time += amount;
    totals.all_time += amount;
    if (entryDate.startsWith(currentYear)) { byCategory[category].ytd += amount; totals.ytd += amount; }
    if (entryDate.startsWith(currentMonthLabel)) { byCategory[category].current_month += amount; totals.current_month += amount; }
    if (entryDate.startsWith(previousMonthLabel)) { byCategory[category].previous_month += amount; totals.previous_month += amount; }
    if (entryDate >= "2026-09-01" && entryDate <= "2026-11-30") totals.cycle2_recorded_revenue += amount;
  }
  let affiliateTrackerTotal = 0;
  for (const affiliate of affiliates) {
    const amount = Number(affiliate.revenue) || 0;
    affiliateTrackerTotal += amount;
    if (!amount || linkedAffiliateIds.has(affiliate.id) || linkedAffiliateNames.has(String(affiliate.program).toLowerCase().trim())) continue;
    byCategory.Affiliates.all_time += amount;
    totals.all_time += amount;
  }
  const unpaid = sponsorships.filter((row) => row.is_unpaid_invoice);
  const ready = sponsorships.filter((row) => row.is_ready_to_invoice);
  const expected = sponsorships.filter((row) => row.is_expected_income);
  return {
    today,
    current_month_label: currentMonthLabel,
    previous_month_label: previousMonthLabel,
    current_year: currentYear,
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(2))])),
    cycle2_target_revenue: 7500,
    outstanding_invoices: unpaid.reduce((sum, row) => sum + row.effective_value, 0),
    outstanding_invoices_count: unpaid.length,
    outstanding_invoice_items: unpaid,
    ready_to_invoice_items: ready,
    ready_to_invoice_total: ready.reduce((sum, row) => sum + row.effective_value, 0),
    expected_sponsorship_income: expected.reduce((sum, row) => sum + row.effective_value, 0),
    expected_sponsorship_count: expected.length,
    expected_sponsorship_items: expected,
    affiliate_income: byCategory.Affiliates.ytd,
    affiliate_all_time_income: byCategory.Affiliates.all_time,
    affiliate_tracker_total: affiliateTrackerTotal,
    by_category: byCategory
  };
}

async function loadOperationalData(env, today) {
  const entities = ["sponsorships", "media", "affiliates", "content", "revenue", "growth", "goals", "tasks", "projects", "cookbook", "printing", "reference", "health"];
  const raw = await Promise.all(entities.map((entity) => getRawRows(env, entity)));
  return Object.fromEntries(entities.map((entity, index) => [entity, enrichRows(entity, raw[index], today)]));
}

async function getDashboard(env, today) {
  const data = await loadOperationalData(env, today);
  const growth = growthSummary(data.growth);
  const revenue = revenueSummary(data.revenue, data.sponsorships, data.affiliates, today);
  const priority = buildWeeklyPriorityDashboard({
    sponsorships: data.sponsorships,
    mediaOutreach: data.media,
    contentItems: data.content,
    affiliates: data.affiliates,
    goals: data.goals,
    tasks: data.tasks,
    revenueSummary: revenue,
    growthLatest: growth.latest,
    today
  });
  const needsReview = [...priority.needs_review.sponsorships.map((row) => ({ ...row, entity_type: "sponsorship" })), ...priority.needs_review.media_outreach.map((row) => ({ ...row, entity_type: "media" })), ...priority.needs_review.tasks.map((row) => ({ ...row, entity_type: "task" }))];
  return {
    ...priority,
    goals_needing_action: priority.cycle2_goals,
    active_tasks: priority.weekly_tasks,
    needs_review_queue: needsReview,
    revenue_summary: revenue,
    growth_summary: growth,
    business_projects: data.projects,
    counts: {
      sponsorships: data.sponsorships.length,
      media_outreach: data.media.length,
      affiliates: data.affiliates.length,
      content_items: data.content.length,
      growth_snapshots: data.growth.length,
      goals: data.goals.length,
      tasks: data.tasks.length,
      business_projects: data.projects.length,
      cookbook_recipes: data.cookbook.length,
      printing_projects: data.printing.length,
      reference_documents: data.reference.length
    }
  };
}

async function exportBackup(env) {
  const entities = Object.keys(TABLES).filter((entity) => entity !== "import_logs");
  const rows = await Promise.all(entities.map((entity) => getRawRows(env, entity)));
  const data = Object.fromEntries(entities.map((entity, index) => [TABLES[entity].table, rows[index]]));
  return {
    system: "Less of Josh Command Center",
    schema_version: 2,
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(data).map(([table, values]) => [table, values.length])),
    data
  };
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, config) {
  const columns = ["id", ...config.columns];
  return [columns.join(","), ...rows.map((row) => columns.map((key) => csvEscape(row[key])).join(","))].join("\r\n") + "\r\n";
}

function parseCsv(text) {
  const records = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { field += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(field.trim()); field = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = []; field = "";
    } else field += character;
  }
  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);
  const headers = records.shift() || [];
  return { headers, rows: records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))) };
}

function mapSponsorshipCsv(row) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[_-]+/g, " ").trim(), value]));
  const value = (...names) => names.map((name) => normalized[name]).find((entry) => entry !== undefined) || "";
  return {
    brand: value("brand", "company", "sponsor", "brand name", "company name"),
    contact_name: value("contact name", "contact", "rep"),
    contact_email: value("contact email", "email", "e mail"),
    website: value("website", "url", "site"),
    category: value("category", "niche", "industry"),
    status: value("status", "stage", "deal status") || "Prospect",
    cash_offered: Number(String(value("cash offered", "offer", "cash")).replace(/[^0-9.-]/g, "")) || 0,
    agreed_rate: Number(String(value("agreed rate", "rate", "deal value", "fee", "amount")).replace(/[^0-9.-]/g, "")) || 0,
    follow_up_date: value("follow up date", "followup date", "next follow up"),
    notes: value("notes", "comments", "details")
  };
}

async function saveSnapshot(env) {
  if (!env.LOJ_KV) throw new Error("Backup storage is unavailable");
  const backup = await exportBackup(env);
  const id = backup.exported_at.replace(/[.:]/g, "-");
  const key = `commandcenter:backup:${id}`;
  await env.LOJ_KV.put(key, JSON.stringify(backup));
  const index = (await env.LOJ_KV.get(SNAPSHOT_INDEX_KEY, { type: "json" })) || [];
  const entry = { filename: `${id}.json`, key, created_at: backup.exported_at, size_bytes: JSON.stringify(backup).length };
  await env.LOJ_KV.put(SNAPSHOT_INDEX_KEY, JSON.stringify([entry, ...index].slice(0, 20)));
  return { ...entry, counts: backup.counts };
}

async function restoreBackup(env, backup, mode = "replace") {
  if (!backup?.data || typeof backup.data !== "object") throw new Error("Invalid backup: missing data");
  if (mode !== "replace" && mode !== "merge") throw new Error("Restore mode must be replace or merge");
  await saveSnapshot(env);
  const statements = [];
  const restoreOrder = ["revenue", "content", "affiliates", "sponsorships", "media", "growth", "goals", "tasks", "projects", "cookbook", "printing", "reference", "health"];
  if (mode === "replace") {
    for (const entity of restoreOrder) statements.push(env.DB.prepare(`DELETE FROM ${TABLES[entity].table}`));
  }
  for (const entity of [...restoreOrder].reverse()) {
    const config = TABLES[entity];
    const rows = backup.data[config.table] || [];
    if (!Array.isArray(rows)) throw new Error(`Invalid backup table: ${config.table}`);
    for (const row of rows) {
      const data = Object.fromEntries([["id", row.id], ...config.columns.map((column) => [column, row[column]])].filter(([, value]) => value !== undefined));
      const keys = Object.keys(data);
      statements.push(env.DB.prepare(`INSERT OR REPLACE INTO ${config.table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).bind(...keys.map((key) => data[key])));
    }
  }
  await env.DB.batch(statements);
  return { restored: true, mode, counts: backup.counts || {} };
}

async function syncSponsorshipRevenue(env, sponsorship) {
  const existing = await env.DB.prepare("SELECT * FROM revenue_entries WHERE sponsorship_id = ? AND source = 'sponsorship-sync' LIMIT 1").bind(sponsorship.id).first();
  const amount = Number(sponsorship.agreed_rate) || Number(sponsorship.cash_offered) || 0;
  const paid = Boolean(Number(sponsorship.payment_received)) || sponsorship.status === "Paid";
  if (!paid || amount <= 0) {
    if (existing) await env.DB.prepare("DELETE FROM revenue_entries WHERE id = ?").bind(existing.id).run();
    return;
  }
  const values = { category: "Sponsorships", source_name: sponsorship.brand, amount, entry_date: sponsorship.updated_at.slice(0, 10), status: "Received", sponsorship_id: sponsorship.id, notes: "Synced from sponsorship", source: "sponsorship-sync" };
  if (existing) await updateRow(env, "revenue", existing.id, values);
  else await insertRow(env, "revenue", values);
}

export async function handleCommandCenterPage(request, env, isHttps) {
  const url = new URL(request.url);
  const session = await verifyAdminSession(request.headers.get("cookie") || "", env);
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${url.origin}/auth/login?redirect=/commandcenter`, ...PRIVATE_HEADERS }
    });
  }
  if (!env.ASSETS) return new Response("Command Center assets unavailable", { status: 503, headers: PRIVATE_HEADERS });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD", ...PRIVATE_HEADERS } });

  const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
  const assetPath = cleanPath === "/commandcenter" ? "/commandcenter/index.html" : cleanPath;
  if (!["/commandcenter/index.html", "/commandcenter/app.js", "/commandcenter/styles.css"].includes(assetPath)) {
    return new Response("Not Found", { status: 404, headers: PRIVATE_HEADERS });
  }
  const assetUrl = new URL(assetPath, url.origin);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!asset.ok) return new Response("Not Found", { status: 404, headers: PRIVATE_HEADERS });
  const headers = new Headers(asset.headers);
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) headers.set(key, value);
  return new Response(request.method === "HEAD" ? null : asset.body, { status: 200, headers });
}

export async function handleCommandCenterApi(request, env) {
  const session = await verifyAdminSession(request.headers.get("cookie") || "", env);
  if (!session) return json({ error: "Unauthorized. Owner login required." }, 401);
  if (!env.DB) return json({ error: "Command Center database is unavailable." }, 503);

  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const validCsrf = await verifyDashboardCsrfToken(request.headers.get("x-dashboard-csrf") || "", session, env);
    if (!validCsrf) return json({ error: "Invalid CSRF token." }, 403);
  }

  const url = new URL(request.url);
  const path = url.pathname.slice("/api/commandcenter".length) || "/";
  const today = url.searchParams.get("today") || todayInNewYork();

  try {
    if (method === "GET" && path === "/meta") {
      return json({
        organization: "Less of Josh / 35/63 Media",
        system: "Creator Business Operations Command Center",
        today,
        csrf_token: await createDashboardCsrfToken(session, env),
        user: { email: session.email, name: session.name },
        enums: {
          sponsorship_statuses: SPONSORSHIP_STATUSES,
          content_stages: CONTENT_STAGES,
          content_formats: CONTENT_FORMATS,
          filming_statuses: FILMING_STATUSES,
          editing_statuses: EDITING_STATUSES,
          revenue_categories: REVENUE_CATEGORIES,
          media_statuses: MEDIA_OUTREACH_STATUSES,
          media_categories: MEDIA_OUTREACH_TYPES,
          media_outreach_statuses: MEDIA_OUTREACH_STATUSES,
          media_outreach_types: MEDIA_OUTREACH_TYPES,
          goal_statuses: GOAL_STATUSES,
          task_statuses: TASK_STATUSES
        }
      });
    }
    if (method === "GET" && path === "/dashboard") return json(await getDashboard(env, today));
    if (method === "GET" && path === "/revenue/summary") {
      const data = await loadOperationalData(env, today);
      return json(revenueSummary(data.revenue, data.sponsorships, data.affiliates, today));
    }
    if (method === "GET" && path === "/growth/summary") return json(growthSummary(enrichGrowth(await getRawRows(env, "growth"))));
    if (method === "GET" && path === "/search") {
      const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
      const result = { query, total: 0 };
      for (const entity of ["sponsorships", "media", "affiliates", "content", "revenue", "growth", "goals", "tasks", "projects", "cookbook", "printing", "reference"]) {
        result[entity === "media" ? "media_outreach" : entity === "reference" ? "reference_documents" : entity] = query ? (await listRows(env, entity, new URL(`https://local/?search=${encodeURIComponent(query)}`), today)) : [];
        result.total += result[entity === "media" ? "media_outreach" : entity === "reference" ? "reference_documents" : entity].length;
      }
      return json(result);
    }

    const exportMatch = path.match(/^\/export\/csv\/([a-z_]+)$/);
    if (method === "GET" && exportMatch && CSV_ENTITIES.has(exportMatch[1])) {
      const entity = exportMatch[1];
      const body = toCsv(await listRows(env, entity, url, today), TABLES[entity]);
      return new Response(body, { headers: { "Content-Type": "text/csv; charset=UTF-8", "Content-Disposition": `attachment; filename="less-of-josh-${entity}-${today}.csv"`, ...PRIVATE_HEADERS } });
    }
    if (method === "GET" && path === "/backup/json") {
      return new Response(JSON.stringify(await exportBackup(env), null, 2), { headers: { "Content-Type": "application/json; charset=UTF-8", "Content-Disposition": `attachment; filename="less-of-josh-backup-${today}.json"`, ...PRIVATE_HEADERS } });
    }
    if (method === "GET" && path === "/backup/snapshots") return json(env.LOJ_KV ? (await env.LOJ_KV.get(SNAPSHOT_INDEX_KEY, { type: "json" })) || [] : []);
    if (method === "POST" && path === "/backup/snapshot") return json(await saveSnapshot(env), 201);
    if (method === "POST" && path === "/backup/restore") {
      const body = await request.json();
      let backup = body.backup;
      if (!backup && body.snapshotFilename && env.LOJ_KV) {
        const index = (await env.LOJ_KV.get(SNAPSHOT_INDEX_KEY, { type: "json" })) || [];
        const snapshot = index.find((item) => item.filename === body.snapshotFilename);
        if (!snapshot) return json({ error: "Backup snapshot not found." }, 404);
        backup = await env.LOJ_KV.get(snapshot.key, { type: "json" });
      }
      return json(await restoreBackup(env, backup, body.mode || "replace"));
    }
    if (method === "GET" && path === "/import/logs") return json(await listRows(env, "import_logs", url, today));
    if (method === "POST" && path === "/import/run") return json({ already_migrated: true, message: "The recovered Notion data is already migrated to Cloudflare D1." });

    if (method === "POST" && path === "/sponsorships/import-csv") {
      const body = await request.json();
      if (typeof body.csvText !== "string" || !body.csvText.trim()) return json({ error: "csvText is required" }, 400);
      const parsed = parseCsv(body.csvText);
      const mapped = parsed.rows.map(mapSponsorshipCsv).filter((row) => row.brand);
      if (body.preview) return json({ headers: parsed.headers, total_rows: parsed.rows.length, sample_mapped: mapped.slice(0, 5) });
      const created = [];
      for (const row of mapped) created.push(await insertRow(env, "sponsorships", row));
      return json({ inserted: created.length, skipped: parsed.rows.length - created.length });
    }

    const followupMatch = path.match(/^\/(sponsorships|media)\/(\d+)\/followup$/);
    if (method === "POST" && followupMatch) {
      const entity = followupMatch[1];
      const id = Number(followupMatch[2]);
      const body = await request.json();
      const updated = await updateRow(env, entity, id, { last_contact_date: today, follow_up_date: addDaysISO(today, Number(body.followUpDays) || 5), status: "Follow-up", needs_review: 0 });
      return updated ? json(enrichRows(entity, [updated], today)[0]) : json({ error: "Record not found." }, 404);
    }
    const platformsMatch = path.match(/^\/content\/(\d+)\/platforms$/);
    if (method === "POST" && platformsMatch) {
      const parent = await getRow(env, "content", Number(platformsMatch[1]));
      if (!parent) return json({ error: "Content item not found." }, 404);
      const body = await request.json();
      const created = [];
      for (const platform of Array.isArray(body.platforms) ? body.platforms : []) {
        created.push(await insertRow(env, "content", { ...parent, id: undefined, parent_idea_id: parent.parent_idea_id || parent.id, platform, title: parent.title, created_at: undefined, updated_at: undefined }));
      }
      return json(created, 201);
    }

    const match = path.match(/^\/([a-z_]+)(?:\/(\d+))?$/);
    if (!match || !API_TO_ENTITY[match[1]]) return json({ error: `API route not found: ${method} ${path}` }, 404);
    const entity = API_TO_ENTITY[match[1]];
    const id = match[2] ? Number(match[2]) : null;
    if (method === "GET" && id) {
      const row = await getRow(env, entity, id);
      return row ? json(enrichRows(entity, [row], today)[0]) : json({ error: "Record not found." }, 404);
    }
    if (method === "GET" && !id) return json(await listRows(env, entity, url, today));
    if (method === "POST" && !id) {
      const input = await request.json();
      if (entity === "content" && Array.isArray(input.platforms) && input.platforms.length > 1) {
        const [primary, ...extras] = input.platforms;
        const created = await insertRow(env, entity, { ...input, platform: primary.platform || primary, format: primary.format || input.format });
        for (const platform of extras) {
          await insertRow(env, entity, { ...input, parent_idea_id: created.id, platform: platform.platform || platform, format: platform.format || input.format });
        }
        return json(enrichRows(entity, [created], today)[0], 201);
      }
      const created = await insertRow(env, entity, input);
      if (entity === "sponsorships") await syncSponsorshipRevenue(env, created);
      return json(enrichRows(entity, [created], today)[0], 201);
    }
    if (method === "PUT" && id) {
      const updated = await updateRow(env, entity, id, await request.json());
      if (!updated) return json({ error: "Record not found." }, 404);
      if (entity === "sponsorships") await syncSponsorshipRevenue(env, updated);
      return json(enrichRows(entity, [updated], today)[0]);
    }
    if (method === "DELETE" && id) {
      if (entity === "sponsorships") await env.DB.prepare("DELETE FROM revenue_entries WHERE sponsorship_id = ? AND source = 'sponsorship-sync'").bind(id).run();
      return json({ deleted: await deleteRow(env, entity, id) });
    }
    return json({ error: "Method not allowed." }, 405, { Allow: id ? "GET, PUT, DELETE" : "GET, POST" });
  } catch (error) {
    return json({ error: cleanError(error) }, 400);
  }
}
