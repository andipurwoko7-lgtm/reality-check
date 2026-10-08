#!/usr/bin/env python3
"""DISPOSABLE Phase 0 PoC — parser angka/rupiah/persen/tanggal Bahasa Indonesia (deterministik, tanpa LLM).

Prinsip (dari RENCANA §10.4): jangan mengarang.
- Angka jelas + konteks eksplisit  -> fakta terstruktur.
- Mata uang tidak disebut          -> kind='plain' + flag currency_unknown (JANGAN menambah "Rp").
- Ambigu (mis. "empat sembilan lima") -> value=None + flag NEEDS_REVIEW; teks asli dipertahankan.
Bukan kode produksi.
"""
import re
from decimal import Decimal, InvalidOperation

UNITS = {"nol": 0, "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5,
         "enam": 6, "tujuh": 7, "delapan": 8, "sembilan": 9}
SPECIAL = {"sepuluh": 10, "sebelas": 11, "seratus": 100, "seribu": 1000,
           "sejuta": 10**6, "semiliar": 10**9, "setriliun": 10**12}
MULT = {"belas", "puluh", "ratus"}
SCALE = {"ribu": 10**3, "juta": 10**6, "miliar": 10**9, "milyar": 10**9, "triliun": 10**12}
MONTHS = {"januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus",
          "september", "oktober", "november", "desember"}
NUMWORDS = set(UNITS) | set(SPECIAL) | MULT | set(SCALE)
TOKEN_RE = re.compile(r"[a-z]+|\d+(?:[.,]\d+)*|%|[.!?;:,]")


class ParseError(Exception):
    pass


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


def _int_from_words(ws):
    """Parse kata bilangan bulat. Return (Decimal|None, ambiguous: bool)."""
    total, cur, pend = 0, 0, None
    seen_structure = False  # ada puluh/ratus/belas/scale/special?
    units_run = 0
    for w in ws:
        if w in UNITS:
            if pend is not None:
                return None, True  # dua unit berurutan: "empat sembilan lima"
            pend = UNITS[w]; units_run += 1
        elif w in SPECIAL:
            v = SPECIAL[w]
            if pend is not None:
                raise ParseError(w)
            seen_structure = True
            if v >= 1000:
                total += v
            else:
                cur += v
        elif w == "belas":
            if pend is None: raise ParseError(w)
            cur += 10 + pend; pend = None; seen_structure = True
        elif w == "puluh":
            if pend is None: raise ParseError(w)
            cur += pend * 10; pend = None; seen_structure = True
        elif w == "ratus":
            if pend is None: raise ParseError(w)
            cur += pend * 100; pend = None; seen_structure = True
        elif w in SCALE:
            base = cur + (pend or 0)
            if base == 0: raise ParseError(w)
            total += base * SCALE[w]; cur, pend = 0, None; seen_structure = True
        else:
            raise ParseError(w)
    total += cur + (pend or 0)
    return Decimal(total), False


def words_to_number(ws):
    """ws: list kata bilangan, boleh memuat 'koma'. Return (Decimal|None, flags)."""
    flags = []
    if "koma" in ws:
        mult = Decimal(1)
        if ws[-1] in SCALE:  # "satu koma dua lima miliar"
            mult = Decimal(SCALE[ws[-1]]); ws = ws[:-1]
        i = ws.index("koma")
        ip, dp = ws[:i], ws[i + 1:]
        if not ip or not dp or any(w not in UNITS for w in dp):
            return None, ["NEEDS_REVIEW:ambiguous_decimal"]
        iv, amb = _int_from_words(ip)
        if amb or iv is None:
            return None, ["NEEDS_REVIEW:ambiguous_digits"]
        return (iv + Decimal("0." + "".join(str(UNITS[w]) for w in dp))) * mult, flags
    v, amb = _int_from_words(ws)
    if amb:
        return None, ["NEEDS_REVIEW:ambiguous_digits"]
    return v, flags


def parse_digits(tok):
    """'1.250.000.000' -> 1250000000; '9,5' -> 9.5; '1.25' -> 1.25 (flag)."""
    flags = []
    if re.fullmatch(r"\d{1,3}(\.\d{3})+(,\d+)?", tok):
        v = Decimal(tok.replace(".", "").replace(",", "."))
        if re.fullmatch(r"\d{1,3}\.\d{3}", tok):
            flags.append("NEEDS_REVIEW:ambiguous_separator")  # 1.250 = 1250 (id) atau 1,25 (en)?
        return v, flags
    if re.fullmatch(r"\d+,\d+", tok):
        return Decimal(tok.replace(",", ".")), flags
    if re.fullmatch(r"\d+\.\d{1,2}", tok):
        return Decimal(tok), ["NEEDS_REVIEW:english_decimal"]
    if re.fullmatch(r"\d+", tok):
        return Decimal(tok), flags
    return None, ["NEEDS_REVIEW:unparsed_digits"]


def scan(tokens):
    """Return list fakta: dict(kind,value,flags,tstart,tend,raw). Span mencakup rp/rupiah/persen/%."""
    facts, i, n = [], 0, len(tokens)
    while i < n:
        t = tokens[i]
        start = i
        value, flags = None, []
        if t in NUMWORDS and t not in MULT and t not in SCALE:
            j = i
            while j < n:
                w = tokens[j]
                if w in NUMWORDS:
                    j += 1
                elif w == "koma" and j > i and j + 1 < n and tokens[j + 1] in UNITS:
                    j += 1
                else:
                    break
            try:
                value, flags = words_to_number(tokens[i:j])
            except ParseError:
                i += 1
                continue
            end = j
        elif re.fullmatch(r"\d+(?:[.,]\d+)*", t):
            value, flags = parse_digits(t)
            end = i + 1
            if end < n and tokens[end] in SCALE and value is not None:
                value *= SCALE[tokens[end]]; end += 1
        else:
            i += 1
            continue
        # konteks mata uang/persen
        kind = "plain"
        prev = tokens[start - 1] if start > 0 else ""
        nxt = tokens[end] if end < n else ""
        if prev in ("rp", "idr"):
            kind = "idr"; start -= 1
        elif prev == "usd":
            kind = "usd"; start -= 1
        if nxt == "rupiah":
            kind = "idr"; end += 1
        elif nxt in ("dolar", "usd"):
            kind = "usd"; end += 1
        elif nxt in ("persen", "%"):
            kind = "pct"; end += 1
        elif prev == "%":
            pass
        if kind == "plain" and value is not None and value >= 10**6 and not flags:
            flags = flags + ["currency_unknown"]
        # tanggal: 1..31 + nama bulan
        if kind == "plain" and value is not None and value == value.to_integral() \
                and 1 <= value <= 31 and end < n and tokens[end] in MONTHS:
            kind = "date"; facts.append(dict(kind=kind, value=f"{int(value)} {tokens[end]}", flags=flags,
                                             tstart=start, tend=end + 1, raw=" ".join(tokens[start:end + 1])))
            i = end + 1
            continue
        facts.append(dict(kind=kind, value=None if value is None else str(value.normalize() if value != value.to_integral() else int(value)),
                          flags=flags, tstart=start, tend=end, raw=" ".join(tokens[start:end])))
        i = end if end > i else i + 1
    return facts


def extract_facts(text):
    return scan(tokenize(text))


def canon_tokens(tokens):
    """Ganti setiap fakta angka dengan satu token kanonik, agar 'dua belas persen' == '12%'."""
    out, i = [], 0
    facts = sorted(scan(tokens), key=lambda f: f["tstart"])
    for f in facts:
        out.extend(tokens[i:f["tstart"]])
        out.append("#%s:%s" % (f["kind"], f["value"] if f["value"] is not None else "?" + f["raw"].replace(" ", "_")))
        i = f["tend"]
    out.extend(tokens[i:])
    return out


def _fmt_id(q):
    s = format(q.normalize(), "f")
    return s.replace(".", ",")


def display(fact):
    """Tampilan aman. idr -> 'Rp495 miliar'; plain besar -> '495 miliar' (tanpa Rp)."""
    if fact["value"] is None:
        return fact["raw"]  # biarkan teks asli
    if fact["kind"] == "date":
        return fact["value"]
    v = Decimal(fact["value"])
    if fact["kind"] == "pct":
        return _fmt_id(v) + "%"
    prefix = "Rp" if fact["kind"] == "idr" else ("US$" if fact["kind"] == "usd" else "")
    for scale, name in ((10**12, "triliun"), (10**9, "miliar"), (10**6, "juta")):
        if v >= scale:
            q = v / scale
            if len(format(q.normalize(), "f").split(".")[-1]) <= 3 or q == q.to_integral():
                return f"{prefix}{_fmt_id(q)} {name}"
    return prefix + format(int(v), ",").replace(",", ".") if v == v.to_integral() else prefix + _fmt_id(v)


if __name__ == "__main__":
    import sys
    for f in extract_facts(" ".join(sys.argv[1:]) or sys.stdin.read()):
        print(f["kind"], f["value"], f["flags"], "->", display(f))
