# Reality Check — Kalkulator Investasi

Kalkulator investasi berbasis web yang menghitung nilai skema "return harian"
sekaligus menguji apakah janji imbal hasilnya masuk akal secara matematis.

Satu file HTML, tanpa dependency, tanpa backend, tanpa tracking. Bisa dipasang
di homescreen HP sebagai aplikasi (PWA) dan tetap jalan tanpa internet.

## Cara publish jadi link (GitHub Pages, gratis)

Semua langkah bisa dikerjakan lewat browser — tidak perlu install Git.

1. Buka [github.com/new](https://github.com/new), buat repository baru.
   Nama bebas, misalnya `reality-check`. Pilih **Public**.
   Jangan centang "Add a README file".
2. Di halaman repo yang baru dibuat, klik **uploading an existing file**.
3. Drag semua isi folder ini ke area upload:
   `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`,
   `icon-512.png`, `apple-touch-icon.png`, `README.md`.
   Klik **Commit changes**.
4. Masuk ke tab **Settings** → menu **Pages** di sidebar kiri.
5. Di bagian *Build and deployment* → *Source*, pilih **Deploy from a branch**.
   Branch: **main**, folder: **/ (root)**. Klik **Save**.
6. Tunggu 1–2 menit, refresh halaman itu. Link-nya akan muncul di atas, formatnya:
   `https://<username-anda>.github.io/reality-check/`

Setiap kali file diubah dan di-commit, situsnya ikut update otomatis.

## Pasang di homescreen HP

**Android (Chrome)** — buka link-nya, tap menu titik tiga → **Add to Home screen**
→ **Install**. Ikon muncul di homescreen, dibuka full screen tanpa address bar.

**iPhone (harus Safari, bukan Chrome)** — buka link-nya di Safari, tap tombol
Share (kotak dengan panah ke atas) → scroll → **Add to Home Screen** → **Add**.

Setelah dibuka sekali, aplikasinya tersimpan di HP dan tetap bisa dipakai
walaupun sedang tidak ada internet.

## Alternatif hosting tanpa akun GitHub

- **Netlify Drop** — buka [app.netlify.com/drop](https://app.netlify.com/drop),
  drag folder ini ke halamannya. Link langsung jadi dalam hitungan detik.
- **Cloudflare Pages** — Direct Upload, prinsipnya sama.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html` | Seluruh aplikasi: UI, logika perhitungan, dan grafik |
| `manifest.webmanifest` | Metadata PWA (nama, ikon, warna, mode standalone) |
| `sw.js` | Service worker — bikin aplikasi jalan offline |
| `icon-192.png`, `icon-512.png` | Ikon aplikasi untuk Android |
| `apple-touch-icon.png` | Ikon aplikasi untuk iOS |

## Sumber angka pembanding

- Suku bunga deposito bank BUMN per 20 Juli 2026 — CNBC Indonesia
- Kupon ORI029 (5,45% tenor 3 tahun / 5,80% tenor 6 tahun) — Bareksa
- PDB Indonesia 2025 sebesar Rp 23.821 triliun — BPS / CNBC Indonesia
- Kontak OJK 157 dan WhatsApp 081-157-157-157 — OJK

## Catatan

Alat ini dibuat untuk edukasi dan bukan nasihat investasi. Angka imbal hasil
IHSG dan Berkshire Hathaway adalah rata-rata historis jangka panjang — hasil
sebenarnya berfluktuasi dan bisa negatif pada tahun tertentu.
