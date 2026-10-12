# STEP C REPORT — faster-whisper Environment Validation

Status: **MENUNGGU HASIL PENGGUNA. Belum ada sub-gate yang dijalankan di laptop.**
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
| C1 | create venv Python 3.12 | _menunggu_ |
| C2 | pip tooling | _menunggu_ |
| C3 | install faster-whisper | _menunggu_ |
| C4 | import + decode test | _menunggu_ |
| C5 | model download + checksum | _menunggu_ |
| C6 | model load (cpu/int8) | _menunggu_ |
| C7 | minimal inference (audio sintetis) | _menunggu_ |

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

## Hasil per sub-gate
(Diisi setelah `results/step_c/step_c_results.json` masuk. Struktur: STATUS · EVIDENCE · ERROR · INTERPRETATION · NEXT ACTION untuk C1–C7.)

## Catatan desain Step C
- **Lokasi kerja pendek** (`D:\phase0-work`): batas path Windows 260 karakter. Dengan lokasi ekstrak ZIP bersarang dua kali, path terdalam paket diperkirakan ±302 karakter (`DESK`, dihitung dari berkas terpanjang di instalasi Linux). Bukan temuan dari Windows.
- **C4 menguji decode audio**, bukan hanya import: di Linux, `av` 19.0.1 lolos import tetapi gagal saat decode.
- **Unduh model dengan verifikasi**: SHA-256 tiap berkas LFS dicocokkan dengan metadata yang dilaporkan Hub untuk revisi yang sama (commit SHA dicatat).
- **C6 memakai `local_files_only`**: memuat model tidak boleh mengunduh apa pun.
- **C7 = smoke test**: kemiripan kata ≥40% terhadap kalimat yang diucapkan TTS. RTF yang tercatat tidak representatif (audio sangat pendek) dan **bukan benchmark**.

## Gate C
_Menunggu hasil. Step D tidak dimulai sebelum Gate C disetujui._
