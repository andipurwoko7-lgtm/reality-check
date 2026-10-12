'use strict';
// Uji skenario lengkap lewat HTTP API: buat → kirim → terima → approval → tanda tangan → selesai → arsip,
// plus aturan integritas (nomor unik, validasi, alur sah, konflik versi, hak akses) dan persistensi setelah restart.
process.removeAllListeners('warning');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disposisi-test-'));
let srv, base;
async function start() {
  const app = createApp({ dataDir });
  await new Promise((r) => app.server.listen(0, r));
  srv = app.server;
  base = `http://127.0.0.1:${srv.address().port}`;
}
async function stop() { await new Promise((r) => srv.close(r)); }

const sessions = {};
async function call(user, method, url, body) {
  const res = await fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'disposisi-app', Cookie: sessions[user] ? `sid=${sessions[user]}` : '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}
async function login(user) {
  const res = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'disposisi-app' }, body: JSON.stringify({ username: user, password: 'demo123' }) });
  assert.equal(res.status, 200, `login ${user}`);
  sessions[user] = /sid=([^;]+)/.exec(res.headers.get('set-cookie'))[1];
}
const ok = (r, msg) => { assert.ok(r.status === 200, `${msg}: ${r.status} ${JSON.stringify(r.data?.error || '')}`); return r.data; };
const detail = async (u, id) => ok(await call(u, 'GET', `/api/documents/${id}`), 'detail');

test('skenario lengkap dokumen lintas departemen', async (t) => {
  await start();
  for (const u of ['rina', 'budi', 'sari', 'hendra', 'maya', 'agus', 'wati', 'yusuf', 'andi', 'admin']) await login(u);
  const meta = ok(await call('rina', 'GET', '/api/meta'), 'meta');
  const dept = Object.fromEntries(meta.departments.map((d) => [d.code, d.id]));
  const pp = meta.types.find((x) => x.code === 'PP');
  let id, docNo;

  await t.test('demo tersedia & berlabel', async () => {
    const list = ok(await call('admin', 'GET', '/api/documents?size=200'), 'list');
    assert.ok(list.total >= 15);
    assert.ok(list.rows.every((r) => r.is_demo));
  });

  await t.test('membuat dokumen + validasi + nomor unik', async () => {
    docNo = ok(await call('rina', 'GET', `/api/next-number?dept=${dept.ADM}&type=${pp.id}`), 'nomor').doc_no;
    const base = {
      doc_no: docNo, title: 'Uji: Pembayaran sewa genset proyek', type_id: pp.id, origin_dept_id: dept.ADM, creator_name: 'Rina Wulandari',
      doc_date: '2026-10-01', due_date: '2026-12-31', priority: 'penting', media: 'fisik', access_level: 'internal',
      loc_building: 'Gedung Kantor Pusat', loc_room: 'Ruang Administrasi', stages: pp.flow, signers: pp.signers,
    };
    const bad = await call('rina', 'POST', '/api/documents', { ...base, title: '' });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /Judul/);
    const noLoc = await call('rina', 'POST', '/api/documents', { ...base, loc_building: '' });
    assert.equal(noLoc.status, 400);
    const viewer = await call('andi', 'POST', '/api/documents', base);
    assert.equal(viewer.status, 403);
    id = ok(await call('rina', 'POST', '/api/documents', base), 'buat').id;
    const dup = await call('rina', 'POST', '/api/documents', { ...base, doc_no: docNo.toLowerCase() });
    assert.equal(dup.status, 409, 'nomor dokumen duplikat (tidak peka huruf besar/kecil) ditolak');
    const D = await detail('rina', id);
    assert.equal(D.doc.status, 'draft');
    assert.equal(D.doc.holder_dept_name, 'Administrasi Umum');
    assert.equal(D.stages.length, 5);
    assert.equal(D.signatures.length, 2);
  });

  await t.test('pengajuan & approval tahap awal', async () => {
    let D = await detail('rina', id);
    ok(await call('rina', 'POST', `/api/documents/${id}/submit`, { row_version: D.doc.row_version }), 'submit');
    const again = await call('rina', 'POST', `/api/documents/${id}/submit`, { row_version: D.doc.row_version });
    assert.ok([400, 409].includes(again.status), 'tidak bisa diajukan dua kali');
    for (let i = 0; i < 2; i++) {
      D = await detail('budi', id);
      const st = D.stages.find((s) => s.status === 'waiting');
      ok(await call('budi', 'POST', `/api/stages/${st.id}/decide`, { decision: 'approve', note: 'OK', row_version: D.doc.row_version }), 'approve ADM');
    }
    D = await detail('hendra', id);
    assert.equal(D.stages.find((s) => s.status === 'waiting').name, 'Finance');
    assert.equal(D.perms.decide, null);
    assert.match(D.perms.decide_block, /belum diterima/);
    const early = await call('hendra', 'POST', `/api/stages/${D.stages[2].id}/decide`, { decision: 'approve', row_version: D.doc.row_version });
    assert.equal(early.status, 400, 'approver tidak bisa memutuskan sebelum dokumen fisik diterima');
  });

  let dispId;
  await t.test('kirim: status Dalam Pengiriman, posisi belum pindah', async () => {
    const D = await detail('rina', id);
    const r = ok(await call('rina', 'POST', `/api/documents/${id}/dispositions`, { to_dept_id: dept.FIN, instruction: 'Mohon verifikasi pembayaran', handover_proof: 'Ekspedisi 77', row_version: D.doc.row_version }), 'kirim');
    dispId = r.disposition_id;
    const D2 = await detail('rina', id);
    assert.equal(D2.doc.in_transit, 1);
    assert.equal(D2.doc.holder_dept_id, dept.ADM, 'pemegang tetap pengirim sampai diterima');
    assert.equal(D2.summary.transit.to_dept_name, 'Keuangan (Finance)');
    assert.equal(D2.summary.transit.from_name, 'Rina Wulandari');
    const twice = await call('rina', 'POST', `/api/documents/${id}/dispositions`, { to_dept_id: dept.DIR, instruction: 'x', row_version: D2.doc.row_version });
    assert.equal(twice.status, 400, 'tidak bisa kirim ganda saat masih dalam pengiriman');
    const stale = await call('rina', 'POST', `/api/documents/${id}/notes`, { note: 'tes' });
    assert.equal(stale.status, 200);
    const wrongRecv = await call('maya', 'POST', `/api/dispositions/${dispId}/receive`, { row_version: D2.doc.row_version });
    assert.equal(wrongRecv.status, 403, 'hanya departemen tujuan yang bisa menerima');
    const inbox = ok(await call('sari', 'GET', '/api/notifications'), 'notif');
    assert.ok(inbox.rows.some((n) => n.document_id === id && n.type === 'incoming'), 'Finance mendapat notifikasi kiriman');
  });

  await t.test('konflik versi (perubahan bersamaan) ditolak', async () => {
    const D = await detail('sari', id);
    const stale = await call('sari', 'POST', `/api/dispositions/${dispId}/receive`, { row_version: D.doc.row_version - 1 });
    assert.equal(stale.status, 409);
  });

  await t.test('terima, approval Finance → Direktur → Arsip, tanda tangan', async () => {
    let D = await detail('sari', id);
    ok(await call('sari', 'POST', `/api/dispositions/${dispId}/receive`, { note: 'Lengkap', row_version: D.doc.row_version }), 'terima');
    D = await detail('hendra', id);
    assert.equal(D.doc.in_transit, 0);
    assert.equal(D.doc.holder_dept_id, dept.FIN);
    assert.equal(D.doc.holder_name, 'Sari Dewi');
    assert.ok(D.perms.decide);
    ok(await call('hendra', 'POST', `/api/stages/${D.perms.decide}/decide`, { decision: 'approve', row_version: D.doc.row_version }), 'approve FIN');

    const hop = async (from, to, receiver) => {
      let X = await detail(from, id);
      const s = ok(await call(from, 'POST', `/api/documents/${id}/dispositions`, { to_dept_id: dept[to], instruction: `Ke ${to}`, row_version: X.doc.row_version }), 'kirim ' + to);
      X = await detail(receiver, id);
      ok(await call(receiver, 'POST', `/api/dispositions/${s.disposition_id}/receive`, { row_version: X.doc.row_version }), 'terima ' + to);
    };
    await hop('sari', 'DIR', 'maya');
    D = await detail('andi', id);
    const vw = await call('andi', 'POST', `/api/stages/${D.stages[3].id}/decide`, { decision: 'approve', row_version: D.doc.row_version });
    assert.equal(vw.status, 403, 'viewer tidak bisa approval');
    D = await detail('agus', id);
    const noNote = await call('agus', 'POST', `/api/stages/${D.perms.decide}/decide`, { decision: 'reject', row_version: D.doc.row_version });
    assert.equal(noNote.status, 400, 'penolakan wajib catatan');
    ok(await call('agus', 'POST', `/api/stages/${D.perms.decide}/decide`, { decision: 'approve', note: 'Setuju', row_version: D.doc.row_version }), 'approve DIR');

    for (const s of (await detail('maya', id)).signatures) {
      const X = await detail('maya', id);
      const noEv = await call('maya', 'POST', `/api/signatures/${s.id}/sign`, { method: 'basah', row_version: X.doc.row_version });
      assert.equal(noEv.status, 400, 'bukti TTD wajib');
      ok(await call('maya', 'POST', `/api/signatures/${s.id}/sign`, { method: 'basah', evidence: 'TTD basah hal. 2', row_version: X.doc.row_version }), 'ttd');
    }
    await hop('maya', 'ARS', 'wati');
    D = await detail('yusuf', id);
    ok(await call('yusuf', 'POST', `/api/stages/${D.perms.decide}/decide`, { decision: 'approve', row_version: D.doc.row_version }), 'approve ARS');
    D = await detail('rina', id);
    assert.equal(D.doc.status, 'approved');
    assert.equal(D.summary.sig_status, 'complete');
  });

  await t.test('selesai & arsip, riwayat tetap utuh', async () => {
    let D = await detail('rina', id);
    const arcEarly = await call('wati', 'POST', `/api/documents/${id}/archive`, { row_version: D.doc.row_version });
    assert.equal(arcEarly.status, 400, 'tidak bisa arsip sebelum selesai');
    ok(await call('rina', 'POST', `/api/documents/${id}/complete`, { row_version: D.doc.row_version }), 'selesai');
    D = await detail('wati', id);
    ok(await call('wati', 'POST', `/api/documents/${id}/archive`, { loc_building: 'Gedung Arsip', loc_room: 'R. Arsip 1', loc_cabinet: 'L-3', row_version: D.doc.row_version }), 'arsip');
    D = await detail('rina', id);
    assert.equal(D.doc.status, 'archived');
    assert.equal(D.doc.holder_dept_id, dept.ARS);
    assert.equal(D.doc.loc_building, 'Gedung Arsip');
    const types = D.events.map((e) => e.type).filter((x) => !['stage', 'note'].includes(x));
    const expectOrder = ['created', 'submitted', 'approved', 'approved', 'sent', 'received', 'approved', 'sent', 'received', 'approved', 'approval_complete'];
    let i = 0;
    for (const ty of types) if (ty === expectOrder[i]) i++;
    assert.ok(i >= 9, `urutan timeline sesuai: ${types.join(',')}`);
    assert.ok(types.includes('signed') && types.includes('completed') && types.at(-1) === 'archived');
    assert.equal(D.dispositions.length, 3, 'semua perpindahan tersimpan');
    assert.ok(D.dispositions.every((x) => x.status === 'received' && x.received_at));
    assert.ok(D.segments.some((s) => s.kind === 'transit'));
    const edit = await call('rina', 'PUT', `/api/documents/${id}`, { title: 'ubah', row_version: D.doc.row_version });
    assert.equal(edit.status, 400);
    assert.match(edit.data.error, /diarsipkan/);
  });

  await t.test('revisi & pengajuan ulang menyimpan versi', async () => {
    const mi = meta.types.find((x) => x.code === 'MI');
    const r = ok(await call('rina', 'POST', '/api/documents', {
      doc_no: 'UJI/MI/0001', title: 'Uji memo digital', type_id: mi.id, origin_dept_id: dept.ADM, creator_name: 'Rina', doc_date: '2026-10-01', due_date: '2026-11-01',
      priority: 'normal', media: 'digital', digital_link: 'https://contoh.co.id/memo', access_level: 'internal', stages: mi.flow, signers: [], submit_now: true,
    }), 'buat MI');
    let D = await detail('budi', r.id);
    ok(await call('budi', 'POST', `/api/stages/${D.perms.decide}/decide`, { decision: 'approve', row_version: D.doc.row_version }), 'approve');
    D = await detail('agus', r.id);
    assert.ok(D.perms.decide, 'dokumen digital dapat diputuskan tanpa kirim fisik');
    ok(await call('agus', 'POST', `/api/stages/${D.perms.decide}/decide`, { decision: 'revision', note: 'Perbaiki lampiran', row_version: D.doc.row_version }), 'revisi');
    D = await detail('rina', r.id);
    assert.equal(D.doc.status, 'revision');
    ok(await call('rina', 'POST', `/api/documents/${r.id}/resubmit`, { note: 'Sudah diperbaiki', row_version: D.doc.row_version }), 'ajukan ulang');
    D = await detail('rina', r.id);
    assert.equal(D.doc.version_no, 2);
    assert.equal(D.doc.current_round, 2);
    assert.equal(D.stages[0].status, 'approved');
    assert.equal(D.stages[0].carried, 1);
    assert.equal(D.stages[1].status, 'waiting');
    assert.equal(D.versions.length, 2);
    assert.equal(D.stage_history.length, 2, 'putaran lama tersimpan');
  });

  await t.test('akses dokumen terbatas & lampiran', async () => {
    const all = ok(await call('admin', 'GET', '/api/documents?size=200&q=pengangkatan'), 'admin list');
    const sk = all.rows[0];
    assert.equal(sk.access_level, 'terbatas');
    assert.equal((await call('andi', 'GET', `/api/documents/${sk.id}`)).status, 403);
    assert.equal((await call('rina', 'GET', `/api/documents/${sk.id}`)).status, 403);
    assert.equal(ok(await call('andi', 'GET', '/api/documents?size=200&q=pengangkatan'), 'viewer list').total, 0);
    assert.equal((await call('agus', 'GET', `/api/documents/${sk.id}`)).status, 200, 'approver terkait dapat melihat');
    const up = ok(await call('rudi' in sessions ? 'rudi' : 'admin', 'POST', `/api/documents/${sk.id}/attachments`, { filename: 'rahasia.txt', mime: 'text/plain', data: Buffer.from('rahasia').toString('base64') }), 'upload');
    assert.equal((await call('andi', 'GET', `/api/attachments/${up.attachment_id}`)).status, 403, 'lampiran dokumen terbatas terlindungi');
    const f = await call('agus', 'GET', `/api/attachments/${up.attachment_id}`);
    assert.equal(f.status, 200);
    assert.equal(f.data.toString(), 'rahasia');
    assert.equal((await fetch(base + '/api/documents')).status, 401, 'tanpa login ditolak');
  });

  await t.test('ekspor Excel & CSV, dashboard, laporan', async () => {
    const x = await call('admin', 'GET', '/api/documents/export?format=xlsx');
    assert.equal(x.status, 200);
    assert.equal(x.data.subarray(0, 2).toString(), 'PK');
    const c = await call('admin', 'GET', `/api/documents/export?format=csv&q=${encodeURIComponent(docNo)}`);
    assert.ok(c.data.toString().includes(docNo));
    const d = ok(await call('admin', 'GET', '/api/dashboard'), 'dashboard');
    assert.ok(d.cards.active.length > 0 && d.cards.transit.length >= 1 && d.cards.overdue.length >= 1);
    assert.ok(d.followup.length > 0);
    const rep = ok(await call('admin', 'GET', '/api/reports?from=2026-01-01&to=2026-12-31'), 'laporan');
    assert.ok(rep.totals.completed.includes(id), 'angka laporan dapat ditelusuri ke dokumen');
  });

  await t.test('data tetap tersimpan setelah server dimulai ulang', async () => {
    const before = await detail('rina', id);
    await stop();
    await start();
    await login('rina');
    const after = await detail('rina', id);
    assert.equal(after.doc.status, 'archived');
    assert.equal(after.events.length, before.events.length);
    assert.equal(after.dispositions.length, 3);
    const list = ok(await call('rina', 'GET', '/api/documents?size=200'), 'list');
    assert.equal(list.rows.filter((r) => r.doc_no === docNo).length, 1, 'seed tidak dijalankan ulang');
  });

  await stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
