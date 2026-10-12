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
| **A** | System Inventory | Baca info perangkat (skrip PowerShell, hanya-baca) | Tidak | **PASS. Gate A disetujui 9 Okt 2026** |
| **B** | Audio Capture Smoke Test | MIC, SYSTEM AUDIO, MIC+SYSTEM bersamaan (audio non-Zoom) | Tidak | **PASS. Gate B disetujui 12 Okt 2026** (pemisahan POOR pada speaker laptop; Zoom belum terbukti) |
| **C** | faster-whisper Environment Validation | venv Python 3.12 terisolasi, pasang dependensi, unduh model `small`, muat model, inferensi minimal | Ya (venv + model) | **PASS. Gate C disetujui 12 Okt 2026** (`PHASE0_TEST_PIN av<17`; percobaan 1 tanpa pin FAIL di C4; lihat `STEP_C_REPORT.md`) |
| **D** | First Transcription | Satu rekaman simulasi berbahasa Indonesia, model `small`, satu konfigurasi, satu evaluasi terhadap ground truth | Tidak | **Gate D disetujui 12 Okt 2026**: pipeline PASS, kualitas PARTIAL (`STEP_D_REPORT.md`). Pemilik menyetujui urutan F sebelum E |
| E | Full CASE 1–7 | Zoom Desktop, headset, speaker laptop, pemisahan track | Tidak | Ditunda sampai Gate F (belum disiapkan) |
| **F** | Benchmark | Rekaman Step D yang sama: `small` → `medium` (→ besar hanya jika diminta); 3 varian (bahasa id / prompt glosarium / bahasa auto) | Ya (unduh model medium ±1,5 GB) | **SIAP DIJALANKAN** (`step_f_run.ps1`, lihat `STEP_F_REPORT.md`) |

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

## STEP B — Audio Capture Smoke Test (siap dijalankan)

**Alat:** `phase0/tools/step_b.html` (satu halaman; dilayani server bawaan Python `http.server`, tanpa instalasi). Laporan: `phase0/STEP_B_REPORT.md`. Folder hasil: `phase0/results/step_b/` (audio di-ignore git; hanya metadata yang boleh masuk repo).

**Kebijakan:** tanpa instalasi apa pun (bukan ffmpeg, OBS, faster-whisper, ctranslate2, PyAV, CUDA, driver, atau library lain). Audio simulasi saja. Tanpa Zoom. Tanpa Bluetooth. Tanpa headset berkabel.

| Uji | Isi | PASS jika |
|---|---|---|
| B1 Mic | Mic default (Microphone Array Intel), baca kalimat simulasi ±25 dtk | File terbentuk, durasi benar (±3 dtk), peak ≥ −30 dBFS, clipping ≤ 1%, suara aktif ≥ 25% jendela, terdengar jelas (penilaian manual) |
| B2 Sistem | Berbagi **seluruh layar** + audio sistem; nada 1 kHz dari halaman, lalu audio dari aplikasi lain | Track audio ada, nada tertangkap (≥ 15 dB di atas noise), surface = monitor, audio aplikasi lain tertangkap |
| B3 Dual | Mic + sistem bersamaan, **dua file terpisah**; 4 fase: diam, nada (diam), bicara, bicara + nada | Kedua track terisi bersamaan, tanpa celah > 2,5 dtk, durasi benar. **Kualitas pemisahan dilaporkan terpisah** (GOOD ≤ 6 dB bocor, POOR ≥ 20 dB) |
| WASAPI | `record_dual_wasapi.py` hanya dicek ketergantungannya (PyAudioWPatch) | Jika library tidak ada: **BLOCKED_BY_DEPENDENCY**, tidak dipaksa |

**Gate B PASS minimal:** mic terekam + audio sistem terekam + keduanya bersamaan. Pemisahan track adalah target ideal; jika hanya mixed, maksimum PARTIAL. Jika audio sistem tidak terekam: FAIL/BLOCKED dan berhenti.

**Terverifikasi (di sandbox, sinyal sintetis):** logika penilaian halaman diuji pada 8 skenario (bersih, speaker bocor, hanya tab, tanpa track audio, izin ditolak, mic senyap, clipping, suara mic masuk ke sistem). Semua vonis sesuai harapan. Ini membuktikan **alatnya**, bukan perangkatmu.

> ## STOP FOR DEVICE REVIEW (Gate B)

---

## STEP C — faster-whisper Environment Validation (siap dijalankan)

**Alat:** `phase0/step_c_whisper_env.ps1` (orkestrator) + `phase0/tools/step_c_smoke.py` (uji di dalam venv). Laporan: `phase0/STEP_C_REPORT.md`. Hasil: `phase0/results/step_c/`.

**Cakupan sempit:** hanya membuktikan lingkungan bekerja. **Bukan** benchmark kualitas, bukan uji istilah finance, bukan rapat panjang. Step D belum dimulai.

| Sub-gate | Isi | PASS jika |
|---|---|---|
| C1 | Buat venv Python **3.12** (bukan default 3.14) | `py -3.12` ada dan venv terbentuk |
| C2 | Cek pip; naikkan hanya jika `-UpgradePip` | versi pip tercatat (default: tidak dinaikkan) |
| C3 | `pip install faster-whisper` (tanpa pin, apa adanya) | exit code 0; `pip freeze` disimpan |
| C4 | Import paket + uji **decode audio** (PyAV) + dukungan `int8` di CPU | semua import OK, decode OK, `int8` didukung |
| C5 | Unduh model **`small`** dari Hugging Face resmi (`Systran/faster-whisper-small`) + cocokkan SHA-256 dengan metadata Hub | berkas lengkap dan checksum cocok. Jika diblok: **BLOCKED**, error dicatat apa adanya |
| C6 | Muat model: `device=cpu`, `compute_type=int8`, `local_files_only` | model termuat |
| C7 | Transkripsi minimal pada audio sintetis (suara TTS Windows lokal, non-rahasia) | teks tidak kosong dan ≥40% kata cocok (smoke test, bukan akurasi) |

**Berurutan dan berhenti di kegagalan pertama.** Tidak ada yang dilompati.

**Kebijakan:**
- Python global tidak diubah. Semua paket hanya masuk ke venv.
- **Lokasi venv dan model: `D:\phase0-work` (pendek, di luar repo).** Alasan terukur: berkas terdalam paket yang akan dipasang (127 karakter) ditambah path venv di dalam folder phase0 ±302 karakter, melewati batas path Windows 260 karakter. Ini berbeda dari contoh `phase0/.venv-whisper`.
- Hanya model `small`. Tidak ada medium/large. Tidak ada ffmpeg (PyAV membaca WAV sendiri).
- Pin versi (`-AvPin`) hanya bila diminta setelah review, berstatus **PHASE0_TEST_PIN**, bukan dependency produksi.
- Audio sintetis TTS Windows. Tidak ada audio perusahaan, tidak ada audio ke cloud AI. Inferensi lokal.
- Akses jaringan: pip (`pypi.org`, `files.pythonhosted.org`) dan unduh model (`huggingface.co` dan CDN-nya). Tanpa mirror tidak tepercaya.

**Terverifikasi di sandbox (Linux):** deteksi kegagalan C4 pada `av` bermasalah (instalasi tanpa pin → `av 19.0.1` → FAIL dengan pesan error apa adanya) dan PASS pada `av` yang berfungsi; C5 memetakan jaringan yang memblokir menjadi BLOCKED dengan 403 apa adanya; verifikasi checksum (cocok, sha salah, berkas hilang, ukuran salah); C6 gagal-bersih tanpa menyentuh jaringan. **Belum terverifikasi:** C1, C2, C3 di Windows, serta C6/C7 dengan model nyata (model tidak bisa diunduh di sandbox). Skrip PowerShell hanya dicek statis dan belum pernah dijalankan.

> ## STOP FOR DEVICE REVIEW (Gate C)

---

## STEP D — First Transcription (siap dijalankan)

**Alat:** `phase0/step_d_run.ps1` (pembungkus) + `phase0/tools/step_d_transcribe.py`. Naskah baca: `phase0/test_data/naskah_baca_stepd.txt`. Laporan: `phase0/STEP_D_REPORT.md`. Hasil: `phase0/results/step_d/`.

**Pertanyaan yang dijawab:** seberapa baik model `small` pada **suara Indonesia nyata** (campur istilah Inggris, angka, nama, singkatan finance), diukur terhadap ground truth, bukan berdasarkan kesan. Ini belum benchmark: model lain, prompt glosarium, dan bahasa `auto` dibandingkan di Step F.

**Kebijakan:**
- **Tanpa instalasi apa pun** dan **tanpa jaringan** (model dimuat dari disk, `local_files_only`). ffmpeg tidak dibutuhkan: PyAV membaca `.m4a`, `.wav`, `.mp3`, `.webm`, `.ogg` (diuji di sandbox).
- Audio = **suaramu membaca naskah fiktif**. Bukan rapat kantor, bukan audio sistem, bukan Zoom. Audio tidak disalin dan tidak dikirim; `*.m4a`/`*.wav` di-ignore git.
- Satu konfigurasi: `language=id` (dipaksa), `beam_size=5`, VAD aktif, tanpa prompt, `condition_on_previous_text=False`.
- **Transkrip mentah tidak diubah**: disimpan terpisah, read-only, dengan SHA-256. Versi "bersih" bukan bagian Step D (Phase 4); alat hanya mengekstrak fakta angka sebagai data terstruktur di samping teks asli.

**Cara merekam (sekitar 6 menit):**
1. Ruangan sepi; kurangi kipas/AC bila bisa (noise floor mic-mu −44 dBFS di Step B). Charger terpasang. Jarak ke laptop ±30-40 cm. Tutup Zoom dan aplikasi yang berbunyi.
2. Buka `phase0\test_data\naskah_baca_stepd.txt` di Notepad. Isinya 20 paragraf = 20 giliran bicara tanpa nama pembicara. Baca **semua** berurutan, **sendirian untuk semua peran**, tempo normal, jeda 2-3 detik antar paragraf. Angka dibaca seperti tertulis (dalam kata).
3. Rekam dengan **Perekam Suara Windows** (Start, ketik "Sound Recorder" atau "Perekam Suara"; mic default = Microphone Array). Tekan rekam, baca, stop. Berkas `.m4a` biasanya di `Documents\Sound Recordings`.
4. Dengarkan sebentar. Catat jika ada kalimat yang terlewat atau diulang (penyimpangan dari naskah mempengaruhi WER).

**Menjalankan** (di folder `phase0`; ZIP terbaru diperlukan karena file Step D baru):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\step_d_run.ps1 -Audio "C:\path\ke\rekaman.m4a" -Notes "catatan penyimpangan, boleh kosong"
```

| Sub-gate | PASS jika |
|---|---|
| D1 | Audio terbaca (decode), ≥ 10 detik, tidak senyap |
| D2 | Transkripsi selesai tanpa error; waktu, RTF, puncak RAM tercatat |
| D3 | Bahasa terdeteksi `id` dengan probabilitas ≥ 0,8 |
| D4 | Transkrip mentah + segmen tersimpan; SHA-256 tercatat |
| D5 | Evaluasi terhadap ground truth terhitung (WER, WER normalisasi angka, CER, istilah per kategori, angka, tanggal) |

**Kualitas dilaporkan terpisah dari lulus-tidaknya pipeline,** dibandingkan dengan ambang Phase 0 dari RENCANA §10.5 (tidak diubah): WER (setelah normalisasi angka) ≤ 20%, istilah ≥ 90%, angka ≥ 95% (atau salah-terflag). Hasilnya `MEETS` / `PARTIAL` / `BELOW` (deskriptif). Segmen yang meragukan hanya ditandai `NEEDS_REVIEW`, tidak ditebak.

**Terverifikasi di sandbox:** decode lima format audio; alur D1-D5 dengan mesin tiruan (bukan hasil Whisper); transkrip mentah read-only dan checksum konsisten; jalan ulang ke folder yang sama; gagal-bersih pada audio rusak. **Belum terverifikasi:** seluruh Step D pada model nyata dan suara nyata; skrip PowerShell hanya dicek statis dan belum pernah dijalankan; pengukuran puncak RAM di Windows (`ctypes`) belum teruji.

> ## STOP FOR DEVICE REVIEW (Gate D)

---

## Ketentuan untuk langkah berikutnya (belum disiapkan)

### Step E — Full CASE 1–7
- Seperti di `RUNBOOK.md` Langkah 3–4, tetapi hanya setelah Gate B dan D terbuka.

### Step F — Benchmark (SUDAH DISIAPKAN, lihat `STEP_F_REPORT.md`; ringkasan lama di bawah hanya konteks)
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
| Python | 3.13.16 | **3.12.10** |
| faster-whisper | 1.2.1 | **1.2.1** |
| ctranslate2 | 4.8.2 | **4.8.2** |
| av | 19.0.1 **gagal**; 15.1.0, 16.0.1, 16.1.0, 17.1.0, 18.1.0 berfungsi (jalur `decode_audio`, Linux) | 19.0.1 **gagal**; **16.1.0 berfungsi** (`PHASE0_TEST_PIN av<17`). 17.x/18.x belum diuji di Windows |
| torch | tidak dipakai | tidak dipasang kecuali terbukti perlu |
| CUDA / cuDNN | tidak ada GPU | hanya jika Step A menunjukkan NVIDIA dan Step F membutuhkannya |

**Tidak ada yang dipasang pada Step A.**
