"""Login sederhana: kata sandi di-hash (bcrypt), sesi disimpan di basis data."""
from __future__ import annotations

import hashlib
import os
import secrets
import time
from datetime import datetime, timedelta

import bcrypt

from .service import Galat, sekarang

LAMA_SESI_HARI = 7
SANDI_AWAL = os.environ.get("ADMIN_PASSWORD", "admin123")
NAMA_AWAL = os.environ.get("ADMIN_USER", "admin")
_gagal: dict[str, list[float]] = {}


def hash_sandi(sandi: str) -> str:
    return bcrypt.hashpw(sandi.encode("utf-8")[:72], bcrypt.gensalt(rounds=int(os.environ.get('BCRYPT_ROUNDS', '12')))).decode("ascii")


def cek_sandi(sandi: str, hash_: str) -> bool:
    try:
        return bcrypt.checkpw(sandi.encode("utf-8")[:72], hash_.encode("ascii"))
    except ValueError:
        return False


def buat_pengguna_awal(conn):
    if conn.execute("SELECT 1 FROM pengguna LIMIT 1").fetchone():
        return
    with conn:
        conn.execute("INSERT INTO pengguna(nama_pengguna, kata_sandi_hash, peran, dibuat) VALUES(?,?,?,?)",
                     (NAMA_AWAL, hash_sandi(SANDI_AWAL), "admin", sekarang().isoformat(timespec="seconds")))


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _cek_batas(kunci: str):
    sekarang_t = time.time()
    percobaan = [t for t in _gagal.get(kunci, []) if sekarang_t - t < 300]
    _gagal[kunci] = percobaan
    if len(percobaan) >= 5:
        raise Galat("Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam 5 menit.", 429)


def masuk(conn, nama: str, sandi: str, ip: str = "") -> tuple[str, dict]:
    nama = (nama or "").strip()
    if not nama or not sandi:
        raise Galat("Isi Nama Pengguna dan Kata Sandi.")
    kunci = f"{ip}|{nama.lower()}"
    _cek_batas(kunci)
    u = conn.execute("SELECT * FROM pengguna WHERE lower(nama_pengguna) = lower(?)", (nama,)).fetchone()
    if not u or not cek_sandi(sandi, u["kata_sandi_hash"]):
        _gagal.setdefault(kunci, []).append(time.time())
        raise Galat("Nama Pengguna atau Kata Sandi salah.", 401)
    _gagal.pop(kunci, None)
    token = secrets.token_urlsafe(32)
    with conn:
        conn.execute("DELETE FROM sesi WHERE kedaluwarsa < ?", (sekarang().isoformat(),))
        conn.execute("INSERT INTO sesi(token_hash, pengguna_id, kedaluwarsa) VALUES(?,?,?)",
                     (_hash_token(token), u["id"],
                      (sekarang() + timedelta(days=LAMA_SESI_HARI)).isoformat()))
    return token, info_pengguna(u)


def info_pengguna(u) -> dict:
    return {"id": u["id"], "nama_pengguna": u["nama_pengguna"], "peran": u["peran"],
            "sandi_awal": cek_sandi(SANDI_AWAL, u["kata_sandi_hash"])}


def pengguna_dari_token(conn, token: str | None):
    if not token:
        return None
    r = conn.execute(
        "SELECT p.*, s.kedaluwarsa FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id WHERE s.token_hash = ?",
        (_hash_token(token),)).fetchone()
    if not r or datetime.fromisoformat(r["kedaluwarsa"]) < sekarang():
        return None
    return r


def keluar(conn, token: str | None):
    if token:
        with conn:
            conn.execute("DELETE FROM sesi WHERE token_hash = ?", (_hash_token(token),))


def ganti_sandi(conn, pengguna_id: int, lama: str, baru: str):
    u = conn.execute("SELECT * FROM pengguna WHERE id = ?", (pengguna_id,)).fetchone()
    if not cek_sandi(lama or "", u["kata_sandi_hash"]):
        raise Galat("Kata Sandi lama salah.")
    if len(baru or "") < 8:
        raise Galat("Kata Sandi baru minimal 8 karakter.")
    if baru == lama:
        raise Galat("Kata Sandi baru harus berbeda dari yang lama.")
    with conn:
        conn.execute("UPDATE pengguna SET kata_sandi_hash = ? WHERE id = ?", (hash_sandi(baru), pengguna_id))
