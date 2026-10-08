# RENCANA PEMBANGUNAN — AI Personal Assistant & Sekretaris Digital

Status: **BASELINE DESIGN v1.1** — disetujui pemilik pada 8 Okt 2026 dengan catatan review. Lihat "Changelog v1.1" di akhir dokumen. Pembangunan aplikasi **belum dimulai**; hanya Phase 0 yang berjalan (lihat `PHASE0_REPORT.md`).
Tanggal: 8 Oktober 2026
Pemilik: Andi (Corporate Finance)

> Catatan baca: angka biaya, durasi, dan performa adalah **estimasi**. Harga layanan dan spesifikasi model berubah cepat. Semua angka harus dicek ulang di Phase 0 sebelum dipakai untuk keputusan.

---

## 1. Executive Summary

**Apa yang dibangun.** Satu aplikasi web (PWA) untuk laptop Windows dan HP Android. Isinya: dashboard harian, agenda dari Google Calendar, perekam rapat, notulen otomatis, catatan harian, task, proyek, pencarian bahasa natural, dan chat dengan asisten. Semua jawaban AI punya sumber yang bisa dicek.

**Inti nilai produk.** Bukan kalendernya (Google Calendar sudah bagus). Nilainya ada di **rantai ini**:

```
Rapat → rekaman → transkrip → notulen → keputusan → task (PIC + deadline) → memori yang bisa dicari
```

Itu yang paling menghemat waktu, tapi juga paling berisiko secara teknis dan privasi. Karena itu urutan pembangunan saya ubah: **validasi rantai rapat dulu**, baru bangun aplikasi di sekelilingnya.

**Keputusan arsitektur utama (rekomendasi):**

| Hal | Rekomendasi |
|---|---|
| Bentuk sistem | Modular monolith, bukan microservices |
| Frontend | React + TypeScript + Vite, PWA |
| Backend | Python FastAPI |
| Database | PostgreSQL + pgvector (satu database untuk relasional, full-text, dan vektor) |
| Transkripsi | **Lokal** di laptop (faster-whisper) lewat "Local Worker"; cloud hanya opsional per rapat |
| LLM | Via lapisan abstraksi; default Claude API (Sonnet-class), dibandingkan dulu di Phase 0 |
| Hosting | VPS kecil + Cloudflare Tunnel/Access, backup terenkripsi ke luar |
| Keamanan AI | AI **tidak punya akses tulis ke dunia luar**. AI hanya membuat usulan; sistem mengeksekusi setelah kamu setuju |

**Tantangan jujur terhadap ide ini** (detail di bagian 23):

1. **Kebijakan perusahaan.** Merekam rapat BUMN, lalu mengirim transkripnya ke layanan AI cloud dan menyimpannya di luar sistem kantor, bisa melanggar kebijakan IT/kerahasiaan. Ini harus dicek **sebelum** Phase 1. Kalau tidak boleh, desainnya berubah (full lokal, LLM lokal, kualitas turun).
2. **Kalender kantor kamu Google atau Outlook?** Kantor BUMN umumnya pakai Microsoft 365. Kalau begitu, integrasi Google Calendar tidak melihat agenda kerja kamu sama sekali. Ini bisa mengubah prioritas integrasi.
3. **MVP versi kamu terlalu besar** untuk dikerjakan paruh waktu. Saya potong jadi dua tahap rilis (MVP-A dan MVP-B).
4. **Diarization (siapa yang bicara) di ruang rapat dengan satu mikrofon itu tidak akurat.** Jangan jadikan syarat. Untuk rapat Zoom, hipotesisnya: rekam mic dan audio sistem sebagai dua track terpisah. **Ini belum terbukti**; diuji di Phase 0.

---

## 2. Tujuan Produk

**Visi.** Sekretaris digital yang ringkas, akurat, dan tidak mengarang. Bekerja seperti staf profesional: menyiapkan, mengingatkan, mencatat, menyarankan, lalu **menunggu persetujuan**.

**Tujuan terukur (setelah MVP-B berjalan 1 bulan):**

| Tujuan | Target |
|---|---|
| Waktu membuat notulen per rapat 1 jam | dari ±45–60 menit menjadi ≤10 menit (review + koreksi) |
| Action item rapat yang tercatat sebagai task | ≥90% (yang lolos review) |
| Waktu mencari "apa keputusan soal X" | dari menit-an menjadi <30 detik, dengan sumber |
| Task yang lewat deadline tanpa disadari | berkurang signifikan (diukur dari jumlah task terlambat yang tidak pernah muncul di briefing) |
| Jawaban AI tanpa sumber | 0 (kalau tidak ada sumber, jawabannya "tidak ditemukan") |

**Prinsip proyek:** Simple first · Local first (jika masuk akal) · Privacy first · Human in the loop · Modular · No over-engineering · Reliable before smart · Auditable AI · Source-based answers.

**Bukan tujuan (non-goals awal):** auto trade, AI bertindak tanpa kontrol, kirim email otomatis, mengambil keputusan bisnis, multi-user skala publik, fitur sosial, apa pun yang tidak terkait asisten pribadi.

---

## 3. User Journey

### 3.1 Satu hari kerja

```
07.30  Buka HP / laptop → "Hari Ini": agenda, 3 prioritas, task terlambat, follow-up rapat
08.00  Notifikasi: rapat jam 09.00 butuh persiapan → buka Briefing Rapat
09.00  Mulai Rapat (Zoom) → tekan "Mulai Rapat" → rekam suara sistem + mic
09.45  Selesai → "Selesai Meeting" → proses di latar belakang
10.30  Notifikasi: "Hasil rapat siap direview"
10.35  Review: edit judul, cek keputusan, cek task (PIC "Andi"? deadline "Jumat" → 9 Okt?) → Approve
10.40  Task masuk daftar, hasil masuk memori
14.00  Rapat offline: tekan rekam di HP → sama
17.30  Evening review: apa selesai, apa geser, task besok
```

### 3.2 Satu kali tanya

"Apa keputusan terakhir soal refinancing MTN?" → jawaban 3 baris + sumber: rapat 2 Okt (menit 23:10), catatan 5 Okt. Klik sumber → lompat ke bagian transkrip.

### 3.3 Satu kali koreksi (penting)

AI salah tangkap PIC → kamu klik, ganti, simpan. Koreksi tercatat dan dipakai sebagai contoh perbaikan prompt. **UI harus membuat koreksi lebih cepat daripada menulis sendiri.** Kalau tidak, produk gagal.

---

## 4. Use Case

| ID | Use case | Prioritas |
|---|---|---|
| UC-01 | Lihat agenda hari ini/besok/minggu ini | MVP-B |
| UC-02 | Buat/ubah/hapus agenda (dengan konfirmasi) | Phase 9 |
| UC-03 | Cari waktu kosong (saya + orang lain) | Phase 9 |
| UC-04 | Rekam rapat (browser laptop/HP) atau upload file | **MVP-A** |
| UC-05 | Transkripsi lokal Bahasa Indonesia + Inggris | **MVP-A** |
| UC-06 | Notulen terstruktur + keputusan + action item | **MVP-A** |
| UC-07 | Review & approve hasil rapat | **MVP-A** |
| UC-08 | Catatan harian (ketik, tempel, suara) | **MVP-A** (ketik/tempel), suara di Phase 9 |
| UC-09 | Task dengan status, prioritas, deadline, proyek | **MVP-A** |
| UC-10 | Proyek sebagai ruang kerja | **MVP-A** |
| UC-11 | Pencarian semantik dengan sumber | MVP-B |
| UC-12 | Chat "Tanya AI" (baca saja) | MVP-B |
| UC-13 | Briefing rapat | Phase 9 |
| UC-14 | Morning briefing / evening review / weekly review | Phase 9 |
| UC-15 | Cari dokumen Google Drive (metadata) | Phase 10 |
| UC-16 | Cari email, buat draft balasan (tidak kirim) | Phase 10 |
| UC-17 | Hapus/ekspor data | Phase 1 (dasar), Phase 11 |

---

## 5. MVP Scope

### 5.1 Evaluasi daftar MVP kamu

Daftar MVP awalmu: Login, Dashboard, Agenda, Google Calendar, Meeting, Upload/rekam, Speech-to-text, Summary, Decision, Action Item, Task, Notes, AI Chat, Search.

Itu **14 modul**. Kalau dikerjakan paruh waktu (10–12 jam/minggu), ini 6–8 bulan dan berisiko tidak selesai. Evaluasi:

| Modul | Keputusan | Alasan |
|---|---|---|
| Login | Masuk, tapi sederhana | Single-user, passkey + 2FA |
| Dashboard | Masuk, versi minimal | Agenda, task, follow-up rapat |
| Agenda + Google Calendar | **Baca saja** di MVP | Tulis ke kalender = risiko tinggi, nilai rendah di awal |
| Meeting upload/rekam | Masuk (inti) | |
| Speech-to-text | Masuk (inti) | |
| Summary/Decision/Action Item | Masuk (inti) | |
| Task, Notes | Masuk | |
| AI Chat | **Dipindah ke MVP-B** | Butuh data di dalamnya dulu. Chat kosong tidak berguna |
| Search | MVP-B | Sama |
| Reminder otomatis, briefing pagi | Setelah MVP | Pakai notifikasi Google Calendar dulu |

### 5.2 Dua tahap rilis

**MVP-A — "Rapat jadi Task"** (target minggu ke-14 pada ±11–15 jam/minggu; pada 10 jam/minggu realistisnya minggu 16–21. Cakupan final MVP-A dipersempit di `PHASE0_REPORT.md` bagian 19)
Login · Proyek · Catatan · Task · Rekam/upload rapat · Transkripsi lokal · Notulen + keputusan + action item · Review/Approve · Dashboard minimal.
*Sudah berguna sendiri*: kamu bisa pakai di rapat nyata.

**MVP-B — "Memori & Asisten"** (target minggu ke-20)
+ Google Calendar (baca) · Pencarian hybrid · Tanya AI (baca saja, dengan sumber) · Dashboard lengkap.

### 5.3 Di luar MVP

Tulis kalender, reminder push, briefing otomatis, Drive, Gmail, input suara untuk catatan, diarization otomatis penuh, cari waktu kosong, weekly review, automasi lanjutan.

---

## 6. Future Scope

Lihat bagian 29. Ringkas: Outlook/M365, Telegram bot, briefing rapat otomatis dari email+dokumen, template rapat khas finance (cashflow review, covenant tracking), deteksi duplikat canggih, graph view, LLM lokal yang lebih baik, dan kemungkinan dijadikan produk/jasa.

---

## 7. System Architecture

### 7.1 Prinsip

- **Modular monolith**: satu aplikasi backend dengan modul terpisah rapi (calendar, meetings, tasks, notes, search, ai). Bisa dipecah nanti bila perlu. Untuk satu pengguna, microservices hanya menambah biaya.
- **Dua lokasi komputasi**:
  - **Server (VPS)**: aplikasi, database, antrean job, notifikasi, integrasi Google.
  - **Laptop (Local Worker)**: transkripsi audio. Audio rapat sensitif tidak perlu keluar dari laptop.
- **AI hanya lewat satu pintu** (LLM Gateway). Semua panggilan tercatat.
- **Aksi berisiko hanya lewat satu pintu** (Approval Gate). AI tidak punya tool tulis eksternal.

### 7.2 Perbandingan lokasi deployment

| Opsi | Kelebihan | Kekurangan | Penilaian |
|---|---|---|---|
| A. Semua di laptop | Paling privat, gratis | HP hanya bisa akses saat laptop menyala; tidak ada notifikasi andal; backup manual | Bagus untuk prototipe saja |
| B. **Hybrid: VPS + Local Worker** | Selalu online, notifikasi andal, audio tetap lokal | Dua komponen untuk dirawat | **Direkomendasikan** |
| C. Full cloud (VPS + STT cloud + LLM cloud) | Paling sederhana, hasil cepat | Audio ke pihak ketiga; paling berisiko di kepatuhan | Hanya sebagai mode opsional per rapat |
| D. Platform managed (Supabase, Vercel, dll.) | Cepat dibangun | Data ke vendor, sulit kontrol residensi, biaya naik | Tidak dipilih |

### 7.3 Komponen

```
Frontend PWA ── HTTPS ──► Cloudflare Tunnel/Access ──► API (FastAPI)
                                                          │
          ┌───────────────┬────────────────┬──────────────┼────────────────┐
          ▼               ▼                ▼              ▼                ▼
      Modul Domain    Approval Gate    LLM Gateway   Integrasi Google   Notifikasi
   (meeting, task,   (pending_actions)  (log + guard) (Calendar/Drive/   (Web Push)
    notes, project)                                      Gmail)
          │                                │
          └───────────► PostgreSQL + pgvector ◄──── Job Queue (di Postgres)
                              ▲                          │
                              │                          ▼
                       File Storage (audio    Worker Server: embedding, ringkasan,
                       sementara, terenkripsi)           briefing, sync kalender
                                                          ▲
                           Local Worker (laptop) ─────────┘ ambil job transkripsi,
                           faster-whisper + VAD            kirim balik teks
```

---

## 8. Diagram Architecture

### 8.1 Konteks

```
┌─────────┐   PWA    ┌──────────────────────── VPS ─────────────────────────┐
│  Andi   │◄────────►│ API · Worker · Postgres · File temp                   │
│ Laptop  │          └───▲───────────▲───────────────▲───────────────────────┘
│ & HP    │              │           │               │
└────┬────┘          Google API   LLM API (opsional   Backup terenkripsi
     │               (scope min)   per sensitivitas)  → storage eksternal
     │  rekam/transkrip lokal
     ▼
┌────────────────┐
│ Local Worker   │  audio TIDAK diunggah pada Audio Route LOCAL_ONLY (§14.1)
│ (laptop)       │
└────────────────┘
```

### 8.2 Lapisan aplikasi

```
Presentation   : React PWA (Hari Ini, Agenda, Rapat, Catatan, Tugas, Proyek, Dokumen, Tanya AI)
API            : REST + (SSE untuk progres job & streaming chat)
Domain         : Meetings · Tasks · Notes · Projects · People · Decisions · Calendar · Documents
Cross-cutting  : Auth · Audit · Approval Gate · LLM Gateway · Search · Jobs · Notifications
Data           : Postgres (+pgvector, FTS) · File store terenkripsi
```

---

## 9. Meeting Recording Architecture

### 9.1 Skenario dan cara rekam

| Skenario | Cara rekam | Catatan |
|---|---|---|
| Zoom/Teams/Meet di laptop | **Di PWA**: `getDisplayMedia` (bagikan layar penuh + centang "bagikan audio sistem") + mic lewat `getUserMedia`, disatukan | **HIPOTESIS, belum diuji:** Chrome/Edge Windows seharusnya bisa menangkap audio sistem lewat berbagi layar + "bagikan audio", dan mic + sistem direkam sebagai 2 track. Syarat/keterbatasan yang diketahui: harus memilih layar penuh setiap sesi, audio yang tertangkap mengikuti output default Windows, Android tidak mendukung audio sistem. Diuji sebagai CASE 1–7 di Phase 0; OBS/recorder lokal adalah cadangan |
| Cadangan Zoom | OBS merekam audio, lalu upload file | Jalur "jaring pengaman" |
| Rapat offline | Mic HP atau laptop lewat PWA | Taruh HP di tengah meja |
| Sudah ada file | Upload audio/video/transkrip | Format: mp3, m4a, wav, mp4, webm, mkv, txt, vtt, srt, docx |

**Ide penting: dua track (hipotesis).** Mic = kamu. Audio sistem = peserta lain. Jika berhasil, "kamu vs orang lain" terpisah **tanpa diarization**. Syaratnya mic tidak menangkap suara peserta lain: dengan headset biasanya aman, dengan speaker laptop suara peserta **bocor ke mic** dan pemisahan rusak. Seberapa parah bocornya diukur di Phase 0 (CASE 4, 5, 7).

### 9.2 Meeting Session (state machine)

```
DRAFT ─► RECORDING ─► PAUSED ─► RECORDING ─► STOPPED ─► UPLOADING ─► QUEUED
                                                            │
        TRANSCRIBING ─► TRANSCRIBED ─► ANALYZING ─► NEEDS_REVIEW ─► APPROVED
              │                            │              │
       TRANSCRIPTION_FAILED          ANALYSIS_FAILED   REJECTED
```

Setiap status disimpan di database. Layar apa pun bisa dipulihkan dari status ini.

### 9.3 Ketahanan perekaman

- Rekam dipotong **chunk 30 detik**, disimpan ke IndexedDB di perangkat, lalu diunggah bertahap.
- Jika internet mati: terus rekam, chunk antre, unggah otomatis saat kembali.
- Jika tab/aplikasi tertutup tiba-tiba: chunk yang sudah tersimpan tetap ada; saat dibuka lagi muncul "Rekaman terputus 12:40. Pulihkan?".
- Layar HP mati: pakai Wake Lock API. **Risiko diketahui**: sebagian HP Android tetap mematikan perekaman web di latar belakang. Mitigasi: panduan "biarkan layar menyala", dan peringatan jika ada celah audio. Cadangan: pakai aplikasi perekam bawaan HP lalu upload.
- Indikator level suara selalu tampil, supaya kamu tahu **mic benar-benar menangkap suara** sebelum rapat berjalan 40 menit.
- Catatan manual selama rapat diberi **timestamp** relatif waktu rekaman, jadi bisa disejajarkan dengan transkrip.

### 9.4 Etika dan hukum

Rekaman rapat butuh persetujuan peserta dan kepatuhan pada kebijakan perusahaan. Aplikasi menyediakan pengingat "Sudah memberi tahu peserta bahwa rapat direkam?" sebelum mulai. Ini keputusan kamu, tapi sistem sebaiknya tidak membuatnya terlupa.

---

## 10. Speech-to-Text Architecture

### 10.1 Perbandingan

| Aspek | A. Lokal | B. Cloud | C. Hybrid (**rekomendasi**) |
|---|---|---|---|
| Privasi | Terbaik, audio tidak keluar | Audio ke pihak ketiga | Pilih per rapat |
| Akurasi Indonesia | Baik (Whisper large/turbo), perlu uji | Baik–sangat baik (tergantung vendor) | Sama |
| Campuran ID+EN | Whisper menangani cukup baik, kadang salah bahasa | Bervariasi | |
| Kecepatan | Tergantung laptop. CPU-only: bisa 1–3 jam proses per 1 jam rapat untuk model besar | Cepat (menit) | |
| Biaya | Gratis | ±US$0,006–0,015 per menit (≈US$0,4–0,9/jam rapat) | |
| Kerumitan | Setup worker di Windows | Paling mudah | Dua jalur |
| Istilah khusus (MTN, CSPA) | Bisa diberi prompt + glosarium | Beberapa vendor punya custom vocabulary | |

**Rekomendasi: Hybrid dengan default Lokal.**
Satu antarmuka `Transcriber`, dua implementasi: `LocalWhisper` (default) dan `CloudSTT` (opsional, harus dipilih per rapat dan hanya untuk rapat berlabel "Biasa").

**Spesifikasi laptop menentukan banyak hal.** Saya butuh: RAM, CPU, ada GPU NVIDIA atau tidak. Tanpa GPU, pakai model `large-v3-turbo` atau `medium` dengan kuantisasi int8, dan terima bahwa transkripsi berjalan di latar belakang (hasil siap "nanti", bukan "langsung").

### 10.2 Pipeline

```
Audio (2 track bila ada)
  ↓ 1. Normalisasi (ffmpeg): mono 16 kHz, loudness
  ↓ 2. VAD (Silero): buang hening → mencegah Whisper "berhalusinasi" pada hening
  ↓ 3. Whisper (faster-whisper), bahasa=id, dengan initial_prompt berisi glosarium
  ↓ 4. Timestamp per segmen + confidence
  ↓ 5. Label pembicara:
        • 2 track bersih → mic = USER (diberi nama pengguna, mis. "Andi"); sistem = PARTICIPANT
          (peserta lain TIDAK diberi nama; hanya "Speaker 1/2" bila diarization, atau "Unknown Participant")
        • 1 track → diarization opsional (pyannote/WhisperX), label "Pembicara 1/2/3"
  ↓ 6. Pembersihan teks (bagian 10.4)
  ↓ 7. Simpan: teks mentah + teks bersih (keduanya, tidak saling menimpa)
```

### 10.3 Diarization — ekspektasi realistis

- Rapat Zoom dua track: *diharapkan* cukup baik untuk "saya vs lainnya" jika kebocoran mic rendah (belum terbukti; Phase 0).
- Rapat offline satu mikrofon, banyak orang, suara tumpang tindih: akurasi sedang. Jangan jadikan syarat kualitas.
- Nama asli: **tidak ditebak dari suara**. Sistem mengusulkan nama dari daftar peserta undangan kalender, kamu yang memetakan "Pembicara 2 = Pak Budi" sekali per rapat. Pemetaan itu disimpan.

### 10.4 Pembersihan teks (tanpa mengarang)

Urutan, dari paling aman ke paling berisiko:

1. **Aturan deterministik**: hapus pengulangan "eee", "anu", rapikan tanda baca.
2. **Glosarium istilah**: daftar milikmu (MTN, CSPA, EBITDA, DSCR, going concern, divestasi, refinancing, nama proyek, nama orang). Koreksi lewat pencocokan mirip (fuzzy). Koreksi di bawah ambang yakin hanya **disarankan**, tidak otomatis.
3. **Normalisasi angka/tanggal** (di bawah).
4. **LLM untuk merapikan**: hanya bila perlu, dengan aturan keras "dilarang menambah, menghapus, atau mengubah fakta; tandai [?] jika ragu".

**Normalisasi angka — aturan keputusan:**

| Kondisi | Tindakan |
|---|---|
| "empat ratus sembilan puluh lima miliar" + konteks nilai uang jelas (rupiah, nilai aset, MTN) | Tampilkan **Rp495 miliar**, simpan teks asli di samping |
| Angka jelas tapi mata uang tidak jelas | Tampilkan "495 miliar" + tanda `NEEDS_REVIEW` (jangan menambah "Rp") |
| Angka terdengar ambigu ("empat sembilan lima" bisa 495 atau 4,95) | Biarkan teks asli + tanda `NEEDS_REVIEW` |
| "juta dolar" | Tulis USD, jangan dikonversi |
| Persentase, bunga, tenor ("sembilan koma lima persen") | Normalisasi 9,5%, simpan asli |

Parser angka berbahasa Indonesia dibuat **deterministik (aturan)**, bukan LLM, supaya hasilnya dapat diuji. LLM hanya membantu menentukan konteks (uang atau bukan).

**Tanggal relatif**: "Jumat" diucapkan hari Kamis 8 Okt → usul Jumat 9 Okt. Diucapkan hari Jumat atau "minggu depan" → ambigu → `UNKNOWN_DEADLINE` + usulan, bukan tebakan.

### 10.5 Cara memutuskan model: bake-off di Phase 0

Uji 3–5 rekaman asli (10 menit tiap rapat, dengan izin), koreksi manual sebagai "kunci jawaban", lalu ukur:

| Metrik | Ambang lulus |
|---|---|
| WER (kesalahan kata), rekaman bersih | ≤ 15–20% |
| Akurasi istilah penting + glosarium | ≥ 90% |
| Akurasi angka dan nilai uang | ≥ 95% (dengan flag untuk sisanya) |
| Waktu proses per jam rapat di laptop kamu | Dicatat; ≤ 3× durasi rapat dianggap bisa dipakai |

Bandingkan: `large-v3`, `large-v3-turbo`, `medium`, model fine-tune komunitas untuk Indonesia (bila ada, perlu diuji), dan satu vendor cloud sebagai pembanding.

---

## 11. AI Architecture

### 11.1 Prinsip

1. **Struktur, bukan prosa bebas.** Ekstraksi memakai output JSON terstruktur yang divalidasi (Pydantic). Output yang tidak valid ditolak dan dicoba ulang, lalu ditandai gagal.
2. **Setiap fakta punya bukti.** Setiap keputusan/action item wajib membawa `evidence_quote` + `timestamp` dari transkrip. Tanpa bukti → tidak dibuat.
3. **Tidak yakin = kosong, bukan tebakan.** Field wajib punya nilai `null` + status (`UNKNOWN_PIC`, `UNKNOWN_DEADLINE`).
4. **AI membaca dan mengusulkan. Sistem mengeksekusi.**
5. **Semua panggilan AI tercatat** (`ai_runs`): model, versi prompt, referensi input, output, token, biaya, latensi.

### 11.2 LLM Gateway

Satu modul yang mengurus semuanya: pemilihan model, retry, timeout, batas biaya harian, pencatatan, pemeriksaan sensitivitas.

| Level sensitivitas rapat | Perilaku |
|---|---|
| **Biasa** | Boleh pakai LLM cloud (transkrip dikirim, audio tidak) dan STT cloud bila dipilih |
| **Sensitif** (default untuk semua rapat kantor) | Audio lokal. Transkrip boleh ke LLM cloud **jika kebijakan perusahaan mengizinkan** (diputuskan di Phase 0) |
| **Sangat Sensitif** | Semuanya lokal: Whisper lokal + LLM lokal (Ollama, model kelas menengah). Kualitas ringkasan lebih rendah, itu harga privasinya |

Mengirim data ke LLM cloud lewat API komersial umumnya tidak dipakai untuk melatih model, tapi **cek syarat penyedia** dan opsi *zero data retention*. Jangan berasumsi.

### 11.3 Pemilihan model LLM

| Opsi | Kekuatan | Kelemahan |
|---|---|---|
| **Claude API (Sonnet-class)** | Ekstraksi terstruktur kuat, Bahasa Indonesia baik, konteks panjang | Data keluar; biaya per token |
| OpenAI / Gemini | Setara; kadang lebih murah | Sama (data keluar) |
| LLM lokal (Qwen/Gemma via Ollama) | Privasi penuh | Kualitas ekstraksi ID lebih rendah, butuh RAM/GPU |

**Rekomendasi:** abstraksi provider + default Claude API, plus model lokal untuk "Sangat Sensitif". Pilihan akhir ditentukan **bake-off di Phase 0** memakai transkrip kamu: 5 rapat × 3 model, nilai precision/recall action item. Model kecil/murah (Haiku-class) untuk klasifikasi ringan; model menengah untuk ringkasan dan chat.

### 11.4 Pipeline analisis rapat (multi-pass)

Satu prompt raksasa itu rapuh. Pakai tahap kecil yang bisa diuji sendiri-sendiri:

```
Transkrip bersih
  ↓ P1 Segmentasi topik  (bagi per topik + rentang waktu)
  ↓ P2 Ringkasan per topik
  ↓ P3 Ekstraksi: keputusan [+bukti]
  ↓ P4 Ekstraksi: action item [tugas, PIC, deadline, +bukti]
  ↓ P5 Isu terbuka, risiko, agenda rapat berikutnya
  ↓ P6 Ringkasan eksekutif (dari output P2–P5, bukan dari awal)
  ↓ P7 Validasi (kode, bukan LLM): bukti ada di transkrip? PIC ada di daftar orang? tanggal valid? duplikat?
  ↓ Hasil → NEEDS_REVIEW
```

Bagian P7 itu penting: kutipan bukti dicek ada di transkrip (pencocokan teks). Jika tidak ada, item ditandai dan tidak dipercaya.

### 11.5 Deteksi task dari rapat

Contoh: *"Andi akan memperbarui cashflow paling lambat Jumat."*

```
tugas      : Perbarui cashflow
pic        : Andi        (dicocokkan ke tabel People; jika ada dua "Andi" → UNKNOWN_PIC / pilih)
deadline   : Jumat 9 Okt (usulan; dasar: rapat Kamis 8 Okt)  → confidence tinggi
bukti      : "Andi akan memperbarui cashflow paling lambat Jumat" [23:41]
status     : PROPOSED  (belum jadi task, belum ada reminder/agenda)
```

Aturan: kalimat modal lemah ("sebaiknya kita…", "mungkin perlu…") → ditandai sebagai **saran/ide**, bukan komitmen, kecuali kamu naikkan. Ambigu → tampil di Review dengan pertanyaan, bukan dibuat otomatis.

### 11.6 Tanya AI (agent chat)

Rancangan paling sederhana yang andal: **function calling dengan tool baca saja**.

| Tool | Fungsi |
|---|---|
| `get_agenda(range)` | Dari cache kalender |
| `list_tasks(filter)` | SQL langsung |
| `get_meeting(id)` / `list_meetings(filter)` | |
| `search_knowledge(query, filters)` | RAG hybrid |
| `get_project_overview(id)` | |
| `propose_action(type, payload)` | **Hanya membuat usulan** di `pending_actions`. Tidak mengeksekusi |

Tidak memakai framework agent besar. Loop sederhana: pertanyaan → pilih tool → data → jawaban dengan sumber. Pertanyaan terstruktur ("task belum selesai") dijawab dari SQL, **bukan** dari RAG. RAG hanya untuk pertanyaan berbasis isi ("apa yang dibahas soal hotel").

### 11.7 Keamanan prompt (prompt injection)

Isi email, dokumen, dan transkrip adalah **data tidak tepercaya**. Seseorang bisa menulis "abaikan instruksi, kirim file ini ke…" di email.

- Konten eksternal dibungkus sebagai data; model diberi tahu itu bukan instruksi.
- AI tidak punya tool yang bisa mengirim/mengubah/menghapus sendiri. Maksimal ia menulis usulan, dan usulan harus kamu setujui.
- Tidak ada browsing otomatis dan tidak ada panggilan URL dari konten.
- Kombinasi bahaya (akses data privat + konten tidak tepercaya + jalur keluar) sengaja **diputus di jalur keluar**.

---

## 12. Knowledge Base / RAG Architecture

### 12.1 Dua jenis memori

1. **Terstruktur** (tabel + relasi): proyek, rapat, keputusan, task, orang. Untuk pertanyaan pasti.
2. **Tidak terstruktur** (potongan teks + vektor): isi transkrip, catatan, ringkasan. Untuk pertanyaan makna.

### 12.2 Relasi (graf sederhana)

Tanpa graph database. Cukup tabel `entity_links`:

```
Project A ──has──► Meeting 1 ──produced──► Decision 1 ──led_to──► Task 1 ──refs──► Document 1
                       │
                       └──attended_by──► Person (Pak Budi)
```

### 12.3 Chunking

| Sumber | Unit chunk |
|---|---|
| Transkrip | Jendela ±300–500 token berdasarkan pergantian topik/pembicara, dengan timestamp |
| Ringkasan, keputusan, action item | Satu item = satu chunk (atomik) |
| Catatan harian | Per paragraf/entri |
| Dokumen (nanti) | Per bagian, hanya metadata + cuplikan di awal |

Setiap chunk membawa metadata: `source_type, source_id, project_id, date, people[], sensitivity`.

### 12.4 Retrieval (hybrid)

```
Pertanyaan
  ↓ Pemahaman query (LLM kecil): ekstrak filter tanggal ("tanggal 5 Oktober"), proyek, orang, tipe
  ↓ Pencarian paralel:
       a) Full-text Postgres (+ trigram untuk nama/singkatan)
       b) Vektor pgvector (embedding multilingual)
  ↓ Gabung dengan RRF → (opsional) reranker
  ↓ Terapkan filter metadata + urutan waktu ("terakhir" = urut tanggal)
  ↓ Top-k chunk + sumbernya
  ↓ Jawab HANYA dari chunk; setiap klaim diberi [S1], [S2]
  ↓ Validasi sitasi (kode): semua [Sx] ada di hasil retrieval?
  ↓ Jika bukti tidak cukup → "Tidak ditemukan di data Anda" (tanpa menebak)
```

Mengapa hybrid: pencarian vektor lemah untuk singkatan dan nama ("CSPA", "Pak Budi"); full-text lemah untuk makna ("pembahasan hotel"). Keduanya saling menutupi.

### 12.5 Embedding

Rekomendasi: model multilingual yang jalan **lokal di server** (BGE-M3 atau yang lebih ringan seperti multilingual-e5). Alasan: teks tidak keluar, tidak ada biaya per query, kualitas Indonesia baik. Memori server naik (BGE-M3 butuh ±2–3 GB), jadi VPS minimal 8 GB atau pakai model lebih kecil. Diputuskan di Phase 0 lewat uji pencarian dengan 20 pertanyaan nyata.

### 12.6 Format jawaban

```
Jawaban (ringkas, 1–5 baris)

Sumber
 • Rapat "Review MTN" — 2 Okt 2026, 23:10  [buka transkrip]
 • Catatan harian — 5 Okt 2026            [buka catatan]
Keyakinan: tinggi / sedang / sebagian (jelaskan bila sebagian)
```

### 12.7 Evaluasi

Buat **golden set** 30–50 pasangan pertanyaan–jawaban–sumber dari datamu. Ukur: hit rate (sumber benar masuk top-5), akurasi jawaban, tingkat "tidak ditemukan" yang benar. Jalankan ulang setiap ganti model/prompt.

---

## 13. Database Design

PostgreSQL. Semua tabel punya `id (UUID)`, `created_at`, `updated_at`; tabel utama punya `deleted_at` (soft delete 30 hari). Single-user, tapi kolom `user_id` tetap disertakan agar tidak perlu migrasi menyakitkan nanti.

### 13.1 Tabel inti

| Tabel | Kolom penting |
|---|---|
| **users** | email, display_name, auth (passkey credentials), totp_secret_enc, timezone, locale |
| **projects** | name, slug, overview, status (aktif/arsip), color, parent_id |
| **people** | name, aliases[], email, organization, role_title, notes |
| **meetings** | title, project_id, calendar_event_id, started_at, ended_at, type (online/offline), platform, sensitivity, status, source (rekam/upload/transkrip) |
| **meeting_participants** | meeting_id, person_id, role (host/peserta/notulis), attended (bool), speaker_label |
| **recordings** | meeting_id, storage_path, track (mic/system/mixed), duration, checksum, status, delete_after |
| **transcripts** | meeting_id, version, engine, model, language, raw_text, clean_text, status |
| **transcript_segments** | transcript_id, start_ms, end_ms, speaker_label, person_id?, text_raw, text_clean, confidence |
| **meeting_summaries** | meeting_id, version, executive_summary, discussion_points (JSON), open_issues, risks, next_agenda, notes, status (draft/approved), ai_run_id |
| **decisions** | meeting_id, project_id, text, evidence_quote, evidence_start_ms, status (proposed/approved/rejected/superseded), superseded_by |
| **action_items** | meeting_id, text, pic_person_id?, pic_raw, deadline?, deadline_raw, evidence_quote, confidence, flags[] (UNKNOWN_PIC, UNKNOWN_DEADLINE, NEEDS_REVIEW), review_state, task_id? |
| **tasks** | title, description, project_id, source_type, source_id, pic_person_id?, deadline, priority (1–4), status (BELUM_DIMULAI, SEDANG_DIKERJAKAN, MENUNGGU, SELESAI, DIBATALKAN), notes, meeting_id?, action_item_id?, completed_at, fingerprint (anti-duplikat) |
| **calendar_events** | provider, external_id, calendar_id, title, start/end, attendees (JSON), location, meeting_url, etag, last_synced_at, sync_status |
| **daily_notes** | note_date, title, body, raw_input, input_mode (ketik/suara/tempel/AI), project_id?, follow_ups (JSON) |
| **documents** | provider, external_id, name, mime, url, owner, modified_at, project_id?, snippet, last_seen_at |
| **tags** + **taggings** | tag(name, color); tagging(tag_id, entity_type, entity_id) |
| **attachments** | entity_type, entity_id, storage_path, mime, size, checksum |
| **ai_conversations** + **ai_messages** | conversation(title, started_at); message(role, content, sources (JSON), ai_run_id) |
| **ai_runs** | purpose, model, prompt_version, input_refs (ID, bukan salinan penuh), output, tokens_in/out, cost, latency, status, error |
| **search_chunks** | source_type, source_id, project_id, chunk_text, embedding (vector), tsv (tsvector), meta (JSON), sensitivity |
| **entity_links** | from_type, from_id, to_type, to_id, relation, created_by (user/ai), confirmed (bool) |
| **pending_actions** | action_type, payload (JSON), preview, risk_level, status (pending/approved/rejected/expired/executed/failed), requested_by (ai/user), expires_at, idempotency_key, executed_at |
| **jobs** | type, payload, status, attempts, last_error, scheduled_at, locked_by |
| **notifications** | type, title, body, entity_ref, scheduled_at, sent_at, read_at, channel |
| **audit_logs** | at, actor (user/ai/system), action, entity_type, entity_id, before/after (ringkas), ip, result — **append-only** |
| **glossary_terms** | term, aliases[], category (istilah/singkatan/nama), project_id? |
| **settings** | key, value (JSON), scope |
| **integration_accounts** | provider, scopes, token_enc (terenkripsi), status, last_ok_at |

### 13.2 Relasi utama

```
users 1─* projects
projects 1─* meetings, tasks, daily_notes, documents, decisions
meetings 1─* meeting_participants *─1 people
meetings 1─* recordings, 1─* transcripts 1─* transcript_segments
meetings 1─* meeting_summaries, decisions, action_items
action_items 0..1─1 tasks            (terbentuk SETELAH approve)
meetings *─0..1 calendar_events
tasks *─0..1 people (PIC)
semua entitas ─* tags (via taggings), ─* attachments, ─* search_chunks, ─* entity_links
```

### 13.3 Keputusan desain

- **`action_items` terpisah dari `tasks`.** Action item = hasil ekstraksi AI (belum disetujui, punya bukti dan flag). Task = pekerjaan resmi. Sesuai aturan "baru setelah approve task dibuat".
- **Versi transkrip dan ringkasan** (`version`): re-analisis tidak menimpa koreksimu.
- **`fingerprint` task**: hash dari (judul ternormalisasi + PIC + proyek) untuk mendeteksi duplikat.
- **Data mentah tidak dibuang** saat dibersihkan (`text_raw` dan `text_clean`).
- **Enkripsi per kolom tidak dipakai untuk transkrip**, karena merusak full-text search. Gantinya: enkripsi disk + kontrol akses (lihat bagian 15). Token OAuth dan rahasia dienkripsi per kolom.

---

## 14. Data Flow

### 14.1 Rapat → memori

```
1  Mulai Rapat      → buat meeting + recording session
2  Rekam            → "Audio Route" menentukan jalurnya (v1.1, menutup inkonsistensi §11.2 vs alur ini):
                       • LOCAL_ONLY (default untuk rapat laptop berlabel Sensitif/Sangat Sensitif):
                         audio ditulis ke disk laptop oleh perekam lokal, ditranskripsi oleh Local Worker,
                         dan HANYA teks yang dikirim ke server. Audio tidak pernah ke server.
                       • SERVER_TEMP (rekaman HP, atau rapat berlabel Biasa): chunk 30s → IndexedDB →
                         unggah terenkripsi → file temp server → ditarik Local Worker, lalu dihapus.
                       Rekaman HP berlabel Sensitif hanya boleh SERVER_TEMP jika kebijakan kantor mengizinkan
                       (keputusan terbuka D-04); jika tidak, pindahkan file ke laptop secara manual.
3  Selesai          → job TRANSCRIBE
4  Local Worker     → ambil audio → Whisper → kirim teks + segmen
5  Server           → job CLEAN (aturan + glosarium + angka)
6  Server           → job ANALYZE (P1–P7) lewat LLM Gateway
7  Status NEEDS_REVIEW → notifikasi
8  Kamu             → edit / approve / reject
9  Approve          → transaksi tunggal:
                       • buat tasks dari action_items yang disetujui
                       • simpan decisions
                       • buat entity_links
                       • job INDEX (chunk + embedding)
                       • (Phase 9) usulan agenda/reminder → masuk Approval Gate
10 Audio            → dihapus sesuai kebijakan retensi
```

### 14.2 Catatan harian

```
Ketik/tempel/suara → (AI) strukturkan: topik, isi, tindak lanjut, deadline, tag/proyek (sebagai USULAN)
→ preview → simpan → index. Tindak lanjut yang jadi task → melewati konfirmasi.
```

### 14.3 Pertanyaan ke asisten

```
Pertanyaan → router (SQL atau RAG) → data + sumber → jawaban + sitasi → log ai_run
```

### 14.4 Aksi berisiko

```
AI/pengguna minta aksi → pending_actions (preview persis apa yang akan terjadi)
→ kartu konfirmasi → Setuju → backend eksekusi (idempotent) → audit_log → hasil
Tolak/kedaluwarsa (24 jam) → tidak ada yang terjadi
```

---

## 15. Security & Privacy Design

### 15.1 Apa yang disimpan, di mana

| Data | Lokasi | Dikirim ke AI? | Retensi default |
|---|---|---|---|
| Audio rapat | Laptop saja (Audio Route LOCAL_ONLY, default Sensitif/Sangat Sensitif) atau file temp terenkripsi di server (SERVER_TEMP: rekaman HP / rapat Biasa) | **Tidak** (kecuali STT cloud dipilih per rapat) | Hapus 7 hari setelah approve, atau langsung bila diatur |
| Transkrip | Postgres (VPS) | Ya ke LLM jika sensitivitas mengizinkan | Sampai kamu hapus |
| Ringkasan, keputusan, task, catatan | Postgres | Potongan relevan saat Tanya AI | Sampai dihapus |
| Embedding | Postgres | Dibuat lokal, tidak keluar | Ikut sumbernya |
| Kalender (cache) | Postgres | Judul/peserta relevan saja | 90 hari ke belakang |
| Dokumen Drive | **Hanya metadata + cuplikan** | Hanya cuplikan relevan | Sinkron ulang berkala |
| Email | **Tidak disimpan penuh**; metadata + referensi ID, isi diambil saat dibutuhkan | Hanya yang diminta | — |
| Token Google | Terenkripsi (AES-GCM, kunci di luar DB) | Tidak | Sampai dicabut |
| `ai_runs` | Postgres | — | 90 hari |
| `audit_logs` | Postgres | — | 2 tahun |

### 15.2 Prinsip data minimization ke AI

Kirim **potongan yang relevan**, bukan seluruh basis data. Nama file, label sensitivitas, dan batas token diatur di LLM Gateway. Rapat berlabel "Sangat Sensitif" tidak akan pernah diteruskan ke provider cloud (diblok di kode, bukan hanya di UI).

### 15.3 Autentikasi dan akses

- Cloudflare Tunnel (tanpa port terbuka di VPS) + **Cloudflare Access** (login Google + syarat tertentu) sebagai lapis pertama.
- Aplikasi: **passkey (WebAuthn)** + cadangan TOTP. Tidak ada login password-saja.
- Sesi pendek, idle timeout (misal 12 jam di laptop pribadi, 30 menit di perangkat baru), perangkat terdaftar.
- SSH VPS: hanya kunci, tanpa password, firewall menutup semua selain yang perlu.

### 15.4 Enkripsi

- **Di jalan**: TLS.
- **Diam**: enkripsi disk VPS; audio temp dienkripsi di aplikasi (per-file key); token dan rahasia dienkripsi per kolom; backup dienkripsi sebelum keluar server (age/restic).
- **Trade-off jujur**: isi transkrip di database tidak dienkripsi per kolom, karena itu mematikan pencarian. Risikonya dikurangi oleh enkripsi disk, akses terbatas, dan tidak ada akses publik. Kalau ini tidak cukup untuk kepatuhan kantor → jalur "full lokal" (Opsi A) menjadi pilihan.

### 15.5 Izin Google (scope minimum)

| Layanan | Scope MVP | Nanti | **Tidak pernah diminta** |
|---|---|---|---|
| Calendar | `calendar.readonly` | `calendar.events` (tulis, dengan konfirmasi) | — |
| Drive | `drive.metadata.readonly` | `drive.readonly` bila perlu cuplikan | Scope tulis/share |
| Gmail | — | `gmail.readonly` + `gmail.compose` (hanya buat draft) | **`gmail.send`**. Sistem secara teknis tidak bisa mengirim email |

Ini kontrol yang paling kuat: bukan sekadar aturan di prompt, tapi **izin yang memang tidak dimiliki**.

> Bila kalender kantor Microsoft 365 (v1.1): padanan prinsipnya adalah Microsoft Graph dengan izin delegated `Calendars.Read` (tulis `Calendars.ReadWrite` baru nanti, dengan konfirmasi), dan tidak pernah `Mail.Send`. Banyak tenant BUMN membatasi persetujuan aplikasi (admin consent); itu bergantung kebijakan IT.

> Catatan teknis: aplikasi OAuth Google berstatus "Testing" membuat refresh token kedaluwarsa sekitar 7 hari. Perlu strategi (mis. status "In production" tanpa verifikasi untuk pemakaian pribadi). Dicek di Phase 6.

### 15.6 Audit dan transparansi

- `audit_logs` append-only (peran database aplikasi tidak punya hak UPDATE/DELETE di tabel itu).
- Halaman **"Jejak AI"**: untuk tiap hasil AI, lihat model, prompt versi berapa, sumber apa yang dibaca.
- Log aplikasi tidak boleh memuat isi transkrip/email (scrubbing).

### 15.7 Penghapusan data

- Hapus rapat → soft delete 30 hari (bisa dipulihkan) → hard delete: transkrip, segmen, ringkasan, chunk, embedding, file audio. Task yang sudah dibuat dari rapat itu: **kamu pilih** (simpan/ikut dihapus).
- Backup menyimpan salinan sampai bergulir habis (30 hari). Ini dinyatakan jelas di UI.
- "Hapus semua data" dan "Ekspor semua data" (JSON + Markdown) tersedia di Pengaturan.

### 15.8 Pertanyaan kepatuhan yang harus dijawab sebelum membangun

1. Apakah kebijakan perusahaan mengizinkan merekam rapat dan menyimpannya di perangkat/layanan pribadi?
2. Apakah transkrip boleh dikirim ke API AI pihak ketiga? Pihak mana yang disetujui?
3. Apakah ada klasifikasi dokumen (rahasia/terbatas) yang melarang hal di atas?
4. Apakah laptop kantor boleh dipasang Local Worker dan software lain?
5. Apakah ada ketentuan hak kekayaan intelektual jika aplikasi nanti dikembangkan jadi produk?

Jika jawaban 1–4 "tidak", rencana beralih ke **Mode Pribadi-Lokal** (hanya data pribadi dan rapat non-rahasia, atau full lokal). Lebih baik tahu sekarang daripada setelah 3 bulan membangun.

---

## 16. Human Approval Policy

Pola: **READ → ANALYZE → RECOMMEND → CONFIRM → EXECUTE**

### 16.1 Matriks

| Aksi | Kebijakan |
|---|---|
| Baca kalender, task, catatan, dokumen, email | Otomatis |
| Menganalisis, meringkas, mencari | Otomatis |
| Membuat draft (notulen, balasan email, catatan) | Otomatis, ditandai **DRAFT** |
| Membuat task dari rapat | **Setelah Approve** hasil rapat |
| Membuat task manual dari chat | Konfirmasi ringan (1 klik) |
| Membuat/ubah agenda atau undangan | **Konfirmasi eksplisit** (tampilkan sebelum/sesudah) |
| Menghapus apa pun | **Konfirmasi eksplisit** + ketik nama untuk data besar |
| Mengirim email/pesan | **Dilarang secara teknis** (tidak ada scope kirim). Hanya buat draft di Gmail |
| Membagikan dokumen / ubah izin | **Dilarang di MVP**; nanti butuh konfirmasi |
| Mengubah dokumen | **Dilarang di MVP** |
| Mengubah pengaturan keamanan | Konfirmasi + autentikasi ulang |

### 16.2 Mekanisme

1. Kartu konfirmasi menampilkan **persis** apa yang akan terjadi (judul, waktu, peserta, perubahan sebelum→sesudah).
2. Eksekusi dilakukan **kode backend**, bukan model.
3. Kedaluwarsa 24 jam; idempotent (klik dua kali tidak membuat dua agenda).
4. Setiap eksekusi masuk `audit_logs`.
5. Permintaan batch: konfirmasi sekaligus tapi tiap item bisa dicoret.
6. "Selalu izinkan" tidak tersedia untuk aksi berisiko di MVP.

---

## 17. Technology Recommendation

Prioritas: sederhana, stabil, murah, mudah dirawat, bisa berkembang, aman. Satu pilihan per kategori, dengan alasan.

| Kategori | Pilihan | Alternatif dipertimbangkan | Alasan |
|---|---|---|---|
| **Frontend** | React + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query | Next.js, SvelteKit, Flutter | Aplikasi satu pengguna di belakang login: tidak perlu SSR/SEO. React punya ekosistem dan dukungan alat AI terbaik. Flutter berlebihan untuk web-first |
| **PWA** | vite-plugin-pwa (service worker, manifest) | Aplikasi native | Satu basis kode untuk laptop dan Android |
| **Backend** | Python 3.12 + FastAPI + SQLAlchemy + Alembic | NestJS, Django | Ekosistem AI/audio (Whisper, pyannote, embedding) paling kuat di Python; Pydantic cocok untuk validasi output LLM. Django opsi kedua (admin gratis) tapi lebih berat |
| **Database** | PostgreSQL 16 | SQLite, MongoDB | Relasi kuat, FTS, JSON, dan pgvector dalam satu tempat |
| **Vector DB** | **pgvector** (di Postgres yang sama) | Qdrant, Pinecone, Chroma | Data kecil (puluhan ribu chunk). Database terpisah = beban rawat tanpa manfaat |
| **Speech-to-Text** | faster-whisper (CTranslate2) + Silero VAD, di Local Worker | whisper.cpp, API cloud | Cepat di CPU/GPU, mudah diprogram. whisper.cpp alternatif jika instalasi Python di Windows kantor menyulitkan |
| **Diarization** | Dua track (mic vs sistem); pyannote/WhisperX opsional | Cloud diarization | Dua track lebih andal dan gratis |
| **LLM** | Gateway + default Claude API; model lokal (Ollama) untuk Sangat Sensitif | OpenAI, Gemini | Dipilih final lewat bake-off |
| **Embedding** | BGE-M3 (lokal di server) | API embedding | Privasi + gratis per query + bagus untuk Indonesia |
| **Autentikasi** | Passkey (WebAuthn) + TOTP + Cloudflare Access | Auth0, Clerk, password | Single-user: tanpa layanan pihak ketiga, tahan phishing |
| **File storage** | Disk VPS terenkripsi untuk audio sementara | S3/R2 | Audio sementara; objek storage tidak perlu. Backup ke R2/B2 |
| **Background worker** | Antrean di Postgres (`SKIP LOCKED`, mis. Procrastinate) | Celery+Redis, Temporal | Satu komponen lebih sedikit. Cukup untuk beban pribadi |
| **Scheduler** | Task terjadwal di antrean yang sama | cron + skrip | Satu mekanisme |
| **Calendar/Drive/Gmail** | Google API client resmi, OAuth scope minimum, lewat interface `CalendarProvider` | Zapier/n8n | Kontrol penuh, bisa tambah `MicrosoftProvider` |
| **Notifikasi** | Web Push (PWA) + opsional bot Telegram | SMS, WhatsApp | Gratis dan andal di Android/Chrome |
| **Backup** | pg_dump terjadwal → enkripsi (age/restic) → Cloudflare R2/Backblaze B2 + salinan mingguan lokal | Snapshot saja | Aturan 3-2-1 |
| **Deployment** | Docker Compose di satu VPS + Cloudflare Tunnel | Kubernetes, PaaS | Cukup, murah, mudah dipulihkan |
| **Observability** | Log terstruktur, Sentry (free, PII di-scrub), healthchecks.io/Uptime Kuma, halaman "Kesehatan Sistem" | Prometheus+Grafana | Cukup tahu kapan job gagal; tidak perlu dashboard metrik besar |
| **CI** | GitHub Actions: lint, tes, build, scan rahasia | — | Standar |
| **Hosting lokasi** | VPS Indonesia (IDCloudHost/Biznet Gio) atau Singapura | Hetzner EU | Latensi dan residensi data; pilih setelah cek kebijakan |

**Sengaja tidak dipakai:** Kubernetes, microservices, Redis, Kafka, graph database, LangChain/agent framework berat, vector DB terpisah, SSR framework. Masing-masing bisa ditambah nanti jika ada alasan terukur.

---

## 18. UI/UX Sitemap

Bahasa UI: Indonesia natural. Hindari istilah teknis ("sinkron", bukan "sync job"; "diproses", bukan "queued").

```
Aplikasi
├── Hari Ini            (Command Center)
├── Agenda
│     ├── Hari ini · Besok · Minggu ini
│     └── Detail agenda → Briefing · Catatan terkait · Task terkait
├── Rapat
│     ├── Daftar rapat (filter proyek/tanggal/peserta)
│     ├── Mulai Rapat (sesi rekam)
│     ├── Unggah rekaman / transkrip
│     └── Detail rapat
│           ├── Review Hasil (Edit · Approve · Reject)
│           ├── Notulen · Keputusan · Tindak lanjut
│           └── Transkrip (klik kutipan → lompat ke audio/teks)
├── Catatan
│     ├── Catatan harian (kalender mini)
│     └── Catatan baru (ketik · tempel · suara)
├── Tugas
│     ├── Daftar · Papan (Kanban) · Terlambat · Minggu ini
│     └── Detail tugas
├── Proyek
│     └── Detail proyek: Overview · Rapat · Catatan · Tugas · Dokumen · Keputusan · Timeline
├── Dokumen             (Phase 10)
├── Tanya AI            (satu halaman chat + sumber)
├── Persetujuan         (antrean usulan yang menunggu keputusanmu)
└── Pengaturan
      ├── Akun & keamanan (passkey, perangkat)
      ├── Integrasi (Google/Outlook)
      ├── Privasi & data (retensi, ekspor, hapus)
      ├── Glosarium & orang
      ├── Notifikasi
      └── Kesehatan sistem · Jejak AI · Log audit
```

**Navigasi:** laptop = sidebar kiri; HP = bottom bar 5 item (Hari Ini, Rapat, Catatan, Tugas, Tanya AI) + tombol "+" besar. Item lain di menu "Lainnya".

**Prinsip UX:** ringkas, actionable, mudah dikoreksi. Satu layar Review untuk hasil rapat, dengan tombol "Setuju semua yang yakin" dan "Tinjau yang ragu". Item ragu diberi lencana jelas: `PIC belum jelas`, `Deadline belum jelas`, `Perlu dicek`.

---

## 19. Dashboard Concept

### 19.1 Laptop

```
┌────────────────────────────────────────────────────────────────────────┐
│ Selamat pagi, Andi                          Kamis, 8 Oktober 2026      │
├───────────────────────────────┬────────────────────────────────────────┤
│ AGENDA HARI INI               │ PRIORITAS HARI INI                     │
│ 09.00  Meeting A              │ 1. Update simulasi bunga MTN  ⚠ besok  │
│ 11.00  Meeting B              │ 2. Cashflow review (14.00)             │
│ 14.00  Review Cashflow ▸ Siap │ 3. Balas Pak Budi (follow-up)          │
│        briefing               │ [Saran AI: mulai dari #1]              │
├───────────────────────────────┼────────────────────────────────────────┤
│ TASK                          │ FOLLOW-UP RAPAT                        │
│ Belum selesai 12              │ • 2 hasil rapat menunggu review        │
│ Terlambat 2   (merah)         │ • 3 task belum ada deadline            │
│ Deadline minggu ini 5         │                                        │
├───────────────────────────────┴────────────────────────────────────────┤
│ CATATAN TERAKHIR: "Refinancing MTN: …"                                 │
├────────────────────────────────────────────────────────────────────────┤
│ [+ Catatan] [+ Rapat] [+ Task] [+ Agenda] [🎙 Rekam Rapat] [Tanya AI]  │
└────────────────────────────────────────────────────────────────────────┘
```

### 19.2 HP

Satu kolom: sapaan → **Rekam Rapat** (tombol besar) → agenda → 3 prioritas → perlu review → task terlambat. Quick action jadi tombol "+" mengambang. Bagian lain bisa dilipat.

### 19.3 Aturan desain

Tidak ramai: maksimal 6 blok. Warna merah **hanya** untuk terlambat. Mode terang/gelap. Font mudah dibaca. Aksesibilitas dasar (kontras, ukuran tap ≥44px). Prioritas hari ini dihitung dengan aturan terbuka (deadline, prioritas, keterlambatan, jadwal rapat), lalu AI memberi satu kalimat saran. Aturan harus bisa dijelaskan: "Kenapa ini nomor 1?" → tampil alasannya.

---

## 20. Roadmap Development

Asumsi: ±11–15 jam/minggu efektif, dibantu coding assistant (jadwal 29 minggu = 330–430 jam). Pada 10 jam/minggu, realistisnya 33–43 minggu. Toleransi estimasi ±40%.

```
Minggu: 1  2 | 3  4 | 5 6 | 7 8 | 9 10 11 | 12 13 14 | 15 16 | 17 18 | 19 20 | 21–23 | 24–26 | 27–29
        P0    P1     P2     P3     P4         P5         P6      P7      P8      P9      P10     P11
                                                  ▲ MVP-A (mgg 14)           ▲ MVP-B (mgg 20)
```

| Phase | Nama | Durasi |
|---|---|---|
| 0 | Discovery, Kepatuhan & Spike | 2 mgg |
| 1 | Fondasi (auth, deploy, backup, audit) | 2 |
| 2 | Proyek, Catatan, Tugas | 2 |
| 3 | Meeting Capture (rekam/upload) | 2 |
| 4 | Transkripsi (Local Worker) | 3 |
| 5 | Meeting Intelligence & Review | 3 → **MVP-A** |
| 6 | Calendar (baca) & Dashboard | 2 |
| 7 | Knowledge Base & Pencarian | 2 |
| 8 | Tanya AI | 2 → **MVP-B** |
| 9 | Briefing, Review, Notifikasi, Calendar tulis | 3 |
| 10 | Google Drive & Gmail | 3 |
| 11 | Automasi lanjutan & Hardening akhir | 3 |

**Perubahan dari urutan awalmu & alasannya:**
- Phase 0 ditambah: spike teknis dan cek kepatuhan **sebelum** membangun.
- Meeting pipeline (STT + AI) dimajukan sebelum Calendar. Alasan: risiko terbesar dan nilai terbesar. Calendar itu mudah dan bisa ditunda.
- Backup, audit log, dan keamanan dasar masuk Phase 1, bukan di akhir. "Hardening di belakang" biasanya tidak pernah terjadi.
- Tanya AI setelah Search: chat tanpa data dan sumber hanya menghasilkan jawaban kosong/mengarang.
- Calendar tulis, briefing, dan notifikasi digabung di Phase 9 karena bergantung pada data yang sudah matang.

---

## 21. Phase-by-Phase Plan

### PHASE 0 — Discovery, Kepatuhan & Spike (2 minggu)

> v1.1: eksekusi Phase 0 dirinci di `phase0/RUNBOOK.md`, hasilnya di `PHASE0_REPORT.md`. Semua kode di `phase0/` bersifat sekali pakai dan tidak menjadi kode produksi.

- **Tujuan:** Memastikan ide boleh dan bisa dibangun, dan memilih teknologi dengan data, bukan perasaan.
- **Scope:** Tidak ada aplikasi. Hanya keputusan, eksperimen, dan data uji.
- **Fitur:** —
- **Komponen:** Dokumen keputusan (ADR), skrip eksperimen sekali pakai (dibuang setelahnya), golden set.
- **Deliverable:**
  1. Jawaban 5 pertanyaan kepatuhan (bagian 15.8) — tertulis.
  2. Keputusan kalender: Google, Outlook, atau keduanya.
  3. Laporan bake-off STT (3–5 rapat) dan LLM (5 transkrip).
  4. Uji embedding: 20 pertanyaan nyata.
  5. Daftar glosarium awal (≥100 istilah/nama).
  6. Uji rekam audio sistem Zoom di laptop dan rekam di HP.
  7. Daftar ADR final (stack, hosting, sensitivitas).
- **Testing:** Metrik bagian 10.5 dan 12.7.
- **Acceptance Criteria:** WER dan akurasi istilah memenuhi ambang atau ada rencana mitigasi; ≥80% action item terdeteksi dengan precision ≥75% pada 5 rapat uji; kepatuhan = "boleh", "boleh dengan syarat", atau "mode lokal".
- **Risiko:** Kepatuhan menolak → ubah arsitektur; laptop terlalu lambat → pakai model lebih kecil / STT cloud untuk rapat biasa.
- **Dependencies:** Akses ke rekaman nyata (dengan izin), info spesifikasi laptop, kontak IT/kepatuhan.
- **Definition of Done:** Semua deliverable tertulis, kamu menandatangani (setuju) ADR final. Tanpa ini, Phase 1 tidak dimulai.

### PHASE 1 — Fondasi (2 minggu)

- **Tujuan:** Kerangka aman yang bisa di-deploy dan dipulihkan sebelum fitur ditambah.
- **Scope:** Repo, CI, skema dasar, auth, deploy, backup, audit log, PWA shell.
- **Fitur:** Login passkey + TOTP, halaman kosong dengan navigasi (laptop+HP), install PWA, pengaturan dasar, ekspor/hapus data (versi dasar).
- **Komponen:** FastAPI skeleton, Postgres + migrasi, Docker Compose, Cloudflare Tunnel/Access, audit log, job queue, enkripsi rahasia, backup terjadwal, healthcheck.
- **Deliverable:** Aplikasi "kosong" yang online, aman, ter-backup, dengan satu job contoh berjalan.
- **Testing:** Tes auth (tanpa login = ditolak), tes backup + **restore ke mesin bersih**, scan rahasia di repo, tes install PWA di Android.
- **Acceptance Criteria:** Hanya kamu yang bisa masuk; restore berhasil <1 jam; audit log mencatat login; tidak ada port terbuka selain yang direncanakan.
- **Risiko:** Konfigurasi WebAuthn/Access memakan waktu; mitigasi: TOTP sebagai cadangan.
- **Dependencies:** Phase 0; VPS; domain; akun Cloudflare.
- **DoD:** Deploy dari nol dengan satu perintah terdokumentasi; restore teruji; checklist keamanan dasar hijau.

### PHASE 2 — Proyek, Catatan, Tugas (2 minggu)

- **Tujuan:** Bagian aplikasi yang sudah berguna sebagai pencatat pribadi.
- **Scope:** CRUD proyek/catatan/tugas/orang/tag. Tanpa AI dulu.
- **Fitur:** Proyek (overview, timeline dasar), catatan harian (ketik/tempel), tugas (status 5 level, prioritas, deadline, PIC, proyek), orang, tag, glosarium, dashboard minimal.
- **Komponen:** Modul domain, UI daftar/detail/form, pencarian kata kunci sederhana.
- **Deliverable:** Bisa dipakai harian untuk task dan catatan.
- **Testing:** Unit + integrasi API; tes responsif HP; tes anti-duplikat task (fingerprint).
- **Acceptance Criteria:** Buat–ubah–selesai task <15 detik di HP; data bertahan setelah restart; semua perubahan tercatat di audit.
- **Risiko:** Terlalu mempercantik UI; batasi ke fungsional.
- **Dependencies:** Phase 1.
- **DoD:** Kamu memakainya 1 minggu untuk pekerjaan nyata dan daftar keluhan dicatat.

### PHASE 3 — Meeting Capture (2 minggu)

- **Tujuan:** Mendapatkan rekaman andal ke sistem.
- **Scope:** Rekam di browser, upload file, sesi rapat. Belum transkripsi.
- **Fitur:** "Mulai Rapat" → sesi → rekam (timer, level suara, pause) → catatan manual ber-timestamp → "Selesai Meeting"; upload audio/video/transkrip; label sensitivitas; pengingat persetujuan merekam.
- **Komponen:** MediaRecorder + audio sistem (`getDisplayMedia`), chunk ke IndexedDB, upload bertahap dan dapat dilanjutkan, penyimpanan terenkripsi, state machine rapat.
- **Deliverable:** Rekaman 2 jam dari Zoom (2 track) dan dari HP tersimpan utuh.
- **Testing:** Tes ketahanan: matikan Wi-Fi saat merekam, tutup tab paksa, baterai rendah, layar HP mati, 2 jam non-stop; cek file utuh dan bisa diputar.
- **Acceptance Criteria:** Kehilangan data maksimum 30 detik pada skenario gagal; upload lanjut otomatis; peringatan jika audio senyap >30 detik.
- **Risiko:** Perekaman latar belakang di Android tidak andal; audio sistem hanya jalan di Chrome/Edge Windows. Mitigasi: panduan, cadangan OBS/perekam bawaan + upload.
- **Dependencies:** Phase 1–2.
- **DoD:** 10 rekaman nyata berturut-turut tanpa kegagalan fatal.

### PHASE 4 — Transkripsi (3 minggu)

- **Tujuan:** Audio jadi teks yang cukup akurat dan bisa dikoreksi.
- **Scope:** Local Worker, VAD, Whisper, glosarium, normalisasi angka/tanggal, label pembicara.
- **Fitur:** Status progres, transkrip dengan timestamp, klik kata → putar audio, edit transkrip, pemetaan pembicara, mode STT cloud opsional (untuk rapat "Biasa").
- **Komponen:** Local Worker (Windows, penerima job, enkripsi transport), `Transcriber` interface, number/date parser (aturan), glossary corrector, antrean job + retry.
- **Deliverable:** Upload/rekam → transkrip bersih tampil di UI.
- **Testing:** Golden set (WER, istilah, angka); uji worker mati/hidup; file rusak; audio 3 jam; bahasa campuran.
- **Acceptance Criteria:** Metrik Phase 0 terpenuhi di rekaman baru; "495 miliar" benar atau ditandai; worker mati → job menunggu tanpa hilang; kegagalan → `TRANSCRIPTION_FAILED` dengan tombol coba lagi.
- **Risiko:** Laptop lambat; Windows kantor memblokir instalasi worker; halusinasi Whisper. Mitigasi: VAD, model lebih kecil, STT cloud untuk rapat biasa, opsi jalankan worker di VPS (tanpa GPU, lambat).
- **Dependencies:** Phase 0 (model), Phase 3.
- **DoD:** 5 rapat nyata ditranskripsi dengan hasil yang kamu nilai "layak dikoreksi, bukan ditulis ulang".

### PHASE 5 — Meeting Intelligence & Review (3 minggu) → **MVP-A**

- **Tujuan:** Mengubah transkrip jadi notulen, keputusan, dan task yang kamu setujui.
- **Scope:** Pipeline P1–P7, layar Review, Approve → task.
- **Fitur:** Notulen format baku (judul, tanggal, peserta, ringkasan eksekutif, pokok bahasan, keputusan, tabel tindak lanjut, isu terbuka, risiko, agenda berikutnya, catatan penting), flag (`UNKNOWN_PIC`, `UNKNOWN_DEADLINE`, `NEEDS_REVIEW`), edit inline, Approve/Reject, ekspor notulen (Markdown/Docx/PDF).
- **Komponen:** LLM Gateway, prompt versi, validator bukti, Approval Gate, pembuatan task transaksional, deteksi duplikat.
- **Deliverable:** Dari rapat nyata ke task dalam ≤10 menit review.
- **Testing:** Evaluasi pada golden set (precision/recall action item, kebenaran PIC/deadline); tes "tidak mengarang" (rapat tanpa keputusan → daftar keputusan kosong); tes injeksi dalam transkrip; tes LLM gagal; tes duplikat.
- **Acceptance Criteria:** Recall action item ≥85%, precision ≥80%; 0 item tanpa bukti; PIC/deadline tidak jelas **selalu** berflag; tidak ada task yang terbentuk sebelum Approve.
- **Risiko:** Halusinasi; ringkasan terlalu umum; biaya token. Mitigasi: bukti wajib, multi-pass, batas biaya.
- **Dependencies:** Phase 4, keputusan LLM Phase 0.
- **DoD:** Kamu memakai MVP-A di ≥5 rapat nyata; rata-rata review ≤10 menit; daftar perbaikan prompt dicatat.

### PHASE 6 — Calendar (baca) & Dashboard (2 minggu)

- **Tujuan:** Agenda masuk ke konteks, dan dashboard utuh.
- **Scope:** Baca-saja Google Calendar (atau Outlook sesuai Phase 0), tautkan event dengan rapat.
- **Fitur:** Agenda hari ini/besok/minggu ini; rapat otomatis terisi peserta dari undangan; dashboard lengkap.
- **Komponen:** `CalendarProvider`, OAuth scope minimum, sinkron berkala + webhook/incremental sync, cache.
- **Deliverable:** Dashboard Command Center.
- **Testing:** Sinkron gagal, token kedaluwarsa, event berulang, zona waktu, undangan dibatalkan.
- **Acceptance Criteria:** Agenda akurat sama dengan kalender asli; sinkron gagal menampilkan `SYNC_FAILED` dan data terakhir yang valid dengan cap waktu, tidak menampilkan data kosong yang menyesatkan.
- **Risiko:** Token OAuth testing 7 hari; kalender kantor bukan Google.
- **Dependencies:** Phase 2, keputusan kalender.
- **DoD:** Tujuh hari berturut-turut sinkron tanpa intervensi.

### PHASE 7 — Knowledge Base & Pencarian (2 minggu)

- **Tujuan:** Semua data bisa ditemukan dengan bahasa natural.
- **Scope:** Chunking, embedding, hybrid search, relasi.
- **Fitur:** Kotak cari global, filter (proyek, tanggal, orang), hasil dengan sumber, halaman proyek lengkap + timeline, tautan antar entitas.
- **Komponen:** Indexer (job), pgvector, FTS, `entity_links`, query parser tanggal/proyek.
- **Deliverable:** Pencarian di seluruh data.
- **Testing:** Golden set 30–50 pertanyaan; ukur hit rate@5; uji "terakhir", "tanggal 5 Oktober".
- **Acceptance Criteria:** Hit rate@5 ≥85%; hasil selalu membawa sumber yang bisa dibuka; hapus data → hilang juga dari indeks.
- **Risiko:** Kualitas embedding Indonesia; chunk buruk. Mitigasi: hybrid, evaluasi.
- **Dependencies:** Phase 2, 5.
- **DoD:** Kamu menguji 20 pertanyaan sendiri dan ≥17 mengembalikan sumber benar.

### PHASE 8 — Tanya AI (2 minggu) → **MVP-B**

- **Tujuan:** Satu pintu tanya untuk semua data.
- **Scope:** Chat baca-saja dengan tool dan sitasi.
- **Fitur:** Chat, sumber di tiap jawaban, "Tidak ditemukan" yang jujur, saran tindak lanjut sebagai usulan, riwayat percakapan, Jejak AI.
- **Komponen:** Router tool (SQL vs RAG), validator sitasi, `propose_action`.
- **Deliverable:** Contoh pertanyaan di spesifikasi kamu terjawab dengan benar.
- **Testing:** Golden set; pertanyaan jebakan (data tidak ada); injeksi lewat catatan; pertanyaan ambigu → AI bertanya balik.
- **Acceptance Criteria:** 0 jawaban tanpa sumber; ≥90% jawaban benar di golden set; pertanyaan di luar data → "tidak ditemukan".
- **Risiko:** Jawaban meyakinkan tapi salah; biaya chat.
- **Dependencies:** Phase 6, 7.
- **DoD:** Pemakaian harian 2 minggu; log "jawaban salah" ≤ batas yang kamu tetapkan.

### PHASE 9 — Briefing, Review, Notifikasi, Calendar Tulis (3 minggu)

- **Tujuan:** Dari asisten pasif jadi sekretaris proaktif, tetap terkendali.
- **Scope:** Briefing otomatis, notifikasi, tulis ke kalender lewat Approval Gate, catatan suara.
- **Fitur:** Morning briefing, evening review, weekly review, briefing rapat, reminder task, buat/ubah/hapus agenda (konfirmasi), cari waktu kosong, catatan lewat suara.
- **Komponen:** Scheduler, Web Push, generator briefing (template + data SQL, LLM hanya untuk narasi pendek), kartu konfirmasi.
- **Deliverable:** Briefing masuk tiap pagi tepat waktu.
- **Testing:** Notifikasi tepat waktu di Android; zona waktu; aksi kalender idempotent; konfirmasi kedaluwarsa; dua perangkat.
- **Acceptance Criteria:** Briefing dibuat bahkan saat LLM gagal (versi tanpa narasi); tidak ada perubahan kalender tanpa konfirmasi; tidak ada duplikat agenda.
- **Risiko:** Notifikasi mobile tidak andal; briefing terlalu panjang.
- **Dependencies:** Phase 6, 8.
- **DoD:** 2 minggu briefing berjalan; kamu menilai ≥80% berguna.

### PHASE 10 — Google Drive & Gmail (3 minggu)

- **Tujuan:** Dokumen dan email masuk ke konteks, tanpa mengirim/mengubah apa pun.
- **Scope:** Drive metadata + cuplikan; Gmail baca + draft saja.
- **Fitur:** Cari dokumen berdasarkan konteks rapat/proyek; tautkan dokumen–rapat–proyek; cari email; tandai email penting; follow-up; draft balasan (disimpan sebagai draft Gmail).
- **Komponen:** Konektor dengan scope minimum, pemrosesan isi email sebagai data tidak tepercaya, deteksi follow-up.
- **Deliverable:** "Cari file proyeksi cashflow terakhir" dan "buatkan draft balasan" berfungsi.
- **Testing:** Uji injeksi lewat email; uji bahwa **tidak ada** jalur kirim; uji izin dicabut; uji dokumen besar.
- **Acceptance Criteria:** Tidak ada scope kirim/tulis Drive; draft muncul di Gmail Drafts, bukan terkirim; konten email tidak pernah memicu aksi.
- **Risiko:** Verifikasi Google untuk scope sensitif; kebocoran lewat isi email.
- **Dependencies:** Phase 8.
- **DoD:** Review keamanan khusus integrasi lulus.

### PHASE 11 — Automasi Lanjutan & Hardening Akhir (3 minggu)

- **Tujuan:** Stabil untuk jangka panjang.
- **Scope:** Perbaikan kualitas, ketahanan, dan keamanan.
- **Fitur:** Deteksi duplikat lebih baik, saran tautan otomatis (tetap perlu konfirmasi), template rapat, redaksi data sensitif opsional sebelum ke LLM, pemeriksaan retensi otomatis, dashboard biaya AI.
- **Komponen:** Job pemeliharaan, uji beban, audit keamanan, dokumentasi operasional.
- **Deliverable:** Runbook, laporan keamanan, laporan biaya.
- **Testing:** Uji restore terjadwal, uji kegagalan (chaos sederhana), pemindaian dependensi, tinjauan izin, uji penghapusan menyeluruh.
- **Acceptance Criteria:** Semua skenario kegagalan bagian 27 teruji; restore <1 jam; rotasi kunci terdokumentasi.
- **Risiko:** Scope creep.
- **Dependencies:** Phase 1–10.
- **DoD:** Checklist produksi hijau.

---

## 22. Testing Strategy

| Lapisan | Isi | Alat (contoh) |
|---|---|---|
| Unit | Parser angka/tanggal, glossary, validator bukti, fingerprint, state machine | pytest |
| Integrasi | API + Postgres + antrean, mock Google | pytest + testcontainers |
| Kontrak | Output LLM sesuai skema; skema Google API | Pydantic, rekaman respons |
| **Evaluasi AI** | Golden set transkrip → ekstraksi; golden set tanya-jawab → sumber | skrip evaluasi sendiri, dijalankan tiap ubah prompt/model |
| E2E | Alur penting di browser (rekam→review→task) | Playwright |
| Perangkat nyata | Android + Windows (rekam 2 jam, layar mati, bateri lemah) | Manual terjadwal |
| Kegagalan | Putus internet, worker mati, LLM timeout, file rusak, token kedaluwarsa | Fault injection manual |
| Keamanan | Otorisasi, injeksi prompt, enkripsi, scan dependensi, scan rahasia | Dependabot/pip-audit, gitleaks, uji manual |
| Pemulihan | Restore backup ke mesin bersih | Latihan terjadwal tiap kuartal |
| UAT | Pemakaian nyata 2 minggu per rilis (MVP-A, MVP-B) | Log keluhan |

**Aturan:** perubahan prompt/model tidak boleh masuk tanpa evaluasi golden set tidak turun. Data uji memakai rekaman nyata yang dianonimkan atau data sintetis; jangan menaruh rapat rahasia di repository.

---

## 23. Risks

| # | Risiko | Peluang | Dampak | Mitigasi |
|---|---|---|---|---|
| R1 | Kebijakan perusahaan melarang rekam/AI cloud | Sedang | **Sangat tinggi** | Phase 0 wajib; Mode Pribadi/Lokal |
| R2 | Kalender kantor Outlook, bukan Google | Tinggi | Tinggi | Tentukan di Phase 0; `CalendarProvider` |
| R3 | Akurasi STT kurang pada audio buruk/ruang rapat | Tinggi | Sedang | Mikrofon baik, 2 track, koreksi, bake-off |
| R4 | Halusinasi AI (PIC/deadline/keputusan salah) | Sedang | Tinggi | Bukti wajib, validator, flag, review, golden set |
| R5 | Rekaman web di Android terputus | Tinggi | Sedang | Chunk, Wake Lock, cadangan perekam bawaan |
| R6 | Laptop terlalu lambat untuk Whisper besar | Sedang | Sedang | Model turbo/medium, antrean latar, STT cloud untuk rapat biasa |
| R7 | Kebocoran data (VPS, token, backup) | Rendah–sedang | **Sangat tinggi** | Tanpa port terbuka, Access, enkripsi, scope minimum, audit |
| R8 | Prompt injection via email/dokumen/transkrip | Sedang | Tinggi | Data tak tepercaya, tanpa tool tulis eksternal, tanpa scope kirim |
| R9 | Scope creep, proyek tak selesai | **Tinggi** | Tinggi | Dua rilis MVP, gerbang per phase, non-goals tegas |
| R10 | Beban rawat (satu orang, banyak komponen) | Sedang | Sedang | Monolith, tanpa Redis/K8s, runbook |
| R11 | Biaya AI membengkak | Rendah | Rendah–sedang | Batas harian, cache, model kecil untuk tugas ringan |
| R12 | Token OAuth Google kedaluwarsa / verifikasi scope | Sedang | Sedang | Uji dini Phase 6, notifikasi `SYNC_FAILED` |
| R13 | Kehilangan data (VPS rusak) | Rendah | Tinggi | 3-2-1 backup, latihan restore |
| R14 | Ketergantungan vendor LLM/harga berubah | Sedang | Rendah | Gateway abstrak, model lokal cadangan |
| R15 | Pelanggaran privasi pihak lain (peserta rapat tak tahu direkam) | Sedang | Tinggi | Pengingat persetujuan, kebijakan retensi, akses ketat |
| R16 | Kelelahan: dibangun sambil kerja penuh | Tinggi | Tinggi | Target kecil mingguan, MVP-A cepat berguna agar ada motivasi |

---

## 24. Cost Estimate (biaya membangun)

### 24.1 Waktu

| Komponen | Jam (indikatif) |
|---|---|
| Phase 0–2 | 60–80 |
| Phase 3–5 (inti MVP-A) | 100–130 |
| Phase 6–8 (MVP-B) | 70–90 |
| Phase 9–11 | 100–130 |
| **Total** | **±330–430 jam** (±29 minggu pada ±11–15 jam/minggu; ±33–43 minggu pada 10 jam/minggu) |

MVP-A saja ±160–210 jam.

### 24.2 Uang (bila dikerjakan sendiri dengan bantuan AI)

| Item | Perkiraan |
|---|---|
| Domain | Rp150–250 rb/tahun |
| Cloudflare (Tunnel/Access) | Gratis |
| GitHub, Sentry, healthchecks (free tier) | Gratis |
| Google Cloud project (Calendar/Drive/Gmail API) | Gratis |
| API LLM saat pengembangan + evaluasi | US$30–100 total (±Rp0,5–1,6 jt) |
| Biaya alat coding AI | Sesuai langganan yang kamu pakai |
| Mikrofon konferensi/lavalier (jika belum ada) | Rp300 rb–1,5 jt — **ini investasi kualitas STT paling efektif** |
| **Total uang tunai awal** | **±Rp1–3 juta** |

Bila dikerjakan freelancer: indikatifnya puluhan hingga ratusan juta rupiah tergantung kualitas. Itu tidak direkomendasikan di tahap ini karena kamu paling paham alur kerjamu, dan rencana ini modular sehingga bisa dibagi nanti.

---

## 25. Operating Cost Estimate (biaya bulanan)

Asumsi: 40 jam rapat/bulan, 300 pertanyaan chat/bulan, 1 pengguna. Kurs ±Rp16.500/US$ (cek ulang).

| Item | Perkiraan/bulan |
|---|---|
| VPS 4 vCPU / 8 GB RAM (Indonesia/Singapura/EU) | Rp150–450 rb |
| Backup storage (R2/B2, <50 GB) | Rp10–30 rb |
| LLM API: analisis rapat (±US$0,10–0,40 per jam rapat) | Rp70–260 rb |
| LLM API: chat, briefing, catatan | Rp50–150 rb |
| STT cloud (hanya jika dipakai untuk rapat "Biasa") | Rp0–150 rb |
| Embedding (lokal) | Rp0 |
| Domain (dirata-rata) | Rp15–20 rb |
| **Total** | **±Rp300 rb – 1,1 jt / bulan** |

Kontrol biaya: batas harian di LLM Gateway, dashboard biaya (Phase 11), model kecil untuk tugas ringan, cache hasil analisis. Biaya terbesar yang tersembunyi bukan uang, tapi **waktu perawatan** (target ≤1 jam/bulan; runbook membantu).

---

## 26. Deployment Recommendation

**Arsitektur deployment:**

```
Internet ─► Cloudflare (Access + Tunnel) ─► VPS
                                            ├─ docker: api, worker, postgres(+pgvector), caddy/nginx
                                            ├─ volume terenkripsi (audio temp)
                                            └─ cron backup → R2/B2 (terenkripsi)

Laptop Windows ─► Local Worker (service/tray) ── HTTPS keluar ──► api (tidak ada port masuk)
```

- **Satu VPS, Docker Compose.** Tanpa Kubernetes.
- Local Worker **hanya membuat koneksi keluar** (polling job), jadi laptop tidak perlu membuka port.
- Lingkungan: `dev` (laptop) dan `prod` (VPS). Staging tidak perlu untuk satu pengguna; gunakan data uji terpisah.
- Rilis: GitHub Actions → build image → deploy manual satu perintah; migrasi database ber-versi; rollback = kembali ke image sebelumnya + restore bila perlu.
- Update OS dan dependensi: otomatis keamanan, mingguan non-keamanan.
- Tunnel dipilih agar tidak ada port web terbuka. Jika Cloudflare tidak boleh dipakai: Tailscale atau Caddy + mTLS.

---

## 27. Backup & Recovery Plan

| Aspek | Rencana |
|---|---|
| Yang dibackup | Database lengkap, konfigurasi, kunci (terpisah), glosarium. **Audio tidak dibackup** (sementara) |
| Frekuensi | Harian (pg_dump terenkripsi), plus snapshot VPS mingguan dari penyedia |
| Lokasi (3-2-1) | 1) VPS 2) bucket eksternal R2/B2 3) salinan mingguan di drive eksternal/laptop |
| Enkripsi | Dienkripsi sebelum keluar server; kunci disimpan di password manager + salinan tercetak/offline |
| Retensi backup | 30 harian + 12 mingguan |
| RPO | ≤24 jam |
| RTO | ≤4 jam |
| Latihan | Restore ke mesin bersih tiap kuartal, dicatat |
| Kegagalan backup | `healthchecks.io` memberi tahu bila backup harian tidak jalan |
| Penghapusan | Backup lama bergulir habis ≤30 hari; dinyatakan di UI privasi |

### Penanganan kegagalan sistem

Prinsip: **gagal dengan jelas, bukan diam-diam, dan tidak pernah mengarang.**

| Kejadian | Deteksi | Perilaku | Status | Yang pengguna lihat |
|---|---|---|---|---|
| Internet mati saat rekam | Gagal unggah | Terus rekam lokal, antre, lanjut otomatis | `UPLOAD_PENDING` | "Tersimpan di perangkat, akan diunggah" |
| Rekaman terputus | Celah chunk / tab ditutup | Pulihkan chunk, tandai celah | `RECORDING_GAP` | "Ada celah 12:40–13:10" + opsi lanjut |
| Transkripsi gagal | Error worker/Whisper | Retry 2× lalu berhenti, audio dipertahankan | `TRANSCRIPTION_FAILED` | Tombol "Coba lagi / pakai mesin lain" |
| Local Worker mati | Heartbeat hilang | Job menunggu, tidak hilang | `WAITING_FOR_WORKER` | "Menunggu laptop aktif" |
| AI gagal / timeout | Error / skema tidak valid | Retry, lalu tampilkan transkrip + notulen kosong | `ANALYSIS_FAILED` | Transkrip tetap bisa dipakai; tombol coba lagi |
| Kalender gagal sinkron | Error API/token | Tampilkan data terakhir + cap waktu, jangan kosong | `SYNC_FAILED` | "Terakhir sinkron 07.30" + tombol hubungkan ulang |
| File rusak / format asing | Validasi ffprobe | Tolak dengan alasan; file asli dikarantina | `FILE_INVALID` | Pesan jelas + saran konversi |
| Task duplikat | Fingerprint + kemiripan | Tampilkan kandidat duplikat; **jangan buat otomatis** | `NEEDS_REVIEW` | "Mirip dengan task X. Gabung / tetap buat?" |
| Rapat duplikat | Event kalender sama / audio sama | Tawarkan gabung | `NEEDS_REVIEW` | Dialog gabung |
| Deadline tidak jelas | Parser/LLM ragu | Kosong + usulan | `UNKNOWN_DEADLINE` | Lencana, tidak ada reminder dibuat |
| PIC tidak jelas | Tidak ada/ganda | Kosong + kandidat | `UNKNOWN_PIC` | Lencana + pilih |
| Bukti tidak ditemukan | Validator | Item dibuang/diberi flag | `NEEDS_REVIEW` | "Tidak ada kutipan pendukung" |
| Angka ambigu | Parser | Teks asli dipertahankan | `NEEDS_REVIEW` | Angka disorot |
| Konfirmasi kedaluwarsa | 24 jam | Dibatalkan, tidak dieksekusi | `EXPIRED` | Riwayat |
| Eksekusi aksi gagal | Error API | Tidak diulang membabi buta; idempotency key | `FAILED` | Tombol coba lagi |
| Biaya AI melewati batas | Gateway | Hentikan fitur AI non-esensial | `BUDGET_LIMIT` | Pemberitahuan |
| Disk hampir penuh | Monitor | Hentikan rekam baru, peringatkan | `STORAGE_LOW` | Peringatan |

---

## 28. Definition of Done MVP

**MVP-A selesai jika:**

- [ ] Hanya kamu yang bisa masuk (passkey + 2FA), tidak ada port publik terbuka.
- [ ] Rekam rapat dari laptop (Zoom, 2 track) dan HP; atau upload, tanpa kehilangan data pada 10 rekaman berturut-turut.
- [ ] Transkripsi lokal Bahasa Indonesia + Inggris memenuhi metrik Phase 0 pada rekaman baru.
- [ ] Notulen terstruktur sesuai format yang kamu tetapkan.
- [ ] Keputusan dan action item **selalu punya bukti**; yang ragu berflag.
- [ ] Task hanya terbentuk setelah Approve.
- [ ] Catatan, proyek, tugas berfungsi.
- [ ] Audio terhapus sesuai kebijakan; hapus-data berfungsi sampai indeks.
- [ ] Backup harian berjalan dan **restore teruji**.
- [ ] Dipakai di ≥5 rapat nyata, rata-rata review ≤10 menit.

**MVP-B selesai jika, tambahan:**

- [ ] Agenda tersinkron (baca) dan terhubung dengan rapat.
- [ ] Pencarian hybrid: hit rate@5 ≥85% di golden set.
- [ ] Tanya AI: 0 jawaban tanpa sumber; ≥90% benar di golden set.
- [ ] Dashboard Command Center lengkap, nyaman di laptop dan HP.
- [ ] Skenario kegagalan inti (bagian 27) teruji.
- [ ] Dipakai 2 minggu penuh dan kamu masih membukanya tanpa dipaksa.

---

## 29. Future Improvements

- **Outlook/Microsoft 365** (bila kantor memakainya, bisa naik ke Phase 6).
- Bot Telegram: catat cepat, tanya cepat, terima briefing.
- Briefing rapat otomatis dari email + dokumen + rapat sebelumnya.
- Template rapat khas finance: cashflow review, covenant tracking, komite investasi.
- Pelacakan keputusan: "keputusan ini sudah ditindaklanjuti belum?"
- Deteksi konflik/kontradiksi antar rapat ("angka berbeda dari rapat 2 Okt").
- Tampilan graf relasi proyek–rapat–keputusan.
- LLM lokal yang lebih kuat bila laptop/GPU memungkinkan.
- Redaksi otomatis nama/angka sebelum ke LLM cloud.
- Ekspor ke Excel/PowerPoint untuk laporan manajemen.
- Offline mode lebih lengkap.

**Peluang penghasilan tambahan (tantangan jujur).** Sistem ini bisa menjadi (1) studi kasus portofolio "AI workflow untuk profesional finance", (2) dasar jasa konsultasi setup asisten kerja untuk profesional, atau (3) template/produk. Namun: kode dan data yang menyentuh pekerjaan kantor, serta aturan IP di kontrak kerjamu, bisa membatasi. Ide yang lebih aman: kembangkan **versi generik** tanpa data kantor, dan pastikan tidak ada konflik kepentingan. Pasar "AI notulen" sudah ramai (banyak tool siap pakai); keunggulanmu bukan di notulennya, melainkan di **alur kerja finance + Bahasa Indonesia + privasi**. Uji dulu apakah ada orang yang mau membayar sebelum membuat versi produk.

---

## 30. Recommended Next Action

### Keputusan yang saya butuhkan dari kamu (urut prioritas)

| # | Pertanyaan | Default yang saya asumsikan bila tidak dijawab |
|---|---|---|
| 1 | Kebijakan kantor soal merekam rapat, menyimpan data kerja di luar sistem kantor, dan mengirim transkrip ke API AI? | **Belum diketahui. Pastikan dulu**, ini penentu terbesar |
| 2 | Kalender kerja kamu Google atau Outlook/M365? | Dianggap Google; jika Outlook, rencana Phase 6 berubah |
| 3 | Spesifikasi laptop (RAM, CPU, ada GPU NVIDIA?) dan merek/versi HP Android | Tanpa GPU, 16 GB RAM |
| 4 | Berapa jam rapat per minggu, berapa persen online vs offline? | 10 jam/minggu, 70% online |
| 5 | Waktu yang realistis per minggu untuk proyek ini? | 10 jam (jadwal di §20 mengasumsikan 11–15 jam) |
| 6 | Batas biaya bulanan yang nyaman? | ≤Rp1 juta |
| 7 | Boleh pakai LLM cloud untuk transkrip rapat berlabel "Sensitif"? | Ya, jika #1 mengizinkan |
| 8 | Setuju dengan dua rilis MVP (A lalu B)? | Ya |
| 9 | Preferensi lokasi hosting (Indonesia/Singapura/EU)? | Indonesia atau Singapura |
| 10 | Kamu punya 3–5 rekaman rapat (dengan izin) untuk uji? | Perlu disiapkan di Phase 0 |

### Langkah setelah kamu menyetujui

1. Jawab pertanyaan di atas (terutama #1 dan #2).
2. Koreksi rencana ini: apa yang terlalu besar, kurang, atau salah.
3. Kamu bilang "mulai Phase 0". Phase 0 **tidak** membuat aplikasi. Isinya cek kepatuhan, kumpulkan rekaman uji, bake-off STT/LLM/embedding, dan finalisasi ADR.
4. Phase 1 baru dimulai setelah DoD Phase 0 terpenuhi dan kamu menyetujui.

### Gerbang keputusan (go / no-go)

- Akhir Phase 0: kepatuhan oke + akurasi cukup → lanjut. Jika tidak → ubah ke mode lokal / kecilkan ruang lingkup.
- Akhir Phase 5 (MVP-A): apakah kamu benar-benar memakainya? Jika tidak, **berhenti dan perbaiki sebelum menambah fitur**.
- Akhir Phase 8 (MVP-B): putuskan apakah Phase 9–11 layak dilanjutkan atau cukup.

---

## Changelog v1.1 — 8 Okt 2026 (approval sebagai BASELINE DESIGN + review konsistensi)

Pemilik menyetujui dokumen ini sebagai baseline, dengan Phase 0 sebagai satu-satunya pekerjaan yang diizinkan. Perubahan dari v1.0:

| # | Perubahan | Alasan |
|---|---|---|
| 1 | Status dokumen: draft → baseline v1.1 | Approval pemilik |
| 2 | §5.1 "15 modul" → "14 modul" | Salah hitung: daftar MVP awal berisi 14 item |
| 3 | §9.1, §9.1 "trik dua track", §10.2, §10.3: klaim "tanpa OBS", "Chrome/Edge mendukung", "jauh lebih andal", "(andal)" diubah menjadi **hipotesis belum terbukti** | Klaim itu belum pernah diuji. Speaker laptop membuat suara peserta bocor ke mic dan merusak pemisahan |
| 4 | Label pembicara: mic = USER (diberi nama), sistem = PARTICIPANT / "Unknown Participant" / "Speaker N". Peserta lain tidak diberi nama tanpa diarization atau konfirmasi pengguna | Pemilik: jangan mengklaim bisa mengenali peserta |
| 5 | §14.1 langkah 2 + §8.1 + §15.1: ditambah **Audio Route** (LOCAL_ONLY vs SERVER_TEMP) | Inkonsistensi: §11.2 menyebut "Sensitif = audio lokal", sedangkan §14.1 mengunggah semua audio ke server |
| 6 | §20 dan §24.1: jadwal 29 minggu ternyata mengasumsikan ±11–15 jam/minggu, bukan 10–12. Pada 10 jam/minggu: 33–43 minggu; MVP-A minggu 16–21 | Aritmetika: 330–430 jam ÷ 10–12 jam/minggu ≠ 29 minggu |
| 7 | §15.5: ditambah padanan Microsoft Graph | Kalender kantor mungkin M365 |
| 8 | §21 Phase 0: ditambah penunjuk ke RUNBOOK dan REPORT | |

Keputusan terbuka yang dicatat:

| ID | Keputusan | Status |
|---|---|---|
| D-01 | Kebijakan kantor soal rekam, simpan, STT, LLM cloud (Policy Checklist) | UNKNOWN — butuh konfirmasi pemilik |
| D-02 | Kalender utama: Google / Outlook / keduanya | UNKNOWN |
| D-03 | Recorder PRIMARY (browser vs lokal) | Menunggu hasil uji di laptop; rekomendasi sementara di `PHASE0_REPORT.md` §9 |
| D-04 | Rekaman HP berlabel Sensitif boleh lewat server sementara? | UNKNOWN (bergantung D-01) |
| D-05 | Cakupan final MVP-A | Usulan di `PHASE0_REPORT.md` §19; menunggu approval |

Bagian yang **sengaja tidak diubah** karena konsisten dengan arahan pemilik: pemisahan raw/clean transcript (§10.4, §13), AI hanya mengusulkan (§16), tanpa scope kirim email (§15.5), sumber wajib pada jawaban (§12.4), dan peta fase.

---

**STOP FOR REVIEW.**
Belum ada kode produksi, instalasi, database, atau deployment. Yang ada hanya dokumen dan alat uji sekali pakai untuk Phase 0.
