'use strict';
// Lapisan database: SQLite bawaan Node (node:sqlite), file persisten di folder data/.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments(
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  title TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin','staff','approver','viewer')),
  department_id INTEGER REFERENCES departments(id),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS doc_types(
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  flow TEXT NOT NULL DEFAULT '[]',
  signers TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS documents(
  id INTEGER PRIMARY KEY,
  doc_no TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES doc_types(id),
  description TEXT,
  origin_dept_id INTEGER NOT NULL REFERENCES departments(id),
  creator_name TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  doc_date TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('normal','penting','mendesak')),
  due_date TEXT NOT NULL,
  media TEXT NOT NULL CHECK(media IN ('fisik','digital','keduanya')),
  loc_building TEXT, loc_room TEXT, loc_cabinet TEXT, loc_shelf TEXT, loc_folder TEXT,
  digital_link TEXT,
  access_level TEXT NOT NULL CHECK(access_level IN ('internal','terbatas')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','in_review','revision','rejected','approved','completed','archived')),
  current_round INTEGER NOT NULL DEFAULT 1,
  holder_dept_id INTEGER REFERENCES departments(id),
  holder_user_id INTEGER REFERENCES users(id),
  holder_name TEXT,
  holder_since TEXT,
  in_transit INTEGER NOT NULL DEFAULT 0,
  version_no INTEGER NOT NULL DEFAULT 1,
  row_version INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT, completed_at TEXT, archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approval_stages(
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  round INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  dept_id INTEGER NOT NULL REFERENCES departments(id),
  approver_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK(status IN ('not_started','waiting','approved','rejected','revision')),
  carried INTEGER NOT NULL DEFAULT 0,
  entered_at TEXT, decided_at TEXT,
  decided_by INTEGER REFERENCES users(id), decided_by_name TEXT,
  note TEXT,
  sla_days INTEGER,
  due_at TEXT,
  UNIQUE(document_id, round, seq)
);
CREATE TABLE IF NOT EXISTS signatures(
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  version_no INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  signer_name TEXT NOT NULL,
  signer_user_id INTEGER REFERENCES users(id),
  role_label TEXT,
  status TEXT NOT NULL DEFAULT 'unsigned' CHECK(status IN ('unsigned','signed')),
  signed_at TEXT, method TEXT, evidence TEXT,
  evidence_attachment_id INTEGER,
  recorded_by INTEGER, recorded_by_name TEXT, recorded_at TEXT
);
CREATE TABLE IF NOT EXISTS dispositions(
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  from_dept_id INTEGER NOT NULL REFERENCES departments(id),
  from_user_id INTEGER, from_name TEXT NOT NULL,
  to_dept_id INTEGER NOT NULL REFERENCES departments(id),
  to_user_id INTEGER, to_name TEXT,
  sent_at TEXT NOT NULL,
  instruction TEXT NOT NULL,
  follow_up_due TEXT,
  note TEXT,
  handover_proof TEXT,
  proof_attachment_id INTEGER,
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK(status IN ('in_transit','received','cancelled')),
  received_at TEXT, received_by INTEGER, received_by_name TEXT, receive_note TEXT,
  cancelled_at TEXT, cancelled_by_name TEXT, cancel_note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments(
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  kind TEXT NOT NULL DEFAULT 'dokumen',
  filename TEXT NOT NULL,
  mime TEXT, size INTEGER,
  storage_name TEXT NOT NULL,
  version_no INTEGER,
  note TEXT,
  uploaded_by INTEGER, uploaded_by_name TEXT,
  uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS doc_versions(
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  version_no INTEGER NOT NULL,
  reason TEXT,
  snapshot TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(document_id, version_no)
);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  actor_id INTEGER, actor_name TEXT,
  dept_id INTEGER,
  title TEXT NOT NULL,
  note TEXT,
  data TEXT
);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  document_id INTEGER REFERENCES documents(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  dedupe_key TEXT,
  UNIQUE(user_id, dedupe_key)
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_stage_doc ON approval_stages(document_id, round);
CREATE INDEX IF NOT EXISTS ix_sig_doc ON signatures(document_id, version_no);
CREATE INDEX IF NOT EXISTS ix_disp_doc ON dispositions(document_id);
CREATE INDEX IF NOT EXISTS ix_evt_doc ON events(document_id, at);
CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications(user_id, read_at);
`;

function openDb(dataDir) {
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'disposisi.db'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
