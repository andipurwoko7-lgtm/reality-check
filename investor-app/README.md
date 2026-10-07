# Pelacak Modal Investor

Aplikasi web untuk mencatat, menghitung, dan memantau perkembangan modal beberapa investor.
Bisa dibuka dari laptop maupun HP lewat browser. Data tersimpan permanen di basis data SQLite.

> Aplikasi ini merupakan alat pencatatan dan simulasi. Persentase keuntungan merupakan asumsi atau data yang dimasukkan pengguna dan bukan jaminan hasil investasi.

**Teknologi:** Python FastAPI (server + semua perhitungan) · SQLite · tampilan HTML/JavaScript biasa
(tanpa build, tanpa Node.js) · Chart.js untuk grafik (sudah disertakan, jalan tanpa internet).

## Cara instalasi

Butuh Python 3.10 atau lebih baru.

```bash
cd investor-app
python3 -m venv .venv && source .venv/bin/activate     # opsional tapi disarankan
pip install -r requirements.txt
```

## Cara menjalankan aplikasi

```bash
./jalankan.sh        # atau: python3 -m uvicorn app.main:app --port 8000
```

Buka **http://localhost:8000**. Untuk membuka dari HP (satu Wi-Fi dengan laptop), pakai alamat IP laptop,
misalnya `http://192.168.1.10:8000`. Untuk pemakaian online, jalankan di server/VPS di belakang HTTPS
(Caddy atau Nginx). Jangan buka ke internet tanpa HTTPS.

Basis data otomatis dibuat di `data/investor.db` saat pertama kali jalan, berisi data contoh
(Investor A, B, C, termasuk satu contoh penarikan). Lokasi lain: `INVESTOR_DB=/path/file.db`.

## Cara login

Pertama kali: nama pengguna **admin**, kata sandi **admin123**. Segera ganti di menu
**PENGATURAN → Ganti Kata Sandi**. Kata sandi awal bisa diatur lewat `ADMIN_USER` dan `ADMIN_PASSWORD`
sebelum aplikasi dijalankan pertama kali. Kata sandi disimpan sebagai hash bcrypt, bukan teks biasa.
Tabel `pengguna` sudah siap untuk menambah pengguna lain nanti. Zona waktu bawaan WIB (UTC+7),
ubah dengan `INVESTOR_UTC_OFFSET`.

## Cara memakai

- **Menambah investor:** menu **INVESTOR → + Tambah Investor**. Isi kode, nama, tanggal mulai, dan modal awal (USD).
  Jumlah investor tidak dibatasi. Edit dan Hapus (dengan konfirmasi) ada di daftar atau halaman detail.
- **Input modal:** menu **TRANSAKSI MODAL**. Pilih investor dan jenis (Tambahan Modal / Penyesuaian), isi tanggal, jumlah USD, kurs.
  Tambahan modal ikut dihitung keuntungannya mulai tanggal transaksi. Saldo otomatis diperbarui.
- **Penarikan:** menu **PENARIKAN**. Pilih investor, tanggal, jumlah USD, kurs. Rincian biaya muncul langsung
  (biaya 6%, konversi 0,5%, kurs, biaya transfer Rp11.000, **nilai bersih Rupiah diterima**). Tekan **SIMPAN PENARIKAN**.
  Penarikan tidak bisa melebihi saldo tersedia pada tanggal itu (saldo awal hari + setoran hari itu; keuntungan hari berjalan
  baru masuk di akhir hari). Saldo berkurang mulai tanggal penarikan.
  Mau coba dulu? Pakai **KALKULATOR PENARIKAN**: tidak mengubah data sampai Anda menekan *Simpan sebagai Transaksi*.
- **Mengganti kurs:** menu **PENGATURAN → Kurs**. Isi kurs manual lalu **SIMPAN KURS**, atau tekan **PERBARUI KURS** untuk
  mengambil kurs terbaru dari internet. Jika internet mati, aplikasi tetap jalan dengan kurs manual.
  Tanggal, jam, dan nilai kurs terakhir ditampilkan.
- **Persentase harian dan biaya:** menu **PENGATURAN** (awal: Senin–Jumat 4%, Sabtu 2%, Minggu 0%).
  Perubahan menghitung ulang seluruh riwayat, kecuali tanggal yang sudah punya **HASIL AKTUAL**.
  Simpan hasil nyata di menu **HASIL AKTUAL** supaya tidak ikut berubah.
- **Cadangan data:** menu **CADANGKAN DATA → Unduh Cadangan Lengkap (JSON)**. Ada juga Excel dan CSV untuk dibuka di Excel
  (hanya JSON yang bisa dipulihkan).
- **Memulihkan data:** menu **CADANGKAN DATA → Pulihkan Data**, pilih file JSON. Seluruh data diganti isi file.
  Salinan data sebelumnya disimpan otomatis di `data/cadangan_otomatis/`. File yang tidak valid ditolak tanpa mengubah apa pun.
  Salin juga file `data/investor.db` secara berkala sebagai cadangan tambahan.

## Rumus (semua dihitung di server, file `app/calc.py`)

Per hari, per investor:
`saldo dasar = saldo awal + tambahan modal + penyesuaian − penarikan` →
`keuntungan = saldo dasar × persen hari itu` → `saldo akhir = saldo dasar + keuntungan` (compounding).
Persen hari itu = hasil aktual bila ada, jika tidak asumsi PENGATURAN.

Penarikan: `kotor − biaya penarikan 6% → − biaya konversi 0,5% = nilai bersih USD → × kurs − Rp11.000 =
NILAI BERSIH RUPIAH DITERIMA`. USD dibulatkan ke sen, Rupiah ke bilangan bulat.

Kekayaan bersih = uang bersih yang sudah ditarik + nilai bersih jika saldo dicairkan (kurs terbaru).
Titik impas: kekayaan bersih ≥ total modal disetor. Keuntungan 100%: kekayaan bersih ≥ 2 × total modal.
Tanggalnya adalah awal rentetan hari yang terus memenuhi syarat sampai hari ini. Jika belum tercapai, tampil
**BELUM TERCAPAI** plus perkiraan tanggal dari asumsi (tanpa transaksi baru, maksimal 10 tahun).
Modal dalam Rupiah memakai kurs saat setoran; nilai saldo memakai kurs hari yang bersangkutan.

Warna status: hijau = titik impas tercapai, kuning = kekayaan bersih ≥ 80% modal, merah = di bawah itu.

**Pemeriksaan internal:** setiap perhitungan dicek (saldo awal = saldo akhir kemarin, saldo akhir = saldo dasar + keuntungan,
tidak ada saldo negatif), disimpan di tabel `perhitungan_harian`, dan dicatat di `riwayat_perhitungan`.
**CADANGKAN DATA → Periksa Sekarang** menghitung ulang dari transaksi dan membandingkannya dengan data tersimpan.
Tambah/ubah/hapus transaksi yang membuat saldo hari mana pun negatif otomatis ditolak.

## Pengujian otomatis

```bash
python3 -m pytest tests -q
```

Mencakup keuntungan harian, compounding, tambahan modal, penarikan, biaya 6%, konversi 0,5%, transfer Rp11.000,
saldo setelah penarikan, konversi USD→Rupiah, titik impas, keuntungan 100%, validasi input, login,
cadangan/pemulihan, dan pemeriksaan integritas.

## Struktur

```
app/calc.py      rumus keuangan (tanpa basis data)
app/service.py   logika bisnis, validasi, cadangan
app/db.py        skema SQL (SQL biasa, uang disimpan sebagai teks desimal, mudah dipindah ke PostgreSQL)
app/auth.py      login (bcrypt, sesi di basis data)
app/main.py      API FastAPI
app/static/      tampilan (HTML, CSS, JS, Chart.js)
tests/           pengujian
```

Pindah ke PostgreSQL nanti: ganti `app/db.py` (koneksi dan placeholder `?` → `%s`) dan jenis kolom;
rumus dan tampilan tidak berubah.
