"use strict";
/* Transaksi modal, penarikan, riwayat, dan kalkulator penarikan. */

function tabelTransaksi(list, { aksi = true } = {}) {
  const baris = list.map((t) => `<tr>
    <td>${fTgl(t.tanggal, true)}</td><td><a href="#/investor/${t.investor_id}">${esc(t.investor_nama)}</a></td><td>${lencanaJenis(t.jenis)}</td>
    <td class="kanan angka ${t.jenis === "penarikan" ? "" : warnaAngka(t.jumlah_usd)}">${t.jenis === "penarikan" ? "- " : ""}${fUsd(t.jumlah_usd)}</td>
    <td class="kanan angka">${fIdr(t.kurs)}</td>
    <td class="kanan angka">${t.jenis === "penarikan" ? `<b>${fIdr(t.bersih_idr_diterima)}</b><div class="kecil">diterima bersih</div>` : fIdr(t.nilai_idr)}</td>
    <td>${esc(t.catatan)}</td>
    ${aksi ? `<td><div class="aksi" style="flex-wrap:nowrap"><button class="kecil-t" data-ubah="${t.id}">Edit</button><button class="kecil-t bahaya" data-hapus-trx="${t.id}">Hapus</button></div></td>` : ""}</tr>`);
  return tabel([{ t: "Tanggal" }, { t: "Investor" }, { t: "Jenis" }, { t: "Jumlah USD", kanan: 1 }, { t: "Kurs", kanan: 1 }, { t: "Nilai Rupiah", kanan: 1 }, { t: "Catatan" }, ...(aksi ? [{ t: "Aksi" }] : [])], baris, { kosong: "Belum ada transaksi." });
}
function pasangAksiTransaksi(root, list) {
  $$("[data-ubah]", root).forEach((b) => (b.onclick = () => dialogUbahTransaksi(list.find((t) => t.id == b.dataset.ubah))));
  $$("[data-hapus-trx]", root).forEach((b) => (b.onclick = async () => {
    const t = list.find((x) => x.id == b.dataset.hapusTrx);
    const ya = await konfirmasi("Hapus transaksi?", `${esc(t.jenis_nama)} ${fUsd(t.jumlah_usd)} milik <b>${esc(t.investor_nama)}</b> tanggal ${fTgl(t.tanggal)} akan dihapus dan saldo investor dihitung ulang.`, { tombol: "Ya, hapus", bahaya: true });
    if (!ya) return;
    try { const r = await DEL(`/api/transaksi/${t.id}`); toast(r.pesan, "ok"); navigasi(); } catch (e) { galat(e); }
  }));
}
function dialogUbahTransaksi(t) {
  const d = dialog(`<h2>Edit ${esc(t.jenis_nama)}</h2><p class="kecil" style="margin:-6px 0 12px">Investor: <b>${esc(t.investor_nama)}</b>${t.jenis === "penarikan" ? " · biaya dihitung ulang memakai pengaturan saat ini" : ""}</p>
    <form id="f-ubah" class="form-grid" novalidate>
      <div><label>Tanggal</label><input type="date" name="tanggal" value="${t.tanggal}" max="${hariIni()}" required></div>
      <div><label>Jumlah USD</label><input type="number" step="any" inputmode="decimal" name="jumlah_usd" value="${t.jumlah_usd}" required></div>
      <div><label>Kurs USD/Rupiah</label><input type="number" step="any" inputmode="decimal" name="kurs" value="${t.kurs}" required></div>
      <div class="penuh"><label>Catatan</label><textarea name="catatan" maxlength="500">${esc(t.catatan)}</textarea></div>
      <div id="galat-ubah" class="penuh peringatan merah sembunyi"></div>
      <div class="penuh aksi" style="justify-content:flex-end"><button type="button" id="b-batal">Batal</button><button class="utama-t" type="submit">SIMPAN PERUBAHAN</button></div></form>`);
  $("#b-batal", d).onclick = tutupDialog;
  $("#f-ubah", d).onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await PUT(`/api/transaksi/${t.id}`, dataForm(e.target)); tutupDialog(); toast(r.pesan, "ok"); navigasi(); }
    catch (err) { const g = $("#galat-ubah", d); g.textContent = err.message; g.classList.remove("sembunyi"); }
  };
}

/* ================= TRANSAKSI MODAL ================= */
let _tm = null;
HALAMAN.modal = async () => {
  const [inv, trx] = await Promise.all([api("/api/investor"), api("/api/transaksi")]);
  _tm = { inv: inv.investor, trx: trx.transaksi.filter((t) => t.jenis !== "penarikan") };
  const pre = S.query.get("inv") || "";
  return `<div class="grid k2" style="align-items:start">
    <div class="kartu"><h2>Catat Transaksi Modal</h2>
    ${inv.investor.length ? "" : '<div class="peringatan kuning">Belum ada investor. Tambahkan dulu di menu INVESTOR.</div>'}
    <form id="f-modal" class="form-grid" novalidate>
      <div class="penuh"><label>Investor</label>${pilihInvestor(inv.investor, { pilih: pre })}</div>
      <div><label>Jenis Transaksi</label><select name="jenis" id="m-jenis"><option value="tambahan">Tambahan Modal</option><option value="penyesuaian">Penyesuaian</option><option value="modal_awal">Modal Awal</option></select></div>
      <div><label>Tanggal</label><input type="date" name="tanggal" value="${hariIni()}" max="${hariIni()}" required></div>
      <div><label>Jumlah USD</label><input type="number" step="any" inputmode="decimal" name="jumlah_usd" id="m-jumlah" required></div>
      <div><label>Kurs USD/Rupiah</label><input type="number" step="any" inputmode="decimal" name="kurs" value="${S.kurs}" id="m-kurs" required></div>
      <div class="penuh"><div class="bantuan" id="m-nilai">Nilai Rupiah dihitung otomatis saat disimpan.</div></div>
      <div class="penuh"><label>Catatan</label><textarea name="catatan" maxlength="500"></textarea></div>
      <div class="penuh bantuan" id="m-info"></div>
      <div id="galat-modal" class="penuh peringatan merah sembunyi"></div>
      <div class="penuh"><button class="utama-t" type="submit" style="width:100%">SIMPAN TRANSAKSI</button></div></form></div>
    <div class="kartu"><h2>Cara Kerja</h2><ol class="langkah">
      <li><b>Modal Awal</b> dicatat sekali saat investor ditambahkan.</li>
      <li><b>Tambahan Modal</b> ikut dihitung keuntungannya mulai tanggal transaksi.</li>
      <li><b>Penyesuaian</b> mengubah saldo (boleh negatif) tanpa dihitung sebagai modal disetor. Pakai untuk koreksi.</li>
      <li>Setelah disimpan, saldo investor otomatis dihitung ulang.</li></ol></div></div>
  <div class="kartu"><h2>Daftar Transaksi Modal</h2><div id="tabel-modal">${tabelTransaksi(_tm.trx)}</div></div>`;
};
HALAMAN.modal.setelah = async () => {
  pasangAksiTransaksi($("#tabel-modal"), _tm.trx);
  const info = () => {
    const j = $("#m-jenis").value;
    $("#m-info").textContent = j === "modal_awal" ? "Setiap investor hanya punya satu Modal Awal, yang dicatat saat investor ditambahkan. Untuk mengubahnya, tekan Edit pada daftar di bawah." : j === "penyesuaian" ? "Isi angka negatif untuk mengurangi saldo (misalnya koreksi kesalahan input)." : "";
    const u = parseFloat($("#m-jumlah").value), k = parseFloat($("#m-kurs").value);
    $("#m-nilai").textContent = u && k ? `Perkiraan nilai Rupiah: ${fIdr(u * k)}` : "Nilai Rupiah dihitung otomatis saat disimpan.";
  };
  ["m-jenis", "m-jumlah", "m-kurs"].forEach((id) => $("#" + id).addEventListener("input", info)); info();
  $("#f-modal").onsubmit = async (e) => {
    e.preventDefault();
    const g = $("#galat-modal"); g.classList.add("sembunyi");
    try { const r = await POST("/api/transaksi/modal", dataForm(e.target)); toast(r.pesan, "ok"); navigasi(); }
    catch (err) { g.textContent = err.message; g.classList.remove("sembunyi"); }
  };
};

/* ================= PRATINJAU PENARIKAN (dipakai PENARIKAN & KALKULATOR) ================= */
function pasangPratinjau(root, daftarInv, { simpanLabel, setelahSimpan, tanggalTetap = false }) {
  const f = $("form", root), panel = $("#panel-rincian", root), tombol = $("#b-simpan", root);
  let terakhir = null, timer = null, nomor = 0;
  async function hitung() {
    const data = dataForm(f);
    if (!data.investor_id) { panel.innerHTML = '<div class="kosong">Pilih investor untuk melihat rincian.</div>'; tombol.disabled = true; return; }
    if (!(parseFloat(data.jumlah_usd) > 0)) { panel.innerHTML = '<div class="kosong">Isi Jumlah Penarikan USD untuk melihat rincian biaya.</div>'; tombol.disabled = true; terakhir = null; await ambilTersedia(data); return; }
    const n = ++nomor;
    try {
      const p = await POST("/api/penarikan/pratinjau", data);
      if (n !== nomor) return;
      terakhir = p;
      panel.innerHTML = (p.pesan ? `<div class="peringatan merah"><b>Perhatian.</b> ${esc(p.pesan)}</div>` : "") + hasilPratinjau(p);
      tombol.disabled = !p.bisa_disimpan;
    } catch (e) {
      if (n !== nomor) return;
      terakhir = null; tombol.disabled = true;
      panel.innerHTML = `<div class="peringatan merah">${esc(e.message)}</div>`;
    }
  }
  async function ambilTersedia(data) {
    try {
      const p = await POST("/api/penarikan/pratinjau", { ...data, jumlah_usd: 1 });
      $("#tersedia", root).innerHTML = `Saldo tersedia untuk ditarik pada ${fTgl(p.tanggal)}: <b>${fUsd(p.saldo_tersedia_usd)}</b>`;
      $("#tersedia", root).dataset.nilai = p.saldo_tersedia_usd;
    } catch (e) { $("#tersedia", root).textContent = ""; }
  }
  const tunda = () => { clearTimeout(timer); timer = setTimeout(hitung, 250); };
  $$("input, select", f).forEach((el) => el.addEventListener("input", tunda));
  $$("select", f).forEach((el) => el.addEventListener("change", tunda));
  const semua = $("#b-semua", root);
  if (semua) semua.onclick = async () => {
    const data = dataForm(f);
    if (!data.investor_id) return toast("Pilih investor terlebih dahulu.", "galat");
    await ambilTersedia(data);
    const v = parseFloat($("#tersedia", root).dataset.nilai || 0);
    if (!(v > 0)) return toast("Tidak ada saldo yang dapat ditarik pada tanggal ini.", "galat");
    f.jumlah_usd.value = v; hitung();
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!terakhir || !terakhir.bisa_disimpan) return toast("Periksa rincian penarikan terlebih dahulu.", "galat");
    const r = terakhir.rincian;
    const ya = await konfirmasi(simpanLabel, `Simpan penarikan <b>${fUsd(r.jumlah_kotor_usd)}</b> untuk <b>${esc(terakhir.investor_nama)}</b> tanggal ${fTgl(terakhir.tanggal)}?<br>Nilai bersih Rupiah yang diterima: <b>${fIdr(r.bersih_idr_diterima)}</b>. Saldo investor akan berkurang.`, { tombol: "Ya, simpan" });
    if (!ya) return;
    tombol.disabled = true;
    try { const h = await POST("/api/penarikan", dataForm(f)); toast(h.pesan, "ok"); setelahSimpan(); }
    catch (err) { toast(err.message, "galat"); panel.insertAdjacentHTML("afterbegin", `<div class="peringatan merah">${esc(err.message)}</div>`); tombol.disabled = false; }
  };
  hitung();
}
function hasilPratinjau(p) {
  return `<div class="rincian">
    <div class="b"><span>Saldo tersedia pada ${fTgl(p.tanggal, true)}</span><span>${fUsd(p.saldo_tersedia_usd)}</span></div></div>
    ${rincianPenarikan(p.rincian)}
    <div class="rincian" style="margin-top:10px"><div class="b"><span>Saldo investor setelah penarikan</span><span>${p.saldo_sesudah_usd === null ? "-" : fUsd(p.saldo_sesudah_usd)}</span></div></div>`;
}

/* ================= PENARIKAN ================= */
let _pn = null;
HALAMAN.penarikan = async () => {
  const [inv, trx] = await Promise.all([api("/api/investor"), api("/api/transaksi?jenis=penarikan")]);
  _pn = { trx: trx.transaksi, inv: inv.investor };
  const pre = S.query.get("inv") || "";
  return `<div class="grid k2" style="align-items:start">
    <div class="kartu"><h2>Catat Penarikan</h2>
      <form id="f-tarik" class="form-grid" novalidate>
        <div class="penuh"><label>Nama Investor</label>${pilihInvestor(inv.investor, { pilih: pre })}</div>
        <div><label>Tanggal</label><input type="date" name="tanggal" value="${hariIni()}" max="${hariIni()}" required></div>
        <div><label>Kurs USD/Rupiah</label><input type="number" step="any" inputmode="decimal" name="kurs" value="${S.kurs}" required></div>
        <div class="penuh"><label>Jumlah Penarikan (USD)</label><input type="number" step="any" min="0" inputmode="decimal" name="jumlah_usd" placeholder="Contoh: 100" required>
          <div class="bantuan" id="tersedia"></div></div>
        <div class="penuh"><button type="button" class="kecil-t" id="b-semua">Tarik semua saldo tersedia</button></div>
        <div class="penuh"><label>Catatan</label><textarea name="catatan" maxlength="500"></textarea></div>
        <div class="penuh"><button class="sukses" id="b-simpan" type="submit" style="width:100%" disabled>SIMPAN PENARIKAN</button></div></form></div>
    <div class="kartu"><h2>Rincian Biaya</h2><div id="panel-rincian"><div class="kosong">Pilih investor dan isi jumlah penarikan.</div></div></div></div>
  <div class="kartu"><h2>Riwayat Penarikan</h2><div id="tabel-tarik">${tabelTransaksi(_pn.trx)}</div></div>`;
};
HALAMAN.penarikan.setelah = async () => {
  pasangAksiTransaksi($("#tabel-tarik"), _pn.trx);
  pasangPratinjau($("#isi"), _pn.inv, { simpanLabel: "Simpan penarikan?", setelahSimpan: () => navigasi() });
};

/* ================= KALKULATOR PENARIKAN ================= */
HALAMAN.kalkulator = async () => {
  const inv = await api("/api/investor");
  return `<div class="peringatan biru"><b>Hanya simulasi.</b> Kalkulator ini tidak mengubah data apa pun sampai Anda menekan <b>SIMPAN SEBAGAI TRANSAKSI</b>.</div>
  <div class="grid k2" style="align-items:start">
    <div class="kartu"><h2>Hitung Penarikan</h2>
      <form id="f-kalk" class="form-grid" novalidate>
        <div class="penuh"><label>Investor</label>${pilihInvestor(inv.investor, { pilih: S.query.get("inv") || "" })}</div>
        <div><label>Jumlah Penarikan (USD)</label><input type="number" step="any" min="0" inputmode="decimal" name="jumlah_usd" required></div>
        <div><label>Kurs USD/Rupiah</label><input type="number" step="any" inputmode="decimal" name="kurs" value="${S.kurs}" required></div>
        <input type="hidden" name="tanggal" value="${hariIni()}">
        <div class="penuh bantuan" id="tersedia"></div>
        <div class="penuh"><button type="button" class="kecil-t" id="b-semua">Hitung seluruh saldo tersedia</button></div>
        <div class="penuh"><button class="sukses" id="b-simpan" type="submit" style="width:100%" disabled>SIMPAN SEBAGAI TRANSAKSI</button></div></form></div>
    <div class="kartu"><h2>Hasil Perhitungan</h2><div id="panel-rincian"><div class="kosong">Pilih investor dan isi jumlah penarikan.</div></div></div></div>`;
};
HALAMAN.kalkulator.setelah = async () => {
  pasangPratinjau($("#isi"), null, { simpanLabel: "Simpan sebagai transaksi?", setelahSimpan: () => { location.hash = "#/riwayat"; } });
};

/* ================= RIWAYAT TRANSAKSI ================= */
let _rw = null;
const FR = { investor_id: "", dari: "", sampai: "", jenis: "", q: "" };
HALAMAN.riwayat = async () => {
  const inv = await api("/api/investor");
  _rw = { inv: inv.investor };
  return `<div class="kartu"><div class="filter">
      <div><label>Investor</label>${pilihInvestor(inv.investor, { nama: "investor_id", semua: true, pilih: FR.investor_id, id: "r-inv" })}</div>
      <div><label>Dari Tanggal</label><input type="date" id="r-dari" value="${FR.dari}"></div>
      <div><label>Sampai Tanggal</label><input type="date" id="r-sampai" value="${FR.sampai}"></div>
      <div><label>Jenis Transaksi</label><select id="r-jenis"><option value="">Semua</option><option value="modal_awal">Modal Awal</option><option value="tambahan">Tambahan Modal</option><option value="penarikan">Penarikan</option><option value="penyesuaian">Penyesuaian</option></select></div>
      <div style="flex:2 1 220px"><label>Cari (nama, kode, catatan)</label><input type="search" id="r-q" placeholder="Ketik untuk mencari…" value="${esc(FR.q)}"></div></div>
    <div class="judul-kartu" style="margin-bottom:10px"><span class="kecil" id="r-jumlah"></span>
      <div class="aksi"><a class="tombol kecil-t" href="/api/cadangan/csv?tabel=transaksi">Unduh CSV</a><button class="kecil-t" id="r-reset">Atur Ulang</button></div></div>
    <div id="r-tabel"></div></div>`;
};
HALAMAN.riwayat.setelah = async () => {
  $("#r-jenis").value = FR.jenis;
  let timer = null;
  const muat = async () => {
    const p = new URLSearchParams();
    Object.entries(FR).forEach(([k, v]) => v && p.set(k, v));
    try {
      const r = await api("/api/transaksi?" + p);
      $("#r-tabel").innerHTML = tabelTransaksi(r.transaksi);
      $("#r-jumlah").textContent = `${r.transaksi.length} transaksi`;
      pasangAksiTransaksi($("#r-tabel"), r.transaksi);
    } catch (e) { galat(e); }
  };
  const ikat = (id, kunci, tunda = false) => $("#" + id).addEventListener(tunda ? "input" : "change", (e) => { FR[kunci] = e.target.value.trim(); if (tunda) { clearTimeout(timer); timer = setTimeout(muat, 250); } else muat(); });
  ikat("r-inv", "investor_id"); ikat("r-dari", "dari"); ikat("r-sampai", "sampai"); ikat("r-jenis", "jenis"); ikat("r-q", "q", true);
  $("#r-reset").onclick = () => { Object.keys(FR).forEach((k) => (FR[k] = "")); navigasi(); };
  await muat();
};
