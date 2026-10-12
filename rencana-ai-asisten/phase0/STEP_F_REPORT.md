# STEP F - Benchmark (satu rekaman, CPU/int8)

Status: **SIAP DIJALANKAN. Belum dieksekusi di perangkat. Semua angka di bawah = `PENDING` sampai pengguna mengirim hasil.**

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

## Hasil
| Model | Varian | Detik | RTF | RAM puncak | WER ternorm. | Istilah | Di prompt | Luar prompt | Angka | Kualitas |
|---|---|---|---|---|---|---|---|---|---|---|
| small | v0-v2 | PENDING | | | | | | | | |
| medium | v0-v2 | PENDING | | | | | | | | |

## Validasi alat (sandbox, sebelum diserahkan)
- `bench` + `summarize` dijalankan dengan mesin **palsu** (transkrip tiruan dari ground truth + galat sisipan): alur, metrik, berkas hasil, dan read-only transkrip berfungsi. Ini **bukan** hasil Whisper.
- `download` di sandbox: BLOCKED (egress ke huggingface.co ditolak) - jalur unduh nyata, `step_f_run.ps1`, dan pengukuran RAM Windows **belum teruji**.

## Interpretasi / Gate F
PENDING. Jangan menarik kesimpulan dari satu rekaman satu pembicara: hasil adalah indikasi, bukan bukti untuk rapat nyata multi-pembicara.
