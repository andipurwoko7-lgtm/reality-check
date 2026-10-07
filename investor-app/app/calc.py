"""Mesin perhitungan keuangan.

Semua rumus penting ada di file ini (satu tempat) dan tidak bergantung pada
basis data maupun tampilan, sehingga mudah diuji.

Aturan pembulatan:
  * Nilai USD dibulatkan ke 2 desimal (sen), pembulatan biasa (setengah ke atas).
  * Nilai Rupiah dibulatkan ke bilangan bulat.
  * Persentase tidak dibulatkan.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal as D
from typing import Callable, Iterable

NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
KUNCI_HARI = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"]

# Target keuntungan (persen dari total modal disetor). 0 = titik impas.
TARGET_PERSEN = [0, 25, 50, 75, 100, 200]
MAKS_HARI_PROYEKSI = 3650  # 10 tahun

JENIS_MODAL = ("modal_awal", "tambahan", "penyesuaian")
JENIS_SEMUA = JENIS_MODAL + ("penarikan",)
NAMA_JENIS = {
    "modal_awal": "Modal Awal",
    "tambahan": "Tambahan Modal",
    "penyesuaian": "Penyesuaian",
    "penarikan": "Penarikan",
}


class GalatHitung(ValueError):
    """Kesalahan perhitungan dengan pesan yang mudah dipahami."""


def q2(x) -> D:
    return D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def q0(x) -> D:
    return D(x).quantize(D("1"), rounding=ROUND_HALF_UP)


def fmt_tgl(d: date) -> str:
    bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
             "Agustus", "September", "Oktober", "November", "Desember"]
    return f"{d.day} {bulan[d.month - 1]} {d.year}"


@dataclass
class Biaya:
    """Biaya penarikan. Persentase dalam satuan persen (6 = 6%)."""
    penarikan_persen: D = D("6")
    konversi_persen: D = D("0.5")
    transfer_idr: D = D("11000")


# --------------------------------------------------------------------------
# Penarikan
# --------------------------------------------------------------------------
def hitung_penarikan(jumlah_usd, kurs, biaya: Biaya | None = None) -> dict:
    """Rincian biaya penarikan.

    Jumlah kotor -> dikurangi biaya penarikan (6%) -> dikurangi biaya
    konversi (0,5% dari sisa) -> dikali kurs -> dikurangi biaya transfer.
    """
    biaya = biaya or Biaya()
    kotor = q2(jumlah_usd)
    kurs = D(kurs)
    biaya_tarik = q2(kotor * biaya.penarikan_persen / 100)
    setelah_biaya = kotor - biaya_tarik
    biaya_konv = q2(setelah_biaya * biaya.konversi_persen / 100)
    bersih_usd = setelah_biaya - biaya_konv
    nilai_idr = q0(bersih_usd * kurs)
    transfer = q0(biaya.transfer_idr) if kotor > 0 else D(0)
    mentah = nilai_idr - transfer
    bersih_idr = mentah if mentah > 0 else D(0)
    return {
        "jumlah_kotor_usd": kotor,
        "biaya_penarikan_persen": D(biaya.penarikan_persen),
        "biaya_penarikan_usd": biaya_tarik,
        "saldo_setelah_biaya_usd": setelah_biaya,
        "biaya_konversi_persen": D(biaya.konversi_persen),
        "biaya_konversi_usd": biaya_konv,
        "nilai_bersih_usd": bersih_usd,
        "kurs": kurs,
        "nilai_idr": nilai_idr,
        "biaya_transfer_idr": transfer,
        "bersih_idr_diterima": bersih_idr,
        "cukup_untuk_transfer": mentah > 0,
    }


# --------------------------------------------------------------------------
# Garis waktu saldo harian
# --------------------------------------------------------------------------
def persen_untuk(tgl: date, persen_hari: list[D], aktual: dict[date, D] | None,
                 pakai_aktual: bool = True) -> tuple[D, str]:
    if pakai_aktual and aktual and tgl in aktual:
        return D(aktual[tgl]), "aktual"
    return D(persen_hari[tgl.weekday()]), "asumsi"


def bangun_garis_waktu(
    transaksi: Iterable[dict],
    persen_hari: list[D],
    aktual: dict[date, D] | None,
    kurs_pada: Callable[[date], D],
    biaya: Biaya,
    tgl_akhir: date,
    pakai_aktual: bool = True,
) -> list[dict]:
    """Hitung saldo harian satu investor.

    `transaksi`: dict berisi tanggal (date), jenis, jumlah_usd, nilai_idr
    (untuk setoran), bersih_idr_diterima (untuk penarikan).

    Urutan tiap hari:
        saldo dasar = saldo awal + tambahan modal + penyesuaian - penarikan
        keuntungan  = saldo dasar x persen hari itu
        saldo akhir = saldo dasar + keuntungan
    Jadi tambahan modal dihitung mulai hari transaksi, dan penarikan
    mengurangi saldo mulai hari transaksi.
    """
    per_hari: dict[date, list[dict]] = {}
    for t in transaksi:
        per_hari.setdefault(t["tanggal"], []).append(t)
    if not per_hari:
        return []
    mulai = min(per_hari)
    if tgl_akhir < mulai:
        return []

    baris: list[dict] = []
    saldo = D(0)
    modal_usd = D(0)
    modal_idr = D(0)
    tarik_kotor_kum = D(0)
    tarik_bersih_idr_kum = D(0)
    tgl = mulai
    while tgl <= tgl_akhir:
        trx = per_hari.get(tgl, [])
        tambahan = sum((D(t["jumlah_usd"]) for t in trx
                        if t["jenis"] in ("modal_awal", "tambahan")), D(0))
        tambah_idr = sum((D(t["nilai_idr"]) for t in trx
                          if t["jenis"] in ("modal_awal", "tambahan")), D(0))
        penyesuaian = sum((D(t["jumlah_usd"]) for t in trx
                           if t["jenis"] == "penyesuaian"), D(0))
        tarik = sum((D(t["jumlah_usd"]) for t in trx
                     if t["jenis"] == "penarikan"), D(0))
        tarik_bersih = sum((D(t["bersih_idr_diterima"]) for t in trx
                            if t["jenis"] == "penarikan"), D(0))
        saldo_awal = saldo
        dasar = saldo_awal + tambahan + penyesuaian - tarik
        if dasar < 0:
            raise GalatHitung(
                f"Saldo tidak cukup pada {fmt_tgl(tgl)}: transaksi pada tanggal "
                f"tersebut membuat saldo menjadi negatif.")
        persen, sumber = persen_untuk(tgl, persen_hari, aktual, pakai_aktual)
        untung = q2(dasar * persen / 100)
        akhir = dasar + untung
        kurs = D(kurs_pada(tgl))

        modal_usd += tambahan
        modal_idr += tambah_idr
        tarik_kotor_kum += tarik
        tarik_bersih_idr_kum += tarik_bersih
        cair = hitung_penarikan(akhir, kurs, biaya)["bersih_idr_diterima"] if akhir > 0 else D(0)
        kekayaan = tarik_bersih_idr_kum + cair
        untung_bersih = kekayaan - modal_idr
        baris.append({
            "tanggal": tgl,
            "hari": NAMA_HARI[tgl.weekday()],
            "saldo_awal": saldo_awal,
            "tambahan": tambahan,
            "penyesuaian": penyesuaian,
            "penarikan": tarik,
            "saldo_dasar": dasar,
            "persen": persen,
            "sumber_persen": sumber,
            "keuntungan": untung,
            "saldo_akhir": akhir,
            "kurs": kurs,
            "saldo_idr": q0(akhir * kurs),
            "total_modal_usd": modal_usd,
            "total_modal_idr": modal_idr,
            "total_penarikan_usd": tarik_kotor_kum,
            "total_penarikan_bersih_idr": tarik_bersih_idr_kum,
            "total_keuntungan_usd": akhir + tarik_kotor_kum - modal_usd,
            "nilai_bersih_cair_idr": cair,
            "kekayaan_bersih_idr": kekayaan,
            "untung_bersih_idr": untung_bersih,
            "persen_untung": (untung_bersih / modal_idr * 100) if modal_idr > 0 else D(0),
        })
        saldo = akhir
        tgl += timedelta(days=1)
    return baris


def periksa_identitas(baris: list[dict]) -> list[str]:
    """Pemeriksaan internal: saldo hanya boleh berubah karena transaksi
    atau keuntungan yang tercatat."""
    masalah = []
    prev = None
    for b in baris:
        if b["saldo_awal"] + b["tambahan"] + b["penyesuaian"] - b["penarikan"] != b["saldo_dasar"]:
            masalah.append(f"{b['tanggal']}: saldo dasar tidak cocok")
        if b["saldo_dasar"] + b["keuntungan"] != b["saldo_akhir"]:
            masalah.append(f"{b['tanggal']}: saldo akhir tidak cocok")
        if prev is not None and prev["saldo_akhir"] != b["saldo_awal"]:
            masalah.append(f"{b['tanggal']}: saldo awal berbeda dari saldo akhir hari sebelumnya")
        if b["saldo_akhir"] < 0:
            masalah.append(f"{b['tanggal']}: saldo negatif")
        prev = b
    return masalah


# --------------------------------------------------------------------------
# Titik impas & target keuntungan
# --------------------------------------------------------------------------
def _ambang(b: dict, target: int) -> D:
    return b["total_modal_idr"] * (100 + D(target)) / 100


def _tercapai(b: dict, target: int) -> bool:
    return b["total_modal_idr"] > 0 and b["kekayaan_bersih_idr"] >= _ambang(b, target)


def tanggal_tercapai(baris: list[dict], target: int) -> date | None:
    """Tanggal awal rentetan hari (sampai hari terakhir) yang memenuhi target.

    Jika hari terakhir belum memenuhi target, hasilnya None (BELUM TERCAPAI).
    """
    if not baris or not _tercapai(baris[-1], target):
        return None
    i = len(baris) - 1
    while i > 0 and _tercapai(baris[i - 1], target):
        i -= 1
    return baris[i]["tanggal"]


def proyeksi_target(baris: list[dict], persen_hari: list[D], biaya: Biaya,
                    kurs: D, hari_ini: date, target_list=TARGET_PERSEN,
                    maks_hari: int = MAKS_HARI_PROYEKSI) -> dict[int, date | None]:
    """Perkiraan tanggal target tercapai bila tidak ada transaksi baru dan
    persentase mengikuti asumsi harian. Memakai float (hanya perkiraan)."""
    hasil: dict[int, date | None] = {t: None for t in target_list}
    if not baris:
        return hasil
    akhir = baris[-1]
    modal = float(akhir["total_modal_idr"])
    if modal <= 0:
        return hasil
    saldo = float(akhir["saldo_akhir"])
    tarik_bersih = float(akhir["total_penarikan_bersih_idr"])
    # Jika pertumbuhan satu pekan tidak positif, target tidak akan tercapai.
    pekan = 1.0
    for p in persen_hari:
        pekan *= 1 + float(p) / 100
    if pekan <= 1.0 or saldo <= 0:
        return hasil
    kurs_f = float(kurs)
    p6 = float(biaya.penarikan_persen) / 100
    pk = float(biaya.konversi_persen) / 100
    tf = float(biaya.transfer_idr)
    sisa = set(target_list)
    tgl = akhir["tanggal"]  # proyeksi mulai dari hari setelah baris terakhir
    for _ in range(maks_hari):
        tgl += timedelta(days=1)
        saldo *= 1 + float(persen_hari[tgl.weekday()]) / 100
        net = saldo * (1 - p6) * (1 - pk) * kurs_f - tf
        kekayaan = tarik_bersih + (net if net > 0 else 0.0)
        for t in list(sisa):
            if kekayaan >= modal * (100 + t) / 100:
                hasil[t] = tgl
                sisa.discard(t)
        if not sisa:
            break
    return hasil


def ringkas_target(baris: list[dict], persen_hari: list[D], biaya: Biaya,
                   kurs: D, hari_ini: date) -> dict:
    """Status titik impas dan target 25/50/75/100/200% untuk satu investor."""
    proyeksi = None
    hasil = {}
    for t in TARGET_PERSEN:
        tgl = tanggal_tercapai(baris, t)
        item = {"target": t, "tercapai": tgl is not None, "tanggal": None,
                "diperkirakan": False, "hari_menuju": None}
        if tgl is not None:
            item["tanggal"] = tgl
            item["hari_menuju"] = 0
        else:
            if proyeksi is None:
                proyeksi = proyeksi_target(baris, persen_hari, biaya, kurs, hari_ini)
            tp = proyeksi.get(t)
            if tp is not None:
                item["tanggal"] = tp
                item["diperkirakan"] = True
                item["hari_menuju"] = max(0, (tp - hari_ini).days)
        hasil[t] = item
    return hasil


# --------------------------------------------------------------------------
# Simulasi sederhana (satu modal, tanpa transaksi lain)
# --------------------------------------------------------------------------
def simulasikan(modal_usd, tgl_mulai: date, tgl_akhir: date, persen_hari: list[D],
                kurs, biaya: Biaya, aktual: dict[date, D] | None = None,
                pakai_aktual: bool = False) -> dict:
    modal_usd = q2(modal_usd)
    kurs = D(kurs)
    trx = [{
        "tanggal": tgl_mulai, "jenis": "modal_awal", "jumlah_usd": modal_usd,
        "nilai_idr": q0(modal_usd * kurs),
    }]
    baris = bangun_garis_waktu(trx, persen_hari, aktual, lambda _d: kurs, biaya,
                               tgl_akhir, pakai_aktual)
    akhir = baris[-1]
    target = ringkas_target(baris, persen_hari, biaya, kurs, tgl_akhir)
    return {
        "baris": baris,
        "saldo_akhir": akhir["saldo_akhir"],
        "total_keuntungan": akhir["saldo_akhir"] - modal_usd,
        "persen_keuntungan": ((akhir["saldo_akhir"] - modal_usd) / modal_usd * 100) if modal_usd > 0 else D(0),
        "saldo_idr": akhir["saldo_idr"],
        "nilai_bersih_cair_idr": akhir["nilai_bersih_cair_idr"],
        "titik_impas": target[0],
        "untung_100": target[100],
        "target": target,
    }


def hasil_horizon(modal_usd, tgl_mulai: date, persen_hari: list[D], horizon: list[int]) -> dict[int, dict]:
    """Saldo & keuntungan kotor setelah N hari (hari ke-N dihitung penuh)."""
    modal_usd = q2(modal_usd)
    keluaran = {}
    saldo = modal_usd
    maks = max(horizon)
    hs = set(horizon)
    tgl = tgl_mulai
    for i in range(1, maks + 1):
        saldo = saldo + q2(saldo * D(persen_hari[tgl.weekday()]) / 100)
        if i in hs:
            keluaran[i] = {
                "hari": i,
                "saldo": saldo,
                "keuntungan": saldo - modal_usd,
                "persen": ((saldo - modal_usd) / modal_usd * 100) if modal_usd > 0 else D(0),
            }
        tgl += timedelta(days=1)
    return keluaran
