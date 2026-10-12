# STEP D REPORT — First Transcription

Status: **MENUNGGU HASIL PENGGUNA. Belum dijalankan.**
Model: **small** · Device: **CPU** · Compute type: **int8** · Python venv: 3.12.10 · `av` 16.1.0 (`PHASE0_TEST_PIN`) · tanpa jaringan, tanpa instalasi.
Konfigurasi tunggal: `language=id` (dipaksa), `beam_size=5`, VAD aktif, tanpa prompt, `condition_on_previous_text=False`.
Data uji: suara pengguna membaca naskah fiktif 534 kata (`test_data/naskah_baca_stepd.txt`), 20 giliran, satu pembicara untuk semua peran. Ground truth: `test_data/ground_truth_full.txt`.
Format: **STATUS · EVIDENCE · ERROR · INTERPRETATION · NEXT ACTION**. Label: `VERIFIED` · `DESK` · `UNKNOWN`.

## Ringkasan sub-gate
| Gate | Isi | STATUS |
|---|---|---|
| D1 | audio decode | _menunggu_ |
| D2 | transkripsi (waktu, RTF, puncak RAM) | _menunggu_ |
| D3 | bahasa terdeteksi `id` (≥ 0,8) | _menunggu_ |
| D4 | transkrip mentah tersimpan + SHA-256 | _menunggu_ |
| D5 | evaluasi terhadap ground truth | _menunggu_ |

## Metrik (diisi setelah hasil masuk)
| Metrik | Hasil | Ambang Phase 0 (RENCANA §10.5) |
|---|---|---|
| WER mentah | _?_ | (informasi) |
| WER setelah normalisasi angka | _?_ | ≤ 20% |
| CER | _?_ | (informasi) |
| Istilah (strict) keseluruhan | _?_ | ≥ 90% |
| Istilah per kategori: nama / singkatan / finance / Inggris-campur | _?_ | |
| Angka (lenient) | _?_ | ≥ 95% (atau salah-terflag) |
| Angka (strict, dengan mata uang) | _?_ | |
| Tanggal | _?_ | |
| Waktu transkripsi / RTF / puncak RAM | _?_ | informasi |
| Segmen NEEDS_REVIEW | _?_ | |
| Kualitas terhadap ambang | _MEETS / PARTIAL / BELOW_ | deskriptif |

## Validasi alat (sebelum diserahkan)
| Hal | Hasil |
|---|---|
| Decode `.m4a`, `.webm`, `.mp3`, `.wav`, `.ogg` lewat PyAV | `VERIFIED` di sandbox |
| Alur D1-D5 dengan mesin **tiruan** (bukan Whisper) | `VERIFIED`; hasil "MEETS" pada uji itu berasal dari kesalahan yang disisipkan sendiri, bukan kualitas model |
| Transkrip mentah read-only + checksum konsisten; jalan ulang ke folder yang sama | `VERIFIED` |
| Kegagalan bersih pada audio rusak | `VERIFIED` |
| Pengukuran puncak RAM di Windows, skrip PowerShell | **Belum teruji** |

## Hasil per sub-gate
(Diisi setelah `results/step_d/step_d_results.json` dan `evaluation_summary.txt` masuk.)

## Hal yang SENGAJA tidak dibuktikan oleh Step D
- Perbandingan model (`medium`, besar), prompt glosarium, bahasa `auto` (Step F).
- Pemisahan sumber mic/sistem, rekaman Zoom, speaker laptop (Step E).
- Transkrip "bersih" (normalisasi angka/format) dan LLM (Phase 4-5).
- Bacaan satu orang untuk semua peran lebih sederhana daripada rapat nyata (suara berbeda, tumpang tindih, kualitas kanal): hasil cenderung **optimistis** (`DESK`).

## Gate D
_Menunggu hasil. Step E tidak dimulai sebelum Gate D disetujui._
