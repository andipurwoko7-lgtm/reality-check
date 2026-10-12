'use strict';
// Data contoh berlabel "Demo". Seluruh dokumen demo dibuat melalui fungsi service yang sama
// dengan aplikasi (kirim, terima, approval, tanda tangan, arsip), sehingga riwayat & posisinya konsisten.
const { wibDate } = require('./service');

const H = 3600000, D = 24 * H;

function seedIfEmpty(svc, nowIso) {
  if (svc.get('SELECT COUNT(*) c FROM users').c) return false;
  const now = Date.parse(nowIso);
  const iso = (ms) => new Date(Math.min(ms, now - 5 * 60000)).toISOString();
  // waktu WIB: N hari lalu pukul hh:mm
  const at = (daysAgo, hh = 9, mm = 0) => {
    const d = wibDate(new Date(now - daysAgo * D).toISOString());
    return iso(Date.parse(`${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`));
  };
  const plus = (t, hours) => iso(Date.parse(t) + hours * H);
  const day = (offset) => wibDate(new Date(now + offset * D).toISOString());

  const sys = { now: nowIso, user: { id: 0, name: 'Sistem', role: 'admin' }, demo: true, system: true };
  svc.tx(() => {
    const depts = [
      ['ADM', 'Administrasi Umum'], ['FIN', 'Keuangan (Finance)'], ['HKM', 'Hukum & Kepatuhan'], ['DIR', 'Direksi'],
      ['ARS', 'Pengarsipan'], ['PRY', 'Proyek & Teknik'], ['SDM', 'Sumber Daya Manusia'], ['SPI', 'Satuan Pengawasan Intern'],
    ];
    for (const [code, name] of depts) svc.saveDept(sys, { code, name });
  });
  const dept = Object.fromEntries(svc.all('SELECT id, code FROM departments').map((d) => [d.code, d.id]));
  const users = [
    ['admin', 'Administrator Sistem', 'Administrator', 'admin', null],
    ['rina', 'Rina Wulandari', 'Staf Administrasi', 'staff', 'ADM'],
    ['budi', 'Budi Santoso', 'Kepala Bagian Administrasi', 'approver', 'ADM'],
    ['sari', 'Sari Dewi', 'Staf Keuangan', 'staff', 'FIN'],
    ['hendra', 'Hendra Gunawan', 'Manajer Keuangan', 'approver', 'FIN'],
    ['dimas', 'Dimas Pratama', 'Staf Hukum', 'staff', 'HKM'],
    ['lina', 'Lina Marlina', 'Kepala Hukum & Kepatuhan', 'approver', 'HKM'],
    ['maya', 'Maya Anggraini', 'Sekretaris Direksi', 'staff', 'DIR'],
    ['agus', 'Agus Setiawan', 'Direktur Keuangan & Umum', 'approver', 'DIR'],
    ['wati', 'Wati Susanti', 'Staf Pengarsipan', 'staff', 'ARS'],
    ['yusuf', 'Yusuf Hakim', 'Koordinator Arsip', 'approver', 'ARS'],
    ['fajar', 'Fajar Nugroho', 'Staf Administrasi Proyek', 'staff', 'PRY'],
    ['tono', 'Tono Wijaya', 'Kepala Proyek', 'approver', 'PRY'],
    ['rudi', 'Rudi Hartono', 'Staf SDM', 'staff', 'SDM'],
    ['nisa', 'Nisa Rahmawati', 'Kepala SDM', 'approver', 'SDM'],
    ['andi', 'Andi Saputra', 'Auditor Internal', 'viewer', 'SPI'],
  ];
  svc.tx(() => {
    for (const [username, name, title, role, d] of users) {
      svc.saveUser(sys, { username, name, title, role, department_id: d ? dept[d] : null, password: 'demo123', active: true });
    }
  });
  const U = Object.fromEntries(svc.all('SELECT * FROM users').map((u) => [u.username, u]));
  const ctx = (username, t) => ({ user: { id: U[username].id, name: U[username].name, role: U[username].role, department_id: U[username].department_id }, now: t, demo: true, system: true });

  const types = [
    ['PP', 'Permohonan Pembayaran', [['Verifikasi Administrasi', 'ADM', 1], ['Kepala Departemen', 0, 2], ['Finance', 'FIN', 2], ['Direktur', 'DIR', 2], ['Pengarsipan', 'ARS', 1]],
      [['Manajer Keuangan', 'hendra'], ['Direktur Keuangan & Umum', 'agus']]],
    ['KTR', 'Kontrak / Perjanjian', [['Kepala Departemen', 0, 2], ['Hukum', 'HKM', 3], ['Finance', 'FIN', 2], ['Direktur', 'DIR', 2], ['Pengarsipan', 'ARS', 1]],
      [['Kepala Hukum & Kepatuhan (paraf)', 'lina'], ['Direktur Keuangan & Umum', 'agus']]],
    ['MI', 'Memo Internal', [['Kepala Departemen', 0, 1], ['Direktur', 'DIR', 2]], []],
    ['SK', 'Surat Keputusan Kepegawaian', [['Kepala SDM', 'SDM', 2], ['Direktur', 'DIR', 3]], [['Direktur Keuangan & Umum', 'agus']]],
    ['LAP', 'Laporan Keuangan / Manajemen', [['Kepala Departemen', 0, 2], ['Finance', 'FIN', 3], ['Direktur', 'DIR', 3]],
      [['Manajer Keuangan', 'hendra'], ['Direktur Keuangan & Umum', 'agus']]],
    ['BAST', 'Berita Acara Serah Terima', [['Kepala Departemen', 0, 2], ['Hukum', 'HKM', 2], ['Direktur', 'DIR', 2], ['Pengarsipan', 'ARS', 1]],
      [['Kepala Proyek', 'tono'], ['Direktur Keuangan & Umum', 'agus']]],
  ];
  svc.tx(() => {
    for (const [code, name, flow, signers] of types) {
      svc.saveType(sys, {
        code, name,
        flow: flow.map(([n, d, sla]) => ({ name: n, dept_id: d === 0 ? 0 : dept[d], sla_days: sla })),
        signers: signers.map(([role_label, u]) => ({ role_label, signer_user_id: U[u].id })),
      });
    }
  });
  const T = Object.fromEntries(svc.all('SELECT * FROM doc_types').map((t) => [t.code, { ...t, flow: JSON.parse(t.flow), signers: JSON.parse(t.signers) }]));

  // ---------- helper alur ----------
  const staffOf = (deptId) => {
    const all = Object.values(U).filter((u) => u.department_id === deptId && u.role !== 'viewer');
    return (all.find((u) => u.role === 'staff') || all[0]).username;
  };
  const approverOf = (stage) => (stage.approver_user_id ? Object.values(U).find((u) => u.id === stage.approver_user_id)
    : Object.values(U).find((u) => u.department_id === stage.dept_id && u.role === 'approver')).username;
  const docRow = (id) => svc.get('SELECT * FROM documents WHERE id=?', id);
  const waitingStage = (id) => { const d = docRow(id); return svc.get("SELECT * FROM approval_stages WHERE document_id=? AND round=? AND status='waiting'", id, d.current_round); };
  let ekspedisi = 1100;

  function create(username, t, typeCode, data) {
    const type = T[typeCode];
    const { id } = svc.createDocument(ctx(username, t), {
      doc_no: svc.nextDocNo(U[username].department_id, type.id, t), type_id: type.id, origin_dept_id: U[username].department_id, creator_name: U[username].name, priority: 'normal', media: 'fisik',
      access_level: 'internal', loc_building: 'Gedung Kantor Pusat', loc_room: 'Lt. 3 – Ruang Administrasi', loc_cabinet: 'Lemari 2', loc_shelf: 'Rak B', loc_folder: 'Map Proses Berjalan',
      stages: type.flow, signers: type.signers, ...data,
    });
    return id;
  }
  function moveTo(id, toDept, t, instruction, receive = true, receiveAfter = 2) {
    const d = docRow(id);
    const { disposition_id } = svc.sendDisposition(ctx(staffOf(d.holder_dept_id), t), id, {
      to_dept_id: toDept, instruction, follow_up_due: day(3), handover_proof: `Buku ekspedisi No. ${ekspedisi++}`,
    });
    if (!receive) return t;
    const t2 = plus(t, receiveAfter);
    svc.receiveDisposition(ctx(staffOf(toDept), t2), disposition_id, { note: 'Dokumen diterima lengkap.' });
    return t2;
  }
  function advance(id, t, decision = 'approve', note) {
    const st = waitingStage(id);
    const d = docRow(id);
    if (d.media !== 'digital' && d.holder_dept_id !== st.dept_id) t = moveTo(id, st.dept_id, t, `Mohon proses tahap ${st.name}.`);
    t = plus(t, 3);
    svc.decide(ctx(approverOf(st), t), st.id, { decision, note: note || (decision === 'approve' ? 'Sesuai, disetujui.' : undefined) });
    return { t, stage: st };
  }
  function signAll(id, t, limit = 99) {
    const d = docRow(id);
    const sigs = svc.all("SELECT * FROM signatures WHERE document_id=? AND version_no=? AND status='unsigned' ORDER BY seq", id, d.version_no).slice(0, limit);
    for (const s of sigs) {
      t = plus(t, 1);
      const signerUser = Object.values(U).find((u) => u.id === s.signer_user_id);
      svc.sign(ctx(staffOf(d.holder_dept_id), t), s.id, { method: 'basah', evidence: `Tanda tangan basah pada dokumen asli${signerUser ? ' oleh ' + signerUser.name : ''}; dicek oleh sekretariat.` });
    }
    return t;
  }
  function runToApproved(id, t) {
    for (;;) {
      const d = docRow(id);
      if (d.status !== 'in_review') return t;
      const r = advance(id, t);
      t = r.t;
      if (r.stage.dept_id === dept.DIR) t = signAll(id, t);
    }
  }
  function finish(id, t, archiveIt = true) {
    const d = docRow(id);
    t = signAll(id, t);
    svc.complete(ctx(U[Object.keys(U).find((k) => U[k].id === d.created_by)].username, plus(t, 1)), id, { note: 'Seluruh proses selesai.' });
    t = plus(t, 1);
    if (!archiveIt) return t;
    if (docRow(id).holder_dept_id !== dept.ARS) t = moveTo(id, dept.ARS, plus(t, 2), 'Untuk diarsipkan.');
    svc.archive(ctx('wati', plus(t, 1)), id, { loc_building: 'Gedung Arsip', loc_room: 'Ruang Arsip 2', loc_cabinet: 'Lemari 4', loc_shelf: 'Rak C', loc_folder: `Map ${wibDate(t).slice(0, 7)}` });
    return plus(t, 1);
  }
  const lifecycle = (username, startDaysAgo, type, data, archiveIt = true) => {
    const t0 = at(startDaysAgo, 8, 30);
    const id = create(username, t0, type, { doc_date: wibDate(t0), due_date: wibDate(new Date(Date.parse(t0) + 14 * D).toISOString()), ...data });
    svc.submit(ctx(username, plus(t0, 1)), id, {});
    finish(id, runToApproved(id, plus(t0, 2)), archiveIt);
    return id;
  };

  svc.tx(() => {
    // --- riwayat selesai (mengisi tren bulanan) ---
    lifecycle('rina', 250, 'PP', { title: 'Pembayaran termin 2 kontraktor Tower A', description: 'Termin 2 pekerjaan struktur Tower A sesuai progres 45%.' });
    lifecycle('fajar', 215, 'KTR', { title: 'Perjanjian kerja sama pemasaran unit Cluster Asoka', priority: 'penting' });
    lifecycle('rina', 180, 'PP', { title: 'Pembayaran premi asuransi gedung kantor pusat' });
    lifecycle('rina', 150, 'MI', { title: 'Memo penyesuaian jam layanan kantor pemasaran' });
    lifecycle('sari', 120, 'LAP', { title: 'Laporan arus kas Triwulan II', priority: 'penting' });
    lifecycle('fajar', 95, 'BAST', { title: 'BAST unit Blok C-12 Cluster Asoka' });
    lifecycle('fajar', 70, 'PP', { title: 'Pembayaran pekerjaan pematangan lahan Tahap 3', priority: 'mendesak' });
    lifecycle('rudi', 45, 'SK', { title: 'SK mutasi staf pemasaran wilayah timur', access_level: 'terbatas' });
    lifecycle('sari', 33, 'LAP', { title: 'Laporan realisasi anggaran Agustus' });
    lifecycle('fajar', 8, 'PP', { title: 'Pembayaran retensi pekerjaan infrastruktur Cluster Bougenville' });
    lifecycle('rina', 4, 'MI', { title: 'Memo penggunaan ruang rapat lantai 5' }, false);

    // --- ditolak ---
    {
      const t0 = at(26, 9);
      const id = create('rina', t0, 'PP', { title: 'Uang muka perjalanan dinas survei lahan Makassar', doc_date: wibDate(t0), due_date: day(-12) });
      svc.submit(ctx('rina', plus(t0, 1)), id, {});
      let t = advance(id, plus(t0, 2)).t;
      t = advance(id, t).t;
      advance(id, plus(t, 20), 'reject', 'Anggaran perjalanan dinas Q4 sudah habis; ajukan kembali pada periode anggaran berikutnya.');
    }

    // --- aktif: menunggu keputusan Finance (sudah diterima Finance) ---
    {
      const t0 = at(2, 8);
      const id = create('rina', t0, 'PP', { title: 'Pembayaran tagihan listrik & air kantor pusat Oktober', doc_date: day(-2), due_date: day(5), priority: 'penting',
        description: 'Tagihan PLN dan PDAM periode Oktober untuk gedung kantor pusat.' });
      svc.submit(ctx('rina', plus(t0, 1)), id, {});
      let t = advance(id, plus(t0, 1)).t;
      t = advance(id, plus(t, 1)).t;
      moveTo(id, dept.FIN, at(1, 10), 'Mohon verifikasi dan persetujuan pembayaran.', true, 1);
    }
    // --- aktif: dalam pengiriman ke Hukum, belum dikonfirmasi ---
    {
      const t0 = at(3, 8);
      const id = create('fajar', t0, 'KTR', { title: 'Addendum kontrak pekerjaan struktur Tower B', doc_date: day(-3), due_date: day(8), priority: 'mendesak',
        description: 'Addendum perpanjangan waktu 60 hari dan penyesuaian nilai kontrak.', loc_room: 'Lt. 2 – Ruang Proyek' });
      svc.submit(ctx('fajar', plus(t0, 1)), id, {});
      const t = advance(id, plus(t0, 2)).t;
      moveTo(id, dept.HKM, at(2, 14), 'Mohon review klausul perpanjangan waktu dan denda keterlambatan.', false);
      void t;
    }
    // --- aktif: tertahan lama di Direksi & melewati tenggat ---
    {
      const t0 = at(20, 9);
      const id = create('fajar', t0, 'PP', { title: 'Pembayaran termin 3 kontraktor Tower B', doc_date: day(-20), due_date: day(-3), priority: 'mendesak' });
      svc.submit(ctx('fajar', plus(t0, 1)), id, {});
      let t = advance(id, plus(t0, 2)).t;
      t = advance(id, plus(t, 4)).t;
      t = advance(id, plus(t, 6)).t;
      moveTo(id, dept.DIR, at(9, 11), 'Mohon persetujuan Direktur.', true, 2);
    }
    // --- aktif: direvisi lalu diajukan ulang (versi 2), menunggu Direktur ---
    {
      const t0 = at(10, 8);
      const id = create('sari', t0, 'LAP', { title: 'Laporan realisasi anggaran September', doc_date: day(-10), due_date: day(4), priority: 'penting', loc_room: 'Lt. 4 – Ruang Keuangan' });
      svc.submit(ctx('sari', plus(t0, 1)), id, {});
      let t = advance(id, plus(t0, 2)).t;
      t = advance(id, plus(t, 3)).t;
      t = advance(id, plus(t, 20), 'revision', 'Lampirkan analisis varians untuk pos biaya pemasaran yang melebihi anggaran >10%.').t;
      t = moveTo(id, dept.FIN, plus(t, 2), 'Dikembalikan untuk revisi sesuai catatan Direktur.');
      svc.upload(ctx('sari', plus(t, 20)), id, { filename: 'analisis-varians-september.txt', mime: 'text/plain', kind: 'dokumen',
        data: Buffer.from('Analisis varians biaya pemasaran September (Demo).\nRealisasi 1,18 M vs anggaran 1,02 M (+15,7%).\nPenyebab: event pameran properti.').toString('base64'), note: 'Lampiran revisi' });
      svc.resubmit(ctx('sari', at(1, 8)), id, { note: 'Menambahkan analisis varians biaya pemasaran sesuai catatan Direktur.' });
      moveTo(id, dept.DIR, at(1, 9), 'Pengajuan ulang setelah revisi.', true, 1);
    }
    // --- aktif: perlu revisi ---
    {
      const t0 = at(5, 13);
      const id = create('rina', t0, 'MI', { title: 'Memo usulan revisi SOP disposisi surat masuk', doc_date: day(-5), due_date: day(6), media: 'keduanya', digital_link: 'https://intranet.contoh.co.id/sop/disposisi-draft' });
      svc.submit(ctx('rina', plus(t0, 1)), id, {});
      let t = advance(id, plus(t0, 2)).t;
      t = moveTo(id, dept.DIR, plus(t, 18), 'Mohon arahan Direktur.');
      t = plus(t, 24);
      svc.decide(ctx('agus', t), waitingStage(id).id, { decision: 'revision', note: 'Tambahkan batas waktu konfirmasi penerimaan maksimal 1×24 jam.' });
      moveTo(id, dept.ADM, plus(t, 2), 'Dikembalikan untuk revisi.');
    }
    // --- aktif: disetujui, menunggu tanda tangan (dokumen terbatas) ---
    {
      const t0 = at(8, 9);
      const id = create('rudi', t0, 'SK', { title: 'SK pengangkatan karyawan tetap angkatan 2026', doc_date: day(-8), due_date: day(3), access_level: 'terbatas', loc_room: 'Lt. 2 – Ruang SDM' });
      svc.submit(ctx('rudi', plus(t0, 1)), id, {});
      const t = advance(id, plus(t0, 2)).t;
      advance(id, plus(t, 5));
    }
    // --- aktif: disetujui, tanda tangan sebagian ---
    {
      const t0 = at(3, 8);
      const id = create('fajar', t0, 'BAST', { title: 'BAST unit Blok A-05 Cluster Bougenville', doc_date: day(-3), due_date: day(2) });
      svc.submit(ctx('fajar', plus(t0, 1)), id, {});
      let t = advance(id, plus(t0, 2)).t;
      t = signAll(id, t, 1);
      t = advance(id, plus(t, 3)).t;
      advance(id, plus(t, 3));
    }
    // --- aktif: digital saja, di tahap Finance, tenggat segera ---
    {
      const t0 = at(1, 8);
      const id = create('dimas', t0, 'KTR', { title: 'Perjanjian sewa ruang kantor pemasaran Surabaya', doc_date: day(-1), due_date: day(1), media: 'digital',
        digital_link: 'https://dms.contoh.co.id/kontrak/sewa-surabaya-2026', loc_building: '', loc_room: '' });
      svc.submit(ctx('dimas', plus(t0, 1)), id, {});
      let t = advance(id, plus(t0, 2)).t;
      advance(id, plus(t, 5));
    }
    // --- aktif: baru diajukan, menunggu verifikasi ADM ---
    {
      const t0 = at(0, 8, 15);
      const id = create('rina', t0, 'PP', { title: 'Pembayaran jasa konsultan pajak Triwulan III', doc_date: day(0), due_date: day(10) });
      svc.submit(ctx('rina', plus(t0, 0.2)), id, {});
    }
    // --- draf ---
    {
      const t0 = at(1, 15);
      create('rina', t0, 'MI', { title: 'Memo pengadaan ATK kuartal IV', doc_date: day(-1), due_date: day(9) });
    }
  });
  svc.scanDeadlines(nowIso, true);
  return true;
}

module.exports = { seedIfEmpty };
