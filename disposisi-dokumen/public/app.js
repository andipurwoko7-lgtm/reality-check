'use strict';
/* Dashboard Monitoring & Disposisi Dokumen — SPA tanpa framework.
   Seluruh data diambil dari API server (database SQLite); browser tidak menyimpan data utama. */

// ============ utilitas ============
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const WIB = 7 * 3600000;
const wibIso = (ms) => new Date(ms + WIB).toISOString();
const isDateOnly = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
function fmtDate(v) {
  if (!v) return '-';
  const d = isDateOnly(v) ? v : wibIso(Date.parse(v)).slice(0, 10);
  return `${d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
}
const fmtTime = (v) => (v ? wibIso(Date.parse(v)).slice(11, 16) : '');
const fmtDT = (v) => (v ? `${fmtDate(v)} ${fmtTime(v)} WIB` : '-');
const todayWIB = () => wibIso(Date.now()).slice(0, 10);
const nowInput = () => wibIso(Date.now()).slice(0, 16);
const addDaysStr = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
function durText(days) {
  if (days == null || isNaN(days)) return '-';
  const mins = Math.round(days * 1440);
  if (mins < 60) return `${Math.max(mins, 0)} menit`;
  if (mins < 1440) return `${Math.round(mins / 60)} jam`;
  const d = Math.floor(mins / 1440), h = Math.round((mins - d * 1440) / 60);
  return h && d < 10 ? `${d} hari ${h} jam` : `${d} hari`;
}
const num = (n, dec = 1) => (n == null ? '-' : Number(n).toLocaleString('id-ID', { maximumFractionDigits: dec, minimumFractionDigits: 0 }));
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== false));
const ls = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* tidak tersedia */ } },
};
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function fileToPayload(file) {
  return new Promise((res, rej) => {
    if (file.size > 10 * 1024 * 1024) return rej(new Error(`File "${file.name}" melebihi 10 MB.`));
    const r = new FileReader();
    r.onload = () => res({ filename: file.name, mime: file.type || 'application/octet-stream', data: String(r.result).split(',')[1] || '' });
    r.onerror = () => rej(new Error('Gagal membaca file.'));
    r.readAsDataURL(file);
  });
}

// ============ ikon ============
const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  files: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  truck: '<path d="M1 4h14v12H1zM15 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  xc: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  pen: '<path d="M3 21c3-1 5-3 7-6l7-7a2.1 2.1 0 0 0-3-3l-7 7c-3 2-5 4-6 7"/><path d="M14 21h7"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  note: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// ============ badge status (warna + ikon + teks) ============
const STATUS_UI = {
  draft: ['s-mute', 'edit', 'Draf'], in_review: ['s-info', 'clock', 'Dalam Proses Approval'], revision: ['s-wait', 'undo', 'Perlu Revisi'],
  rejected: ['s-bad', 'xc', 'Ditolak'], approved: ['s-ok', 'check', 'Disetujui'], completed: ['s-ok', 'checkc', 'Selesai'], archived: ['s-ok', 'archive', 'Diarsipkan'],
};
const STAGE_UI = {
  not_started: ['s-mute', 'clock', 'Belum Dimulai'], waiting: ['s-wait', 'clock', 'Menunggu'], approved: ['s-ok', 'check', 'Disetujui'],
  rejected: ['s-bad', 'xc', 'Ditolak'], revision: ['s-wait', 'undo', 'Perlu Revisi'],
};
const badge = (cls, icon, text, title) => `<span class="badge ${cls}"${title ? ` title="${esc(title)}"` : ''}>${ic(icon)}${esc(text)}</span>`;
const statusBadge = (s) => badge(...(STATUS_UI[s] || ['s-mute', 'info', s]));
const stageBadge = (s) => badge(...(STAGE_UI[s] || ['s-mute', 'info', s]));
function sigBadge(r) {
  if (!r.sig_total) return badge('s-mute', 'pen', 'Tidak perlu TTD');
  if (r.sig_status === 'complete') return badge('s-ok', 'check', `Lengkap ${r.sig_signed}/${r.sig_total}`);
  if (r.sig_status === 'partial') return badge('s-wait', 'pen', `Sebagian ${r.sig_signed}/${r.sig_total}`);
  return badge('s-wait', 'pen', `Belum TTD 0/${r.sig_total}`);
}
const PRIO_UI = { mendesak: ['s-bad', 'flag', 'Mendesak'], penting: ['s-wait', 'flag', 'Penting'], normal: ['s-mute', 'flag', 'Normal'] };
const prioBadge = (p) => badge(...PRIO_UI[p]);
const flagBadge = (f) => badge(f.level === 'danger' ? 's-bad' : 's-wait', f.level === 'danger' ? 'alert' : (f.code.startsWith('transit') ? 'truck' : 'clock'), f.label);
const demoBadge = (on) => (on ? '<span class="badge s-demo" title="Data contoh untuk demonstrasi">Demo</span>' : '');
const lockBadge = (lvl) => (lvl === 'terbatas' ? badge('s-lock', 'lock', 'Terbatas') : '');
function positionHtml(r, compact) {
  if (r.status === 'archived') return `<div class="d">${ic('archive', 'sm')} Diarsipkan · ${esc(r.holder_dept_name)}</div><div class="p">${esc(r.location || 'Arsip digital')}</div>`;
  if (r.in_transit && r.transit) {
    return `<div class="transit-line">${ic('truck', 'sm')} Dalam Pengiriman</div>
      <div class="d" style="font-weight:600">${esc(r.transit.from_dept_name)} ${ic('arrow', 'sm')} ${esc(r.transit.to_dept_name)}</div>
      <div class="p">Pengirim: ${esc(r.transit.from_name)}${r.transit.to_name ? ` · Tujuan: ${esc(r.transit.to_name)}` : ''}${compact ? '' : ` · belum dikonfirmasi diterima`}</div>`;
  }
  return `<div class="d">${ic('building', 'sm')} ${esc(r.holder_dept_name)}</div><div class="p">${ic('user', 'sm')} ${esc(r.holder_name || '-')}</div>`;
}
function stageProgress(r) {
  if (!r.stage_total) return '';
  const cells = [];
  for (let i = 1; i <= r.stage_total; i++) {
    let c = '';
    if (r.status === 'approved' || r.status === 'completed' || r.status === 'archived' && r.stage_status == null) c = 'ok';
    else if (i < r.stage_seq) c = 'ok';
    else if (i === r.stage_seq) c = r.stage_status === 'rejected' ? 'bad' : r.stage_status ? 'wait' : 'ok';
    cells.push(`<i class="${c}"></i>`);
  }
  return `<div class="progress" aria-hidden="true">${cells.join('')}</div>`;
}

// ============ state, API, toast, modal ============
const state = { me: null, meta: null, unread: 0, pageActs: {} };
const app = $('#app');
async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'disposisi-app' }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Tidak dapat terhubung ke server. Periksa koneksi Anda.'); }
  let data = {};
  try { data = await res.json(); } catch { /* bukan JSON */ }
  if (res.status === 401 && url !== '/api/login') { state.me = null; renderLogin(); throw new Error(data.error || 'Sesi berakhir.'); }
  if (!res.ok) { const e = new Error(data.error || 'Terjadi kesalahan.'); e.status = res.status; throw e; }
  return data;
}
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${ic(type === 'ok' ? 'checkc' : 'alert')}<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), type === 'ok' ? 3500 : 6500);
}
function modal({ title, body, foot = '', wide }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="${wide ? 'width:min(860px,100%)' : ''}">
    <div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Tutup">${ic('x')}</button></div>
    <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div></div>`;
  const bg = $('.modal-bg', root);
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  setTimeout(() => $('input:not([type=hidden]),select,textarea', root)?.focus(), 30);
  return { el: $('.modal', root), close };
}
// Modal berisi formulir. onSubmit(data, form, submitter) -> bila sukses modal ditutup.
function formModal({ title, body, submit = 'Simpan', submitClass = 'primary', extraButtons = '', wide, onSubmit, onMount }) {
  const m = modal({ title, wide, body: `<form id="mform" novalidate><div class="err-box" hidden></div>${body}</form>`,
    foot: `<button class="btn" data-close type="button">Batal</button>${extraButtons}<button class="btn ${submitClass}" type="submit" form="mform" value="">${submit}</button>` });
  const form = $('#mform');
  onMount && onMount(form, m);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btns = $$('button[type=submit]', m.el);
    const err = $('.err-box', form);
    err.hidden = true;
    btns.forEach((b) => (b.disabled = true));
    try {
      const data = Object.fromEntries(new FormData(form));
      await onSubmit(data, form, e.submitter);
      m.close();
    } catch (ex) {
      err.innerHTML = `${ic('alert')}<span>${esc(ex.message)}</span>`;
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest' });
    } finally { btns.forEach((b) => (b.disabled = false)); }
  });
  return m;
}
const confirmBox = (title, text, okLabel = 'Ya, lanjutkan', cls = 'primary') => new Promise((resolve) => {
  const m = modal({ title, body: `<p style="margin:0">${text}</p>`, foot: `<button class="btn" data-close>Batal</button><button class="btn ${cls}" id="cfm-ok">${esc(okLabel)}</button>` });
  $('#cfm-ok').onclick = () => { m.close(); resolve(true); };
});

// ============ router & layout ============
function parseHash() {
  const h = location.hash.slice(1) || '/dashboard';
  const [p, qs] = h.split('?');
  return { path: p, parts: p.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function go(path, q) {
  const s = q && Object.keys(clean(q)).length ? '?' + new URLSearchParams(clean(q)) : '';
  const target = '#' + path + s;
  if (location.hash === target) render(); else location.hash = target;
}
function drill(label, ids) { ls.set('drill', { label, ids }); go('/dokumen', { drill: Date.now() }); }
const deptName = (id) => state.meta.departments.find((d) => d.id === +id)?.name || '-';
const userName = (id) => state.meta.users.find((u) => u.id === +id)?.name || '-';
const opts = (list, val, empty, key = 'id', label = 'name') => (empty != null ? `<option value="">${esc(empty)}</option>` : '') +
  list.map((x) => `<option value="${esc(x[key])}"${String(x[key]) === String(val ?? '') ? ' selected' : ''}>${esc(typeof label === 'function' ? label(x) : x[label])}</option>`).join('');
const canCreate = () => ['admin', 'staff'].includes(state.me.role);

function shell() {
  if ($('.layout')) return;
  const me = state.me;
  app.innerHTML = `<div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><img src="favicon.svg" alt=""><div><b>Disposisi Dokumen</b><span>Monitoring & Lacak Posisi</span></div></div>
      <nav class="nav" aria-label="Menu utama">
        <a href="#/dashboard" data-nav="dashboard">${ic('grid')} Dashboard</a>
        <a href="#/dokumen" data-nav="dokumen">${ic('files')} Register Dokumen</a>
        ${canCreate() ? `<a href="#/dokumen/baru" data-nav="baru">${ic('plus')} Catat Dokumen</a>` : ''}
        <a href="#/dokumen?card=followup" data-nav="followup">${ic('alert')} Perlu Tindak Lanjut</a>
        <a href="#/notifikasi" data-nav="notifikasi">${ic('bell')} Notifikasi <span class="count" id="nav-count" hidden></span></a>
        <a href="#/laporan" data-nav="laporan">${ic('chart')} Laporan</a>
        ${me.role === 'admin' ? `<div class="sep">Administrasi</div><a href="#/admin" data-nav="admin">${ic('gear')} Pengaturan Sistem</a>` : ''}
      </nav>
      <div class="me"><div class="avatar">${esc(me.name.split(' ').map((s) => s[0]).slice(0, 2).join(''))}</div>
        <div class="who"><b>${esc(me.name)}</b><span>${esc(me.role_label)}${me.department_name ? ' · ' + esc(me.department_name) : ''}</span></div>
        <button data-act="logout" title="Keluar" aria-label="Keluar">${ic('logout')}</button></div>
    </aside>
    <div class="overlay" id="overlay" data-act="menu"></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" data-act="menu" aria-label="Buka menu">${ic('menu')}</button>
        <div class="tracker">${ic('search')}
          <input id="tracker" type="search" autocomplete="off" placeholder="Lacak dokumen: ketik nomor, judul, atau nama penanggung jawab…  ( / )" aria-label="Lacak posisi dokumen">
          <div class="track-results" id="track-results" hidden></div>
        </div>
        <a class="icon-btn" href="#/notifikasi" aria-label="Notifikasi">${ic('bell')}<span class="dot" id="bell-count" hidden></span></a>
      </header>
      <main class="content" id="view"></main>
    </div></div>`;
  setupTracker();
}

async function render() {
  if (!state.me) return;
  shell();
  const r = parseHash();
  const view = $('#view');
  $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show');
  const navKey = r.parts[0] === 'dokumen' ? (r.parts[1] === 'baru' ? 'baru' : r.q.card === 'followup' ? 'followup' : 'dokumen') : r.parts[0];
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));
  state.pageActs = {};
  view.innerHTML = '<div class="empty">Memuat…</div>';
  try {
    const [a, b, c] = r.parts;
    if (a === 'dashboard' || !a) await pageDashboard(view, r.q);
    else if (a === 'dokumen' && !b) await pageRegister(view, r.q);
    else if (a === 'dokumen' && b === 'baru') await pageForm(view, null);
    else if (a === 'dokumen' && c === 'ubah') await pageForm(view, b);
    else if (a === 'dokumen') await pageDetail(view, b);
    else if (a === 'notifikasi') await pageNotif(view);
    else if (a === 'laporan') await pageReport(view, r.q);
    else if (a === 'admin') await pageAdmin(view, r.q);
    else view.innerHTML = '<div class="empty">Halaman tidak ditemukan.</div>';
  } catch (e) {
    view.innerHTML = `<div class="card card-b"><div class="notice bad">${ic('alert')}<div><b>Gagal memuat halaman.</b><br>${esc(e.message)}</div></div>
      <p><a class="btn" href="#/dashboard">${ic('left')} Kembali ke Dashboard</a></p></div>`;
  }
  window.scrollTo(0, 0);
}

// delegasi event (CSP: tanpa inline handler)
const globalActs = {
  logout: async () => { await api('POST', '/api/logout').catch(() => {}); state.me = null; renderLogin(); },
  menu: () => { $('#sidebar').classList.toggle('open'); $('#overlay').classList.toggle('show'); },
  go: (el) => go(el.dataset.path, el.dataset.q ? JSON.parse(el.dataset.q) : undefined),
  drill: (el) => drill(el.dataset.label, JSON.parse(el.dataset.ids)),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = state.pageActs[el.dataset.act] || globalActs[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
// tooltip grafik
document.addEventListener('mousemove', (e) => {
  const el = e.target.closest('[data-tip]');
  const tip = $('#tip');
  if (!el) { tip.hidden = true; return; }
  tip.innerHTML = el.dataset.tip;
  tip.hidden = false;
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8), y = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && $('#tracker')) { e.preventDefault(); $('#tracker').focus(); }
});
window.addEventListener('hashchange', render);

// ============ pelacak cepat (topbar) ============
function setupTracker() {
  const inp = $('#tracker'), box = $('#track-results');
  let items = [], sel = 0;
  const show = () => {
    box.innerHTML = items.length ? items.map((r, i) => `<a class="track-item${i === sel ? ' sel' : ''}" href="#/dokumen/${r.id}">
      <div class="t1"><b>${esc(r.doc_no)}</b>${statusBadge(r.status)}${demoBadge(r.is_demo)}</div>
      <div class="small">${esc(r.title)}</div>
      <div class="pos">${r.in_transit ? `${ic('truck', 'sm')} <b style="color:var(--wait)">Dalam pengiriman</b> ${esc(r.transit.from_dept_name)} → ${esc(r.transit.to_dept_name)}`
        : `${ic('pin', 'sm')} <b>${esc(r.holder_dept_name)}</b> · ${esc(r.holder_name || '-')}`} · ${ic('layers', 'sm')} ${esc(r.stage_label)} · ${ic('pen', 'sm')} ${r.sig_total ? `${r.sig_signed}/${r.sig_total} TTD` : 'tanpa TTD'}</div></a>`).join('')
      : '<div class="empty">Dokumen tidak ditemukan.</div>';
    box.hidden = false;
  };
  const search = debounce(async () => {
    const q = inp.value.trim();
    if (q.length < 2) { box.hidden = true; return; }
    try { items = (await api('GET', `/api/documents?size=8&q=${encodeURIComponent(q)}`)).rows; sel = 0; show(); } catch { /* abaikan */ }
  }, 200);
  inp.addEventListener('input', search);
  inp.addEventListener('focus', () => { if (items.length && inp.value.trim().length >= 2) show(); });
  inp.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); show(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); show(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[sel]) { location.hash = `#/dokumen/${items[sel].id}`; box.hidden = true; inp.blur(); }
    else if (e.key === 'Escape') { box.hidden = true; }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.tracker')) box.hidden = true; else if (e.target.closest('.track-item')) { box.hidden = true; inp.value = ''; } });
}

// ============ notifikasi (polling) ============
async function refreshNotif() {
  if (!state.me) return;
  try {
    const n = await api('GET', '/api/notifications');
    state.unread = n.unread;
    for (const id of ['bell-count', 'nav-count']) { const el = $('#' + id); if (el) { el.hidden = !n.unread; el.textContent = n.unread > 99 ? '99+' : n.unread; } }
    return n;
  } catch { return null; }
}
setInterval(refreshNotif, 60000);

// ============ grafik ============
function hbars(rows, { fmt = (v) => num(v, 0), color, max } = {}) {
  if (!rows.length) return '<div class="empty">Belum ada data.</div>';
  const m = max || Math.max(...rows.map((r) => r.value), 1);
  return `<div class="hbars">${rows.map((r) => `<button class="hbar" data-act="${r.act || 'drill'}" ${r.attrs || ''}
      data-tip="${esc(`<b>${esc(r.label)}</b>${esc(r.tip || fmt(r.value))}<br><span style='opacity:.75'>Klik untuk melihat dokumen</span>`)}" aria-label="${esc(r.label)}: ${esc(fmt(r.value))}">
      <span class="lbl">${r.icon || ''}<span>${esc(r.label)}</span></span>
      <span class="track"><span class="fill" style="width:${(r.value / m) * 100}%;${r.color || color ? `background:${r.color || color}` : ''}"></span></span>
      <span class="val">${esc(fmt(r.value))}</span></button>`).join('')}</div>`;
}
function vgroup(cols, series) {
  const max = Math.max(1, ...cols.flatMap((c) => series.map((s) => c[s.key].length)));
  const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  const top = Math.ceil(max / step) * step;
  const lines = [];
  for (let v = 0; v <= top; v += step) lines.push(`<div class="gl" style="bottom:${(v / top) * 100}%"><span>${v}</span></div>`);
  return `<div class="legend" style="margin-bottom:8px">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>
    <div class="vchart">${lines.join('')}${cols.map((c) => {
    const tip = `<b>${esc(c.label)}</b>${series.map((s) => `${esc(s.label)}: ${c[s.key].length}`).join('<br>')}`;
    return `<div class="vcol" data-tip="${esc(tip)}" data-act="drill" data-label="${esc(`Dokumen masuk/selesai ${c.label}`)}" data-ids="${esc(JSON.stringify([...new Set(series.flatMap((s) => c[s.key]))]))}">
      ${series.map((s) => `<div class="b ${s.cls}" style="height:${(c[s.key].length / top) * 100}%" data-act="drill" data-label="${esc(`${s.label} ${c.label}`)}" data-ids="${esc(JSON.stringify(c[s.key]))}" data-tip="${esc(`<b>${esc(s.label)} · ${esc(c.label)}</b>${c[s.key].length} dokumen`)}"></div>`).join('')}</div>`;
  }).join('')}</div><div class="vlabels">${cols.map((c) => `<span>${esc(c.label)}</span>`).join('')}</div>`;
}
const STATUS_COLOR = { draft: '#94a3b8', in_review: '#3b82f6', revision: '#f59e0b', rejected: '#dc2626', approved: '#22c55e', completed: '#16a34a', archived: '#15803d' };

// ============ halaman: dashboard ============
function periodFromPreset(p) {
  const t = todayWIB();
  const [y, m] = t.split('-').map(Number);
  if (p === '30') return { from: addDaysStr(t, -29), to: t };
  if (p === 'quarter') { const qm = Math.floor((m - 1) / 3) * 3 + 1; return { from: `${y}-${String(qm).padStart(2, '0')}-01`, to: t }; }
  if (p === 'year') return { from: `${y}-01-01`, to: t };
  return { from: t.slice(0, 8) + '01', to: t };
}
function periodControls(q) {
  const preset = q.preset || 'month';
  const per = preset === 'custom' ? { from: q.from || periodFromPreset('month').from, to: q.to || todayWIB() } : periodFromPreset(preset);
  const html = `<div class="actions">
    <select id="preset" aria-label="Periode" style="width:auto">${[['month', 'Bulan ini'], ['30', '30 hari terakhir'], ['quarter', 'Triwulan ini'], ['year', 'Tahun ini'], ['custom', 'Rentang kustom']]
    .map(([v, l]) => `<option value="${v}"${v === preset ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <span id="custom-range" ${preset === 'custom' ? '' : 'hidden'} class="actions"><input type="date" id="pfrom" value="${per.from}" aria-label="Dari tanggal" style="width:auto"> <span class="muted">s.d.</span> <input type="date" id="pto" value="${per.to}" aria-label="Sampai tanggal" style="width:auto"></span>
  </div>`;
  const bind = (path) => {
    $('#preset').onchange = (e) => go(path, { preset: e.target.value, ...(e.target.value === 'custom' ? per : {}) });
    const upd = () => go(path, { preset: 'custom', from: $('#pfrom').value, to: $('#pto').value });
    $('#pfrom') && ($('#pfrom').onchange = upd); $('#pto') && ($('#pto').onchange = upd);
  };
  return { per, html, bind };
}

async function pageDashboard(view, q) {
  const pc = periodControls(q);
  const d = await api('GET', `/api/dashboard?from=${pc.per.from}&to=${pc.per.to}`);
  const per = d.period;
  const perText = `${fmtDate(per.from)} – ${fmtDate(per.to)}`;
  const K = [
    ['active', 'Dokumen Aktif', 'files', 'var(--navy-600)', 'var(--navy-100)', 'Belum selesai / belum diarsipkan'],
    ['in_review', 'Dalam Proses Approval', 'clock', 'var(--info)', 'var(--info-bg)', 'Menunggu keputusan approver'],
    ['waiting_sign', 'Menunggu Tanda Tangan', 'pen', '#d97706', 'var(--wait-bg)', 'Approval selesai / TTD sebagian'],
    ['transit', 'Dalam Pengiriman', 'truck', '#d97706', 'var(--wait-bg)', 'Dikirim, belum dikonfirmasi diterima'],
    ['overdue', 'Melewati Tenggat', 'alert', 'var(--bad)', 'var(--bad-bg)', 'Belum selesai, lewat tenggat'],
    ['completed', 'Selesai Periode Ini', 'checkc', 'var(--ok)', 'var(--ok-bg)', perText],
  ];
  const fuRows = d.followup.map((r) => `<div class="fu">
      <div><div><a class="docno" href="#/dokumen/${r.id}"><b>${esc(r.doc_no)}</b></a> · <span class="t">${esc(r.title)}</span> ${prioBadge(r.priority)} ${demoBadge(r.is_demo)}</div>
        <div class="pos">${r.in_transit ? `${ic('truck', 'sm')} <b style="color:var(--wait)">Dalam pengiriman</b> ${esc(r.transit.from_dept_name)} → ${esc(r.transit.to_dept_name)} sejak ${fmtDT(r.transit.sent_at)}`
          : `${ic('pin', 'sm')} <b>${esc(r.holder_dept_name)}</b> · ${esc(r.holder_name || '-')} · ${durText(r.hold_days)}`} · ${ic('layers', 'sm')} ${esc(r.stage_label)} · Tenggat ${fmtDate(r.due_date)}</div>
        <div class="flags">${r.flags.filter((f) => f.code !== 'transit').map(flagBadge).join('')}</div></div>
      <a class="btn sm" href="#/dokumen/${r.id}">${ic('eye', 'sm')} Buka</a></div>`).join('');
  view.innerHTML = `
    <div class="page-head"><div><h1>Dashboard Monitoring Dokumen</h1><p>Posisi, pemegang, approval, dan tanda tangan dokumen · diperbarui ${fmtDT(new Date().toISOString())}</p></div>
      <div class="actions">${pc.html}${canCreate() ? `<a class="btn primary" href="#/dokumen/baru">${ic('plus')} Catat Dokumen</a>` : ''}</div></div>
    <div class="kpis">${K.map(([k, label, icon, c, cb, sub]) => `<button class="kpi" style="--k:${c};--kb:${cb}" data-act="go" data-path="/dokumen" data-q='${esc(JSON.stringify(k === 'completed' ? { card: k, from: per.from, to: per.to } : { card: k }))}'>
        <span class="k-top"><span class="k-ic">${ic(icon)}</span>${label}</span><span class="k-val">${d.cards[k].length}</span><span class="k-sub">${esc(sub)}</span></button>`).join('')}</div>
    <div class="grid g2" style="margin-bottom:16px">
      <section class="card"><div class="card-h"><h2>${ic('alert')} Perlu Tindak Lanjut <span class="badge s-bad">${d.followup_total}</span></h2>
        <a class="btn sm" href="#/dokumen?card=followup">Lihat semua</a></div>
        <div class="fu-list" style="max-height:520px;overflow:auto">${fuRows || '<div class="empty">Tidak ada dokumen yang perlu tindak lanjut. 👍</div>'}</div></section>
      <section class="card"><div class="card-h"><h2>${ic('layers')} Jumlah Dokumen per Status</h2><span class="muted small">Klik batang untuk membuka daftar</span></div>
        <div class="card-b">${hbars(d.by_status.filter((s) => s.ids.length).map((s) => ({ label: s.label, value: s.ids.length, color: STATUS_COLOR[s.key], icon: ic(STATUS_UI[s.key][1], 'sm'),
          act: 'go', attrs: `data-path="/dokumen" data-q='${esc(JSON.stringify({ status: s.key }))}'`, tip: `${s.ids.length} dokumen` })))}</div></section>
    </div>
    <div class="grid g2" style="margin-bottom:16px">
      <section class="card"><div class="card-h"><h2>${ic('building')} Distribusi Dokumen per Departemen Pemegang</h2><span class="muted small">Tidak termasuk arsip</span></div>
        <div class="card-b">${hbars(d.by_holder.map((h) => ({ label: h.label, value: h.ids.length, color: h.key === 'transit' ? '#d97706' : undefined,
          icon: ic(h.key === 'transit' ? 'truck' : 'building', 'sm'), act: 'go', attrs: `data-path="/dokumen" data-q='${esc(JSON.stringify(h.key === 'transit' ? { status: 'transit' } : { holder_dept: h.key, hide_archived: '1' }))}'`, tip: `${h.ids.length} dokumen` })))}
          <p class="small muted" style="margin:10px 0 0">${ic('info', 'sm')} Dokumen yang dikirim tetap tercatat di "Dalam Pengiriman" sampai penerima mengonfirmasi.</p></div></section>
      <section class="card"><div class="card-h"><h2>${ic('clock')} Rata-rata Waktu Proses per Departemen</h2><span class="muted small">${perText}</span></div>
        <div class="card-b">${hbars(d.avg_by_dept.map((a) => ({ label: a.dept_name, value: a.avg_days, tip: `Rata-rata ${durText(a.avg_days)} per kunjungan (${a.visits} kunjungan, ${a.ids.length} dokumen)`,
          attrs: `data-label="${esc(`Dokumen yang berada di ${a.dept_name} (${perText})`)}" data-ids="${esc(JSON.stringify(a.ids))}"` })), { fmt: (v) => `${num(v)} hr` })}
          <p class="small muted" style="margin:10px 0 0">${ic('info', 'sm')} Dihitung dari waktu diterima sampai dikirim keluar dari departemen (termasuk yang masih berjalan).</p></div></section>
    </div>
    <section class="card"><div class="card-h"><h2>${ic('chart')} Tren Dokumen Masuk & Selesai per Bulan</h2><span class="muted small">12 bulan terakhir · klik batang untuk daftar dokumen</span></div>
      <div class="card-b">${vgroup(d.trend, [{ key: 'in_ids', label: 'Masuk (dicatat)', color: 'var(--series-1)', cls: 's1' }, { key: 'done_ids', label: 'Selesai', color: 'var(--series-2)', cls: 's2' }])}</div></section>`;
  pc.bind('/dashboard');
}

// ============ halaman: register ============
const CARD_LABEL = { active: 'Dokumen aktif', in_review: 'Dalam proses approval', waiting_sign: 'Menunggu tanda tangan', transit: 'Dalam pengiriman (belum diterima)', overdue: 'Melewati tenggat', completed: 'Selesai pada periode', followup: 'Perlu tindak lanjut' };
// Kolom diurutkan agar posisi, pemegang, approval, dan TTD langsung terlihat tanpa scroll.
const COLS = [
  ['doc_no', 'No. Dokumen', (r) => `<a class="docno" href="#/dokumen/${r.id}">${esc(r.doc_no)}</a><div>${demoBadge(r.is_demo)} ${lockBadge(r.access_level)}</div>`, 'sticky-col'],
  ['title', 'Judul / Perihal', (r) => `<a href="#/dokumen/${r.id}" style="color:var(--ink);font-weight:600">${esc(r.title)}</a><div style="margin-top:3px">${prioBadge(r.priority)}</div>`, 'ttl'],
  ['status', 'Status Proses', (r) => statusBadge(r.status)],
  ['holder_dept_name', 'Posisi / Dept. Pemegang', (r) => positionHtml(r, true), 'cell-pos'],
  ['holder_name', 'Penanggung Jawab', (r) => (r.in_transit ? `<div>${esc(r.transit.from_name)}</div><div class="small muted">pengirim terakhir</div>` : esc(r.holder_name || '-'))],
  ['stage_label', 'Tahap Approval', (r) => `${esc(r.stage_label)}${r.stage_total ? `<div class="small muted">Tahap ${Math.min(r.stage_seq || 0, r.stage_total)}/${r.stage_total}${r.stage_dept_name ? ' · ' + esc(r.stage_dept_name) : ''}</div>` : ''}${stageProgress(r)}`, '', 'min-width:150px'],
  ['sig_status', 'Tanda Tangan', (r) => sigBadge(r)],
  ['hold_days', 'Lama di Bagian', (r) => (r.closed ? '<span class="muted">-</span>' : `<b>${durText(r.hold_days)}</b>`), 'nowrap'],
  ['position_since', 'Diterima di Bagian', (r) => (r.in_transit ? `<span class="small" style="color:var(--wait)">Dikirim ${fmtDT(r.transit.sent_at)}</span>` : fmtDT(r.holder_since)), 'nowrap'],
  ['due_date', 'Tenggat', (r) => `${fmtDate(r.due_date)}${r.overdue ? `<div>${badge('s-bad', 'alert', 'Terlambat')}</div>` : ''}`, 'nowrap'],
  [null, 'Lokasi / Tautan', (r) => `${r.location ? `<div class="small">${ic('pin', 'sm')} ${esc(r.location)}</div>` : ''}${r.digital_link ? `<div class="small"><a href="${esc(r.digital_link)}" target="_blank" rel="noopener">${ic('link', 'sm')} Buka tautan</a></div>` : ''}${!r.location && !r.digital_link ? '<span class="muted">-</span>' : ''}`, '', 'min-width:170px'],
  ['type_name', 'Jenis', (r) => esc(r.type_name)],
  ['origin_dept_name', 'Dept. Asal', (r) => esc(r.origin_dept_name)],
  ['created_at', 'Tgl Dibuat', (r) => fmtDate(r.created_at), 'nowrap'],
  [null, 'Aksi', (r) => `<a class="btn sm" href="#/dokumen/${r.id}">${ic('eye', 'sm')} Detail</a>`],
];
async function pageRegister(view, q) {
  const dr = q.drill ? ls.get('drill') : null;
  const params = clean({ ...q, drill: undefined, ids: dr ? dr.ids.join(',') || '0' : undefined, size: q.size || 10 });
  const data = await api('GET', '/api/documents?' + new URLSearchParams(params));
  const m = state.meta;
  const chips = [];
  if (q.card) chips.push([CARD_LABEL[q.card] + (q.card === 'completed' && q.from ? ` (${fmtDate(q.from)} – ${fmtDate(q.to)})` : ''), 'card']);
  if (dr) chips.push([dr.label, 'drill']);
  const sortTh = ([k, label], i) => {
    if (!k) return `<th>${label}</th>`;
    const on = q.sort === k;
    return `<th class="sortable${on ? ' sorted' : ''}${i === 0 ? ' sticky-col' : ''}" data-act="sort" data-k="${k}" aria-sort="${on ? (q.dir === 'desc' ? 'descending' : 'ascending') : 'none'}">${label}<span class="arr">${on && q.dir === 'desc' ? '▼' : on ? '▲' : '↕'}</span></th>`;
  };
  const rows = data.rows.map((r) => `<tr class="${r.overdue ? 'late' : ''}">${COLS.map(([, , cell, cls, st]) => `<td${cls ? ` class="${cls}"` : ''}${st ? ` style="${st}"` : ''}>${cell(r)}</td>`).join('')}</tr>`).join('');
  const pages = [];
  for (let p = Math.max(1, data.page - 2); p <= Math.min(data.pages, data.page + 2); p++) pages.push(`<button class="btn sm ${p === data.page ? 'cur' : ''}" data-act="page" data-p="${p}">${p}</button>`);
  const exportQs = new URLSearchParams(clean({ ...params, page: undefined, size: undefined }));
  view.innerHTML = `
    <div class="page-head"><div><h1>Register Dokumen</h1><p>${data.total} dokumen ditemukan · klik nomor dokumen untuk melihat posisi & riwayat lengkap</p></div>
      <div class="actions">
        <a class="btn" href="/api/documents/export?format=xlsx&${exportQs}">${ic('download')} Excel</a>
        <a class="btn" href="/api/documents/export?format=csv&${exportQs}">${ic('download')} CSV</a>
        ${canCreate() ? `<a class="btn primary" href="#/dokumen/baru">${ic('plus')} Catat Dokumen</a>` : ''}</div></div>
    <section class="card">
      <form class="filters" id="filters" role="search">
        <label class="field q"><span>Cari</span><input type="search" name="q" value="${esc(q.q || '')}" placeholder="Nomor, judul, atau penanggung jawab"></label>
        <label class="field"><span>Departemen pemegang</span><select name="holder_dept">${opts(m.departments, q.holder_dept, 'Semua')}</select></label>
        <label class="field"><span>Departemen asal</span><select name="origin_dept">${opts(m.departments, q.origin_dept, 'Semua')}</select></label>
        <label class="field"><span>Status proses</span><select name="status"><option value="">Semua</option><option value="active"${q.status === 'active' ? ' selected' : ''}>Semua yang aktif</option><option value="transit"${q.status === 'transit' ? ' selected' : ''}>Dalam pengiriman</option>
          ${Object.entries(m.status_label).map(([k, v]) => `<option value="${k}"${q.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Jenis dokumen</span><select name="type">${opts(m.types, q.type, 'Semua')}</select></label>
        <label class="field"><span>Prioritas</span><select name="priority"><option value="">Semua</option>${Object.entries(m.priority_label).map(([k, v]) => `<option value="${k}"${q.priority === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Tanggal dokumen dari</span><input type="date" name="date_from" value="${esc(q.date_from || '')}"></label>
        <label class="field"><span>s.d.</span><input type="date" name="date_to" value="${esc(q.date_to || '')}"></label>
        <label class="field"><span>Keterlambatan</span><select name="late"><option value="">Semua</option><option value="yes"${q.late === 'yes' ? ' selected' : ''}>Terlambat</option><option value="no"${q.late === 'no' ? ' selected' : ''}>Tidak terlambat</option></select></label>
        <label class="field"><span>Tanda tangan</span><select name="sig"><option value="">Semua</option>${[['unsigned', 'Belum ditandatangani'], ['partial', 'Sebagian'], ['complete', 'Lengkap'], ['none', 'Tidak perlu TTD']].map(([k, v]) => `<option value="${k}"${q.sig === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <div class="field" style="justify-content:flex-end"><button class="btn" type="button" data-act="reset">${ic('refresh', 'sm')} Reset filter</button></div>
      </form>
      ${chips.length ? `<div class="chips"><span class="small muted">Filter aktif:</span>${chips.map(([l, k]) => `<span class="chip">${esc(l)}<button data-act="unchip" data-k="${k}" aria-label="Hapus filter">×</button></span>`).join('')}</div>` : ''}
      <div class="table-wrap"><table class="tbl"><thead><tr>${COLS.map(sortTh).join('')}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${COLS.length}"><div class="empty">Tidak ada dokumen yang sesuai filter.</div></td></tr>`}</tbody></table></div>
      <div class="pager"><div class="small muted">Menampilkan ${data.rows.length ? (data.page - 1) * data.size + 1 : 0}–${(data.page - 1) * data.size + data.rows.length} dari ${data.total}
        · <select data-act-change="size" id="psize" style="width:auto;min-height:30px;padding:2px 6px">${[10, 25, 50, 100].map((s) => `<option${+data.size === s ? ' selected' : ''}>${s}</option>`).join('')}</select> per halaman</div>
        <div class="pg"><button class="btn sm" data-act="page" data-p="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>${ic('left', 'sm')}</button>${pages.join('')}
        <button class="btn sm" data-act="page" data-p="${data.page + 1}" ${data.page >= data.pages ? 'disabled' : ''}>${ic('right', 'sm')}</button></div></div>
    </section>`;
  const upd = (patch) => go('/dokumen', { ...q, page: undefined, ...patch });
  const f = $('#filters');
  f.addEventListener('change', (e) => { if (e.target.name && e.target.name !== 'q') upd({ [e.target.name]: e.target.value }); });
  f.q.addEventListener('input', debounce(() => upd({ q: f.q.value.trim() }), 400));
  f.addEventListener('submit', (e) => { e.preventDefault(); upd({ q: f.q.value.trim() }); });
  $('#psize').onchange = (e) => upd({ size: e.target.value });
  if (q.q) { f.q.focus(); f.q.setSelectionRange(f.q.value.length, f.q.value.length); }
  state.pageActs = {
    sort: (el) => go('/dokumen', { ...q, sort: el.dataset.k, dir: q.sort === el.dataset.k && q.dir !== 'desc' ? 'desc' : 'asc', page: undefined }),
    page: (el) => go('/dokumen', { ...q, page: el.dataset.p }),
    reset: () => go('/dokumen', {}),
    unchip: (el) => upd(el.dataset.k === 'card' ? { card: undefined, from: undefined, to: undefined } : { drill: undefined }),
  };
}

// ============ halaman: detail ============
const EVT_UI = {
  created: ['info', 'file'], updated: ['', 'edit'], submitted: ['info', 'send'], stage: ['', 'layers'], sent: ['wait', 'truck'], received: ['ok', 'inbox'],
  send_cancelled: ['bad', 'x'], approved: ['ok', 'check'], approval_complete: ['ok', 'checkc'], rejected: ['bad', 'xc'], revision: ['wait', 'undo'],
  resubmitted: ['info', 'refresh'], signed: ['ok', 'pen'], sign_complete: ['ok', 'checkc'], completed: ['ok', 'checkc'], archived: ['ok', 'archive'],
  note: ['', 'note'], attachment: ['', 'upload'],
};
async function pageDetail(view, id) {
  const D = await api('GET', `/api/documents/${id}`);
  const { doc, summary: S, perms } = D;
  const transitDisp = D.dispositions.find((x) => x.status === 'in_transit');
  const waiting = D.stages.find((s) => s.status === 'waiting');
  const files = D.attachments.filter((a) => a.kind === 'dokumen');
  const attLink = (a) => `<a href="/api/attachments/${a.id}" target="_blank" rel="noopener">${ic('file', 'sm')} ${esc(a.filename)}</a>`;
  const btn = [];
  if (transitDisp?.can_receive) btn.push(`<button class="btn primary" data-act="receive" data-id="${transitDisp.id}">${ic('inbox')} Konfirmasi Penerimaan</button>`);
  if (perms.decide) btn.push(`<button class="btn primary" data-act="decide">${ic('check')} Putuskan Approval</button>`);
  if (perms.send) btn.push(`<button class="btn navy" data-act="send">${ic('send')} Kirim / Disposisi</button>`);
  if (perms.submit) btn.push(`<button class="btn primary" data-act="submit">${ic('send')} Ajukan Approval</button>`);
  if (perms.resubmit) btn.push(`<button class="btn primary" data-act="resubmit">${ic('refresh')} Ajukan Ulang</button>`);
  if (perms.complete) btn.push(`<button class="btn ok" data-act="complete">${ic('checkc')} Tandai Selesai</button>`);
  if (perms.archive) btn.push(`<button class="btn navy" data-act="archive">${ic('archive')} Arsipkan</button>`);
  if (transitDisp?.can_cancel) btn.push(`<button class="btn danger" data-act="cancel" data-id="${transitDisp.id}">${ic('x')} Batalkan Pengiriman</button>`);
  if (perms.edit) btn.push(`<a class="btn" href="#/dokumen/${doc.id}/ubah">${ic('edit')} Ubah Data</a>`);
  if (perms.upload) btn.push(`<button class="btn" data-act="upload">${ic('upload')} Lampiran</button>`);

  // ---- panel posisi ----
  let posCol, holderCol;
  if (doc.status === 'archived') {
    posCol = `<div class="lbl">Posisi dokumen</div><div class="big">${esc(doc.holder_dept_name)}</div><span class="pos-state archived">${ic('archive', 'sm')} Diarsipkan ${fmtDate(doc.archived_at)}</span>`;
    holderCol = `<div class="lbl">Pemegang terakhir</div><div class="v">${esc(doc.holder_name || '-')}</div><div class="s">Sejak ${fmtDT(doc.holder_since)}</div>`;
  } else if (transitDisp) {
    posCol = `<div class="lbl">Posisi dokumen</div><div class="big pos-transit">${esc(transitDisp.from_dept_name)} <span class="arrow">${ic('arrow', 'lg')}</span> ${esc(transitDisp.to_dept_name)}</div>
      <span class="pos-state transit">${ic('truck', 'sm')} Dalam Pengiriman — belum dikonfirmasi diterima</span>`;
    holderCol = `<div class="lbl">Pengirim terakhir (bertanggung jawab)</div><div class="v">${esc(transitDisp.from_name)}</div><div class="s">Dikirim ${fmtDT(transitDisp.sent_at)}</div>
      <div class="s">Tujuan: ${esc(transitDisp.to_name || 'Petugas ' + transitDisp.to_dept_name)}</div>`;
  } else {
    posCol = `<div class="lbl">Posisi dokumen</div><div class="big">${esc(doc.holder_dept_name)}</div><span class="pos-state held">${ic('checkc', 'sm')} ${D.dispositions.some((x) => x.status === 'received') ? 'Sudah Diterima' : 'Di departemen pencatat'}</span>`;
    holderCol = `<div class="lbl">Pemegang / penanggung jawab</div><div class="v">${esc(doc.holder_name || '-')}</div><div class="s">${D.dispositions.some((x) => x.status === 'received') ? 'Diterima' : 'Sejak'} ${fmtDT(doc.holder_since)}</div>`;
  }
  const stageNow = waiting ? `Tahap ${waiting.seq}/${D.stages.length}: ${esc(waiting.name)}` : esc(S.stage_label);
  const physLoc = [doc.loc_building, doc.loc_room, doc.loc_cabinet && 'Lemari ' + doc.loc_cabinet.replace(/^Lemari\s*/i, ''), doc.loc_shelf && 'Rak ' + doc.loc_shelf.replace(/^Rak\s*/i, ''), doc.loc_folder].filter(Boolean).join(' · ');
  const nextBtn = transitDisp?.can_receive ? `<button class="btn primary sm" data-act="receive" data-id="${transitDisp.id}">${ic('inbox', 'sm')} Konfirmasi Penerimaan</button>`
    : perms.decide ? `<button class="btn primary sm" data-act="decide">${ic('check', 'sm')} Putuskan</button>`
      : (doc.status === 'in_review' && waiting && doc.media !== 'digital' && doc.holder_dept_id !== waiting.dept_id && perms.send) ? `<button class="btn primary sm" data-act="send" data-to="${waiting.dept_id}">${ic('send', 'sm')} Kirim ke ${esc(waiting.dept_name)}</button>` : '';
  const posPanel = `<section class="pos-panel" aria-label="Posisi dokumen saat ini">
    <h2>${ic('pin', 'sm')} Posisi Dokumen Saat Ini</h2>
    <div class="pos-main">
      <div>${posCol}</div>
      <div>${holderCol}</div>
      <div><div class="lbl">Lama di posisi ini</div><div class="big">${S.closed ? '-' : durText(S.hold_days)}</div><div class="s">Total proses: ${durText(S.total_days)}</div></div>
      <div><div class="lbl">Approval & tanda tangan</div><div class="v">${stageNow}</div><div class="s">${waiting ? 'Menunggu ' + esc(waiting.approver_name || 'approver ' + waiting.dept_name) : esc(doc.status_label)}</div>
        <div class="s">${ic('pen', 'sm')} ${S.sig_total ? `${S.sig_signed}/${S.sig_total} sudah tanda tangan` : 'Tidak memerlukan tanda tangan'}</div></div>
    </div>
    <div class="pos-main" style="margin-top:14px">
      <div style="grid-column:span 2"><div class="lbl">Lokasi fisik</div><div class="s" style="color:#fff">${doc.media === 'digital' ? 'Dokumen digital (tanpa fisik)' : `${ic('pin', 'sm')} ${esc(physLoc || '-')}`}</div>
        ${transitDisp && doc.media !== 'digital' ? '<div class="s">Lokasi tercatat terakhir sebelum dikirim.</div>' : ''}</div>
      <div style="grid-column:span 2"><div class="lbl">Akses file digital</div><div class="s">${doc.digital_link ? `<a href="${esc(doc.digital_link)}" target="_blank" rel="noopener">${ic('link', 'sm')} ${esc(doc.digital_link)}</a><br>` : ''}
        ${files.length ? files.map(attLink).join('<br>') : doc.digital_link ? '' : 'Tidak ada file digital'}</div></div>
    </div>
    ${D.next ? `<div class="next-step">${ic('info')}<span><b>Langkah berikutnya:</b> ${esc(D.next)}</span>${nextBtn}</div>` : ''}
  </section>`;

  // ---- approval ----
  const stepper = `<div class="stepper">${D.stages.map((s) => {
    const cls = s.status === 'approved' ? 'done' : s.status === 'waiting' ? 'cur' : ['rejected', 'revision'].includes(s.status) ? 'bad' : '';
    const icn = s.status === 'approved' ? 'check' : s.status === 'waiting' ? 'clock' : s.status === 'rejected' ? 'x' : s.status === 'revision' ? 'undo' : 'clock';
    return `<div class="step ${cls}"><div class="dot">${ic(icn, 'sm')}</div><div class="nm">${s.seq}. ${esc(s.name)}</div><div class="dp">${esc(s.dept_name)}</div>
      <div class="dp">${esc(s.approver_name || (s.candidate_names?.length ? s.candidate_names.join(' / ') : 'Approver departemen'))}</div>${stageBadge(s.status)}
      <div class="meta">${s.entered_at ? `Masuk: ${fmtDT(s.entered_at)}` : 'Belum dimulai'}</div>
      ${s.decided_at ? `<div class="meta">Diputuskan: ${fmtDT(s.decided_at)}${s.decided_by_name ? ` oleh ${esc(s.decided_by_name)}` : ''}</div>` : ''}
      ${s.due_at && !s.decided_at ? `<div class="meta" style="${s.overdue ? 'color:var(--bad);font-weight:700' : ''}">Tenggat tahap: ${fmtDT(s.due_at)}${s.overdue ? ' (terlambat)' : ''}</div>` : `<div class="meta">SLA ${s.sla_days} hari</div>`}
      ${s.days_in_stage != null ? `<div class="meta">Durasi: ${durText(s.days_in_stage)}</div>` : ''}
      ${s.note ? `<div class="meta" style="color:var(--ink-2)">“${esc(s.note)}”</div>` : ''}</div>`;
  }).join('')}</div>`;
  const rounds = [...new Set(D.stage_history.map((s) => s.round))];
  const history = rounds.length ? `<details style="margin-top:10px"><summary class="link-btn">${ic('history', 'sm')} Riwayat putaran approval sebelumnya (${rounds.length})</summary>
    ${rounds.map((r) => `<div style="margin-top:8px"><b>Putaran ${r}</b><table class="tbl"><tbody>${D.stage_history.filter((s) => s.round === r).map((s) => `<tr><td>${s.seq}. ${esc(s.name)}</td><td>${esc(s.dept_name)}</td><td>${stageBadge(s.status)}</td><td>${s.decided_at ? fmtDT(s.decided_at) + ' · ' + esc(s.decided_by_name || '') : '-'}</td><td>${esc(s.note || '')}</td></tr>`).join('')}</tbody></table></div>`).join('')}</details>` : '';
  const blockNote = waiting && perms.decide_block && state.me.role !== 'viewer' && !perms.decide &&
    (state.me.role === 'admin' || (state.me.role === 'approver' && (waiting.approver_user_id === state.me.id || (!waiting.approver_user_id && waiting.dept_id === state.me.department_id))))
    ? `<div class="notice warn" style="margin-top:10px">${ic('alert')}<span>${esc(perms.decide_block)}</span></div>` : '';

  // ---- tanda tangan ----
  const sigs = D.signatures.length ? D.signatures.map((s) => `<div class="sig">
      ${s.status === 'signed' ? badge('s-ok', 'check', 'Sudah ditandatangani') : badge('s-wait', 'pen', 'Belum ditandatangani')}
      <div class="who"><b>${esc(s.signer_name)}</b><span>${esc(s.role_label || '')}</span>
        ${s.status === 'signed' ? `<div class="small muted">${fmtDT(s.signed_at)} · ${esc(s.method_label)} · dicatat ${esc(s.recorded_by_name)}${s.evidence ? `<br>Bukti: ${esc(s.evidence)}` : ''}${s.evidence_attachment_id ? ` · <a href="/api/attachments/${s.evidence_attachment_id}" target="_blank" rel="noopener">lihat file bukti</a>` : ''}</div>` : ''}</div>
      ${perms.sign.includes(s.id) ? `<button class="btn sm primary" data-act="sign" data-id="${s.id}">${ic('pen', 'sm')} Catat TTD</button>` : ''}</div>`).join('')
    : '<div class="empty">Dokumen ini tidak memerlukan tanda tangan.</div>';
  const sigHist = D.signature_history.length ? `<details style="margin-top:10px"><summary class="link-btn">${ic('history', 'sm')} Tanda tangan versi sebelumnya</summary>
    <table class="tbl"><tbody>${D.signature_history.map((s) => `<tr><td>Versi ${s.version_no}</td><td>${esc(s.signer_name)}</td><td>${s.status === 'signed' ? badge('s-ok', 'check', 'Ditandatangani') : badge('s-mute', 'pen', 'Belum')}</td><td>${s.signed_at ? fmtDT(s.signed_at) : '-'}</td></tr>`).join('')}</tbody></table></details>` : '';

  // ---- timeline ----
  const timeline = D.events.slice().reverse().map((e) => {
    const [cls, icn] = EVT_UI[e.type] || ['', 'info'];
    return `<li class="tl"><div class="ic ${cls}">${ic(icn, 'sm')}</div><div><div class="what">${esc(e.title)}</div>
      <div class="when">${ic('clock', 'sm')} ${fmtDT(e.at)} · ${ic('user', 'sm')} ${esc(e.actor_name || 'Sistem')}${e.dept_name ? ` (${esc(e.dept_name)})` : ''}</div>
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}</div></li>`;
  }).join('');

  // ---- disposisi ----
  const dispRows = D.dispositions.slice().reverse().map((x) => `<tr>
    <td class="nowrap">${fmtDT(x.sent_at)}<div class="small muted">oleh ${esc(x.from_name)}</div></td>
    <td><b>${esc(x.from_dept_name)}</b> → <b>${esc(x.to_dept_name)}</b>${x.to_name ? `<div class="small muted">u.p. ${esc(x.to_name)}</div>` : ''}</td>
    <td style="min-width:200px">${esc(x.instruction)}${x.note ? `<div class="small muted">Catatan: ${esc(x.note)}</div>` : ''}${x.follow_up_due ? `<div class="small muted">Tenggat tindak lanjut: ${fmtDate(x.follow_up_due)}</div>` : ''}</td>
    <td>${x.status === 'received' ? badge('s-ok', 'inbox', 'Sudah Diterima') : x.status === 'in_transit' ? badge('s-wait', 'truck', 'Dalam Pengiriman') : badge('s-mute', 'x', 'Dibatalkan')}</td>
    <td class="nowrap">${x.received_at ? `${fmtDT(x.received_at)}<div class="small muted">oleh ${esc(x.received_by_name)}</div>${x.receive_note ? `<div class="small muted">${esc(x.receive_note)}</div>` : ''}` : x.cancelled_at ? `<span class="small">Dibatalkan ${fmtDT(x.cancelled_at)}<br>${esc(x.cancel_note || '')}</span>` : '<span class="muted">Menunggu konfirmasi</span>'}</td>
    <td class="nowrap">${durText(((x.received_at ? Date.parse(x.received_at) : x.cancelled_at ? Date.parse(x.cancelled_at) : Date.now()) - Date.parse(x.sent_at)) / 86400000)}</td>
    <td class="small">${esc(x.handover_proof || '')}${x.proof_attachment_id ? ` <a href="/api/attachments/${x.proof_attachment_id}" target="_blank" rel="noopener">${ic('file', 'sm')} file</a>` : ''}${!x.handover_proof && !x.proof_attachment_id ? '-' : ''}</td></tr>`).join('');

  const maxDur = Math.max(...D.dept_durations.map((x) => x.days), 0.01);
  const durRows = D.dept_durations.sort((a, b) => b.days - a.days).map((x) => `<div class="dur-row"><span>${x.dept === 'Dalam pengiriman' ? ic('truck', 'sm') : ic('building', 'sm')} ${esc(x.dept)}</span>
    <span class="track"><span class="fill ${x.dept === 'Dalam pengiriman' ? 'transit' : ''}" style="width:${(x.days / maxDur) * 100}%"></span></span><b class="mono">${durText(x.days)}</b></div>`).join('');
  const segRows = D.segments.map((s) => `<tr><td>${s.kind === 'transit' ? `${ic('truck', 'sm')} Pengiriman ${esc(s.from_name)} → ${esc(s.dept_name)}${s.cancelled ? ' (dibatalkan)' : ''}` : `${ic('building', 'sm')} ${esc(s.dept_name)}`}</td>
    <td class="nowrap">${fmtDT(s.start)}</td><td class="nowrap">${s.end ? fmtDT(s.end) : s.ongoing ? '<b>sekarang</b>' : '-'}</td><td class="nowrap"><b>${durText(s.days)}</b></td></tr>`).join('');

  const v = (x) => esc(x || '-');
  view.innerHTML = `
    <div class="page-head"><div>
      <a href="#/dokumen" class="small">${ic('left', 'sm')} Register Dokumen</a>
      <h1 style="margin-top:4px">${esc(doc.doc_no)}</h1>
      <p style="color:var(--ink);font-size:15px;font-weight:600">${esc(doc.title)}</p>
      <div class="actions" style="margin-top:8px">${statusBadge(doc.status)} ${prioBadge(doc.priority)} ${lockBadge(doc.access_level)} ${demoBadge(doc.is_demo)}
        <span class="badge s-mute">${ic('history')}Versi ${doc.version_no}</span> ${S.overdue ? badge('s-bad', 'alert', 'Melewati tenggat') : ''}</div></div>
      <div class="actions">${btn.join('')}</div></div>
    ${posPanel}
    <section class="card" style="margin-top:16px"><div class="card-h"><h2>${ic('layers')} Progres Approval</h2><span class="muted small">${esc(doc.type_name)} · putaran ${doc.current_round}</span></div>
      <div class="card-b">${stepper}${blockNote}${history}</div></section>
    <div class="grid g2" style="margin-top:16px">
      <section class="card"><div class="card-h"><h2>${ic('pen')} Status Tanda Tangan</h2><span class="muted small">${S.sig_total ? `${S.sig_signed} dari ${S.sig_total} pihak` : ''}</span></div>
        <div class="card-b"><div class="notice info" style="margin-bottom:10px">${ic('info')}<span>Pencatatan di sini adalah <b>log administrasi</b> tanda tangan (basah, paraf, scan, atau bukti TTE). Ini <b>bukan</b> tanda tangan elektronik tersertifikasi; TTE resmi tetap dilakukan di sistem penyelenggara sertifikasi elektronik.</span></div>
        <div class="sig-list">${sigs}</div>${sigHist}</div></section>
      <section class="card"><div class="card-h"><h2>${ic('file')} Ringkasan Dokumen</h2></div>
        <div class="card-b"><dl class="kv">
          <dt>Nomor dokumen</dt><dd>${v(doc.doc_no)}</dd><dt>Judul / perihal</dt><dd>${v(doc.title)}</dd>
          <dt>Jenis</dt><dd>${v(doc.type_name)}</dd><dt>Deskripsi</dt><dd style="white-space:pre-wrap">${v(doc.description)}</dd>
          <dt>Departemen asal</dt><dd>${v(doc.origin_dept_name)}</dd><dt>Pembuat</dt><dd>${v(doc.creator_name)}</dd>
          <dt>Tanggal dokumen</dt><dd>${fmtDate(doc.doc_date)}</dd><dt>Dicatat</dt><dd>${fmtDT(doc.created_at)}</dd>
          <dt>Tenggat penyelesaian</dt><dd>${fmtDate(doc.due_date)} ${S.overdue ? badge('s-bad', 'alert', 'Terlambat') : ''}</dd>
          <dt>Media</dt><dd>${v(doc.media_label)}</dd><dt>Lokasi fisik</dt><dd>${doc.media === 'digital' ? '-' : v(physLoc)}</dd>
          <dt>Tingkat akses</dt><dd>${doc.access_level === 'terbatas' ? 'Terbatas (hanya pihak terkait)' : 'Umum internal'}</dd>
          ${doc.completed_at ? `<dt>Selesai</dt><dd>${fmtDT(doc.completed_at)}</dd>` : ''}${doc.archived_at ? `<dt>Diarsipkan</dt><dd>${fmtDT(doc.archived_at)}</dd>` : ''}
        </dl></div></section>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <section class="card"><div class="card-h"><h2>${ic('history')} Timeline Perjalanan Dokumen</h2><span class="muted small">Terbaru di atas</span></div>
        <div class="card-b">
          ${perms.note ? `<form id="note-form" class="actions" style="margin-bottom:14px;flex-wrap:nowrap"><input type="text" name="note" placeholder="Tambah catatan atau tindak lanjut…" aria-label="Catatan" maxlength="2000"><button class="btn" type="submit">${ic('note', 'sm')} Simpan</button></form>` : ''}
          <ol class="timeline">${timeline}</ol></div></section>
      <div class="grid" style="align-content:start">
        <section class="card"><div class="card-h"><h2>${ic('clock')} Lama Proses per Bagian</h2><span class="muted small">Total ${durText(S.total_days)}</span></div>
          <div class="card-b">${durRows}
            <details style="margin-top:10px"><summary class="link-btn">Rincian per perpindahan</summary><div class="table-wrap"><table class="tbl"><thead><tr><th>Bagian</th><th>Mulai</th><th>Selesai</th><th>Durasi</th></tr></thead><tbody>${segRows}</tbody></table></div></details></div></section>
        <section class="card"><div class="card-h"><h2>${ic('upload')} Lampiran & Riwayat Revisi</h2></div>
          <div class="card-b">${D.attachments.length ? `<table class="tbl"><thead><tr><th>File</th><th>Jenis</th><th>Versi</th><th>Diunggah</th></tr></thead><tbody>${D.attachments.map((a) => `<tr><td>${attLink(a)} <a class="small" href="/api/attachments/${a.id}?download=1" title="Unduh">${ic('download', 'sm')}</a>${a.note ? `<div class="small muted">${esc(a.note)}</div>` : ''}</td><td>${esc(a.kind)}</td><td>v${a.version_no || 1}</td><td class="small">${fmtDT(a.uploaded_at)}<br>${esc(a.uploaded_by_name || '')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Belum ada lampiran.</div>'}
            <h3 style="margin:14px 0 6px">Versi dokumen</h3>
            <table class="tbl"><tbody>${D.versions.map((x) => `<tr><td><b>Versi ${x.version_no}</b></td><td>${esc(x.reason || '')}</td><td class="small nowrap">${fmtDT(x.created_at)}<br>${esc(x.created_by_name || '')}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
    </div>
    <section class="card" style="margin-top:16px"><div class="card-h"><h2>${ic('truck')} Riwayat Disposisi & Serah Terima</h2><span class="muted small">${D.dispositions.length} pengiriman · seluruh riwayat tersimpan</span></div>
      <div class="table-wrap">${dispRows ? `<table class="tbl"><thead><tr><th>Dikirim</th><th>Dari → Ke</th><th>Instruksi</th><th>Status</th><th>Diterima</th><th>Lama kirim</th><th>Bukti serah terima</th></tr></thead><tbody>${dispRows}</tbody></table>` : '<div class="empty">Belum ada disposisi.</div>'}</div></section>`;

  const reload = () => pageDetail(view, id);
  const rv = doc.row_version;
  $('#note-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = e.target.note.value.trim();
    if (!note) return;
    try { await api('POST', `/api/documents/${id}/notes`, { note }); toast('Catatan disimpan.'); reload(); } catch (ex) { toast(ex.message, 'bad'); }
  });
  const deptOpts = state.meta.departments.filter((d) => d.active);
  const locFields = (pref = {}, ph = doc) => `<div class="fg">
    <label class="field"><span>Gedung</span><input type="text" name="loc_building" value="${esc(pref.loc_building || '')}" placeholder="${esc(ph.loc_building || 'mis. Gedung Kantor Pusat')}"></label>
    <label class="field"><span>Ruang</span><input type="text" name="loc_room" value="${esc(pref.loc_room || '')}" placeholder="${esc(ph.loc_room || 'mis. Lt. 4 – Ruang Keuangan')}"></label>
    <label class="field"><span>Lemari</span><input type="text" name="loc_cabinet" value="${esc(pref.loc_cabinet || '')}" placeholder="${esc(ph.loc_cabinet || '')}"></label>
    <label class="field"><span>Rak</span><input type="text" name="loc_shelf" value="${esc(pref.loc_shelf || '')}" placeholder="${esc(ph.loc_shelf || '')}"></label>
    <label class="field w2"><span>Map / ordner</span><input type="text" name="loc_folder" value="${esc(pref.loc_folder || '')}" placeholder="${esc(ph.loc_folder || '')}"></label></div>`;
  const done = (msg) => { toast(msg); reload(); refreshNotif(); };

  state.pageActs = {
    send: (el) => formModal({
      title: 'Kirim Dokumen / Disposisi', submit: `${ic('send', 'sm')} Kirim`,
      body: `<div class="notice info">${ic('info')}<span>Dokumen akan berstatus <b>Dalam Pengiriman</b> dan tetap tercatat di <b>${esc(doc.holder_dept_name)}</b> sampai penerima mengonfirmasi penerimaan.</span></div>
        <div class="fg">
          <div class="field"><span>Dari departemen</span><input type="text" value="${esc(doc.holder_dept_name)}" disabled></div>
          <div class="field"><span>Pengirim</span><input type="text" value="${esc(state.me.name)}" disabled></div>
          <label class="field"><span>Waktu pengiriman (WIB) <b class="req">*</b></span><input type="datetime-local" name="sent_at" value="${nowInput()}" max="${nowInput()}" required></label>
          <label class="field"><span>Departemen tujuan <b class="req">*</b></span><select name="to_dept_id" required>${opts(deptOpts, el.dataset.to || (waiting && waiting.dept_id !== doc.holder_dept_id ? waiting.dept_id : ''), '— pilih —')}</select></label>
          <label class="field"><span>Penanggung jawab tujuan</span><select name="to_user_id"></select><small>Opsional. Kosongkan bila ke departemen.</small></label>
          <label class="field"><span>Tenggat tindak lanjut</span><input type="date" name="follow_up_due" min="${todayWIB()}"></label>
          <label class="field w3"><span>Instruksi / tujuan disposisi <b class="req">*</b></span><textarea name="instruction" required placeholder="mis. Mohon verifikasi kelengkapan dan persetujuan pembayaran">${waiting ? esc(`Mohon proses tahap "${waiting.name}".`) : ''}</textarea></label>
          <label class="field w3"><span>Catatan</span><input type="text" name="note"></label>
          <label class="field w2"><span>Bukti serah terima</span><input type="text" name="handover_proof" placeholder="mis. Buku ekspedisi No. 1234 / kurir internal"></label>
          <label class="field"><span>File bukti (opsional)</span><input type="file" name="proof_file_input"></label>
        </div>`,
      onMount: (form) => {
        const fill = () => { const dep = +form.to_dept_id.value; form.to_user_id.innerHTML = opts(state.meta.users.filter((u) => u.active && u.department_id === dep && u.role !== 'viewer'), '', '— semua petugas departemen —', 'id', (u) => `${u.name}${u.title ? ' · ' + u.title : ''}`); };
        form.to_dept_id.onchange = fill; fill();
      },
      onSubmit: async (data, form) => {
        const f = form.proof_file_input.files[0];
        delete data.proof_file_input;
        await api('POST', `/api/documents/${id}/dispositions`, { ...data, row_version: rv, proof_file: f ? await fileToPayload(f) : undefined });
        done('Dokumen dikirim. Menunggu konfirmasi penerimaan.');
      },
    }),
    receive: (el) => {
      const x = D.dispositions.find((d) => d.id === +el.dataset.id);
      formModal({
        title: 'Konfirmasi Penerimaan Dokumen', submit: `${ic('inbox', 'sm')} Konfirmasi Diterima`,
        body: `<dl class="kv"><dt>Dari</dt><dd>${esc(x.from_dept_name)} · ${esc(x.from_name)}</dd><dt>Dikirim</dt><dd>${fmtDT(x.sent_at)}</dd><dt>Instruksi</dt><dd>${esc(x.instruction)}</dd>${x.handover_proof ? `<dt>Bukti serah terima</dt><dd>${esc(x.handover_proof)}</dd>` : ''}</dl>
          <div class="fg"><label class="field"><span>Waktu diterima (WIB) <b class="req">*</b></span><input type="datetime-local" name="received_at" value="${nowInput()}" max="${nowInput()}" required></label>
          <div class="field w2"><span>Diterima oleh</span><input type="text" value="${esc(state.me.name)} · ${esc(state.me.department_name || '')}" disabled></div>
          <label class="field w3"><span>Catatan penerimaan</span><input type="text" name="note" placeholder="mis. Diterima lengkap, 2 rangkap asli"></label></div>
          ${doc.media !== 'digital' ? `<details><summary class="link-btn">Perbarui lokasi fisik penyimpanan (opsional)</summary><div style="margin-top:8px">${locFields()}</div></details>` : ''}`,
        onSubmit: async (data) => { await api('POST', `/api/dispositions/${x.id}/receive`, { ...data, row_version: rv }); done('Penerimaan dikonfirmasi. Posisi dokumen diperbarui.'); },
      });
    },
    cancel: (el) => formModal({
      title: 'Batalkan Pengiriman', submit: 'Batalkan Pengiriman', submitClass: 'danger solid',
      body: `<p style="margin:0">Pengiriman yang belum diterima akan dibatalkan dan dokumen tetap tercatat di departemen pengirim. Riwayat pengiriman tetap disimpan.</p>
        <label class="field"><span>Alasan pembatalan <b class="req">*</b></span><textarea name="note" required></textarea></label>`,
      onSubmit: async (data) => { await api('POST', `/api/dispositions/${el.dataset.id}/cancel`, { ...data, row_version: rv }); done('Pengiriman dibatalkan.'); },
    }),
    decide: () => formModal({
      title: `Keputusan Approval — ${waiting.name}`, submit: `${ic('check', 'sm')} Setujui`, submitClass: 'ok',
      extraButtons: `<button class="btn warn" type="submit" form="mform" value="revision">${ic('undo', 'sm')} Minta Revisi</button><button class="btn danger solid" type="submit" form="mform" value="reject">${ic('xc', 'sm')} Tolak</button>`,
      body: `<dl class="kv"><dt>Dokumen</dt><dd>${esc(doc.doc_no)} — ${esc(doc.title)}</dd><dt>Tahap</dt><dd>${waiting.seq}/${D.stages.length} · ${esc(waiting.name)} (${esc(waiting.dept_name)})</dd>
        <dt>Masuk tahap</dt><dd>${fmtDT(waiting.entered_at)}</dd><dt>Tenggat tahap</dt><dd>${fmtDT(waiting.due_at)}</dd></dl>
        <label class="field"><span>Catatan keputusan</span><textarea name="note" placeholder="Wajib diisi untuk Tolak atau Minta Revisi"></textarea></label>`,
      onSubmit: async (data, form, sub) => {
        const decision = sub?.value || 'approve';
        if (decision === 'reject' && !(await confirmBox('Tolak dokumen?', 'Dokumen yang ditolak tidak dapat dilanjutkan dan hanya dapat diarsipkan.', 'Ya, tolak', 'danger solid'))) throw new Error('Penolakan dibatalkan.');
        await api('POST', `/api/stages/${waiting.id}/decide`, { decision, note: data.note, row_version: rv });
        done(decision === 'approve' ? 'Tahap disetujui.' : decision === 'reject' ? 'Dokumen ditolak.' : 'Permintaan revisi dikirim ke pembuat dokumen.');
      },
    }),
    submit: async () => {
      if (!(await confirmBox('Ajukan untuk approval?', `Dokumen akan masuk tahap pertama: <b>${esc(D.stages[0]?.name || '')}</b> (${esc(D.stages[0]?.dept_name || '')}).`))) return;
      try { await api('POST', `/api/documents/${id}/submit`, { row_version: rv }); done('Dokumen diajukan untuk approval.'); } catch (e) { toast(e.message, 'bad'); }
    },
    resubmit: () => formModal({
      title: 'Ajukan Ulang Setelah Revisi', submit: `${ic('refresh', 'sm')} Ajukan Ulang`,
      body: `<div class="notice info">${ic('info')}<span>Versi dokumen akan naik menjadi <b>versi ${doc.version_no + 1}</b>. Tahap yang sudah disetujui sebelum tahap revisi tetap tercatat; tahap yang meminta revisi akan memutuskan ulang. Riwayat versi lama tetap tersimpan.</span></div>
        <label class="field"><span>Ringkasan perbaikan <b class="req">*</b></span><textarea name="note" required></textarea></label>
        <label class="field"><span>File dokumen hasil revisi (opsional)</span><input type="file" name="file_input" multiple></label>`,
      onSubmit: async (data, form) => {
        const files = await Promise.all([...form.file_input.files].map(fileToPayload));
        await api('POST', `/api/documents/${id}/resubmit`, { note: data.note, files, row_version: rv });
        done('Dokumen diajukan ulang.');
      },
    }),
    sign: (el) => {
      const s = D.signatures.find((x) => x.id === +el.dataset.id);
      formModal({
        title: 'Catat Tanda Tangan', submit: `${ic('pen', 'sm')} Simpan Pencatatan`,
        body: `<div class="notice warn">${ic('alert')}<span>Ini pencatatan administratif, <b>bukan</b> proses tanda tangan elektronik resmi. Untuk TTE, lakukan penandatanganan di sistem penyelenggara lalu catat buktinya di sini.</span></div>
          <dl class="kv"><dt>Penanda tangan</dt><dd>${esc(s.signer_name)}</dd><dt>Jabatan</dt><dd>${esc(s.role_label || '-')}</dd></dl>
          <div class="fg"><label class="field w2"><span>Metode <b class="req">*</b></span><select name="method" required>${opts(Object.entries(state.meta.sign_methods).map(([k, l]) => ({ id: k, name: l })), 'basah', '— pilih —')}</select></label>
          <label class="field"><span>Waktu tanda tangan (WIB) <b class="req">*</b></span><input type="datetime-local" name="signed_at" value="${nowInput()}" max="${nowInput()}" required></label>
          <label class="field w3"><span>Bukti / keterangan <b class="req">*</b></span><input type="text" name="evidence" placeholder="mis. Tanda tangan basah pada lembar asli hal. 3; no. sertifikat TTE …"></label>
          <label class="field w3"><span>File bukti (opsional, mis. scan halaman bertanda tangan)</span><input type="file" name="file_input"></label></div>`,
        onSubmit: async (data, form) => {
          const f = form.file_input.files[0];
          await api('POST', `/api/signatures/${s.id}/sign`, { method: data.method, signed_at: data.signed_at, evidence: data.evidence, evidence_file: f ? await fileToPayload(f) : undefined, row_version: rv });
          done('Tanda tangan dicatat.');
        },
      });
    },
    complete: () => formModal({
      title: 'Tandai Dokumen Selesai', submit: `${ic('checkc', 'sm')} Tandai Selesai`, submitClass: 'ok',
      body: `<p style="margin:0">Seluruh tahap approval sudah disetujui dan tanda tangan lengkap. Tandai proses dokumen ini selesai?</p><label class="field"><span>Catatan</span><input type="text" name="note"></label>`,
      onSubmit: async (data) => { await api('POST', `/api/documents/${id}/complete`, { ...data, row_version: rv }); done('Dokumen dinyatakan selesai.'); },
    }),
    archive: () => formModal({
      title: 'Arsipkan Dokumen', submit: `${ic('archive', 'sm')} Arsipkan`, submitClass: 'navy',
      body: `<div class="notice info">${ic('info')}<span>Pengarsipan tidak menghapus data. Seluruh riwayat disposisi, approval, dan tanda tangan tetap tersimpan dan dapat ditelusuri.</span></div>
        ${doc.media !== 'digital' ? `<h3>Lokasi arsip fisik</h3>${locFields({ loc_building: doc.loc_building, loc_room: doc.loc_room, loc_cabinet: doc.loc_cabinet, loc_shelf: doc.loc_shelf, loc_folder: doc.loc_folder })}` : ''}
        <label class="field"><span>Catatan</span><input type="text" name="note"></label>`,
      onSubmit: async (data) => { await api('POST', `/api/documents/${id}/archive`, { ...data, row_version: rv }); done('Dokumen diarsipkan.'); },
    }),
    upload: () => formModal({
      title: 'Unggah Lampiran', submit: `${ic('upload', 'sm')} Unggah`,
      body: `<label class="field"><span>File (maks. 10 MB) <b class="req">*</b></span><input type="file" name="file_input" required></label>
        <label class="field"><span>Jenis</span><select name="kind"><option value="lampiran">Lampiran pendukung</option><option value="dokumen">File dokumen utama</option><option value="bukti serah terima">Bukti serah terima</option><option value="bukti tanda tangan">Bukti tanda tangan</option></select></label>
        <label class="field"><span>Keterangan</span><input type="text" name="note"></label>`,
      onSubmit: async (data, form) => {
        const f = form.file_input.files[0];
        if (!f) throw new Error('Pilih file terlebih dahulu.');
        await api('POST', `/api/documents/${id}/attachments`, { ...(await fileToPayload(f)), kind: data.kind, note: data.note });
        done('Lampiran diunggah.');
      },
    }),
  };
}

// ============ halaman: formulir tambah/ubah ============
async function pageForm(view, id) {
  if (!id && !canCreate()) throw new Error('Anda tidak memiliki hak untuk mencatat dokumen.');
  const m = state.meta;
  const D = id ? await api('GET', `/api/documents/${id}`) : null;
  const doc = D ? D.doc : {
    doc_date: todayWIB(), due_date: addDaysStr(todayWIB(), 7), priority: 'normal', media: 'fisik', access_level: 'internal',
    origin_dept_id: state.me.department_id || '', creator_name: state.me.name, type_id: '',
  };
  if (D && !D.perms.edit) throw new Error('Anda tidak berwenang mengubah dokumen ini.');
  const full = !D || D.perms.edit_full;
  const revision = D && doc.status === 'revision';
  const limited = ['description', 'priority', 'due_date', 'media', 'digital_link', 'access_level', 'loc_building', 'loc_room', 'loc_cabinet', 'loc_shelf', 'loc_folder', 'files'];
  const editable = (k) => full || limited.includes(k) || (revision && ['title', 'doc_date', 'creator_name'].includes(k));
  const dis = (k) => (editable(k) ? '' : ' disabled');
  let stages = D ? D.stages.map((s) => ({ name: s.name, dept_id: s.dept_id, approver_user_id: s.approver_user_id || '', sla_days: s.sla_days })) : [];
  let signers = D ? D.signatures.map((s) => ({ signer_user_id: s.signer_user_id || '', signer_name: s.signer_user_id ? '' : s.signer_name, role_label: s.role_label || '' })) : [];
  const activeDepts = m.departments.filter((d) => d.active || d.id === doc.origin_dept_id);
  view.innerHTML = `
    <div class="page-head"><div>${D ? `<a class="small" href="#/dokumen/${D.doc.id}">${ic('left', 'sm')} Kembali ke detail</a>` : ''}
      <h1>${D ? 'Ubah Data Dokumen' : 'Catat Dokumen Baru'}</h1><p>${D ? `${esc(doc.doc_no)} · status ${esc(doc.status_label)}` : 'Kolom bertanda * wajib diisi'}</p></div></div>
    ${D && !full ? `<div class="notice warn" style="margin-bottom:14px">${ic('info')}<span>Dokumen sudah diajukan, sehingga hanya data pendukung (deskripsi, prioritas, tenggat, media, lokasi, tautan, akses${revision ? ', serta judul & tanggal saat revisi' : ''}) yang dapat diubah. Jalur approval dan penanda tangan dikunci untuk menjaga integritas proses.</span></div>` : ''}
    <form class="card" id="docform" novalidate>
      <div class="form-sec"><div class="err-box" hidden></div><h3>${ic('file')} Identitas Dokumen</h3>
        <div class="fg">
          <label class="field"><span>Jenis dokumen <b class="req">*</b></span><select name="type_id" required${dis('type_id')}>${opts(m.types.filter((t) => t.active || t.id === doc.type_id), doc.type_id, '— pilih jenis —')}</select></label>
          <label class="field w2"><span>Nomor dokumen (unik) <b class="req">*</b></span><span class="actions" style="flex-wrap:nowrap"><input type="text" name="doc_no" value="${esc(doc.doc_no || '')}" required maxlength="60" placeholder="mis. PP/ADM/2026/10/0007"${dis('doc_no')}>
            ${full ? `<button type="button" class="btn" data-act="autono" title="Buat nomor otomatis">${ic('refresh', 'sm')} Otomatis</button>` : ''}</span></label>
          <label class="field w3"><span>Judul / perihal <b class="req">*</b></span><input type="text" name="title" value="${esc(doc.title || '')}" required maxlength="200"${dis('title')}></label>
          <label class="field w3"><span>Deskripsi</span><textarea name="description" maxlength="4000">${esc(doc.description || '')}</textarea></label>
        </div></div>
      <div class="form-sec"><h3>${ic('building')} Asal, Waktu & Prioritas</h3>
        <div class="fg">
          <label class="field"><span>Departemen asal <b class="req">*</b></span><select name="origin_dept_id" required${dis('origin_dept_id')}>${opts(activeDepts, doc.origin_dept_id, '— pilih —')}</select></label>
          <label class="field"><span>Pembuat dokumen <b class="req">*</b></span><input type="text" name="creator_name" value="${esc(doc.creator_name || '')}" required${dis('creator_name')}></label>
          <label class="field"><span>Tanggal dokumen <b class="req">*</b></span><input type="date" name="doc_date" value="${esc(doc.doc_date || '')}" required${dis('doc_date')}></label>
          <div class="field"><span>Prioritas <b class="req">*</b></span><div class="radio-row">${Object.entries(m.priority_label).map(([k, l]) => `<label><input type="radio" name="priority" value="${k}"${doc.priority === k ? ' checked' : ''}> ${l}</label>`).join('')}</div></div>
          <label class="field"><span>Tenggat penyelesaian <b class="req">*</b></span><input type="date" name="due_date" value="${esc(doc.due_date || '')}" required></label>
          <div class="field"><span>Tingkat akses <b class="req">*</b></span><div class="radio-row"><label><input type="radio" name="access_level" value="internal"${doc.access_level === 'internal' ? ' checked' : ''}> Umum internal</label><label><input type="radio" name="access_level" value="terbatas"${doc.access_level === 'terbatas' ? ' checked' : ''}> ${ic('lock', 'sm')} Terbatas</label></div>
            <small>Terbatas: hanya pembuat, departemen terkait, approver, dan penanda tangan.</small></div>
        </div></div>
      <div class="form-sec"><h3>${ic('pin')} Media & Lokasi Dokumen</h3>
        <div class="field" style="margin-bottom:12px"><span>Media dokumen <b class="req">*</b></span><div class="radio-row">${Object.entries(m.media_label).map(([k, l]) => `<label><input type="radio" name="media" value="${k}"${doc.media === k ? ' checked' : ''}> ${l}</label>`).join('')}</div></div>
        <div id="phys" class="fg">
          <label class="field"><span>Gedung <b class="req">*</b></span><input type="text" name="loc_building" value="${esc(doc.loc_building || '')}" placeholder="mis. Gedung Kantor Pusat"></label>
          <label class="field"><span>Ruang <b class="req">*</b></span><input type="text" name="loc_room" value="${esc(doc.loc_room || '')}" placeholder="mis. Lt. 3 – Ruang Administrasi"></label>
          <label class="field"><span>Lemari</span><input type="text" name="loc_cabinet" value="${esc(doc.loc_cabinet || '')}" placeholder="mis. Lemari 2"></label>
          <label class="field"><span>Rak</span><input type="text" name="loc_shelf" value="${esc(doc.loc_shelf || '')}" placeholder="mis. Rak B"></label>
          <label class="field w2"><span>Map / ordner</span><input type="text" name="loc_folder" value="${esc(doc.loc_folder || '')}" placeholder="mis. Map Proses Berjalan"></label>
        </div>
        <div id="digi" class="fg" style="margin-top:12px">
          <label class="field w2"><span>Tautan dokumen digital</span><input type="url" name="digital_link" value="${esc(doc.digital_link || '')}" placeholder="https://…"></label>
          <label class="field"><span>Unggah file (maks. 10 MB/file)</span><input type="file" id="files" multiple></label>
          <small class="w3 muted">Untuk media digital, isi tautan atau unggah minimal satu file.</small>
        </div></div>
      <div class="form-sec"><h3>${ic('layers')} Jalur Approval</h3>
        ${full ? `<p class="small muted" style="margin:-6px 0 10px">Terisi otomatis sesuai jenis dokumen dan dapat disesuaikan. "Departemen Asal" mengikuti departemen asal dokumen. Bila approver dikosongkan, semua Approver di departemen tersebut dapat memutuskan.</p>` : ''}
        <div id="stages"></div>${full ? `<button type="button" class="btn sm" data-act="addstage">${ic('plus', 'sm')} Tambah tahap</button>` : ''}</div>
      <div class="form-sec"><h3>${ic('pen')} Pihak yang Harus Menandatangani</h3>
        <div id="signers"></div>${full ? `<button type="button" class="btn sm" data-act="addsigner">${ic('plus', 'sm')} Tambah penanda tangan</button>` : ''}</div>
      <div class="form-foot">
        <a class="btn" href="${D ? `#/dokumen/${D.doc.id}` : '#/dokumen'}">Batal</a>
        ${D ? `<button class="btn primary" type="submit" value="save">${ic('check', 'sm')} Simpan Perubahan</button>`
    : `<button class="btn" type="submit" value="draft">${ic('file', 'sm')} Simpan sebagai Draf</button><button class="btn primary" type="submit" value="submit">${ic('send', 'sm')} Simpan & Ajukan</button>`}
      </div>
    </form>`;
  const f = $('#docform');
  const approvers = state.meta.users.filter((u) => u.active && ['approver', 'admin'].includes(u.role));
  const deptChoices = [{ id: 0, name: '« Departemen Asal »' }, ...m.departments.filter((d) => d.active)];
  const drawStages = () => {
    $('#stages').innerHTML = stages.length ? stages.map((s, i) => {
      const dep = +s.dept_id === 0 ? +f.origin_dept_id.value : +s.dept_id;
      return `<div class="stage-edit" data-i="${i}"><span class="no">${i + 1}</span>
        <input type="text" data-k="name" value="${esc(s.name)}" placeholder="Nama tahap" aria-label="Nama tahap"${full ? '' : ' disabled'}>
        <select data-k="dept_id" aria-label="Departemen tahap"${full ? '' : ' disabled'}>${opts(deptChoices, s.dept_id)}</select>
        <select data-k="approver_user_id" aria-label="Approver"${full ? '' : ' disabled'}>${opts(approvers.filter((u) => u.department_id === dep || u.id === +s.approver_user_id), s.approver_user_id, 'Semua approver departemen', 'id', (u) => `${u.name}${u.title ? ' · ' + u.title : ''}`)}</select>
        <label class="actions" style="flex-wrap:nowrap;gap:4px"><input type="number" data-k="sla_days" min="1" max="60" value="${esc(s.sla_days)}" aria-label="SLA hari"${full ? '' : ' disabled'}><span class="small muted">hari</span></label>
        ${full ? `<span class="actions" style="flex-wrap:nowrap;gap:2px"><button type="button" class="btn sm ghost" data-act="stup" data-i="${i}" aria-label="Naikkan">${ic('up', 'sm')}</button><button type="button" class="btn sm ghost" data-act="stdel" data-i="${i}" aria-label="Hapus">${ic('trash', 'sm')}</button></span>` : '<span></span>'}</div>`;
    }).join('') : '<div class="empty">Pilih jenis dokumen untuk memuat jalur approval.</div>';
  };
  const signerUsers = state.meta.users.filter((u) => u.active && u.role !== 'viewer');
  const drawSigners = () => {
    $('#signers').innerHTML = signers.length ? signers.map((s, i) => `<div class="sign-edit" data-i="${i}">
      <select data-k="signer_user_id" aria-label="Pengguna penanda tangan"${full ? '' : ' disabled'}>${opts(signerUsers, s.signer_user_id, '— pihak luar / ketik nama —', 'id', (u) => `${u.name}${u.title ? ' · ' + u.title : ''}`)}</select>
      <input type="text" data-k="signer_name" value="${esc(s.signer_name)}" placeholder="Nama (jika bukan pengguna)" ${s.signer_user_id ? 'disabled' : ''}${full ? '' : ' disabled'} aria-label="Nama penanda tangan">
      <input type="text" data-k="role_label" value="${esc(s.role_label)}" placeholder="Jabatan / peran" aria-label="Jabatan"${full ? '' : ' disabled'}>
      ${full ? `<button type="button" class="btn sm ghost" data-act="sgdel" data-i="${i}" aria-label="Hapus">${ic('trash', 'sm')}</button>` : '<span></span>'}</div>`).join('')
      : '<div class="empty" style="padding:10px">Tidak ada penanda tangan.</div>';
  };
  const loadType = () => {
    const t = m.types.find((x) => x.id === +f.type_id.value);
    stages = t ? t.flow.map((s) => ({ ...s, approver_user_id: s.approver_user_id || '' })) : [];
    signers = t ? t.signers.map((s) => ({ signer_user_id: s.signer_user_id || '', signer_name: s.signer_name || '', role_label: s.role_label || '' })) : [];
    drawStages(); drawSigners();
  };
  const toggleMedia = () => {
    const md = f.querySelector('input[name=media]:checked')?.value;
    $('#phys').style.display = md === 'digital' ? 'none' : '';
    $('#digi').style.display = md === 'fisik' ? 'none' : '';
  };
  drawStages(); drawSigners(); toggleMedia();
  for (const el of $$('input,select,textarea', f)) {
    if (el.closest('#stages,#signers') || el.type === 'file') continue;
    const k = el.name;
    if (k && !editable(k)) el.disabled = true;
  }
  if (full) {
    f.type_id.addEventListener('change', loadType);
    f.origin_dept_id.addEventListener('change', drawStages);
  }
  $$('input[name=media]', f).forEach((r) => r.addEventListener('change', toggleMedia));
  $('#stages').addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (row) stages[row.dataset.i][e.target.dataset.k] = e.target.value; });
  $('#stages').addEventListener('change', (e) => { if (e.target.dataset.k === 'dept_id') { stages[e.target.closest('[data-i]').dataset.i].approver_user_id = ''; drawStages(); } });
  $('#signers').addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (row) signers[row.dataset.i][e.target.dataset.k] = e.target.value; });
  $('#signers').addEventListener('change', (e) => {
    if (e.target.dataset.k !== 'signer_user_id') return;
    const s = signers[e.target.closest('[data-i]').dataset.i];
    const u = state.meta.users.find((x) => x.id === +e.target.value);
    if (u) { s.signer_name = ''; if (!s.role_label) s.role_label = u.title || ''; }
    drawSigners();
  });
  state.pageActs = {
    addstage: () => { stages.push({ name: '', dept_id: '', approver_user_id: '', sla_days: 2 }); drawStages(); },
    stdel: (el) => { stages.splice(+el.dataset.i, 1); drawStages(); },
    stup: (el) => { const i = +el.dataset.i; if (i > 0) { [stages[i - 1], stages[i]] = [stages[i], stages[i - 1]]; drawStages(); } },
    addsigner: () => { signers.push({ signer_user_id: '', signer_name: '', role_label: '' }); drawSigners(); },
    sgdel: (el) => { signers.splice(+el.dataset.i, 1); drawSigners(); },
    autono: async () => {
      if (!f.type_id.value || !f.origin_dept_id.value) return toast('Pilih jenis dokumen dan departemen asal terlebih dahulu.', 'bad');
      f.doc_no.value = (await api('GET', `/api/next-number?dept=${f.origin_dept_id.value}&type=${f.type_id.value}`)).doc_no;
    },
  };
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.err-box', f);
    err.hidden = true;
    const btns = $$('button[type=submit]', f);
    btns.forEach((b) => (b.disabled = true));
    try {
      const data = Object.fromEntries([...new FormData(f)].filter(([k]) => editable(k)));
      const missing = $$('[required]', f).filter((el) => !el.disabled && !el.value.trim()).map((el) => el.closest('.field')?.querySelector('span')?.textContent.replace('*', '').trim());
      if (missing.length) throw new Error(`Lengkapi: ${missing.join(', ')}.`);
      const files = await Promise.all([...$('#files').files].map(fileToPayload));
      const payload = { ...data, files };
      if (full) {
        payload.stages = stages.map((s) => ({ ...s, dept_id: s.dept_id === '' ? null : +s.dept_id }));
        if (payload.stages.some((s) => s.dept_id == null)) throw new Error('Setiap tahap approval harus memiliki departemen.');
        payload.signers = signers;
      }
      if (D) {
        await api('PUT', `/api/documents/${D.doc.id}`, { ...payload, row_version: D.doc.row_version });
        toast('Perubahan disimpan.');
        location.hash = `#/dokumen/${D.doc.id}`;
      } else {
        const r = await api('POST', '/api/documents', { ...payload, submit_now: e.submitter?.value === 'submit' });
        toast(e.submitter?.value === 'submit' ? 'Dokumen dicatat dan diajukan untuk approval.' : 'Dokumen disimpan sebagai draf.');
        location.hash = `#/dokumen/${r.id}`;
      }
    } catch (ex) {
      err.innerHTML = `${ic('alert')}<span>${esc(ex.message)}</span>`;
      err.hidden = false;
      err.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally { btns.forEach((b) => (b.disabled = false)); }
  });
}

// ============ halaman: notifikasi ============
const NOTIF_UI = {
  incoming: ['s-info', 'inbox'], approval: ['s-info', 'clock'], signature: ['s-wait', 'pen'], overdue: ['s-bad', 'alert'], due_soon: ['s-wait', 'clock'],
  transit_late: ['s-wait', 'truck'], rejected: ['s-bad', 'xc'], revision: ['s-wait', 'undo'], received: ['s-ok', 'inbox'], approved: ['s-ok', 'check'],
  signed: ['s-ok', 'pen'], completed: ['s-ok', 'checkc'], action: ['s-wait', 'send'], info: ['s-mute', 'info'],
};
async function pageNotif(view) {
  const n = await refreshNotif() || { rows: [], unread: 0 };
  view.innerHTML = `<div class="page-head"><div><h1>Notifikasi</h1><p>${n.unread} belum dibaca</p></div>
    <div class="actions"><button class="btn" data-act="readall" ${n.unread ? '' : 'disabled'}>${ic('check')} Tandai semua dibaca</button></div></div>
    <section class="card">${n.rows.length ? n.rows.map((x) => {
    const [cls, icn] = NOTIF_UI[x.type] || NOTIF_UI.info;
    return `<div class="notif ${x.read_at ? '' : 'unread'}" data-act="opennotif" data-id="${x.id}" data-doc="${x.document_id || ''}" role="link" tabindex="0">
      <span class="ic badge ${cls}">${ic(icn)}</span><div style="flex:1"><div class="msg">${esc(x.message)}</div><div class="small muted">${fmtDT(x.created_at)}${x.doc_no ? ' · ' + esc(x.doc_no) : ''}</div></div>
      ${x.read_at ? '' : '<span class="badge s-info">Baru</span>'}</div>`;
  }).join('') : '<div class="empty">Belum ada notifikasi.</div>'}</section>`;
  state.pageActs = {
    readall: async () => { await api('POST', '/api/notifications/read', { ids: 'all' }); pageNotif(view); },
    opennotif: async (el) => { await api('POST', '/api/notifications/read', { ids: [el.dataset.id] }).catch(() => {}); refreshNotif(); if (el.dataset.doc) location.hash = `#/dokumen/${el.dataset.doc}`; else pageNotif(view); },
  };
}

// ============ halaman: laporan ============
async function pageReport(view, q) {
  const pc = periodControls(q);
  const R = await api('GET', `/api/reports?from=${pc.per.from}&to=${pc.per.to}`);
  const perText = `${fmtDate(R.period.from)} – ${fmtDate(R.period.to)}`;
  const T = R.totals;
  const dl = (ids, label, text) => (ids.length ? `<button class="link-btn mono" data-act="drill" data-label="${esc(label)}" data-ids="${esc(JSON.stringify(ids))}">${text ?? ids.length}</button>` : '<span class="muted">0</span>');
  const tiles = [
    ['Dokumen masuk', T.created, 'files', 'var(--navy-600)', 'var(--navy-100)', 'Dicatat pada periode'],
    ['Dokumen selesai', T.completed, 'checkc', 'var(--ok)', 'var(--ok-bg)', 'Selesai pada periode'],
    ['Selesai terlambat', T.late_completed, 'alert', 'var(--bad)', 'var(--bad-bg)', 'Selesai melewati tenggat'],
    ['Terlambat (aktif)', T.overdue_now, 'alert', 'var(--bad)', 'var(--bad-bg)', 'Per hari ini'],
  ];
  view.innerHTML = `<div class="page-head"><div><h1>Laporan Kinerja Dokumen</h1><p>Periode ${perText} · setiap angka dapat diklik untuk melihat dokumen terkait</p></div>
    <div class="actions">${pc.html}<button class="btn" data-act="csv">${ic('download')} CSV</button><button class="btn" data-act="print">${ic('printer')} Cetak</button></div></div>
    <div class="kpis">${tiles.map(([l, ids, icn, c, cb, sub]) => `<button class="kpi" style="--k:${c};--kb:${cb}" data-act="drill" data-label="${esc(`${l} (${perText})`)}" data-ids="${esc(JSON.stringify(ids))}"><span class="k-top"><span class="k-ic">${ic(icn)}</span>${l}</span><span class="k-val">${ids.length}</span><span class="k-sub">${sub}</span></button>`).join('')}
      <div class="kpi" style="--k:var(--teal-600);--kb:var(--teal-100);cursor:default"><span class="k-top"><span class="k-ic">${ic('clock')}</span>Rata-rata penyelesaian</span><span class="k-val">${T.completed.length ? num(T.avg_completion_days) : '-'}</span><span class="k-sub">hari kalender (dokumen selesai)</span></div>
      <div class="kpi" style="--k:var(--ok);--kb:var(--ok-bg);cursor:default"><span class="k-top"><span class="k-ic">${ic('check')}</span>Tepat waktu</span><span class="k-val">${T.on_time_rate == null ? '-' : num(T.on_time_rate * 100, 0) + '%'}</span><span class="k-sub">dari dokumen selesai</span></div></div>
    <section class="card" style="margin-bottom:16px"><div class="card-h"><h2>${ic('building')} Kinerja per Departemen</h2></div>
      <div class="table-wrap"><table class="tbl" id="rep-dept"><thead><tr><th>Departemen</th><th>Dokumen dibuat</th><th>Sedang dipegang</th><th>Terlambat dipegang</th><th>Rata-rata lama di dept.</th><th>Keputusan approval</th><th>Rata-rata waktu keputusan</th><th>Keputusan lewat SLA</th></tr></thead>
      <tbody>${R.by_dept.map((r) => `<tr><td><b>${esc(r.dept_name)}</b></td>
        <td>${dl(r.created_ids, `Dokumen dibuat ${r.dept_name} (${perText})`)}</td><td>${dl(r.holding_ids, `Dokumen dipegang ${r.dept_name}`)}</td>
        <td>${r.overdue_ids.length ? `<span style="color:var(--bad);font-weight:700">${dl(r.overdue_ids, `Dokumen terlambat di ${r.dept_name}`)}</span>` : '<span class="muted">0</span>'}</td>
        <td>${r.avg_hold_days == null ? '-' : dl(r.hold_ids, `Dokumen yang berada di ${r.dept_name} (${perText})`, durText(r.avg_hold_days))}</td>
        <td>${dl(r.decision_ids, `Dokumen diputuskan ${r.dept_name} (${perText})`, r.decisions)}</td>
        <td>${r.avg_decision_days == null ? '-' : durText(r.avg_decision_days)}</td><td>${r.decision_late ? `<span style="color:var(--bad);font-weight:700">${r.decision_late}</span>` : '0'}</td></tr>`).join('') || `<tr><td colspan="8"><div class="empty">Tidak ada data.</div></td></tr>`}</tbody></table></div></section>
    <div class="grid g2">
      <section class="card"><div class="card-h"><h2>${ic('clock')} Rata-rata Lama Dokumen di Departemen</h2></div>
        <div class="card-b">${hbars(R.by_dept.filter((r) => r.avg_hold_days != null).sort((a, b) => b.avg_hold_days - a.avg_hold_days).map((r) => ({ label: r.dept_name, value: r.avg_hold_days, tip: durText(r.avg_hold_days),
          attrs: `data-label="${esc(`Dokumen yang berada di ${r.dept_name} (${perText})`)}" data-ids="${esc(JSON.stringify(r.hold_ids))}"` })), { fmt: (v) => `${num(v)} hr` })}</div></section>
      <section class="card"><div class="card-h"><h2>${ic('files')} Per Jenis Dokumen</h2></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Jenis</th><th>Masuk</th><th>Selesai</th><th>Rata-rata penyelesaian</th></tr></thead>
        <tbody>${R.by_type.map((r) => `<tr><td>${esc(r.type_name)}</td><td>${dl(r.created_ids, `${r.type_name} masuk (${perText})`)}</td><td>${dl(r.completed_ids, `${r.type_name} selesai (${perText})`)}</td><td>${r.avg_days == null ? '-' : durText(r.avg_days)}</td></tr>`).join('') || `<tr><td colspan="4"><div class="empty">Tidak ada data.</div></td></tr>`}</tbody></table></div></section>
    </div>`;
  pc.bind('/laporan');
  state.pageActs = {
    print: () => window.print(),
    csv: () => {
      const rows = [['Departemen', 'Dokumen dibuat', 'Sedang dipegang', 'Terlambat dipegang', 'Rata-rata lama di dept (hari)', 'Keputusan approval', 'Rata-rata waktu keputusan (hari)', 'Keputusan lewat SLA'],
        ...R.by_dept.map((r) => [r.dept_name, r.created_ids.length, r.holding_ids.length, r.overdue_ids.length, r.avg_hold_days == null ? '' : r.avg_hold_days.toFixed(2), r.decisions, r.avg_decision_days == null ? '' : r.avg_decision_days.toFixed(2), r.decision_late])];
      const csv = '﻿' + [[`Laporan periode ${perText}`], ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `laporan-departemen-${R.period.from}_${R.period.to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
}

// ============ halaman: admin ============
async function pageAdmin(view, q) {
  if (state.me.role !== 'admin') throw new Error('Hanya Administrator yang dapat mengakses menu ini.');
  const tab = q.tab || 'users';
  const tabs = [['users', 'Pengguna'], ['depts', 'Departemen'], ['types', 'Jenis & Alur Approval'], ['settings', 'Ambang Notifikasi'], ['audit', 'Log Audit'], ['demo', 'Data Demo']];
  const reloadMeta = async () => { state.meta = await api('GET', '/api/meta'); };
  let body = '';
  const m = state.meta;
  if (tab === 'users') {
    const users = await api('GET', '/api/admin/users');
    body = `<div class="card-h"><h2>Pengguna & Hak Akses</h2><button class="btn primary" data-act="user">${ic('plus')} Tambah Pengguna</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Nama pengguna</th><th>Peran</th><th>Departemen</th><th>Status</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="small muted">${esc(u.title || '')}</div></td><td>${esc(u.username)} ${demoBadge(u.is_demo)}</td><td>${esc(m.role_label[u.role])}</td><td>${esc(u.department_id ? deptName(u.department_id) : '-')}</td>
        <td>${u.active ? badge('s-ok', 'check', 'Aktif') : badge('s-mute', 'x', 'Nonaktif')}</td><td><button class="btn sm" data-act="user" data-id="${u.id}">${ic('edit', 'sm')} Ubah</button></td></tr>`).join('')}</tbody></table></div>
      <div class="card-b small muted">${ic('info', 'sm')} Administrator: kelola master data · Staf Administrasi: catat dokumen, kirim disposisi, catat TTD · Approver: memutuskan tahap kewenangannya · Viewer: hanya melihat sesuai izin.</div>`;
    state.pageActs = {
      user: (el) => {
        const u = el.dataset.id ? users.find((x) => x.id === +el.dataset.id) : { active: 1, role: 'staff' };
        formModal({
          title: u.id ? 'Ubah Pengguna' : 'Tambah Pengguna',
          body: `<div class="fg"><label class="field"><span>Nama lengkap *</span><input type="text" name="name" value="${esc(u.name || '')}" required></label>
            <label class="field"><span>Jabatan</span><input type="text" name="title" value="${esc(u.title || '')}"></label>
            <label class="field"><span>Nama pengguna *</span><input type="text" name="username" value="${esc(u.username || '')}" required></label>
            <label class="field"><span>Peran *</span><select name="role">${Object.entries(m.role_label).map(([k, l]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field"><span>Departemen</span><select name="department_id">${opts(m.departments.filter((d) => d.active || d.id === u.department_id), u.department_id, '—')}</select></label>
            <label class="field"><span>${u.id ? 'Kata sandi baru (opsional)' : 'Kata sandi *'}</span><input type="password" name="password" autocomplete="new-password" minlength="6"></label>
            <label class="actions w3"><input type="checkbox" name="active" ${u.active ? 'checked' : ''} style="width:auto;min-height:0"> Akun aktif</label></div>`,
          onSubmit: async (d) => { await api('POST', '/api/admin/users', { ...d, id: u.id, active: !!d.active }); await reloadMeta(); toast('Pengguna disimpan.'); pageAdmin(view, q); },
        });
      },
    };
  } else if (tab === 'depts') {
    body = `<div class="card-h"><h2>Departemen / Fungsi</h2><button class="btn primary" data-act="dept">${ic('plus')} Tambah Departemen</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Status</th><th></th></tr></thead><tbody>
      ${m.departments.map((d) => `<tr><td><b>${esc(d.code)}</b></td><td>${esc(d.name)}</td><td>${d.active ? badge('s-ok', 'check', 'Aktif') : badge('s-mute', 'x', 'Nonaktif')}</td><td><button class="btn sm" data-act="dept" data-id="${d.id}">${ic('edit', 'sm')} Ubah</button></td></tr>`).join('')}</tbody></table></div>`;
    state.pageActs = {
      dept: (el) => {
        const d = el.dataset.id ? m.departments.find((x) => x.id === +el.dataset.id) : { active: 1 };
        formModal({
          title: d.id ? 'Ubah Departemen' : 'Tambah Departemen',
          body: `<div class="fg"><label class="field"><span>Kode *</span><input type="text" name="code" value="${esc(d.code || '')}" required maxlength="10"></label>
            <label class="field w2"><span>Nama *</span><input type="text" name="name" value="${esc(d.name || '')}" required></label>
            <label class="actions w3"><input type="checkbox" name="active" ${d.active ? 'checked' : ''} style="width:auto;min-height:0"> Aktif</label></div>`,
          onSubmit: async (x) => { await api('POST', '/api/admin/departments', { ...x, id: d.id, active: !!x.active }); await reloadMeta(); toast('Departemen disimpan.'); pageAdmin(view, q); },
        });
      },
    };
  } else if (tab === 'types') {
    body = `<div class="card-h"><h2>Jenis Dokumen & Jalur Approval</h2><button class="btn primary" data-act="type">${ic('plus')} Tambah Jenis</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Jenis</th><th>Jalur approval</th><th>Penanda tangan default</th><th>Status</th><th></th></tr></thead><tbody>
      ${m.types.map((t) => `<tr><td><b>${esc(t.code)}</b></td><td>${esc(t.name)}</td>
        <td>${t.flow.map((s, i) => `<span class="nowrap">${i + 1}. ${esc(s.name)} <span class="muted small">(${s.dept_id === 0 ? 'Dept. Asal' : esc(deptName(s.dept_id))}, ${s.sla_days} hr)</span></span>`).join(' → ')}</td>
        <td class="small">${t.signers.map((s) => esc(s.signer_user_id ? userName(s.signer_user_id) : s.signer_name) + (s.role_label ? ` (${esc(s.role_label)})` : '')).join('<br>') || '-'}</td>
        <td>${t.active ? badge('s-ok', 'check', 'Aktif') : badge('s-mute', 'x', 'Nonaktif')}</td><td><button class="btn sm" data-act="type" data-id="${t.id}">${ic('edit', 'sm')} Ubah</button></td></tr>`).join('')}</tbody></table></div>
      <div class="card-b small muted">${ic('info', 'sm')} Perubahan jalur berlaku untuk dokumen baru. Dokumen yang sudah diajukan tetap memakai jalur saat diajukan.</div>`;
    state.pageActs = {
      type: (el) => {
        const t = el.dataset.id ? JSON.parse(JSON.stringify(m.types.find((x) => x.id === +el.dataset.id))) : { active: 1, flow: [{ name: 'Kepala Departemen', dept_id: 0, approver_user_id: null, sla_days: 2 }], signers: [] };
        const approvers = m.users.filter((u) => u.active && ['approver', 'admin'].includes(u.role));
        const deptChoices = [{ id: 0, name: '« Departemen Asal »' }, ...m.departments.filter((d) => d.active)];
        const draw = () => {
          $('#tflow').innerHTML = t.flow.map((s, i) => `<div class="stage-edit" data-i="${i}"><span class="no">${i + 1}</span>
            <input type="text" data-k="name" value="${esc(s.name)}" placeholder="Nama tahap" aria-label="Nama tahap"><select data-k="dept_id" aria-label="Departemen">${opts(deptChoices, s.dept_id)}</select>
            <select data-k="approver_user_id" aria-label="Approver">${opts(approvers.filter((u) => +s.dept_id === 0 || u.department_id === +s.dept_id), s.approver_user_id, 'Semua approver dept.', 'id', (u) => u.name)}</select>
            <input type="number" data-k="sla_days" min="1" max="60" value="${esc(s.sla_days)}" aria-label="SLA hari">
            <span class="actions" style="flex-wrap:nowrap;gap:2px"><button type="button" class="btn sm ghost" data-act="tup" data-i="${i}" aria-label="Naikkan">${ic('up', 'sm')}</button><button type="button" class="btn sm ghost" data-act="tdel" data-i="${i}" aria-label="Hapus">${ic('trash', 'sm')}</button></span></div>`).join('');
          $('#tsign').innerHTML = t.signers.map((s, i) => `<div class="sign-edit" data-i="${i}"><select data-k="signer_user_id" aria-label="Penanda tangan">${opts(m.users.filter((u) => u.active && u.role !== 'viewer'), s.signer_user_id, '— pilih —', 'id', (u) => u.name)}</select>
            <input type="text" data-k="role_label" value="${esc(s.role_label || '')}" placeholder="Jabatan" aria-label="Jabatan"><span></span><button type="button" class="btn sm ghost" data-act="tsdel" data-i="${i}" aria-label="Hapus">${ic('trash', 'sm')}</button></div>`).join('');
        };
        formModal({
          title: t.id ? `Ubah Jenis: ${t.name}` : 'Tambah Jenis Dokumen', wide: true,
          body: `<div class="fg"><label class="field"><span>Kode *</span><input type="text" name="code" value="${esc(t.code || '')}" maxlength="10" required></label>
            <label class="field w2"><span>Nama jenis *</span><input type="text" name="name" value="${esc(t.name || '')}" required></label></div>
            <h3>Jalur approval</h3><div id="tflow"></div><div><button type="button" class="btn sm" data-act="tadd">${ic('plus', 'sm')} Tambah tahap</button></div>
            <h3>Penanda tangan default</h3><div id="tsign"></div><div><button type="button" class="btn sm" data-act="tsadd">${ic('plus', 'sm')} Tambah penanda tangan</button></div>
            <label class="actions"><input type="checkbox" name="active" ${t.active ? 'checked' : ''} style="width:auto;min-height:0"> Aktif</label>`,
          onMount: (form) => {
            draw();
            form.addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (!row || !e.target.dataset.k) return; (row.closest('#tflow') ? t.flow : t.signers)[row.dataset.i][e.target.dataset.k] = e.target.value; });
            form.addEventListener('change', (e) => { if (e.target.dataset.k === 'dept_id') { t.flow[e.target.closest('[data-i]').dataset.i].approver_user_id = null; draw(); } });
            Object.assign(state.pageActs, {
              tadd: () => { t.flow.push({ name: '', dept_id: 0, approver_user_id: null, sla_days: 2 }); draw(); },
              tdel: (b) => { t.flow.splice(+b.dataset.i, 1); draw(); },
              tup: (b) => { const i = +b.dataset.i; if (i > 0) { [t.flow[i - 1], t.flow[i]] = [t.flow[i], t.flow[i - 1]]; draw(); } },
              tsadd: () => { t.signers.push({ signer_user_id: '', role_label: '' }); draw(); },
              tsdel: (b) => { t.signers.splice(+b.dataset.i, 1); draw(); },
            });
          },
          onSubmit: async (d) => { await api('POST', '/api/admin/types', { code: d.code, name: d.name, active: !!d.active, id: t.id, flow: t.flow, signers: t.signers }); await reloadMeta(); toast('Jenis dokumen disimpan.'); pageAdmin(view, q); },
        });
      },
    };
  } else if (tab === 'settings') {
    const s = m.settings;
    body = `<div class="card-h"><h2>Ambang Peringatan "Perlu Tindak Lanjut" & Notifikasi</h2></div>
      <form class="card-b" id="setform"><div class="fg">
        <label class="field"><span>Dianggap tertahan lama setelah (hari)</span><input type="number" name="long_hold_days" min="1" max="90" value="${s.long_hold_days}"></label>
        <label class="field"><span>Peringatan pengiriman belum diterima setelah (jam)</span><input type="number" name="transit_alert_hours" min="1" max="720" value="${s.transit_alert_hours}"></label>
        <label class="field"><span>Peringatan tenggat mendekat (hari sebelum)</span><input type="number" name="due_soon_days" min="0" max="30" value="${s.due_soon_days}"></label></div>
        <p><button class="btn primary" type="submit">${ic('check', 'sm')} Simpan</button></p></form>`;
  } else if (tab === 'audit') {
    const rows = await api('GET', '/api/admin/audit');
    body = `<div class="card-h"><h2>Log Audit (300 aktivitas terakhir)</h2></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pelaku</th><th>Aktivitas</th><th>Dokumen</th><th>Keterangan</th></tr></thead><tbody>
      ${rows.map((e) => `<tr><td class="nowrap small">${fmtDT(e.at)}</td><td>${esc(e.actor_name || 'Sistem')}</td><td>${esc(e.title)}</td><td>${e.document_id ? `<a href="#/dokumen/${e.document_id}">${esc(e.doc_no)}</a>` : '-'}</td><td class="small">${esc(e.note || '')}${e.data && e.type === 'updated' ? `<details><summary>perubahan</summary><pre style="white-space:pre-wrap;font-size:11px">${esc(JSON.stringify(JSON.parse(e.data).changes, null, 1))}</pre></details>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (tab === 'demo') {
    body = `<div class="card-h"><h2>Data Demo</h2></div><div class="card-b"><p>Dokumen bertanda <span class="badge s-demo">Demo</span> adalah data contoh untuk memperlihatkan alur lintas departemen. Sebelum digunakan untuk operasional, hapus data demo agar laporan hanya berisi dokumen riil.</p>
      <div class="notice warn">${ic('alert')}<span>Tindakan ini menghapus permanen seluruh dokumen demo beserta riwayatnya. Akun pengguna demo tidak ikut terhapus — nonaktifkan atau ubah kata sandinya dari tab Pengguna.</span></div>
      <p><button class="btn danger solid" data-act="deldemo">${ic('trash', 'sm')} Hapus Semua Data Demo</button></p></div>`;
    state.pageActs = {
      deldemo: async () => {
        if (!(await confirmBox('Hapus data demo?', 'Seluruh dokumen berlabel Demo akan dihapus permanen.', 'Ya, hapus', 'danger solid'))) return;
        try { const r = await api('POST', '/api/admin/delete-demo'); toast(`${r.deleted} dokumen demo dihapus.`); } catch (e) { toast(e.message, 'bad'); }
      },
    };
  }
  view.innerHTML = `<div class="page-head"><div><h1>Pengaturan Sistem</h1><p>Kelola pengguna, departemen, jenis dokumen, dan alur approval</p></div></div>
    <section class="card"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${k === tab ? 'on' : ''}" data-act="go" data-path="/admin" data-q='${esc(JSON.stringify({ tab: k }))}'>${l}</button>`).join('')}</div>${body}</section>`;
  $('#setform')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/admin/settings', Object.fromEntries(new FormData(e.target))); await reloadMeta(); toast('Pengaturan disimpan.'); } catch (ex) { toast(ex.message, 'bad'); }
  });
}

// ============ login & boot ============
const DEMO_USERS = [['admin', 'Administrator'], ['rina', 'Staf Administrasi · ADM'], ['budi', 'Approver · ADM'], ['sari', 'Staf · Keuangan'], ['hendra', 'Approver · Keuangan'],
  ['lina', 'Approver · Hukum'], ['maya', 'Staf · Direksi'], ['agus', 'Approver · Direktur'], ['wati', 'Staf · Arsip'], ['yusuf', 'Approver · Arsip'], ['fajar', 'Staf · Proyek'], ['andi', 'Viewer · SPI']];
function renderLogin(msg) {
  state.me = null;
  app.innerHTML = `<div class="login">
    <section class="login-art"><img src="favicon.svg" alt="" width="56" height="56">
      <h1>Dashboard Monitoring & Disposisi Dokumen</h1>
      <p style="color:#cfe0f2;max-width:460px;margin:0">Temukan posisi dokumen, pemegang saat ini, tahap approval, dan status tanda tangan dalam hitungan detik.</p>
      <ul><li>${ic('pin')} Posisi & pemegang dokumen real-time</li><li>${ic('truck')} Disposisi dengan konfirmasi penerimaan</li><li>${ic('layers')} Approval bertahap & riwayat revisi</li><li>${ic('pen')} Pencatatan tanda tangan per pihak</li></ul></section>
    <section class="login-form"><form id="login" autocomplete="on">
      <h2 style="font-size:22px">Masuk</h2>
      <div class="err-box" ${msg ? '' : 'hidden'}>${msg ? `${ic('alert')}<span>${esc(msg)}</span>` : ''}</div>
      <label class="field"><span>Nama pengguna</span><input type="text" name="username" autocomplete="username" required></label>
      <label class="field"><span>Kata sandi</span><input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn primary" type="submit" style="padding:10px">Masuk</button>
      <div><div class="small muted" style="margin-bottom:6px">Akun Demo (kata sandi: <b>demo123</b>) — klik untuk mengisi:</div>
        <div class="demo-acc">${DEMO_USERS.map(([u, l]) => `<button type="button" data-u="${u}"><b>${u}</b>${l}</button>`).join('')}</div></div>
    </form></section></div>`;
  const f = $('#login');
  $$('.demo-acc button').forEach((b) => (b.onclick = () => { f.username.value = b.dataset.u; f.password.value = 'demo123'; f.password.focus(); }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', f);
    btn.disabled = true;
    try {
      const r = await api('POST', '/api/login', { username: f.username.value, password: f.password.value });
      state.me = r.user;
      await boot();
    } catch (ex) { renderLogin(ex.message); } finally { btn.disabled = false; }
  });
  f.username.focus();
}
async function boot() {
  try {
    if (!state.me) state.me = (await api('GET', '/api/me')).user;
    state.meta = await api('GET', '/api/meta');
  } catch { return; }
  app.innerHTML = '';
  await render();
  refreshNotif();
}
boot();
