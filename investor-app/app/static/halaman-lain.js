"use strict";
/* Perhitungan harian, simulator, skenario, hasil aktual, pengaturan, cadangan data. */

/* ================= PERHITUNGAN HARIAN ================= */
const HR = { tab: "tanggal", tanggal: "", inv: "", dari: "", sampai: "" };
HALAMAN.harian = async () => {
  if (S.query.get("inv")) { HR.tab = "investor"; HR.inv = S.query.get("inv"); }
  if (!HR.tanggal) HR.tanggal = hariIni();
  if (!HR.dari) { HR.dari = geserTgl(hariIni(), -29); HR.sampai = hariIni(); }
  const inv = await api("/api/investor");
  HALAMAN.harian._inv = inv.investor;
  return `<div class="tab"><button data-tab="tanggal" class="${HR.tab === "tanggal" ? "aktif" : ""}">Per Tanggal</button><button data-tab="investor" class="${HR.tab === "investor" ? "aktif" : ""}">Riwayat per Investor</button></div>
    <div id="harian-isi"><div class="memuat">Memuat…</div></div>
    <p class="kecil">Nilai USD memakai kurs hari itu untuk kolom Rupiah. Keuntungan dihitung dari saldo dasar = saldo awal + tambahan modal − penarikan, dikali persentase hari itu (aktual bila ada, jika tidak asumsi PENGATURAN).</p>`;
};
HALAMAN.harian.setelah = async () => {
  $$("[data-tab]").forEach((b) => (b.onclick = () => { HR.tab = b.dataset.tab; navigasi(); }));
  if (HR.tab === "tanggal") await harianTanggal(); else await harianInvestor();
};
async function harianTanggal() {
  const d = await api("/api/harian?tanggal=" + HR.tanggal);
  const baris = d.baris.map((b) => `<tr><td><a class="tebal" href="#/investor/${b.investor_id}">${esc(b.investor_nama)}</a></td>
    <td class="kanan angka">${fUsd(b.saldo_awal)}</td><td class="kanan angka">${b.tambahan + b.penyesuaian ? fUsd(b.tambahan + b.penyesuaian) : "-"}</td>
    <td class="kanan angka">${b.penarikan ? fUsd(b.penarikan) : "-"}</td><td class="kanan angka">${fPct(b.persen)} ${b.sumber_persen === "aktual" ? lencana("aktual", "biru") : ""}</td>
    <td class="kanan angka ${warnaAngka(b.keuntungan)}">${fUsd(b.keuntungan)}</td><td class="kanan angka tebal">${fUsd(b.saldo_akhir)}</td>
    <td class="kanan angka">${fIdr(b.saldo_idr)}</td><td class="kanan angka">${fIdr(b.nilai_bersih_cair_idr)}</td></tr>`);
  const t = d.total;
  const foot = `<tr><td>TOTAL</td><td class="kanan angka">${fUsd(t.saldo_awal)}</td><td class="kanan angka">${fUsd(t.tambahan + t.penyesuaian)}</td><td class="kanan angka">${fUsd(t.penarikan)}</td><td></td>
    <td class="kanan angka">${fUsd(t.keuntungan)}</td><td class="kanan angka">${fUsd(t.saldo_akhir)}</td><td class="kanan angka">${fIdr(t.saldo_idr)}</td><td class="kanan angka">${fIdr(t.nilai_bersih_cair_idr)}</td></tr>`;
  $("#harian-isi").innerHTML = `<div class="kartu">
    <div class="filter" style="align-items:center">
      <button id="h-mundur">◀ Hari Sebelumnya</button><button id="h-ini" ${HR.tanggal === d.hari_ini ? "disabled" : ""}>Hari Ini</button>
      <button id="h-maju" ${HR.tanggal >= d.hari_ini ? "disabled" : ""}>Hari Berikutnya ▶</button>
      <div style="flex:0 1 190px"><input type="date" id="h-tgl" value="${HR.tanggal}" max="${d.hari_ini}" aria-label="Pilih tanggal"></div></div>
    <h2 style="margin-bottom:4px">${d.hari}, ${fTgl(d.tanggal)}</h2>
    <p class="kecil" style="margin:0 0 12px">Asumsi keuntungan hari ${d.hari}: ${fPct(d.persen_asumsi)}</p>
    ${tabel([{ t: "Investor" }, { t: "Saldo Awal", kanan: 1 }, { t: "Tambahan Modal", kanan: 1 }, { t: "Penarikan", kanan: 1 }, { t: "Persentase", kanan: 1 }, { t: "Keuntungan Hari Ini", kanan: 1 }, { t: "Saldo Akhir", kanan: 1 }, { t: "Nilai Rupiah", kanan: 1 }, { t: "Nilai Bersih Jika Ditarik", kanan: 1 }], baris, { foot, kosong: "Belum ada investor yang aktif pada tanggal ini." })}</div>`;
  const pindah = (tgl) => { HR.tanggal = tgl; harianTanggal().catch(galat); };
  $("#h-mundur").onclick = () => pindah(geserTgl(HR.tanggal, -1));
  $("#h-maju").onclick = () => pindah(geserTgl(HR.tanggal, 1));
  $("#h-ini").onclick = () => pindah(d.hari_ini);
  $("#h-tgl").onchange = (e) => e.target.value && pindah(e.target.value);
}
async function harianInvestor() {
  const daftar = HALAMAN.harian._inv;
  if (!HR.inv && daftar.length) HR.inv = String(daftar[0].id);
  $("#harian-isi").innerHTML = `<div class="kartu"><div class="filter">
    <div><label>Investor</label>${pilihInvestor(daftar, { pilih: HR.inv, id: "hi-inv" })}</div>
    <div><label>Dari Tanggal</label><input type="date" id="hi-dari" value="${HR.dari}"></div>
    <div><label>Sampai Tanggal</label><input type="date" id="hi-sampai" value="${HR.sampai}"></div>
    <div style="flex:0 0 auto"><a class="tombol" href="/api/cadangan/csv?tabel=harian">Unduh CSV</a></div></div><div id="hi-tabel"></div></div>`;
  const muat = async () => {
    if (!HR.inv) { $("#hi-tabel").innerHTML = '<div class="kosong">Pilih investor.</div>'; return; }
    try {
      const d = await api(`/api/harian/investor/${HR.inv}?dari=${HR.dari}&sampai=${HR.sampai}`);
      const baris = d.baris.slice().reverse().map((b) => `<tr><td>${fTgl(b.tanggal, true)}</td><td>${b.hari}</td><td>${esc(d.investor.nama)}</td>
        <td class="kanan angka">${fUsd(b.saldo_awal)}</td><td class="kanan angka">${b.tambahan + b.penyesuaian ? fUsd(b.tambahan + b.penyesuaian) : "-"}</td><td class="kanan angka">${b.penarikan ? fUsd(b.penarikan) : "-"}</td>
        <td class="kanan angka">${fUsd(b.saldo_dasar)}</td><td class="kanan angka">${fPct(b.persen)} ${b.sumber_persen === "aktual" ? lencana("aktual", "biru") : ""}</td>
        <td class="kanan angka ${warnaAngka(b.keuntungan)}">${fUsd(b.keuntungan)}</td><td class="kanan angka tebal">${fUsd(b.saldo_akhir)}</td><td class="kanan angka">${fIdr(b.kurs)}</td><td class="kanan angka">${fIdr(b.saldo_idr)}</td>
        <td class="kanan angka">${fUsd(b.total_modal_usd)}</td><td class="kanan angka">${fUsd(b.total_keuntungan_usd)}</td><td class="kanan angka">${fUsd(b.total_penarikan_usd)}</td>
        <td class="kanan angka">${fIdr(b.kekayaan_bersih_idr)}</td><td class="kanan angka ${warnaAngka(b.persen_untung)}">${fPctTanda(b.persen_untung)}</td></tr>`);
      $("#hi-tabel").innerHTML = tabel(["Tanggal", "Hari", "Nama Investor", "Saldo Awal", "Tambahan Modal", "Penarikan", "Saldo Dasar Perhitungan", "Persentase Keuntungan", "Keuntungan Hari Itu", "Saldo Akhir", "Kurs", "Saldo Rupiah", "Total Modal Disetor", "Total Keuntungan", "Total Penarikan", "Kekayaan Bersih", "Persentase Keuntungan Total"].map((t, i) => ({ t, kanan: i > 2 })), baris, { kosong: "Tidak ada data pada rentang tanggal ini." });
    } catch (e) { galat(e); }
  };
  $("#hi-inv").onchange = (e) => { HR.inv = e.target.value; muat(); };
  $("#hi-dari").onchange = (e) => { HR.dari = e.target.value; muat(); };
  $("#hi-sampai").onchange = (e) => { HR.sampai = e.target.value; muat(); };
  await muat();
}

/* ================= SIMULATOR ================= */
const SIM = { modal_awal: 1000, tanggal_mulai: "", tanggal_akhir: "", kurs: "", pakai_aktual: false, persen: null };
function selSim(t, mulai) {
  if (t.tercapai) return `<span class="hijau tebal">${fTgl(t.tanggal)}</span><div class="kecil">hari ke-${nf(t.hari_dari_mulai ?? 0, 0)}</div>`;
  if (t.tanggal) return `<span class="tebal">BELUM TERCAPAI</span><div class="kecil">Perkiraan ${fTgl(t.tanggal)} (hari ke-${nf((new Date(t.tanggal) - new Date(mulai)) / 864e5 + 1, 0)})</div>`;
  return `<span class="tebal">BELUM TERCAPAI</span><div class="kecil">Belum terjangkau dalam 10 tahun</div>`;
}
HALAMAN.simulator = async () => {
  if (!SIM.persen) SIM.persen = { ...S.pengaturan.persen };
  if (!SIM.tanggal_mulai) { SIM.tanggal_mulai = hariIni(); SIM.tanggal_akhir = geserTgl(hariIni(), 90); SIM.kurs = S.kurs; }
  return `<div class="kartu"><h2>Input Simulasi</h2><form id="f-sim" novalidate>
    <div class="form-grid" style="margin-bottom:14px">
      <div><label>Modal Awal (USD)</label><input type="number" step="any" inputmode="decimal" name="modal_awal" value="${SIM.modal_awal}" required></div>
      <div><label>Kurs USD/Rupiah</label><input type="number" step="any" inputmode="decimal" name="kurs" value="${SIM.kurs}" required></div>
      <div><label>Tanggal Mulai</label><input type="date" name="tanggal_mulai" value="${SIM.tanggal_mulai}" required></div>
      <div><label>Tanggal Akhir Simulasi</label><input type="date" name="tanggal_akhir" value="${SIM.tanggal_akhir}" required></div></div>
    <div class="grid k4" style="margin-bottom:6px">${KUNCI_HARI.map((k, i) => `<div><label>Keuntungan ${HARI[i]} (%)</label><input type="number" step="any" inputmode="decimal" name="p_${k}" value="${SIM.persen[k]}" required></div>`).join("")}</div>
    <div class="baris-cek"><input type="checkbox" id="s-aktual" name="pakai_aktual" ${SIM.pakai_aktual ? "checked" : ""}><label for="s-aktual">Pakai hasil aktual yang sudah dimasukkan (jika ada pada tanggal tersebut)</label></div>
    <div id="galat-sim" class="peringatan merah sembunyi"></div>
    <div class="aksi mobile-penuh" style="margin-top:12px"><button class="utama-t" type="submit">JALANKAN SIMULASI</button><button type="button" id="s-asal">Pakai persentase PENGATURAN</button></div></form></div>
  <div id="hasil-sim"></div>`;
};
HALAMAN.simulator.setelah = async () => {
  const f = $("#f-sim");
  const baca = () => {
    const d = dataForm(f);
    SIM.modal_awal = d.modal_awal; SIM.kurs = d.kurs; SIM.tanggal_mulai = d.tanggal_mulai; SIM.tanggal_akhir = d.tanggal_akhir; SIM.pakai_aktual = !!d.pakai_aktual;
    KUNCI_HARI.forEach((k) => (SIM.persen[k] = d["p_" + k]));
    return { modal_awal: d.modal_awal, kurs: d.kurs, tanggal_mulai: d.tanggal_mulai, tanggal_akhir: d.tanggal_akhir, pakai_aktual: !!d.pakai_aktual, persen: { ...SIM.persen } };
  };
  const jalan = async () => {
    const g = $("#galat-sim"); g.classList.add("sembunyi");
    try { tampilSimulasi(await POST("/api/simulator", baca()), SIM.tanggal_mulai); }
    catch (e) { g.textContent = e.message; g.classList.remove("sembunyi"); $("#hasil-sim").innerHTML = ""; }
  };
  f.onsubmit = (e) => { e.preventDefault(); jalan(); };
  $("#s-asal").onclick = () => { SIM.persen = { ...S.pengaturan.persen }; navigasi(); };
  await jalan();
};
function tampilSimulasi(h, mulai) {
  const baris = h.baris.slice(0, 400).map((b) => `<tr><td>${fTgl(b.tanggal, true)}</td><td>${b.hari}</td><td class="kanan angka">${fUsd(b.saldo_awal)}</td><td class="kanan angka">${fPct(b.persen)}${b.sumber_persen === "aktual" ? " " + lencana("aktual", "biru") : ""}</td>
    <td class="kanan angka hijau">${fUsd(b.keuntungan)}</td><td class="kanan angka tebal">${fUsd(b.saldo_akhir)}</td><td class="kanan angka">${fIdr(b.saldo_idr)}</td></tr>`);
  const tg = h.target.map((t) => `<tr><td class="tebal">${t.target}%</td><td>${t.tercapai ? lencana("Tercapai", "hijau") : lencana("Belum", "abu")}</td><td>${selSim(t, mulai)}</td></tr>`);
  $("#hasil-sim").innerHTML = `<div class="grid k4">
    ${kartuRingkas("Saldo Akhir", fUsd(h.saldo_akhir), `Hari ke-${h.baris.length}`, "besar")}
    ${kartuRingkas("Total Keuntungan", `<span class="${warnaAngka(h.total_keuntungan)}">${fUsd(h.total_keuntungan)}</span>`)}
    ${kartuRingkas("Persentase Keuntungan", `<span class="${warnaAngka(h.persen_keuntungan)}">${fPctTanda(h.persen_keuntungan)}</span>`, "Sebelum biaya penarikan")}
    ${kartuRingkas("Nilai Rupiah", fIdr(h.saldo_idr), `Bersih jika dicairkan ${fIdr(h.nilai_bersih_cair_idr)}`)}
    ${kartuRingkas("Tanggal Titik Impas", selSim(h.titik_impas, mulai), "Nilai bersih setelah biaya = modal")}
    ${kartuRingkas("Tanggal Keuntungan 100%", selSim(h.untung_100, mulai), "Kekayaan bersih = 2 × modal")}</div>
  <div class="grid k2" style="align-items:start">
    <div class="kartu"><h2>Grafik Perkembangan Modal</h2><div class="grafik tinggi"><canvas id="gs1"></canvas></div></div>
    <div><div class="kartu"><h2>Jika Saldo Akhir Dicairkan</h2>${rincianPenarikan(h.rincian_cair, { total: "NILAI BERSIH DITERIMA" })}</div>
    <div class="kartu"><h2>Target Keuntungan</h2>${tabel([{ t: "Target" }, { t: "Status" }, { t: "Tanggal" }], tg)}</div></div></div>
  <div class="kartu"><h2>Perkembangan Harian</h2>${tabel(["Tanggal", "Hari", "Saldo Awal", "Persentase", "Keuntungan", "Saldo Akhir", "Nilai Rupiah"].map((t, i) => ({ t, kanan: i > 1 })), baris)}
    ${h.baris.length > 400 ? `<p class="kecil" style="margin:8px 0 0">Menampilkan 400 hari pertama dari ${h.baris.length} hari. Ringkasan di atas memakai seluruh hari.</p>` : ""}</div>`;
  const lbl = labelTgl(h.baris.map((b) => b.tanggal));
  gambarGrafik("gs1", { type: "line", data: { labels: lbl, datasets: [
    garis("Saldo (USD)", h.baris.map((b) => b.saldo_akhir), "#1f6fd6", { fill: true }),
    garis("Modal Awal", h.baris.map(() => +SIM.modal_awal), "#94a3b8", { borderDash: [6, 4], borderWidth: 1.6 })] }, options: opsiSumbu("USD") });
}

/* ================= ANALISIS SKENARIO ================= */
const SK = { modal_awal: 1000, tanggal_mulai: "", kurs: "", skenario: [
  { nama: "KONSERVATIF", senin_jumat: 1, sabtu: 0.5, minggu: 0 }, { nama: "DASAR", senin_jumat: 4, sabtu: 2, minggu: 0 }, { nama: "OPTIMISTIS", senin_jumat: 5, sabtu: 3, minggu: 0 }] };
const WARNA_SK = { KONSERVATIF: "#0aa6b8", DASAR: "#1f6fd6", OPTIMISTIS: "#12803c" };
HALAMAN.skenario = async () => {
  if (!SK.tanggal_mulai) { SK.tanggal_mulai = hariIni(); SK.kurs = S.kurs; }
  return `<div class="kartu"><h2>Input Skenario</h2><form id="f-sk" novalidate>
    <div class="form-grid" style="margin-bottom:14px">
      <div><label>Modal Awal (USD)</label><input type="number" step="any" inputmode="decimal" name="modal_awal" value="${SK.modal_awal}" required></div>
      <div><label>Tanggal Mulai</label><input type="date" name="tanggal_mulai" value="${SK.tanggal_mulai}" required></div>
      <div><label>Kurs USD/Rupiah</label><input type="number" step="any" inputmode="decimal" name="kurs" value="${SK.kurs}" required></div></div>
    <div class="grid k3">${SK.skenario.map((s, i) => `<div class="kartu" style="margin:0;border-top:3px solid ${WARNA_SK[s.nama] || "#1f6fd6"}"><h3 style="margin-bottom:10px">${esc(s.nama)}</h3>
      <label>Senin–Jumat (%)</label><input type="number" step="any" inputmode="decimal" name="sk${i}_hk" value="${s.senin_jumat}" style="margin-bottom:8px">
      <label>Sabtu (%)</label><input type="number" step="any" inputmode="decimal" name="sk${i}_sb" value="${s.sabtu}" style="margin-bottom:8px">
      <label>Minggu (%)</label><input type="number" step="any" inputmode="decimal" name="sk${i}_mg" value="${s.minggu}"></div>`).join("")}</div>
    <div id="galat-sk" class="peringatan merah sembunyi" style="margin-top:12px"></div>
    <div class="aksi" style="margin-top:14px"><button class="utama-t" type="submit">HITUNG SKENARIO</button></div></form></div>
  <div id="hasil-sk"></div>`;
};
HALAMAN.skenario.setelah = async () => {
  const f = $("#f-sk");
  const jalan = async () => {
    const d = dataForm(f), g = $("#galat-sk"); g.classList.add("sembunyi");
    SK.modal_awal = d.modal_awal; SK.tanggal_mulai = d.tanggal_mulai; SK.kurs = d.kurs;
    SK.skenario.forEach((s, i) => { s.senin_jumat = d[`sk${i}_hk`]; s.sabtu = d[`sk${i}_sb`]; s.minggu = d[`sk${i}_mg`]; });
    try { tampilSkenario(await POST("/api/skenario", { modal_awal: d.modal_awal, tanggal_mulai: d.tanggal_mulai, kurs: d.kurs, skenario: SK.skenario })); }
    catch (e) { g.textContent = e.message; g.classList.remove("sembunyi"); $("#hasil-sk").innerHTML = ""; }
  };
  f.onsubmit = (e) => { e.preventDefault(); jalan(); };
  await jalan();
};
function tampilSkenario(r) {
  const baris = r.skenario.flatMap((s) => [
    `<tr><td rowspan="3" class="tebal" style="border-left:4px solid ${WARNA_SK[s.nama] || "#1f6fd6"}">${esc(s.nama)}<div class="kecil">${s.persen.senin_jumat}% / ${s.persen.sabtu}% / ${s.persen.minggu}%</div></td><td>Saldo</td>${s.horizon.map((h) => `<td class="kanan angka tebal">${fUsd(h.saldo)}</td>`).join("")}</tr>`,
    `<tr><td>Keuntungan</td>${s.horizon.map((h) => `<td class="kanan angka ${warnaAngka(h.keuntungan)}">${fUsd(h.keuntungan)}</td>`).join("")}</tr>`,
    `<tr><td>Persentase</td>${s.horizon.map((h) => `<td class="kanan angka">${fPctTanda(h.persen)}</td>`).join("")}</tr>`]);
  $("#hasil-sk").innerHTML = `<div class="kartu"><h2>Perbandingan Hasil</h2>
    ${tabel([{ t: "Skenario" }, { t: "" }, ...r.horizon.map((h) => ({ t: h + " Hari", kanan: 1 }))], baris)}
    <p class="kecil" style="margin:10px 0 0">Angka di atas adalah hasil kotor sebelum biaya penarikan, dengan compounding harian dan tanpa transaksi lain. Ini simulasi berdasarkan asumsi, bukan jaminan hasil.</p></div>
  <div class="kartu"><h2>Perkembangan Saldo 365 Hari</h2><div class="grafik tinggi"><canvas id="gk1"></canvas></div></div>
  <div class="grid k3">${r.skenario.map((s) => `<div class="ringkas">${`<div class="label">${esc(s.nama)} · Titik impas</div>`}<div class="nilai" style="font-size:1.05rem">${s.titik_impas.tanggal ? fTgl(s.titik_impas.tanggal) : "Belum dalam 365 hari"}</div>
      <div class="sub">${s.titik_impas.tanggal ? "Nilai bersih setelah biaya sama dengan modal" : "Belum tercapai pada rentang simulasi"}</div></div>`).join("")}</div>`;
  const lbl = labelTgl(r.skenario[0].grafik.map((b) => b.tanggal));
  gambarGrafik("gk1", { type: "line", data: { labels: lbl, datasets: r.skenario.map((s, k) => garis(s.nama, s.grafik.map((b) => b.saldo), WARNA_SK[s.nama] || WARNA[k])) }, options: opsiSumbu("USD") });
}

/* ================= HASIL AKTUAL ================= */
let _ak = null;
const AK = { inv: "" };
HALAMAN.aktual = async () => {
  const [a, inv] = await Promise.all([api("/api/aktual"), api("/api/investor")]);
  _ak = a.aktual;
  const baris = a.aktual.map((x) => `<tr><td>${fTgl(x.tanggal)}</td><td>${HARI[(new Date(x.tanggal + "T00:00:00Z").getUTCDay() + 6) % 7]}</td><td class="kanan angka ${warnaAngka(x.persen)}">${fPctTanda(x.persen)}</td><td>${esc(x.catatan)}</td>
    <td><button class="kecil-t bahaya" data-hapus-ak="${x.tanggal}">Hapus</button></td></tr>`);
  return `<div class="grid k2" style="align-items:start">
    <div class="kartu"><h2>Masukkan Hasil Aktual</h2><form id="f-ak" class="form-grid" novalidate>
      <div><label>Tanggal</label><input type="date" name="tanggal" value="${hariIni()}" max="${hariIni()}" required></div>
      <div><label>Persentase Keuntungan Aktual (%)</label><input type="number" step="any" inputmode="decimal" name="persen" required></div>
      <div class="penuh"><label>Catatan</label><textarea name="catatan" maxlength="500"></textarea></div>
      <div id="galat-ak" class="penuh peringatan merah sembunyi"></div>
      <div class="penuh"><button class="utama-t" type="submit" style="width:100%">SIMPAN HASIL AKTUAL</button></div></form>
      <p class="kecil" style="margin:12px 0 0">Jika sebuah tanggal punya hasil aktual, perhitungan memakai angka itu untuk <b>semua investor</b> pada tanggal tersebut. Tanggal tanpa hasil aktual memakai asumsi dari PENGATURAN. Menyimpan tanggal yang sama menimpa data sebelumnya.</p></div>
    <div class="kartu"><h2>Daftar Hasil Aktual (${a.aktual.length})</h2>${tabel([{ t: "Tanggal" }, { t: "Hari" }, { t: "Persentase", kanan: 1 }, { t: "Catatan" }, { t: "" }], baris, { kosong: "Belum ada hasil aktual." })}</div></div>
  <div class="kartu"><div class="judul-kartu"><h2>Saldo Berdasarkan Asumsi vs Aktual</h2><div style="min-width:220px">${pilihInvestor(inv.investor, { semua: true, pilih: AK.inv, id: "ak-inv" })}</div></div><div id="ak-banding"></div></div>`;
};
HALAMAN.aktual.setelah = async () => {
  $("#f-ak").onsubmit = async (e) => {
    e.preventDefault(); const g = $("#galat-ak"); g.classList.add("sembunyi");
    try { const r = await POST("/api/aktual", dataForm(e.target)); toast(r.pesan, "ok"); navigasi(); } catch (err) { g.textContent = err.message; g.classList.remove("sembunyi"); }
  };
  $$("[data-hapus-ak]").forEach((b) => (b.onclick = async () => {
    if (!(await konfirmasi("Hapus hasil aktual?", `Hasil aktual ${fTgl(b.dataset.hapusAk)} dihapus dan tanggal itu kembali memakai asumsi. Saldo dihitung ulang.`, { tombol: "Ya, hapus", bahaya: true }))) return;
    try { const r = await DEL("/api/aktual/" + b.dataset.hapusAk); toast(r.pesan, "ok"); navigasi(); } catch (e) { galat(e); }
  }));
  const muat = async () => {
    const r = await api("/api/aktual/perbandingan" + (AK.inv ? "?investor_id=" + AK.inv : ""));
    const k = r.ringkas;
    if (!k) { $("#ak-banding").innerHTML = '<div class="kosong">Belum ada data saldo.</div>'; return; }
    const baris = r.baris.filter((b) => b.persen_aktual_dipakai || Math.abs(b.selisih_usd) > 0).slice(-60).reverse().map((b) => `<tr><td>${fTgl(b.tanggal, true)}</td>
      <td class="kanan angka">${fUsd(b.asumsi)}</td><td class="kanan angka">${fUsd(b.aktual)}</td><td class="kanan angka ${warnaAngka(b.selisih_usd)}">${fUsd(b.selisih_usd)}</td>
      <td class="kanan angka ${warnaAngka(b.selisih_usd)}">${fIdr(b.selisih_idr)}</td><td class="kanan angka ${warnaAngka(b.selisih_persen)}">${fPctTanda(b.selisih_persen)}</td></tr>`);
    $("#ak-banding").innerHTML = `${_ak.length ? "" : '<div class="peringatan biru">Belum ada hasil aktual, jadi saldo asumsi dan aktual masih sama. Masukkan hasil aktual di atas untuk melihat selisihnya.</div>'}
      <div class="grid k5">${kartuRingkas("Saldo Berdasarkan Asumsi", fUsd(k.asumsi_usd))}${kartuRingkas("Saldo Berdasarkan Aktual", fUsd(k.aktual_usd))}
      ${kartuRingkas("Selisih USD", `<span class="${warnaAngka(k.selisih_usd)}">${fUsd(k.selisih_usd)}</span>`)}${kartuRingkas("Selisih Rupiah", `<span class="${warnaAngka(k.selisih_idr)}">${fIdr(k.selisih_idr)}</span>`)}
      ${kartuRingkas("Selisih Persentase", `<span class="${warnaAngka(k.selisih_persen)}">${fPctTanda(k.selisih_persen)}</span>`)}</div>
      <div class="grafik" style="margin-bottom:14px"><canvas id="ga1"></canvas></div>
      ${tabel([{ t: "Tanggal" }, { t: "Saldo Asumsi", kanan: 1 }, { t: "Saldo Aktual", kanan: 1 }, { t: "Selisih USD", kanan: 1 }, { t: "Selisih Rupiah", kanan: 1 }, { t: "Selisih %", kanan: 1 }], baris, { kosong: "Belum ada selisih." })}`;
    gambarGrafik("ga1", { type: "line", data: { labels: labelTgl(r.baris.map((b) => b.tanggal)), datasets: [
      garis("Saldo Asumsi", r.baris.map((b) => b.asumsi), "#94a3b8", { borderDash: [6, 4] }), garis("Saldo Aktual", r.baris.map((b) => b.aktual), "#1f6fd6")] }, options: opsiSumbu("USD") });
  };
  $("#ak-inv").onchange = (e) => { AK.inv = e.target.value; muat().catch(galat); };
  await muat();
};

/* ================= PENGATURAN ================= */
const PERINGATAN_HASIL = "Aplikasi ini merupakan alat pencatatan dan simulasi. Persentase keuntungan merupakan asumsi atau data yang dimasukkan pengguna dan bukan jaminan hasil investasi.";
HALAMAN.pengaturan = async () => {
  const [p, kr] = await Promise.all([api("/api/pengaturan"), api("/api/kurs/riwayat")]);
  const riw = kr.riwayat.slice(0, 8).map((k) => `<tr><td>${fTgl(k.tanggal, true)}</td><td>${esc(k.jam)}</td><td class="kanan angka">${fIdr(k.nilai)}</td><td>${esc(k.sumber)}</td></tr>`);
  return `<div class="peringatan biru">${PERINGATAN_HASIL}</div>
  <div class="grid k2" style="align-items:start">
  <div class="kartu"><h2>Kurs USD/Rupiah</h2>
    <div class="rincian"><div class="b"><span>Kurs Terakhir Diperbarui</span><span>${fTgl(p.kurs_tanggal)}</span></div><div class="b"><span>Jam</span><span>${esc(p.kurs_jam)} WIB</span></div>
      <div class="b"><span>Nilai Kurs</span><span>${fIdr(p.kurs)}</span></div><div class="b"><span>Sumber</span><span>${esc(p.kurs_sumber)}</span></div></div>
    <form id="f-kurs" style="margin-top:14px"><label>Kurs Manual (Rp per 1 USD)</label><div class="aksi" style="flex-wrap:nowrap"><input type="number" step="any" inputmode="decimal" name="nilai" value="${p.kurs}" required><button class="utama-t" type="submit" style="white-space:nowrap">SIMPAN KURS</button></div></form>
    <div class="aksi" style="margin-top:10px"><button id="b-kurs-online">PERBARUI KURS</button></div>
    <div class="bantuan">Kurs manual adalah pilihan utama. “Perbarui Kurs” mengambil kurs terbaru dari internet; jika internet tidak ada, kurs manual tetap dipakai.</div>
    ${riw.length ? `<h3 style="margin:16px 0 8px">Riwayat Kurs</h3>${tabel([{ t: "Tanggal" }, { t: "Jam" }, { t: "Kurs", kanan: 1 }, { t: "Sumber" }], riw)}` : ""}</div>
  <form class="kartu" id="f-peng" novalidate><h2>Keuntungan Harian (%)</h2>
    <div class="form-grid">${KUNCI_HARI.map((k, i) => `<div><label>${HARI[i]}</label><input type="number" step="any" inputmode="decimal" name="p_${k}" value="${p.persen[k]}" required></div>`).join("")}</div>
    <h2 style="margin:20px 0 12px">Biaya</h2>
    <div class="form-grid"><div><label>Biaya Penarikan (%)</label><input type="number" step="any" inputmode="decimal" name="biaya_penarikan_persen" value="${p.biaya_penarikan_persen}" required></div>
      <div><label>Biaya Konversi (%)</label><input type="number" step="any" inputmode="decimal" name="biaya_konversi_persen" value="${p.biaya_konversi_persen}" required></div>
      <div><label>Biaya Transfer (Rp)</label><input type="number" step="any" inputmode="decimal" name="biaya_transfer_idr" value="${p.biaya_transfer_idr}" required></div></div>
    <div class="peringatan kuning" style="margin-top:14px">Mengubah persentase keuntungan akan <b>menghitung ulang seluruh riwayat saldo</b> pada tanggal yang belum punya hasil aktual. Simpan hasil nyata di menu HASIL AKTUAL agar tidak ikut berubah.</div>
    <div id="galat-peng" class="peringatan merah sembunyi"></div>
    <button class="utama-t" type="submit" style="width:100%">SIMPAN PENGATURAN</button></form></div>
  <div class="kartu" style="max-width:520px"><h2>Ganti Kata Sandi</h2><form id="f-sandi" novalidate>
    <div style="margin-bottom:12px"><label>Kata Sandi Lama</label><input type="password" name="sandi_lama" autocomplete="current-password" required></div>
    <div style="margin-bottom:12px"><label>Kata Sandi Baru (minimal 8 karakter)</label><input type="password" name="sandi_baru" autocomplete="new-password" required></div>
    <div id="galat-sandi" class="peringatan merah sembunyi"></div><button class="utama-t" type="submit">GANTI KATA SANDI</button></form></div>`;
};
HALAMAN.pengaturan.setelah = async () => {
  $("#f-kurs").onsubmit = async (e) => { e.preventDefault(); try { await POST("/api/kurs", dataForm(e.target)); toast("Kurs tersimpan.", "ok"); navigasi(); } catch (err) { galat(err); } };
  $("#b-kurs-online").onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = "Mengambil kurs…";
    try { const r = await POST("/api/kurs/perbarui"); toast(r.pesan, r.ok ? "ok" : "galat"); if (r.ok) navigasi(); } catch (err) { galat(err); }
    e.target.disabled = false; e.target.textContent = "PERBARUI KURS";
  };
  $("#f-peng").onsubmit = async (e) => {
    e.preventDefault(); const g = $("#galat-peng"); g.classList.add("sembunyi");
    const d = dataForm(e.target), persen = {};
    KUNCI_HARI.forEach((k) => (persen[k] = d["p_" + k]));
    if (!(await konfirmasi("Simpan pengaturan?", "Perubahan akan memengaruhi perhitungan seluruh investor, termasuk riwayat harian yang sudah lewat (kecuali tanggal dengan hasil aktual).", { tombol: "Ya, simpan" }))) return;
    try { await PUT("/api/pengaturan", { persen, biaya_penarikan_persen: d.biaya_penarikan_persen, biaya_konversi_persen: d.biaya_konversi_persen, biaya_transfer_idr: d.biaya_transfer_idr }); toast("Pengaturan tersimpan. Semua saldo sudah dihitung ulang.", "ok"); navigasi(); }
    catch (err) { g.textContent = err.message; g.classList.remove("sembunyi"); }
  };
  $("#f-sandi").onsubmit = async (e) => {
    e.preventDefault(); const g = $("#galat-sandi"); g.classList.add("sembunyi");
    try { await POST("/api/ganti-sandi", dataForm(e.target)); S.user.sandi_awal = false; e.target.reset(); toast("Kata sandi berhasil diganti.", "ok"); }
    catch (err) { g.textContent = err.message; g.classList.remove("sembunyi"); }
  };
};

/* ================= CADANGKAN DATA ================= */
HALAMAN.cadangan = async () => `
  <div class="grid k2" style="align-items:start">
  <div class="kartu"><h2>Ekspor Data</h2><p class="kecil" style="margin-top:0">Simpan salinan data secara berkala, misalnya seminggu sekali, dan simpan di tempat lain (Google Drive, flashdisk).</p>
    <div class="aksi mobile-penuh"><a class="tombol utama-t" href="/api/cadangan/json">Unduh Cadangan Lengkap (JSON)</a></div>
    <p class="kecil">JSON adalah satu-satunya format yang bisa dipulihkan kembali ke aplikasi.</p>
    <h3 style="margin:14px 0 8px">Untuk dibuka di Excel</h3>
    <div class="aksi mobile-penuh"><a class="tombol" href="/api/cadangan/xlsx">Unduh Excel (.xlsx)</a><a class="tombol" href="/api/cadangan/csv?tabel=investor">CSV Investor</a><a class="tombol" href="/api/cadangan/csv?tabel=transaksi">CSV Transaksi</a><a class="tombol" href="/api/cadangan/csv?tabel=harian">CSV Harian</a></div></div>
  <div class="kartu"><h2>Pulihkan Data</h2><div class="peringatan kuning">Memulihkan akan <b>mengganti seluruh data</b> investor, transaksi, pengaturan, dan hasil aktual dengan isi file. Salinan data saat ini disimpan otomatis dulu.</div>
    <form id="f-impor"><label>File cadangan (.json)</label><input type="file" name="berkas" accept=".json,application/json" required style="padding:9px">
    <div id="galat-impor" class="peringatan merah sembunyi" style="margin-top:12px"></div>
    <button class="bahaya-isi" type="submit" style="margin-top:12px">PULIHKAN DATA</button></form></div></div>
  <div class="kartu"><div class="judul-kartu"><h2>Pemeriksaan Integritas Data</h2><button id="b-periksa" class="utama-t">Periksa Sekarang</button></div>
    <p class="kecil" style="margin-top:0">Menghitung ulang semua saldo dari transaksi dan membandingkannya dengan hasil yang tersimpan. Saldo hanya boleh berubah karena transaksi atau keuntungan harian yang tercatat.</p><div id="hasil-periksa"></div></div>`;
HALAMAN.cadangan.setelah = async () => {
  $("#f-impor").onsubmit = async (e) => {
    e.preventDefault(); const g = $("#galat-impor"); g.classList.add("sembunyi");
    const berkas = e.target.berkas.files[0];
    if (!berkas) { g.textContent = "Pilih file cadangan terlebih dahulu."; g.classList.remove("sembunyi"); return; }
    if (!(await konfirmasi("Pulihkan data?", `Seluruh data saat ini akan diganti dengan isi <b>${esc(berkas.name)}</b>. Lanjutkan?`, { tombol: "Ya, pulihkan", bahaya: true }))) return;
    const form = new FormData(); form.append("berkas", berkas);
    try { const r = await api("/api/cadangan/impor", { method: "POST", form }); toast(r.pesan, "ok"); location.hash = "#/dashboard"; }
    catch (err) { g.textContent = err.message; g.classList.remove("sembunyi"); }
  };
  const periksa = async () => {
    const r = await api("/api/pemeriksaan");
    $("#hasil-periksa").innerHTML = (r.ok ? `<div class="peringatan hijau"><b>Data konsisten.</b> ${nf(r.jumlah_baris, 0)} baris perhitungan harian diperiksa, tidak ada selisih.</div>`
      : `<div class="peringatan merah"><b>Ditemukan ${r.jumlah_masalah} masalah.</b><ul style="margin:6px 0 0">${r.masalah.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>`)
      + `<h3 style="margin:12px 0 8px">Riwayat Perhitungan Terakhir</h3>` + tabel([{ t: "Waktu" }, { t: "Alasan" }, { t: "Investor", kanan: 1 }, { t: "Baris", kanan: 1 }, { t: "Status" }],
        r.riwayat.map((x) => `<tr><td>${esc(x.waktu.replace("T", " ").slice(0, 19))}</td><td>${esc(x.alasan)}</td><td class="kanan">${x.jumlah_investor}</td><td class="kanan">${nf(x.jumlah_baris, 0)}</td><td>${x.status === "ok" ? lencana("OK", "hijau") : lencana(x.status, "merah")}</td></tr>`));
  };
  $("#b-periksa").onclick = () => periksa().catch(galat);
  await periksa();
};
