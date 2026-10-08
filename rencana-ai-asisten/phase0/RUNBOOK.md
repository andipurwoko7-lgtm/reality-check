# RUNBOOK Phase 0 — Uji di Laptop Windows

Perkiraan waktu: **3–4 jam** (bisa dipecah 2 sesi). Semua alat di folder ini **sekali pakai**, bukan kode produksi.

## Aturan keras

1. **Hanya data simulasi** (`test_data/meeting_script.md`). Jangan rekam rapat kantor di Phase 0.
2. Rekaman **tidak boleh** masuk git. Simpan di `results/` (sudah di-ignore) dan jangan diunggah ke mana pun, termasuk ke chat.
3. Yang dikirim balik ke saya hanya **teks angka/CSV/JSON**: tidak ada audio.
4. Pakai akun Zoom pribadi (free) untuk sesi uji, bukan akun kantor.
5. Kalau ragu soal izin menginstal software di laptop kantor: **berhenti dan tulis di Policy Checklist**. Boleh pakai laptop pribadi untuk Phase 0.

---

## Langkah 0 — Catat lingkungan (10 menit)

Tulis (atau jalankan `systeminfo`, Task Manager → Performance):

| Item | Isi |
|---|---|
| Windows (versi/build) | |
| CPU (tipe, core/thread) | |
| RAM | |
| GPU (NVIDIA? VRAM?) | |
| Laptop kantor / pribadi | |
| Chrome & Edge (versi) | |
| Zoom Desktop (versi) | |
| Headset (merek, kabel/Bluetooth) | |
| HP Android (tipe) | |

## Langkah 1 — Pasang alat (15 menit)

```powershell
# Python 3.10–3.12 + ffmpeg harus ada di PATH  (cek: python --version ; ffmpeg -version)
cd rencana-ai-asisten\phase0
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install faster-whisper psutil "av>=14,<17" PyAudioWPatch
python tools\test_idnum.py          # harus "OK" (11 tes)
```

> **Penting:** `av` dikunci `<17`. Di lingkungan uji saya, `av 19.x` (versi terbaru) membuat faster-whisper 1.2.1 gagal membaca audio (`unexpected keyword argument 'metadata_errors'`); `av 15.1.0` dan `16.0.1` berfungsi (diverifikasi di Linux, belum di Windows).

## Langkah 2 — Siapkan "peserta lain"

Skrip `test_data/meeting_script.md`: kamu = **ANDI**. Baris **BUDI** dan **SARI** dibacakan orang lain / perangkat lain yang join Zoom.

Pilihan (urut dari terbaik):
1. **Teman/kolega** (topik fiktif, aman) join Zoom dari perangkatnya dan membaca baris BUDI/SARI.
2. **Satu orang, dua suara**: kamu membaca BUDI/SARI dari HP yang join Zoom (HP = peserta kedua, dekat mic HP). Kualitas lebih buruk dan itu sendiri informasi berguna.

Baca santai, beri jeda 2–3 detik antar giliran → ±5–6 menit. Catat penyimpangan besar dari skrip.

## Langkah 3 — Uji perekaman browser (CASE 1–7)

```powershell
cd tools ; python -m http.server 8765
# buka di Chrome DAN Edge:  http://localhost:8765/capture_test.html
```

Di halaman: pilih sumber → **Rekam uji** (atau **Uji nada**) → bagikan **Seluruh layar** + centang **Bagikan audio sistem** (pilih "Window" tidak membawa audio di Chrome). Unduh hasil ke `results\`. Setelah selesai tiap kasus, isi PASS / PARTIAL / FAIL + catatan di halaman, lalu **Unduh hasil (JSON)**.

| CASE | Cara | PASS | PARTIAL | FAIL |
|---|---|---|---|---|
| 1 Mic | Hanya Mikrofon, bicara 30 dtk | Peak mic ≥ −30 dBFS, file bisa diputar | Perlu atur volume / ada derau besar | Tidak ada audio / izin gagal |
| 2 Audio sistem | Hanya Audio sistem; putar video; **Uji nada** | Track audio ada, delta nada > 15 dB, file berisi audio | Hanya jalan di tab (bukan seluruh layar) | Tidak ada track audio |
| 3 Zoom aktif | Zoom jalan, peserta lain bicara, tangkap audio sistem | Suara peserta lain jelas di track sistem | Terdengar tapi ada derau/notifikasi lain ikut | Peserta lain tidak tertangkap |
| 4 Zoom + headset | Output Windows = headset. Rekam 5 mnt + **Uji nada** | Sistem tertangkap **dan** mic bersih dari nada | Tertangkap tapi mic bocor sedikit (<10 dB) | Audio Zoom tidak tertangkap (mis. Zoom output ke perangkat non-default) |
| 5 Zoom + speaker | Output = speaker laptop. **Uji nada** + rekam | Mic bersih (kebocoran < 5% di evaluator) | Bocor 5–20% (tetap bisa dipakai dengan koreksi) | Bocor >20%: pemisahan mic/sistem tidak bisa dipakai |
| 6 Mic + sistem bersamaan | Keduanya, ≥5 menit saat Zoom | Kedua track terisi, gap chunk < 2,5 dtk, tanpa terputus | Sesekali gap/throttling | Salah satu track mati / sesi terputus |
| 7 Terpisah | Putar `*_mic.webm` & `*_system.webm`; jalankan evaluator leak (langkah 6) | Leak < 5% | 5–20% | > 20% atau file tak terpisah |

Uji tambahan yang saya minta (catat singkat):
- Tab Chrome di-background / layar laptop dikunci 2 menit saat merekam: apakah rekaman utuh?
- Ganti output audio di tengah rekaman (headset dicabut): apa yang terjadi?
- Kalau pakai Bluetooth headset: apakah kualitas mic turun (mode hands-free)?

Pisahkan stereo jika perlu:
```powershell
ffmpeg -i results\X_stereo_L-mic_R-sys.webm -af "pan=mono|c0=c0" results\sim_mic.wav
ffmpeg -i results\X_stereo_L-mic_R-sys.webm -af "pan=mono|c0=c1" results\sim_system.wav
```

## Langkah 4 — Opsi pembanding (fallback)

**OBS (Opsi C)** — 15 menit:
1. Settings → Audio: Desktop Audio = Default, Mic/Aux = mikrofon yang dipakai.
2. Settings → Output → Recording: Format **mkv**, centang **Track 1 dan 2**.
3. Edit → Advanced Audio Properties: Mic hanya **Track 1**, Desktop hanya **Track 2**.
4. Rekam sesi Zoom 5 menit. Pisahkan: `ffmpeg -i rec.mkv -map 0:a:0 results\obs_mic.wav -map 0:a:1 results\obs_system.wav`
5. Catat: kemudahan, gap, ukuran file, apakah headset/speaker mempengaruhi.

**WASAPI loopback (Opsi D)** — *skrip belum pernah diuji, bisa error*:
```powershell
python tools\record_dual_wasapi.py --seconds 60 --out results\wasapi_test
```
Catat: berhasil/tidak, pesan error, apakah Zoom di headset tertangkap, apakah `_mic.wav` dan `_system.wav` terpisah.

## Langkah 5 — Siapkan audio untuk Whisper

Untuk tiap track: 16 kHz mono WAV.
```powershell
ffmpeg -i results\sim_mic.wav -ar 16000 -ac 1 results\sim_mic_16k.wav
ffmpeg -i results\sim_system.wav -ar 16000 -ac 1 results\sim_system_16k.wav
```
Cadangan: satu file gabungan (`mixed`) untuk menguji transkripsi tanpa pemisahan.

## Langkah 6 — Benchmark faster-whisper

Mulai dari model kecil. Jangan langsung `large-v3` di CPU tanpa GPU: bisa berjam-jam. Jalankan di latar belakang.

```powershell
python tools\bench_whisper.py --audio results\sim_mixed_16k.wav --models small medium large-v3-turbo large-v3 `
  --languages id auto --truth test_data\ground_truth_full.txt --facts test_data\key_facts.json `
  --terms test_data\key_terms.json --prompt-file test_data\glossary_prompt.txt --out results\bench_mixed
```
(unduh model pertama kali butuh internet; kalau laptop tanpa GPU dan `large-v3` terlalu lama, hentikan dan catat itu sebagai temuan.)

Evaluasi per track (pemisahan pembicara):
```powershell
python tools\bench_whisper.py --audio results\sim_mic_16k.wav --models medium --truth test_data\ground_truth_andi.txt --out results\bench_mic
python tools\eval_transcript.py --truth test_data\ground_truth_andi.txt --hyp results\bench_mic\transcripts\medium_id_noprompt.txt --other test_data\ground_truth_others.txt --json results\leak_mic.json
python tools\bench_whisper.py --audio results\sim_system_16k.wav --models medium --truth test_data\ground_truth_others.txt --out results\bench_sys
python tools\eval_transcript.py --truth test_data\ground_truth_others.txt --hyp results\bench_sys\transcripts\medium_id_noprompt.txt --other test_data\ground_truth_andi.txt --json results\leak_sys.json
```
Evaluasi manual transkrip (baca 5 menit, tandai): nama orang salah, angka salah, istilah salah. Tempel catatan ke saya.

## Langkah 7 — Policy Checklist & Calendar Discovery (20 menit)

Isi di `PHASE0_REPORT.md` bagian 3 dan 4 (atau kirim ke saya). **Jangan menebak**: jika tidak tahu, tulis `UNKNOWN`. Siapa yang bisa dijawab: atasan, IT/security kantor, kepatuhan/legal, kebijakan data klasifikasi.

## Langkah 8 — Kirim balik ke saya

- Tabel lingkungan (Langkah 0)
- `capture_results.json` (isi PASS/PARTIAL/FAIL + catatan)
- `results\bench_*\results.csv` dan baris `HARDWARE:` dari keluaran
- `results\leak_*.json`
- Catatan manual (nama/angka/istilah yang salah), pesan error, kesan UX
- Jawaban Policy Checklist dan Calendar Discovery
- **Bukan** audio, bukan transkrip yang berisi hal sensitif
