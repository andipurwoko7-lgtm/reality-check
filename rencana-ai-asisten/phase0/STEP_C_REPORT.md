# STEP C REPORT — faster-whisper Environment Validation

Status: **SELESAI. Percobaan 2 (dengan `PHASE0_TEST_PIN av<17`): C1-C7 semua PASS. **GATE C = PASS (disetujui pemilik, 12 Okt 2026).**
Percobaan 1 (tanpa pin) berhenti di C4 = FAIL (`av==19.0.1`).

| Item | Hasil |
|---|---|
| **Model** | small |
| **Device** | CPU |
| **Compute type** | int8 |
| **Download** | **PASS** (389,4 dtk dari Hugging Face resmi; SHA-256 `model.bin` cocok dengan metadata Hub) |
| **Model load** | **PASS** (1,52 dtk) |
| **Inference** | **PASS** (audio sintetis 8,72 dtk, lokal) |

Baseline: Windows 11 Pro 25H2 · Core Ultra 7 165U (AVX2 ✓) · 31,5 GB RAM · Intel Graphics (tanpa NVIDIA/CUDA).
Format: **STATUS · EVIDENCE · ERROR · INTERPRETATION · NEXT ACTION**. Label: `VERIFIED` (terlihat di data pengguna) · `DESK` · `UNKNOWN`.
Data mentah: `results/step_c/step_c_attempt1_console.txt`, `step_c_attempt1_pip_freeze.txt`, `step_c_results_attempt2_pinned.json`, `step_c_attempt2_pip_freeze.txt`.
**Pin versi apa pun di laporan ini = `PHASE0_TEST_PIN`, bukan dependency produksi final.**

## Ringkasan sub-gate
| Gate | Isi | Percobaan 1 (tanpa pin) | Percobaan 2 (`av<17`) |
|---|---|---|---|
| C1 | venv Python 3.12 | PASS | PASS (venv dipakai ulang) |
| C2 | pip tooling | SKIPPED | SKIPPED (pip 25.0.1) |
| C3 | install faster-whisper | PASS | PASS (24 paket) |
| C4 | import + decode + int8 | **FAIL** | **PASS** |
| C5 | unduh model + checksum | tidak dijalankan | **PASS** |
| C6 | muat model (cpu/int8) | tidak dijalankan | **PASS** |
| C7 | inferensi minimal | tidak dijalankan | **PASS** |

## Versi komponen (`pip freeze` Windows nyata)
| Component | Version | Status | Notes |
|---|---|---|---|
| Python (venv) | **3.12.10** (MSC v.1943, 64-bit) | PASS | `py -3.12`; Python global tidak diubah |
| pip | 25.0.1 | OK | tidak dinaikkan |
| faster-whisper | **1.2.1** | PASS | terbaru di PyPI; mensyaratkan `av>=11` tanpa batas atas |
| ctranslate2 | **4.8.2** | PASS | `int8` didukung di CPU; CUDA 0 perangkat |
| **av** | **16.1.0** (pin `<17`) | PASS | **19.0.1 (tanpa pin) FAIL** di decode. `PHASE0_TEST_PIN` |
| tokenizers | 0.23.3 | PASS | |
| huggingface_hub | 2.2.0 | PASS | unduh dan metadata checksum bekerja |
| onnxruntime | 1.31.0 | PASS (import OK) | tidak dipakai di smoke test (VAD mati) |
| numpy | 2.5.4 | PASS | |
| hf-xet | 1.7.0 | OK | |
| httpx2 / httpcore2 | 2.13.1 / 2.13.1 | OK | transitif `huggingface_hub` 2.x |
| torch | tidak dipasang | n/a | tidak dibutuhkan |
| CUDA / cuDNN | tidak ada | n/a | tidak ada NVIDIA |
| ffmpeg | tidak dipasang | n/a | PyAV membaca WAV sendiri; tidak dibutuhkan untuk smoke test |
| lain-lain | anyio 4.15.1, click 8.5.0, colorama 0.4.6, filelock 4.1.1, flatbuffers 25.12.19, fsspec 2026.9.0, h11 0.16.0, idna 3.20, packaging 26.3, protobuf 7.36.2, PyYAML 6.0.3, tqdm 4.70.1, truststore 0.10.4, typing_extensions 4.16.0 | OK | |

## Hasil per sub-gate — percobaan 2

### C1 — create venv · **PASS**
EVIDENCE: venv Python 3.12.10, dipakai ulang dari percobaan 1, di `D:\phase0-work\venv`. ERROR: tidak ada. INTERPRETATION: Python global tidak tersentuh (`VERIFIED`). NEXT ACTION: tidak ada.

### C2 — pip tooling · **SKIPPED**
EVIDENCE: pip 25.0.1, tidak dinaikkan. Karena C3 berhasil, upgrade pip tidak terbukti perlu.

### C3 — install faster-whisper · **PASS**
EVIDENCE: `pip install ... faster-whisper av<17`, 24 paket terpasang; `av` turun dari 19.0.1 ke 16.1.0 di venv yang sama. INTERPRETATION: PyPI dapat diakses dari laptop (`VERIFIED`). Pemasangan memakai venv yang sudah ada, bukan venv bersih; hasil di venv bersih sangat mungkin sama tetapi belum dijalankan (`DESK`).

### C4 — import + decode test · **PASS**
EVIDENCE: semua import OK; `decode_audio` mengembalikan 16000 sampel; tipe compute CPU yang didukung `float32, int16, int8, int8_float32`; `int8` ✓; CUDA 0 perangkat; `onnxruntime` terimpor. INTERPRETATION: pin `av<17` menghilangkan kerusakan decode di Windows nyata (`VERIFIED`).

### C5 — model download · **PASS**
EVIDENCE: repo `Systran/faster-whisper-small`, commit `536b0662742c02347bc0e980a01041f333bce120`; 389,4 dtk. `model.bin` 483.546.902 byte, **SHA-256 `3e305921...d671` sama persis dengan yang dilaporkan Hub**; `config.json`, `tokenizer.json`, `vocabulary.txt` ukurannya cocok. INTERPRETATION: **Hugging Face dapat diakses dari laptop** dan berkas utuh (`VERIFIED`). Tidak perlu mirror. Kelemahan skrip yang ditemukan setelah run: verifikasi v1 hanya memeriksa berkas yang ada secara lokal, sehingga berkas yang diharapkan Hub tetapi hilang tidak ditandai (kecuali `model.bin`). Sudah diperbaiki di repo; tidak mengubah hasil run ini karena model termuat dan dipakai dengan benar.

### C6 — model load · **PASS**
EVIDENCE: `device=cpu`, `compute_type=int8`, `local_files_only=True`, muat 1,52 dtk. INTERPRETATION: model dimuat dari disk tanpa akses jaringan (`VERIFIED`). Pemakaian RAM/CPU tidak diukur.

### C7 — minimal inference · **PASS**
EVIDENCE: audio sintetis 8,72 dtk dari TTS Windows **Microsoft David Desktop (en-US)**; bahasa terdeteksi `en` (probabilitas 1,0); 2,75 dtk; kemiripan kata 0,79. Transkrip: *"This is a short synthetic test of the local transcription engine. The outstanding value is 495 billion rupiah."* Harapan: "...four hundred ninety five billion rupiah." INTERPRETATION: **pipeline lengkap berfungsi lokal**: audio, model, teks (`VERIFIED`). Selisih kemiripan hanya karena Whisper menulis angka sebagai digit "495", bukan kata. Itu sinyal untuk desain: transkrip nyata akan memuat angka dalam digit dan satuan campuran (mis. "billion"), padahal parser angka PoC hanya menangani satuan Indonesia (`miliar`); WER mentah akan menghukum perbedaan format ini. RTF 0,315 hanya informasi (audio sangat pendek) dan **bukan benchmark**.

## Percobaan 1 — ringkas
C4 FAIL: `TypeError: open() got an unexpected keyword argument 'metadata_errors'` pada `faster_whisper/audio.py` baris 46, dengan `av==19.0.1`. Instalasi apa adanya rusak; `faster-whisper` 1.2.1 mensyaratkan `av>=11` tanpa batas atas, dan tidak ada versi `faster-whisper` yang lebih baru di PyPI (12 Okt).

## Temuan dependensi
| Temuan | Status |
|---|---|
| `av` 19.0.1 gagal decode di Windows nyata (Python 3.12.10) | `VERIFIED` |
| `av` 16.1.0 lolos di Windows nyata | `VERIFIED` |
| Di Linux (replika versi): 16.1.0, 17.1.0, 18.1.0 lolos; 19.0.1 gagal | `VERIFIED` Linux, bukan Windows |
| Batas rusak sebenarnya di 19.x; `<17` adalah pilihan konservatif | Batas produksi belum ditentukan |
| `av` 17.x/18.x di Windows belum diuji | `UNKNOWN` |

## Yang TIDAK dibuktikan oleh Step C
1. **Bahasa Indonesia belum diuji.** Tidak ada suara TTS Indonesia di laptop; smoke test memakai suara Inggris.
2. **Akurasi dan kecepatan belum diukur.** C7 hanya smoke test (Step D/F).
3. Pin `av<17` **bukan** dependency produksi; instalasi venv bersih dengan pin belum diulang.
4. Pemakaian RAM/CPU saat memuat atau menjalankan model tidak diukur.
5. Audio rapat nyata dan audio dari Step B belum diproses.

## Gate C
**Gate C = PASS (disetujui pemilik, 12 Okt 2026)**, dengan butir 1-5 di atas sebagai catatan. Step D disiapkan (lihat `GUIDED_EXECUTION.md`) dan belum dijalankan.
