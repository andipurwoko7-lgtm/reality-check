# STEP C REPORT — faster-whisper Environment Validation

Status: **INTERIM (12 Okt 2026): percobaan 1 (tanpa pin) berhenti di C4 = FAIL. C1 PASS, C2 SKIPPED, C3 PASS. C5-C7 belum dijalankan.** Konsol apa adanya: `results/step_c/step_c_attempt1_console.txt`. `pip_freeze.txt` percobaan 1 belum diterima, jadi versi paket pada percobaan ini `UNKNOWN`.
Model: **small** · Device: **CPU** · Compute type: **int8** · Python: **3.12** (venv terisolasi di `D:\phase0-work\venv`)
Baseline: Windows 11 Pro 25H2 · Core Ultra 7 165U (AVX2 ✓) · 31,5 GB RAM · Intel Graphics (tanpa NVIDIA/CUDA).
Format tiap sub-gate: **STATUS · EVIDENCE · ERROR · INTERPRETATION · NEXT ACTION**. Label: `VERIFIED` · `DESK` · `UNKNOWN`.
Pin versi apa pun di laporan ini = **PHASE0_TEST_PIN**, bukan dependency produksi final.

## Ringkasan
| Item | Hasil |
|---|---|
| Model | small |
| Device | CPU |
| Compute type | int8 |
| Download | _PASS / FAIL / BLOCKED (menunggu)_ |
| Model load | _PASS / FAIL (menunggu)_ |
| Inference | _PASS / FAIL (menunggu)_ |

## Sub-gate
| Gate | Isi | STATUS |
|---|---|---|
| C1 | create venv Python 3.12 | **PASS** |
| C2 | pip tooling | **SKIPPED** (pip tidak dinaikkan, sesuai rencana) |
| C3 | install faster-whisper | **PASS** |
| C4 | import + decode test | **FAIL** (percobaan 1) |
| C5 | model download + checksum | belum dijalankan (berhenti di C4) |
| C6 | model load (cpu/int8) | belum dijalankan |
| C7 | minimal inference (audio sintetis) | belum dijalankan |

## Versi komponen (dari `pip freeze` di Windows nyata; diisi setelah hasil masuk)
| Component | Version | Status | Notes |
|---|---|---|---|
| Python (venv) | _?_ | _?_ | |
| pip | _?_ | _?_ | |
| faster-whisper | _?_ | _?_ | |
| ctranslate2 | _?_ | _?_ | |
| av | _?_ | _?_ | Di Linux: 19.0.1 gagal, 15.1.0 dan 16.0.1 berfungsi (acuan, bukan keputusan) |
| tokenizers | _?_ | _?_ | |
| huggingface-hub | _?_ | _?_ | |
| onnxruntime | _?_ | _?_ | hanya informasi (VAD tidak dipakai di smoke test) |
| numpy | _?_ | _?_ | |
| lain-lain relevan | _?_ | _?_ | |

Referensi Linux sandbox (**bukan Windows**, hanya pembanding): Python 3.13, faster-whisper 1.2.1, ctranslate2 4.8.2, tokenizers 0.23.2, huggingface-hub 1.33.0, onnxruntime 1.30.0, numpy 2.5.3.

## Hasil per sub-gate — percobaan 1 (instalasi tanpa pin)

### C1 — create venv
| | |
|---|---|
| STATUS | **PASS** |
| EVIDENCE | `[C1] create venv : PASS` di Windows nyata. Lokasi kerja pendek `D:\phase0-work\venv` (jalur traceback membuktikan venv ada di situ) |
| ERROR | Tidak ada |
| INTERPRETATION | `py -3.12` tersedia dan venv terbentuk tanpa menyentuh Python global (`VERIFIED`). Versi Python persis di venv ada di JSON yang belum diterima (`UNKNOWN`, diharapkan 3.12.x) |
| NEXT ACTION | Tidak ada |

### C2 — pip tooling
| | |
|---|---|
| STATUS | **SKIPPED** |
| EVIDENCE | `[C2] pip tooling : SKIPPED` |
| ERROR | Tidak ada |
| INTERPRETATION | pip tidak dinaikkan (sesuai rencana). Karena C3 berhasil, upgrade pip tidak terbukti perlu |
| NEXT ACTION | Tidak ada |

### C3 — install faster-whisper
| | |
|---|---|
| STATUS | **PASS** |
| EVIDENCE | `[C3] install faster-whisper : PASS` (pip keluar dengan kode 0) |
| ERROR | Tidak ada |
| INTERPRETATION | **PyPI dapat diakses dari laptop** dan semua dependensi transitif terpasang di Windows (`VERIFIED`). Versi persis `UNKNOWN` sampai `pip_freeze.txt` diterima. Pemasangan berhasil pada lokasi pendek; apakah lokasi panjang akan gagal tidak diuji (`DESK`) |
| NEXT ACTION | Terima `pip_freeze.txt` percobaan 1 |

### C4 — import + decode test
| | |
|---|---|
| STATUS | **FAIL** |
| EVIDENCE | Import paket lolos (kegagalan terjadi di langkah decode, bukan import). `faster_whisper/audio.py` baris 46 memanggil `av.open(input_file, mode="r", metadata_errors="ignore")`; `av` yang terpasang menolak argumen `metadata_errors` |
| ERROR | `TypeError: open() got an unexpected keyword argument 'metadata_errors'` (verbatim, lengkap di `step_c_attempt1_console.txt`) |
| INTERPRETATION | **Ketidakcocokan versi `faster-whisper` dan `av` yang sama dengan temuan Linux**: instalasi apa adanya menghasilkan kombinasi yang rusak saat membaca audio. Ini juga membuktikan bahwa uji decode di C4 memang menangkap masalah yang lolos dari uji import. Versi `av` yang terpasang `UNKNOWN` sampai `pip_freeze.txt` diterima; di Linux versi yang gagal adalah 19.0.1 dan yang berfungsi 15.1.0 dan 16.0.1 (acuan, bukan keputusan untuk Windows) |
| NEXT ACTION | Simpan bukti percobaan 1, lalu ulangi dengan `-AvPin '<17'` (**PHASE0_TEST_PIN**, bukan dependency produksi) dan lihat apakah C4 lolos di Windows |

## Catatan desain Step C
- **Lokasi kerja pendek** (`D:\phase0-work`): batas path Windows 260 karakter. Dengan lokasi ekstrak ZIP bersarang dua kali, path terdalam paket diperkirakan ±302 karakter (`DESK`, dihitung dari berkas terpanjang di instalasi Linux). Bukan temuan dari Windows.
- **C4 menguji decode audio**, bukan hanya import: di Linux, `av` 19.0.1 lolos import tetapi gagal saat decode.
- **Unduh model dengan verifikasi**: SHA-256 tiap berkas LFS dicocokkan dengan metadata yang dilaporkan Hub untuk revisi yang sama (commit SHA dicatat).
- **C6 memakai `local_files_only`**: memuat model tidak boleh mengunduh apa pun.
- **C7 = smoke test**: kemiripan kata ≥40% terhadap kalimat yang diucapkan TTS. RTF yang tercatat tidak representatif (audio sangat pendek) dan **bukan benchmark**.

## Gate C
_Menunggu hasil. Step D tidak dimulai sebelum Gate C disetujui._
