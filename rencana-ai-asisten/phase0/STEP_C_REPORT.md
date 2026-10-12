# STEP C REPORT — faster-whisper Environment Validation

Status: **INTERIM (12 Okt 2026): percobaan 1 (tanpa pin) berhenti di C4 = FAIL. C1 PASS, C2 SKIPPED, C3 PASS. C5-C7 belum dijalankan.** Konsol apa adanya: `results/step_c/step_c_attempt1_console.txt`. `pip_freeze.txt` percobaan 1 sudah diterima: **`av==19.0.1`** (`results/step_c/step_c_attempt1_pip_freeze.txt`).
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

## Versi komponen — percobaan 1, instalasi tanpa pin, **Windows nyata** (`VERIFIED` dari `pip_freeze`)
| Component | Version | Status | Notes |
|---|---|---|---|
| Python (venv) | 3.12.x (patch `UNKNOWN`) | OK | `py -3.12` |
| pip | `UNKNOWN` | — | tidak muncul di `pip freeze`; JSON belum diterima |
| faster-whisper | **1.2.1** | OK terpasang | versi **terbaru** di PyPI (12 Okt). Mensyaratkan `av>=11` tanpa batas atas |
| ctranslate2 | 4.8.2 | OK terpasang | `int8` di CPU: diuji di C4 yang belum tercapai |
| **av** | **19.0.1** | **FAIL** | `decode_audio` gagal: `TypeError ... 'metadata_errors'` |
| tokenizers | 0.23.3 | OK terpasang | |
| huggingface_hub | **2.2.0** | OK terpasang | versi mayor 2; C5 belum dijalankan (lihat temuan tambahan) |
| hf-xet | 1.7.0 | OK terpasang | |
| onnxruntime | 1.31.0 | OK terpasang | hanya informasi (VAD tidak dipakai di smoke test) |
| numpy | 2.5.4 | OK terpasang | |
| httpx2 / httpcore2 | 2.13.1 / 2.13.1 | OK terpasang | dependensi transitif `huggingface_hub` 2.x |
| lain-lain | anyio 4.15.1, click 8.5.0, colorama 0.4.6, filelock 4.1.1, flatbuffers 25.12.19, fsspec 2026.9.0, h11 0.16.0, idna 3.20, packaging 26.3, protobuf 7.36.2, PyYAML 6.0.3, tqdm 4.70.1, truststore 0.10.4, typing_extensions 4.16.0 | OK terpasang | |

## Temuan tambahan sebelum pengulangan (sandbox Linux, replika versi Windows; `VERIFIED` di Linux, **bukan** Windows)
Lingkungan replika memakai versi yang sama dengan `pip_freeze` Windows di atas (faster-whisper 1.2.1, ctranslate2 4.8.2, huggingface_hub 2.2.0, tokenizers 0.23.3, onnxruntime 1.31.0, numpy 2.5.4, hf-xet 1.7.0), berbeda hanya di Python (3.13) dan `av`.

| Uji | Hasil |
|---|---|
| `av` 16.1.0, 17.1.0, 18.1.0, + faster-whisper 1.2.1, uji decode (C4) | **PASS** semua |
| `av` 19.0.1 | **FAIL** (sama dengan Windows). Batas rusak yang sebenarnya ada di **19.x**, bukan 17 |
| `av` 15.1.0, 16.0.1 (uji sebelumnya) | PASS |
| C5 dengan `huggingface_hub` 2.2.0 | Mencapai lapisan jaringan tanpa `TypeError` API; berhenti di `ProxyError 403` kebijakan jaringan sandbox. Bentuk metadata checksum di 2.2.0 (`RepoSibling.lfs` → `BlobLfsInfo.sha256`) cocok dengan kode. Pembacaan respons Hub nyata dan checksum setelah unduh **belum teruji** |
| `faster-whisper` di PyPI | 1.2.1 adalah yang terbaru; tidak ada versi yang memperbaiki masalah ini; persyaratan `av>=11` tanpa batas atas |

**Wheel Windows untuk `av`** (dari daftar berkas PyPI, `DESK`, belum dipasang di Windows): 16.1.0 punya `cp312-cp312-win_amd64`; 17.1.0 dan 18.1.0 punya `cp311-abi3-win_amd64` (kompatibel dengan Python 3.12 secara aturan ABI); 19.x punya `cp312-abi3-win_amd64`. Catatan koreksi: sebelumnya saya sempat menulis di chat bahwa 17.x/18.x tidak punya wheel cp312 Windows; itu **keliru** (filter nama berkas saya terlalu sempit). Konsekuensinya, pin `<17` adalah pilihan **konservatif** (versi dengan wheel `cp312` asli dan lolos uji), bukan batas yang dipaksa oleh kerusakan; batas atas produksi yang benar baru ditentukan nanti.

Referensi Linux sandbox (**bukan Windows**, hanya pembanding): Python 3.13, faster-whisper 1.2.1, ctranslate2 4.8.2, tokenizers 0.23.2, huggingface-hub 1.33.0, onnxruntime 1.30.0, numpy 2.5.3.

## Hasil per sub-gate — percobaan 1 (instalasi tanpa pin)

### C1 — create venv
| | |
|---|---|
| STATUS | **PASS** |
| EVIDENCE | `[C1] create venv : PASS` di Windows nyata. Lokasi kerja pendek `D:\phase0-work\venv` (jalur traceback membuktikan venv ada di situ) |
| ERROR | Tidak ada |
| INTERPRETATION | `py -3.12` tersedia dan venv terbentuk tanpa menyentuh Python global (`VERIFIED`). Patch versi Python di venv `UNKNOWN` (JSON belum diterima; `py -3.12` memastikan seri 3.12) |
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
| INTERPRETATION | **PyPI dapat diakses dari laptop** dan semua dependensi transitif terpasang di Windows (`VERIFIED`). Versi terpasang tercatat di tabel versi di bawah. Pemasangan berhasil pada lokasi pendek; apakah lokasi panjang akan gagal tidak diuji (`DESK`) |
| NEXT ACTION | Tidak ada (pip_freeze percobaan 1 sudah diterima) |

### C4 — import + decode test
| | |
|---|---|
| STATUS | **FAIL** |
| EVIDENCE | Import paket lolos (kegagalan terjadi di langkah decode, bukan import). `faster_whisper/audio.py` baris 46 memanggil `av.open(input_file, mode="r", metadata_errors="ignore")`; `av` yang terpasang menolak argumen `metadata_errors` |
| ERROR | `TypeError: open() got an unexpected keyword argument 'metadata_errors'` (verbatim, lengkap di `step_c_attempt1_console.txt`) |
| INTERPRETATION | **Ketidakcocokan versi `faster-whisper` dan `av` yang sama dengan temuan Linux**: instalasi apa adanya menghasilkan kombinasi yang rusak saat membaca audio. Ini juga membuktikan bahwa uji decode di C4 memang menangkap masalah yang lolos dari uji import. Versi `av` yang terpasang di Windows: **19.0.1** (`VERIFIED` dari `pip_freeze`), versi yang sama yang gagal di Linux |
| NEXT ACTION | Simpan bukti percobaan 1, lalu ulangi dengan `-AvPin '<17'` (**PHASE0_TEST_PIN**, bukan dependency produksi) dan lihat apakah C4 lolos di Windows |

## Catatan desain Step C
- **Lokasi kerja pendek** (`D:\phase0-work`): batas path Windows 260 karakter. Dengan lokasi ekstrak ZIP bersarang dua kali, path terdalam paket diperkirakan ±302 karakter (`DESK`, dihitung dari berkas terpanjang di instalasi Linux). Bukan temuan dari Windows.
- **C4 menguji decode audio**, bukan hanya import: di Linux, `av` 19.0.1 lolos import tetapi gagal saat decode.
- **Unduh model dengan verifikasi**: SHA-256 tiap berkas LFS dicocokkan dengan metadata yang dilaporkan Hub untuk revisi yang sama (commit SHA dicatat).
- **C6 memakai `local_files_only`**: memuat model tidak boleh mengunduh apa pun.
- **C7 = smoke test**: kemiripan kata ≥40% terhadap kalimat yang diucapkan TTS. RTF yang tercatat tidak representatif (audio sangat pendek) dan **bukan benchmark**.

## Gate C
_Menunggu hasil. Step D tidak dimulai sebelum Gate C disetujui._
