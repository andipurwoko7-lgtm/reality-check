# PHASE 0 REPORT — Discovery, Policy Check, Technical Proof of Concept

Tanggal: 8 Oktober 2026 · Baseline: `RENCANA_PEMBANGUNAN.md` v1.1 · Status: **Phase 0 PARSIAL — verdict CONDITIONAL GO tetap berlaku; eksekusi di laptop dipecah Step A–F dengan gerbang review (lihat `phase0/GUIDED_EXECUTION.md`). Gate A menunggu hasil inventaris.**

**Label status yang dipakai di seluruh laporan** (supaya tidak ada klaim yang tampak seperti hasil uji padahal bukan):

| Label | Arti |
|---|---|
| `VERIFIED` | Dijalankan sungguhan di lingkungan sandbox ini, hasilnya terlihat |
| `SMOKE` | Logika dites dengan perangkat palsu/sinyal sintetis. Bukan bukti untuk perangkat nyata |
| `DESK` | Analisis dari pengetahuan umum. **Belum diuji**; perlakukan sebagai hipotesis |
| `NOT RUN` | Butuh laptop/HP/orang kamu. Belum dijalankan |
| `UNKNOWN` | Informasi dari kamu/kantor yang belum ada. Tidak ditebak |

---

## 1. Executive Summary

**Yang saya kerjakan.**
1. Verifikasi git dan review konsistensi `RENCANA_PEMBANGUNAN.md` (8 perbaikan, tercatat di Changelog v1.1 dokumen itu).
2. Membangun **kit uji Phase 0** yang sekali pakai di `rencana-ai-asisten/phase0/`: skrip rapat simulasi + ground truth, halaman uji perekaman browser (CASE 1–7), skrip benchmark faster-whisper, evaluator transkrip (WER, istilah, angka, kebocoran antar-track), parser angka/rupiah, runbook langkah demi langkah.
3. Memverifikasi **alat ujinya sendiri** sebelum diserahkan ke kamu (bagian 11, 14, 15).

**Yang TIDAK bisa saya buktikan dari sini, dan kenapa.**
Sandbox ini adalah container cloud Linux tanpa GPU. Ia tidak punya Zoom, headset, speaker, atau laptop Windows-mu, dan jaringan memblokir `huggingface.co` (model Whisper tidak bisa diunduh). Jadi **semua pertanyaan inti Phase 0 (kelayakan rekam Zoom, kualitas transkripsi Indonesia, kecepatan di laptopmu) belum terjawab.** Saya tidak mengisi angka tebakan.

**Temuan nyata sejauh ini:**

| # | Temuan | Status |
|---|---|---|
| F1 | `faster-whisper 1.2.1` rusak dengan `av` terbaru (19.x): `unexpected keyword argument 'metadata_errors'`. `av` 15.1.0/16.0.1 berfungsi. Pin versi hanya `PHASE0_TEST_PIN`, bukan dependency final; pasangan versi Windows ditentukan di Step C | VERIFIED (Linux) |
| F2 | Parser angka deterministik memberi hasil benar untuk 11 kelompok kasus (termasuk "empat ratus sembilan puluh lima miliar rupiah" → Rp495 miliar) dan **tidak mengarang** mata uang/angka ambigu. Tes menemukan 1 bug (skala sesudah desimal) yang sudah diperbaiki | VERIFIED |
| F3 | Evaluator mengukur dengan benar: ground truth vs dirinya = WER 0 / fakta 100%; transkrip yang sengaja dirusak turun sesuai; kebocoran mic terdeteksi (0% vs 36%) | VERIFIED |
| F4 | Logika graf audio halaman uji memisahkan mic/sistem: file stereo menaruh sinyal mic di kiri dan sistem di kanan, file `mic` dan `system` terpisah murni | SMOKE (sinyal sintetis) |
| F5 | Browser capture menangkap **seluruh audio sistem**, bukan hanya Zoom (notifikasi, musik, panggilan lain ikut) dan memaksa berbagi layar. Ini isu privasi desain, bukan bug | DESK |
| F6 | Speaker laptop hampir pasti membuat suara peserta bocor ke mic. Asumsi "mic = hanya Andi" hanya aman dengan headset. Halaman uji punya uji nada otomatis untuk mengukurnya | DESK + alat siap |

**Verdict sementara: CONDITIONAL GO** (bagian 20), artinya **bukan** izin masuk Phase 1. Tidak ada temuan yang membuktikan ide ini mustahil. Beberapa blocker yang harus ditutup dulu: kebijakan kantor, uji perekaman di laptop nyata, benchmark Whisper di laptop nyata.

---

## 2. Hardware / Environment

### 2.1 Sandbox (tempat alat diverifikasi)
| Item | Nilai |
|---|---|
| OS / Python | Linux 6.18, Python 3.13.16 |
| CPU / RAM / GPU | 4 vCPU, 15,7 GB, **tanpa GPU** |
| ffmpeg | Ada |
| Browser uji | Chromium (Playwright 1.56), perangkat audio palsu |
| faster-whisper / ctranslate2 | 1.2.1 / 4.8.2 (terpasang di venv sementara) |
| Jaringan | PyPI ✓, **HuggingFace ✗ (403/ditolak kebijakan jaringan)** → model Whisper tidak bisa diunduh |

Benchmark di sandbox ini **tidak mewakili laptopmu** walaupun jaringan dibuka, jadi saya tidak menjadikannya sumber angka.

### 2.2 Laptop & HP pengguna — `UNKNOWN`
Isi tabel Langkah 0 di `phase0/RUNBOOK.md` (Windows, CPU, RAM, GPU, Chrome/Edge, Zoom, headset, HP). Spesifikasi ini menentukan model Whisper yang realistis.

---

## 3. Policy Checklist

Checklist, bukan opini hukum. Saya tidak tahu kebijakan kantormu, jadi **semua `UNKNOWN`**.

Aturan sementara sampai terjawab: **Phase 0 hanya memakai data simulasi** (fiktif). Tidak ada rapat kantor yang direkam/ditranskrip.

| # | Pertanyaan: apakah pengguna diperbolehkan… | Status | Tanya siapa | Bukti yang dicatat |
|---|---|---|---|---|
| P1 | merekam rapat? | UNKNOWN / NEEDS_CONFIRMATION | Atasan, legal/kepatuhan | Dokumen kebijakan / email konfirmasi |
| P2 | menyimpan recording? (di mana, berapa lama) | UNKNOWN | Kepatuhan, IT | |
| P3 | melakukan speech-to-text **lokal**? | UNKNOWN | IT/security | |
| P4 | menyimpan transcript? | UNKNOWN | Kepatuhan | |
| P5 | menyimpan transcript di **perangkat pribadi**? | UNKNOWN | IT/security | |
| P6 | mengirim transcript ke **AI cloud**? Penyedia mana? | UNKNOWN | IT/security, legal | |
| P7 | mengirim **dokumen kantor** ke AI cloud? | UNKNOWN | IT/security | |
| P8 | memakai **Google Drive pribadi** untuk data kerja? | UNKNOWN | IT/security | |
| P9 | memakai **cloud database pribadi** (VPS pribadi)? | UNKNOWN | IT/security | |

Tambahan yang sebaiknya ditanyakan (belum ada di daftarmu):

| # | Pertanyaan | Status |
|---|---|---|
| P10 | Apakah peserta rapat harus diberi tahu/menyetujui perekaman? Format persetujuannya? | UNKNOWN |
| P11 | Apakah laptop kantor boleh dipasang Python/OBS/recorder lokal? (menentukan opsi perekam) | UNKNOWN |
| P12 | Klasifikasi informasi (rahasia/terbatas/umum): rapat jenis apa yang termasuk apa? | UNKNOWN |
| P13 | Aturan IP di kontrak kerja jika alat ini nanti dikembangkan jadi produk/jasa | UNKNOWN |
| P14 | Boleh menghubungkan kalender/email kantor ke aplikasi pihak ketiga (OAuth)? Apakah admin harus menyetujui? | UNKNOWN |

**Dampak jawaban pada desain:**
- P1/P4 = tidak → fitur rekam dihapus dari MVP; sisa proyek jadi asisten tugas/catatan (nilai jauh lebih kecil). Ini **NO-GO** untuk konsep rapat.
- P6 = tidak → LLM lokal saja (kualitas turun) atau ringkasan manual.
- P5/P9 = tidak → semua di laptop kantor, tanpa VPS pribadi (Opsi A di RENCANA §7.2).
- P11 = tidak → perekam lokal tidak mungkin; pilihan sisa browser capture atau upload file dari perekam lain.

---

## 4. Calendar Discovery

**Status: `UNKNOWN`.** Belum ada integrasi (sesuai arahan). Cukup identifikasi.

Cara menentukan dalam 5 menit:
1. Buka kalender kerjamu di browser. Alamat `calendar.google.com` = Google. `outlook.office.com/calendar` atau `outlook.office365.com` = Microsoft 365. `outlook.live.com` = Outlook pribadi.
2. Undangan rapat masuk dari mana dan tombol "Terima" berbunyi apa (Outlook vs Google)? Link rapat Teams/Zoom/Meet?
3. Apakah kamu punya dua kalender (kantor + pribadi)? Mana yang dipakai untuk jadwal kerja sehari-hari?

| Kandidat | Gejala | Dampak |
|---|---|---|
| Google Calendar | Kantor memakai Google Workspace, atau kamu menyalin jadwal kerja ke Gmail pribadi | Integrasi sesuai RENCANA §15.5 |
| Microsoft 365 / Outlook | Domain kantor di Outlook | Perlu Microsoft Graph; admin consent mungkin dibutuhkan (P14) |
| Keduanya | Kantor Outlook, pribadi Google | Dua adapter; atau Google saja untuk agenda pribadi |

### Calendar Provider Adapter (desain saja, tidak diimplementasikan)

```
CalendarProvider (antarmuka)
  capabilities()  -> {read, write, free_busy, delta_sync, webhook}
  list_events(range, calendar_ids)   -> [Event]
  get_event(id)                      -> Event
  sync(cursor)                       -> (changes, next_cursor)      # incremental
  free_busy(people, range)           -> [Slot]                       # Phase 9
  create/update/delete_event(...)    -> hanya dipanggil Approval Gate # Phase 9

Event (model netral, disimpan di calendar_events)
  id = provider + external_id, title, start, end, tz, all_day,
  attendees[{name, email, response}], organizer, location, online_url,
  status, recurrence_id, etag, provider

Implementasi:  GoogleCalendarProvider · MicrosoftGraphProvider · IcsFileProvider (baca saja)
```

Catatan: `IcsFileProvider` (impor file `.ics` manual) adalah jalan keluar jika aplikasi OAuth ke kalender kantor tidak diizinkan (P14). Aplikasi inti tidak boleh tahu provider mana yang dipakai.

---

## 5. Audio Capture Test — ringkasan CASE 1–7

**Tidak satu pun CASE dapat diberi PASS/PARTIAL/FAIL dari sini**, karena butuh perangkat nyata. Tabel membedakan apa yang sudah dicek (logika) dari apa yang masih harus diuji.

| CASE | Uji | Hasil nyata (laptop) | Cek logika di sandbox | Prediksi desk (hipotesis) |
|---|---|---|---|---|
| 1 | Browser menangkap mic | **NOT RUN** | SMOKE: jalur mic merekam, 6 chunk, peak terukur | Sangat mungkin PASS |
| 2 | Browser menangkap audio sistem | **NOT RUN** | SMOKE: track audio sistem masuk graf & terekam (perangkat palsu) | Mungkin PASS di Chrome/Edge Windows dengan "layar penuh + bagikan audio"; PARTIAL jika hanya tab; FAIL di Firefox/Safari/Android |
| 3 | Zoom Desktop + browser menangkap audio Zoom | **NOT RUN** | — | Mungkin PASS bila output Zoom = output default Windows |
| 4 | Zoom + headset | **NOT RUN** | — | Headset kabel/USB: kemungkinan PASS. Bluetooth: kualitas mic bisa turun (mode hands-free) |
| 5 | Zoom + speaker laptop | **NOT RUN** | Uji nada otomatis siap | **Kemungkinan besar PARTIAL/FAIL untuk pemisahan** (suara peserta bocor ke mic) |
| 6 | Mic + sistem bersamaan | **NOT RUN** | SMOKE: 4 file keluar (mic, system, mixed, stereo), tanpa error JS | Mungkin PASS; risiko throttling tab pada sesi panjang |
| 7 | Tersimpan terpisah | **NOT RUN** | SMOKE: nada 440 Hz hanya di mic/kiri, 880 Hz hanya di sistem/kanan (sintetis) | Terpisah secara teknis; kebersihan bergantung kebocoran (CASE 5) |

Kriteria PASS/PARTIAL/FAIL per CASE ada di `phase0/RUNBOOK.md` (Langkah 3). Hasil nyata akan diisi di kolom 3 setelah kamu menjalankannya.

---

## 6. Browser Capture Test

**Alat:** `phase0/tools/capture_test.html` (satu file, tanpa server backend, tidak mengunggah apa pun). Fitur: info lingkungan, pilih mic, rekam mic/sistem/keduanya, meter level, 4 keluaran (mic, system, mixed, stereo L=mic R=sistem), deteksi celah chunk, statistik peak/senyap, **uji nada 1 kHz** (mengukur apakah audio sistem tertangkap dan apakah mic bocor), form PASS/PARTIAL/FAIL, ekspor JSON tanpa audio.

**Diverifikasi (SMOKE, Chromium headless + perangkat palsu):**
- Halaman termuat dalam secure context, 0 error JS.
- Mic saja: 1 track terekam. Mic + sistem: 4 file keluar.
- Uji nada tidak crash; verdict "N/A" benar saat tidak ada track sistem.
- Pemisahan: dengan dua nada sintetis berbeda, file stereo berisi 440 Hz di L dan 880 Hz di R, file `mic` hanya 440, file `system` hanya 880.
- Catatan jujur: semua file keluar sebagai Opus **2-channel**, termasuk `mic`. Jumlah channel saja tidak membuktikan pemisahan; yang membuktikan adalah isi kanal (dicek di atas).

**Batasan yang diketahui (DESK, perlu dikonfirmasi di laptopmu):**
- Audio sistem lewat `getDisplayMedia` hanya di Chrome/Edge (Windows), harus memilih **layar penuh** atau **tab** + centang "bagikan audio". "Window" tidak membawa audio.
- Pemilih layar harus diklik manusia **setiap sesi**; tidak bisa diotomatisasi.
- Yang tertangkap mengikuti **perangkat output default Windows**. Jika Zoom diarahkan ke headset yang bukan default, audionya mungkin tidak masuk.
- Android Chrome tidak menangkap audio sistem: HP hanya mic.
- Tab di background / layar terkunci bisa mengganggu perekaman. Diuji lewat uji tambahan di runbook.

---

## 7. Zoom Capture Test — `NOT RUN`

Protokol di `RUNBOOK.md` (Langkah 2–3): kamu host sebagai ANDI; kolega/HP membacakan BUDI & SARI; rekam 5–6 menit via browser (CASE 3, 6), lalu ulangi dengan OBS (Opsi C) dan skrip WASAPI (Opsi D).

Hal yang harus dicatat dari uji ini: apakah suara peserta lain bersih di track sistem; apakah notifikasi Windows/aplikasi lain ikut terekam; apakah rekaman utuh 5+ menit; apakah mic Zoom (noise suppression Zoom) memengaruhi hasil rekaman lokal; pengaruh "Original Sound" Zoom.

Catatan arsitektur: rekaman lokal yang dipakai di sini **tidak bergantung** pada fitur rekam/transcript Zoom maupun izin host.

---

## 8. Headset Test — `NOT RUN`

Dua skenario di CASE 4: headset kabel/USB dan Bluetooth. Yang diukur: (a) apakah audio Zoom tertangkap saat output = headset, (b) hasil uji nada: mic harus **tidak** naik, (c) kualitas mic Bluetooth (mode hands-free biasanya 8–16 kHz dan menurunkan akurasi STT), (d) apa yang terjadi bila headset dicabut di tengah rekaman.

---

## 9. Recording Architecture Recommendation

### 9.1 Perbandingan (DESK, belum diuji kecuali yang dicatat)

| Kriteria | **A. Browser capture** | **B. Native recorder (aplikasi sendiri)** | **C. OBS** | **D. WASAPI loopback (skrip/library)** | **E. Hybrid** |
|---|---|---|---|---|---|
| Reliability | Sedang: picker per sesi, throttling, hanya Chrome/Edge Windows | Tinggi bila dibangun baik | **Tinggi**: matang, banyak dipakai | Sedang–tinggi; library pihak ketiga, **belum diuji di sini** | Tinggi (ada cadangan) |
| Privacy (lingkup tangkapan) | Rendah–sedang: seluruh audio sistem + harus berbagi layar | **Terbaik**: bisa per-proses (butuh versi Windows tertentu, perlu dicek) | Baik: "Application Audio Capture" per aplikasi | Seluruh output default (bukan per-app) | Tergantung komponen |
| User experience | Sedang: klik picker tiap sesi | Baik: tombol/tray | Sedang–rendah: di luar app, mulai/stop manual | Bergantung pembungkus | Baik jika primary mulus |
| Kompleksitas | **Rendah** (pakai ulang PWA) | **Tinggi**: kode native, installer, signing, antivirus, izin install | Rendah, tapi dependensi pihak ketiga | Sedang | Sedang |
| Memisahkan mic/sistem | Ya (track terpisah; terbukti sintetis) | Ya | Ya (multi-track MKV) | Ya (dua file) | Ya |
| Ukuran file | Kecil (Opus 64 kbps ≈ 29 MB/jam/track) | Bebas (FLAC/Opus) | Sedang (AAC/ MKV) | **Besar bila WAV** (±700 MB/jam stereo 48 kHz per track; harus dikompres) | — |
| Kompatibilitas Windows | Chrome/Edge | Win 10/11 | Win 10/11 | Win 10/11 | — |
| Penggunaan headset | Mengikuti output default | Pilih perangkat eksplisit | Pilih perangkat | Hanya output default | — |
| Otomatisasi | Rendah | **Tinggi** | Sedang (obs-websocket) | Tinggi | Tinggi |

### 9.2 Rekomendasi (SEMENTARA, menunggu hasil uji laptop)

> **PRIMARY: Local Recorder di dalam Local Worker** — dimulai dari Opsi D (WASAPI loopback, dua file: mic & sistem), dengan jalur upgrade ke tangkapan per-proses.
> **FALLBACK: OBS** (multi-track, impor file).
> Browser capture (Opsi A) **dipertahankan hanya untuk HP (mic) dan sebagai "mode cepat" opsional** di laptop, bukan jalur utama.

Alasan (prioritas RELIABILITY > ELEGANCE):
1. Local Worker sudah ada di arsitektur (transkripsi lokal), jadi perekam lokal di dalamnya menambah sedikit kerumitan.
2. Menghindari ketergantungan pada picker layar manual, throttling tab, dan batasan satu-browser.
3. Privasi: tidak berbagi layar, dan ada jalur ke tangkapan per-proses.
4. Memasang Python/exe di laptop kantor mungkin dilarang (P11) → itulah alasan OBS portabel disiapkan sebagai fallback.

**Aturan pembalik (saya akan berubah pikiran jika):**

| Kondisi | Dampak |
|---|---|
| Laptop kantor **tidak boleh** memasang apa pun (P11 = tidak) | Browser capture menjadi PRIMARY; fallback = upload file dari perekam lain/HP |
| CASE 2, 3, 6, 7 semuanya PASS pada ≥3 sesi 30 menit **dan** pemilik memilih nol-instalasi | Browser boleh jadi PRIMARY (tetap simpan fallback lokal) |
| Skrip WASAPI gagal/tidak stabil di laptopmu | PRIMARY = OBS; recorder sendiri ditunda |
| Speaker laptop sering dipakai (CASE 5 bocor >20%) | Wajib tambah diarization/penandaan manual; label "USER" tidak boleh dipercaya otomatis |

Prinsip tambahan: perekam dibungkus **Capture Adapter** (BrowserCapture, LocalWasapi, ObsImport, FileUpload) agar sumber audio bisa ditukar tanpa mengubah sisa sistem.

---

## 10. faster-whisper Benchmark — `NOT RUN` (alat siap)

**Alasan belum jalan:** model tidak bisa diunduh di sandbox (HuggingFace ditolak); lagipula angka sandbox tidak mewakili laptopmu. Tidak ada angka kecepatan di laporan ini. Itu disengaja.

**Alat:** `tools/bench_whisper.py`. Per kombinasi {model} × {bahasa `id`, `auto`} × {tanpa/dengan prompt glosarium}: waktu muat, waktu transkripsi, **real-time factor (RTF = waktu proses ÷ durasi audio)**, puncak RSS, rata-rata CPU, GPU/VRAM (bila ada NVIDIA), WER, WER setelah normalisasi angka, recall istilah per kategori, recall angka & tanggal; transkrip dan segmen (dengan `avg_logprob`, `no_speech_prob`) disimpan.

**Diverifikasi:**
- Mekanik harness jalan (engine tiruan): metrik, CSV/JSON, prompt A/B terisi (VERIFIED, **bukan hasil Whisper**).
- Pemuatan model gagal dengan pesan jelas, tidak crash (VERIFIED, `403 Forbidden`).
- Temuan F1: pin `av>=14,<17`.

**Model yang direncanakan diuji** (disesuaikan setelah spesifikasi laptop diketahui): `small`, `medium`, `large-v3-turbo`, `large-v3` (hanya bila hardware memadai; tanpa GPU jangan mulai dari `large-v3`).

**Ambang lulus (dari RENCANA §10.5, belum diubah):**

| Metrik | Lulus |
|---|---|
| WER, audio bersih | ≤ 15–20% |
| Recall istilah/singkatan/nama | ≥ 90% |
| Recall angka & nilai uang | ≥ 95% (sisanya harus berflag, bukan salah diam-diam) |
| RTF di laptopmu | ≤ 3 (rapat 1 jam selesai ≤ 3 jam, latar belakang) dicatat sebagai batas "layak" |

---

## 11. Transcript Quality Evaluation

### 11.1 Data & metode
- Rapat simulasi: `test_data/meeting_script.md`, **534 kata, 20 giliran, 3 pembicara**, ±5–6 menit dengan jeda. Fiktif. Berisi nama (Andi, Budi, Sari), tanggal, deadline, PIC, 20 fakta angka, 4 tanggal, 49 istilah (6 nama, 5 singkatan, 20 istilah finance, 18 istilah Inggris).
- Ground truth: `ground_truth_full/andi/others.txt` (dibangun otomatis dari skrip). Catatan: ground truth = apa yang **seharusnya** diucapkan; jika kamu menyimpang dari skrip, catat agar tidak dihitung sebagai kesalahan Whisper.
- Evaluator: `tools/eval_transcript.py` — WER, CER, WER-normalisasi-angka (dua belas persen = 12%), recall istilah (`strict` / `near`), recall angka (`strict`: jenis+nilai cocok; `lenient`: nilai cocok, mata uang tak disebut), recall tanggal.

### 11.2 Validasi evaluator (VERIFIED — ini hasil alat, bukan hasil Whisper)

| Uji | Hasil |
|---|---|
| Ground truth vs dirinya | WER 0,0 · CER 0,0 · istilah 100% · angka 100% · tanggal 100% |
| Transkrip sengaja dirusak ("Rp495 miliar", "12%", CSPA→SPA, DSCR→D S C R, trustee→trusty, dll.) | WER 8,7% · **WER-normalisasi-angka 3,3%** · angka strict 90% / lenient 95% · istilah miss terdeteksi (`trustee`, `sensitivity analysis`) · "empat sembilan lima" ditandai ambigu |
| Kebocoran mic | bersih: 0,0 · bocor (3 giliran lawan bicara masuk mic): 0,36 |

Dua cacat evaluator ditemukan dan diperbaiki saat verifikasi: (1) skor kebocoran punya noise dasar 2,3% karena 4-gram yang sama ada di ucapan kedua pihak → sekarang hanya menghitung n-gram milik lawan bicara; (2) istilah "penghematan bunga" gagal cocok dengan "bunganya" → daftar istilah disesuaikan.

Pelajaran: **WER mentah akan menghukum Whisper yang menulis "12%" padahal skrip "dua belas persen"**. Karena itu laporan memakai WER mentah dan WER-normalisasi-angka berdampingan.

### 11.3 Hasil transkripsi nyata — `NOT RUN`

---

## 12. Indonesian–English Evaluation — `NOT RUN`

Alat siap. Skrip memuat 18 istilah Inggris dalam kalimat Indonesia (`rate`, `review`, `update`, `draft`, `follow up`, `forward`, `indicative pricing`, `sensitivity analysis`, `base case`, `upside`, `downside`, `next step`, `finalize`, `forecast`, `please make sure`, `cross check`, `issue`, `finance`) plus satu kalimat penuh bahasa Inggris ("Please make sure semua angka…").

Yang akan dibandingkan: `--languages id` vs `auto`; dengan/tanpa prompt glosarium. Risiko yang dicari: Whisper menerjemahkan kalimat Inggris ke Indonesia, mengeja istilah Inggris secara fonetik Indonesia ("sensitif analisis"), atau salah mendeteksi bahasa di tengah audio. Metrik: `terms_english_mixed` strict & lenient.

---

## 13. Financial Terminology Evaluation — `NOT RUN`

Kategori di `key_terms.json`: **nama** (6), **singkatan** (MTN, CSPA, DSCR, EBITDA, PIC), **istilah finance** (20: outstanding, refinancing, covenant, going concern, negative pledge, cross default, term sheet, basis poin, …), **Inggris campur** (18). Evaluator memisahkan `strict` (cocok persis) dan `near` (mirip ≥0,85) supaya "D S C R" atau "SPA" terlihat sebagai *hampir benar*, bukan lolos diam-diam.

Uji perbaikan: prompt glosarium (`glossary_prompt.txt`) A/B. Pasca-koreksi glosarium (fuzzy) dinilai di Phase 4, bukan di sini.

---

## 14. Number / Currency Evaluation

### 14.1 Parser angka deterministik — VERIFIED
`tools/idnum.py` + `tools/test_idnum.py` (11 kelompok tes, semua lulus). Prinsip: aturan, bukan LLM; **tidak mengarang**.

| Masukan | Keluaran | Catatan |
|---|---|---|
| empat ratus sembilan puluh lima miliar rupiah | `idr 495000000000` → **Rp495 miliar** | konteks "rupiah" eksplisit |
| empat ratus sembilan puluh lima miliar | `plain` + flag `currency_unknown` → "495 miliar" | **tidak** menambah "Rp" |
| dua belas persen / 12% / 9,5 persen | `pct 12` / `pct 12` / `pct 9.5` | |
| nol koma lima persen | `pct 0.5` → 0,5% | |
| satu koma dua lima miliar rupiah | `idr 1250000000` → Rp1,25 miliar | **bug skala sesudah desimal ditemukan & diperbaiki** |
| dua koma tiga lima triliun rupiah | Rp2,35 triliun | |
| dua ribu dua puluh enam | 2026 | |
| seratus lima puluh basis poin | `plain 150` | |
| **empat sembilan lima** | `value=None`, flag `NEEDS_REVIEW:ambiguous_digits`, teks asli dipertahankan | tidak ditebak jadi 495 |
| Rp495 miliar / Rp 1.250.000.000 | idr 495e9 / 1.25e9 | bentuk digit |
| 1.250 | flag `ambiguous_separator` | 1.250 = 1250 (ID) atau 1,25 (EN)? |
| tanggal dua belas Oktober | `date 12 oktober` | |
| "tujuh. Lima orang" | dua fakta terpisah (7, 5) | batas kalimat |

**Batasan yang diketahui (belum ditangani):** "setengah", "satu setengah", pecahan; angka berbahasa Inggris ("fifty million"); satuan jam ("jam dua siang") dan rentang; kata "ribuan/jutaan"; "Rp" yang tidak disebut padahal konteks jelas — sengaja **tidak** ditebak. Penentuan mata uang dari konteks (mis. "nilai aset", "MTN" → rupiah) adalah tugas LLM + konfirmasi manusia di Phase 4–5, bukan parser.

### 14.2 Pada rekaman nyata — `NOT RUN`
`key_facts.json` berisi 20 fakta angka + 4 tanggal. Laporan akan memisahkan: benar (strict), benar tanpa mata uang (lenient → perlu konfirmasi), ambigu terflag (baik), dan **salah tanpa flag (buruk; target 0)**.

---

## 15. Speaker Separation Evaluation

**Kebijakan label (sesuai arahan):**

| Sumber | Label | Boleh dipercaya? |
|---|---|---|
| Track mic | `USER` (diberi nama, mis. "Andi") | Hanya jika kebocoran mic rendah (diukur) |
| Track sistem | `PARTICIPANT` / `Unknown Participant` | Ya sebagai kelompok, bukan individu |
| Diarization (jika dipakai) | `Speaker 1`, `Speaker 2` | Label anonim; nama hanya setelah dikonfirmasi pengguna |
| Nama peserta lain | **Tidak diklaim** | Pemetaan manual / saran dari undangan kalender, selalu dikonfirmasi |

**Uji:** (a) transkripsi `sim_mic` → bandingkan ke `ground_truth_andi` (WER) dan ukur `leak_4gram_other_speakers` (ucapan BUDI/SARI yang muncul di mic); (b) transkripsi `sim_system` → bandingkan ke `ground_truth_others` dan ukur kebocoran suara Andi ke sistem; (c) uji nada otomatis di halaman browser untuk bocor akustik.

| Kebocoran (4-gram) | Penilaian |
|---|---|
| < 5% | PASS: label USER dapat dipercaya |
| 5–20% | PARTIAL: perlu penandaan manual untuk segmen yang meragukan |
| > 20% | FAIL: pemisahan mic/sistem tidak dapat dipakai; wajib headset atau diarization |

Status: alat divalidasi (bagian 11.2); pengukuran pada audio nyata `NOT RUN`. Diarization otomatis (pyannote/WhisperX) **tidak diuji dan tidak direkomendasikan masuk MVP-A**.

---

## 16. Privacy Findings

| # | Temuan | Dampak | Tindakan |
|---|---|---|---|
| V1 | Kebijakan kantor soal rekam/simpan/STT/AI cloud **belum diketahui** (P1–P14) | **Blocker** untuk Phase 1 | Isi checklist bagian 3 |
| V2 | Browser capture menangkap **seluruh audio sistem** (notifikasi, musik, panggilan lain) dan memaksa berbagi layar | Menangkap lebih banyak dari yang dibutuhkan; potensi merekam hal pribadi/orang lain tanpa sadar | Perekam produksi sebaiknya per-proses; sementara, tutup aplikasi lain, matikan notifikasi |
| V3 | `getDisplayMedia` juga membuka track **video layar** (halaman uji hanya membuangnya) | Tidak ada video disimpan, tapi tangkapan layar ada di memori | Alasan tambahan memilih perekam lokal |
| V4 | Hasil uji berisi suara. Risiko ikut ter-commit | Kebocoran | `phase0/.gitignore` menolak `*.wav/webm/mkv/mp3/m4a/…` dan `results/*` |
| V5 | Data uji Phase 0 fiktif; tidak ada data perusahaan | Aman | Dipertahankan; rapat nyata hanya setelah P1–P6 dijawab |
| V6 | Model Whisper diunduh dari internet (HuggingFace) | Yang diunduh model, bukan data; tapi laptop kantor mungkin memblokirnya | Cek di Langkah 6; bisa pindahkan file model manual |
| V7 | Peserta lain mungkin tidak tahu mereka direkam | Risiko etika/hukum | Pengingat persetujuan sebelum rekam (RENCANA §9.4) + P10 |
| V8 | Transkrip dikirim ke LLM cloud saat analisis (Phase 5) | Kerahasiaan | Hanya setelah P6 = boleh; level sensitivitas di Gateway |
| V9 | Rapat dari HP (SERVER_TEMP) menaruh audio sementara di server | Bertentangan dengan LOCAL_ONLY | Keputusan D-04 |
| V10 | Dependensi (`av`) tidak dikunci menyebabkan instalasi rusak | Keandalan, bukan privasi, tapi juga risiko supply chain | Kunci versi + lockfile dari Phase 1 |

---

## 17. Risks (pembaruan terhadap RENCANA §23)

| # | Risiko | Peluang | Dampak | Status/mitigasi |
|---|---|---|---|---|
| R1 | Kebijakan kantor melarang rekam/AI cloud | Sedang | Sangat tinggi | **Terbuka (V1)** — Mode Pribadi/Lokal |
| R2 | Kalender kantor Outlook | Tinggi | Tinggi (hanya MVP-B) | Terbuka; Calendar Adapter + ICS fallback |
| R17 | Browser capture tidak stabil / terbatas Chrome-Edge | Sedang | Sedang | Diuji CASE 1–7; perekam lokal + OBS sebagai alternatif |
| R18 | Suara peserta bocor ke mic (speaker laptop) | **Tinggi** | Tinggi untuk label pembicara | Uji nada + leak score; wajib headset atau penandaan manual |
| R19 | Laptop kantor melarang instal perekam/Python | Sedang | Tinggi | P11; browser/OBS portabel sebagai jalur |
| R20 | Dependensi tidak terkunci (contoh F1) | Tinggi | Sedang | Pin versi, lockfile, tes instalasi bersih di CI |
| R21 | Rekaman menangkap audio non-rapat (notifikasi, panggilan lain) | Sedang | Sedang | Tangkapan per-proses; pengingat; hapus-audio otomatis |
| R3 | Akurasi STT kurang pada audio buruk | Tinggi | Sedang | Benchmark nyata belum ada |
| R6 | Laptop terlalu lambat untuk model besar | Sedang | Sedang | RTF diukur; model lebih kecil / glosarium |
| R22 | Kualitas mic Bluetooth turun (hands-free) | Sedang | Sedang | CASE 4 uji Bluetooth; rekomendasi headset kabel/USB |
| R23 | Hasil Phase 0 dari data simulasi lebih bersih dari rapat nyata (bias optimis) | **Tinggi** | Sedang | Setelah kebijakan jelas, uji 1–2 rapat nyata non-rahasia sebelum Phase 1 final |

---

## 18. Recommended Architecture Changes

Usulan perubahan terhadap baseline (belum dimasukkan ke RENCANA kecuali yang berlabel *sudah*):

1. **Capture Adapter** di Local Worker: `LocalWasapi` (primary), `ObsImport` (fallback), `BrowserCapture` (HP/opsional), `FileUpload`. Sumber audio bisa diganti tanpa mengubah pipeline.
2. **Audio Route** (LOCAL_ONLY / SERVER_TEMP) — *sudah masuk RENCANA v1.1 §14.1*.
3. **Label pembicara** USER / PARTICIPANT / Speaker N / UNKNOWN — *sudah masuk RENCANA v1.1 §10.2*. Tabel `transcript_segments.speaker_label` tetap; `person_id` hanya terisi setelah konfirmasi.
4. **Raw transcript tak berubah (immutable)**: `text_raw` ditulis sekali dan diberi checksum; `text_clean` selalu turunan dengan diff yang bisa ditampilkan. Setiap perubahan fakta tidak boleh menimpa raw.
5. **Tabel `extracted_facts`**: angka, tanggal, mata uang disimpan **terstruktur** (`kind`, `value`, `raw_span`, `flags`, `segment_id`), bukan hanya teks yang ditulis ulang. UI menampilkan nilai ternormalisasi **dan** teks asli.
6. **Calendar Provider Adapter** (bagian 4) sebagai antarmuka dari awal, termasuk `IcsFileProvider`.
7. **Evaluation harness** (`eval_transcript.py` + golden set) menjadi komponen resmi di Phase 4–5, dijalankan tiap ganti model/prompt (RENCANA §22).
8. **Kunci dependensi** (lockfile + versi pin) dan tes "instal bersih" di CI sejak Phase 1.
9. **Kesehatan perekaman** di UI: meter level, peringatan senyap >30 dtk, indikator "perangkat output berubah".

Tidak ada perubahan pada inti prinsip (privacy-first, human-in-the-loop, AI hanya mengusulkan).

---

## 19. MVP-A Final Scope (usulan, menunggu approval)

**Satu pengalaman utama, tidak lebih:**

```
MULAI RAPAT → REKAM → SELESAI → TRANSKRIPSI → ANALISIS AI → REVIEW → APPROVE → TASK TERBENTUK
```

Evaluasi: MVP-A bisa dibuat lebih kecil, dengan memotong segala hal yang tidak mendukung alur di atas.

| Komponen | Keputusan | Alasan |
|---|---|---|
| Login (1 pengguna) | **MASUK**, versi minimal (passkey/TOTP) | Data sensitif |
| Mulai/Selesai rapat + timer + catatan manual ber-timestamp | **MASUK** | Inti alur |
| Perekam laptop (primary sesuai §9), upload file sebagai cadangan | **MASUK** | Inti alur |
| Rekam dari HP | **TUNDA** (setelah MVP-A; cukup upload file dari HP) | Android web recording rapuh; bukan alur utama |
| Transkripsi lokal + glosarium + parser angka | **MASUK** | Inti alur |
| Raw + clean transcript, edit sederhana, putar audio per segmen | **MASUK** (edit dasar) | Audit |
| Analisis AI: ringkasan, keputusan, action item (bukti + flag) | **MASUK** | Inti alur |
| Layar Review (Edit/Approve/Reject) | **MASUK** | Human-in-the-loop |
| Task: daftar, status 5 level, selesai, deadline, PIC (teks) | **MASUK** (minimal) | Hasil akhir alur |
| Audit log + ai_runs + hapus rapat | **MASUK** (minimal) | Auditable AI |
| Backup + restore teruji | **MASUK** | Data tidak boleh hilang |
| Proyek (entitas penuh) | **TUNDA** → field teks "proyek" di rapat/task | Bukan syarat alur |
| Catatan harian | **TUNDA** → MVP-B (bagian Knowledge Base) | Bukan syarat alur |
| People (tabel), Tags, Glossary UI | **TUNDA** → daftar peserta berupa teks; glosarium berupa file | Hemat 1–2 minggu |
| Dashboard Command Center | **TUNDA** → satu layar: "Rapat terakhir + Task terbuka + butuh review" | |
| PWA install, notifikasi push | **TUNDA** | |
| Ekspor Docx/PDF | **TUNDA** (salin Markdown saja) | |
| Calendar, Search, Tanya AI | MVP-B | Sesuai arahan |

**Layar MVP-A (5):** Login · Daftar Rapat (+ tombol Mulai Rapat) · Sesi Rapat (rekam) · Review Hasil · Tugas.
**Tabel MVP-A (±10):** meetings, recordings (metadata + jalur lokal + checksum), transcripts, transcript_segments, summaries, decisions, action_items, tasks, ai_runs, audit_logs (+ jobs, users).

**Dampak jadwal (estimasi, bukan janji):** dari 160–210 jam (RENCANA v1.1) menjadi ±110–150 jam. Pada 10–12 jam/minggu: ±9–15 minggu setelah Phase 0, atau ±11–17 minggu dari sekarang.

**Penyesuaian fase (jika disetujui):** Phase 2 menjadi "Tugas minimal" (bukan Proyek/Catatan/Tugas lengkap); Proyek + Catatan pindah ke MVP-B sebagai bagian Knowledge Base.

**Acceptance MVP-A:** satu rapat nyata dari Mulai sampai Task dalam ≤10 menit review; semua item AI berbukti; tidak ada task terbentuk sebelum Approve; PIC/deadline tidak jelas selalu berflag; raw transcript tidak berubah; audit mencatat tiap langkah; restore backup teruji.

---

## 20. Go / No-Go Criteria for Phase 1

### 20.1 Kriteria

| # | Kriteria | Ambang | Status sekarang |
|---|---|---|---|
| G1 | Kebijakan: boleh merekam (P1), STT lokal (P3), menyimpan transkrip (P4) | Ketiganya "boleh" atau "boleh bersyarat" yang bisa dipenuhi | **UNKNOWN — BLOCKER** |
| G2 | Kebijakan: AI cloud untuk transkrip (P6) atau keputusan resmi memakai LLM lokal | Salah satunya jelas | **UNKNOWN — BLOCKER** |
| G3 | Ada **satu** jalur perekaman yang PASS di laptop nyata (CASE 1+6+7 untuk jalur primary, dengan headset) | PASS pada ≥3 sesi ≥5 menit, tanpa kehilangan data | **NOT RUN — BLOCKER** |
| G4 | Pemisahan mic/sistem dengan headset: leak < 5%; speaker: tercatat dan punya mitigasi | Terukur | **NOT RUN — BLOCKER** |
| G5 | faster-whisper berjalan di laptop: WER ≤ 20%, recall istilah ≥ 90%, angka ≥ 95% (atau salah-terflag) | Pada model yang RTF-nya ≤ 3 | **NOT RUN — BLOCKER** |
| G6 | Laptop mengizinkan memasang komponen lokal yang dipilih (P11), atau jalur nol-instalasi disepakati | Jelas | UNKNOWN — BLOCKER |
| G7 | Alat evaluasi & parser angka teruji | Lulus | **TERPENUHI (VERIFIED)** |
| G8 | Kalender utama teridentifikasi | Teridentifikasi | UNKNOWN — **tidak memblokir Phase 1** (hanya Phase 6) |
| G9 | Cakupan MVP-A final disetujui | Approval pemilik | Menunggu approval |

### 20.2 Aturan keputusan
- **GO** — G1–G7 dan G9 terpenuhi.
- **CONDITIONAL GO** — G7 terpenuhi, tidak ada bukti yang membantah kelayakan, tapi sebagian G1–G6 masih terbuka. Phase 1 tetap **tidak boleh** dimulai sampai blocker ditutup; hanya aktivitas Phase 0 yang berlanjut.
- **NO-GO** — P1/P4 dilarang tegas; atau tidak ada jalur perekaman yang bisa memisahkan/menangkap audio rapat; atau WER >30% pada model terbesar yang realistis di laptopmu tanpa jalan perbaikan.

### 20.3 Verdict saat ini

> # CONDITIONAL GO (sementara)
>
> **Dasarnya:** analisis meja + alat yang terverifikasi. **Bukan** hasil uji pada perangkat nyata. Tidak ada temuan yang membuktikan konsepnya mustahil; alat evaluasi, parser angka, dan logika pemisahan track berfungsi. Tetapi 5 dari 6 syarat inti (G1–G6) belum bisa dinilai.
>
> **Blocker sebelum Phase 1:**
> 1. G1/G2 — jawaban kebijakan kantor (bagian 3).
> 2. G3/G4 — uji perekaman CASE 1–7 + uji nada di laptop nyata (RUNBOOK Langkah 3–4).
> 3. G5 — benchmark faster-whisper di laptop nyata (RUNBOOK Langkah 6).
> 4. G6 — izin memasang komponen lokal.
> 5. G9 — approval cakupan MVP-A.
>
> **Dugaan risiko terbesar saya:** kebijakan kantor (G1/G2), lalu kebocoran mic bila memakai speaker (G4). Teknologinya sendiri bukan yang paling mengkhawatirkan.

---

## Lampiran A — Inventaris file Phase 0

| File | Fungsi | Status verifikasi |
|---|---|---|
| `phase0/RUNBOOK.md` | Langkah uji di laptop Windows | — |
| `phase0/test_data/meeting_script.md` | Skrip simulasi (fiktif) | — |
| `phase0/test_data/ground_truth_*.txt` | Ground truth (full/andi/others), dibuat otomatis | VERIFIED |
| `phase0/test_data/key_facts.json` | 20 angka + 4 tanggal + hasil yang diharapkan Phase 5 | — |
| `phase0/test_data/key_terms.json`, `glossary_prompt.txt` | Istilah per kategori, prompt glosarium | — |
| `phase0/tools/capture_test.html` | Uji perekaman browser CASE 1–7 + uji nada | SMOKE (perangkat palsu) |
| `phase0/tools/bench_whisper.py` | Benchmark faster-whisper | Mekanik VERIFIED (engine tiruan); model asli NOT RUN |
| `phase0/tools/eval_transcript.py` | WER/istilah/angka/leak | VERIFIED |
| `phase0/tools/idnum.py`, `test_idnum.py` | Parser angka/rupiah/persen/tanggal | VERIFIED (11 tes) |
| `phase0/tools/record_dual_wasapi.py` | PoC Opsi D (WASAPI loopback) | **TIDAK DIUJI** (hanya cek sintaks) |
| `phase0/.gitignore` | Cegah commit rekaman | — |

Semua kode di `phase0/` **disposable**: bukan fondasi kode produksi. Beberapa ide (parser aturan, harness evaluasi) layak ditulis ulang bersih di Phase 4, bukan disalin.

## Lampiran B — Yang saya butuhkan darimu untuk menutup Phase 0

Lihat `phase0/RUNBOOK.md` Langkah 8. Ringkas: tabel lingkungan, `capture_results.json`, `results.csv` benchmark, `leak_*.json`, catatan manual, jawaban Policy Checklist, jawaban Calendar Discovery. **Bukan audio.**

---

**STOP FOR REVIEW.** Phase 1 tidak dimulai. Tidak ada aplikasi, backend, frontend, database, integrasi, atau deployment yang dibuat.
