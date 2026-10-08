# GUIDED EXECUTION — Device Validation Bertahap

Menggantikan alur "satu RUNBOOK 3–4 jam". `RUNBOOK.md` tetap ada sebagai referensi detail, tetapi **urutan dan gerbangnya diatur di sini**.

Tujuan: risiko troubleshooting terisolasi per langkah, dan kamu tidak perlu menghabiskan berjam-jam sebelum tahu ada masalah.

## Aturan umum

1. **Satu langkah, lalu berhenti.** Setiap langkah berakhir di *Gate*. Langkah berikutnya tidak disiapkan atau dijalankan sebelum kamu mengirim hasil dan saya menyatakan Gate dibuka.
2. **Data sintetis saja.** Tidak ada rapat perusahaan, tidak ada dokumen kantor.
3. **Kirim teks, bukan audio.** JSON/TXT/CSV/pesan error. Rekaman tidak pernah dikirim atau di-commit.
4. **Error disalin apa adanya (verbatim).** Jangan memperbaiki sendiri dengan workaround berlapis. Berhenti dan lapor.
5. **Tidak ada instalasi** sampai langkah yang memang meminta instalasi (Step C).
6. Tidak ada kode produksi. Tidak ada Phase 1.

## Format laporan tiap langkah

Setiap langkah saya laporkan dengan bentuk yang sama:

| Bagian | Isi |
|---|---|
| **STATUS** | `PASS` / `PARTIAL` / `FAIL` / `BLOCKED` |
| **EVIDENCE** | Angka, nama perangkat, keluaran yang kamu kirim |
| **ERROR** | Pesan error apa adanya, atau "tidak ada" |
| **INTERPRETATION** | Apa artinya bagi keputusan (dengan label VERIFIED / DESK / UNKNOWN) |
| **NEXT ACTION** | Satu langkah berikutnya, atau perbaikan yang diminta |

Arti status: **PASS** = kriteria langkah terpenuhi. **PARTIAL** = jalan sebagian / ada catatan. **FAIL** = dicoba dan tidak berhasil. **BLOCKED** = tidak bisa dicoba (izin, kebijakan, perangkat tidak ada, jaringan).

## Peta langkah

| Step | Nama | Isi | Instalasi? | Gate |
|---|---|---|---|---|
| **A** | System Inventory | Baca info perangkat (skrip PowerShell, hanya-baca) | Tidak | **SEDANG DISIAPKAN** |
| B | Audio Capture Smoke Test | Bukti: MIC terekam · SYSTEM AUDIO terekam · MIC+SYSTEM bersamaan (audio non-Zoom). Halaman uji browser + skrip WASAPI (non-Zoom dulu) | Tidak/ringan | Belum disiapkan |
| C | faster-whisper Environment | Python venv, pasang paket, uji unduh model langsung dari laptop | Ya (venv) | Belum disiapkan |
| D | First Transcription | Satu file simulasi, model `small`, satu evaluasi | Tidak | Belum disiapkan |
| E | Full CASE 1–7 | Zoom Desktop, headset, speaker laptop, pemisahan track | Tidak | Belum disiapkan |
| F | Final Benchmark | `small` → `medium` → model besar hanya jika hardware layak | Tidak | Belum disiapkan |

**Hanya Step A yang disiapkan sekarang.** Spesifikasi B–F di bawah adalah *ketentuan* yang sudah saya catat dari arahanmu, bukan alat yang sudah ada.

---

## STEP A — System Inventory (siap dijalankan)

**Skrip:** `rencana-ai-asisten/phase0/phase0_system_inventory.ps1`

**Sifat:** hanya membaca. Tidak mengubah pengaturan, tidak menginstal, tidak ada koneksi jaringan, tidak perlu Administrator (jangan dijalankan sebagai Administrator).

**Yang dibaca:** versi Windows · CPU (+ AVX/AVX2/AVX512 bila bisa) · RAM · GPU, VRAM (registry), driver · NVIDIA/CUDA terlihat atau tidak (`nvidia-smi`, hanya nama/VRAM/driver/versi CUDA) · versi Python, pip, ffmpeg, py launcher · ruang disk · perangkat audio playback & recording · **default** mic dan output (console dan communications) · Stereo Mix ada/tidak · versi Zoom, OBS, Chrome, Edge · power plan & baterai · execution policy & Language Mode.

**Yang tidak diambil:** username, hostname, domain, password, serial number, IP, MAC, UUID perangkat, path folder profil, daftar proses/file. Sebagai pengaman, nilai username/hostname/profil milik komputermu otomatis diganti `<redacted>` sebelum file ditulis. Satu-satunya yang ditulis: dua file hasil di folder `results/` (yang di-ignore git).

**Catatan keterbatasan (jujur):** skrip ditulis tanpa akses Windows dan belum pernah dijalankan. Jika ada bagian yang gagal, bagian lain tetap jalan dan error ditampilkan apa adanya. Status keseluruhan `PARTIAL` adalah hasil yang sah dan berguna.

### Cara menjalankan (4 langkah)

1. **Ambil foldernya.** Di GitHub, buka branch `claude/practical-meitner-er7j5t` repo `andipurwoko7-lgtm/reality-check` → **Code → Download ZIP** → ekstrak. (Atau `git pull` jika sudah punya klonnya.)
2. **Buka PowerShell biasa** (Start → ketik `PowerShell` → Enter). **Bukan** "Run as administrator".
3. **Masuk ke folder dan jalankan** (ganti path sesuai lokasi ekstrak):
   ```powershell
   cd "C:\path\ke\reality-check\rencana-ai-asisten\phase0"
   powershell -NoProfile -ExecutionPolicy Bypass -File .\phase0_system_inventory.ps1
   ```
   `-ExecutionPolicy Bypass` berlaku hanya untuk proses ini; tidak mengubah pengaturan komputer.
4. **Kirim kembali** ke saya salah satu:
   - isi `results\phase0_system_inventory.json` (ideal), atau
   - isi `results\phase0_system_inventory.txt` (tempel), atau
   - jika skrip tidak bisa jalan: **pesan error persis** + hasil `$PSVersionTable.PSVersion` dan `$ExecutionContext.SessionState.LanguageMode`.

Sebelum mengirim, buka file `.txt` dan pastikan tidak ada yang tidak ingin kamu bagikan.

**Jika kebijakan komputer memblokir skrip** (mis. pesan "running scripts is disabled" atau "blocked by group policy"): itu sendiri adalah temuan (status `BLOCKED`, relevan untuk pertanyaan P11 di Policy Checklist). Jangan mencari cara mengakalinya. Laporkan pesannya.

### Kriteria Step A

| Status | Kondisi |
|---|---|
| PASS | Semua bagian inventaris terbaca |
| PARTIAL | Sebagian bagian gagal tetapi Windows, CPU, RAM terbaca |
| FAIL | Windows/CPU/RAM tidak terbaca |
| BLOCKED | Skrip tidak boleh/bisa dijalankan (kebijakan, PowerShell tidak tersedia) |

**Setelah kamu mengirim hasil:** saya menafsirkan (RAM/CPU/GPU → model Whisper yang realistis; AVX2 → kecepatan CPU; default device & Bluetooth → risiko Step B/E; versi Python/pip → rencana Step C) dan melaporkan dengan format STATUS/EVIDENCE/ERROR/INTERPRETATION/NEXT ACTION. **Baru setelah itu** Step B disiapkan.

> ## STOP FOR DEVICE REVIEW

---

## Ketentuan untuk langkah berikutnya (belum disiapkan)

### Step B — Audio Capture Smoke Test
- Tujuan minimal: buktikan **MIC** terekam, **SYSTEM AUDIO** terekam, dan **MIC+SYSTEM** terekam bersamaan. Sumber suara sistem: video/musik/nada uji non-Zoom.
- Baru setelah lulus: Zoom Desktop, headset, speaker laptop (masuk Step E).
- `record_dual_wasapi.py` **hanya cek sintaks**, belum terbukti. Diuji pertama kali pada audio non-Zoom. Jika gagal: catat error verbatim, tanpa workaround berlebihan.
- Data hanya sintetis/simulasi.

### Step C — faster-whisper Environment
- Pasang di venv terpisah, tanpa menyentuh Python sistem.
- **Uji unduh model langsung dari laptop.** Kegagalan 403 di cloud tidak berarti laptop juga gagal.
- Jika HuggingFace diblok di laptop: alternatif resmi dan aman saja — (1) minta IT mengizinkan `huggingface.co`; (2) unduh berkas model dari halaman resmi repo model di jaringan yang diizinkan lalu pindahkan manual (USB) ke folder lokal dan jalankan dengan jalur lokal; (3) jaringan lain yang sah (mis. hotspot pribadi) jika kebijakan membolehkan. **Tidak memakai situs mirror pihak ketiga yang tidak tepercaya.**
- Catat pasangan versi hasil `pip freeze` dari lingkungan yang benar-benar jalan.

### Step D — First Transcription
- Satu file simulasi, model `small`, satu kali evaluasi.

### Step E — Full CASE 1–7
- Seperti di `RUNBOOK.md` Langkah 3–4, tetapi hanya setelah Gate B dan D terbuka.

### Step F — Final Benchmark
- **Urutan:** `small` → `medium` → model besar **hanya jika hardware layak** (keputusan setelah Step A dan D).
- File uji yang sama untuk semua model.
- Catat per model:

| Field | Keterangan |
|---|---|
| model | nama model |
| device | cpu / cuda |
| compute_type | mis. int8, float16 |
| audio_duration | detik |
| processing_time | detik |
| real_time_factor | processing_time ÷ audio_duration |
| peak RAM | MB, bila bisa diukur |
| peak VRAM | MB, bila bisa diukur |
| WER | mentah, dan setelah normalisasi angka |
| notes | halusinasi, salah bahasa, dll. |

---

## Kebijakan dependensi

**Status semua pin versi di Phase 0: `PHASE0_TEST_PIN`. Bukan dependency produksi.**

`av<17` yang saya catat sebelumnya hanya temuan dari sandbox Linux, bukan keputusan. Versi yang dipakai di produksi ditentukan nanti dari lingkungan Windows yang benar-benar teruji.

Pasangan versi yang akan dicatat setelah Step C (kolom Windows diisi dari laptopmu):

| Komponen | Sandbox Linux (acuan, bukan keputusan) | Windows (diisi di Step C) |
|---|---|---|
| Python | 3.13.16 | ? |
| faster-whisper | 1.2.1 | ? |
| ctranslate2 | 4.8.2 | ? |
| av | 19.0.1 **gagal**; 15.1.0 dan 16.0.1 **berfungsi** (hanya jalur `decode_audio`) | ? |
| torch | tidak dipakai | tidak dipasang kecuali terbukti perlu |
| CUDA / cuDNN | tidak ada GPU | hanya jika Step A menunjukkan NVIDIA dan Step F membutuhkannya |

**Tidak ada yang dipasang pada Step A.**
