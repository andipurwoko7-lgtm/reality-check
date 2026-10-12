'use strict';
// Server HTTP tanpa dependency eksternal. Jalankan: node server.js  (butuh Node.js >= 22.5)
process.removeAllListeners('warning'); // sembunyikan ExperimentalWarning node:sqlite
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('./src/db');
const { createService, AppError } = require('./src/service');
const { seedIfEmpty } = require('./src/seed');
const { buildXlsx, buildCsv } = require('./src/xlsx');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function createApp({ dataDir, seed = true, clock = () => new Date().toISOString() } = {}) {
  const db = openDb(dataDir);
  const svc = createService(db, { dataDir });
  if (seed) seedIfEmpty(svc, clock());
  const publicDir = path.join(__dirname, 'public');
  const routes = [];
  const route = (method, pattern, auth, handler) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, auth, handler });
  };

  // ----- API -----
  route('POST', '/api/login', false, (c) => {
    const r = svc.login(c.body.username, c.body.password, c.now);
    c.setCookie(r.token);
    return { user: r.user };
  });
  route('POST', '/api/logout', false, (c) => { if (c.token) svc.logout(c.token); c.setCookie('', 0); return { ok: true }; });
  route('GET', '/api/me', true, (c) => ({ user: c.user }));
  route('GET', '/api/meta', true, (c) => svc.meta(c.user));
  route('GET', '/api/next-number', true, (c) => ({ doc_no: svc.nextDocNo(c.query.dept, c.query.type, c.now) }));
  route('GET', '/api/dashboard', true, (c) => svc.dashboard(c.user, c.query, c.now));
  route('GET', '/api/documents', true, (c) => { const { _all, ...r } = svc.listDocuments(c.user, c.query, c.now); return r; });
  route('GET', '/api/documents/export', true, (c) => {
    const { header, rows } = svc.exportRows(c.user, c.query, c.now);
    const stamp = c.now.slice(0, 10);
    if (c.query.format === 'csv') return c.file(Buffer.from(buildCsv(header, rows), 'utf8'), `register-dokumen-${stamp}.csv`, 'text/csv; charset=utf-8');
    return c.file(buildXlsx('Register Dokumen', header, rows), `register-dokumen-${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
  route('POST', '/api/documents', true, (c) => svc.createDocument(c.ctx, c.body));
  route('GET', '/api/documents/:id', true, (c) => svc.detail(c.user, c.params.id, c.now));
  route('PUT', '/api/documents/:id', true, (c) => svc.updateDocument(c.ctx, c.params.id, c.body));
  route('POST', '/api/documents/:id/submit', true, (c) => svc.submit(c.ctx, c.params.id, c.body));
  route('POST', '/api/documents/:id/dispositions', true, (c) => svc.sendDisposition(c.ctx, c.params.id, c.body));
  route('POST', '/api/documents/:id/resubmit', true, (c) => svc.resubmit(c.ctx, c.params.id, c.body));
  route('POST', '/api/documents/:id/complete', true, (c) => svc.complete(c.ctx, c.params.id, c.body));
  route('POST', '/api/documents/:id/archive', true, (c) => svc.archive(c.ctx, c.params.id, c.body));
  route('POST', '/api/documents/:id/notes', true, (c) => svc.addNote(c.ctx, c.params.id, c.body));
  route('POST', '/api/documents/:id/attachments', true, (c) => svc.upload(c.ctx, c.params.id, c.body));
  route('POST', '/api/dispositions/:id/receive', true, (c) => svc.receiveDisposition(c.ctx, c.params.id, c.body));
  route('POST', '/api/dispositions/:id/cancel', true, (c) => svc.cancelDisposition(c.ctx, c.params.id, c.body));
  route('POST', '/api/stages/:id/decide', true, (c) => svc.decide(c.ctx, c.params.id, c.body));
  route('POST', '/api/signatures/:id/sign', true, (c) => svc.sign(c.ctx, c.params.id, c.body));
  route('GET', '/api/attachments/:id', true, (c) => {
    const a = svc.getAttachment(c.user, c.params.id);
    if (!fs.existsSync(a.file)) throw new AppError(404, 'File lampiran tidak ditemukan di penyimpanan.');
    return c.file(fs.readFileSync(a.file), a.filename, a.mime, c.query.download ? 'attachment' : 'inline');
  });
  route('GET', '/api/notifications', true, (c) => svc.notifications(c.user, c.now));
  route('POST', '/api/notifications/read', true, (c) => svc.markRead(c.user, c.body.ids, c.now));
  route('GET', '/api/reports', true, (c) => svc.report(c.user, c.query, c.now));
  route('GET', '/api/admin/users', true, (c) => svc.adminUsers(c.user));
  route('POST', '/api/admin/users', true, (c) => svc.saveUser(c.ctx, c.body));
  route('POST', '/api/admin/departments', true, (c) => svc.saveDept(c.ctx, c.body));
  route('POST', '/api/admin/types', true, (c) => svc.saveType(c.ctx, c.body));
  route('POST', '/api/admin/settings', true, (c) => svc.saveSettings(c.ctx, c.body));
  route('GET', '/api/admin/audit', true, (c) => svc.auditLog(c.user));
  route('POST', '/api/admin/delete-demo', true, (c) => svc.deleteDemo(c.ctx));

  function parseCookies(h) {
    const out = {};
    for (const p of (h || '').split(';')) { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }
    return out;
  }

  async function readBody(req) {
    const chunks = []; let size = 0;
    for await (const ch of req) {
      size += ch.length;
      if (size > 16 * 1024 * 1024) throw new AppError(413, 'Ukuran data terlalu besar (maksimal ±10 MB per file).');
      chunks.push(ch);
    }
    if (!size) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError(400, 'Format data tidak valid.'); }
  }

  const secHeaders = {
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self' blob:; object-src 'self' blob:",
  };

  async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { ...secHeaders, ...headers });
      res.end(body);
    };
    try {
      if (url.pathname.startsWith('/api/')) {
        const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
        if (!r) throw new AppError(404, 'Endpoint tidak ditemukan.');
        if (req.method !== 'GET') {
          // perlindungan CSRF sederhana: permintaan mutasi wajib dari aplikasi ini (header JSON khusus)
          if (req.headers['x-requested-with'] !== 'disposisi-app') throw new AppError(403, 'Permintaan ditolak.');
        }
        const m = url.pathname.match(r.re);
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const token = parseCookies(req.headers.cookie).sid;
        const now = clock();
        const user = svc.sessionUser(token, now);
        if (r.auth && !user) throw new AppError(401, 'Sesi berakhir. Silakan login kembali.');
        const body = req.method === 'GET' ? {} : await readBody(req);
        let extraHeaders = {};
        const c = {
          user, token, now, params, body, query: Object.fromEntries(url.searchParams), ctx: { user, now },
          setCookie: (val, maxAge = 7 * 86400) => { extraHeaders['Set-Cookie'] = `sid=${val}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`; },
          file: (buf, name, mime, disp = 'attachment') => ({ __file: true, buf, name, mime, disp }),
        };
        const out = await r.handler(c);
        if (out && out.__file) {
          const safe = encodeURIComponent(out.name);
          return send(200, out.buf, { ...extraHeaders, 'Content-Type': out.mime || 'application/octet-stream', 'Content-Length': out.buf.length,
            'Content-Disposition': `${out.disp}; filename*=UTF-8''${safe}`, 'Cache-Control': 'private, no-store' });
        }
        return send(200, JSON.stringify(out ?? {}), { ...extraHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      }
      // ----- file statis -----
      let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (!p || p === '.') p = 'index.html';
      let file = path.join(publicDir, p);
      if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(publicDir, 'index.html');
      const ext = path.extname(file);
      return send(200, fs.readFileSync(file), { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    } catch (e) {
      const status = e instanceof AppError ? e.status : 500;
      if (status === 500) console.error(e);
      return send(status, JSON.stringify({ error: status === 500 ? 'Terjadi kesalahan pada server.' : e.message }), { 'Content-Type': 'application/json; charset=utf-8' });
    }
  }

  const server = http.createServer(handler);
  const timer = setInterval(() => { try { svc.scanDeadlines(clock(), true); } catch (e) { console.error(e); } }, 5 * 60000);
  timer.unref();
  server.on('close', () => { clearInterval(timer); db.close(); });
  return { server, svc, db };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const { server } = createApp({ dataDir, seed: process.env.SEED_DEMO !== '0' });
  server.listen(port, () => console.log(`Dashboard Disposisi Dokumen berjalan di http://localhost:${port}  (data: ${dataDir})`));
}

module.exports = { createApp };
