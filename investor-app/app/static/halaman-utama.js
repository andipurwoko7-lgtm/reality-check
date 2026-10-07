"use strict";
/* Dashboard, daftar investor, dan halaman detail investor. */

/* ================= grafik bersama ================= */
function jumlahDeret(g, kunci, kali = 1) {
  const n = g.tanggal.length, out = new Array(n).fill(0);
  g.investor.forEach((i) => i[kunci].forEach((v, k) => { out[k] += (v || 0) * kali; }));
  return out;
}
const akhirDeret = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null && arr[i] !== undefined) return arr[i]; return 0; };
function deretMata(i, nama) {
  // nama: saldo, keuntungan, modal, kekayaan, penarikan_hari, penarikan_kum
  const usd = S.mata === "USD", k = kurs();
  const m = { saldo: [i.saldo_usd, i.saldo_idr], modal: [i.modal_usd, i.modal_idr], kekayaan: [i.kekayaan_usd, i.kekayaan_idr] };
  if (m[nama]) return usd ? m[nama][0] : m[nama][1];
  const dasar = { keuntungan: i.keuntungan_usd, penarikan_hari: i.penarikan_hari_usd, penarikan_kum: i.penarikan_kum_usd }[nama];
  return usd ? dasar : dasar.map((v) => v * k);
}
function jumlahMata(g, nama) {
  const n = g.tanggal.length, out = new Array(n).fill(0);
  g.investor.forEach((i) => deretMata(i, nama).forEach((v, k) => { out[k] += v || 0; }));
  return out;
}
const garis = (label, data, warna, ekstra = {}) => Object.assign({ label, data, borderColor: warna, backgroundColor: warna + "22", borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: false }, ekstra);

function gambarGrafikDashboard(g) {
  const lbl = labelTgl(g.tanggal), mata = S.mata;
  const sumbu = opsiSumbu(mata);
  gambarGrafik("g1", { type: "line", data: { labels: lbl, datasets: [garis("Total Saldo", jumlahMata(g, "saldo"), "#1f6fd6", { fill: true })] }, options: opsiSumbu(mata, { tanpaLegenda: true }) });
  gambarGrafik("g2", { type: "line", data: { labels: lbl, datasets: [garis("Total Keuntungan", jumlahMata(g, "keuntungan"), "#12803c", { fill: true })] }, options: opsiSumbu(mata, { tanpaLegenda: true }) });
  gambarGrafik("g3", { type: "line", data: { labels: lbl, datasets: g.investor.map((i, k) => garis(i.nama, deretMata(i, "saldo"), WARNA[k % WARNA.length])) }, options: sumbu });
  const nama = g.investor.map((i) => i.nama);
  gambarGrafik("g4", { type: "bar", data: { labels: nama, datasets: [
    { label: "Modal Disetor", data: g.investor.map((i) => akhirDeret(deretMata(i, "modal"))), backgroundColor: "#9ec1ee", borderRadius: 6 },
    { label: "Kekayaan Bersih", data: g.investor.map((i) => akhirDeret(deretMata(i, "kekayaan"))), backgroundColor: "#12803c", borderRadius: 6 }] }, options: sumbu });
  const persen = g.investor.map((i) => akhirDeret(i.persen_untung));
  gambarGrafik("g5", { type: "bar", data: { labels: nama, datasets: [{ label: "Persentase Keuntungan", data: persen, backgroundColor: persen.map((v) => (v >= 0 ? "#12803c" : "#c62828")), borderRadius: 6 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fPct(c.parsed.y) } } }, scales: { y: { ticks: { callback: (v) => v + "%" }, grid: { color: "#e9eef5" } }, x: { grid: { display: false } } } } });
  gambarGrafik("g6", { type: "doughnut", data: { labels: nama, datasets: [{ data: g.investor.map((i) => akhirDeret(deretMata(i, "saldo"))), backgroundColor: g.investor.map((_, k) => WARNA[k % WARNA.length]), borderWidth: 2, borderColor: "#fff" }] },
    options: { interaction: { mode: "nearest" }, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${mata === "USD" ? fUsd(c.parsed) : fIdr(c.parsed)}` } } }, cutout: "58%" } });
  gambarGrafik("g7", { data: { labels: lbl, datasets: [
    { type: "bar", label: "Penarikan per Hari", data: jumlahMata(g, "penarikan_hari"), backgroundColor: "#e08a00", borderRadius: 3, yAxisID: "y" },
    { type: "line", label: "Total Penarikan (kumulatif)", data: jumlahMata(g, "penarikan_kum"), borderColor: "#0b2a4a", borderWidth: 2.2, pointRadius: 0, tension: 0.2, yAxisID: "y" }] }, options: sumbu });
}

function gambarGrafikInvestor(g) {
  const i = g.investor[0], lbl = labelTgl(g.tanggal), mata = S.mata, sumbu = opsiSumbu(mata, { tanpaLegenda: true });
  gambarGrafik("gi1", { type: "line", data: { labels: lbl, datasets: [garis("Saldo", deretMata(i, "saldo"), "#1f6fd6", { fill: true })] }, options: sumbu });
  gambarGrafik("gi2", { type: "line", data: { labels: lbl, datasets: [garis("Keuntungan Kumulatif", deretMata(i, "keuntungan"), "#12803c", { fill: true })] }, options: sumbu });
  gambarGrafik("gi3", { data: { labels: lbl, datasets: [
    { type: "bar", label: "Penarikan", data: deretMata(i, "penarikan_hari"), backgroundColor: "#e08a00", borderRadius: 3 },
    { type: "line", label: "Penarikan Kumulatif", data: deretMata(i, "penarikan_kum"), borderColor: "#0b2a4a", borderWidth: 2, pointRadius: 0, tension: 0.2 }] }, options: opsiSumbu(mata) });
  gambarGrafik("gi4", { type: "line", data: { labels: lbl, datasets: [garis("Kekayaan Bersih", deretMata(i, "kekayaan"), "#0b2a4a"), garis("Total Modal", deretMata(i, "modal"), "#9ec1ee", { borderDash: [6, 4] })] }, options: opsiSumbu(mata) });
}

/* ================= DASHBOARD ================= */
const FG = { ids: null, status: "", dari: "", sampai: "", bulan: "", tahun: "" };
let _dash = null;

HALAMAN.dashboard = async () => {
  const d = (_dash = await api("/api/dashboard"));
  const t = d.total, ada = d.investor.length > 0;
  const peringatanSandi = S.user.sandi_awal ? `<div class="peringatan kuning"><b>Ganti kata sandi bawaan.</b> Anda masih memakai kata sandi awal. Buka menu <a href="#/pengaturan">PENGATURAN</a> lalu ganti kata sandi supaya data lebih aman.</div>` : "";
  const baris = d.investor.map((i) => `<tr>
      <td><a href="#/investor/${i.id}" class="tebal">${esc(i.kode)}</a> <span class="kecil">${esc(i.nama)}</span></td>
      <td class="kanan angka">${uang(i.total_modal_usd, i.total_modal_idr)}</td>
      <td class="kanan angka">${uang(i.nilai_total_usd)}</td>
      <td class="kanan angka">${uang(i.total_penarikan_usd)}</td>
      <td class="kanan angka tebal">${uang(i.saldo_usd, i.saldo_idr)}</td>
      <td class="kanan angka">${uang(i.nilai_bersih_cair_usd, i.nilai_bersih_cair_idr)}</td></tr>`);
  const rendah = (x) => x;
  const foot = `<tr><td>TOTAL</td><td class="kanan angka">${uang(t.total_modal_usd, t.total_modal_idr)}</td>
      <td class="kanan angka">${uang(t.total_modal_usd + t.total_keuntungan_usd)}</td><td class="kanan angka">${uang(t.total_penarikan_usd)}</td>
      <td class="kanan angka">${uang(t.total_saldo_usd, t.total_saldo_idr)}</td><td class="kanan angka">${uang(t.nilai_bersih_cair_usd, t.nilai_bersih_cair_idr)}</td></tr>`;
  const detail = d.investor.map((i) => `<tr>
      <td><a href="#/investor/${i.id}" class="tebal">${esc(i.nama)}</a></td>
      <td class="kanan angka">${uang(i.total_modal_usd, i.total_modal_idr)}</td>
      <td class="kanan angka">${uang(i.saldo_usd, i.saldo_idr)}</td>
      <td class="kanan angka ${warnaAngka(i.total_keuntungan_usd)}">${uang(i.total_keuntungan_usd)}</td>
      <td class="kanan angka">${uang(i.total_penarikan_usd)}</td>
      <td class="kanan angka">${uang(i.nilai_bersih_cair_usd, i.nilai_bersih_cair_idr)}</td>
      <td class="kanan angka tebal">${uang(i.kekayaan_usd, i.kekayaan_idr)}</td>
      <td class="kanan angka ${warnaAngka(i.persen_untung)} tebal">${fPctTanda(i.persen_untung)}</td>
      <td>${selTarget(i.titik_impas)}</td><td>${selTarget(i.untung_100)}</td>
      <td>${lencanaStatus(i.warna)}<div class="kecil" style="margin-top:3px">${i.status === "aktif" ? "Aktif" : "Selesai"}</div></td></tr>`);
  const tahunAwal = ada ? Math.min(...d.investor.map((i) => +i.tanggal_mulai.slice(0, 4))) : new Date().getFullYear();
  const tahunIni = +d.tanggal.slice(0, 4);
  HALAMAN.dashboard._meta = { tahunAwal, tahunIni };
  return `${peringatanSandi}
  <div class="grid k5">
    ${kartuRingkas("Saldo Total Saat Ini", uang(t.total_saldo_usd, t.total_saldo_idr), `Posisi per ${fTgl(d.tanggal)}`, "besar")}
    ${kartuRingkas("Total Modal", uang(t.total_modal_usd, t.total_modal_idr), `${t.jumlah_investor} investor`, "besar")}
    ${kartuRingkas("Total Keuntungan", uang(t.total_keuntungan_usd), `Sebelum biaya penarikan`, "besar")}
    ${kartuRingkas("Total Penarikan", uang(t.total_penarikan_usd), `Diterima bersih ${uang(t.uang_diterima_usd, t.uang_diterima_idr)}`, "besar")}
    ${kartuRingkas("Nilai Bersih Jika Dicairkan", uang(t.nilai_bersih_cair_usd, t.nilai_bersih_cair_idr), "Setelah semua biaya", "besar")}
  </div>
  <div class="kartu"><div class="judul-kartu"><h2>POSISI INVESTOR HARI INI</h2><span class="kecil">${fTgl(d.tanggal)} · kurs ${fIdr(S.kurs)}</span></div>
    ${tabel([{ t: "Investor" }, { t: "Modal", kanan: 1 }, { t: "Saldo", kanan: 1 }, { t: "Penarikan", kanan: 1 }, { t: "Sisa Saldo", kanan: 1 }, { t: "Nilai Bersih", kanan: 1 }], baris.map(rendah), { foot, kosong: "Belum ada investor. Tambahkan lewat menu INVESTOR." })}
    <p class="kecil" style="margin:10px 0 0">Saldo = modal + keuntungan (sebelum penarikan). Sisa Saldo = Saldo − Penarikan, yaitu saldo yang masih ada di akun. Nilai Bersih = yang diterima jika Sisa Saldo dicairkan hari ini setelah semua biaya.</p></div>
  <h2 style="margin:6px 0 12px">Ringkasan Portofolio</h2>
  <div class="grid k4">
    ${kartuRingkas("Jumlah Investor", nf(t.jumlah_investor, 0), `${t.jumlah_aktif} aktif`)}
    ${kartuRingkas("Total Modal Disetor USD", fUsd(t.total_modal_usd))}
    ${kartuRingkas("Total Modal Disetor Rupiah", fIdr(t.total_modal_idr))}
    ${kartuRingkas("Total Saldo Saat Ini USD", fUsd(t.total_saldo_usd))}
    ${kartuRingkas("Total Saldo Saat Ini Rupiah", fIdr(t.total_saldo_idr), `Kurs ${fIdr(S.kurs)}`)}
    ${kartuRingkas("Total Keuntungan", uang(t.total_keuntungan_usd), `Keuntungan bersih ${uang(t.untung_bersih_usd, t.untung_bersih_idr)}`, t.total_keuntungan_usd >= 0 ? "hijau-k" : "merah-k")}
    ${kartuRingkas("Total Penarikan", uang(t.total_penarikan_usd), "Jumlah kotor sebelum biaya")}
    ${kartuRingkas("Total Uang Bersih yang Sudah Diterima", uang(t.uang_diterima_usd, t.uang_diterima_idr), "Setelah semua biaya")}
    ${kartuRingkas("Nilai Bersih Jika Seluruh Saldo Dicairkan", uang(t.nilai_bersih_cair_usd, t.nilai_bersih_cair_idr), "Setelah biaya penarikan, konversi, dan transfer")}
    ${kartuRingkas("Persentase Keuntungan Portofolio", `<span class="${warnaAngka(t.persen_untung)}">${fPctTanda(t.persen_untung)}</span>`, "Keuntungan bersih ÷ total modal")}
    ${kartuRingkas("Investor Sudah Titik Impas", `${t.jumlah_titik_impas} <span class="kecil">dari ${t.jumlah_investor}</span>`)}
    ${kartuRingkas("Investor Keuntungan ≥ 100%", `${t.jumlah_untung_100} <span class="kecil">dari ${t.jumlah_investor}</span>`)}
  </div>
  <div class="kartu"><div class="judul-kartu"><h2>Tabel Investor</h2>
    <span class="kecil"><span class="lencana hijau">Hijau</span> target tercapai · <span class="lencana kuning">Kuning</span> mendekati (kekayaan ≥ 80% modal) · <span class="lencana merah">Merah</span> peringatan</span></div>
    ${tabel([{ t: "Nama Investor" }, { t: "Modal Disetor", kanan: 1 }, { t: "Saldo Saat Ini", kanan: 1 }, { t: "Total Keuntungan", kanan: 1 }, { t: "Total Penarikan", kanan: 1 },
      { t: "Nilai Bersih Jika Dicairkan", kanan: 1 }, { t: "Kekayaan Bersih", kanan: 1 }, { t: "Persentase Keuntungan", kanan: 1 }, { t: "Tanggal Titik Impas" }, { t: "Tanggal Keuntungan 100%" }, { t: "Status" }], detail)}</div>
  <div class="kartu"><div class="judul-kartu"><h2>Grafik</h2></div><div id="panel-filter"></div></div>
  <div class="grid k2" id="panel-grafik">
    <div class="kartu"><h2>Perkembangan Total Saldo</h2><div class="grafik"><canvas id="g1"></canvas></div></div>
    <div class="kartu"><h2>Perkembangan Keuntungan</h2><div class="grafik"><canvas id="g2"></canvas></div></div>
    <div class="kartu"><h2>Perbandingan Saldo Investor</h2><div class="grafik"><canvas id="g3"></canvas></div></div>
    <div class="kartu"><h2>Modal vs Kekayaan Bersih</h2><div class="grafik"><canvas id="g4"></canvas></div></div>
    <div class="kartu"><h2>Persentase Keuntungan per Investor</h2><div class="grafik"><canvas id="g5"></canvas></div></div>
    <div class="kartu"><h2>Komposisi Saldo Investor</h2><div class="grafik"><canvas id="g6"></canvas></div></div>
    <div class="kartu" style="grid-column:1/-1"><h2>Total Penarikan dari Waktu ke Waktu</h2><div class="grafik"><canvas id="g7"></canvas></div></div>
  </div>`;
};

function rentangFilter() {
  let dari = FG.dari, sampai = FG.sampai;
  if (FG.tahun) {
    const y = +FG.tahun;
    if (FG.bulan) {
      const m = +FG.bulan, akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
      dari = `${y}-${String(m).padStart(2, "0")}-01`; sampai = `${y}-${String(m).padStart(2, "0")}-${akhir}`;
    } else { dari = `${y}-01-01`; sampai = `${y}-12-31`; }
  } else if (FG.bulan) {
    const y = +hariIni().slice(0, 4), m = +FG.bulan, akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
    dari = `${y}-${String(m).padStart(2, "0")}-01`; sampai = `${y}-${String(m).padStart(2, "0")}-${akhir}`;
  }
  return { dari, sampai };
}

async function muatGrafikDashboard() {
  const { dari, sampai } = rentangFilter();
  const p = new URLSearchParams();
  if (FG.ids && FG.ids.length) p.set("investor_ids", FG.ids.join(","));
  if (FG.status) p.set("status", FG.status);
  if (dari) p.set("dari", dari);
  if (sampai) p.set("sampai", sampai);
  const g = await api("/api/grafik?" + p);
  const panel = $("#panel-grafik");
  if (!g.investor.length || !g.tanggal.length) {
    panel.style.opacity = ".4";
    bersihkanGrafik();
    $("#info-grafik").innerHTML = '<div class="peringatan kuning" style="margin:12px 0 0">Tidak ada data untuk filter ini. Ubah investor, status, atau rentang tanggal.</div>';
    return;
  }
  panel.style.opacity = "1";
  $("#info-grafik").innerHTML = "";
  gambarGrafikDashboard(g);
}

HALAMAN.dashboard.setelah = async () => {
  const { tahunAwal, tahunIni } = HALAMAN.dashboard._meta;
  const d = _dash;
  const tahun = []; for (let y = tahunIni; y >= tahunAwal; y--) tahun.push(y);
  const semuaId = d.investor.map((i) => i.id);
  if (!FG.ids) FG.ids = semuaId.slice();
  FG.ids = FG.ids.filter((id) => semuaId.includes(id));
  $("#panel-filter").innerHTML = `
    <div style="margin-bottom:12px"><label>Investor</label><div class="aksi" id="chips">${d.investor.map((i, k) =>
      `<button type="button" class="chip ${FG.ids.includes(i.id) ? "aktif" : ""}" data-id="${i.id}"><i style="background:${WARNA[k % WARNA.length]}"></i>${esc(i.nama)}</button>`).join("") || '<span class="kecil">Belum ada investor.</span>'}</div></div>
    <div class="filter">
      <div><label>Status Investor</label><select id="f-status"><option value="">Semua</option><option value="aktif">Aktif</option><option value="selesai">Selesai</option></select></div>
      <div><label>Dari Tanggal</label><input type="date" id="f-dari" value="${FG.dari}"></div>
      <div><label>Sampai Tanggal</label><input type="date" id="f-sampai" value="${FG.sampai}"></div>
      <div><label>Bulan</label><select id="f-bulan"><option value="">Semua</option>${BULAN.map((b, i) => `<option value="${i + 1}">${b}</option>`).join("")}</select></div>
      <div><label>Tahun</label><select id="f-tahun"><option value="">Semua</option>${tahun.map((y) => `<option>${y}</option>`).join("")}</select></div>
      <div style="flex:0 0 auto"><button type="button" id="f-reset">Atur Ulang</button></div></div>
    <div class="kecil">Grafik ditampilkan dalam <b>${S.mata === "USD" ? "USD" : "Rupiah"}</b>. Ganti dengan tombol USD / RUPIAH di bagian atas. Sentuh atau arahkan kursor ke grafik untuk melihat nilainya.</div>
    <div id="info-grafik"></div>`;
  $("#f-status").value = FG.status; $("#f-bulan").value = FG.bulan; $("#f-tahun").value = FG.tahun;
  const ulang = () => muatGrafikDashboard().catch(galat);
  $$("#chips .chip").forEach((b) => (b.onclick = () => {
    const id = +b.dataset.id;
    FG.ids = FG.ids.includes(id) ? FG.ids.filter((x) => x !== id) : FG.ids.concat(id);
    b.classList.toggle("aktif"); ulang();
  }));
  $("#f-status").onchange = (e) => { FG.status = e.target.value; ulang(); };
  $("#f-dari").onchange = (e) => { FG.dari = e.target.value; FG.bulan = FG.tahun = ""; $("#f-bulan").value = $("#f-tahun").value = ""; ulang(); };
  $("#f-sampai").onchange = (e) => { FG.sampai = e.target.value; FG.bulan = FG.tahun = ""; $("#f-bulan").value = $("#f-tahun").value = ""; ulang(); };
  $("#f-bulan").onchange = (e) => { FG.bulan = e.target.value; FG.dari = FG.sampai = ""; $("#f-dari").value = $("#f-sampai").value = ""; ulang(); };
  $("#f-tahun").onchange = (e) => { FG.tahun = e.target.value; FG.dari = FG.sampai = ""; $("#f-dari").value = $("#f-sampai").value = ""; ulang(); };
  $("#f-reset").onclick = () => { Object.assign(FG, { ids: null, status: "", dari: "", sampai: "", bulan: "", tahun: "" }); navigasi(); };
  await muatGrafikDashboard();
};

/* ================= INVESTOR ================= */
function dialogInvestor(inv, kodeBaru = "") {
  const baru = !inv;
  const d = dialog(`<h2>${baru ? "Tambah Investor" : "Edit Investor"}</h2>
    <form id="f-inv" class="form-grid" novalidate>
      <div><label>Kode Investor</label><input name="kode" value="${esc(inv ? inv.kode : kodeBaru)}" maxlength="20" required></div>
      <div><label>Nama Investor</label><input name="nama" value="${esc(inv ? inv.nama : "")}" maxlength="100" required placeholder="Contoh: Investor D"></div>
      <div><label>Tanggal Mulai</label><input type="date" name="tanggal_mulai" value="${inv ? inv.tanggal_mulai : hariIni()}" max="${hariIni()}" required></div>
      <div><label>Modal Awal (USD)</label><input type="number" step="any" min="0" inputmode="decimal" name="modal_awal_usd" value="${inv ? inv.modal_awal_usd : ""}" required></div>
      ${baru ? `<div><label>Kurs USD/Rupiah</label><input type="number" step="any" min="0" inputmode="decimal" name="kurs" value="${S.kurs}"><div class="bantuan">Dipakai untuk nilai Rupiah modal awal.</div></div>` : ""}
      <div><label>Status</label><select name="status"><option value="aktif" ${!inv || inv.status === "aktif" ? "selected" : ""}>Aktif</option><option value="selesai" ${inv && inv.status === "selesai" ? "selected" : ""}>Selesai</option></select></div>
      <div class="penuh"><label>Catatan</label><textarea name="catatan" maxlength="1000">${esc(inv ? inv.catatan : "")}</textarea></div>
      <div id="galat-inv" class="penuh peringatan merah sembunyi"></div>
      <div class="penuh aksi" style="justify-content:flex-end"><button type="button" id="b-batal">Batal</button><button class="utama-t" type="submit">SIMPAN</button></div>
    </form>`);
  $("#b-batal", d).onclick = tutupDialog;
  $("#f-inv", d).onsubmit = async (e) => {
    e.preventDefault();
    try {
      const data = dataForm(e.target);
      const hasil = baru ? await POST("/api/investor", data) : await PUT(`/api/investor/${inv.id}`, data);
      tutupDialog(); toast(baru ? "Investor ditambahkan." : "Data investor disimpan.", "ok");
      if (baru) location.hash = `#/investor/${hasil.id}`; else navigasi();
    } catch (err) { const g = $("#galat-inv", d); g.textContent = err.message; g.classList.remove("sembunyi"); }
  };
}

async function hapusInvestor(i) {
  const ya = await konfirmasi("Hapus investor?", `Anda akan menghapus <b>${esc(i.nama)}</b> beserta <b>seluruh transaksi dan riwayat perhitungannya</b>. Tindakan ini tidak dapat dibatalkan. Sebaiknya buat cadangan data terlebih dahulu.`, { tombol: "Ya, hapus", bahaya: true });
  if (!ya) return;
  try { const r = await DEL(`/api/investor/${i.id}`); toast(r.pesan, "ok"); location.hash = "#/investor"; navigasi(); } catch (e) { galat(e); }
}

let _inv = null;
HALAMAN.investor = async (par) => {
  if (par[0]) return halamanDetailInvestor(+par[0]);
  const r = (_inv = await api("/api/investor"));
  const baris = r.investor.map((i) => `<tr>
    <td class="tebal">${esc(i.kode)}</td><td><a href="#/investor/${i.id}" class="tebal">${esc(i.nama)}</a></td><td>${fTgl(i.tanggal_mulai, true)}</td>
    <td class="kanan angka">${uang(i.total_modal_usd, i.total_modal_idr)}</td><td class="kanan angka tebal">${uang(i.saldo_usd, i.saldo_idr)}</td>
    <td class="kanan angka ${warnaAngka(i.total_keuntungan_usd)}">${uang(i.total_keuntungan_usd)}</td><td class="kanan angka ${warnaAngka(i.persen_untung)}">${fPctTanda(i.persen_untung)}</td>
    <td>${lencanaAktif(i.status)}</td>
    <td><div class="aksi" style="flex-wrap:nowrap"><a class="tombol kecil-t" href="#/investor/${i.id}">Lihat</a><button class="kecil-t" data-edit="${i.id}">Edit</button><button class="kecil-t bahaya" data-hapus="${i.id}">Hapus</button></div></td></tr>`);
  return `<div class="kartu"><div class="judul-kartu"><h2>Daftar Investor (${r.investor.length})</h2><button class="utama-t" id="b-tambah">+ Tambah Investor</button></div>
    ${tabel([{ t: "Kode" }, { t: "Nama Investor" }, { t: "Tanggal Mulai" }, { t: "Total Modal", kanan: 1 }, { t: "Saldo Saat Ini", kanan: 1 }, { t: "Total Keuntungan", kanan: 1 }, { t: "% Keuntungan", kanan: 1 }, { t: "Status" }, { t: "Aksi" }], baris, { kosong: "Belum ada investor. Tekan “Tambah Investor” untuk mulai." })}
    <p class="kecil" style="margin:10px 0 0">Jumlah investor tidak dibatasi. Setiap investor punya halaman detail sendiri.</p></div>`;
};
HALAMAN.investor.setelah = async (par) => {
  if (par[0]) return setelahDetailInvestor(+par[0]);
  $("#b-tambah").onclick = () => dialogInvestor(null, _inv.kode_berikutnya);
  $$("[data-edit]").forEach((b) => (b.onclick = () => dialogInvestor(_inv.investor.find((i) => i.id == b.dataset.edit))));
  $$("[data-hapus]").forEach((b) => (b.onclick = () => hapusInvestor(_inv.investor.find((i) => i.id == b.dataset.hapus))));
};

/* ================= DETAIL INVESTOR ================= */
let _det = null;
async function halamanDetailInvestor(id) {
  const [i, h] = await Promise.all([api(`/api/investor/${id}`), api(`/api/harian/investor/${id}?dari=${geserTgl(hariIni(), -29)}`)]);
  _det = i;
  const rc = i.rincian_cair;
  const targetBaris = i.target.map((t) => {
    const p = Math.max(0, Math.min(100, (i.persen_untung / t.target) * 100));
    return `<tr><td class="tebal">${t.target}%</td><td>${t.tercapai ? lencana("Tercapai", "hijau") : lencana("Belum", "abu")}</td><td>${selTarget(t)}</td>
      <td class="kanan angka">${t.tercapai ? "-" : t.tanggal ? nf(t.hari_menuju, 0) + " hari" : "-"}</td>
      <td style="min-width:110px"><div class="progres ${t.tercapai ? "ok" : ""}"><i style="width:${p}%"></i></div><div class="kecil">${nf(p, 0)}%</div></td></tr>`;
  });
  const harianBaris = h.baris.slice().reverse().map((b) => `<tr><td>${fTgl(b.tanggal, true)}</td><td>${b.hari}</td>
    <td class="kanan angka">${uang(b.saldo_awal)}</td><td class="kanan angka">${b.tambahan + b.penyesuaian ? uang(b.tambahan + b.penyesuaian) : "-"}</td>
    <td class="kanan angka">${b.penarikan ? uang(b.penarikan) : "-"}</td><td class="kanan angka">${fPct(b.persen)} ${b.sumber_persen === "aktual" ? lencana("aktual", "biru") : ""}</td>
    <td class="kanan angka ${warnaAngka(b.keuntungan)}">${uang(b.keuntungan)}</td><td class="kanan angka tebal">${uang(b.saldo_akhir, b.saldo_idr)}</td></tr>`);
  const trxBaris = i.transaksi.map((t) => `<tr><td>${fTgl(t.tanggal, true)}</td><td>${lencanaJenis(t.jenis)}</td><td class="kanan angka">${t.jenis === "penarikan" ? "- " : ""}${uang(t.jumlah_usd, t.nilai_idr)}</td>
    <td class="kanan angka">${t.jenis === "penarikan" ? fIdr(t.bersih_idr_diterima) : "-"}</td><td>${esc(t.catatan)}</td></tr>`);
  return `
  <div class="kartu"><div class="judul-kartu"><div><h1>${esc(i.nama)}</h1><div class="kecil">Kode ${esc(i.kode)} · mulai ${fTgl(i.tanggal_mulai)} · hari ke-${i.hari_berjalan} · ${lencanaAktif(i.status)} ${lencanaStatus(i.warna)}</div>
      ${i.catatan ? `<div class="kecil" style="margin-top:4px">${esc(i.catatan)}</div>` : ""}</div>
      <div class="aksi mobile-penuh"><a class="tombol utama-t" href="#/penarikan?inv=${i.id}">Tarik Dana</a><a class="tombol" href="#/modal?inv=${i.id}">Tambah Modal</a><button id="b-edit">Edit</button><button class="bahaya" id="b-hapus">Hapus</button></div></div></div>
  <div class="grid k5">
    ${kartuRingkas("Modal Awal", uang(i.modal_awal_usd))}
    ${kartuRingkas("Tambahan Modal", uang(i.tambahan_usd), i.penyesuaian_usd ? `Penyesuaian ${uang(i.penyesuaian_usd)}` : "")}
    ${kartuRingkas("Total Modal", uang(i.total_modal_usd, i.total_modal_idr), "", "besar")}
    ${kartuRingkas("Saldo Saat Ini", uang(i.saldo_usd, i.saldo_idr), "", "besar")}
    ${kartuRingkas("Total Keuntungan", `<span class="${warnaAngka(i.total_keuntungan_usd)}">${uang(i.total_keuntungan_usd)}</span>`, "Sebelum biaya penarikan")}
    ${kartuRingkas("Total Penarikan", uang(i.total_penarikan_usd), "Jumlah kotor")}
    ${kartuRingkas("Uang Bersih Sudah Diterima", uang(i.uang_diterima_usd, i.uang_diterima_idr), "Setelah semua biaya")}
    ${kartuRingkas("Nilai Bersih Jika Dicairkan Hari Ini", uang(i.nilai_bersih_cair_usd, i.nilai_bersih_cair_idr), `Kurs ${fIdr(S.kurs)}`)}
    ${kartuRingkas("Kekayaan Bersih", uang(i.kekayaan_usd, i.kekayaan_idr), "Diterima + nilai bersih saldo", "besar")}
    ${kartuRingkas("Persentase Keuntungan", `<span class="${warnaAngka(i.persen_untung)}">${fPctTanda(i.persen_untung)}</span>`, `Keuntungan bersih ${uang(i.untung_bersih_usd, i.untung_bersih_idr)}`)}
  </div>
  <div class="grid k2">
    <div class="kartu"><h2>SALDO AKUN</h2>
      <div style="font-size:1.8rem;font-weight:700;color:var(--biru-tua)">${fUsd(i.saldo_usd)}</div><div class="kecil">≈ ${fIdr(i.saldo_idr)} pada kurs ${fIdr(S.kurs)}</div>
      <div class="rincian" style="margin-top:12px"><div class="b"><span>Total modal disetor</span><span>${fUsd(i.total_modal_usd)}</span></div>
      <div class="b"><span>Total penarikan (kotor)</span><span>${fUsd(i.total_penarikan_usd)}</span></div>
      <div class="b"><span>Total keuntungan</span><span class="${warnaAngka(i.total_keuntungan_usd)}">${fUsd(i.total_keuntungan_usd)}</span></div></div>
      <div class="rincian" style="margin-top:14px"><h3 style="margin-bottom:6px">Kekayaan Bersih</h3>
      <div class="b"><span>Uang bersih yang sudah ditarik</span><span>${fIdr(i.uang_diterima_idr)}</span></div>
      <div class="b"><span>+ Nilai bersih jika saldo dicairkan</span><span>${fIdr(i.nilai_bersih_cair_idr)}</span></div>
      <div class="b"><span>= Kekayaan bersih</span><span>${fIdr(i.kekayaan_idr)}</span></div>
      <div class="b minus"><span>− Total modal disetor</span><span>${fIdr(i.total_modal_idr)}</span></div>
      <div class="b"><span>= Keuntungan bersih</span><span class="${warnaAngka(i.untung_bersih_idr)}">${fIdr(i.untung_bersih_idr)}</span></div>
      <div class="b"><span>Persentase keuntungan</span><span class="${warnaAngka(i.persen_untung)}">${fPctTanda(i.persen_untung)}</span></div></div></div>
    <div class="kartu"><h2>NILAI BERSIH JIKA DICAIRKAN</h2>
      <div class="kecil" style="margin-bottom:6px">Jika seluruh saldo ${fUsd(i.saldo_usd)} dicairkan hari ini (kurs terbaru).</div>
      ${rincianPenarikan(rc, { total: "NILAI BERSIH DITERIMA" })}</div>
  </div>
  <div class="kartu"><h2>Titik Impas</h2>
    <div class="grid k3" style="margin-bottom:10px">
      ${kartuRingkas("Status Titik Impas", i.titik_impas.tercapai ? '<span class="hijau">TERCAPAI</span>' : "BELUM TERCAPAI")}
      ${kartuRingkas("Tanggal Titik Impas", selTarget(i.titik_impas))}
      ${kartuRingkas("Jumlah Hari Menuju Titik Impas", i.titik_impas.tercapai ? "Sudah tercapai" : i.titik_impas.tanggal ? nf(i.titik_impas.hari_menuju, 0) + " hari" : "-")}
    </div>
    <p class="kecil" style="margin:0 0 14px">Titik impas tercapai bila <b>uang bersih yang sudah ditarik + nilai bersih saldo jika dicairkan = total modal yang pernah disetor</b>. Perkiraan tanggal memakai persentase asumsi di PENGATURAN tanpa transaksi baru; bukan jaminan.</p>
    <h2 style="margin-bottom:8px">Target Keuntungan</h2>
    ${tabel([{ t: "Target" }, { t: "Status" }, { t: "Tanggal" }, { t: "Hari Menuju", kanan: 1 }, { t: "Progres" }], targetBaris)}
    <p class="kecil" style="margin:10px 0 0">Keuntungan 100% berarti Kekayaan Bersih = 2 × Total Modal Disetor.</p></div>
  <div class="grid k2">
    <div class="kartu"><h2>Perkembangan Saldo</h2><div class="grafik"><canvas id="gi1"></canvas></div></div>
    <div class="kartu"><h2>Keuntungan Kumulatif</h2><div class="grafik"><canvas id="gi2"></canvas></div></div>
    <div class="kartu"><h2>Penarikan</h2><div class="grafik"><canvas id="gi3"></canvas></div></div>
    <div class="kartu"><h2>Nilai Kekayaan Bersih</h2><div class="grafik"><canvas id="gi4"></canvas></div></div>
  </div>
  <div class="kartu"><div class="judul-kartu"><h2>Riwayat Transaksi</h2></div>
    ${tabel([{ t: "Tanggal" }, { t: "Jenis" }, { t: "Jumlah", kanan: 1 }, { t: "Rupiah Diterima", kanan: 1 }, { t: "Catatan" }], trxBaris)}</div>
  <div class="kartu"><div class="judul-kartu"><h2>Perhitungan Harian (30 hari terakhir)</h2><a class="tombol kecil-t" href="#/harian?inv=${i.id}">Lihat semua</a></div>
    ${tabel([{ t: "Tanggal" }, { t: "Hari" }, { t: "Saldo Awal", kanan: 1 }, { t: "Tambahan", kanan: 1 }, { t: "Penarikan", kanan: 1 }, { t: "Persentase", kanan: 1 }, { t: "Keuntungan", kanan: 1 }, { t: "Saldo Akhir", kanan: 1 }], harianBaris)}</div>`;
}
async function setelahDetailInvestor(id) {
  $("#b-edit").onclick = () => dialogInvestor(_det);
  $("#b-hapus").onclick = () => hapusInvestor(_det);
  const g = await api(`/api/grafik?investor_ids=${id}`);
  if (g.investor.length) gambarGrafikInvestor(g);
}

const NAMA_JENIS = { modal_awal: "Modal Awal", tambahan: "Tambahan Modal", penyesuaian: "Penyesuaian", penarikan: "Penarikan" };
const lencanaJenis = (j) => lencana(NAMA_JENIS[j], { modal_awal: "biru", tambahan: "hijau", penyesuaian: "abu", penarikan: "kuning" }[j]);
