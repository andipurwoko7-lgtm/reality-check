#!/usr/bin/env python3
"""DISPOSABLE Phase 0 / STEP F: benchmark terkendali pada SATU file rekaman. BUKAN kode produksi.

Subperintah:
  download --model M --model-dir D --out J        unduh model dari Hugging Face (repo resmi dari tabel faster-whisper) + verifikasi SHA-256
  bench    --model M --model-dir D --audio A --out-dir O [--variants v0,v1,v2]
           muat model SEKALI (cpu/int8, local_files_only), jalankan varian pada audio yang sama, simpan transkrip mentah per varian
  summarize --out-dir O [--notes=...]             gabungkan bench_*.json menjadi tabel (json, md, csv)

Varian (hanya satu hal berubah per perbandingan):
  v0  language=id (dipaksa), tanpa prompt          (= konfigurasi Step D)
  v1  language=id, prompt glosarium                 (efek prompt)
  v2  language=auto, tanpa prompt                   (efek deteksi bahasa untuk campuran ID-EN)

Prompt glosarium sengaja memuat HANYA SETENGAH istilah evaluasi (+ semua nama). Setengah lainnya ('held_out') tidak ada di prompt,
supaya terlihat apakah prompt menolong istilah yang disebut maupun efek sampingnya pada istilah yang tidak disebut.

Tanpa jaringan di 'bench'. Satu proses per model, sehingga puncak RAM per model terukur.
"""
import argparse, csv, difflib, glob, json, math, os, stat, sys, time, traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import eval_transcript as ev            # noqa: E402
from idnum import extract_facts          # noqa: E402
import step_c_smoke as sc                # noqa: E402  (verify_files, sha256, NETWORK_HINT)
from step_d_transcribe import peak_ram_mb, sha256_text   # noqa: E402

THR = {"wer_numnorm": 0.20, "terms": 0.90, "numbers": 0.95}   # ambang Phase 0, RENCANA 10.5 (tidak diubah)
VARIANTS = {"v0": {"language": "id", "prompt": False, "desc": "id, tanpa prompt (= Step D)"},
            "v1": {"language": "id", "prompt": True, "desc": "id, prompt glosarium (setengah istilah)"},
            "v2": {"language": None, "prompt": False, "desc": "bahasa auto, tanpa prompt"}}
ALLOWED = ("small", "medium", "large-v3", "large-v3-turbo")


def split_terms(terms):
    a, b = [], []
    for cat in ("abbreviations", "finance_terms", "english_mixed"):
        for i, t in enumerate(terms[cat]):
            (a if i % 2 == 0 else b).append(t)
    return a, b


def build_prompt(terms):
    a, _ = split_terms(terms)
    return ("Rapat korporat Bahasa Indonesia dengan istilah Inggris. Istilah: " + ", ".join(a) +
            ". Nama: Pak Andi, Pak Budi, Bu Sari, Mandiri, BNI, Bali.")


def pct(xs, p):
    if not xs: return None
    s = sorted(xs); k = (len(s) - 1) * p / 100.0; f, c = math.floor(k), math.ceil(k)
    return round(s[f] + (s[c] - s[f]) * (k - f), 3)


class _Seg:   # hanya mesin palsu untuk uji alat
    def __init__(self, i, text):
        self.start, self.end, self.text = float(i * 5), float(i * 5 + 4), text
        self.avg_logprob, self.no_speech_prob, self.compression_ratio = -0.3, 0.02, 1.2


def evaluate(raw, truth, terms, facts):
    rw, hw = ev.norm_words(truth), ev.norm_words(raw)
    strip = lambda t: [x for x in ev.tokenize(t) if x not in ".!?;:,"]
    a, b = split_terms(terms)
    allt = ev.eval_terms(terms, raw)
    n_all = sum(v["n"] for v in allt.values())
    split = ev.eval_terms({"in_prompt": a, "held_out": b, "names": terms["names"]}, raw)
    fm = ev.eval_facts(facts, raw)
    m = {"WER": round(ev.wer(rw, hw), 4), "CER": round(ev.cer(truth, raw), 4),
         "WER_numnorm": round(ev.wer(ev.canon_tokens(strip(truth)), ev.canon_tokens(strip(raw))), 4),
         "terms_strict": round(sum(v["strict"] * v["n"] for v in allt.values()) / n_all, 3),
         "terms_lenient": round(sum(v["lenient"] * v["n"] for v in allt.values()) / n_all, 3),
         "terms_by_category_strict": {k: v["strict"] for k, v in allt.items()},
         "terms_in_prompt_strict": split["in_prompt"]["strict"], "terms_held_out_strict": split["held_out"]["strict"],
         "terms_in_prompt_misses": split["in_prompt"]["misses"], "terms_held_out_misses": split["held_out"]["misses"],
         "names_strict": split["names"]["strict"],
         "numbers_strict": fm["number_recall_strict"], "numbers_lenient": fm["number_recall_lenient"], "dates": fm["date_recall"],
         "number_misses": fm["number_misses"], "numbers_found": len(extract_facts(raw))}
    chk = {"WER_numnorm<=0.20": m["WER_numnorm"] <= THR["wer_numnorm"], "terms_strict>=0.90": m["terms_strict"] >= THR["terms"],
           "numbers_lenient>=0.95": m["numbers_lenient"] >= THR["numbers"]}
    m["thresholds"] = chk; m["quality"] = "MEETS" if all(chk.values()) else ("PARTIAL" if any(chk.values()) else "BELOW")
    return m


# ------------------------------------------------------------------ download
def cmd_download(a):
    res = {"stage": "download", "model": a.model, "status": "PASS", "evidence": {}, "error": None}
    try:
        from faster_whisper.utils import download_model, _MODELS
        from huggingface_hub import HfApi
        if a.model not in ALLOWED:
            raise ValueError("model tidak diizinkan: " + a.model)
        repo = _MODELS[a.model]; res["repo"] = repo
        os.makedirs(a.model_dir, exist_ok=True)
        t0 = time.time(); path = download_model(a.model, output_dir=a.model_dir); res["evidence"]["download_seconds"] = round(time.time() - t0, 1)
        info = HfApi().model_info(repo, files_metadata=True); res["evidence"]["repo_commit_sha"] = info.sha
        exp = {}
        for s in info.siblings:
            if s.rfilename in ("config.json", "preprocessor_config.json", "model.bin", "tokenizer.json", "vocabulary.json", "vocabulary.txt"):
                lfs = getattr(s, "lfs", None)
                exp[s.rfilename] = {"size": s.size, "sha256": (getattr(lfs, "sha256", None) or (lfs.get("sha256") if lfs else None)) if lfs else None}
        rows, ok = sc.verify_files(path, exp)
        res["evidence"]["files"] = rows; res["evidence"]["checksum_all_ok"] = ok
        res["evidence"]["total_gb"] = round(sum(r.get("size", 0) for r in rows) / 2**30, 2)
        if not any(r["file"] == "model.bin" and r["present"] for r in rows) or not ok:
            res["status"] = "FAIL"; res["error"] = "Berkas tidak lengkap atau checksum tidak cocok"
    except Exception as e:
        msg = traceback.format_exc()[-3500:]
        res["status"] = "BLOCKED" if sc.NETWORK_HINT.search(msg) else "FAIL"; res["error"] = msg
    json.dump(res, open(a.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("[download %s] %s%s" % (a.model, res["status"], (" (%s GB, %ss)" % (res["evidence"].get("total_gb"), res["evidence"].get("download_seconds"))) if res["status"] == "PASS" else ""))
    return {"PASS": 0, "FAIL": 1, "BLOCKED": 2}[res["status"]]


# ------------------------------------------------------------------ bench
def cmd_bench(a):
    os.makedirs(a.out_dir, exist_ok=True)
    truth = open(os.path.join(a.td, "ground_truth_full.txt"), encoding="utf-8").read()
    terms = json.load(open(os.path.join(a.td, "key_terms.json"), encoding="utf-8")); facts = json.load(open(os.path.join(a.td, "key_facts.json"), encoding="utf-8"))
    prompt = build_prompt(terms)
    out = {"model": a.model, "device": "cpu", "compute_type": "int8", "audio_file": os.path.basename(a.audio), "prompt_used": prompt, "variants": {}, "status": "FAIL"}
    path = os.path.join(a.out_dir, "bench_%s.json" % a.model)
    save = lambda: json.dump(out, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    try:
        from faster_whisper import decode_audio
        audio = decode_audio(a.audio, sampling_rate=16000); out["audio_seconds"] = round(len(audio) / 16000.0, 1)
        fake = os.environ.get("STEPF_FAKE_ENGINE")
        if fake:
            model = None; out["load_seconds"] = 0.0
        else:
            from faster_whisper import WhisperModel
            t0 = time.time(); model = WhisperModel(a.model_dir, device="cpu", compute_type="int8", local_files_only=True); out["load_seconds"] = round(time.time() - t0, 2)
        out["peak_ram_after_load_mb"] = peak_ram_mb()
        for vid in a.variants.split(","):
            v = VARIANTS[vid]; t1 = time.time()
            if fake:
                lines = [l.strip() for l in open("%s.%s" % (fake, vid), encoding="utf-8") if l.strip()]
                segs, lang, lp = [_Seg(i, l) for i, l in enumerate(lines)], "id", 0.99
            else:
                it, info = model.transcribe(audio, language=v["language"], beam_size=5, vad_filter=True, condition_on_previous_text=False,
                                            initial_prompt=prompt if v["prompt"] else None)
                segs = list(it); lang, lp = info.language, float(info.language_probability)
            el = time.time() - t1
            rows = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip(), "avg_logprob": round(s.avg_logprob, 3),
                     "no_speech_prob": round(s.no_speech_prob, 3), "compression_ratio": round(s.compression_ratio, 2)} for s in segs]
            raw = "\n".join(r["text"] for r in rows)
            rp = os.path.join(a.out_dir, "raw_%s_%s.txt" % (a.model, vid)); sp = os.path.join(a.out_dir, "raw_%s_%s.segments.json" % (a.model, vid))
            for p_ in (rp, sp):
                if os.path.exists(p_): os.chmod(p_, stat.S_IWRITE | stat.S_IREAD)
            open(rp, "w", encoding="utf-8").write(raw + "\n"); json.dump(rows, open(sp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
            for p_ in (rp, sp):
                try: os.chmod(p_, stat.S_IREAD)
                except Exception: pass
            lps, nsp, cr = [r["avg_logprob"] for r in rows], [r["no_speech_prob"] for r in rows], [r["compression_ratio"] for r in rows]
            met = evaluate(raw, truth, terms, facts)
            out["variants"][vid] = {"desc": v["desc"], "language_setting": v["language"] or "auto", "prompt": v["prompt"], "language_detected": lang, "language_probability": round(lp, 3),
                                    "transcribe_seconds": round(el, 1), "rtf": round(el / out["audio_seconds"], 3), "segments": len(rows), "raw_sha256": sha256_text(raw),
                                    "flag_counts": {"no_speech_prob>0.6": sum(x > 0.6 for x in nsp), "avg_logprob<-1.0": sum(x < -1.0 for x in lps), "compression_ratio>2.4": sum(x > 2.4 for x in cr)},
                                    "distribution": {"no_speech_prob_p10_p50_p90": [pct(nsp, 10), pct(nsp, 50), pct(nsp, 90)], "avg_logprob_p10_p50_p90": [pct(lps, 10), pct(lps, 50), pct(lps, 90)]},
                                    "metrics": met}
            save()
            print("[%s %s] %5.1fs RTF %.2f | WERnorm %4.1f%% | istilah %3.0f%% (prompt %3.0f%% / luar-prompt %3.0f%%) | angka %3.0f%% | %s" % (
                a.model, vid, el, el / out["audio_seconds"], 100 * met["WER_numnorm"], 100 * met["terms_strict"], 100 * met["terms_in_prompt_strict"],
                100 * met["terms_held_out_strict"], 100 * met["numbers_lenient"], met["quality"]))
        out["peak_ram_final_mb"] = peak_ram_mb(); out["status"] = "PASS"; save()
        return 0
    except Exception:
        out["error"] = traceback.format_exc()[-3500:]; save(); print("[bench %s] FAIL\n%s" % (a.model, out["error"])); return 1


# ------------------------------------------------------------------ summarize
def cmd_summarize(a):
    rows = []
    for p in sorted(glob.glob(os.path.join(a.out_dir, "bench_*.json"))):
        d = json.load(open(p, encoding="utf-8"))
        for vid, v in d.get("variants", {}).items():
            m = v["metrics"]
            rows.append({"model": d["model"], "variant": vid, "setting": v["desc"], "device": d["device"], "compute_type": d["compute_type"], "audio_s": d.get("audio_seconds"),
                         "processing_s": v["transcribe_seconds"], "rtf": v["rtf"], "load_s": d.get("load_seconds"), "peak_ram_after_load_mb": d.get("peak_ram_after_load_mb"),
                         "peak_ram_final_mb": d.get("peak_ram_final_mb"), "peak_vram": "n/a (tanpa GPU)", "WER_raw": m["WER"], "WER_numnorm": m["WER_numnorm"], "CER": m["CER"],
                         "terms_strict": m["terms_strict"], "terms_in_prompt": m["terms_in_prompt_strict"], "terms_held_out": m["terms_held_out_strict"], "names": m["names_strict"],
                         "numbers_lenient": m["numbers_lenient"], "dates": m["dates"], "lang": "%s(%.2f)" % (v["language_detected"], v["language_probability"]),
                         "quality": m["quality"], "no_speech_flags": v["flag_counts"]["no_speech_prob>0.6"], "segments": v["segments"]})
    keys = list(rows[0].keys()) if rows else []
    with open(os.path.join(a.out_dir, "step_f_table.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=keys); w.writeheader(); w.writerows(rows)
    L = ["# STEP F - ringkasan benchmark (satu rekaman, cpu/int8)", "", "| model | varian | detik | RTF | RAM puncak (MB) | WER ternorm. | istilah | di prompt | luar prompt | angka | kualitas |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        L.append("| %s | %s | %s | %s | %s | %.1f%% | %.0f%% | %.0f%% | %.0f%% | %.0f%% | %s |" % (r["model"], r["variant"], r["processing_s"], r["rtf"], r["peak_ram_final_mb"], 100 * r["WER_numnorm"],
                 100 * r["terms_strict"], 100 * r["terms_in_prompt"], 100 * r["terms_held_out"], 100 * r["numbers_lenient"], r["quality"]))
    L += ["", "Varian: v0 = id tanpa prompt (Step D); v1 = id + prompt glosarium (setengah istilah); v2 = bahasa auto tanpa prompt.",
          "Ambang Phase 0: WER ternormalisasi <= 20%, istilah >= 90%, angka >= 95%."]
    open(os.path.join(a.out_dir, "step_f_summary.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    json.dump({"notes": a.notes or None, "rows": rows}, open(os.path.join(a.out_dir, "step_f_summary.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("\n".join(L)); return 0 if rows else 1


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("download"); p.add_argument("--model", required=True); p.add_argument("--model-dir", required=True); p.add_argument("--out", required=True)
    p = sub.add_parser("bench"); p.add_argument("--model", required=True); p.add_argument("--model-dir", required=True); p.add_argument("--audio", required=True)
    p.add_argument("--out-dir", required=True); p.add_argument("--variants", default="v0,v1,v2"); p.add_argument("--td", required=True)
    p = sub.add_parser("summarize"); p.add_argument("--out-dir", required=True); p.add_argument("--notes", default="")
    a = ap.parse_args()
    sys.exit({"download": cmd_download, "bench": cmd_bench, "summarize": cmd_summarize}[a.cmd](a))


if __name__ == "__main__":
    main()
