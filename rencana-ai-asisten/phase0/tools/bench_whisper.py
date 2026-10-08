#!/usr/bin/env python3
"""DISPOSABLE Phase 0 — benchmark faster-whisper di laptop pengguna. BUKAN kode produksi.

Prasyarat (di laptop): Python 3.10+, ffmpeg di PATH, `pip install faster-whisper psutil`.
Model diunduh sekali dari HuggingFace saat pertama dipakai (butuh internet).

Contoh:
  python bench_whisper.py --audio ..\\results\\sim_mic.wav --models small medium large-v3-turbo large-v3 \\
      --truth ..\\test_data\\ground_truth_andi.txt --facts ..\\test_data\\key_facts.json \\
      --terms ..\\test_data\\key_terms.json --prompt-file ..\\test_data\\glossary_prompt.txt \\
      --out ..\\results\\bench_run1

Uji mekanik tanpa model:  python bench_whisper.py --audio x.wav --engine dummy --models dummy
Setiap kombinasi: model x {tanpa prompt, dengan prompt glosarium} x bahasa. Output: results.csv/json + transkrip + segmen.
"""
import argparse, csv, json, os, subprocess, sys, threading, time, platform

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import eval_transcript as ev  # noqa: E402

try:
    import psutil
except ImportError:
    psutil = None


class Monitor(threading.Thread):
    """Sampel RSS proses, CPU sistem, dan GPU (nvidia-smi jika ada) tiap 0.5 detik."""
    def __init__(self):
        super().__init__(daemon=True)
        self.stop = threading.Event(); self.rss = []; self.cpu = []; self.gpu_util = []; self.gpu_mem = []
        self.has_gpu = subprocess.call("nvidia-smi -L", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0
        self.proc = psutil.Process() if psutil else None
        if psutil: psutil.cpu_percent(None)

    def run(self):
        while not self.stop.wait(0.5):
            if self.proc:
                self.rss.append(self.proc.memory_info().rss / 2**20)
                self.cpu.append(psutil.cpu_percent(None))
            if self.has_gpu:
                try:
                    o = subprocess.check_output("nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits",
                                                shell=True, text=True, timeout=3).splitlines()[0].split(",")
                    self.gpu_util.append(float(o[0])); self.gpu_mem.append(float(o[1]))
                except Exception:
                    pass

    def summary(self):
        f = lambda xs, fn: round(fn(xs), 1) if xs else None
        return dict(peak_rss_mb=f(self.rss, max), avg_cpu_pct=f(self.cpu, lambda x: sum(x) / len(x)),
                    peak_gpu_util_pct=f(self.gpu_util, max), peak_vram_mb=f(self.gpu_mem, max))


def hardware():
    info = dict(platform=platform.platform(), python=sys.version.split()[0], machine=platform.machine(),
                cpu_logical=os.cpu_count())
    if psutil:
        info["cpu_physical"] = psutil.cpu_count(logical=False); info["ram_gb"] = round(psutil.virtual_memory().total / 2**30, 1)
    try:
        info["gpu"] = subprocess.check_output("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader",
                                              shell=True, text=True, timeout=5, stderr=subprocess.DEVNULL).strip()
    except Exception:
        info["gpu"] = "tidak ada GPU NVIDIA terdeteksi"
    return info


def audio_seconds(path):
    from faster_whisper import decode_audio
    return len(decode_audio(path, sampling_rate=16000)) / 16000.0


def transcribe_dummy(audio, **kw):
    time.sleep(1.0)
    return ["ini hanya engine tiruan untuk uji mekanik"], []


def make_real_engine(model_name, device, compute_type, threads):
    from faster_whisper import WhisperModel
    t0 = time.time()
    m = WhisperModel(model_name, device=device, compute_type=compute_type, cpu_threads=threads)
    load_s = time.time() - t0

    def run(audio, language, prompt, vad, beam):
        segs, info = m.transcribe(audio, language=None if language == "auto" else language, beam_size=beam,
                                  vad_filter=vad, initial_prompt=prompt, condition_on_previous_text=False)
        out, meta = [], []
        for s in segs:  # generator: pekerjaan sebenarnya terjadi di sini
            out.append(s.text.strip())
            meta.append(dict(start=round(s.start, 2), end=round(s.end, 2), avg_logprob=round(s.avg_logprob, 3),
                             no_speech_prob=round(s.no_speech_prob, 3), compression_ratio=round(s.compression_ratio, 2)))
        return out, meta, getattr(info, "language", None), getattr(info, "language_probability", None)
    return run, load_s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True); ap.add_argument("--models", nargs="+", default=["small", "medium"])
    ap.add_argument("--device", default="auto"); ap.add_argument("--compute-type", default="auto")
    ap.add_argument("--threads", type=int, default=0); ap.add_argument("--beam", type=int, default=5)
    ap.add_argument("--languages", nargs="+", default=["id"], help="id dan/atau auto")
    ap.add_argument("--prompt-file"); ap.add_argument("--no-vad", action="store_true")
    ap.add_argument("--truth"); ap.add_argument("--facts"); ap.add_argument("--terms")
    ap.add_argument("--out", default="bench_out"); ap.add_argument("--engine", default="real", choices=["real", "dummy"])
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "transcripts"), exist_ok=True)

    hw = hardware(); dur = audio_seconds(a.audio)
    print("HARDWARE:", json.dumps(hw, ensure_ascii=False)); print("AUDIO: %.1f detik (%.1f menit)" % (dur, dur / 60))
    prompt = open(a.prompt_file, encoding="utf-8").read().strip() if a.prompt_file else None
    variants = [("noprompt", None)] + ([("prompt", prompt)] if prompt else [])
    rows = []
    for model in a.models:
        if a.engine == "dummy":
            run = lambda audio, language, prompt, vad, beam: (*transcribe_dummy(audio), "id", 1.0); load_s = 0.0
        else:
            try:
                run, load_s = make_real_engine(model, a.device, a.compute_type, a.threads)
            except Exception as e:
                print(f"[GAGAL muat model {model}] {e}"); rows.append(dict(model=model, error=str(e))); continue
        for lang in a.languages:
            for vname, vprompt in variants:
                mon = Monitor(); mon.start(); t0 = time.time()
                try:
                    texts, meta, dl, dp = run(a.audio, lang, vprompt, not a.no_vad, a.beam)
                    err = None
                except Exception as e:
                    texts, meta, dl, dp, err = [], [], None, None, str(e)
                el = time.time() - t0; mon.stop.set(); mon.join(timeout=2)
                row = dict(model=model, language=lang, variant=vname, load_s=round(load_s, 1), transcribe_s=round(el, 1),
                           audio_s=round(dur, 1), rtf=round(el / dur, 3), detected_language=dl, error=err, **mon.summary())
                text = "\n".join(texts); tag = f"{model}_{lang}_{vname}"
                open(os.path.join(a.out, "transcripts", tag + ".txt"), "w", encoding="utf-8").write(text + "\n")
                json.dump(meta, open(os.path.join(a.out, "transcripts", tag + ".segments.json"), "w"), indent=1)
                if a.truth and not err:
                    truth = open(a.truth, encoding="utf-8").read(); rw, hw_ = ev.norm_words(truth), ev.norm_words(text)
                    row["WER"] = round(ev.wer(rw, hw_), 4)
                    row["WER_numnorm"] = round(ev.wer(ev.canon_tokens([t for t in ev.tokenize(truth) if t not in ".!?;:,"]),
                                                      ev.canon_tokens([t for t in ev.tokenize(text) if t not in ".!?;:,"])), 4)
                    if a.terms:
                        for c, v in ev.eval_terms(json.load(open(a.terms, encoding="utf-8")), text).items():
                            row[f"terms_{c}"] = v["strict"]
                    if a.facts:
                        f = ev.eval_facts(json.load(open(a.facts, encoding="utf-8")), text)
                        row["numbers_strict"] = f["number_recall_strict"]; row["numbers_lenient"] = f["number_recall_lenient"]
                        row["dates"] = f["date_recall"]
                print(json.dumps(row, ensure_ascii=False)); rows.append(row)
    json.dump(dict(hardware=hw, rows=rows), open(os.path.join(a.out, "results.json"), "w"), indent=2, ensure_ascii=False)
    cols = sorted({k for r in rows for k in r}, key=lambda k: (k not in ("model", "language", "variant"), k))
    with open(os.path.join(a.out, "results.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(rows)
    print("Selesai ->", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
