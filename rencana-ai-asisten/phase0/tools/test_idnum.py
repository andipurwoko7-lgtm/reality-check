#!/usr/bin/env python3
"""Tes untuk idnum.py (disposable). Jalankan: python3 test_idnum.py"""
import unittest
from idnum import extract_facts, display, canon_tokens, tokenize


def one(text):
    fs = extract_facts(text)
    assert len(fs) == 1, (text, fs)
    return fs[0]


class T(unittest.TestCase):
    def test_idr_words(self):
        f = one("empat ratus sembilan puluh lima miliar rupiah")
        self.assertEqual((f["kind"], f["value"]), ("idr", "495000000000"))
        self.assertEqual(display(f), "Rp495 miliar")

    def test_pct(self):
        self.assertEqual((one("dua belas persen")["kind"], one("dua belas persen")["value"]), ("pct", "12"))
        self.assertEqual(one("tujuh puluh dua persen")["value"], "72")

    def test_decimals(self):
        f = one("sembilan koma lima persen"); self.assertEqual((f["value"], display(f)), ("9.5", "9,5%"))
        self.assertEqual(one("nol koma lima persen")["value"], "0.5")
        f = one("satu koma dua lima miliar rupiah"); self.assertEqual((f["value"], display(f)), ("1250000000", "Rp1,25 miliar"))
        f = one("dua koma tiga lima triliun rupiah"); self.assertEqual((f["value"], display(f)), ("2350000000000", "Rp2,35 triliun"))

    def test_plain_numbers(self):
        self.assertEqual(one("dua ribu dua puluh enam")["value"], "2026")
        self.assertEqual(one("seribu lima ratus")["value"], "1500")
        self.assertEqual(one("sejuta")["value"], "1000000")
        self.assertEqual(one("lima belas")["value"], "15")
        self.assertEqual(one("sebelas")["value"], "11")
        self.assertEqual(one("seratus lima puluh basis poin")["value"], "150")
        self.assertEqual(one("seratus dua puluh miliar rupiah")["value"], "120000000000")

    def test_currency_not_invented(self):
        f = one("empat ratus sembilan puluh lima miliar")
        self.assertEqual(f["kind"], "plain"); self.assertIn("currency_unknown", f["flags"])
        self.assertEqual(display(f), "495 miliar")  # tanpa Rp
        f = one("495 miliar"); self.assertEqual(f["kind"], "plain"); self.assertEqual(display(f), "495 miliar")

    def test_ambiguous_digits_kept_raw(self):
        f = one("empat sembilan lima")
        self.assertIsNone(f["value"]); self.assertIn("NEEDS_REVIEW:ambiguous_digits", f["flags"])
        self.assertEqual(display(f), "empat sembilan lima")

    def test_digit_forms(self):
        self.assertEqual((one("Rp495 miliar")["kind"], one("Rp495 miliar")["value"]), ("idr", "495000000000"))
        self.assertEqual(one("Rp 1.250.000.000")["value"], "1250000000")
        self.assertEqual((one("12%")["kind"], one("12%")["value"]), ("pct", "12"))
        f = one("9,5 persen"); self.assertEqual(f["value"], "9.5")
        f = one("1.250"); self.assertIn("NEEDS_REVIEW:ambiguous_separator", f["flags"])

    def test_dates(self):
        f = one("tanggal dua belas Oktober"); self.assertEqual((f["kind"], f["value"]), ("date", "12 oktober"))
        self.assertEqual(one("12 Oktober")["kind"], "date")

    def test_sentence_boundary(self):
        fs = extract_facts("tujuh. Lima orang")
        self.assertEqual([f["value"] for f in fs], ["7", "5"])

    def test_invalid_structure_ignored(self):
        self.assertEqual(extract_facts("belas puluh"), [])

    def test_canon_equivalence(self):
        a = canon_tokens(tokenize("rate dua belas persen"))
        b = canon_tokens(tokenize("rate 12%"))
        self.assertEqual(a, b)
        a = canon_tokens(tokenize("empat ratus sembilan puluh lima miliar rupiah"))
        b = canon_tokens(tokenize("Rp495 miliar"))
        self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main(verbosity=2)
