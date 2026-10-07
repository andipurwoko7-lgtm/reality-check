"""Koneksi dan skema basis data (SQLite).

SQL ditulis sederhana (tipe TEXT/INTEGER, tanpa fitur khusus SQLite selain
PRAGMA) supaya mudah dipindahkan ke PostgreSQL. Nilai uang disimpan sebagai
TEXT desimal agar tidak ada kesalahan pembulatan floating point.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def path_db() -> str:
    return os.environ.get("INVESTOR_DB") or str(RAIZ / "data" / "investor.db")


def sambung() -> sqlite3.Connection:
    p = path_db()
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(p, timeout=30, check_same_thread=False)  # satu koneksi per permintaan
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


SKEMA = """
CREATE TABLE IF NOT EXISTS pengguna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_pengguna TEXT NOT NULL UNIQUE,
    kata_sandi_hash TEXT NOT NULL,
    peran TEXT NOT NULL DEFAULT 'admin',
    dibuat TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sesi (
    token_hash TEXT PRIMARY KEY,
    pengguna_id INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
    kedaluwarsa TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pengaturan (
    kunci TEXT PRIMARY KEY,
    nilai TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kurs_riwayat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT NOT NULL,
    jam TEXT NOT NULL,
    nilai TEXT NOT NULL,
    sumber TEXT NOT NULL DEFAULT 'manual'
);
CREATE TABLE IF NOT EXISTS investor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    tanggal_mulai TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aktif',
    catatan TEXT NOT NULL DEFAULT '',
    dibuat TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transaksi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investor_id INTEGER NOT NULL REFERENCES investor(id) ON DELETE CASCADE,
    tanggal TEXT NOT NULL,
    jenis TEXT NOT NULL,
    jumlah_usd TEXT NOT NULL,
    kurs TEXT NOT NULL,
    nilai_idr TEXT NOT NULL,
    biaya_penarikan_usd TEXT NOT NULL DEFAULT '0',
    biaya_konversi_usd TEXT NOT NULL DEFAULT '0',
    nilai_bersih_usd TEXT NOT NULL DEFAULT '0',
    biaya_transfer_idr TEXT NOT NULL DEFAULT '0',
    bersih_idr_diterima TEXT NOT NULL DEFAULT '0',
    catatan TEXT NOT NULL DEFAULT '',
    dibuat TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transaksi_investor ON transaksi(investor_id, tanggal);
CREATE TABLE IF NOT EXISTS hasil_aktual (
    tanggal TEXT PRIMARY KEY,
    persen TEXT NOT NULL,
    catatan TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS perhitungan_harian (
    investor_id INTEGER NOT NULL REFERENCES investor(id) ON DELETE CASCADE,
    tanggal TEXT NOT NULL,
    saldo_awal TEXT NOT NULL,
    tambahan TEXT NOT NULL,
    penyesuaian TEXT NOT NULL,
    penarikan TEXT NOT NULL,
    saldo_dasar TEXT NOT NULL,
    persen TEXT NOT NULL,
    sumber_persen TEXT NOT NULL,
    keuntungan TEXT NOT NULL,
    saldo_akhir TEXT NOT NULL,
    kurs TEXT NOT NULL,
    saldo_idr TEXT NOT NULL,
    total_modal_usd TEXT NOT NULL,
    total_keuntungan_usd TEXT NOT NULL,
    total_penarikan_usd TEXT NOT NULL,
    kekayaan_bersih_idr TEXT NOT NULL,
    persen_untung TEXT NOT NULL,
    PRIMARY KEY (investor_id, tanggal)
);
CREATE TABLE IF NOT EXISTS riwayat_perhitungan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waktu TEXT NOT NULL,
    alasan TEXT NOT NULL,
    jumlah_investor INTEGER NOT NULL,
    jumlah_baris INTEGER NOT NULL,
    status TEXT NOT NULL,
    pesan TEXT NOT NULL DEFAULT ''
);
"""


def buat_skema(conn: sqlite3.Connection) -> None:
    conn.executescript(SKEMA)
    conn.commit()
