# STEP E - Uji perekaman saat Zoom berjalan (CASE 3-7, data nyata di perangkat)

Status: **SIAP DIJALANKAN. Belum dieksekusi. Semua hasil = `PENDING`.**

## Tujuan dan batas
- Membuktikan (atau menyangkal) dua hal yang sampai sekarang HIPOTESIS: (1) suara peserta Zoom tertangkap sebagai `SYSTEM_AUDIO`; (2) seberapa bocor ke `LOCAL_MIC` pada headset vs speaker laptop.
- **Hanya Zoom pribadi buatan sendiri + suara simulasi. Bukan rapat perusahaan, bukan peserta sebenarnya.** Tidak ada audio diunggah atau di-commit; yang dikirim ke chat hanya JSON teks.
- Bukan Phase 1. Tidak memasang apa pun (tanpa ffmpeg/OBS). WASAPI native tetap jalur terpisah dan tidak mengubah hasil ini.
- Label sumber tetap `LOCAL_MIC` / `SYSTEM_AUDIO`. Hasil ini tidak membuktikan identitas pembicara.

## Cakupan terhadap CASE 1-7
| CASE | Dicakup oleh | Catatan |
|---|---|---|
| 1, 2 | Step B (sudah PASS) | tidak diulang |
| 3 Zoom aktif | fase 3 (peserta lain bicara) | `remoteInSystemDelta_dB` >= 10 dB |
| 4 Zoom + headset | uji #1 | |
| 5 Zoom + speaker | uji #2 | pemisahan hampir pasti POOR (Step B: isolasi 12,3 dB) |
| 6 Mic + sistem >= 5 menit | seluruh sesi (±5,5 menit, fase 6 = stabilitas 4 menit) | celah chunk, durasi, tab tersembunyi |
| 7 Pemisahan | sinyal: bocor mic<->sistem dalam dB | evaluasi leak berbasis transkrip (Whisper) **tidak** dilakukan di Step E; usulan opsional setelah hasil |

## Persiapan (sekali, ±10 menit)
1. **Zoom Desktop** dibuka, login akun pribadi. Klik **New Meeting / Meet Now** (Anda host, sendirian).
2. **HP** bergabung ke meeting itu lewat ID meeting (atau tautan undangan), sebagai peserta. **Pakai earphone di HP** supaya suara HP tidak terdengar langsung oleh mic laptop.
3. Suara "peserta lain": di HP, pilih **Share -> Screen**, aktifkan **Share device audio / sound**, lalu putar video/podcast **bahasa Indonesia** (isi publik, bukan rahasia). Alternatif: orang lain bicara dari ruangan berbeda.
4. Di Windows: **Pengaturan -> Sistem -> Suara**: output default = perangkat yang dipakai uji (headset atau speaker). Di Zoom **Settings -> Audio**: Speaker = *Same as System*. Mic Zoom boleh apa saja; halaman uji memakai mic default Windows.
5. Volume speaker ±50%, jangan diubah.

## Menjalankan
Di folder `phase0\tools` (Chrome atau Edge):
```
python -m http.server 8765
```
Buka `http://localhost:8765/step_e.html`. (Cara ini sama dengan Step B; jika `python` tidak dikenali, pakai `D:\phase0-work\venv\Scripts\python.exe -m http.server 8765`.)

**Uji #1 - Zoom + headset:** pilih skenario *Zoom + headset (kabel)*, isi "Output audio Zoom = default Windows", klik **Mulai**. Pilih **Seluruh layar** + centang **Bagikan audio sistem**. Ikuti instruksi layar: 5 dtk diam, 6 dtk nada (diam), 20 dtk HP bicara, 20 dtk Anda bicara, 12 dtk keduanya, lalu 4 menit ngobrol bebas lewat Zoom. Anda boleh pindah ke jendela Zoom; jangan tutup tab uji.
**Uji #2 - Zoom + speaker laptop:** cabut headset, output default = speaker laptop, pilih skenario *Zoom + speaker laptop*, ulangi.
(Opsional #3: headset Bluetooth.)

Setelah selesai: klik **Salin JSON**, tempel ke chat. Audio yang diunduh simpan di `results\step_e\`, **jangan dikirim**.

## Hasil
| Uji | Skenario | Capture | Pemisahan | Suara peserta di sistem (dB) | Bocor ke mic (nada/peserta, dB) | Suara Anda ke sistem (dB) | Celah maks (ms) |
|---|---|---|---|---|---|---|---|
| #1 | headset | PENDING | | | | | |
| #2 | speaker laptop | PENDING | | | | | |

## Aturan status (otomatis di halaman)
- Capture **FAIL**: nada halaman tidak tertangkap di track sistem, atau suara peserta Zoom < +10 dB di atas noise (biasanya output audio Zoom bukan default Windows), atau mic senyap. **PARTIAL**: bukan seluruh layar, suara Anda lemah, celah chunk > 2,5 dtk, atau durasi menyimpang > 3 dtk.
- Pemisahan **GOOD**: bocor mic <= 6 dB dan suara Anda ke sistem <= 3 dB. **POOR**: bocor >= 20 dB atau >= 10 dB. Selain itu **WEAK**.
- `speakerIdentityStatus`: `SOURCE_SEPARATION_OK_PER_TRACK` hanya jika GOOD; selain itu `UNRELIABLE_SOURCE_SEPARATION`. Keduanya BUKAN klaim identitas pembicara.

## Validasi alat (sandbox, sebelum diserahkan)
- `step_e.html` diuji di Chromium headless dengan sumber audio **tiruan** (6 skenario: headset bersih, speaker bocor, Zoom tidak tertangkap, tab-share, tanpa track sistem, suara Anda bocor ke sistem): status dan pemisahan sesuai harapan. Ini bukan Zoom sungguhan.
- **Belum terverifikasi:** perilaku Zoom nyata, `getDisplayMedia` dengan Zoom aktif, mode fast hanya untuk tes.

## Gate E
PENDING.
