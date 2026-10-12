# Dashboard Monitoring & Disposisi Dokumen

Aplikasi web untuk melacak dokumen administrasi lintas departemen. Dalam beberapa
detik pengguna bisa tahu **dokumen ada di mana, siapa pemegangnya, approval sudah
sampai tahap mana, dan siapa yang sudah/belum tanda tangan**.

- Backend Node.js + database SQLite (file `data/disposisi.db`). Data tersimpan
  permanen di server, jadi tetap ada setelah browser ditutup atau saat login dari
  perangkat lain.
- **Tanpa dependency eksternal.** Cukup Node.js versi 22.5 atau lebih baru, tidak
  perlu `npm install`.
- Seluruh antarmuka berbahasa Indonesia. Tanggal ditampilkan dengan format
  `DD MMM YYYY` dan jam dalam WIB.

## Menjalankan

```bash
cd disposisi-dokumen
node server.js            # buka http://localhost:3000
```

Variabel lingkungan yang bisa diatur:

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `DATA_DIR` | `./data` | Lokasi database & file lampiran |
| `SEED_DEMO` | `1` | `0` = jangan isi data Demo saat database masih kosong |

Uji otomatis (skenario lengkap lewat API, termasuk restart server):

```bash
npm test
```

## Akun Demo

Semua akun demo memakai kata sandi `demo123`.

| Akun | Peran | Departemen |
|---|---|---|
| `admin` | Administrator | – |
| `rina`, `budi` | Staf, Approver | Administrasi Umum |
| `sari`, `hendra` | Staf, Approver | Keuangan (Finance) |
| `dimas`, `lina` | Staf, Approver | Hukum & Kepatuhan |
| `maya`, `agus` | Staf (Sekretaris), Approver (Direktur) | Direksi |
| `wati`, `yusuf` | Staf, Approver | Pengarsipan |
| `fajar`, `tono` | Staf, Approver | Proyek & Teknik |
| `rudi`, `nisa` | Staf, Approver | SDM |
| `andi` | Viewer | Satuan Pengawasan Intern |

Dokumen contoh diberi label **Demo**. Sebelum aplikasi dipakai untuk operasional,
hapus data ini lewat **Pengaturan Sistem → Data Demo**, lalu nonaktifkan akun demo
atau ganti kata sandinya.

## Fitur utama

- **Dashboard**: 6 kartu ringkasan yang bisa diklik (aktif, proses approval,
  menunggu TTD, dalam pengiriman, lewat tenggat, selesai pada periode), grafik
  status, distribusi per departemen pemegang, rata-rata waktu proses per
  departemen, tren masuk/selesai 12 bulan, dan daftar **Perlu Tindak Lanjut**.
  Setiap batang grafik bisa diklik untuk membuka daftar dokumennya.
- **Pelacak cepat** di bilah atas (tekan `/`): ketik nomor, judul, atau nama untuk
  langsung melihat posisi, pemegang, tahap approval, dan status TTD.
- **Register dokumen**: pencarian, filter (departemen, status, jenis, prioritas,
  rentang tanggal, keterlambatan, tanda tangan), pengurutan, pagination, serta
  ekspor Excel (.xlsx) dan CSV.
- **Detail dokumen**: panel *Posisi Dokumen Saat Ini*, petunjuk langkah
  berikutnya, progres approval per tahap, daftar penanda tangan, timeline
  kronologis, riwayat disposisi dan serah terima, lama proses per bagian,
  lampiran, serta riwayat versi dan revisi.
- **Disposisi**: status *Dalam Pengiriman* dibedakan dari *Sudah Diterima*.
  Selama penerimaan belum dikonfirmasi, dokumen tetap tercatat di departemen
  pengirim dan pengirim terakhir ditampilkan dengan jelas. Seluruh riwayat
  perpindahan disimpan, termasuk pengiriman yang dibatalkan.
- **Approval** yang bisa dikonfigurasi per jenis dokumen (admin). Tersedia aksi
  Setujui, Tolak, dan Minta Revisi. Saat diajukan ulang, versi dokumen naik dan
  putaran approval lama tetap tersimpan. Untuk dokumen fisik, approver baru bisa
  memutuskan setelah dokumen diterima di departemennya.
- **Tanda tangan**: dicatat per pihak (waktu, metode, bukti, pencatat). Fitur ini
  hanya **log administrasi**, bukan tanda tangan elektronik tersertifikasi.
- **Notifikasi dalam aplikasi** untuk kiriman masuk, permintaan konfirmasi
  penerimaan, approval/TTD yang menunggu, tenggat yang mendekat atau terlewati,
  serta penolakan dan permintaan revisi.
- **Laporan periode**: dokumen masuk, selesai, terlambat, tingkat ketepatan waktu,
  serta kinerja per departemen dan per jenis dokumen. Semua angka bisa diklik
  untuk melihat dokumen terkait. Tersedia juga cetak dan unduh CSV.

## Integritas data & keamanan

- Nomor dokumen dijaga unik oleh constraint database (tidak membedakan huruf
  besar/kecil).
- Data wajib divalidasi di server. Perubahan status hanya boleh mengikuti alur
  yang sah (Draf → Proses Approval → Disetujui → Selesai → Diarsipkan, dengan
  cabang Perlu Revisi dan Ditolak).
- **Optimistic locking** (`row_version`): kalau dua orang mengubah dokumen yang
  sama, perubahan kedua ditolak dengan pesan "data telah diubah pengguna lain",
  jadi tidak ada data yang tertimpa diam-diam.
- Setiap aksi tercatat di log aktivitas beserta pelaku, waktu, dan rincian
  perubahan. Pengarsipan tidak menghapus jejak proses.
- Hak akses diperiksa di backend, termasuk untuk dokumen *Terbatas* dan unduhan
  lampirannya.
- Kata sandi di-hash dengan scrypt. Sesi memakai cookie HttpOnly. Server juga
  memasang Content-Security-Policy dan perlindungan CSRF berbasis header.

## Struktur

```
server.js          server HTTP & routing API
src/db.js          skema database
src/service.js     logika bisnis, hak akses, laporan
src/seed.js        data Demo (dibuat lewat alur yang sama dengan aplikasi)
src/xlsx.js        penulis Excel/CSV tanpa library
public/            antarmuka (HTML, CSS, JS)
test/              uji skenario end-to-end
```

## Catatan deploy

Aplikasi ini perlu server Node.js yang berjalan terus, misalnya VM kantor, VPS,
Railway, atau Render dengan persistent disk. Aplikasi ini **tidak bisa** di-host
di GitHub Pages karena GitHub Pages hanya melayani file statis.

Lakukan backup rutin pada folder `DATA_DIR`, yang berisi database dan seluruh
lampiran. Untuk akses dari luar jaringan kantor, jalankan aplikasi di belakang
HTTPS (reverse proxy).
