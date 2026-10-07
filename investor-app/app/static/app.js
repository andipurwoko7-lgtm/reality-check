"use strict";
/* Kerangka aplikasi: halaman masuk, menu, dan perpindahan halaman. */
const IKON = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  investor: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .6 3.2 2.2 3.5 4.7"/>',
  modal: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M8.5 12h7"/>',
  tarik: '<path d="M12 3v13M6.5 11l5.5 5.5 5.5-5.5M4 21h16"/>',
  riwayat: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  harian: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  simulator: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  skenario: '<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
  aktual: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  kalkulator: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  pengaturan: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  cadangan: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  keluar: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logo: '<path d="M4 17l5-6 4 4 7-9"/><path d="M15 6h5v5"/>',
};
const ikon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON[n]}</svg>`;

const MENU = [
  ["dashboard", "DASHBOARD", "dashboard"], ["investor", "INVESTOR", "investor"], ["modal", "TRANSAKSI MODAL", "modal"],
  ["penarikan", "PENARIKAN", "tarik"], ["riwayat", "RIWAYAT TRANSAKSI", "riwayat"], ["harian", "PERHITUNGAN HARIAN", "harian"],
  ["simulator", "SIMULATOR", "simulator"], ["skenario", "ANALISIS SKENARIO", "skenario"], ["aktual", "HASIL AKTUAL", "aktual"],
  ["kalkulator", "KALKULATOR PENARIKAN", "kalkulator"], ["pengaturan", "PENGATURAN", "pengaturan"], ["cadangan", "CADANGKAN DATA", "cadangan"],
];
const JUDUL = Object.fromEntries(MENU.map((m) => [m[0], m[1]]));

function tampilMasuk(pesan = "") {
  bersihkanGrafik();
  $("#akar").innerHTML = `<div class="halaman-masuk"><form class="kotak-masuk" id="f-masuk" autocomplete="on">
    <div class="logo">${ikon("logo")}</div>
    <h1>Pelacak Modal Investor</h1>
    <p class="kecil" style="margin:0 0 18px">Catat modal, hitung perkembangan harian, dan pantau saldo setiap investor.</p>
    ${pesan ? `<div class="peringatan kuning">${esc(pesan)}</div>` : ""}
    <div style="margin-bottom:14px"><label for="m-nama">Nama Pengguna</label><input id="m-nama" name="nama_pengguna" autocomplete="username" autocapitalize="none" required autofocus></div>
    <div style="margin-bottom:18px"><label for="m-sandi">Kata Sandi</label><input id="m-sandi" name="kata_sandi" type="password" autocomplete="current-password" required></div>
    <button class="utama-t" style="width:100%" type="submit">MASUK</button>
    <p class="kecil" style="margin:16px 0 0">Aplikasi ini merupakan alat pencatatan dan simulasi. Persentase keuntungan merupakan asumsi atau data yang dimasukkan pengguna dan bukan jaminan hasil investasi.</p>
  </form></div>`;
  $("#f-masuk").onsubmit = async (e) => {
    e.preventDefault();
    const tombol = $("button", e.target);
    tombol.disabled = true; tombol.textContent = "Memeriksa…";
    try {
      S.user = await POST("/api/masuk", dataForm(e.target));
      await mulaiAplikasi();
    } catch (err) {
      tampilMasuk(err.message);
    }
  };
}

async function muatKurs() {
  S.pengaturan = await api("/api/pengaturan");
  S.kurs = S.pengaturan.kurs;
  const el = $("#kurs-info");
  if (el) el.innerHTML = `Kurs USD/Rp<br><b>${fIdr(S.kurs)}</b>`;
}

function kerangka() {
  $("#akar").innerHTML = `
  <aside class="menu" id="menu" aria-label="Menu utama">
    <div class="menu-kepala"><div class="logo">${ikon("logo")}</div><div><b>Pelacak Modal</b><span>Masuk sebagai ${esc(S.user.nama_pengguna)}</span></div></div>
    <nav>${MENU.map(([k, t, i]) => `<a class="item" href="#/${k}" data-menu="${k}">${ikon(i)}<span>${t}</span></a>`).join("")}
      <div class="pemisah"></div>
      <button class="item" id="b-keluar">${ikon("keluar")}<span>KELUAR</span></button></nav>
  </aside>
  <div class="tabir sembunyi" id="tabir"></div>
  <div class="utama">
    <header class="bilah-atas">
      <button class="tombol-menu" id="b-menu" aria-label="Buka menu">${ikon("menu")}</button>
      <h1 id="judul">Dashboard</h1>
      <div class="pilih-mata" role="group" aria-label="Tampilan mata uang">
        <button data-mata="USD">USD</button><button data-mata="IDR">RUPIAH</button></div>
      <div class="kurs-info" id="kurs-info"></div>
    </header>
    <main class="isi" id="isi"></main>
    <footer class="kaki">Aplikasi ini merupakan alat pencatatan dan simulasi. Persentase keuntungan merupakan asumsi atau data yang dimasukkan pengguna dan bukan jaminan hasil investasi.</footer>
  </div>`;
  const menu = $("#menu"), tabir = $("#tabir");
  const tutup = () => { menu.classList.remove("buka"); tabir.classList.add("sembunyi"); };
  $("#b-menu").onclick = () => { menu.classList.add("buka"); tabir.classList.remove("sembunyi"); };
  tabir.onclick = tutup;
  $$("#menu a.item").forEach((a) => a.addEventListener("click", tutup));
  $("#b-keluar").onclick = async () => { try { await POST("/api/keluar"); } catch (e) { /* abaikan */ } S.user = null; location.hash = ""; tampilMasuk(); };
  $$("[data-mata]").forEach((b) => (b.onclick = () => {
    S.mata = b.dataset.mata;
    try { localStorage.setItem("mata", S.mata); } catch (e) { /* abaikan */ }
    tandaiMata(); navigasi();
  }));
  tandaiMata();
}
function tandaiMata() { $$("[data-mata]").forEach((b) => b.classList.toggle("aktif", b.dataset.mata === S.mata)); }

let _navId = 0;
async function navigasi() {
  if (!S.user) return;
  const [jalur, kueri = ""] = location.hash.replace(/^#\/?/, "").split("?");
  S.query = new URLSearchParams(kueri);
  const bagian = (jalur || "dashboard").split("/");
  let nama = bagian[0];
  if (!HALAMAN[nama]) nama = "dashboard";
  const id = ++_navId;
  $$("#menu a.item").forEach((a) => a.classList.toggle("aktif", a.dataset.menu === nama));
  $("#judul").textContent = nama === "investor" && bagian[1] ? "DETAIL INVESTOR" : JUDUL[nama];
  document.title = `${$("#judul").textContent} — Pelacak Modal`;
  const isi = $("#isi");
  bersihkanGrafik();
  isi.innerHTML = '<div class="memuat">Memuat…</div>';
  try {
    await muatKurs();
    const html = await HALAMAN[nama](bagian.slice(1), isi);
    if (id !== _navId) return;
    if (typeof html === "string") isi.innerHTML = html;
    if (HALAMAN[nama].setelah) await HALAMAN[nama].setelah(bagian.slice(1), isi);
  } catch (e) {
    if (id !== _navId || !S.user) return;
    isi.innerHTML = `<div class="peringatan merah"><b>Halaman tidak dapat dimuat.</b><br>${esc(e.message)}<br><br><button onclick="navigasi()">Coba lagi</button></div>`;
  }
  window.scrollTo(0, 0);
}

async function mulaiAplikasi() {
  kerangka();
  if (!location.hash || location.hash === "#") location.hash = "#/dashboard";
  await navigasi();
}

window.addEventListener("hashchange", navigasi);
(async function boot() {
  try {
    S.user = await api("/api/saya");
    await mulaiAplikasi();
  } catch (e) {
    if (!S.user) tampilMasuk();
  }
})();
