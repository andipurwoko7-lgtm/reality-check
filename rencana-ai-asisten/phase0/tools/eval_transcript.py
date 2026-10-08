#!/usr/bin/env python3
"""DISPOSABLE Phase 0 — evaluator transkrip terhadap ground truth. Tanpa dependensi eksternal.

Pakai:
  python3 eval_transcript.py --truth ../test_data/ground_truth_full.txt --hyp hasil.txt \
      --facts ../test_data/key_facts.json --terms ../test_data/key_terms.json [--json out.json]
  # uji kebocoran antar-track (mic vs sistem):
  python3 eval_transcript.py --truth ../test_data/ground_truth_andi.txt --hyp mic.txt \
      --other ../test_data/ground_truth_others.txt

Metrik: WER, CER, WER setelah normalisasi angka (dua belas persen == 12%), recall istilah (strict/near),
recall angka & tanggal (strict = kind+nilai cocok; lenient = nilai cocok, mata uang tak disebut), leak score.
"""
import argparse, json, re, sys, os
from decimal import Decimal
from difflib import SequenceMatcher

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from idnum import tokenize, canon_tokens, extract_facts  # noqa: E402


def norm_words(text):
    toks = [t for t in tokenize(text) if t not in ".!?;:,"]
    return toks


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def wer(ref, hyp):
    return edit_distance(ref, hyp) / max(1, len(ref))


def cer(ref_text, hyp_text):
    r = " ".join(norm_words(ref_text)); h = " ".join(norm_words(hyp_text))
    return edit_distance(list(r), list(h)) / max(1, len(r))


def term_in(term, words_joined, words):
    t = " ".join(norm_words(term.replace("-", " ")))
    hay = " " + words_joined.replace("-", " ") + " "
    if (" " + t + " ") in hay:
        return "strict"
    # near: n-gram jendela dengan rasio >= 0.85 (menangkap "C S P A", "term shit")
    n = len(t.split())
    best = 0.0
    for i in range(max(1, len(words) - n + 1)):
        cand = " ".join(words[i:i + n])
        best = max(best, SequenceMatcher(None, t, cand).ratio())
    compact = t.replace(" ", "")
    if compact and compact in hay.replace(" ", ""):
        return "near"
    return "near" if best >= 0.85 else "miss"


def eval_terms(terms, hyp_text):
    words = norm_words(hyp_text); joined = " ".join(words)
    out = {}
    for cat, lst in terms.items():
        if cat.startswith("_"): continue
        res = {t: term_in(t, joined, words) for t in lst}
        n = len(lst)
        out[cat] = dict(n=n,
                        strict=round(sum(v == "strict" for v in res.values()) / n, 3),
                        lenient=round(sum(v != "miss" for v in res.values()) / n, 3),
                        misses=[t for t, v in res.items() if v == "miss"],
                        near=[t for t, v in res.items() if v == "near"])
    return out


def eval_facts(facts, hyp_text):
    found = extract_facts(hyp_text)
    res = []
    for f in facts["numbers"]:
        exp_v = Decimal(f["value"])
        strict = any(x["kind"] == f["kind"] and x["value"] is not None and Decimal(x["value"]) == exp_v for x in found)
        lenient = strict or any(x["value"] is not None and x["kind"] in ("plain", f["kind"]) and Decimal(x["value"]) == exp_v for x in found)
        res.append(dict(id=f["id"], what=f["what"], strict=strict, lenient=lenient))
    dres = []
    for d in facts["dates"]:
        ok = any(x["kind"] == "date" and x["value"] == d["value"] for x in found)
        dres.append(dict(id=d["id"], what=d["what"], strict=ok))
    ambiguous = [x["raw"] for x in found if x["value"] is None]
    nn = len(res)
    return dict(
        number_recall_strict=round(sum(r["strict"] for r in res) / nn, 3),
        number_recall_lenient=round(sum(r["lenient"] for r in res) / nn, 3),
        date_recall=round(sum(r["strict"] for r in dres) / len(dres), 3),
        number_misses=[f'{r["id"]} {r["what"]}' for r in res if not r["lenient"]],
        number_currency_unstated=[f'{r["id"]} {r["what"]}' for r in res if r["lenient"] and not r["strict"]],
        date_misses=[f'{r["id"]} {r["what"]}' for r in dres if not r["strict"]],
        ambiguous_flagged=ambiguous)


def shingles(words, n=4):
    return {" ".join(words[i:i + n]) for i in range(max(0, len(words) - n + 1))}


def leak(other_truth, own_truth, hyp_text, n=4):
    """Berapa persen n-gram ucapan 'pihak lain' (yang TIDAK ada di ucapan sendiri) muncul di transkrip track ini (harusnya ~0)."""
    o = shingles(norm_words(other_truth), n) - shingles(norm_words(own_truth), n)
    h = shingles(norm_words(hyp_text), n)
    return round(len(o & h) / max(1, len(o)), 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--truth", required=True); ap.add_argument("--hyp", required=True)
    ap.add_argument("--facts"); ap.add_argument("--terms"); ap.add_argument("--other")
    ap.add_argument("--json")
    a = ap.parse_args()
    truth = open(a.truth, encoding="utf-8").read(); hyp = open(a.hyp, encoding="utf-8").read()
    rw, hw = norm_words(truth), norm_words(hyp)
    out = dict(ref_words=len(rw), hyp_words=len(hw),
               WER=round(wer(rw, hw), 4), CER=round(cer(truth, hyp), 4),
               WER_number_normalized=round(wer(canon_tokens([t for t in tokenize(truth) if t not in ".!?;:,"]),
                                              canon_tokens([t for t in tokenize(hyp) if t not in ".!?;:,"])), 4))
    if a.terms: out["terms"] = eval_terms(json.load(open(a.terms, encoding="utf-8")), hyp)
    if a.facts: out["facts"] = eval_facts(json.load(open(a.facts, encoding="utf-8")), hyp)
    if a.other: out["leak_4gram_other_speakers"] = leak(open(a.other, encoding="utf-8").read(), truth, hyp)
    s = json.dumps(out, ensure_ascii=False, indent=2)
    print(s)
    if a.json: open(a.json, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    main()
