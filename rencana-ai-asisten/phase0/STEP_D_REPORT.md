# STEP D REPORT — First Transcription

Status: **SELESAI (12 Okt 2026). Pipeline D1-D5 = PASS. Kualitas terhadap ambang Phase 0 = PARTIAL (WER ternormalisasi 21,7%, istilah 67%). Gate D menunggu keputusan pemilik.**
Data: konsol apa adanya di `results/step_d/step_d_console_attempt1.txt`. `step_d_results.json` dan `evaluation_summary.txt` belum diterima (konsol memuat ringkasan; 10 dari 20 segmen NEEDS_REVIEW tampil).
Model: **small** · Device: **CPU** · Compute type: **int8** · Python venv: 3.12.10 · `av` 16.1.0 (`PHASE0_TEST_PIN`) · tanpa jaringan, tanpa instalasi.
Konfigurasi tunggal: `language=id` (dipaksa), `beam_size=5`, VAD aktif, tanpa prompt, `condition_on_previous_text=False`.
Data uji: suara pengguna membaca naskah fiktif 534 kata (`test_data/naskah_baca_stepd.txt`), 20 giliran, satu pembicara untuk semua peran. Ground truth: `test_data/ground_truth_full.txt`.
Format: **STATUS · EVIDENCE · ERROR · INTERPRETATION · NEXT ACTION**. Label: `VERIFIED` · `DESK` · `UNKNOWN`.

## Ringkasan sub-gate
| Gate | Isi | STATUS |
|---|---|---|
| D1 | audio decode | **PASS** (253,2 dtk) |
| D2 | transkripsi (waktu, RTF, puncak RAM) | **PASS** (43,0 dtk; RTF 0,17; puncak RAM 754,3 MB) |
| D3 | bahasa terdeteksi `id` (≥ 0,8) | **PASS** (id, 1,000) |
| D4 | transkrip mentah tersimpan + SHA-256 | **PASS** (hash ada di JSON yang belum diterima) |
| D5 | evaluasi terhadap ground truth | **PASS** (terhitung) |

## Metrik (`VERIFIED` dari konsol pengguna)
| Metrik | Hasil | Ambang Phase 0 (RENCANA §10.5) | Terpenuhi? |
|---|---|---|---|
| WER mentah | 33,8% | (informasi) | |
| **WER setelah normalisasi angka** | **21,7%** | ≤ 20% | **Tidak** (selisih 1,7 poin) |
| CER | 20,1% | (informasi) | |
| **Istilah (strict) keseluruhan** | **67%** (lenient 76%) | ≥ 90% | **Tidak** |
| Nama / singkatan / finance / Inggris-campur (strict) | 67% / 60% / 65% / 72% | | |
| Angka (lenient) | 95% | ≥ 95% (atau salah-terflag) | **Ya**, tepat di batas |
| Angka (strict) | 95% | | |
| Tanggal | 100% | | |
| Waktu transkripsi / RTF | 43,0 dtk untuk 253,2 dtk audio / **0,17** | informasi | |
| Puncak RAM | 754,3 MB | informasi | |
| Segmen NEEDS_REVIEW | 20 (total segmen `UNKNOWN`) | | |
| Kualitas terhadap ambang | **PARTIAL** | deskriptif | |

## Hasil per sub-gate
**D1-D5: PASS** (pipeline). EVIDENCE: lihat tabel di atas dan konsol. ERROR: tidak ada pada percobaan ini (percobaan sebelumnya gagal karena bug skrip pembungkus, bukan model; lihat Koreksi alat).

### INTERPRETATION (hasil)
- **Pipeline lokal bekerja pada suara Indonesia nyata**: audio, model `small` (cpu/int8), teks mentah, evaluasi otomatis (`VERIFIED`). Bahasa terdeteksi `id` dengan probabilitas 1,000.
- **Kecepatan memadai**: 253,2 dtk audio diproses dalam 43,0 dtk (RTF 0,17) di CPU laptop ini. Angka ini hanya untuk satu file dan satu konfigurasi, tanpa model lain (belum benchmark).
- **Kualitas `small` pada konfigurasi default belum memenuhi ambang Phase 0**: WER ternormalisasi 21,7% (batas 20%) dan istilah 67% (batas 90%). Angka (95%) dan tanggal (100%) baik.
- **Normalisasi angka menentukan penilaian**: WER mentah 33,8% turun ke 21,7% setelah angka dinormalkan; selisih ±12 poin berasal dari format ("12 %" vs "dua belas persen"), bukan salah dengar. Ini mengonfirmasi desain evaluasi (`VERIFIED`).
- **Kesalahan terkonsentrasi di istilah khusus dan nama**, bukan di bahasa umum: `treasury`→"treseri", `going concern`→"going constant"/"going awesome", `negative pledge`, `cross default`, `term sheet`, `basis poin`, `rate`→"red", `cash flow`→"ks 10", `EBITDA`→"ebida", `Bu Sari`→"busari", `Pak Andi`→"peani". Ejaan hasil sering berupa kata yang mirip bunyi tetapi bukan kata finance.
- **Pencampuran bahasa**: "Maret" muncul sebagai "March" (kemungkinan terjemahan otomatis ke Inggris), dan istilah Inggris dalam kalimat Indonesia sering salah eja. Bahasa dipaksa `id` pada uji ini; pengaruh bahasa `auto` belum diuji (Step F).
- **Nama orang berisiko bagi deteksi PIC**: "Pak Andi"→"peani" berarti pencocokan PIC otomatis dari transkrip mentah akan sering gagal (`DESK`, implikasi untuk Phase 5). Jalur yang konsisten dengan rencana: tandai `UNKNOWN_PIC`, cocokkan dengan daftar peserta, minta konfirmasi.
- **Penanda NEEDS_REVIEW terlalu sensitif di uji ini**: 20 segmen ditandai semuanya karena `no_speech_prob > 0.6`, termasuk segmen yang jelas berisi suara dan **benar seluruhnya** (mis. "Berarti sisanya 245 miliar rupiah itu seri B ya Pak."). Jadi `no_speech_prob` saja bukan penanda kualitas yang baik pada mic ini (`VERIFIED` dari konsol); ambangnya perlu dikalibrasi dengan distribusi nilai penuh di Step F.
- **Angka**: 19 dari 20 fakta benar. Satu gagal: biaya penerbitan "satu koma dua lima miliar rupiah" (N08); bentuk yang terdengar `UNKNOWN` tanpa JSON.

### Hipotesis perbaikan (semua `DESK`, belum diuji; bahan Step F)
1. Prompt glosarium (nama peserta, singkatan, istilah finance).
2. Model lebih besar (`medium`, `large-v3-turbo`). RTF 0,17 pada `small` menyisakan ruang waktu, tetapi kecepatan model lain belum diukur.
3. Bahasa `auto` versus `id` dipaksa untuk campuran Indonesia-Inggris.
4. Koreksi pasca-transkripsi berbasis glosarium dan daftar orang, **sebagai saran yang dikonfirmasi pengguna**, tidak otomatis.
5. Kualitas rekaman (noise floor mic −44 dBFS; jarak mic).

## Koreksi alat
`step_d_run.ps1` v1 memberi argumen `--notes` tanpa nilai ketika `-Notes` kosong, karena PowerShell 5.1 membuang argumen string kosong saat memanggil program native. Kegagalan terjadi di argparse sebelum model dijalankan. Diperbaiki (`--notes=NILAI`) dan terverifikasi di sisi Python; versi baru belum dijalankan di Windows. Pengukuran puncak RAM via `ctypes` di Windows kini **terbukti bekerja** (754,3 MB).

## Validasi alat (sebelum diserahkan)
| Hal | Hasil |
|---|---|
| Decode `.m4a`, `.webm`, `.mp3`, `.wav`, `.ogg` lewat PyAV | `VERIFIED` di sandbox |
| Alur D1-D5 dengan mesin **tiruan** (bukan Whisper) | `VERIFIED`; hasil "MEETS" pada uji itu berasal dari kesalahan yang disisipkan sendiri, bukan kualitas model |
| Transkrip mentah read-only + checksum konsisten; jalan ulang ke folder yang sama | `VERIFIED` |
| Kegagalan bersih pada audio rusak | `VERIFIED` |
| Pengukuran puncak RAM di Windows | `VERIFIED` (754,3 MB). Skrip PowerShell: bug `-Notes` kosong ditemukan dan diperbaiki; alur D1-D5 berjalan di Windows nyata |

## Hasil per sub-gate
(Diisi setelah `results/step_d/step_d_results.json` dan `evaluation_summary.txt` masuk.)

## Hal yang SENGAJA tidak dibuktikan oleh Step D
- Perbandingan model (`medium`, besar), prompt glosarium, bahasa `auto` (Step F).
- Pemisahan sumber mic/sistem, rekaman Zoom, speaker laptop (Step E).
- Transkrip "bersih" (normalisasi angka/format) dan LLM (Phase 4-5).
- Bacaan satu orang untuk semua peran lebih sederhana daripada rapat nyata (suara berbeda, tumpang tindih, kualitas kanal): hasil cenderung **optimistis** (`DESK`).

## Gate D
**Saran: Gate D dapat dibuka sebagai PASS untuk pipeline (D1-D5), dengan kualitas PARTIAL dicatat jelas.** Kualitas model belum memenuhi ambang Phase 0 pada konfigurasi default `small`; itu bukan kegagalan Step D, tetapi menjadikan Step F (perbandingan model, prompt, bahasa) penentu apakah syarat G5 terpenuhi. Step E tidak dimulai sebelum Gate D disetujui.

**Usulan urutan (keputusan pemilik):** Step F dapat dikerjakan **sebelum** Step E, karena (a) memakai file rekaman yang sama tanpa Zoom/orang lain, (b) menjawab pertanyaan kelayakan terbesar yang tersisa (apakah ambang tercapai), dan (c) hasilnya tidak bergantung pada hasil CASE 1-7.
