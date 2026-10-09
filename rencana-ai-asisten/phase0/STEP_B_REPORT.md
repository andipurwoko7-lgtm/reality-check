# STEP B REPORT — Audio Capture Smoke Test

Status: **MENUNGGU HASIL PENGGUNA. Belum ada uji yang dijalankan di laptop.**
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
| STATUS | _menunggu_ |
| EVIDENCE | _durasi, sample rate/channel, peak, RMS, clipping, fraksi aktif, penilaian "terdengar jelas"_ |
| ERROR | _—_ |
| INTERPRETATION | _—_ |
| NEXT ACTION | _—_ |

## B2 — Audio sistem
| | |
|---|---|
| STATUS | _menunggu_ |
| EVIDENCE | _displaySurface, track audio ada?, delta nada 1 kHz, delta audio aplikasi lain_ |
| ERROR | _—_ |
| INTERPRETATION | _—_ |
| NEXT ACTION | _—_ |

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
