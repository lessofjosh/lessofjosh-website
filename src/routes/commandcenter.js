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
  },
  notes: {
    table: "notes",
    required: "title",
    order: "is_pinned DESC, updated_at DESC, id DESC",
    columns: fields("title body format tags category is_pinned is_archived record_type record_id color created_by updated_by created_at updated_at"),
    search: fields("title body tags category record_type")
  },
  attachments: {
    table: "attachments",
    required: "filename file_key",
    order: "created_at DESC, id DESC",
    columns: fields("filename file_key mime_type size_bytes record_type record_id title notes uploaded_by created_at updated_at"),
    search: fields("filename title notes mime_type record_type uploaded_by")
  },
  relationships: {
    table: "record_relationships",
    required: "source_type source_id target_type target_id",
    order: "created_at DESC, id DESC",
    columns: fields("source_type source_id target_type target_id relationship_label created_at"),
    search: fields("source_type target_type relationship_label")
  },
  custom_field_definitions: {
    table: "custom_field_definitions",
    required: "entity_type field_name field_label",
    order: "sort_order ASC, id ASC",
    columns: fields("entity_type field_name field_label field_type options_json default_value is_required sort_order created_at updated_at"),
    search: fields("entity_type field_name field_label")
  },
  custom_field_values: {
    table: "custom_field_values",
    required: "definition_id entity_type record_id",
    order: "id ASC",
    columns: fields("definition_id entity_type record_id value_text value_number value_json updated_at"),
    search: fields("value_text")
  },
  users: {
    table: "user_permissions",
    required: "email",
    order: "id ASC",
    columns: fields("email name role allowed_modules can_manage_users can_delete_records can_export_backup created_at updated_at"),
    search: fields("email name role")
  }
};

const API_TO_ENTITY = Object.fromEntries(Object.keys(TABLES).map((key) => [key, key]));
const CSV_ENTITIES = new Set([
  "sponsorships", "affiliates", "content", "revenue", "media", "growth",
  "goals", "tasks", "projects", "cookbook", "printing", "reference",
  "health", "notes", "attachments"
]);
const SNAPSHOT_INDEX_KEY = "commandcenter:backup:index";
const NULLABLE_NUMBERS = new Set([
  "usage_rights_fee", "revenue", "clicks", "parent_idea_id", "views", "ctr",
  "avg_view_duration", "subscribers_gained", "sponsorship_id", "affiliate_id",
  "tiktok", "instagram", "facebook", "youtube", "threads", "combined_audience",
  "youtube_watch_hours", "current_value", "target_value", "weight", "change_lbs",
  "record_id", "size_bytes", "source_id", "target_id", "definition_id", "value_number", "sort_order"
]);
const ZERO_NUMBERS = new Set(["cash_offered", "agreed_rate", "amount"]);
const BOOLEAN_FIELDS = new Set([
  "pitch_sent", "contract_signed", "content_posted", "invoice_sent", "payment_received",
  "needs_review", "winner", "is_historical", "photo_ready", "recipe_card_ready",
  "content_opportunity", "is_pinned", "is_archived", "is_required", "can_manage_users",
  "can_delete_records", "can_export_backup"
]);
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

const RESTORE_DOCUMENTATION_MD = `# Less of Josh Command Center: Database & Data Restore Documentation

## Overview
This document outlines the procedure to restore the Less of Josh Command Center operational database from either an automated KV snapshot or a JSON/CSV export file.

## 1. Web-Based Restore (One-Click)
Authorized Owners can restore from any previous snapshot directly in the Command Center UI:
1. Navigate to **Import & Backups** in the sidebar.
2. Under **Available Snapshots in KV**, locate the desired snapshot.
3. Click **Restore Snapshot**.
4. Choose:
   - **Replace Mode**: Safely clears existing operational tables and restores all records from the snapshot. (An automatic safety snapshot of the current state is created before restoring).
   - **Merge Mode**: Upserts all records matching their primary key id, preserving newer records not in the backup.
5. The system confirms the restore and refreshes the database.

## 2. D1 CLI Restore (Disaster Recovery)
If the web application is inaccessible, restore directly using the Cloudflare Wrangler CLI:

### Prerequisites:
- Wrangler CLI installed (\`wrangler --version\`)
- Authenticated account (\`wrangler whoami\`)
- Target database: \`less-of-josh-commandcenter\` (\`7149ac6c-9432-47e0-9874-70f53de39c02\`)

### Steps:
1. Obtain the latest JSON backup file (e.g., \`less-of-josh-backup-YYYY-MM-DD.json\`).
2. Run the baseline schema migration:
   \`\`\`bash
   wrangler d1 execute less-of-josh-commandcenter --file=./schema.sql --remote
   \`\`\`
3. Restore records table-by-table or using SQL \`INSERT OR REPLACE\` statements generated from the JSON backup.

## 3. Uploaded Files Manifest
Attachments are stored securely in Cloudflare Workers KV under the key prefix \`commandcenter:file:{file_key}\`.
Metadata records in the \`attachments\` table reference these keys.
The JSON backup contains the complete \`attachments\` table with all keys, MIME types, sizes, and record associations.
`;

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
  if (!existing && config.columns.includes("is_pinned") && data.is_pinned === undefined) data.is_pinned = 0;
  if (!existing && config.columns.includes("is_archived") && data.is_archived === undefined) data.is_archived = 0;
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
  if (!env.DB || !TABLES[entity]) return null;
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
  if (!env.DB || !config) return [];
  try {
    const result = await env.DB.prepare(`SELECT * FROM ${config.table} ORDER BY ${config.order}`).all();
    return result.results || [];
  } catch (err) {
    console.error(`Error querying ${config?.table}:`, err);
    return [];
  }
}

export async function getUserPermissions(env, session) {
  const email = (session?.email || "").trim().toLowerCase();
  const isJosh = email === "jwgreenway@gmail.com";
  if (isJosh) {
    return {
      email,
      name: session?.name || "Josh Greenway",
      role: "owner",
      allowed_modules: "all",
      can_manage_users: true,
      can_delete_records: true,
      can_export_backup: true
    };
  }

  let dbUser = null;
  try {
    if (env.DB) {
      dbUser = await env.DB.prepare("SELECT * FROM user_permissions WHERE LOWER(email) = ?").bind(email).first();
    }
  } catch (err) {
    console.error("Failed to query user_permissions:", err);
  }

  if (dbUser) {
    return {
      email,
      name: dbUser.name || session?.name || "Authorized User",
      role: dbUser.role || "admin",
      allowed_modules: dbUser.allowed_modules || "all",
      can_manage_users: Boolean(Number(dbUser.can_manage_users)),
      can_delete_records: Boolean(Number(dbUser.can_delete_records)),
      can_export_backup: Boolean(Number(dbUser.can_export_backup))
    };
  }

  // Fallback default for Rita
  return {
    email,
    name: session?.name || "Rita Greenway",
    role: "admin",
    allowed_modules: "all",
    can_manage_users: false,
    can_delete_records: true,
    can_export_backup: true
  };
}

export function isModuleAllowed(permissions, moduleName) {
  if (!permissions) return false;
  if (permissions.role === "owner" || permissions.role === "admin") return true;
  if (permissions.allowed_modules === "all") return true;
  const allowed = permissions.allowed_modules.split(",").map((s) => s.trim().toLowerCase());
  return allowed.includes(moduleName.toLowerCase());
}

async function getRecordSummary(env, entityType, id) {
  try {
    const row = await getRow(env, entityType, id);
    if (!row) return null;
    let title = "";
    let subtitle = "";
    let status = row.status || row.stage || "";
    switch (entityType) {
      case "sponsorships":
        title = row.brand;
        subtitle = `${row.category || "Sponsorship"} • Rate: $${row.agreed_rate || row.cash_offered || 0}`;
        break;
      case "media":
        title = row.outlet;
        subtitle = `${row.type || "Media"} • Contact: ${row.contact_name || "N/A"}`;
        break;
      case "affiliates":
        title = row.program;
        subtitle = `${row.category || "Affiliate"} • Code: ${row.coupon_code || row.discount_code || "None"}`;
        break;
      case "content":
        title = row.title;
        subtitle = `${row.platform || "Platform"} • ${row.format || "Format"}`;
        break;
      case "revenue":
        title = `${row.source_name || row.category} ($${row.amount || 0})`;
        subtitle = `${row.category} • Date: ${row.entry_date}`;
        break;
      case "growth":
        title = `Growth Snapshot ${row.snapshot_date}`;
        subtitle = `Audience: ${row.combined_audience || "N/A"}`;
        break;
      case "goals":
        title = row.goal;
        subtitle = `${row.cycle} • Deadline: ${row.deadline || "None"}`;
        break;
      case "tasks":
        title = row.task_name;
        subtitle = `${row.category || "Task"} • Due: ${row.due_date || "No due date"}`;
        break;
      case "projects":
        title = row.name;
        subtitle = `${row.category || "Project"} • ${row.pricing_model || ""}`;
        break;
      case "cookbook":
        title = row.recipe;
        subtitle = `${row.category || "Recipe"}`;
        break;
      case "printing":
        title = row.project;
        subtitle = `${row.category || "3D Print"} • Material: ${row.material || "N/A"}`;
        break;
      case "reference":
        title = row.title;
        subtitle = `${row.category || "Reference"}`;
        break;
      case "health":
        title = `${row.entry_date}: ${row.entry}`;
        subtitle = row.weight ? `Weight: ${row.weight} lbs` : "Health log";
        break;
      case "notes":
        title = row.title;
        subtitle = `${row.category || "Note"} • ${row.tags || ""}`;
        break;
      case "attachments":
        title = row.title || row.filename;
        subtitle = `${row.mime_type} • ${(Number(row.size_bytes || 0) / 1024).toFixed(1)} KB`;
        break;
      default:
        title = String(row.name || row.title || row.id);
        subtitle = entityType;
    }
    return { id: row.id, entity_type: entityType, title, subtitle, status, data: row };
  } catch {
    return null;
  }
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
  const exact = ["status", "category", "cycle", "stage", "platform", "format", "type", "record_type"];
  let result = rows;
  for (const key of exact) {
    const value = params.get(key);
    if (value && value !== "all" && config.columns.includes(key)) result = result.filter((row) => String(row[key]) === value);
  }
  for (const key of ["needs_review", "is_historical", "is_pinned", "is_archived"]) {
    if (params.has(key) && config.columns.includes(key)) {
      const expected = params.get(key) === "true" ? 1 : 0;
      result = result.filter((row) => Number(row[key]) === expected);
    }
  }
  if (params.get("record_id") && config.columns.includes("record_id")) {
    const recId = Number(params.get("record_id"));
    result = result.filter((row) => Number(row.record_id) === recId);
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
  const entities = ["sponsorships", "media", "affiliates", "content", "revenue", "growth", "goals", "tasks", "projects", "cookbook", "printing", "reference", "health", "notes", "attachments"];
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
      reference_documents: data.reference.length,
      notes: data.notes?.length || 0,
      attachments: data.attachments?.length || 0
    }
  };
}

async function exportBackup(env) {
  const entities = Object.keys(TABLES).filter((entity) => entity !== "import_logs");
  const rows = await Promise.all(entities.map((entity) => getRawRows(env, entity)));
  const data = Object.fromEntries(entities.map((entity, index) => [TABLES[entity].table, rows[index]]));
  const attachments = data.attachments || [];
  const manifest = attachments.map((a) => ({
    id: a.id,
    filename: a.filename,
    file_key: a.file_key,
    mime_type: a.mime_type,
    size_bytes: a.size_bytes,
    record_type: a.record_type,
    record_id: a.record_id,
    kv_key: `commandcenter:file:${a.file_key}`
  }));

  return {
    system: "Less of Josh Command Center",
    schema_version: 3,
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(data).map(([table, values]) => [table, values.length])),
    attachments_manifest: manifest,
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

export async function saveSnapshot(env) {
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

export async function autoBackupCommandCenter(env) {
  try {
    if (!env?.LOJ_KV || !env?.DB) return false;
    const index = (await env.LOJ_KV.get(SNAPSHOT_INDEX_KEY, { type: "json" })) || [];
    const latest = index[0];
    if (latest && latest.created_at) {
      const ageHours = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 3600);
      if (ageHours < 24) return false; // Snapshot is fresh
    }
    await saveSnapshot(env);
    return true;
  } catch (err) {
    console.error("Auto backup error:", err);
    return false;
  }
}

async function restoreBackup(env, backup, mode = "replace") {
  if (!backup?.data || typeof backup.data !== "object") throw new Error("Invalid backup: missing data");
  if (mode !== "replace" && mode !== "merge") throw new Error("Restore mode must be replace or merge");
  await saveSnapshot(env);
  const statements = [];
  const restoreOrder = [
    "revenue", "content", "affiliates", "sponsorships", "media", "growth",
    "goals", "tasks", "projects", "cookbook", "printing", "reference",
    "health", "notes", "attachments", "relationships", "custom_field_values",
    "custom_field_definitions", "users"
  ];
  if (mode === "replace") {
    for (const entity of restoreOrder) {
      if (TABLES[entity]) statements.push(env.DB.prepare(`DELETE FROM ${TABLES[entity].table}`));
    }
  }
  for (const entity of [...restoreOrder].reverse()) {
    const config = TABLES[entity];
    if (!config) continue;
    const rows = backup.data[config.table] || [];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const data = Object.fromEntries([["id", row.id], ...config.columns.map((column) => [column, row[column]])].filter(([, value]) => value !== undefined));
      const keys = Object.keys(data);
      statements.push(env.DB.prepare(`INSERT OR REPLACE INTO ${config.table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).bind(...keys.map((key) => data[key])));
    }
  }
  if (statements.length) {
    await env.DB.batch(statements);
  }
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
  // Support direct deep links to SPA views (e.g. /commandcenter/notes -> /commandcenter/index.html)
  let assetPath = cleanPath;
  if (cleanPath === "/commandcenter" || (cleanPath.startsWith("/commandcenter/") && !cleanPath.endsWith(".js") && !cleanPath.endsWith(".css"))) {
    assetPath = "/commandcenter/index.html";
  }

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

  const permissions = await getUserPermissions(env, session);
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
        user: { email: session.email, name: session.name, role: permissions.role },
        permissions,
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

    // Role-based module access check
    const moduleMatch = path.match(/^\/([a-z_]+)/);
    if (moduleMatch && !["meta", "dashboard", "search", "backup", "export", "files", "relationships", "custom-fields"].includes(moduleMatch[1])) {
      const moduleName = moduleMatch[1];
      if (!isModuleAllowed(permissions, moduleName)) {
        return json({ error: `Forbidden. You do not have access to module: ${moduleName}.` }, 403);
      }
    }

    if (method === "GET" && path === "/dashboard") return json(await getDashboard(env, today));
    if (method === "GET" && path === "/revenue/summary") {
      const data = await loadOperationalData(env, today);
      return json(revenueSummary(data.revenue, data.sponsorships, data.affiliates, today));
    }
    if (method === "GET" && path === "/growth/summary") return json(growthSummary(enrichGrowth(await getRawRows(env, "growth"))));

    // Universal Search
    if (method === "GET" && path === "/search") {
      const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
      const typeFilter = url.searchParams.get("type");
      let searchEntities = [
        "sponsorships", "media", "affiliates", "content", "revenue", "growth",
        "goals", "tasks", "projects", "cookbook", "printing", "reference",
        "health", "notes", "attachments"
      ];
      if (typeFilter && typeFilter !== "all" && searchEntities.includes(typeFilter)) {
        searchEntities = [typeFilter];
      }
      const tokens = query.split(/\s+/).filter(Boolean);
      const results = [];
      const countsByType = {};
      const legacyResults = {};
      const typeLabelMap = {
        sponsorships: "Sponsorship",
        media: "Media",
        affiliates: "Affiliate",
        content: "Content",
        revenue: "Revenue",
        growth: "Growth",
        goals: "Goal",
        tasks: "Task",
        projects: "Project",
        cookbook: "Recipe",
        printing: "3D Print",
        reference: "Reference",
        health: "Health",
        notes: "Note",
        attachments: "File"
      };

      for (const entity of searchEntities) {
        const legacyKey = entity === "media" ? "media_outreach" : entity === "reference" ? "reference_documents" : entity;
        const config = TABLES[entity];
        if (!config) continue;
        const rows = await getRawRows(env, entity);
        const enriched = enrichRows(entity, rows, today);
        let matchedRows = [];
        if (!query) {
          matchedRows = [];
        } else {
          matchedRows = enriched.filter((row) => {
            return tokens.every((token) => {
              return config.search.some((col) => {
                const val = String(row[col] ?? "").toLowerCase();
                return val.includes(token);
              });
            });
          });
        }

        countsByType[legacyKey] = matchedRows.length;
        legacyResults[legacyKey] = matchedRows;

        for (const row of matchedRows) {
          let title = "";
          let subtitle = "";
          let status = row.status || row.stage || "";
          let matchingSnippet = "";

          for (const col of config.search) {
            const text = String(row[col] ?? "");
            const lower = text.toLowerCase();
            const matchedToken = tokens.find((t) => lower.includes(t));
            if (matchedToken) {
              const idx = lower.indexOf(matchedToken);
              const start = Math.max(0, idx - 40);
              const end = Math.min(text.length, idx + matchedToken.length + 40);
              const snippetText = (start > 0 ? "..." : "") + text.slice(start, end).trim() + (end < text.length ? "..." : "");
              matchingSnippet = `${col.replace(/_/g, " ")}: "${snippetText}"`;
              break;
            }
          }

          switch (entity) {
            case "sponsorships":
              title = row.brand;
              subtitle = `${row.category || "Sponsorship"} • Contact: ${row.contact_name || "N/A"}`;
              break;
            case "media":
              title = row.outlet;
              subtitle = `${row.type || "Media"} • Contact: ${row.contact_name || "N/A"}`;
              break;
            case "affiliates":
              title = row.program;
              subtitle = `${row.category || "Affiliate"} • Code: ${row.coupon_code || row.discount_code || "None"}`;
              break;
            case "content":
              title = row.title;
              subtitle = `${row.platform || "Platform"} • ${row.format || "Format"}`;
              break;
            case "revenue":
              title = `${row.source_name || row.category} ($${row.amount || 0})`;
              subtitle = `${row.category} • Date: ${row.entry_date}`;
              break;
            case "growth":
              title = `Growth Snapshot ${row.snapshot_date}`;
              subtitle = `Audience: ${row.combined_audience || "N/A"}`;
              break;
            case "goals":
              title = row.goal;
              subtitle = `${row.cycle} • Deadline: ${row.deadline || "None"}`;
              break;
            case "tasks":
              title = row.task_name;
              subtitle = `${row.category || "Task"} • Due: ${row.due_date || "No due date"}`;
              break;
            case "projects":
              title = row.name;
              subtitle = `${row.category || "Project"} • ${row.status || ""}`;
              break;
            case "cookbook":
              title = row.recipe;
              subtitle = `${row.category || "Recipe"} • Status: ${row.status || ""}`;
              break;
            case "printing":
              title = row.project;
              subtitle = `${row.category || "3D Print"} • Material: ${row.material || "N/A"}`;
              break;
            case "reference":
              title = row.title;
              subtitle = `${row.category || "Reference"}`;
              break;
            case "health":
              title = `${row.entry_date}: ${row.entry}`;
              subtitle = row.weight ? `Weight: ${row.weight} lbs` : "Health log";
              break;
            case "notes":
              title = row.title;
              subtitle = `${row.category || "Note"} • ${row.tags || ""}`;
              break;
            case "attachments":
              title = row.title || row.filename;
              subtitle = `${row.mime_type} • ${(Number(row.size_bytes || 0) / 1024).toFixed(1)} KB`;
              break;
            default:
              title = String(row.name || row.title || row.id);
              subtitle = entity;
          }

          results.push({
            id: row.id,
            type: entity,
            type_label: typeLabelMap[entity] || entity,
            entity,
            entity_key: legacyKey,
            title,
            subtitle,
            status,
            snippet: matchingSnippet,
            target_view: entity === "media" ? "media" : entity === "reference" ? "reference" : entity === "attachments" ? "files" : entity,
            record_id: row.id
          });
        }
      }

      return json({
        query,
        total: results.length,
        results,
        counts_by_type: countsByType,
        ...legacyResults
      });
    }

    // Record Relationships
    if (method === "GET" && path === "/relationships") {
      const type = url.searchParams.get("type") || url.searchParams.get("record_type");
      const id = Number(url.searchParams.get("id") || url.searchParams.get("record_id"));
      if (!type || !id) return json({ error: "type and id are required" }, 400);

      const rels = await env.DB.prepare(
        "SELECT * FROM record_relationships WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?) ORDER BY created_at DESC"
      ).bind(type, id, type, id).all();

      const results = [];
      for (const rel of (rels.results || [])) {
        const isSource = rel.source_type === type && rel.source_id === id;
        const otherType = isSource ? rel.target_type : rel.source_type;
        const otherId = isSource ? rel.target_id : rel.source_id;
        const summary = await getRecordSummary(env, otherType, otherId);
        results.push({
          id: rel.id,
          source_type: rel.source_type,
          source_id: rel.source_id,
          target_type: rel.target_type,
          target_id: rel.target_id,
          relationship_label: rel.relationship_label,
          direction: isSource ? "outgoing" : "incoming",
          created_at: rel.created_at,
          record: summary || {
            id: otherId,
            entity_type: otherType,
            title: `${otherType} #${otherId}`,
            subtitle: otherType,
            status: "",
            data: null
          }
        });
      }

      if (type !== "attachments") {
        const files = await env.DB.prepare("SELECT * FROM attachments WHERE record_type = ? AND record_id = ?").bind(type, id).all();
        for (const file of (files.results || [])) {
          results.push({
            id: `implicit_file_${file.id}`,
            source_type: type,
            source_id: id,
            target_type: "attachments",
            target_id: file.id,
            relationship_label: "attachment",
            direction: "outgoing",
            created_at: file.created_at,
            record: {
              id: file.id,
              entity_type: "attachments",
              title: file.title || file.filename,
              subtitle: `${file.mime_type} • ${(file.size_bytes / 1024).toFixed(1)} KB`,
              status: "Uploaded",
              data: file
            }
          });
        }
      }

      if (type !== "notes") {
        const notes = await env.DB.prepare("SELECT * FROM notes WHERE record_type = ? AND record_id = ? AND is_archived = 0").bind(type, id).all();
        for (const note of (notes.results || [])) {
          results.push({
            id: `implicit_note_${note.id}`,
            source_type: type,
            source_id: id,
            target_type: "notes",
            target_id: note.id,
            relationship_label: "note",
            direction: "outgoing",
            created_at: note.created_at,
            record: {
              id: note.id,
              entity_type: "notes",
              title: note.title,
              subtitle: `${note.category} • ${note.tags}`,
              status: note.is_pinned ? "Pinned" : "Active",
              data: note
            }
          });
        }
      }

      return json({ type, id, relationships: results });
    }

    if (method === "POST" && path === "/relationships") {
      const body = await request.json();
      const { source_type, source_id, target_type, target_id, relationship_label, relationship_type } = body;
      const label = relationship_label || relationship_type || "relates_to";
      if (!source_type || !source_id || !target_type || !target_id) {
        return json({ error: "source_type, source_id, target_type, and target_id are required" }, 400);
      }
      const now = new Date().toISOString();
      const res = await env.DB.prepare(
        "INSERT OR REPLACE INTO record_relationships (source_type, source_id, target_type, target_id, relationship_label, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(source_type, Number(source_id), target_type, Number(target_id), label, now).run();
      const relId = res?.meta?.last_row_id;
      const rel = relId ? await env.DB.prepare("SELECT * FROM record_relationships WHERE id = ?").bind(relId).first() : null;
      const relData = rel || { id: relId || 1, source_type, source_id: Number(source_id), target_type, target_id: Number(target_id), relationship_label: label };
      return json({ success: true, relationship: relData, ...relData }, 201);
    }

    const relDelMatch = path.match(/^\/relationships\/(\d+)$/);
    if (method === "DELETE" && relDelMatch) {
      if (!permissions.can_delete_records) return json({ error: "Forbidden. Delete permission required." }, 403);
      const relId = Number(relDelMatch[1]);
      await env.DB.prepare("DELETE FROM record_relationships WHERE id = ?").bind(relId).run();
      return json({ success: true, deleted: true });
    }

    // Custom Fields
    if (method === "GET" && path === "/custom-fields/definitions") {
      const entityType = url.searchParams.get("entity_type") || url.searchParams.get("table_name");
      let query = "SELECT * FROM custom_field_definitions";
      const params = [];
      if (entityType) {
        query += " WHERE entity_type = ?";
        params.push(entityType);
      }
      query += " ORDER BY sort_order ASC, id ASC";
      const res = await env.DB.prepare(query).bind(...params).all();
      const definitions = (res.results || []).map((r) => ({ ...r, table_name: r.entity_type }));
      return json({ definitions, total: definitions.length });
    }

    if (method === "POST" && path === "/custom-fields/definitions") {
      const body = await request.json();
      const entity_type = body.entity_type || body.table_name;
      const { field_name, field_label, field_type, options_json, default_value, is_required, sort_order } = body;
      if (!entity_type || !field_name || !field_label) {
        return json({ error: "entity_type or table_name, field_name, and field_label are required" }, 400);
      }
      const cleanName = field_name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const now = new Date().toISOString();
      const existing = await env.DB.prepare("SELECT id FROM custom_field_definitions WHERE entity_type = ? AND field_name = ?").bind(entity_type, cleanName).first();
      if (existing) {
        await env.DB.prepare(
          "UPDATE custom_field_definitions SET field_label = ?, field_type = ?, options_json = ?, default_value = ?, is_required = ?, sort_order = ?, updated_at = ? WHERE id = ?"
        ).bind(field_label, field_type || "text", typeof options_json === "string" ? options_json : JSON.stringify(options_json || []), default_value || "", is_required ? 1 : 0, Number(sort_order) || 0, now, existing.id).run();
        const row = await getRow(env, "custom_field_definitions", existing.id);
        const def = { ...row, table_name: row.entity_type };
        return json({ ...def, definition: def });
      } else {
        const res = await env.DB.prepare(
          "INSERT INTO custom_field_definitions (entity_type, field_name, field_label, field_type, options_json, default_value, is_required, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(entity_type, cleanName, field_label, field_type || "text", typeof options_json === "string" ? options_json : JSON.stringify(options_json || []), default_value || "", is_required ? 1 : 0, Number(sort_order) || 0, now, now).run();
        const row = await getRow(env, "custom_field_definitions", res.meta.last_row_id);
        const def = row ? { ...row, table_name: row.entity_type } : { id: res.meta.last_row_id, entity_type, table_name: entity_type, field_name: cleanName, field_label, field_type: field_type || "text", default_value: default_value || "" };
        return json({ ...def, definition: def }, 201);
      }
    }

    if (method === "DELETE" && path.match(/^\/custom-fields\/definitions\/(\d+)$/)) {
      if (!permissions.can_delete_records) return json({ error: "Forbidden. Delete permission required." }, 403);
      const defId = Number(path.split("/")[3]);
      await env.DB.prepare("DELETE FROM custom_field_definitions WHERE id = ?").bind(defId).run();
      await env.DB.prepare("DELETE FROM custom_field_values WHERE definition_id = ?").bind(defId).run();
      return json({ deleted: true });
    }

    if (method === "GET" && path === "/custom-fields/values") {
      const entityType = url.searchParams.get("entity_type") || url.searchParams.get("record_type") || url.searchParams.get("table_name");
      const recordId = Number(url.searchParams.get("record_id"));
      if (!entityType || !recordId) return json({ error: "entity_type and record_id are required" }, 400);
      const rows = await env.DB.prepare(`
        SELECT d.id as definition_id, d.field_name, d.field_label, d.field_type, d.options_json, d.default_value, d.is_required,
               v.id as value_id, v.value_text, v.value_number, v.value_json, v.updated_at
        FROM custom_field_definitions d
        LEFT JOIN custom_field_values v ON v.definition_id = d.id AND v.record_id = ?
        WHERE d.entity_type = ?
        ORDER BY d.sort_order ASC, d.id ASC
      `).bind(recordId, entityType).all();
      const valuesObj = {};
      for (const row of (rows.results || [])) {
        valuesObj[row.field_name] = row.value_text ?? row.value_number ?? row.value_json;
      }
      return json({ values: valuesObj, rows: rows.results || [] });
    }

    if (method === "POST" && path === "/custom-fields/values") {
      const body = await request.json();
      const entity_type = body.entity_type || body.record_type || body.table_name;
      const record_id = body.record_id;
      const values = body.values;
      if (!entity_type || !record_id || typeof values !== "object") {
        return json({ error: "entity_type, record_id, and values object are required" }, 400);
      }
      const now = new Date().toISOString();
      for (const [key, val] of Object.entries(values)) {
        let defId = Number(key);
        if (isNaN(defId)) {
          const def = await env.DB.prepare("SELECT id FROM custom_field_definitions WHERE entity_type = ? AND field_name = ?").bind(entity_type, key).first();
          if (def) defId = def.id;
          else continue;
        }
        let valText = typeof val === "string" ? val : String(val ?? "");
        let valNumber = typeof val === "number" ? val : (val !== "" && val !== null && !isNaN(Number(val)) ? Number(val) : null);
        let valJson = typeof val === "object" && val !== null ? JSON.stringify(val) : null;
        await env.DB.prepare(`
          INSERT INTO custom_field_values (definition_id, entity_type, record_id, value_text, value_number, value_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(definition_id, record_id) DO UPDATE SET
            value_text = excluded.value_text,
            value_number = excluded.value_number,
            value_json = excluded.value_json,
            updated_at = excluded.updated_at
        `).bind(defId, entity_type, Number(record_id), valText, valNumber, valJson, now).run();
      }
      return json({ success: true });
    }

    // Files & Attachments
    if (path === "/files" && method === "GET") {
      return json(await listRows(env, "attachments", url, today));
    }

    if (path === "/files/upload" && method === "POST") {
      if (!env.LOJ_KV) return json({ error: "File storage is unavailable" }, 503);
      const contentType = request.headers.get("content-type") || "";
      let filename = "attachment";
      let mimeType = "application/octet-stream";
      let sizeBytes = 0;
      let recordType = "general";
      let recordId = null;
      let title = "";
      let notes = "";
      let arrayBuffer = null;

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file.arrayBuffer !== "function") {
          return json({ error: "A valid file is required in form-data field 'file'" }, 400);
        }
        filename = file.name || "attachment";
        mimeType = file.type || "application/octet-stream";
        arrayBuffer = await file.arrayBuffer();
        sizeBytes = arrayBuffer.byteLength;
        recordType = formData.get("record_type") || "general";
        recordId = formData.get("record_id") ? Number(formData.get("record_id")) : null;
        title = formData.get("title") || filename;
        notes = formData.get("notes") || "";
      } else if (contentType.includes("application/json")) {
        const body = await request.json();
        filename = body.filename || "attachment.dat";
        mimeType = body.mime_type || "application/octet-stream";
        recordType = body.record_type || "general";
        recordId = body.record_id ? Number(body.record_id) : null;
        title = body.title || filename;
        notes = body.notes || "";
        if (body.base64) {
          const binary = atob(body.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          arrayBuffer = bytes.buffer;
          sizeBytes = arrayBuffer.byteLength;
        } else if (body.content) {
          const enc = new TextEncoder();
          const bytes = enc.encode(body.content);
          arrayBuffer = bytes.buffer;
          sizeBytes = arrayBuffer.byteLength;
        } else {
          return json({ error: "File content (base64 or content) is required" }, 400);
        }
      } else {
        return json({ error: "Unsupported Content-Type for upload" }, 400);
      }

      if (sizeBytes > 25 * 1024 * 1024) {
        return json({ error: "File exceeds 25 MB size limit" }, 413);
      }

      const fileKey = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await env.LOJ_KV.put(`commandcenter:file:${fileKey}`, arrayBuffer);

      const created = await insertRow(env, "attachments", {
        filename,
        file_key: fileKey,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        record_type: recordType,
        record_id: recordId,
        title: title || filename,
        notes,
        uploaded_by: session.email
      });

      return json({ ...created, attachment: created }, 201);
    }

    const fileViewMatch = path.match(/^\/files\/(\d+)\/(view|download)$/);
    if (method === "GET" && fileViewMatch) {
      const fileId = Number(fileViewMatch[1]);
      const action = fileViewMatch[2];
      const fileRecord = await getRow(env, "attachments", fileId);
      if (!fileRecord) return json({ error: "File not found" }, 404);
      if (!env.LOJ_KV) return json({ error: "File storage unavailable" }, 503);
      const fileData = await env.LOJ_KV.get(`commandcenter:file:${fileRecord.file_key}`, { type: "arrayBuffer" });
      if (!fileData) return json({ error: "File content not found in storage" }, 404);
      const disposition = action === "download" ? "attachment" : "inline";
      return new Response(fileData, {
        status: 200,
        headers: {
          "Content-Type": fileRecord.mime_type || "application/octet-stream",
          "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileRecord.filename)}"`,
          ...PRIVATE_HEADERS,
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    const fileItemMatch = path.match(/^\/files\/(\d+)$/);
    if (fileItemMatch) {
      const fileId = Number(fileItemMatch[1]);
      if (method === "GET") {
        const fileRecord = await getRow(env, "attachments", fileId);
        return fileRecord ? json(fileRecord) : json({ error: "File not found" }, 404);
      }
      if (method === "PUT") {
        const updated = await updateRow(env, "attachments", fileId, await request.json());
        return updated ? json(updated) : json({ error: "File not found" }, 404);
      }
      if (method === "DELETE") {
        if (!permissions.can_delete_records) return json({ error: "Forbidden. Delete permission required." }, 403);
        const fileRecord = await getRow(env, "attachments", fileId);
        if (fileRecord && env.LOJ_KV) {
          try { await env.LOJ_KV.delete(`commandcenter:file:${fileRecord.file_key}`); } catch {}
        }
        return json({ success: true, deleted: await deleteRow(env, "attachments", fileId) });
      }
    }

    // Notes Pin & Archive actions
    const noteActionMatch = path.match(/^\/notes\/(\d+)\/(pin|archive)$/);
    if (method === "POST" && noteActionMatch) {
      const noteId = Number(noteActionMatch[1]);
      const action = noteActionMatch[2];
      const note = await getRow(env, "notes", noteId);
      if (!note) return json({ error: "Note not found" }, 404);
      const now = new Date().toISOString();
      let updated;
      if (action === "pin") {
        updated = await updateRow(env, "notes", noteId, { is_pinned: note.is_pinned ? 0 : 1, updated_at: now });
      } else if (action === "archive") {
        updated = await updateRow(env, "notes", noteId, { is_archived: note.is_archived ? 0 : 1, updated_at: now });
      }
      return json({ ...updated, pinned: updated.is_pinned, archived: updated.is_archived });
    }

    // User Permissions Management
    if (method === "GET" && path === "/users") {
      if (!permissions.can_manage_users && permissions.role !== "owner") {
        return json({ error: "Forbidden. Admin access required." }, 403);
      }
      const users = await getRawRows(env, "users");
      return json({ users, total: users.length });
    }

    const userItemMatch = path.match(/^\/users\/(\d+)$/);
    if (userItemMatch) {
      const userId = Number(userItemMatch[1]);
      if (method === "PUT") {
        if (permissions.role !== "owner") {
          return json({ error: "Forbidden. Only the owner can manage user permissions." }, 403);
        }
        const updated = await updateRow(env, "users", userId, await request.json());
        return json(updated);
      }
    }

    // Exports and Backups
    const exportMatch = path.match(/^\/export\/csv\/([a-z_]+)$/);
    if (method === "GET" && exportMatch && CSV_ENTITIES.has(exportMatch[1])) {
      const entity = exportMatch[1];
      const body = toCsv(await listRows(env, entity, url, today), TABLES[entity]);
      return new Response(body, { headers: { "Content-Type": "text/csv; charset=UTF-8", "Content-Disposition": `attachment; filename="less-of-josh-${entity}-${today}.csv"`, ...PRIVATE_HEADERS } });
    }
    if (method === "GET" && path === "/backup/json") {
      if (!permissions.can_export_backup) return json({ error: "Forbidden. Export permission required." }, 403);
      return new Response(JSON.stringify(await exportBackup(env), null, 2), { headers: { "Content-Type": "application/json; charset=UTF-8", "Content-Disposition": `attachment; filename="less-of-josh-backup-${today}.json"`, ...PRIVATE_HEADERS } });
    }
    if (method === "GET" && path === "/backup/restore-guide") {
      return json({ guide_markdown: RESTORE_DOCUMENTATION_MD, markdown: RESTORE_DOCUMENTATION_MD });
    }
    if (method === "GET" && path === "/backup/snapshots") return json(env.LOJ_KV ? (await env.LOJ_KV.get(SNAPSHOT_INDEX_KEY, { type: "json" })) || [] : []);
    if (method === "POST" && path === "/backup/snapshot") {
      if (!permissions.can_export_backup) return json({ error: "Forbidden. Export permission required." }, 403);
      return json(await saveSnapshot(env), 201);
    }
    if (method === "POST" && path === "/backup/restore") {
      if (permissions.role !== "owner") return json({ error: "Forbidden. Only the owner can restore backups." }, 403);
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

    // Generic REST routes for all entities
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
      const enriched = enrichRows(entity, [created], today)[0];
      return json({ ...enriched, note: entity === "notes" ? enriched : undefined }, 201);
    }
    if (method === "PUT" && id) {
      const updated = await updateRow(env, entity, id, await request.json());
      if (!updated) return json({ error: "Record not found." }, 404);
      if (entity === "sponsorships") await syncSponsorshipRevenue(env, updated);
      return json(enrichRows(entity, [updated], today)[0]);
    }
    if (method === "DELETE" && id) {
      if (!permissions.can_delete_records) return json({ error: "Forbidden. Delete permission required." }, 403);
      if (entity === "sponsorships") await env.DB.prepare("DELETE FROM revenue_entries WHERE sponsorship_id = ? AND source = 'sponsorship-sync'").bind(id).run();
      const deleted = await deleteRow(env, entity, id);
      return json({ success: true, deleted });
    }
    return json({ error: "Method not allowed." }, 405, { Allow: id ? "GET, PUT, DELETE" : "GET, POST" });
  } catch (error) {
    return json({ error: cleanError(error) }, 400);
  }
}
