PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sponsorships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '',
  date_first_contacted TEXT NOT NULL DEFAULT '',
  last_contact_date TEXT NOT NULL DEFAULT '',
  follow_up_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Prospect',
  original_status TEXT NOT NULL DEFAULT '',
  pitch_sent INTEGER NOT NULL DEFAULT 0,
  response TEXT NOT NULL DEFAULT '',
  product_offered TEXT NOT NULL DEFAULT '',
  products_requested TEXT NOT NULL DEFAULT '',
  cash_offered REAL NOT NULL DEFAULT 0,
  agreed_rate REAL NOT NULL DEFAULT 0,
  usage_rights_fee REAL DEFAULT NULL,
  deliverables TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  contract_signed INTEGER NOT NULL DEFAULT 0,
  content_posted INTEGER NOT NULL DEFAULT 0,
  invoice_sent INTEGER NOT NULL DEFAULT 0,
  payment_received INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_record_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sponsorships_status ON sponsorships(status);
CREATE INDEX IF NOT EXISTS idx_sponsorships_followup ON sponsorships(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_sponsorships_due ON sponsorships(due_date);
CREATE INDEX IF NOT EXISTS idx_sponsorships_brand ON sponsorships(brand);

CREATE TABLE IF NOT EXISTS affiliates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  affiliate_url TEXT NOT NULL DEFAULT '',
  coupon_code TEXT NOT NULL DEFAULT '',
  discount_code TEXT NOT NULL DEFAULT '',
  commission TEXT NOT NULL DEFAULT '',
  payout_terms TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  last_promoted TEXT NOT NULL DEFAULT '',
  revenue REAL DEFAULT NULL,
  clicks INTEGER DEFAULT NULL,
  conversion_info TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  last_updated TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_affiliates_program ON affiliates(program);

CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_idea_id INTEGER DEFAULT NULL,
  title TEXT NOT NULL,
  content_pillar TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'Short-form',
  stage TEXT NOT NULL DEFAULT 'Idea',
  original_status TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  filming_status TEXT NOT NULL DEFAULT 'Not Started',
  editing_status TEXT NOT NULL DEFAULT 'Not Started',
  scheduled_date TEXT NOT NULL DEFAULT '',
  published_date TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  views INTEGER DEFAULT NULL,
  ctr REAL DEFAULT NULL,
  avg_view_duration REAL DEFAULT NULL,
  subscribers_gained INTEGER DEFAULT NULL,
  revenue REAL DEFAULT NULL,
  winner INTEGER NOT NULL DEFAULT 0,
  sponsor TEXT NOT NULL DEFAULT '',
  sponsorship_id INTEGER DEFAULT NULL,
  affiliate_connection TEXT NOT NULL DEFAULT '',
  affiliate_id INTEGER DEFAULT NULL,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_idea_id) REFERENCES content_items(id) ON DELETE SET NULL,
  FOREIGN KEY (sponsorship_id) REFERENCES sponsorships(id) ON DELETE SET NULL,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_stage ON content_items(stage);
CREATE INDEX IF NOT EXISTS idx_content_scheduled ON content_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_content_parent ON content_items(parent_idea_id);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  entry_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Received',
  cycle TEXT NOT NULL DEFAULT '',
  sponsorship_id INTEGER DEFAULT NULL,
  affiliate_id INTEGER DEFAULT NULL,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (sponsorship_id) REFERENCES sponsorships(id) ON DELETE SET NULL,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_revenue_category ON revenue_entries(category);
CREATE INDEX IF NOT EXISTS idx_revenue_sponsorship ON revenue_entries(sponsorship_id);

CREATE TABLE IF NOT EXISTS media_outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  cc_alternate TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  pitch_subject TEXT NOT NULL DEFAULT '',
  story_angle TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Prospect',
  original_status TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  last_contact_date TEXT NOT NULL DEFAULT '',
  follow_up_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  needs_review INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_status ON media_outreach(status);
CREATE INDEX IF NOT EXISTS idx_media_followup ON media_outreach(follow_up_date);

CREATE TABLE IF NOT EXISTS growth_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  tiktok INTEGER DEFAULT NULL,
  instagram INTEGER DEFAULT NULL,
  facebook INTEGER DEFAULT NULL,
  youtube INTEGER DEFAULT NULL,
  threads INTEGER DEFAULT NULL,
  combined_audience INTEGER DEFAULT NULL,
  youtube_watch_hours REAL DEFAULT NULL,
  revenue REAL DEFAULT NULL,
  cycle TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_date ON growth_snapshots(snapshot_date);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal TEXT NOT NULL,
  cycle TEXT NOT NULL DEFAULT 'Cycle 2',
  area TEXT NOT NULL DEFAULT '',
  current_value REAL DEFAULT NULL,
  target_value REAL DEFAULT NULL,
  deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'On Track',
  weekly_action TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_historical INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_cycle ON goals(cycle);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not started',
  due_date TEXT NOT NULL DEFAULT '',
  assignee TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  needs_review INTEGER NOT NULL DEFAULT 0,
  is_historical INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

CREATE TABLE IF NOT EXISTS business_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Product',
  status TEXT NOT NULL DEFAULT 'Active',
  pricing_model TEXT NOT NULL DEFAULT '',
  platforms TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  next_milestone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cookbook_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Idea',
  category TEXT NOT NULL DEFAULT '',
  ingredients TEXT NOT NULL DEFAULT '',
  cooking_instructions TEXT NOT NULL DEFAULT '',
  photo_ready INTEGER NOT NULL DEFAULT 0,
  recipe_card_ready INTEGER NOT NULL DEFAULT 0,
  source_post TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS printing_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Idea',
  material TEXT NOT NULL DEFAULT '',
  printer TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  next_step TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reference_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Reference',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS health_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL DEFAULT '',
  entry TEXT NOT NULL,
  weight REAL DEFAULT NULL,
  change_lbs REAL DEFAULT NULL,
  milestone TEXT NOT NULL DEFAULT '',
  medication_notes TEXT NOT NULL DEFAULT '',
  mobility_win TEXT NOT NULL DEFAULT '',
  workout TEXT NOT NULL DEFAULT '',
  content_opportunity INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,
  source TEXT NOT NULL,
  records_found INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  conflicts INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'markdown',
  tags TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  record_type TEXT DEFAULT NULL,
  record_id INTEGER DEFAULT NULL,
  color TEXT DEFAULT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(is_archived);
CREATE INDEX IF NOT EXISTS idx_notes_record ON notes(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  file_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  record_type TEXT NOT NULL DEFAULT 'general',
  record_id INTEGER DEFAULT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_attachments_key ON attachments(file_key);

CREATE TABLE IF NOT EXISTS record_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  relationship_label TEXT NOT NULL DEFAULT 'relates_to',
  created_at TEXT NOT NULL,
  UNIQUE(source_type, source_id, target_type, target_id, relationship_label)
);
CREATE INDEX IF NOT EXISTS idx_rel_source ON record_relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON record_relationships(target_type, target_id);

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options_json TEXT NOT NULL DEFAULT '[]',
  default_value TEXT NOT NULL DEFAULT '',
  is_required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, field_name)
);
CREATE INDEX IF NOT EXISTS idx_cf_def_entity ON custom_field_definitions(entity_type);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  definition_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  value_text TEXT DEFAULT '',
  value_number REAL DEFAULT NULL,
  value_json TEXT DEFAULT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (definition_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  UNIQUE(definition_id, record_id)
);
CREATE INDEX IF NOT EXISTS idx_cf_val_record ON custom_field_values(entity_type, record_id);

CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin',
  allowed_modules TEXT NOT NULL DEFAULT 'all',
  can_manage_users INTEGER NOT NULL DEFAULT 0,
  can_delete_records INTEGER NOT NULL DEFAULT 1,
  can_export_backup INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_perm_email ON user_permissions(email);

