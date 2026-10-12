#!/usr/bin/env python3
"""DISPOSABLE Phase 0 / STEP C helper: validasi lingkungan faster-whisper. BUKAN kode produksi.

Subperintah (masing-masing menulis satu berkas JSON hasil; keluar 0 = PASS, 1 = FAIL, 2 = BLOCKED):
  check      C4  import paket, versi, dukungan compute type CPU, uji decode audio (PyAV) pada WAV sintetis
  download   C5  unduh model 'small' dari sumber resmi (Systran/faster-whisper-small di Hugging Face) + verifikasi SHA-256
  loadinfer  C6+C7  muat model (cpu/int8) lalu transkripsi satu audio kecil sintetis

Tidak ada audio perusahaan. Inferensi lokal. Satu-satunya akses jaringan: C5 (unduh model).
"""
import argparse, hashlib, json, os, re, sys, tempfile, time, traceback, wave, math, struct

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
REPO = "Systran/faster-whisper-small"
PKGS = ["faster-whisper", "ctranslate2", "av", "tokenizers", "huggingface-hub", "onnxruntime", "numpy", "tqdm", "pip"]
NETWORK_HINT = re.compile(r"403|401|407|connection|proxy|ssl|certificate|timed? ?out|offline|resolve|unreachable|max retries|forbidden|blocked|name or service|getaddrinfo",
                          re.I)


def write(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)


def versions():
    import importlib.metadata as md
    out = {}
    for p in PKGS:
        try:
            out[p] = md.version(p)
        except md.PackageNotFoundError:
            out[p] = None
    return out


def sha256(path, buf=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(buf), b""):
            h.update(chunk)
    return h.hexdigest()


def tb(e, limit=4000):
    return (traceback.format_exc() or repr(e))[-limit:]


def make_sine_wav(path, seconds=1.0, hz=440, sr=16000):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * hz * i / sr))) for i in range(int(sr * seconds))))


# ----------------------------------------------------------------- C4
def cmd_check(a):
    res = {"stage": "C4", "python": sys.version.split()[0], "python_full": sys.version.replace("\n", " "), "bits": 64 if sys.maxsize > 2**32 else 32,
           "versions": versions(), "status": "PASS", "evidence": {}, "error": None}
    try:
        import faster_whisper, ctranslate2, av, tokenizers, huggingface_hub, numpy  # noqa: F401
        res["evidence"]["imports"] = "faster_whisper, ctranslate2, av, tokenizers, huggingface_hub, numpy: OK"
        try:
            import onnxruntime  # noqa: F401
            res["evidence"]["onnxruntime_import"] = "OK"
        except Exception as e:  # informasi saja; tidak dipakai di smoke test (VAD dimatikan)
            res["evidence"]["onnxruntime_import"] = "gagal: " + str(e)[:300]
        types = sorted(ctranslate2.get_supported_compute_types("cpu"))
        res["evidence"]["cpu_supported_compute_types"] = types
        res["evidence"]["int8_supported_on_cpu"] = "int8" in types
        res["evidence"]["cuda_device_count"] = ctranslate2.get_cuda_device_count()
        # Uji decode: temuan Linux (av 19 + faster-whisper 1.2.1) gagal justru di sini, bukan saat import.
        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, "sine.wav"); make_sine_wav(wav)
            audio = faster_whisper.decode_audio(wav, sampling_rate=16000)
            ok = abs(len(audio) - 16000) < 400
            res["evidence"]["decode_audio_samples"] = int(len(audio))
            res["evidence"]["decode_audio_ok"] = bool(ok)
            if not ok:
                res["status"] = "FAIL"; res["error"] = "decode_audio mengembalikan %d sampel, diharapkan ±16000" % len(audio)
        if res["status"] == "PASS" and not res["evidence"]["int8_supported_on_cpu"]:
            res["status"] = "FAIL"; res["error"] = "compute_type int8 tidak didukung CPU ini oleh ctranslate2; didukung: %s" % types
    except Exception as e:
        res["status"] = "FAIL"; res["error"] = tb(e)
    write(a.out, res)
    return {"PASS": 0, "FAIL": 1}[res["status"]]


# ----------------------------------------------------------------- C5
def verify_files(model_dir, expected):
    """expected: {nama: {'size': int|None, 'sha256': str|None}}. Hanya berkas LFS punya sha256 dari Hub; sisanya dicek ukuran."""
    rows, all_ok = [], True
    for name, exp in sorted(expected.items()):
        p = os.path.join(model_dir, name)
        if not os.path.isfile(p):
            rows.append({"file": name, "present": False, "ok": False}); all_ok = False; continue
        size = os.path.getsize(p)
        row = {"file": name, "present": True, "size": size, "expected_size": exp.get("size")}
        if exp.get("sha256"):
            row["sha256"] = sha256(p); row["expected_sha256"] = exp["sha256"]; row["ok"] = row["sha256"] == exp["sha256"]
        else:
            row["ok"] = exp.get("size") is None or size == exp["size"]
        all_ok &= row["ok"]; rows.append(row)
    return rows, all_ok


def cmd_download(a):
    res = {"stage": "C5", "repo": REPO, "status": "PASS", "evidence": {}, "error": None}
    try:
        from faster_whisper.utils import download_model
        from huggingface_hub import HfApi
        os.makedirs(a.model_dir, exist_ok=True)
        t0 = time.time()
        path = download_model("small", output_dir=a.model_dir)
        res["evidence"]["download_seconds"] = round(time.time() - t0, 1)
        res["evidence"]["model_dir_exists"] = os.path.isdir(path)
        info = HfApi().model_info(REPO, files_metadata=True)
        res["evidence"]["repo_commit_sha"] = info.sha
        exp = {}
        for s in info.siblings:
            if s.rfilename in ("config.json", "preprocessor_config.json", "model.bin", "tokenizer.json", "vocabulary.json", "vocabulary.txt"):
                lfs = getattr(s, "lfs", None)
                exp[s.rfilename] = {"size": s.size, "sha256": (getattr(lfs, "sha256", None) or (lfs.get("sha256") if lfs else None)) if lfs else None}
        rows, ok = verify_files(path, exp)   # semua berkas yang diharapkan Hub; yang hilang lokal ditandai (v1 menyaring yang ada saja)
        res["evidence"]["files"] = rows; res["evidence"]["model_bin_present"] = any(r["file"] == "model.bin" and r["present"] for r in rows)
        res["evidence"]["checksum_all_ok"] = ok
        if not res["evidence"]["model_bin_present"] or not ok:
            res["status"] = "FAIL"; res["error"] = "Berkas model tidak lengkap atau checksum tidak cocok (lihat evidence.files)"
        res["evidence"]["model_dir"] = os.path.relpath(path)
    except Exception as e:
        msg = tb(e)
        res["status"] = "BLOCKED" if NETWORK_HINT.search(msg) else "FAIL"
        res["error"] = msg
    write(a.out, res)
    return {"PASS": 0, "FAIL": 1, "BLOCKED": 2}[res["status"]]


# ----------------------------------------------------------------- C6 + C7
def cmd_loadinfer(a):
    res = {"stage": "C6+C7", "C6": {"status": "FAIL", "evidence": {}, "error": None}, "C7": {"status": "BLOCKED", "evidence": {}, "error": "tidak dijalankan: C6 belum PASS"}}
    model = None
    try:
        from faster_whisper import WhisperModel
        t0 = time.time()
        model = WhisperModel(a.model_dir, device="cpu", compute_type="int8", local_files_only=True)   # C6 tidak boleh mengunduh apa pun
        res["C6"] = {"status": "PASS", "evidence": {"device": "cpu", "compute_type": "int8", "load_seconds": round(time.time() - t0, 2)}, "error": None}
    except Exception as e:
        res["C6"]["error"] = tb(e)
        try:  # evaluasi fallback (informasi saja; C6 tetap FAIL)
            import ctranslate2
            res["C6"]["evidence"]["cpu_supported_compute_types"] = sorted(ctranslate2.get_supported_compute_types("cpu"))
        except Exception as e2:
            res["C6"]["evidence"]["supported_types_error"] = str(e2)[:300]
    if model is not None:
        try:
            from faster_whisper import decode_audio
            expected = open(a.expected_file, encoding="utf-8").read().strip()
            dur = len(decode_audio(a.audio, sampling_rate=16000)) / 16000.0
            t0 = time.time()
            segs, info = model.transcribe(a.audio, language=a.lang, beam_size=1, vad_filter=False, condition_on_previous_text=False)
            text = " ".join(s.text.strip() for s in segs).strip()   # generator: kerja inferensi terjadi di sini
            el = time.time() - t0
            tok = lambda t: re.findall(r"[a-z]+", t.lower())
            exp_w = set(tok(expected)); got_w = set(tok(text))
            overlap = len(exp_w & got_w) / max(1, len(exp_w))
            status = "PASS" if text and overlap >= 0.4 else "FAIL"
            res["C7"] = {"status": status, "error": None if status == "PASS" else "teks kosong atau kemiripan kata < 40% (lihat evidence)",
                         "evidence": {"audio_seconds": round(dur, 2), "language_requested": a.lang, "language_detected": info.language,
                                      "language_probability": round(float(info.language_probability), 3), "transcribe_seconds": round(el, 2),
                                      "rtf_informational_only": round(el / max(dur, 1e-6), 3), "transcript": text, "expected_text": expected,
                                      "word_overlap": round(overlap, 2),
                                      "note": "smoke test, BUKAN benchmark akurasi; RTF audio sangat pendek tidak representatif"}}
        except Exception as e:
            res["C7"] = {"status": "FAIL", "evidence": {}, "error": tb(e)}
    write(a.out, res)
    return 0 if res["C6"]["status"] == "PASS" and res["C7"]["status"] == "PASS" else 1


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("check"); p.add_argument("--out", required=True)
    p = sub.add_parser("download"); p.add_argument("--out", required=True); p.add_argument("--model-dir", required=True)
    p = sub.add_parser("loadinfer"); p.add_argument("--out", required=True); p.add_argument("--model-dir", required=True)
    p.add_argument("--audio", required=True); p.add_argument("--lang", required=True); p.add_argument("--expected-file", dest="expected_file", required=True)
    a = ap.parse_args()
    sys.exit({"check": cmd_check, "download": cmd_download, "loadinfer": cmd_loadinfer}[a.cmd](a))


if __name__ == "__main__":
    main()
