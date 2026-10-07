"use strict";
/* Pembantu umum: format angka, panggilan API, dialog, grafik. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const S = { user: null, mata: "USD", kurs: null, pengaturan: null };
try { S.mata = localStorage.getItem("mata") === "IDR" ? "IDR" : "USD"; } catch (e) { /* abaikan */ }

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const KUNCI_HARI = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];
const WARNA = ["#1f6fd6", "#12803c", "#e08a00", "#7a4fd1", "#0aa6b8", "#c2410c", "#64748b", "#be185d", "#4d7c0f", "#0369a1"];

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (n, d = 2) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n ?? 0);
const fUsd = (n) => (n < 0 ? "-" : "") + "USD " + nf(Math.abs(n), 2);
const fIdr = (n) => (n < 0 ? "-" : "") + "Rp" + nf(Math.abs(Math.round(n)), 0);
const fPct = (n, d = 2) => nf(n, d) + "%";
const fPctTanda = (n) => (n > 0 ? "+" : "") + nf(n, 2) + "%";
const kurs = () => S.kurs || 16000;
function fTgl(iso, pendek = false) {
  if (!iso) return "-";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} ${pendek ? BULAN[m - 1].slice(0, 3) : BULAN[m - 1]} ${y}`;
}
/* Tampilkan uang sesuai pilihan mata uang. Beri usd, idr, atau keduanya. */
function uang(usd, idr) {
  if (S.mata === "USD") return fUsd(usd ?? (idr ?? 0) / kurs());
  return fIdr(idr ?? (usd ?? 0) * kurs());
}
const warnaAngka = (n) => (n > 0 ? "hijau" : n < 0 ? "merah" : "");
function hariIni() {
  const n = new Date(Date.now() + (new Date().getTimezoneOffset() + 420) * 60000); // WIB
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function geserTgl(iso, hari) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + hari));
  return t.toISOString().slice(0, 10);
}

/* ---------- API ---------- */
async function api(path, { method = "GET", body, form } = {}) {
  const opt = { method, headers: {}, credentials: "same-origin" };
  if (form) opt.body = form;
  else if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  let r;
  try { r = await fetch(path, opt); } catch (e) { throw new Error("Tidak dapat terhubung ke server. Pastikan aplikasi masih berjalan."); }
  let data = null;
  try { data = await r.json(); } catch (e) { /* bukan json */ }
  if (r.status === 401 && !path.startsWith("/api/masuk")) {
    const sebelumnya = S.user;
    S.user = null;
    if (sebelumnya) tampilMasuk("Sesi berakhir. Silakan masuk kembali.");
    throw new Error("Sesi berakhir.");
  }
  if (!r.ok) throw new Error((data && data.detail) || `Terjadi kesalahan (${r.status}).`);
  return data;
}
const POST = (p, body) => api(p, { method: "POST", body });
const PUT = (p, body) => api(p, { method: "PUT", body });
const DEL = (p) => api(p, { method: "DELETE" });

function toast(pesan, jenis = "") {
  const el = document.createElement("div");
  el.className = "toast " + jenis;
  el.textContent = pesan;
  $("#toast").appendChild(el);
  setTimeout(() => el.remove(), jenis === "galat" ? 7000 : 4200);
}
const galat = (e) => toast(e.message || String(e), "galat");

/* ---------- dialog ---------- */
function dialog(html, { lebar } = {}) {
  const d = $("#dialog");
  d.innerHTML = `<div class="dlg">${html}</div>`;
  if (lebar) d.style.width = `min(${lebar}px, calc(100vw - 24px))`; else d.style.width = "";
  if (!d.open) d.showModal();
  return d;
}
function tutupDialog() { const d = $("#dialog"); if (d.open) d.close(); }
function konfirmasi(judul, pesan, { tombol = "Ya, lanjutkan", bahaya = false } = {}) {
  return new Promise((res) => {
    const d = dialog(`<h2>${esc(judul)}</h2><p style="margin:0">${pesan}</p>
      <div class="aksi"><button id="k-batal">Batal</button><button id="k-ya" class="${bahaya ? "bahaya-isi" : "utama-t"}">${esc(tombol)}</button></div>`);
    let selesai = false;
    const akhir = (v) => { if (!selesai) { selesai = true; tutupDialog(); res(v); } };
    $("#k-batal", d).onclick = () => akhir(false);
    $("#k-ya", d).onclick = () => akhir(true);
    d.addEventListener("close", () => akhir(false), { once: true });
  });
}

/* ---------- komponen tampilan ---------- */
const kartuRingkas = (label, nilai, sub = "", kelas = "") =>
  `<div class="ringkas ${kelas}"><div class="label">${label}</div><div class="nilai">${nilai}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
const lencana = (teks, warna) => `<span class="lencana ${warna}">${esc(teks)}</span>`;
function lencanaStatus(warna) {
  return { hijau: lencana("Target tercapai", "hijau"), kuning: lencana("Mendekati target", "kuning"), merah: lencana("Peringatan", "merah"), abu: lencana("-", "abu") }[warna];
}
const lencanaAktif = (s) => (s === "aktif" ? lencana("Aktif", "biru") : lencana("Selesai", "abu"));
function selTarget(t, tanda = "") {
  if (t.tercapai) return `<span class="hijau tebal">${fTgl(t.tanggal)}</span>`;
  if (t.tanggal) return `<span class="tebal">BELUM TERCAPAI</span><div class="kecil">Perkiraan ${fTgl(t.tanggal)} (${nf(t.hari_menuju, 0)} hari lagi)</div>`;
  return `<span class="tebal">BELUM TERCAPAI</span><div class="kecil">Belum terjangkau dalam 10 tahun</div>`;
}
function tabel(kolom, baris, { foot = "", kosong = "Belum ada data." } = {}) {
  if (!baris.length) return `<div class="kosong">${esc(kosong)}</div>`;
  return `<div class="tabel-bungkus"><table><thead><tr>${kolom.map((k) => `<th class="${k.kanan ? "kanan" : ""}">${k.t}</th>`).join("")}</tr></thead>
    <tbody>${baris.join("")}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ""}</table></div>`;
}
function pilihInvestor(daftar, { nama = "investor_id", pilih = "", semua = false, id = "" } = {}) {
  return `<select name="${nama}" ${id ? `id="${id}"` : ""}>
    ${semua ? `<option value="">Semua investor</option>` : `<option value="">— Pilih investor —</option>`}
    ${daftar.map((i) => `<option value="${i.id}" ${String(pilih) === String(i.id) ? "selected" : ""}>${esc(i.kode)} — ${esc(i.nama)}</option>`).join("")}</select>`;
}
function dataForm(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = typeof v === "string" ? v.trim() : v; });
  $$("input[type=checkbox]", form).forEach((c) => { o[c.name] = c.checked; });
  return o;
}
function rincianPenarikan(r, { total = "NILAI BERSIH RUPIAH DITERIMA" } = {}) {
  return `<div class="rincian">
    <div class="b"><span>Jumlah Penarikan Kotor</span><span>${fUsd(r.jumlah_kotor_usd)}</span></div>
    <div class="b minus"><span>Biaya Penarikan ${nf(r.biaya_penarikan_persen, 2)}%</span><span>- ${fUsd(r.biaya_penarikan_usd)}</span></div>
    <div class="b"><span>Saldo Setelah Biaya Penarikan</span><span>${fUsd(r.saldo_setelah_biaya_usd)}</span></div>
    <div class="b minus"><span>Biaya Konversi ${nf(r.biaya_konversi_persen, 2)}%</span><span>- ${fUsd(r.biaya_konversi_usd)}</span></div>
    <div class="b"><span>Nilai Bersih USD</span><span>${fUsd(r.nilai_bersih_usd)}</span></div>
    <div class="b"><span>Kurs USD/Rupiah</span><span>${fIdr(r.kurs)}</span></div>
    <div class="b"><span>Nilai Rupiah</span><span>${fIdr(r.nilai_idr)}</span></div>
    <div class="b minus"><span>Biaya Transfer</span><span>- ${fIdr(r.biaya_transfer_idr)}</span></div>
    <div class="b total"><span>${total}</span><span>${fIdr(r.bersih_idr_diterima)}</span></div></div>`;
}

/* ---------- grafik (Chart.js) ---------- */
const _grafik = {};
function gambarGrafik(id, config) {
  const c = document.getElementById(id);
  if (!c) return;
  if (_grafik[id]) _grafik[id].destroy();
  config.options = Object.assign({
    responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
  }, config.options || {});
  _grafik[id] = new Chart(c, config);
}
function bersihkanGrafik() { Object.keys(_grafik).forEach((k) => { _grafik[k].destroy(); delete _grafik[k]; }); }
function opsiSumbu(mata, { tanpaLegenda = false } = {}) {
  const fmt = (v) => (mata === "USD" ? "$" + nf(v, 0) : "Rp" + (Math.abs(v) >= 1e9 ? nf(v / 1e9, 1) + " M" : Math.abs(v) >= 1e6 ? nf(v / 1e6, 1) + " jt" : nf(v, 0)));
  return {
    plugins: {
      legend: { display: !tanpaLegenda, position: "bottom", labels: { boxWidth: 12, usePointStyle: true } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label || c.label}: ${mata === "USD" ? fUsd(c.parsed.y ?? c.parsed) : fIdr(c.parsed.y ?? c.parsed)}` } },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
      y: { ticks: { callback: fmt }, grid: { color: "#e9eef5" } },
    },
  };
}
const labelTgl = (arr) => arr.map((t) => fTgl(t, true));
const HALAMAN = {};
