# STEP F - Benchmark (satu rekaman, CPU/int8)

Status: **DIJALANKAN (small + medium). Kualitas PARTIAL. Menunggu keputusan pemilik: large-v3 atau lewati; Gate F belum dibuka.**

## Tujuan dan batas
- Menjawab: apakah ambang Phase 0 (WER ternormalisasi <= 20%, istilah >= 90%, angka >= 95%) bisa tercapai, dan dengan apa (model lebih besar, prompt glosarium, atau bahasa auto)?
- Rekaman **sama** dengan Step D (suara sendiri membaca naskah fiktif). Tidak ada audio rapat perusahaan. Tidak ada audio yang diunggah atau di-commit.
- Bukan Step E (Zoom/headset/speaker). Bukan Phase 1.

## Desain eksperimen
| Varian | Bahasa | Prompt | Menguji |
|---|---|---|---|
| v0 | id (dipaksa) | tidak | pembanding (= konfigurasi Step D) |
| v1 | id | glosarium **setengah** istilah + nama | efek prompt pada istilah yang disebut dan yang tidak disebut |
| v2 | auto | tidak | efek deteksi bahasa pada campuran ID-EN |

Prompt hanya memuat separuh istilah evaluasi ("di prompt"); separuh lagi ("luar prompt") tidak disebut. Jika "di prompt" naik tapi "luar prompt" tidak, prompt hanya membuat model menyalin daftar, bukan memahami istilah. Hal ini tidak bisa dilihat bila seluruh istilah dimasukkan.

Model: `small` (sudah ada), `medium` (Systran, repo resmi, SHA-256 diverifikasi). Model besar **tidak** dijalankan kecuali diminta lewat `-Large` setelah hasil medium ditinjau; `large-v3-turbo` memakai repo pihak ketiga (mobiuslabsgmbh) sehingga butuh persetujuan eksplisit.
Model berat hanya dijalankan jika RTF v0 model sebelumnya <= 1.0.

## Cara menjalankan (di folder `phase0`, ZIP terbaru)
```
powershell -NoProfile -ExecutionPolicy Bypass -File .\step_f_run.ps1 -Audio "<path rekaman Step D>"
```
Unduh medium ±1,5 GB (perkiraan ~20 menit pada kecepatan Step C); lalu 6 transkripsi. Kirim ke chat **teks saja**: `results\step_f\step_f_summary.md` dan `step_f_summary.json`.

## Hasil (VERIFIED: tempelan konsol/JSON dari pengguna, 12 Okt 2026; audio 253,2 dtk; cpu/int8; VRAM n/a tanpa GPU)
| Model | Varian | Detik | RTF | RAM puncak (MB) | WER mentah | WER ternorm. | CER | Istilah | Di prompt | Luar prompt | Nama | Angka | Tanggal | Flag no_speech | Segmen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| medium | v0 | 192.6 | 0.76 | 1767.7 | 30.1% | 14.4% | 19.7% | 80% | 82% | 76% | 83% | 95% | 100% | 24 | 59 |
| medium | v1 | 228.7 | 0.90 | 1767.7 | 29.9% | 14.7% | 19.2% | 82% | 86% | 71% | 100% | 95% | 100% | 4 | 40 |
| medium | v2 | 241.4 | 0.95 | 1767.7 | 30.1% | 14.4% | 19.7% | 80% | 82% | 76% | 83% | 95% | 100% | 24 | 59 |
| small | v0 | 43.5 | 0.17 | 753.3 | 33.8% | 21.7% | 20.1% | 67% | 64% | 71% | 67% | 95% | 100% | 20 | 37 |
| small | v1 | 44.9 | 0.18 | 753.3 | 33.3% | 21.0% | 20.0% | 69% | 64% | 71% | 83% | 95% | 100% | 20 | 37 |
| small | v2 | 48.3 | 0.19 | 753.3 | 33.8% | 21.7% | 20.1% | 67% | 64% | 71% | 67% | 95% | 100% | 20 | 37 |

Ambang Phase 0: WER ternormalisasi <= 20%, istilah >= 90%, angka >= 95%. Unduh medium: PASS, 1,43 GB, checksum cocok, 1503 dtk. Waktu muat: small 1,1 dtk, medium 9,0 dtk.

## STATUS / INTERPRETASI (tidak lebih kuat dari data)
- **small**: WER ternorm. 21,7% (di atas ambang), istilah 67%. **medium**: WER 14,4% (memenuhi), istilah 80% (belum 90%), angka 95%. Kualitas keduanya **PARTIAL**.
- Model lebih besar memperbaiki WER dan istilah; biaya RTF 0,17 -> 0,76 dan RAM 0,75 -> 1,77 GB. Perkiraan rapat 1 jam di perangkat ini: medium ~45-55 menit (diekstrapolasi, bukan diukur).
- Prompt (v1): medium istilah 80->82%, di-prompt 82->86%, luar-prompt 76->71%, nama 83->100%; small hampir tak berubah. Selisih = 1-2 istilah dari satu rekaman: **indikasi, bukan bukti**. Waktu +19% (medium).
- Bahasa auto (v2): tidak mengubah metrik (identik dengan v0 pada kedua model).
- Flag `no_speech_prob>0.6` pada medium turun 24 -> 4 saat prompt dipakai (segmen 59 -> 40): sebab belum diselidiki; flag ini tidak boleh dipakai sebagai satu-satunya penanda NEEDS_REVIEW.
- WER mentah (30%) jauh di atas WER ternormalisasi (14%): sebagian besar selisih adalah format angka (digit vs kata), bukan salah dengar.
- Belum diuji: model besar (large-v3), rekaman multi-pembicara/Zoom, istilah mana yang meleset (ada di `bench_medium.json`, belum dianalisis).

## Validasi alat (sandbox, sebelum diserahkan)
- `bench` + `summarize` dijalankan dengan mesin **palsu** (transkrip tiruan dari ground truth + galat sisipan): alur, metrik, berkas hasil, dan read-only transkrip berfungsi. Ini **bukan** hasil Whisper.
- `download` di sandbox: BLOCKED (egress ke huggingface.co ditolak) - jalur unduh nyata, `step_f_run.ps1`, dan pengukuran RAM Windows **belum teruji**.

## Gate F
PENDING keputusan pemilik. Jangan menarik kesimpulan dari satu rekaman satu pembicara: hasil adalah indikasi, bukan bukti untuk rapat nyata multi-pembicara.
