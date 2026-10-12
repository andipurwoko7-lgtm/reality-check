'use strict';
// Logika bisnis: hak akses, validasi, alur status, disposisi, approval, tanda tangan, laporan.
// Semua mutasi berjalan dalam transaksi dan memakai optimistic locking (row_version)
// agar perubahan bersamaan tidak saling menimpa.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => new AppError(400, m);
const forbidden = (m) => new AppError(403, m || 'Anda tidak memiliki hak akses untuk tindakan ini.');
const notFound = (m) => new AppError(404, m || 'Data tidak ditemukan.');
const conflict = (m) => new AppError(409, m || 'Data telah diubah oleh pengguna lain. Muat ulang halaman lalu coba lagi.');

const DAY = 86400000;
const WIB = 7 * 3600000;
const CLOSED = new Set(['completed', 'archived', 'rejected']);

const STATUS_LABEL = {
  draft: 'Draf', in_review: 'Dalam Proses Approval', revision: 'Perlu Revisi', rejected: 'Ditolak',
  approved: 'Disetujui', completed: 'Selesai', archived: 'Diarsipkan',
};
const STAGE_LABEL = {
  not_started: 'Belum Dimulai', waiting: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak', revision: 'Perlu Revisi',
};
const SIGN_METHODS = {
  basah: 'Tanda tangan basah (fisik)',
  paraf: 'Paraf',
  scan: 'Tanda tangan dipindai (scan)',
  tte_eksternal: 'TTE dari sistem eksternal (dicatat manual)',
};
const PRIORITY_LABEL = { normal: 'Normal', penting: 'Penting', mendesak: 'Mendesak' };
const MEDIA_LABEL = { fisik: 'Fisik', digital: 'Digital', keduanya: 'Fisik & Digital' };
const ROLE_LABEL = { admin: 'Administrator', staff: 'Staf Administrasi', approver: 'Approver', viewer: 'Viewer' };
const DEFAULT_SETTINGS = { long_hold_days: '5', transit_alert_hours: '24', due_soon_days: '2' };
const MAX_UPLOAD = 10 * 1024 * 1024;

// ---------- utilitas waktu ----------
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const dueEnd = (date) => new Date(Date.parse(date + 'T23:59:59+07:00')).toISOString();
const addDays = (iso, d) => new Date(Date.parse(iso) + d * DAY).toISOString();
const wibDate = (iso) => new Date(Date.parse(iso) + WIB).toISOString().slice(0, 10);
const wibMonth = (iso) => wibDate(iso).slice(0, 7);
const days = (a, b) => Math.max(0, (Date.parse(b) - Date.parse(a)) / DAY);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function fmtDate(iso) {
  if (!iso) return '';
  const d = isDate(iso) ? iso : wibDate(iso);
  return `${d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
}
function fmtDateTime(iso) {
  if (!iso) return '';
  const t = new Date(Date.parse(iso) + WIB).toISOString();
  return `${fmtDate(iso)} ${t.slice(11, 16)} WIB`;
}
function parseTime(v, label) {
  // menerima ISO lengkap, atau "YYYY-MM-DDTHH:MM" dari input datetime-local (dianggap WIB)
  if (v == null || v === '') return null;
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) s += '+07:00';
  const t = Date.parse(s);
  if (isNaN(t)) throw bad(`${label} tidak valid.`);
  return new Date(t).toISOString();
}

// Input waktu dari formulir berpresisi menit; bila jatuh di menit yang sama dengan waktu acuan
// (mis. dokumen baru diterima), pakai waktu acuan agar urutan kronologis tetap benar.
// Waktu default formulir = menit berjalan; bila tidak diubah pengguna, pakai waktu server yang presisi
// supaya urutan timeline tidak tertukar dengan kejadian lain di menit yang sama.
function userTime(v, label, now) {
  const t = parseTime(v, label);
  if (!t) return now;
  return Math.abs(Date.parse(t) - Date.parse(now)) < 60000 ? now : t;
}
function notBefore(t, ref) {
  if (!ref || Date.parse(t) >= Date.parse(ref)) return t;
  return Date.parse(ref) - Date.parse(t) < 60000 ? ref : t;
}

// ---------- password ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [, s, h] = String(stored).split('$');
  if (!s || !h) return false;
  const calc = crypto.scryptSync(String(pw), Buffer.from(s, 'hex'), 32);
  return crypto.timingSafeEqual(calc, Buffer.from(h, 'hex'));
}

function createService(db, { dataDir }) {
  const uploadDir = path.join(dataDir, 'uploads');
  const cache = new Map();
  const nz = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const st = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  const all = (sql, ...p) => st(sql).all(...p.map(nz));
  const get = (sql, ...p) => st(sql).get(...p.map(nz));
  const run = (sql, ...p) => st(sql).run(...p.map(nz));
  let depth = 0;
  function tx(fn) {
    if (depth) return fn();
    db.exec('BEGIN IMMEDIATE');
    depth++;
    try { const r = fn(); db.exec('COMMIT'); return r; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    finally { depth--; }
  }

  // ---------- master data ----------
  const deptMap = () => new Map(all('SELECT * FROM departments').map((d) => [d.id, d]));
  const userMap = () => new Map(all('SELECT id,username,name,title,role,department_id,active,is_demo FROM users').map((u) => [u.id, u]));
  const typeMap = () => new Map(all('SELECT * FROM doc_types').map((t) => [t.id, { ...t, flow: JSON.parse(t.flow), signers: JSON.parse(t.signers) }]));
  function settings() {
    const s = { ...DEFAULT_SETTINGS };
    for (const r of all('SELECT key,value FROM settings')) s[r.key] = r.value;
    return { long_hold_days: +s.long_hold_days, transit_alert_hours: +s.transit_alert_hours, due_soon_days: +s.due_soon_days };
  }
  const deptName = (id, dm) => (dm || deptMap()).get(id)?.name || '-';
  function usersInDept(deptId, roles) {
    return all('SELECT id, role FROM users WHERE department_id=? AND active=1', deptId)
      .filter((u) => !roles || roles.includes(u.role)).map((u) => u.id);
  }

  // ---------- log & notifikasi ----------
  function logEvent(ctx, docId, type, title, note, data, deptId) {
    run('INSERT INTO events(document_id,type,at,actor_id,actor_name,dept_id,title,note,data) VALUES (?,?,?,?,?,?,?,?,?)',
      docId, type, ctx.now, ctx.user?.id, ctx.user?.name || 'Sistem', deptId, title, note || null, data ? JSON.stringify(data) : null);
  }
  function notify(ctx, userIds, docId, type, message, dedupe) {
    for (const uid of new Set(userIds)) {
      if (!uid || (!dedupe && ctx.user && uid === ctx.user.id)) continue;
      run('INSERT OR IGNORE INTO notifications(user_id,document_id,type,message,created_at,dedupe_key) VALUES (?,?,?,?,?,?)',
        uid, docId, type, message, ctx.now, dedupe || null);
    }
  }
  function stageApprovers(stage) {
    if (stage.approver_user_id) return [stage.approver_user_id];
    return usersInDept(stage.dept_id, ['approver']);
  }
  function ownerIds(doc) {
    return [doc.created_by, ...usersInDept(doc.origin_dept_id, ['staff'])];
  }

  // ---------- akses ----------
  function restrictedIds(user) {
    const dept = user.department_id ?? -1;
    return new Set(all(`SELECT id FROM documents WHERE access_level='terbatas' AND (created_by=? OR origin_dept_id=? OR holder_dept_id=?)
      UNION SELECT document_id FROM approval_stages WHERE approver_user_id=? OR dept_id=?
      UNION SELECT document_id FROM dispositions WHERE to_dept_id=? OR from_dept_id=? OR to_user_id=?
      UNION SELECT document_id FROM signatures WHERE signer_user_id=?`,
    user.id, dept, dept, user.id, dept, dept, dept, user.id, user.id).map((r) => r.id));
  }
  function canView(user, doc, rIds) {
    if (user.role === 'admin' || doc.access_level === 'internal') return true;
    return (rIds || restrictedIds(user)).has(doc.id);
  }
  function getDoc(id) {
    const d = get('SELECT * FROM documents WHERE id=?', Number(id));
    if (!d) throw notFound('Dokumen tidak ditemukan.');
    return d;
  }
  function getVisibleDoc(user, id) {
    const d = getDoc(id);
    if (!canView(user, d)) throw forbidden('Dokumen ini bersifat terbatas dan tidak dapat Anda akses.');
    return d;
  }
  const isManager = (u, d) => u.role === 'admin' || (u.role === 'staff' &&
    (d.created_by === u.id || d.origin_dept_id === u.department_id || d.holder_dept_id === u.department_id));

  function bump(ctx, doc, expected, fields = {}) {
    if (!ctx.system) {
      if (expected === undefined || expected === null || expected === '') throw bad('Versi data (row_version) wajib dikirim.');
      if (Number(expected) !== doc.row_version) throw conflict();
    }
    const keys = Object.keys(fields);
    const sets = keys.map((k) => `${k}=?`).concat(['row_version=row_version+1', 'updated_at=?']);
    const r = run(`UPDATE documents SET ${sets.join(',')} WHERE id=? AND row_version=?`,
      ...keys.map((k) => fields[k]), ctx.now, doc.id, doc.row_version);
    if (r.changes !== 1) throw conflict();
  }

  // ---------- validasi dokumen ----------
  const LOC_FIELDS = ['loc_building', 'loc_room', 'loc_cabinet', 'loc_shelf', 'loc_folder'];
  const str = (v, max = 500) => (v == null ? '' : String(v).trim().slice(0, max));

  function validateDoc(d, { dm, tm, hasFiles, excludeId }) {
    const errs = [];
    if (!d.doc_no) errs.push('Nomor dokumen wajib diisi.');
    else if (!/^[A-Za-z0-9][A-Za-z0-9./\-_ ]{2,59}$/.test(d.doc_no)) errs.push('Nomor dokumen 3–60 karakter: huruf, angka, titik, garis miring, atau tanda hubung.');
    if (!d.title) errs.push('Judul/perihal wajib diisi.');
    if (!tm.get(d.type_id)) errs.push('Jenis dokumen wajib dipilih.');
    if (!dm.get(d.origin_dept_id)) errs.push('Departemen asal wajib dipilih.');
    if (!d.creator_name) errs.push('Nama pembuat dokumen wajib diisi.');
    if (!isDate(d.doc_date)) errs.push('Tanggal dokumen tidak valid.');
    if (!isDate(d.due_date)) errs.push('Tenggat penyelesaian tidak valid.');
    else if (isDate(d.doc_date) && d.due_date < d.doc_date) errs.push('Tenggat tidak boleh sebelum tanggal dokumen.');
    if (!PRIORITY_LABEL[d.priority]) errs.push('Prioritas tidak valid.');
    if (!MEDIA_LABEL[d.media]) errs.push('Media dokumen tidak valid.');
    if (!['internal', 'terbatas'].includes(d.access_level)) errs.push('Tingkat akses tidak valid.');
    if (d.media !== 'digital' && (!d.loc_building || !d.loc_room)) errs.push('Dokumen fisik wajib mencantumkan minimal gedung dan ruang penyimpanan.');
    if (d.digital_link && !/^https?:\/\/\S+$/i.test(d.digital_link)) errs.push('Tautan dokumen digital harus diawali http:// atau https://');
    if (d.media !== 'fisik' && !d.digital_link && !hasFiles) errs.push('Dokumen digital wajib memiliki tautan atau file unggahan.');
    if (errs.length) throw bad(errs.join(' '));
    const dup = get('SELECT id FROM documents WHERE doc_no=? COLLATE NOCASE AND id<>?', d.doc_no, excludeId || 0);
    if (dup) throw conflict(`Nomor dokumen "${d.doc_no}" sudah digunakan. Gunakan nomor lain.`);
  }

  function normalizeStages(stages, originDept, dm, um) {
    if (!Array.isArray(stages) || !stages.length) throw bad('Jalur approval minimal memiliki satu tahap.');
    if (stages.length > 12) throw bad('Jalur approval maksimal 12 tahap.');
    return stages.map((s, i) => {
      const dept = Number(s.dept_id) === 0 ? originDept : Number(s.dept_id);
      const name = str(s.name, 80);
      if (!name) throw bad(`Nama tahap ke-${i + 1} wajib diisi.`);
      if (!dm.get(dept)) throw bad(`Departemen tahap "${name}" tidak valid.`);
      let approver = s.approver_user_id ? Number(s.approver_user_id) : null;
      if (approver) {
        const u = um.get(approver);
        if (!u || !u.active || !['approver', 'admin'].includes(u.role)) throw bad(`Approver tahap "${name}" harus pengguna aktif dengan peran Approver.`);
      } else if (!usersInDept(dept, ['approver']).length) {
        throw bad(`Tahap "${name}": departemen ${dm.get(dept).name} belum memiliki pengguna Approver. Pilih approver secara spesifik.`);
      }
      const sla = Math.max(1, Math.min(60, Number(s.sla_days) || 2));
      return { seq: i + 1, name, dept_id: dept, approver_user_id: approver, sla_days: sla };
    });
  }
  function normalizeSigners(signers, um) {
    if (!Array.isArray(signers)) return [];
    return signers.filter((s) => s && (s.signer_user_id || str(s.signer_name))).map((s, i) => {
      const uid = s.signer_user_id ? Number(s.signer_user_id) : null;
      const u = uid ? um.get(uid) : null;
      if (uid && !u) throw bad('Penanda tangan tidak valid.');
      return { seq: i + 1, signer_user_id: uid, signer_name: u ? u.name : str(s.signer_name, 100), role_label: str(s.role_label, 80) || (u?.title || '') };
    });
  }

  function saveFile(ctx, docId, f, kind, versionNo) {
    if (!f || !f.filename || !f.data) throw bad('File tidak valid.');
    const buf = Buffer.from(String(f.data).replace(/^data:[^,]*,/, ''), 'base64');
    if (!buf.length) throw bad('File kosong.');
    if (buf.length > MAX_UPLOAD) throw bad('Ukuran file maksimal 10 MB.');
    const filename = path.basename(String(f.filename)).slice(0, 150);
    const storage = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(path.join(uploadDir, storage), buf);
    const r = run('INSERT INTO attachments(document_id,kind,filename,mime,size,storage_name,version_no,note,uploaded_by,uploaded_by_name,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      docId, kind, filename, str(f.mime, 100) || 'application/octet-stream', buf.length, storage, versionNo, str(f.note, 300) || null, ctx.user?.id, ctx.user?.name, ctx.now);
    return Number(r.lastInsertRowid);
  }

  function snapshot(docId) {
    const d = get('SELECT * FROM documents WHERE id=?', docId);
    return JSON.stringify({
      doc: d,
      stages: all('SELECT seq,name,dept_id,approver_user_id,sla_days FROM approval_stages WHERE document_id=? AND round=? ORDER BY seq', docId, d.current_round),
      signers: all('SELECT seq,signer_name,signer_user_id,role_label FROM signatures WHERE document_id=? AND version_no=? ORDER BY seq', docId, d.version_no),
    });
  }

  function docInput(input, base = {}) {
    const d = { ...base };
    const fields = ['doc_no', 'title', 'description', 'creator_name', 'doc_date', 'due_date', 'priority', 'media', 'access_level', 'digital_link', ...LOC_FIELDS];
    for (const f of fields) if (input[f] !== undefined) d[f] = str(input[f], f === 'description' ? 4000 : 300);
    if (input.type_id !== undefined) d.type_id = Number(input.type_id);
    if (input.origin_dept_id !== undefined) d.origin_dept_id = Number(input.origin_dept_id);
    return d;
  }

  // ---------- operasi dokumen ----------
  function createDocument(ctx, input) {
    const u = ctx.user;
    if (!['admin', 'staff'].includes(u.role)) throw forbidden('Hanya Staf Administrasi atau Administrator yang dapat mencatat dokumen.');
    const dm = deptMap(), tm = typeMap(), um = userMap();
    const d = docInput(input);
    const files = Array.isArray(input.files) ? input.files : [];
    validateDoc(d, { dm, tm, hasFiles: files.length > 0 });
    const stages = normalizeStages(input.stages, d.origin_dept_id, dm, um);
    const signers = normalizeSigners(input.signers, um);
    return tx(() => {
      const holderDept = u.department_id && dm.get(u.department_id) ? u.department_id : d.origin_dept_id;
      let r;
      try {
        r = run(`INSERT INTO documents(doc_no,title,type_id,description,origin_dept_id,creator_name,created_by,doc_date,priority,due_date,media,
          loc_building,loc_room,loc_cabinet,loc_shelf,loc_folder,digital_link,access_level,status,holder_dept_id,holder_user_id,holder_name,holder_since,is_demo,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?,?,?,?,?)`,
        d.doc_no, d.title, d.type_id, d.description || null, d.origin_dept_id, d.creator_name, u.id, d.doc_date, d.priority, d.due_date, d.media,
        d.loc_building || null, d.loc_room || null, d.loc_cabinet || null, d.loc_shelf || null, d.loc_folder || null, d.digital_link || null, d.access_level,
        holderDept, u.id, u.name, ctx.now, ctx.demo ? 1 : 0, ctx.now, ctx.now);
      } catch (e) {
        if (/UNIQUE/.test(e.message)) throw conflict(`Nomor dokumen "${d.doc_no}" sudah digunakan. Gunakan nomor lain.`);
        throw e;
      }
      const id = Number(r.lastInsertRowid);
      for (const s of stages) {
        run('INSERT INTO approval_stages(document_id,round,seq,name,dept_id,approver_user_id,sla_days) VALUES (?,?,?,?,?,?,?)',
          id, 1, s.seq, s.name, s.dept_id, s.approver_user_id, s.sla_days);
      }
      for (const s of signers) {
        run('INSERT INTO signatures(document_id,version_no,seq,signer_name,signer_user_id,role_label) VALUES (?,?,?,?,?,?)',
          id, 1, s.seq, s.signer_name, s.signer_user_id, s.role_label);
      }
      for (const f of files) saveFile(ctx, id, f, 'dokumen', 1);
      run('INSERT INTO doc_versions(document_id,version_no,reason,snapshot,created_by_name,created_at) VALUES (?,?,?,?,?,?)',
        id, 1, 'Versi awal', snapshot(id), u.name, ctx.now);
      logEvent(ctx, id, 'created', 'Dokumen dibuat', `Dicatat oleh ${u.name} di ${deptName(holderDept, dm)}`, { holder_dept_id: holderDept }, holderDept);
      if (input.submit_now) submit({ ...ctx, system: true }, id, {});
      return { id };
    });
  }

  function updateDocument(ctx, id, input) {
    return tx(() => {
      const u = ctx.user;
      const doc = getVisibleDoc(u, id);
      if (!isManager(u, doc)) throw forbidden('Anda tidak berwenang mengubah dokumen ini.');
      if (doc.status === 'archived') throw bad('Dokumen yang sudah diarsipkan tidak dapat diubah.');
      const dm = deptMap(), tm = typeMap(), um = userMap();
      const limited = ['description', 'priority', 'due_date', 'media', 'digital_link', 'access_level', ...LOC_FIELDS];
      const allowed = doc.status === 'draft'
        ? ['doc_no', 'title', 'type_id', 'origin_dept_id', 'creator_name', 'doc_date', ...limited]
        : doc.status === 'revision' ? ['title', 'doc_date', 'creator_name', ...limited] : limited;
      const filtered = {};
      for (const k of allowed) if (input[k] !== undefined) filtered[k] = input[k];
      const next = docInput(filtered, doc);
      const hasFiles = !!get('SELECT 1 x FROM attachments WHERE document_id=? AND kind=\'dokumen\'', doc.id) || (input.files || []).length > 0;
      validateDoc(next, { dm, tm, hasFiles, excludeId: doc.id });
      const changes = {};
      for (const k of allowed) {
        if (next[k] !== undefined && String(next[k] ?? '') !== String(doc[k] ?? '')) changes[k] = { dari: doc[k], ke: next[k] };
      }
      let stageChange = false, signerChange = false;
      if (doc.status === 'draft' && input.stages) {
        const stages = normalizeStages(input.stages, next.origin_dept_id, dm, um);
        run('DELETE FROM approval_stages WHERE document_id=? AND round=?', doc.id, doc.current_round);
        for (const s of stages) run('INSERT INTO approval_stages(document_id,round,seq,name,dept_id,approver_user_id,sla_days) VALUES (?,?,?,?,?,?,?)',
          doc.id, doc.current_round, s.seq, s.name, s.dept_id, s.approver_user_id, s.sla_days);
        stageChange = true;
      }
      if (doc.status === 'draft' && input.signers) {
        const signers = normalizeSigners(input.signers, um);
        run('DELETE FROM signatures WHERE document_id=? AND version_no=? AND status=\'unsigned\'', doc.id, doc.version_no);
        if (get('SELECT 1 x FROM signatures WHERE document_id=? AND version_no=?', doc.id, doc.version_no)) throw bad('Penanda tangan tidak dapat diubah karena sudah ada yang menandatangani.');
        for (const s of signers) run('INSERT INTO signatures(document_id,version_no,seq,signer_name,signer_user_id,role_label) VALUES (?,?,?,?,?,?)',
          doc.id, doc.version_no, s.seq, s.signer_name, s.signer_user_id, s.role_label);
        signerChange = true;
      }
      const fields = {};
      for (const k of Object.keys(changes)) fields[k] = next[k] === '' ? null : next[k];
      bump(ctx, doc, input.row_version, fields);
      for (const f of input.files || []) saveFile(ctx, doc.id, f, 'dokumen', doc.version_no);
      const labels = Object.keys(changes).map((k) => FIELD_LABEL[k] || k);
      if (stageChange) labels.push('jalur approval');
      if (signerChange) labels.push('daftar penanda tangan');
      if ((input.files || []).length) labels.push('file dokumen');
      if (labels.length) logEvent(ctx, doc.id, 'updated', 'Data dokumen diubah', `Perubahan: ${labels.join(', ')}`, { changes }, u.department_id);
      return { id: doc.id };
    });
  }

  function submit(ctx, id, input) {
    return tx(() => {
      const doc = ctx.system ? getDoc(id) : getVisibleDoc(ctx.user, id);
      if (!ctx.system && !isManager(ctx.user, doc)) throw forbidden();
      if (doc.status !== 'draft') throw bad('Hanya dokumen berstatus Draf yang dapat diajukan.');
      const first = get('SELECT * FROM approval_stages WHERE document_id=? AND round=? ORDER BY seq LIMIT 1', doc.id, doc.current_round);
      if (!first) throw bad('Jalur approval belum diatur.');
      bump(ctx, doc, input.row_version, { status: 'in_review', submitted_at: ctx.now });
      enterStage(ctx, doc, first);
      logEvent(ctx, doc.id, 'submitted', 'Diajukan untuk approval', input.note, null, doc.holder_dept_id);
      return { id: doc.id };
    });
  }

  function enterStage(ctx, doc, stage) {
    const due = addDays(ctx.now, stage.sla_days || 2);
    run('UPDATE approval_stages SET status=\'waiting\', entered_at=?, due_at=? WHERE id=?', ctx.now, due, stage.id);
    const dm = deptMap();
    logEvent(ctx, doc.id, 'stage', `Masuk tahap approval: ${stage.name}`, `Menunggu keputusan ${deptName(stage.dept_id, dm)}`, { stage_id: stage.id }, stage.dept_id);
    notify(ctx, stageApprovers(stage), doc.id, 'approval', `Dokumen ${doc.doc_no} menunggu approval Anda pada tahap "${stage.name}".`);
    if (doc.media !== 'digital' && (doc.holder_dept_id !== stage.dept_id)) {
      notify(ctx, usersInDept(doc.holder_dept_id, ['staff', 'approver']), doc.id, 'action',
        `Dokumen fisik ${doc.doc_no} perlu dikirim ke ${deptName(stage.dept_id, dm)} untuk tahap "${stage.name}".`);
    }
  }

  function sendDisposition(ctx, id, input) {
    return tx(() => {
      const u = ctx.user;
      const doc = getVisibleDoc(u, id);
      if (doc.status === 'archived') throw bad('Dokumen sudah diarsipkan.');
      if (doc.in_transit) throw bad('Dokumen masih dalam pengiriman. Tunggu konfirmasi penerimaan atau batalkan pengiriman terlebih dahulu.');
      if (!(u.role === 'admin' || (['staff', 'approver'].includes(u.role) && u.department_id === doc.holder_dept_id))) {
        throw forbidden('Hanya departemen pemegang dokumen saat ini yang dapat mengirim disposisi.');
      }
      const dm = deptMap(), um = userMap();
      const toDept = Number(input.to_dept_id);
      if (!dm.get(toDept) || !dm.get(toDept).active) throw bad('Departemen tujuan wajib dipilih.');
      const toUser = input.to_user_id ? um.get(Number(input.to_user_id)) : null;
      if (input.to_user_id && (!toUser || toUser.department_id !== toDept || !toUser.active)) throw bad('Penanggung jawab tujuan harus pengguna aktif di departemen tujuan.');
      if (toDept === doc.holder_dept_id && !toUser) throw bad('Untuk pengiriman di dalam departemen yang sama, pilih penanggung jawab tujuan.');
      const instruction = str(input.instruction, 1000);
      if (!instruction) throw bad('Instruksi atau tujuan disposisi wajib diisi.');
      const sentAt = notBefore(userTime(input.sent_at, 'Waktu pengiriman', ctx.now), doc.holder_since);
      if (Date.parse(sentAt) > Date.parse(ctx.now) + 60000) throw bad('Waktu pengiriman tidak boleh di masa depan.');
      if (doc.holder_since && Date.parse(sentAt) < Date.parse(doc.holder_since)) throw bad('Waktu pengiriman tidak boleh sebelum dokumen diterima di bagian saat ini.');
      if (input.follow_up_due && !isDate(input.follow_up_due)) throw bad('Tenggat tindak lanjut tidak valid.');
      const r = run(`INSERT INTO dispositions(document_id,from_dept_id,from_user_id,from_name,to_dept_id,to_user_id,to_name,sent_at,instruction,follow_up_due,note,handover_proof,created_by,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      doc.id, doc.holder_dept_id, u.id, u.name, toDept, toUser?.id, toUser?.name, sentAt, instruction, input.follow_up_due || null,
      str(input.note, 1000) || null, str(input.handover_proof, 500) || null, u.id, ctx.now);
      const dispId = Number(r.lastInsertRowid);
      if (input.proof_file) {
        const att = saveFile(ctx, doc.id, input.proof_file, 'bukti serah terima', doc.version_no);
        run('UPDATE dispositions SET proof_attachment_id=? WHERE id=?', att, dispId);
      }
      bump(ctx, doc, input.row_version, { in_transit: 1 });
      const toName = deptName(toDept, dm);
      const evtCtx = { ...ctx, now: sentAt };
      logEvent(evtCtx, doc.id, 'sent', `Dikirim ke ${toName}${toUser ? ` (${toUser.name})` : ''}`,
        `Instruksi: ${instruction}${input.note ? ` · Catatan: ${str(input.note, 1000)}` : ''}`,
        { disposition_id: dispId, from_dept_id: doc.holder_dept_id, to_dept_id: toDept }, doc.holder_dept_id);
      const targets = toUser ? [toUser.id] : usersInDept(toDept, ['staff', 'approver', 'admin']);
      notify(ctx, targets, doc.id, 'incoming', `Dokumen ${doc.doc_no} dikirim ke ${toName} oleh ${u.name}. Mohon konfirmasi penerimaan.`);
      return { id: doc.id, disposition_id: dispId };
    });
  }

  function getDisp(id) {
    const d = get('SELECT * FROM dispositions WHERE id=?', Number(id));
    if (!d) throw notFound('Data disposisi tidak ditemukan.');
    return d;
  }

  function receiveDisposition(ctx, dispId, input) {
    return tx(() => {
      const u = ctx.user;
      const disp = getDisp(dispId);
      const doc = getVisibleDoc(u, disp.document_id);
      if (disp.status !== 'in_transit') throw bad('Disposisi ini sudah tidak menunggu penerimaan.');
      if (!(u.role === 'admin' || (u.role !== 'viewer' && u.department_id === disp.to_dept_id))) {
        throw forbidden('Hanya pengguna di departemen tujuan yang dapat mengonfirmasi penerimaan.');
      }
      const at = notBefore(userTime(input.received_at, 'Waktu penerimaan', ctx.now), disp.sent_at);
      if (Date.parse(at) < Date.parse(disp.sent_at)) throw bad('Waktu penerimaan tidak boleh sebelum waktu pengiriman.');
      if (Date.parse(at) > Date.parse(ctx.now) + 60000) throw bad('Waktu penerimaan tidak boleh di masa depan.');
      const note = str(input.note, 1000);
      run('UPDATE dispositions SET status=\'received\', received_at=?, received_by=?, received_by_name=?, receive_note=? WHERE id=? AND status=\'in_transit\'',
        at, u.id, u.name, note || null, disp.id);
      const fields = { in_transit: 0, holder_dept_id: disp.to_dept_id, holder_user_id: u.id, holder_name: u.name, holder_since: at };
      const locChanges = {};
      for (const k of LOC_FIELDS) {
        if (input[k] !== undefined && str(input[k]) && str(input[k]) !== (doc[k] || '')) { fields[k] = str(input[k]); locChanges[k] = { dari: doc[k], ke: fields[k] }; }
      }
      bump(ctx, doc, input.row_version, fields);
      const dm = deptMap();
      const locText = Object.keys(locChanges).length ? ` · Lokasi fisik diperbarui: ${LOC_FIELDS.map((k) => fields[k] ?? doc[k]).filter(Boolean).join(', ')}` : '';
      logEvent({ ...ctx, now: at }, doc.id, 'received', `Diterima ${deptName(disp.to_dept_id, dm)}`,
        `Diterima oleh ${u.name}${note ? ` · Catatan: ${note}` : ''}${locText}`, { disposition_id: disp.id, loc_changes: locChanges }, disp.to_dept_id);
      notify(ctx, [disp.from_user_id], doc.id, 'received', `Dokumen ${doc.doc_no} telah diterima ${deptName(disp.to_dept_id, dm)} (${u.name}).`);
      const waiting = get('SELECT * FROM approval_stages WHERE document_id=? AND round=? AND status=\'waiting\'', doc.id, doc.current_round);
      if (waiting && waiting.dept_id === disp.to_dept_id) {
        notify(ctx, stageApprovers(waiting), doc.id, 'approval', `Dokumen fisik ${doc.doc_no} sudah diterima di departemen Anda dan siap diputuskan (tahap "${waiting.name}").`);
      }
      return { id: doc.id };
    });
  }

  function cancelDisposition(ctx, dispId, input) {
    return tx(() => {
      const u = ctx.user;
      const disp = getDisp(dispId);
      const doc = getVisibleDoc(u, disp.document_id);
      if (disp.status !== 'in_transit') throw bad('Hanya pengiriman yang belum diterima yang dapat dibatalkan.');
      if (!(u.role === 'admin' || (u.role !== 'viewer' && u.department_id === disp.from_dept_id))) throw forbidden('Hanya departemen pengirim yang dapat membatalkan pengiriman.');
      const note = str(input.note, 500);
      if (!note) throw bad('Alasan pembatalan wajib diisi.');
      run('UPDATE dispositions SET status=\'cancelled\', cancelled_at=?, cancelled_by_name=?, cancel_note=? WHERE id=?', ctx.now, u.name, note, disp.id);
      bump(ctx, doc, input.row_version, { in_transit: 0 });
      const dm = deptMap();
      logEvent(ctx, doc.id, 'send_cancelled', `Pengiriman ke ${deptName(disp.to_dept_id, dm)} dibatalkan`, `Alasan: ${note}. Dokumen tetap di ${deptName(disp.from_dept_id, dm)}.`, { disposition_id: disp.id }, disp.from_dept_id);
      notify(ctx, disp.to_user_id ? [disp.to_user_id] : usersInDept(disp.to_dept_id, ['staff', 'approver']), doc.id, 'info', `Pengiriman dokumen ${doc.doc_no} ke departemen Anda dibatalkan pengirim.`);
      return { id: doc.id };
    });
  }

  function decisionBlocker(u, doc, stage) {
    if (doc.status !== 'in_review') return 'Dokumen tidak sedang dalam proses approval.';
    if (stage.status !== 'waiting' || stage.round !== doc.current_round) return 'Tahap ini tidak sedang menunggu keputusan.';
    const allowed = u.role === 'admin' || (u.role === 'approver' && (stage.approver_user_id ? stage.approver_user_id === u.id : u.department_id === stage.dept_id));
    if (!allowed) return 'Anda bukan approver untuk tahap ini.';
    if (doc.media !== 'digital' && (doc.in_transit || doc.holder_dept_id !== stage.dept_id)) {
      return `Dokumen fisik belum diterima di ${deptName(stage.dept_id)}. Kirim dan konfirmasi penerimaan terlebih dahulu.`;
    }
    return null;
  }

  function decide(ctx, stageId, input) {
    return tx(() => {
      const u = ctx.user;
      const stage = get('SELECT * FROM approval_stages WHERE id=?', Number(stageId));
      if (!stage) throw notFound('Tahap approval tidak ditemukan.');
      const doc = getVisibleDoc(u, stage.document_id);
      const block = decisionBlocker(u, doc, stage);
      if (block) throw (block.startsWith('Anda bukan') ? forbidden(block) : bad(block));
      const decision = input.decision;
      const map = { approve: 'approved', reject: 'rejected', revision: 'revision' };
      if (!map[decision]) throw bad('Keputusan tidak valid.');
      const note = str(input.note, 1000);
      if (decision !== 'approve' && !note) throw bad('Catatan wajib diisi untuk penolakan atau permintaan revisi.');
      run('UPDATE approval_stages SET status=?, decided_at=?, decided_by=?, decided_by_name=?, note=? WHERE id=? AND status=\'waiting\'',
        map[decision], ctx.now, u.id, u.name, note || null, stage.id);
      const dm = deptMap();
      const where = `${stage.name} (${deptName(stage.dept_id, dm)})`;
      if (decision === 'approve') {
        const nextStage = get('SELECT * FROM approval_stages WHERE document_id=? AND round=? AND seq>? ORDER BY seq LIMIT 1', doc.id, doc.current_round, stage.seq);
        bump(ctx, doc, input.row_version, nextStage ? {} : { status: 'approved' });
        logEvent(ctx, doc.id, 'approved', `Disetujui — ${where}`, note, { stage_id: stage.id }, stage.dept_id);
        if (nextStage) enterStage(ctx, getDoc(doc.id), nextStage);
        else {
          logEvent(ctx, doc.id, 'approval_complete', 'Seluruh tahap approval selesai', null, null, stage.dept_id);
          notify(ctx, ownerIds(doc), doc.id, 'approved', `Dokumen ${doc.doc_no} telah disetujui di seluruh tahap.`);
          const pending = all('SELECT signer_user_id FROM signatures WHERE document_id=? AND version_no=? AND status=\'unsigned\'', doc.id, doc.version_no);
          if (pending.length) notify(ctx, [...pending.map((p) => p.signer_user_id), ...usersInDept(doc.holder_dept_id, ['staff'])], doc.id, 'signature', `Dokumen ${doc.doc_no} menunggu tanda tangan.`);
        }
      } else if (decision === 'reject') {
        bump(ctx, doc, input.row_version, { status: 'rejected' });
        logEvent(ctx, doc.id, 'rejected', `Ditolak — ${where}`, note, { stage_id: stage.id }, stage.dept_id);
        notify(ctx, ownerIds(doc), doc.id, 'rejected', `Dokumen ${doc.doc_no} DITOLAK pada tahap "${stage.name}": ${note}`);
      } else {
        bump(ctx, doc, input.row_version, { status: 'revision' });
        logEvent(ctx, doc.id, 'revision', `Diminta revisi — ${where}`, note, { stage_id: stage.id }, stage.dept_id);
        notify(ctx, ownerIds(doc), doc.id, 'revision', `Dokumen ${doc.doc_no} perlu direvisi (tahap "${stage.name}"): ${note}`);
      }
      return { id: doc.id };
    });
  }

  function resubmit(ctx, id, input) {
    return tx(() => {
      const u = ctx.user;
      const doc = getVisibleDoc(u, id);
      if (!isManager(u, doc)) throw forbidden();
      if (doc.status !== 'revision') throw bad('Hanya dokumen berstatus Perlu Revisi yang dapat diajukan ulang.');
      const note = str(input.note, 1000);
      if (!note) throw bad('Ringkasan perbaikan wajib diisi.');
      const stages = all('SELECT * FROM approval_stages WHERE document_id=? AND round=? ORDER BY seq', doc.id, doc.current_round);
      const rev = stages.find((s) => s.status === 'revision');
      const round = doc.current_round + 1, ver = doc.version_no + 1;
      for (const f of input.files || []) saveFile(ctx, doc.id, f, 'dokumen', ver);
      let waitingStage = null;
      for (const s of stages) {
        const carried = rev && s.seq < rev.seq && s.status === 'approved';
        const r = run(`INSERT INTO approval_stages(document_id,round,seq,name,dept_id,approver_user_id,status,carried,entered_at,decided_at,decided_by,decided_by_name,note,sla_days,due_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        doc.id, round, s.seq, s.name, s.dept_id, s.approver_user_id, carried ? 'approved' : 'not_started', carried ? 1 : 0,
        carried ? s.entered_at : null, carried ? s.decided_at : null, carried ? s.decided_by : null, carried ? s.decided_by_name : null,
        carried ? `Disetujui pada putaran ${doc.current_round}${s.note ? `: ${s.note}` : ''}` : null, s.sla_days, carried ? s.due_at : null);
        if (!carried && !waitingStage) waitingStage = { ...s, id: Number(r.lastInsertRowid), round };
      }
      const oldSigs = all('SELECT * FROM signatures WHERE document_id=? AND version_no=? ORDER BY seq', doc.id, doc.version_no);
      for (const s of oldSigs) run('INSERT INTO signatures(document_id,version_no,seq,signer_name,signer_user_id,role_label) VALUES (?,?,?,?,?,?)',
        doc.id, ver, s.seq, s.signer_name, s.signer_user_id, s.role_label);
      bump(ctx, doc, input.row_version, { status: 'in_review', current_round: round, version_no: ver });
      run('INSERT INTO doc_versions(document_id,version_no,reason,snapshot,created_by_name,created_at) VALUES (?,?,?,?,?,?)',
        doc.id, ver, note, snapshot(doc.id), u.name, ctx.now);
      const resetSig = oldSigs.filter((s) => s.status === 'signed').length;
      logEvent(ctx, doc.id, 'resubmitted', `Diajukan ulang — versi ${ver}`,
        `${note}${resetSig ? ` · ${resetSig} tanda tangan versi sebelumnya perlu diulang pada versi baru.` : ''}`, { version_no: ver, round }, doc.holder_dept_id);
      if (waitingStage) enterStage(ctx, getDoc(doc.id), waitingStage);
      return { id: doc.id };
    });
  }

  function signBlocker(u, doc, sig) {
    if (sig.status !== 'unsigned') return 'Sudah ditandatangani.';
    if (sig.version_no !== doc.version_no) return 'Bukan versi dokumen terbaru.';
    if (!['in_review', 'approved'].includes(doc.status)) return 'Tanda tangan hanya dapat dicatat saat dokumen dalam proses approval atau sudah disetujui.';
    if (!(u.role === 'admin' || u.role === 'staff' || sig.signer_user_id === u.id)) return 'Anda tidak berwenang mencatat tanda tangan ini.';
    return null;
  }

  function sign(ctx, sigId, input) {
    return tx(() => {
      const u = ctx.user;
      const sig = get('SELECT * FROM signatures WHERE id=?', Number(sigId));
      if (!sig) throw notFound('Data tanda tangan tidak ditemukan.');
      const doc = getVisibleDoc(u, sig.document_id);
      const block = signBlocker(u, doc, sig);
      if (block) throw (block.includes('berwenang') ? forbidden(block) : bad(block));
      if (!SIGN_METHODS[input.method]) throw bad('Metode tanda tangan wajib dipilih.');
      const at = userTime(input.signed_at, 'Waktu tanda tangan', ctx.now);
      if (Date.parse(at) > Date.parse(ctx.now) + 60000) throw bad('Waktu tanda tangan tidak boleh di masa depan.');
      const evidence = str(input.evidence, 500);
      if (!evidence && !input.evidence_file) throw bad('Bukti tanda tangan wajib diisi (keterangan atau file).');
      let att = null;
      if (input.evidence_file) att = saveFile(ctx, doc.id, input.evidence_file, 'bukti tanda tangan', doc.version_no);
      run('UPDATE signatures SET status=\'signed\', signed_at=?, method=?, evidence=?, evidence_attachment_id=?, recorded_by=?, recorded_by_name=?, recorded_at=? WHERE id=? AND status=\'unsigned\'',
        at, input.method, evidence || null, att, u.id, u.name, ctx.now, sig.id);
      bump(ctx, doc, input.row_version, {});
      logEvent({ ...ctx, now: at }, doc.id, 'signed', `Ditandatangani oleh ${sig.signer_name}`,
        `${sig.role_label ? sig.role_label + ' · ' : ''}${SIGN_METHODS[input.method]} · dicatat oleh ${u.name}${evidence ? ` · Bukti: ${evidence}` : ''}`, { signature_id: sig.id }, u.department_id);
      const left = get('SELECT COUNT(*) n FROM signatures WHERE document_id=? AND version_no=? AND status=\'unsigned\'', doc.id, doc.version_no).n;
      if (!left) {
        logEvent(ctx, doc.id, 'sign_complete', 'Seluruh tanda tangan lengkap', null, null, u.department_id);
        notify(ctx, ownerIds(doc), doc.id, 'signed', `Seluruh tanda tangan dokumen ${doc.doc_no} sudah lengkap.`);
      }
      return { id: doc.id };
    });
  }

  function completeBlocker(u, doc) {
    if (doc.status !== 'approved') return 'Dokumen harus berstatus Disetujui.';
    if (doc.in_transit) return 'Dokumen masih dalam pengiriman.';
    const left = get('SELECT COUNT(*) n FROM signatures WHERE document_id=? AND version_no=? AND status=\'unsigned\'', doc.id, doc.version_no).n;
    if (left) return `Masih ada ${left} pihak yang belum menandatangani.`;
    if (!isManager(u, doc)) return 'Anda tidak berwenang.';
    return null;
  }
  function complete(ctx, id, input) {
    return tx(() => {
      const doc = getVisibleDoc(ctx.user, id);
      const block = completeBlocker(ctx.user, doc);
      if (block) throw bad(block);
      bump(ctx, doc, input.row_version, { status: 'completed', completed_at: ctx.now });
      logEvent(ctx, doc.id, 'completed', 'Proses dokumen dinyatakan selesai', str(input.note, 1000), null, doc.holder_dept_id);
      notify(ctx, ownerIds(doc), doc.id, 'completed', `Dokumen ${doc.doc_no} dinyatakan selesai.`);
      return { id: doc.id };
    });
  }

  function archiveBlocker(u, doc) {
    if (!['completed', 'rejected'].includes(doc.status)) return 'Hanya dokumen Selesai atau Ditolak yang dapat diarsipkan.';
    if (doc.in_transit) return 'Dokumen masih dalam pengiriman.';
    if (!(u.role === 'admin' || (u.role === 'staff' && (isManager(u, doc))))) return 'Anda tidak berwenang mengarsipkan dokumen ini.';
    return null;
  }
  function archive(ctx, id, input) {
    return tx(() => {
      const doc = getVisibleDoc(ctx.user, id);
      const block = archiveBlocker(ctx.user, doc);
      if (block) throw bad(block);
      const fields = { status: 'archived', archived_at: ctx.now };
      for (const k of LOC_FIELDS) if (str(input[k])) fields[k] = str(input[k]);
      if (doc.media !== 'digital' && !(fields.loc_building || doc.loc_building) && !(fields.loc_room || doc.loc_room)) throw bad('Lokasi arsip fisik wajib diisi.');
      bump(ctx, doc, input.row_version, fields);
      const loc = LOC_FIELDS.map((k) => fields[k] ?? doc[k]).filter(Boolean).join(', ');
      logEvent(ctx, doc.id, 'archived', 'Diarsipkan', `${str(input.note, 1000) ? str(input.note, 1000) + ' · ' : ''}${doc.media !== 'digital' ? `Lokasi arsip: ${loc}` : 'Arsip digital'}`, null, doc.holder_dept_id);
      return { id: doc.id };
    });
  }

  function addNote(ctx, id, input) {
    return tx(() => {
      const doc = getVisibleDoc(ctx.user, id);
      if (ctx.user.role === 'viewer') throw forbidden('Viewer tidak dapat menambahkan catatan.');
      const note = str(input.note, 2000);
      if (!note) throw bad('Catatan tidak boleh kosong.');
      logEvent(ctx, doc.id, 'note', 'Catatan ditambahkan', note, null, ctx.user.department_id);
      return { id: doc.id };
    });
  }

  function upload(ctx, id, input) {
    return tx(() => {
      const doc = getVisibleDoc(ctx.user, id);
      if (ctx.user.role === 'viewer') throw forbidden('Viewer tidak dapat mengunggah lampiran.');
      if (doc.status === 'archived') throw bad('Dokumen yang sudah diarsipkan tidak dapat ditambah lampiran.');
      const kind = ['dokumen', 'lampiran', 'bukti serah terima', 'bukti tanda tangan'].includes(input.kind) ? input.kind : 'lampiran';
      const attId = saveFile(ctx, doc.id, input, kind, doc.version_no);
      logEvent(ctx, doc.id, 'attachment', `Lampiran diunggah: ${path.basename(String(input.filename))}`, str(input.note, 300), { attachment_id: attId }, ctx.user.department_id);
      return { id: doc.id, attachment_id: attId };
    });
  }

  function getAttachment(user, attId) {
    const a = get('SELECT * FROM attachments WHERE id=?', Number(attId));
    if (!a) throw notFound('Lampiran tidak ditemukan.');
    getVisibleDoc(user, a.document_id); // validasi hak akses dokumen (termasuk dokumen terbatas)
    return { ...a, file: path.join(uploadDir, a.storage_name) };
  }

  // ---------- ringkasan & posisi ----------
  function segmentsOf(doc, disps, now, dm) {
    const segs = [];
    let cur = { dept: disps.length ? disps[0].from_dept_id : doc.holder_dept_id, start: doc.created_at };
    for (const d of disps) {
      if (cur) segs.push({ kind: 'dept', dept_id: cur.dept, start: cur.start, end: d.sent_at });
      if (d.status === 'received') {
        segs.push({ kind: 'transit', from: d.from_dept_id, dept_id: d.to_dept_id, start: d.sent_at, end: d.received_at });
        cur = { dept: d.to_dept_id, start: d.received_at };
      } else if (d.status === 'in_transit') {
        segs.push({ kind: 'transit', from: d.from_dept_id, dept_id: d.to_dept_id, start: d.sent_at, end: null });
        cur = null;
      } else {
        segs.push({ kind: 'transit', from: d.from_dept_id, dept_id: d.to_dept_id, start: d.sent_at, end: d.cancelled_at, cancelled: true });
        cur = { dept: d.from_dept_id, start: d.cancelled_at };
      }
    }
    if (cur) segs.push({ kind: 'dept', dept_id: cur.dept, start: cur.start, end: null });
    const stop = doc.archived_at || now;
    return segs.map((s) => {
      const end = s.end || stop;
      return { ...s, ongoing: !s.end && !doc.archived_at, dept_name: deptName(s.dept_id, dm), from_name: s.from ? deptName(s.from, dm) : undefined, days: days(s.start, end) };
    });
  }

  function summaries(user, now) {
    const dm = deptMap(), tm = typeMap(), cfg = settings();
    let docs = all('SELECT * FROM documents ORDER BY created_at DESC');
    if (user.role !== 'admin') {
      const r = restrictedIds(user);
      docs = docs.filter((d) => canView(user, d, r));
    }
    const stagesBy = new Map(), sigsBy = new Map(), dispBy = new Map();
    for (const s of all('SELECT * FROM approval_stages ORDER BY document_id, round, seq')) (stagesBy.get(s.document_id) || stagesBy.set(s.document_id, []).get(s.document_id)).push(s);
    for (const s of all('SELECT document_id,version_no,status FROM signatures')) (sigsBy.get(s.document_id) || sigsBy.set(s.document_id, []).get(s.document_id)).push(s);
    for (const d of all('SELECT * FROM dispositions ORDER BY sent_at, id')) (dispBy.get(d.document_id) || dispBy.set(d.document_id, []).get(d.document_id)).push(d);
    const nowMs = Date.parse(now);
    return docs.map((d) => {
      const stages = (stagesBy.get(d.id) || []).filter((s) => s.round === d.current_round);
      const sigs = (sigsBy.get(d.id) || []).filter((s) => s.version_no === d.version_no);
      const disps = dispBy.get(d.id) || [];
      const transit = d.in_transit ? disps.filter((x) => x.status === 'in_transit').pop() : null;
      const active = stages.find((s) => ['waiting', 'revision', 'rejected'].includes(s.status));
      const approvedCount = stages.filter((s) => s.status === 'approved').length;
      let stageLabel;
      if (d.status === 'draft') stageLabel = 'Belum diajukan';
      else if (active) stageLabel = `${active.name} (${STAGE_LABEL[active.status]})`;
      else if (stages.length && approvedCount === stages.length) stageLabel = 'Semua tahap disetujui';
      else stageLabel = '-';
      const signed = sigs.filter((s) => s.status === 'signed').length;
      const sigStatus = !sigs.length ? 'none' : signed === sigs.length ? 'complete' : signed ? 'partial' : 'unsigned';
      const closed = CLOSED.has(d.status);
      const posSince = transit ? transit.sent_at : d.holder_since;
      const endRef = d.archived_at || d.completed_at || now;
      const holdDays = days(posSince, closed ? endRef : now);
      const overdue = !closed && nowMs > Date.parse(dueEnd(d.due_date));
      const dueSoon = !closed && !overdue && Date.parse(dueEnd(d.due_date)) - nowMs <= cfg.due_soon_days * DAY;
      const stageOverdue = !!(active && active.status === 'waiting' && active.due_at && nowMs > Date.parse(active.due_at));
      const transitHours = transit ? (nowMs - Date.parse(transit.sent_at)) / 3600000 : 0;
      const flags = [];
      if (overdue) flags.push({ code: 'overdue', label: `Melewati tenggat ${Math.ceil(days(dueEnd(d.due_date), now))} hari`, level: 'danger' });
      if (transit && transitHours >= cfg.transit_alert_hours) flags.push({ code: 'transit_late', label: `Belum dikonfirmasi diterima ${Math.floor(transitHours / 24) ? Math.floor(transitHours / 24) + ' hari' : Math.floor(transitHours) + ' jam'}`, level: 'warning' });
      else if (transit) flags.push({ code: 'transit', label: 'Menunggu konfirmasi penerimaan', level: 'warning' });
      if (!transit && !closed && d.status !== 'draft' && holdDays >= cfg.long_hold_days) flags.push({ code: 'long_hold', label: `Tertahan ${Math.floor(holdDays)} hari di ${deptName(d.holder_dept_id, dm)}`, level: 'warning' });
      if (stageOverdue) flags.push({ code: 'stage_overdue', label: `Tahap "${active.name}" melewati SLA`, level: 'danger' });
      if (d.status === 'revision') flags.push({ code: 'revision', label: 'Perlu revisi dari pembuat', level: 'warning' });
      if (d.status === 'approved' && sigStatus !== 'complete' && sigs.length) flags.push({ code: 'need_sign', label: 'Menunggu tanda tangan', level: 'warning' });
      if (dueSoon) flags.push({ code: 'due_soon', label: 'Tenggat segera', level: 'warning' });
      return {
        id: d.id, doc_no: d.doc_no, title: d.title, type_id: d.type_id, type_name: tm.get(d.type_id)?.name || '-',
        origin_dept_id: d.origin_dept_id, origin_dept_name: deptName(d.origin_dept_id, dm), creator_name: d.creator_name, created_by: d.created_by,
        doc_date: d.doc_date, created_at: d.created_at, priority: d.priority, due_date: d.due_date, media: d.media,
        status: d.status, status_label: STATUS_LABEL[d.status], access_level: d.access_level, is_demo: !!d.is_demo,
        stage_label: stageLabel, stage_seq: active ? active.seq : (approvedCount || 0), stage_total: stages.length, stage_status: active?.status || null,
        stage_dept_name: active ? deptName(active.dept_id, dm) : null,
        sig_total: sigs.length, sig_signed: signed, sig_status: sigStatus,
        holder_dept_id: d.holder_dept_id, holder_dept_name: deptName(d.holder_dept_id, dm), holder_name: d.holder_name, holder_since: d.holder_since,
        in_transit: !!d.in_transit,
        transit: transit ? { id: transit.id, from_dept_name: deptName(transit.from_dept_id, dm), to_dept_id: transit.to_dept_id, to_dept_name: deptName(transit.to_dept_id, dm), from_name: transit.from_name, to_name: transit.to_name, sent_at: transit.sent_at } : null,
        location: LOC_FIELDS.map((k) => d[k]).filter(Boolean).join(', '), digital_link: d.digital_link,
        position_since: posSince, hold_days: holdDays, overdue, closed,
        completed_at: d.completed_at, archived_at: d.archived_at, submitted_at: d.submitted_at,
        total_days: days(d.created_at, d.completed_at || d.archived_at || now),
        flags, _disps: disps, _row: d,
      };
    });
  }
  const strip = (s) => { const { _disps, _row, ...rest } = s; return rest; };

  function inRange(iso, from, to) {
    if (!iso) return false;
    const d = wibDate(iso);
    return (!from || d >= from) && (!to || d <= to);
  }
  function defaultPeriod(now, q) {
    const to = isDate(q.to) ? q.to : wibDate(now);
    const from = isDate(q.from) ? q.from : to.slice(0, 8) + '01';
    return { from, to };
  }

  function applyFilters(rows, q, now) {
    const s = str(q.q).toLowerCase();
    const per = defaultPeriod(now, q);
    const ids = q.ids ? new Set(String(q.ids).split(',').map(Number)) : null;
    return rows.filter((r) => {
      if (ids && !ids.has(r.id)) return false;
      if (s && ![r.doc_no, r.title, r.holder_name, r.creator_name, r.transit?.to_name, r.transit?.from_name].some((v) => v && v.toLowerCase().includes(s))) return false;
      // Dokumen dalam pengiriman tetap dihitung di departemen pengirim sampai penerimaan dikonfirmasi.
      if (q.holder_dept && r.holder_dept_id !== +q.holder_dept) return false;
      if (q.origin_dept && r.origin_dept_id !== +q.origin_dept) return false;
      if (q.status) {
        if (q.status === 'transit') { if (!r.in_transit) return false; }
        else if (q.status === 'active') { if (r.closed) return false; }
        else if (r.status !== q.status) return false;
      }
      if (q.type && r.type_id !== +q.type) return false;
      if (q.priority && r.priority !== q.priority) return false;
      if (q.sig && r.sig_status !== q.sig) return false;
      if (q.date_from && r.doc_date < q.date_from) return false;
      if (q.date_to && r.doc_date > q.date_to) return false;
      if (q.late === 'yes' && !r.overdue) return false;
      if (q.late === 'no' && r.overdue) return false;
      if (q.hide_archived === '1' && r.status === 'archived') return false;
      switch (q.card) {
        case 'active': return !r.closed;
        case 'in_review': return r.status === 'in_review';
        // menunggu tanda tangan: approval selesai tetapi TTD belum lengkap, atau penandatanganan sudah berjalan sebagian
        case 'waiting_sign': return !r.closed && r.sig_total > 0 && r.sig_status !== 'complete' && (r.status === 'approved' || (r.status === 'in_review' && r.sig_status === 'partial'));
        case 'transit': return r.in_transit;
        case 'overdue': return r.overdue;
        case 'completed': return inRange(r.completed_at, per.from, per.to);
        case 'followup': return r.flags.some((f) => f.code !== 'due_soon' && f.code !== 'transit') || r.flags.some((f) => f.code === 'transit_late');
        case 'mine': return r.holder_dept_id === +q.my_dept || r.transit?.to_dept_id === +q.my_dept;
        default: return true;
      }
    });
  }

  const SORTS = {
    doc_no: (r) => r.doc_no.toLowerCase(), title: (r) => r.title.toLowerCase(), type_name: (r) => r.type_name, origin_dept_name: (r) => r.origin_dept_name,
    doc_date: (r) => r.doc_date, created_at: (r) => r.created_at, status: (r) => r.status_label, stage_label: (r) => r.stage_label, sig_status: (r) => r.sig_signed / (r.sig_total || 1),
    holder_dept_name: (r) => (r.in_transit ? 'zz' + r.transit.to_dept_name : r.holder_dept_name), holder_name: (r) => r.holder_name || '', position_since: (r) => r.position_since || '',
    hold_days: (r) => r.hold_days, due_date: (r) => r.due_date, priority: (r) => ({ mendesak: 0, penting: 1, normal: 2 })[r.priority],
  };

  function listDocuments(user, q, now) {
    const rows = applyFilters(summaries(user, now), q, now);
    const key = SORTS[q.sort] ? q.sort : 'created_at';
    const dir = q.dir === 'asc' ? 1 : (q.dir === 'desc' ? -1 : (q.sort ? 1 : -1));
    const fn = SORTS[key];
    rows.sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || b.id - a.id; });
    const size = Math.min(200, Math.max(5, Number(q.size) || 10));
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const page = Math.min(pages, Math.max(1, Number(q.page) || 1));
    return { total: rows.length, page, pages, size, rows: rows.slice((page - 1) * size, page * size).map(strip), _all: rows };
  }

  function exportRows(user, q, now) {
    const { _all } = listDocuments(user, { ...q, size: 200 }, now);
    const header = ['Nomor Dokumen', 'Judul/Perihal', 'Jenis', 'Departemen Asal', 'Tanggal Dokumen', 'Tanggal Dicatat', 'Prioritas', 'Status Proses', 'Tahap Approval',
      'Status Tanda Tangan', 'Posisi/Departemen Pemegang', 'Penanggung Jawab', 'Lokasi Fisik', 'Tautan Digital', 'Diterima di Bagian Saat Ini', 'Lama di Bagian (hari)',
      'Tenggat', 'Terlambat', 'Tindak Lanjut', 'Data Demo'];
    const sigText = (r) => (r.sig_total ? `${r.sig_signed}/${r.sig_total} ${r.sig_status === 'complete' ? 'Lengkap' : 'ditandatangani'}` : 'Tidak diperlukan');
    const rows = _all.map((r) => [r.doc_no, r.title, r.type_name, r.origin_dept_name, fmtDate(r.doc_date), fmtDateTime(r.created_at), PRIORITY_LABEL[r.priority], r.status_label,
      r.stage_total ? `${r.stage_label}` : '-', sigText(r),
      r.in_transit ? `Dalam Pengiriman: ${r.transit.from_dept_name} → ${r.transit.to_dept_name}` : r.holder_dept_name,
      r.in_transit ? `Pengirim: ${r.transit.from_name}${r.transit.to_name ? ' · Tujuan: ' + r.transit.to_name : ''}` : (r.holder_name || ''),
      r.location, r.digital_link || '', r.in_transit ? `Dikirim ${fmtDateTime(r.transit.sent_at)}` : fmtDateTime(r.holder_since),
      Math.round(r.hold_days * 10) / 10, fmtDate(r.due_date), r.overdue ? 'Ya' : 'Tidak', r.flags.map((f) => f.label).join('; '), r.is_demo ? 'Demo' : '']);
    return { header, rows };
  }

  // ---------- detail ----------
  function detail(user, id, now) {
    const doc = getVisibleDoc(user, id);
    const dm = deptMap(), um = userMap(), tm = typeMap();
    const summary = strip(summaries(user, now).find((s) => s.id === doc.id));
    const stagesAll = all('SELECT * FROM approval_stages WHERE document_id=? ORDER BY round, seq', doc.id).map((s) => ({
      ...s, dept_name: deptName(s.dept_id, dm), approver_name: s.approver_user_id ? um.get(s.approver_user_id)?.name : null,
      status_label: STAGE_LABEL[s.status], overdue: s.status === 'waiting' && s.due_at && Date.parse(now) > Date.parse(s.due_at),
      days_in_stage: s.entered_at ? days(s.entered_at, s.decided_at || now) : null,
      candidate_names: s.approver_user_id ? [] : usersInDept(s.dept_id, ['approver']).map((i) => um.get(i)?.name),
    }));
    const stages = stagesAll.filter((s) => s.round === doc.current_round);
    const sigs = all('SELECT * FROM signatures WHERE document_id=? ORDER BY version_no, seq', doc.id).map((s) => ({ ...s, method_label: SIGN_METHODS[s.method] || null }));
    const disps = all('SELECT * FROM dispositions WHERE document_id=? ORDER BY sent_at, id', doc.id).map((d) => ({
      ...d, from_dept_name: deptName(d.from_dept_id, dm), to_dept_name: deptName(d.to_dept_id, dm),
      can_receive: d.status === 'in_transit' && (user.role === 'admin' || (user.role !== 'viewer' && user.department_id === d.to_dept_id)),
      can_cancel: d.status === 'in_transit' && (user.role === 'admin' || (user.role !== 'viewer' && user.department_id === d.from_dept_id)),
    }));
    const atts = all('SELECT id,kind,filename,mime,size,version_no,note,uploaded_by_name,uploaded_at FROM attachments WHERE document_id=? ORDER BY uploaded_at', doc.id);
    const versions = all('SELECT id,version_no,reason,created_by_name,created_at FROM doc_versions WHERE document_id=? ORDER BY version_no', doc.id);
    const events = all('SELECT * FROM events WHERE document_id=? ORDER BY at, id', doc.id).map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null, dept_name: e.dept_id ? deptName(e.dept_id, dm) : null }));
    const segs = segmentsOf(doc, all('SELECT * FROM dispositions WHERE document_id=? ORDER BY sent_at, id', doc.id), now, dm);
    const perDept = new Map();
    for (const s of segs) {
      const key = s.kind === 'transit' ? 'Dalam pengiriman' : s.dept_name;
      perDept.set(key, (perDept.get(key) || 0) + s.days);
    }
    const waiting = stages.find((s) => s.status === 'waiting');
    const decideBlock = waiting ? decisionBlocker(user, doc, waiting) : null;
    const canSend = doc.status !== 'archived' && !doc.in_transit && (user.role === 'admin' || (['staff', 'approver'].includes(user.role) && user.department_id === doc.holder_dept_id));
    const perms = {
      edit: doc.status !== 'archived' && isManager(user, doc),
      edit_full: doc.status === 'draft' && isManager(user, doc),
      submit: doc.status === 'draft' && isManager(user, doc),
      send: canSend,
      decide: waiting && !decideBlock ? waiting.id : null,
      decide_block: waiting ? decideBlock : null,
      resubmit: doc.status === 'revision' && isManager(user, doc),
      sign: sigs.filter((s) => !signBlocker(user, doc, s)).map((s) => s.id),
      complete: !completeBlocker(user, doc), complete_block: doc.status === 'approved' ? completeBlocker(user, doc) : null,
      archive: !archiveBlocker(user, doc),
      note: user.role !== 'viewer', upload: user.role !== 'viewer' && doc.status !== 'archived',
    };
    // Petunjuk langkah berikutnya agar pengguna langsung tahu tindak lanjutnya
    let next = null;
    if (doc.status === 'draft') next = 'Lengkapi data lalu ajukan dokumen untuk approval.';
    else if (doc.in_transit) { const t = disps.find((d) => d.status === 'in_transit'); next = `Menunggu ${t.to_dept_name} mengonfirmasi penerimaan dokumen.`; }
    else if (doc.status === 'in_review' && waiting) {
      next = doc.media !== 'digital' && doc.holder_dept_id !== waiting.dept_id
        ? `Kirim dokumen fisik ke ${waiting.dept_name} untuk tahap "${waiting.name}".`
        : `Menunggu keputusan ${waiting.approver_user_id ? um.get(waiting.approver_user_id)?.name : 'approver ' + waiting.dept_name} pada tahap "${waiting.name}".`;
    } else if (doc.status === 'revision') next = 'Pembuat dokumen perlu memperbaiki dokumen lalu mengajukan ulang.';
    else if (doc.status === 'approved') next = summary.sig_status === 'complete' || !summary.sig_total ? 'Tandai dokumen selesai, lalu arsipkan.' : 'Catat tanda tangan pihak yang belum menandatangani.';
    else if (doc.status === 'completed' || doc.status === 'rejected') next = 'Arsipkan dokumen beserta lokasi penyimpanan akhirnya.';
    const type = tm.get(doc.type_id);
    return {
      doc: { ...doc, type_name: type?.name, origin_dept_name: deptName(doc.origin_dept_id, dm), holder_dept_name: deptName(doc.holder_dept_id, dm),
        status_label: STATUS_LABEL[doc.status], priority_label: PRIORITY_LABEL[doc.priority], media_label: MEDIA_LABEL[doc.media] },
      summary, stages, stage_history: stagesAll.filter((s) => s.round !== doc.current_round), signatures: sigs.filter((s) => s.version_no === doc.version_no),
      signature_history: sigs.filter((s) => s.version_no !== doc.version_no), dispositions: disps, attachments: atts, versions, events,
      segments: segs, dept_durations: [...perDept].map(([dept, d]) => ({ dept, days: d })), perms, next,
    };
  }

  // ---------- dashboard & laporan ----------
  function avgByDept(rows, from, to, now) {
    const dm = deptMap();
    const agg = new Map();
    for (const r of rows) {
      for (const s of segmentsOf(r._row, r._disps, now, dm)) {
        if (s.kind !== 'dept') continue;
        const end = s.end || now;
        if (from && wibDate(end) < from) continue;
        if (to && wibDate(s.start) > to) continue;
        const a = agg.get(s.dept_id) || { dept_id: s.dept_id, dept_name: s.dept_name, total: 0, n: 0, ids: new Set() };
        a.total += s.days; a.n++; a.ids.add(r.id);
        agg.set(s.dept_id, a);
      }
    }
    return [...agg.values()].map((a) => ({ dept_id: a.dept_id, dept_name: a.dept_name, avg_days: a.total / a.n, visits: a.n, ids: [...a.ids] }))
      .sort((a, b) => b.avg_days - a.avg_days);
  }

  function dashboard(user, q, now) {
    const per = defaultPeriod(now, q);
    const rows = summaries(user, now);
    const pick = (card) => applyFilters(rows, { card, ...per }, now).map((r) => r.id);
    const cards = {
      active: pick('active'), in_review: pick('in_review'), waiting_sign: pick('waiting_sign'),
      transit: pick('transit'), overdue: pick('overdue'), completed: pick('completed'),
    };
    const byStatus = Object.keys(STATUS_LABEL).map((k) => ({ key: k, label: STATUS_LABEL[k], ids: rows.filter((r) => r.status === k).map((r) => r.id) }));
    const holderMap = new Map();
    for (const r of rows.filter((x) => x.status !== 'archived')) {
      const key = r.in_transit ? 'transit' : r.holder_dept_id;
      const label = r.in_transit ? 'Dalam Pengiriman' : r.holder_dept_name;
      const e = holderMap.get(key) || { key, label, ids: [] };
      e.ids.push(r.id); holderMap.set(key, e);
    }
    const byHolder = [...holderMap.values()].sort((a, b) => b.ids.length - a.ids.length);
    // tren 12 bulan
    const months = [];
    let [y, m] = per.to.slice(0, 7).split('-').map(Number);
    for (let i = 0; i < 12; i++) { months.unshift(`${y}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; y--; } }
    const trend = months.map((mo) => ({
      month: mo, label: `${MONTHS[+mo.slice(5) - 1]} ${mo.slice(2, 4)}`,
      in_ids: rows.filter((r) => wibMonth(r.created_at) === mo).map((r) => r.id),
      done_ids: rows.filter((r) => r.completed_at && wibMonth(r.completed_at) === mo).map((r) => r.id),
    }));
    const rank = { overdue: 0, stage_overdue: 1, transit_late: 2, long_hold: 3, revision: 4, need_sign: 5 };
    const followup = rows.filter((r) => r.flags.some((f) => f.code in rank)).map((r) => ({ ...strip(r), _rank: Math.min(...r.flags.filter((f) => f.code in rank).map((f) => rank[f.code])) }))
      .sort((a, b) => a._rank - b._rank || b.hold_days - a.hold_days).slice(0, 15);
    return { period: per, cards, by_status: byStatus, by_holder: byHolder, avg_by_dept: avgByDept(rows, per.from, per.to, now), trend, followup,
      followup_total: rows.filter((r) => r.flags.some((f) => f.code in rank)).length };
  }

  function report(user, q, now) {
    const per = defaultPeriod(now, q);
    if (per.from > per.to) throw bad('Tanggal awal periode tidak boleh setelah tanggal akhir.');
    const rows = summaries(user, now);
    const dm = deptMap(), tm = typeMap();
    const created = rows.filter((r) => inRange(r.created_at, per.from, per.to));
    const completed = rows.filter((r) => inRange(r.completed_at, per.from, per.to));
    const lateDone = completed.filter((r) => Date.parse(r.completed_at) > Date.parse(dueEnd(r.due_date)));
    const overdueNow = rows.filter((r) => r.overdue);
    const avg = (arr) => (arr.length ? arr.reduce((s, r) => s + r.total_days, 0) / arr.length : 0);
    const holding = avgByDept(rows, per.from, per.to, now);
    // waktu keputusan approval per departemen
    const stageRows = all('SELECT * FROM approval_stages WHERE decided_at IS NOT NULL AND carried=0');
    const visible = new Set(rows.map((r) => r.id));
    const stAgg = new Map();
    for (const s of stageRows) {
      if (!visible.has(s.document_id) || !inRange(s.decided_at, per.from, per.to) || !s.entered_at) continue;
      const a = stAgg.get(s.dept_id) || { total: 0, n: 0, ids: new Set(), late: 0 };
      a.total += days(s.entered_at, s.decided_at); a.n++; a.ids.add(s.document_id);
      if (s.due_at && Date.parse(s.decided_at) > Date.parse(s.due_at)) a.late++;
      stAgg.set(s.dept_id, a);
    }
    const deptRows = [...dm.values()].map((d) => {
      const h = holding.find((x) => x.dept_id === d.id);
      const s = stAgg.get(d.id);
      const createdIds = created.filter((r) => r.origin_dept_id === d.id).map((r) => r.id);
      const holdingNow = rows.filter((r) => !r.closed && !r.in_transit && r.holder_dept_id === d.id).map((r) => r.id);
      const overdueHere = overdueNow.filter((r) => !r.in_transit && r.holder_dept_id === d.id).map((r) => r.id);
      return {
        dept_id: d.id, dept_name: d.name, created_ids: createdIds, holding_ids: holdingNow, overdue_ids: overdueHere,
        avg_hold_days: h ? h.avg_days : null, hold_ids: h ? h.ids : [],
        avg_decision_days: s ? s.total / s.n : null, decisions: s ? s.n : 0, decision_late: s ? s.late : 0, decision_ids: s ? [...s.ids] : [],
      };
    }).filter((r) => r.created_ids.length || r.holding_ids.length || r.hold_ids.length || r.decisions);
    const typeRows = [...tm.values()].map((t) => {
      const c = created.filter((r) => r.type_id === t.id), d = completed.filter((r) => r.type_id === t.id);
      return { type_id: t.id, type_name: t.name, created_ids: c.map((r) => r.id), completed_ids: d.map((r) => r.id), avg_days: d.length ? avg(d) : null };
    }).filter((r) => r.created_ids.length || r.completed_ids.length);
    return {
      period: per,
      totals: {
        created: created.map((r) => r.id), completed: completed.map((r) => r.id), late_completed: lateDone.map((r) => r.id),
        overdue_now: overdueNow.map((r) => r.id), active_now: rows.filter((r) => !r.closed).map((r) => r.id),
        avg_completion_days: avg(completed), on_time_rate: completed.length ? (completed.length - lateDone.length) / completed.length : null,
      },
      by_dept: deptRows, by_type: typeRows,
    };
  }

  // ---------- notifikasi ----------
  let lastScan = 0;
  function scanDeadlines(now, force) {
    if (!force && Date.now() - lastScan < 60000) return;
    lastScan = Date.now();
    const ctx = { now, user: null };
    const cfg = settings();
    const dm = deptMap();
    tx(() => {
      for (const d of all("SELECT * FROM documents WHERE status NOT IN ('completed','archived','rejected')")) {
        const end = Date.parse(dueEnd(d.due_date)), n = Date.parse(now);
        const who = [d.created_by, ...usersInDept(d.holder_dept_id, ['staff', 'approver'])];
        if (n > end) notify(ctx, who, d.id, 'overdue', `Dokumen ${d.doc_no} telah melewati tenggat (${fmtDate(d.due_date)}).`, `overdue:${d.id}:${d.due_date}`);
        else if (end - n <= cfg.due_soon_days * DAY) notify(ctx, who, d.id, 'due_soon', `Tenggat dokumen ${d.doc_no} jatuh pada ${fmtDate(d.due_date)}.`, `due_soon:${d.id}:${d.due_date}`);
      }
      for (const s of all("SELECT s.*, d.doc_no FROM approval_stages s JOIN documents d ON d.id=s.document_id WHERE s.status='waiting' AND d.status='in_review' AND s.round=d.current_round")) {
        if (s.due_at && Date.parse(now) > Date.parse(s.due_at)) notify(ctx, stageApprovers(s), s.document_id, 'overdue', `Tahap "${s.name}" dokumen ${s.doc_no} melewati SLA ${s.sla_days} hari.`, `stage_overdue:${s.id}`);
      }
      for (const t of all("SELECT p.*, d.doc_no FROM dispositions p JOIN documents d ON d.id=p.document_id WHERE p.status='in_transit'")) {
        if ((Date.parse(now) - Date.parse(t.sent_at)) / 3600000 >= cfg.transit_alert_hours) {
          const targets = t.to_user_id ? [t.to_user_id] : usersInDept(t.to_dept_id, ['staff', 'approver']);
          notify(ctx, targets, t.document_id, 'transit_late', `Dokumen ${t.doc_no} dari ${deptName(t.from_dept_id, dm)} belum dikonfirmasi penerimaannya.`, `transit_late:${t.id}`);
          notify(ctx, [t.from_user_id], t.document_id, 'transit_late', `Pengiriman dokumen ${t.doc_no} ke ${deptName(t.to_dept_id, dm)} belum dikonfirmasi penerimanya.`, `transit_late_sender:${t.id}`);
        }
      }
    });
  }
  function notifications(user, now) {
    scanDeadlines(now);
    const rows = all('SELECT n.*, d.doc_no FROM notifications n LEFT JOIN documents d ON d.id=n.document_id WHERE n.user_id=? ORDER BY n.created_at DESC, n.id DESC LIMIT 100', user.id);
    const unread = get('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL', user.id).c;
    return { unread, rows };
  }
  function markRead(user, ids, now) {
    if (ids === 'all') run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', now, user.id);
    else for (const id of ids || []) run('UPDATE notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL', now, Number(id), user.id);
    return { ok: true };
  }

  // ---------- autentikasi ----------
  function login(username, password, now) {
    const u = get('SELECT * FROM users WHERE username=? COLLATE NOCASE', str(username, 60));
    if (!u || !u.active || !verifyPassword(password || '', u.password_hash)) throw new AppError(401, 'Nama pengguna atau kata sandi salah.');
    const token = crypto.randomBytes(32).toString('hex');
    run('INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES (?,?,?,?)', token, u.id, now, addDays(now, 7));
    run('DELETE FROM sessions WHERE expires_at < ?', now);
    logEvent({ now, user: u }, null, 'login', `Login: ${u.username}`, null, null, u.department_id);
    return { token, user: publicUser(u) };
  }
  function sessionUser(token, now) {
    if (!token) return null;
    const u = get('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1', token, now);
    return u ? publicUser(u) : null;
  }
  const logout = (token) => run('DELETE FROM sessions WHERE token=?', token);
  function publicUser(u) {
    const dm = deptMap();
    return { id: u.id, username: u.username, name: u.name, title: u.title, role: u.role, role_label: ROLE_LABEL[u.role], department_id: u.department_id, department_name: u.department_id ? deptName(u.department_id, dm) : null, is_demo: !!u.is_demo };
  }

  function meta(user) {
    return {
      departments: all('SELECT * FROM departments ORDER BY name'),
      types: [...typeMap().values()].sort((a, b) => a.name.localeCompare(b.name)),
      users: all('SELECT id,name,title,role,department_id,active FROM users ORDER BY name'),
      settings: settings(), status_label: STATUS_LABEL, stage_label: STAGE_LABEL, sign_methods: SIGN_METHODS,
      priority_label: PRIORITY_LABEL, media_label: MEDIA_LABEL, role_label: ROLE_LABEL, me: user,
    };
  }

  function nextDocNo(deptId, typeId, now) {
    const dm = deptMap(), tm = typeMap();
    const dc = dm.get(Number(deptId))?.code || 'DOK', tc = tm.get(Number(typeId))?.code || 'UM';
    const ym = wibDate(now).slice(0, 7).replace('-', '/');
    const prefix = `${tc}/${dc}/${ym}/`;
    let n = get('SELECT COUNT(*) c FROM documents WHERE doc_no LIKE ?', prefix + '%').c + 1;
    while (get('SELECT 1 x FROM documents WHERE doc_no=? COLLATE NOCASE', prefix + String(n).padStart(4, '0'))) n++;
    return prefix + String(n).padStart(4, '0');
  }

  // ---------- administrasi ----------
  const requireAdmin = (u) => { if (u.role !== 'admin') throw forbidden('Hanya Administrator yang dapat mengakses menu ini.'); };
  function adminUsers(user) {
    requireAdmin(user);
    return all('SELECT id,username,name,title,role,department_id,active,is_demo,created_at FROM users ORDER BY active DESC, name');
  }
  function saveUser(ctx, input) {
    requireAdmin(ctx.user);
    return tx(() => {
      const id = input.id ? Number(input.id) : null;
      const username = str(input.username, 40), name = str(input.name, 100), title = str(input.title, 100);
      if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw bad('Nama pengguna 3–40 karakter (huruf, angka, titik, garis bawah).');
      if (!name) throw bad('Nama lengkap wajib diisi.');
      if (!ROLE_LABEL[input.role]) throw bad('Peran tidak valid.');
      const dept = input.department_id ? Number(input.department_id) : null;
      if (input.role !== 'admin' && !deptMap().get(dept)) throw bad('Departemen wajib dipilih.');
      if (get('SELECT id FROM users WHERE username=? COLLATE NOCASE AND id<>?', username, id || 0)) throw conflict('Nama pengguna sudah digunakan.');
      if (id) {
        const prev = get('SELECT * FROM users WHERE id=?', id);
        if (!prev) throw notFound();
        if (prev.id === ctx.user.id && (input.role !== 'admin' || !input.active)) throw bad('Anda tidak dapat menonaktifkan atau menurunkan peran akun Anda sendiri.');
        run('UPDATE users SET username=?, name=?, title=?, role=?, department_id=?, active=? WHERE id=?', username, name, title || null, input.role, dept, input.active ? 1 : 0, id);
        if (input.password) {
          if (String(input.password).length < 6) throw bad('Kata sandi minimal 6 karakter.');
          run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(String(input.password)), id);
          run('DELETE FROM sessions WHERE user_id=?', id);
        }
        if (!input.active) run('DELETE FROM sessions WHERE user_id=?', id);
        logEvent(ctx, null, 'admin', `Pengguna diperbarui: ${username}`, null, null, null);
        return { id };
      }
      if (!input.password || String(input.password).length < 6) throw bad('Kata sandi minimal 6 karakter.');
      const r = run('INSERT INTO users(username,name,title,role,department_id,password_hash,active,is_demo,created_at) VALUES (?,?,?,?,?,?,1,?,?)',
        username, name, title || null, input.role, dept, hashPassword(String(input.password)), ctx.demo ? 1 : 0, ctx.now);
      logEvent(ctx, null, 'admin', `Pengguna dibuat: ${username}`, null, null, null);
      return { id: Number(r.lastInsertRowid) };
    });
  }
  function saveDept(ctx, input) {
    requireAdmin(ctx.user);
    return tx(() => {
      const code = str(input.code, 10).toUpperCase(), name = str(input.name, 100);
      if (!/^[A-Z0-9]{2,10}$/.test(code)) throw bad('Kode departemen 2–10 huruf/angka.');
      if (!name) throw bad('Nama departemen wajib diisi.');
      const id = input.id ? Number(input.id) : null;
      if (get('SELECT id FROM departments WHERE code=? COLLATE NOCASE AND id<>?', code, id || 0)) throw conflict('Kode departemen sudah digunakan.');
      if (id) {
        if (!input.active && get("SELECT 1 x FROM documents WHERE holder_dept_id=? AND status NOT IN ('archived')", id)) throw bad('Departemen masih memegang dokumen aktif sehingga tidak dapat dinonaktifkan.');
        run('UPDATE departments SET code=?, name=?, active=? WHERE id=?', code, name, input.active ? 1 : 0, id);
        logEvent(ctx, null, 'admin', `Departemen diperbarui: ${code}`, null, null, null);
        return { id };
      }
      const r = run('INSERT INTO departments(code,name,active) VALUES (?,?,1)', code, name);
      logEvent(ctx, null, 'admin', `Departemen dibuat: ${code}`, null, null, null);
      return { id: Number(r.lastInsertRowid) };
    });
  }
  function saveType(ctx, input) {
    requireAdmin(ctx.user);
    return tx(() => {
      const code = str(input.code, 10).toUpperCase(), name = str(input.name, 100);
      if (!/^[A-Z0-9]{2,10}$/.test(code)) throw bad('Kode jenis dokumen 2–10 huruf/angka.');
      if (!name) throw bad('Nama jenis dokumen wajib diisi.');
      const dm = deptMap(), um = userMap();
      const flow = (input.flow || []).map((s, i) => {
        const n = str(s.name, 80);
        if (!n) throw bad(`Nama tahap ke-${i + 1} wajib diisi.`);
        const dept = Number(s.dept_id);
        if (dept !== 0 && !dm.get(dept)) throw bad(`Departemen tahap "${n}" tidak valid.`);
        if (s.approver_user_id && !['approver', 'admin'].includes(um.get(Number(s.approver_user_id))?.role)) throw bad(`Approver tahap "${n}" tidak valid.`);
        return { name: n, dept_id: dept, approver_user_id: s.approver_user_id ? Number(s.approver_user_id) : null, sla_days: Math.max(1, Math.min(60, Number(s.sla_days) || 2)) };
      });
      if (!flow.length) throw bad('Jalur approval minimal satu tahap.');
      const signers = (input.signers || []).filter((s) => s.signer_user_id || str(s.signer_name)).map((s) => ({
        role_label: str(s.role_label, 80), signer_user_id: s.signer_user_id ? Number(s.signer_user_id) : null, signer_name: str(s.signer_name, 100) }));
      const id = input.id ? Number(input.id) : null;
      if (get('SELECT id FROM doc_types WHERE code=? COLLATE NOCASE AND id<>?', code, id || 0)) throw conflict('Kode jenis dokumen sudah digunakan.');
      if (id) {
        run('UPDATE doc_types SET code=?, name=?, flow=?, signers=?, active=? WHERE id=?', code, name, JSON.stringify(flow), JSON.stringify(signers), input.active ? 1 : 0, id);
        logEvent(ctx, null, 'admin', `Jenis dokumen & alur approval diperbarui: ${code}`, null, { flow }, null);
        return { id };
      }
      const r = run('INSERT INTO doc_types(code,name,flow,signers,active) VALUES (?,?,?,?,1)', code, name, JSON.stringify(flow), JSON.stringify(signers));
      logEvent(ctx, null, 'admin', `Jenis dokumen dibuat: ${code}`, null, { flow }, null);
      return { id: Number(r.lastInsertRowid) };
    });
  }
  function saveSettings(ctx, input) {
    requireAdmin(ctx.user);
    const keys = { long_hold_days: [1, 90], transit_alert_hours: [1, 720], due_soon_days: [0, 30] };
    tx(() => {
      for (const [k, [lo, hi]] of Object.entries(keys)) {
        if (input[k] === undefined) continue;
        const v = Number(input[k]);
        if (!Number.isFinite(v) || v < lo || v > hi) throw bad(`Nilai ${k} harus antara ${lo} dan ${hi}.`);
        run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(v));
      }
      logEvent(ctx, null, 'admin', 'Pengaturan ambang notifikasi diperbarui', null, input, null);
    });
    return settings();
  }
  function auditLog(user) {
    requireAdmin(user);
    return all("SELECT e.*, d.doc_no FROM events e LEFT JOIN documents d ON d.id=e.document_id ORDER BY e.at DESC, e.id DESC LIMIT 300");
  }
  function deleteDemo(ctx) {
    requireAdmin(ctx.user);
    return tx(() => {
      const ids = all('SELECT id FROM documents WHERE is_demo=1').map((r) => r.id);
      for (const id of ids) {
        for (const a of all('SELECT storage_name FROM attachments WHERE document_id=?', id)) { try { fs.unlinkSync(path.join(uploadDir, a.storage_name)); } catch { /* sudah tidak ada */ } }
        for (const t of ['notifications', 'events', 'attachments', 'doc_versions', 'signatures', 'approval_stages', 'dispositions']) run(`DELETE FROM ${t} WHERE document_id=?`, id);
        run('DELETE FROM documents WHERE id=?', id);
      }
      logEvent(ctx, null, 'admin', `Data demo dihapus (${ids.length} dokumen)`, 'Akun pengguna demo tetap ada dan dapat dinonaktifkan dari menu Pengguna.', null, null);
      return { deleted: ids.length };
    });
  }

  return {
    tx, all, get, run, hashPassword, settings, login, logout, sessionUser, meta, nextDocNo,
    createDocument, updateDocument, submit, sendDisposition, receiveDisposition, cancelDisposition, decide, resubmit, sign, complete, archive,
    addNote, upload, getAttachment, listDocuments, exportRows, detail, dashboard, report, notifications, markRead, scanDeadlines,
    adminUsers, saveUser, saveDept, saveType, saveSettings, auditLog, deleteDemo,
  };
}

const FIELD_LABEL = {
  doc_no: 'nomor dokumen', title: 'judul', type_id: 'jenis', origin_dept_id: 'departemen asal', creator_name: 'pembuat', doc_date: 'tanggal dokumen',
  description: 'deskripsi', priority: 'prioritas', due_date: 'tenggat', media: 'media', digital_link: 'tautan digital', access_level: 'tingkat akses',
  loc_building: 'gedung', loc_room: 'ruang', loc_cabinet: 'lemari', loc_shelf: 'rak', loc_folder: 'map',
};

module.exports = { createService, AppError, hashPassword, fmtDate, fmtDateTime, wibDate, addDays };
