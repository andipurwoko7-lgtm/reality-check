# STEP B REPORT — Audio Capture Smoke Test

Status: **INTERIM (9 Okt 2026): B1 PASS · B2 PARTIAL · B3 dan WASAPI belum dijalankan.** Data mentah: `results/step_b/step_b_results_interim_1.json`. Browser yang dipakai: **Microsoft Edge 154** (bukan Chrome).
Baseline perangkat (Step A, PASS): Windows 11 Pro 25H2 · Core Ultra 7 165U · 31,5 GB RAM · Intel Graphics (tanpa NVIDIA) · output default Speakers Realtek · mic default Microphone Array Intel · Chrome 154 · OBS dan ffmpeg tidak terpasang.
Asumsi: mic Zoom = mic bawaan laptop; output = speaker laptop; Bluetooth dan headset berkabel tidak diuji; tanpa instalasi; audio simulasi saja.

Format tiap uji: **STATUS · EVIDENCE · ERROR · INTERPRETATION · NEXT ACTION**. Label: `VERIFIED` (terlihat di sandbox) · `DESK` (belum diuji) · `UNKNOWN`.

## Validasi alat (dikerjakan sebelum diserahkan)
| Hal | Hasil |
|---|---|
| Logika penilaian `step_b.html` | `VERIFIED` pada 8 skenario sintetis, semua vonis sesuai. Satu cacat ditemukan dan diperbaiki (pemisahan dilaporkan GOOD walau capture B3 gagal → sekarang `N/A`) |
| Penangkapan audio nyata di Windows | **BELUM DIUJI** (tidak ada akses perangkat) |
| `record_dual_wasapi.py` | Belum terbukti; hanya dicek ketergantungannya (lihat WASAPI) |

## B1 — Mikrofon (Microphone Array Intel)
| | |
|---|---|
| STATUS | **PASS** (otomatis PASS; penilaian manual "terdengar jelas: ya") |
| EVIDENCE | Mic = *Default - Microphone Array (Intel Smart Sound Technology)*, sesuai baseline. Durasi 25,1 dtk (diminta 25). 48 kHz, track melaporkan 2 channel. Peak −18,6 dBFS · RMS −37,6 dBFS · clipping 0% · jendela aktif 98% · celah chunk maks 1021 ms (normal untuk chunk 1 dtk). AGC, noise suppression, echo cancellation = false (pengaturan mentah diterima browser). `VERIFIED` dari JSON pengguna |
| ERROR | Tidak ada |
| INTERPRETATION | Mic default terekam utuh dan jelas. Level rata-rata agak rendah (RMS −37,6) tetapi tidak clipping dan masih jauh di atas ambang senyap; cukup untuk lanjut. Apakah cukup untuk transkripsi baru diketahui di Step D (`UNKNOWN`). Track 2 channel akan di-mixdown ke mono saat transkripsi. Uji ini memakai audio **mentah**; Zoom menerapkan pemrosesannya sendiri, jadi hasil rapat nyata bisa berbeda |
| NEXT ACTION | Tidak ada untuk B1 |

## B2 — Audio sistem
| | |
|---|---|
| STATUS | **PARTIAL** |
| EVIDENCE | Berbagi **seluruh layar** (`displaySurface = monitor`), track audio ada. Nada 1 kHz dari halaman: **+113,4 dB** di atas noise (noise floor = hening digital −120 dB), durasi 22,1 dtk (rencana 22), celah chunk 1021 ms. **Fase 3 (audio dari aplikasi lain): RMS −120 dB = hening digital, delta 0 dB.** `VERIFIED` dari JSON pengguna |
| ERROR | Tidak ada error teknis. Penyebab PARTIAL murni hasil ukur |
| INTERPRETATION | Terbukti: berbagi seluruh layar menangkap **audio yang dihasilkan halaman itu sendiri**. **Belum terbukti:** menangkap audio dari **aplikasi lain**, dan itu yang relevan untuk Zoom. Karena fase 3 benar-benar hening, tidak ada audio apa pun yang masuk saat itu. Penyebab belum diketahui; hipotesis (`UNKNOWN`, belum diuji): (a) audio tidak diputar tepat di jendela fase 3; (b) aplikasi memutar ke perangkat output lain, bukan default (ada banyak endpoint display/TV terdaftar), sehingga tidak masuk loopback default; (c) ada perilaku Edge/Chromium yang belum dipahami. Anomali kecil: level nada terukur −6,6 dB, sekitar 5 dB lebih keras dari yang dibangkitkan halaman (−12 dB); penyebab belum diketahui dan tidak mempengaruhi vonis |
| NEXT ACTION | Ulangi **hanya B2** dengan sumber suara dari proses lain yang pasti memakai output default (suara sistem Windows lewat PowerShell `SoundPlayer`). Jika lolos, hipotesis (a) benar; jika tetap hening, hipotesis (b) atau (c) menjadi fokus |

## B3 — Mic + audio sistem bersamaan (dua file terpisah)
| | |
|---|---|
| STATUS (capture bersamaan) | _menunggu_ |
| KUALITAS PEMISAHAN | _menunggu (GOOD / WEAK / POOR)_ |
| EVIDENCE | _bleed speaker→mic (dB), suara mic→track sistem (dB), isolasi, celah chunk, durasi_ |
| ERROR | _—_ |
| INTERPRETATION | _—_ |
| NEXT ACTION | _—_ |

## Signal separation check (bagian dari B3)
Mic = suara manusia, sistem = nada 1 kHz. Mengukur (a) speaker bocor ke mic, (b) mic masuk ke track sistem, (c) apakah dua sumber dapat dibedakan. Tanpa diarization. Hasil: _menunggu_.

## WASAPI loopback — `record_dual_wasapi.py`
| | |
|---|---|
| STATUS | _menunggu (diperkirakan BLOCKED_BY_DEPENDENCY jika PyAudioWPatch tidak terpasang)_ |
| EVIDENCE | _keluaran `py -3.12 -c "...find_spec('pyaudiowpatch')..."`_ |
| ERROR | _verbatim, jika ada_ |
| INTERPRETATION | _—_ |
| NEXT ACTION | _Instalasi library hanya boleh setelah Gate B dan persetujuan (dapat dilakukan di dalam venv Step C)_ |

## Gate B
| Kriteria | Status |
|---|---|
| Mic dapat direkam | _menunggu_ |
| Audio sistem dapat direkam | _menunggu_ |
| Keduanya bersamaan | _menunggu_ |
| Track terpisah (target ideal) | _menunggu_ |

**Gate B: _menunggu_.** Step C tidak dimulai sebelum Gate B disetujui.
