#!/usr/bin/env python3
"""Bangun ground truth dari meeting_script.md (disposable). Output: test_data/ground_truth_{full,andi,others}.txt"""
import re, pathlib
d = pathlib.Path(__file__).parent / "test_data"
lines = [l for l in (d / "meeting_script.md").read_text(encoding="utf-8").splitlines()
         if re.match(r"^(ANDI|BUDI|SARI):", l)]
by = {"full": [], "andi": [], "others": []}
for l in lines:
    who, text = l.split(":", 1); text = text.strip()
    by["full"].append(text)
    by["andi" if who == "ANDI" else "others"].append(text)
for k, v in by.items():
    (d / f"ground_truth_{k}.txt").write_text("\n".join(v) + "\n", encoding="utf-8")
    print(k, len(" ".join(v).split()), "kata")
