# STEP B REPORT — Audio Capture Smoke Test

Status: **HASIL MASUK. Capture bersamaan terbukti; pemisahan mic/sistem BURUK pada speaker laptop. Cek WASAPI belum dilaporkan. Menunggu keputusan Gate B dari pemilik.**
Baseline (Step A, PASS): Windows 11 Pro 25H2 · Core Ultra 7 165U · 31,5 GB RAM · Intel Graphics (tanpa NVIDIA) · output default Speakers Realtek · mic default Microphone Array Intel · **browser uji: Microsoft Edge 154** · OBS dan ffmpeg tidak terpasang.
Asumsi: mic Zoom = mic bawaan; output = speaker laptop; Bluetooth dan headset berkabel tidak diuji; tanpa instalasi; audio simulasi saja.
Data mentah: `results/step_b/step_b_results_interim_1.json` (B1, B2 pertama) dan `step_b_results_2.json` (B2 ulang, B3). Format tiap uji: STATUS · EVIDENCE · ERROR · INTERPRETATION · NEXT ACTION. Label: `VERIFIED` (terlihat di data/sandbox) · `DESK` (belum diuji) · `UNKNOWN`.

## Ringkasan
| Uji | Status | Catatan |
|---|---|---|
| B1 Mic | **PASS** | Mic default terekam utuh |
| B2 Audio sistem | **PASS** (ulang, 12 Okt). Percobaan pertama (9 Okt): PARTIAL | Audio dari proses lain lewat output default tertangkap |
| B3 Mic + sistem bersamaan | **PASS** (capture) · pemisahan **POOR** | Dua file terpisah, tanpa celah. Suara speaker bocor kuat ke mic |
| WASAPI (`record_dual_wasapi.py`) | **belum dilaporkan** | Diperkirakan BLOCKED_BY_DEPENDENCY; tidak gating |

## Validasi & koreksi alat
| Hal | Hasil |
|---|---|
| Logika penilaian `step_b.html` | `VERIFIED` pada 8 skenario sintetis (bersih, speaker bocor, hanya tab, tanpa track audio, izin ditolak, mic senyap, clipping, mic masuk ke sistem); diulang setelah perbaikan di bawah, semua vonis sesuai |
| **Cacat metrik (v1)** | "Fraksi suara aktif" memakai ambang tetap −45 dBFS. Noise floor mic di laptop ini terukur **−44,3 dBFS**, jadi derau terhitung sebagai suara. Angka "98% aktif" di B1 dan "66%" di B3 **bukan bukti adanya suara**. Putusan B1 tidak berubah karena ditopang peak −18,6 dBFS (±26 dB di atas noise) dan penilaian manual "terdengar jelas: ya" |
| Perbaikan (v1.1) | Ambang = noise floor terukur dari segmen hening terpisah + 10 dB (B1 kini diawali 3 detik hening). Percobaan pertama memakai persentil segmen sendiri; regresi menangkap bahwa itu gagal untuk suara kontinu, lalu diganti. Hasil v1 yang sudah masuk tidak dihitung ulang |
| Penangkapan audio nyata | `VERIFIED` di laptop pengguna (Edge 154), lewat JSON pengguna |

## B1 — Mikrofon (Microphone Array Intel)
| | |
|---|---|
| STATUS | **PASS** |
| EVIDENCE | Mic = *Default - Microphone Array (Intel Smart Sound Technology)*. Durasi 25,1 dtk. 48 kHz, track 2 channel. Peak −18,6 dBFS · RMS −37,6 dBFS · clipping 0% · celah chunk maks 1021 ms. AGC/noise suppression/echo cancellation = false. Penilaian manual: terdengar jelas |
| ERROR | Tidak ada |
| INTERPRETATION | Mic default terekam utuh dan tidak clipping. Level rata-rata rendah (RMS −37,6) dan noise floor ruangan tinggi (−44,3 dBFS, dari B3), jadi selisih suara-ke-noise sekitar 15 dB saat B3 (RMS suara −28,9). Cukup untuk lanjut; dampaknya pada akurasi transkripsi baru diketahui di Step D (`UNKNOWN`). Fraksi aktif tidak dipakai (lihat koreksi alat). Uji ini audio **mentah**; Zoom menerapkan pemrosesannya sendiri |
| NEXT ACTION | Tidak ada. Periksa sumber noise (kipas, AC) sebelum Step D bila ingin hasil transkripsi lebih bersih |

## B2 — Audio sistem
| | |
|---|---|
| STATUS | **PASS** (ulang 12 Okt) · percobaan pertama 9 Okt: PARTIAL |
| EVIDENCE | Berbagi **seluruh layar** (`monitor`), track audio ada. Nada 1 kHz dari halaman: **+113,4 dB**. **Fase 3: audio dari proses lain** (PowerShell `SoundPlayer`, `tada.wav` ×5): RMS **−36,8 dB**, delta **+83,2 dB** dari hening digital (−120). Durasi 22,1 dtk, celah chunk 1021 ms. Percobaan pertama: fase 3 hening total (RMS −120) |
| ERROR | Tidak ada error teknis |
| INTERPRETATION | **Terbukti:** berbagi seluruh layar di Edge menangkap audio **proses lain** yang keluar lewat output default, bukan hanya audio halaman itu sendiri. Penyebab percobaan pertama gagal tetap `UNKNOWN` (video tidak diputar di jendela fase 3, atau aplikasi memutar ke perangkat output non-default). **Belum terbukti untuk Zoom**; itu di Step E. Anomali reproduktif: nada terukur −6,6 dB di tiga rekaman, ±5 dB lebih keras dari yang dibangkitkan halaman (−12 dB); penyebab `UNKNOWN`, tidak mempengaruhi vonis |
| NEXT ACTION | Step E: ulangi dengan audio Zoom sungguhan dan periksa perangkat output yang dipakai Zoom |

## B3 — Mic + audio sistem bersamaan (dua file terpisah)
| | |
|---|---|
| STATUS (capture bersamaan) | **PASS** |
| KUALITAS PEMISAHAN | **POOR** |
| EVIDENCE | Dua file terpisah (`mic` 31,2 dtk, `system` 31,3 dtk; rencana 31). Celah chunk maks 1021 ms (tanpa celah). Track sistem: nada +113,4 dB; suara mic **tidak** masuk track sistem (RMS fase bicara −120, kebocoran 0 dB). Mic: noise floor RMS −44,3 dBFS, RMS suara −28,9 dBFS, peak −5,9 dBFS, clipping 0%. **Nada speaker di mic: −18,9 dBFS vs −6,6 dBFS di track sistem → hanya 12,3 dB di bawahnya; naik 72,5 dB dari noise floor tone di mic (−91,4).** Penilaian manual: kedua file terdengar benar |
| ERROR | Tidak ada |
| INTERPRETATION | Mic dan sistem dapat direkam serentak sebagai dua sumber terpisah. **Tetapi dengan output speaker laptop, mic menangkap suara dari speaker dengan kuat.** Dengan pengganti nada murni, artinya suara peserta lain di mic hanya sekitar 12 dB di bawah level di track sistem (`DESK`: bicara nyata bisa berbeda, tergantung volume speaker yang tidak dicatat dan posisi laptop). Konsekuensi: label **USER untuk track mic tidak dapat dipercaya** saat memakai speaker laptop, dan transkripsi mic akan memuat suara peserta lain (risiko R18 terkonfirmasi). Arah sebaliknya bersih: suara mic tidak masuk ke track sistem |
| NEXT ACTION | Dibahas di bagian Signal Separation. Diuji ulang di Step E (CASE 4 dan 5) |

## Signal Separation Check
| Pertanyaan | Hasil |
|---|---|
| System audio bocor ke mic? | **Ya, kuat** (bleed +72,5 dB di atas noise; isolasi hanya 12,3 dB) |
| Mic masuk ke system track? | **Tidak** (0 dB) |
| Dua sumber dapat dibedakan? | Secara teknis ya (dua file), tetapi **track mic tidak bersih** pada speaker laptop |

Mitigasi yang layak diuji (semua `DESK`, **belum diuji**): (1) headset: kebocoran akustik seharusnya hilang, tetapi headset berkabel tidak tersedia dan earbuds Bluetooth cenderung memakai profil hands-free berkualitas rendah; (2) menurunkan volume speaker; (3) membersihkan mic secara offline dengan **track sistem sebagai referensi** (kedua track terekam serentak sehingga referensinya tersedia; butuh library pemrosesan sinyal, baru dipasang di venv Step C); (4) menguji constraint `echoCancellation` browser pada mic. Tidak ada yang diklaim berhasil.

## WASAPI loopback — `record_dual_wasapi.py`
| | |
|---|---|
| STATUS | **belum dilaporkan** (diperkirakan BLOCKED_BY_DEPENDENCY jika PyAudioWPatch tidak terpasang) |
| EVIDENCE | menunggu keluaran `py -3.12 --version` dan cek `find_spec('pyaudiowpatch')` |
| ERROR | — |
| INTERPRETATION | Tidak gating untuk Gate B karena jalur browser sudah membuktikan capture |
| NEXT ACTION | Kirim keluaran dua perintah itu. Instalasi library hanya setelah persetujuan (dapat di venv Step C) |

## Gate B
| Kriteria | Status |
|---|---|
| Mic dapat direkam | ✅ (B1, B3) |
| Audio sistem dapat direkam | ✅ (B2 ulang, B3), termasuk audio proses lain lewat output default |
| Keduanya bersamaan | ✅ (B3, tanpa celah) |
| Track terpisah (target ideal) | ✅ dua file terpisah; ⚠️ pemisahan **POOR** pada speaker laptop |

**Saran status Gate B: PASS (capture).** Dengan catatan wajib: pemisahan mic/sistem tidak bersih dengan speaker laptop, dan belum teruji dengan Zoom nyata. Keputusan final ada pada pemilik. Step C tidak dimulai sebelum Gate B disetujui.

### Dampak pada rekomendasi arsitektur perekam (`PHASE0_REPORT.md` §9, belum diubah)
- Browser capture terbukti **layak** di laptop ini (Edge 154), dengan pemilih layar manual. Itu menambah bukti untuk Opsi A, tetapi aturan pembalik di §9 (tiga sesi ≥30 menit dengan Zoom nyata) belum terpenuhi; rekomendasi sementara tidak berubah.
- Temuan baru yang mempengaruhi desain: **dua track dengan speaker laptop tidak otomatis memberi label USER yang bersih.**
