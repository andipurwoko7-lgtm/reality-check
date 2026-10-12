#!/usr/bin/env python3
"""DISPOSABLE Phase 0 / STEP D: transkripsi pertama (model small, CPU, int8) + evaluasi terhadap ground truth.
BUKAN kode produksi. Dijalankan di venv Step C; TIDAK memasang apa pun; TIDAK memakai jaringan (local_files_only).

Satu file audio -> satu konfigurasi (language=id, beam=5, VAD aktif, tanpa prompt) -> satu evaluasi.
Perbandingan model/prompt/bahasa-auto = Step F, bukan di sini.

Keluaran di --out-dir:
  raw_transcript.txt      teks mentah Whisper (tidak diubah; dikunci read-only, SHA-256 dicatat)
  raw_segments.json       segmen + timestamp + avg_logprob/no_speech_prob/compression_ratio
  step_d_results.json     status D1-D5, metrik, fakta angka terdeteksi, segmen yang perlu dicek
  evaluation_summary.txt  ringkasan terbaca manusia (metrik, istilah/angka yang salah, selisih kata)
"""
import argparse, collections, difflib, hashlib, json, os, re, stat, sys, time, traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import eval_transcript as ev          # noqa: E402
from idnum import extract_facts, display   # noqa: E402

# Ambang Phase 0 dari RENCANA §10.5 (tidak diubah): WER 15-20% (dipakai batas atas), istilah >= 90%, angka >= 95%
THR = {"wer_numnorm": 0.20, "terms": 0.90, "numbers": 0.95}


def peak_ram_mb():
    try:
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes

            class PMC(ctypes.Structure):
                _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                            ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                            ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                            ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t),
                            ("PeakPagefileUsage", ctypes.c_size_t)]
            k32, ps = ctypes.windll.kernel32, ctypes.windll.psapi
            k32.GetCurrentProcess.restype = wintypes.HANDLE
            ps.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PMC), wintypes.DWORD]
            ps.GetProcessMemoryInfo.restype = wintypes.BOOL
            pmc = PMC(); pmc.cb = ctypes.sizeof(PMC)
            if ps.GetProcessMemoryInfo(k32.GetCurrentProcess(), ctypes.byref(pmc), pmc.cb):
                return round(pmc.PeakWorkingSetSize / 2**20, 1)
            return None
        import resource
        return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
    except Exception:
        return None


def sha256_text(t):
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


def tb(limit=3500):
    return traceback.format_exc()[-limit:]


class _Seg:  # dipakai hanya oleh mesin palsu untuk uji alat
    def __init__(self, i, text):
        self.start, self.end, self.text, self.avg_logprob, self.no_speech_prob, self.compression_ratio = float(i * 5), float(i * 5 + 4), text, -0.3, 0.01, 1.2


def transcribe_real(a, audio):
    from faster_whisper import WhisperModel
    t0 = time.time()
    model = WhisperModel(a.model_dir, device="cpu", compute_type="int8", local_files_only=True)
    load_s = time.time() - t0
    t1 = time.time()
    segs, info = model.transcribe(audio, language="id", beam_size=5, vad_filter=True, condition_on_previous_text=False)
    segs = list(segs)                      # generator: kerja inferensi terjadi di sini
    return segs, info.language, float(info.language_probability), load_s, time.time() - t1


def transcribe_fake(path):             # HANYA untuk menguji alat tanpa model (variabel STEPD_FAKE_ENGINE)
    lines = [l.strip() for l in open(path, encoding="utf-8") if l.strip()]
    return [_Seg(i, l) for i, l in enumerate(lines)], "id", 0.99, 0.0, 0.01


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True); ap.add_argument("--model-dir", required=True); ap.add_argument("--out-dir", required=True)
    ap.add_argument("--truth", required=True); ap.add_argument("--facts", required=True); ap.add_argument("--terms", required=True)
    ap.add_argument("--notes", default="")
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    res = {"step": "D - first transcription", "audio_file": os.path.basename(a.audio), "model": "small", "device": "cpu", "compute_type": "int8",
           "config": {"language": "id (dipaksa)", "beam_size": 5, "vad_filter": True, "initial_prompt": None, "condition_on_previous_text": False},
           "user_notes": a.notes or None, "stages": {}, "status": "FAIL"}
    out = lambda: json.dump(res, open(os.path.join(a.out_dir, "step_d_results.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    def stage(sid, name, status, evidence=None, error=None):
        res["stages"][sid] = {"name": name, "status": status, "evidence": evidence or {}, "error": error}
        print("[%s] %s : %s" % (sid, name, status)); out()
        return status == "PASS"

    # ---- D1: audio dapat didecode (PyAV, tanpa ffmpeg)
    audio_s = None
    try:
        from faster_whisper import decode_audio
        samples = decode_audio(a.audio, sampling_rate=16000)
        audio_s = len(samples) / 16000.0
        peak = float(abs(samples).max()) if len(samples) else 0.0
        ok = audio_s >= 10 and peak > 0.001
        if not stage("D1", "audio decode", "PASS" if ok else "FAIL", {"duration_seconds": round(audio_s, 1), "peak_amplitude": round(peak, 4),
                     "extension": os.path.splitext(a.audio)[1].lower()}, None if ok else "Audio terlalu pendek (<10 dtk) atau nyaris senyap"):
            return 1
    except Exception as e:
        stage("D1", "audio decode", "FAIL", {}, tb()); return 1

    # ---- D2: transkripsi
    try:
        fake = os.environ.get("STEPD_FAKE_ENGINE")
        segs, lang, lang_p, load_s, tr_s = transcribe_fake(fake) if fake else transcribe_real(a, a.audio)
        ev2 = {"load_seconds": round(load_s, 2), "transcribe_seconds": round(tr_s, 1), "audio_seconds": round(audio_s, 1),
               "real_time_factor": round(tr_s / audio_s, 3), "peak_ram_mb": peak_ram_mb(), "segments": len(segs)}
        if fake: ev2["TEST_ONLY_FAKE_ENGINE"] = True
        if not stage("D2", "transcription", "PASS" if segs else "FAIL", ev2, None if segs else "Tidak ada segmen hasil transkripsi"):
            return 1
    except Exception:
        stage("D2", "transcription", "FAIL", {}, tb()); return 1

    # ---- D3: bahasa
    lang_ok = lang == "id" and lang_p >= 0.8
    stage("D3", "language detection", "PASS" if lang_ok else "FAIL", {"detected": lang, "probability": round(lang_p, 3)},
          None if lang_ok else "Bahasa terdeteksi bukan 'id' atau probabilitas < 0,8")

    # ---- D4: simpan transkrip MENTAH (tidak diubah) + checksum
    seg_rows = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip(), "avg_logprob": round(s.avg_logprob, 3),
                 "no_speech_prob": round(s.no_speech_prob, 3), "compression_ratio": round(s.compression_ratio, 2)} for s in segs]
    raw = "\n".join(r["text"] for r in seg_rows)
    rp, sp = os.path.join(a.out_dir, "raw_transcript.txt"), os.path.join(a.out_dir, "raw_segments.json")
    for p_ in (rp, sp):
        if os.path.exists(p_):
            os.chmod(p_, stat.S_IWRITE | stat.S_IREAD)
    open(rp, "w", encoding="utf-8").write(raw + "\n")
    json.dump(seg_rows, open(sp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    for p_ in (rp, sp):
        try: os.chmod(p_, stat.S_IREAD)
        except Exception: pass
    stage("D4", "raw transcript saved", "PASS", {"raw_sha256": sha256_text(raw), "raw_words": len(ev.norm_words(raw)), "files": ["raw_transcript.txt", "raw_segments.json"]})

    # ---- D5: evaluasi terhadap ground truth
    try:
        truth = open(a.truth, encoding="utf-8").read()
        terms = json.load(open(a.terms, encoding="utf-8")); facts = json.load(open(a.facts, encoding="utf-8"))
        rw, hw = ev.norm_words(truth), ev.norm_words(raw)
        strip = lambda t: [x for x in ev.tokenize(t) if x not in ".!?;:,"]
        m = {"ref_words": len(rw), "hyp_words": len(hw), "WER": round(ev.wer(rw, hw), 4), "CER": round(ev.cer(truth, raw), 4),
             "WER_number_normalized": round(ev.wer(ev.canon_tokens(strip(truth)), ev.canon_tokens(strip(raw))), 4)}
        tm = ev.eval_terms(terms, raw); fm = ev.eval_facts(facts, raw)
        n_all = sum(v["n"] for v in tm.values())
        m["terms_by_category"] = {k: {"strict": v["strict"], "lenient": v["lenient"], "misses": v["misses"], "near": v["near"]} for k, v in tm.items()}
        m["terms_overall_strict"] = round(sum(v["strict"] * v["n"] for v in tm.values()) / n_all, 3)
        m["terms_overall_lenient"] = round(sum(v["lenient"] * v["n"] for v in tm.values()) / n_all, 3)
        m["facts"] = fm
        # selisih kata (diagnostik): operasi non-equal antara kebenaran dan hasil
        sm = difflib.SequenceMatcher(None, rw, hw, autojunk=False)
        diffs = [{"op": op, "truth": " ".join(rw[i1:i2]), "heard": " ".join(hw[j1:j2])} for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
        subs = collections.Counter((d["truth"], d["heard"]) for d in diffs if d["op"] == "replace" and len(d["truth"].split()) <= 3)
        m["diff_op_count"] = len(diffs); m["diff_first_40"] = diffs[:40]
        m["top_substitutions"] = [{"truth": k[0], "heard": k[1], "count": c} for k, c in subs.most_common(15)]
        # fakta angka yang terbaca dari hasil (bentuk asli dipertahankan di samping bentuk ternormalisasi)
        found = extract_facts(raw)
        m["numbers_found"] = [{"raw": f["raw"], "kind": f["kind"], "value": f["value"], "display": display(f), "flags": f["flags"]} for f in found]
        # segmen yang meragukan (tidak ditebak; hanya ditandai NEEDS_REVIEW)
        m["segments_needs_review"] = [{"start": r["start"], "text": r["text"][:120], "why": ", ".join(w for w, c in (("avg_logprob<-1.0", r["avg_logprob"] < -1.0),
                                       ("compression_ratio>2.4", r["compression_ratio"] > 2.4), ("no_speech_prob>0.6", r["no_speech_prob"] > 0.6)) if c)}
                                      for r in seg_rows if r["avg_logprob"] < -1.0 or r["compression_ratio"] > 2.4 or r["no_speech_prob"] > 0.6]
        # perbandingan dengan ambang Phase 0 (deskriptif, bukan syarat lulus Step D)
        chk = {"WER_number_normalized <= 0.20": m["WER_number_normalized"] <= THR["wer_numnorm"], "istilah (strict) >= 0.90": m["terms_overall_strict"] >= THR["terms"],
               "angka (lenient) >= 0.95": fm["number_recall_lenient"] >= THR["numbers"]}
        m["vs_phase0_thresholds"] = chk
        n_ok = sum(chk.values()); m["quality_vs_thresholds"] = "MEETS" if n_ok == 3 else ("PARTIAL" if n_ok > 0 else "BELOW")
        res["metrics"] = m
        stage("D5", "evaluation vs ground truth", "PASS", {"WER": m["WER"], "WER_number_normalized": m["WER_number_normalized"],
              "terms_overall_strict": m["terms_overall_strict"], "numbers_lenient": fm["number_recall_lenient"], "quality_vs_thresholds": m["quality_vs_thresholds"]})
    except Exception:
        stage("D5", "evaluation vs ground truth", "FAIL", {}, tb()); return 1

    res["status"] = "PASS" if all(s["status"] == "PASS" for s in res["stages"].values()) else "FAIL"
    out()
    L = ["STEP D - RINGKASAN EVALUASI (small / CPU / int8; language=id; tanpa prompt)", "",
         "Audio: %s detik | transkripsi %s detik | RTF %s | puncak RAM %s MB" % (res["stages"]["D1"]["evidence"]["duration_seconds"], res["stages"]["D2"]["evidence"]["transcribe_seconds"],
                                                                         res["stages"]["D2"]["evidence"]["real_time_factor"], res["stages"]["D2"]["evidence"]["peak_ram_mb"]),
         "Bahasa terdeteksi: %s (%.3f)" % (lang, lang_p), "",
         "WER mentah: %.1f%% | WER setelah normalisasi angka: %.1f%% | CER: %.1f%%" % (100 * m["WER"], 100 * m["WER_number_normalized"], 100 * m["CER"]),
         "Istilah (strict): %.0f%% | (lenient): %.0f%%" % (100 * m["terms_overall_strict"], 100 * m["terms_overall_lenient"]),
         "Angka strict %.0f%% / lenient %.0f%% | tanggal %.0f%%" % (100 * fm["number_recall_strict"], 100 * fm["number_recall_lenient"], 100 * fm["date_recall"]),
         "Terhadap ambang Phase 0: %s  %s" % (m["quality_vs_thresholds"], json.dumps(chk, ensure_ascii=False)), "", "Istilah per kategori:"]
    for k, v in m["terms_by_category"].items():
        L.append("  %-15s strict %.0f%% lenient %.0f%%  salah: %s  mirip: %s" % (k, 100 * v["strict"], 100 * v["lenient"], v["misses"], v["near"]))
    L += ["", "Angka yang SALAH/tidak terbaca: %s" % fm["number_misses"], "Angka benar tetapi mata uang tak disebut: %s" % fm["number_currency_unstated"],
          "Tanggal salah: %s" % fm["date_misses"], "Angka ambigu (ditandai, tidak ditebak): %s" % fm["ambiguous_flagged"], "",
          "Substitusi terbanyak (kebenaran -> terdengar):"] + ["  %dx  '%s' -> '%s'" % (s["count"], s["truth"], s["heard"]) for s in m["top_substitutions"]]
    L += ["", "Segmen yang perlu dicek (NEEDS_REVIEW): %d" % len(m["segments_needs_review"])] + ["  [%.0fs] %s  (%s)" % (r["start"], r["text"], r["why"]) for r in m["segments_needs_review"][:10]]
    open(os.path.join(a.out_dir, "evaluation_summary.txt"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L))
    return 0 if res["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
