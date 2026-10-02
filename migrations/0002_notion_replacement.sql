-- Migration 0002: Notion Replacement Command Center Expansion
-- Safe, additive migration: creates new tables and indexes without altering existing data

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

-- Seed default owner & admin permissions if not already present
INSERT OR IGNORE INTO user_permissions (email, name, role, allowed_modules, can_manage_users, can_delete_records, can_export_backup, created_at, updated_at)
VALUES 
  ('jwgreenway@gmail.com', 'Josh Greenway', 'owner', 'all', 1, 1, 1, datetime('now'), datetime('now')),
  ('ritagreenway304@gmail.com', 'Rita Greenway', 'admin', 'all', 0, 1, 1, datetime('now'), datetime('now'));
