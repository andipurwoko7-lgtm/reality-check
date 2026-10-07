"""Pengujian mesin perhitungan (tanpa basis data)."""
from datetime import date, timedelta
from decimal import Decimal as D

import pytest

from app import calc
from app.calc import Biaya, hitung_penarikan

KURS = D("16000")
PERSEN = [D(4)] * 5 + [D(2), D(0)]  # Senin..Minggu
SENIN = date(2026, 10, 5)


def trx_awal(jumlah="1000", tgl=SENIN, kurs=KURS):
    return {"tanggal": tgl, "jenis": "modal_awal", "jumlah_usd": D(jumlah),
            "nilai_idr": calc.q0(D(jumlah) * kurs)}


def garis(trx, akhir, persen=PERSEN, aktual=None, kurs=KURS):
    return calc.bangun_garis_waktu(trx, persen, aktual, lambda _t: kurs, Biaya(), akhir)


def test_hari_senin_adalah_senin():
    assert SENIN.weekday() == 0


def test_keuntungan_harian_dan_compounding():
    b = garis([trx_awal()], SENIN + timedelta(days=1))
    assert b[0]["saldo_awal"] == D("0")
    assert b[0]["saldo_dasar"] == D("1000")
    assert b[0]["keuntungan"] == D("40.00")
    assert b[0]["saldo_akhir"] == D("1040.00")
    assert b[1]["saldo_awal"] == D("1040.00")
    assert b[1]["keuntungan"] == D("41.60")
    assert b[1]["saldo_akhir"] == D("1081.60")


def test_persen_per_hari_mengikuti_pengaturan():
    b = garis([trx_awal()], SENIN + timedelta(days=6))
    assert [x["persen"] for x in b] == PERSEN
    assert [x["hari"] for x in b] == calc.NAMA_HARI
    assert b[6]["keuntungan"] == D("0.00")  # Minggu 0%
    assert b[6]["saldo_akhir"] == b[5]["saldo_akhir"]


def test_persen_tidak_ditanam_di_kode():
    b = garis([trx_awal()], SENIN, persen=[D(10)] * 7)
    assert b[0]["keuntungan"] == D("100.00")


def test_tambahan_modal_dihitung_mulai_hari_transaksi():
    tambah = {"tanggal": SENIN + timedelta(days=3), "jenis": "tambahan", "jumlah_usd": D("500"),
              "nilai_idr": D("8000000")}
    b = garis([trx_awal(), tambah], SENIN + timedelta(days=3))
    kamis = b[3]
    assert kamis["tambahan"] == D("500")
    assert kamis["saldo_dasar"] == kamis["saldo_awal"] + D("500")
    assert kamis["keuntungan"] == calc.q2(kamis["saldo_dasar"] * D("0.04"))
    # hari sebelum tambahan tidak terpengaruh
    assert b[2]["saldo_dasar"] == b[2]["saldo_awal"]
    assert kamis["total_modal_usd"] == D("1500")


def test_penarikan_mengurangi_saldo_mulai_hari_transaksi():
    r = hitung_penarikan(300, KURS)
    tarik = {"tanggal": SENIN + timedelta(days=2), "jenis": "penarikan", "jumlah_usd": D("300"),
             "nilai_idr": D(0), "bersih_idr_diterima": r["bersih_idr_diterima"]}
    b = garis([trx_awal(), tarik], SENIN + timedelta(days=2))
    rabu = b[2]
    assert rabu["saldo_dasar"] == rabu["saldo_awal"] - D("300")
    assert rabu["keuntungan"] == calc.q2(rabu["saldo_dasar"] * D("0.04"))
    assert rabu["total_penarikan_usd"] == D("300")
    assert rabu["saldo_akhir"] == rabu["saldo_dasar"] + rabu["keuntungan"]


def test_penarikan_lebih_besar_dari_saldo_ditolak():
    tarik = {"tanggal": SENIN, "jenis": "penarikan", "jumlah_usd": D("1000.01"),
             "nilai_idr": D(0), "bersih_idr_diterima": D(0)}
    with pytest.raises(calc.GalatHitung):
        garis([trx_awal(), tarik], SENIN)


def test_rumus_saldo_akhir_selalu_konsisten():
    tambah = {"tanggal": SENIN + timedelta(days=4), "jenis": "tambahan", "jumlah_usd": D("123.45"),
              "nilai_idr": D(1)}
    tarik = {"tanggal": SENIN + timedelta(days=9), "jenis": "penarikan", "jumlah_usd": D("77.77"),
             "nilai_idr": D(0), "bersih_idr_diterima": D(1)}
    b = garis([trx_awal(), tambah, tarik], SENIN + timedelta(days=60))
    assert calc.periksa_identitas(b) == []
    setoran = D("1000") + D("123.45")
    untung = sum(x["keuntungan"] for x in b)
    assert b[-1]["saldo_akhir"] == setoran - D("77.77") + untung


def test_biaya_penarikan_6_persen():
    r = hitung_penarikan(1000, KURS)
    assert r["biaya_penarikan_usd"] == D("60.00")
    assert r["saldo_setelah_biaya_usd"] == D("940.00")


def test_biaya_konversi_0_5_persen():
    r = hitung_penarikan(1000, KURS)
    assert r["biaya_konversi_usd"] == D("4.70")  # 0,5% x 940
    assert r["nilai_bersih_usd"] == D("935.30")


def test_konversi_usd_ke_rupiah_dan_biaya_transfer():
    r = hitung_penarikan(1000, KURS)
    assert r["nilai_idr"] == D("14964800")  # 935,30 x 16.000
    assert r["biaya_transfer_idr"] == D("11000")
    assert r["bersih_idr_diterima"] == D("14953800")


def test_biaya_dapat_diubah():
    r = hitung_penarikan(1000, D("15000"), Biaya(D(10), D(1), D(5000)))
    assert r["biaya_penarikan_usd"] == D("100.00")
    assert r["biaya_konversi_usd"] == D("9.00")
    assert r["nilai_bersih_usd"] == D("891.00")
    assert r["bersih_idr_diterima"] == D("891") * 15000 - 5000


def test_penarikan_kecil_tidak_menghasilkan_nilai_negatif():
    r = hitung_penarikan(D("0.50"), KURS)
    assert r["bersih_idr_diterima"] >= 0


def test_saldo_setelah_penarikan_di_garis_waktu():
    r = hitung_penarikan(500, KURS)
    tarik = {"tanggal": SENIN, "jenis": "penarikan", "jumlah_usd": D("500"),
             "nilai_idr": D(0), "bersih_idr_diterima": r["bersih_idr_diterima"]}
    b = garis([trx_awal(), tarik], SENIN)
    assert b[0]["saldo_dasar"] == D("500")
    assert b[0]["saldo_akhir"] == D("520.00")


def test_hasil_aktual_menggantikan_asumsi():
    b = garis([trx_awal()], SENIN + timedelta(days=1), aktual={SENIN: D("-1.5")})
    assert b[0]["persen"] == D("-1.5") and b[0]["sumber_persen"] == "aktual"
    assert b[0]["keuntungan"] == D("-15.00")
    assert b[1]["sumber_persen"] == "asumsi"
    assert b[1]["saldo_awal"] == D("985.00")


def test_titik_impas_belum_tercapai_di_awal():
    b = garis([trx_awal()], SENIN)
    assert calc.tanggal_tercapai(b, 0) is None  # biaya 6% + 0,5% belum tertutup


def test_titik_impas_tercapai_dan_tanggalnya_benar():
    b = garis([trx_awal()], SENIN + timedelta(days=60))
    t = calc.tanggal_tercapai(b, 0)
    assert t is not None
    idx = next(i for i, x in enumerate(b) if x["tanggal"] == t)
    # definisi: uang bersih ditarik + nilai bersih saldo >= total modal
    assert b[idx]["kekayaan_bersih_idr"] >= b[idx]["total_modal_idr"]
    assert b[idx - 1]["kekayaan_bersih_idr"] < b[idx - 1]["total_modal_idr"]


def test_titik_impas_memperhitungkan_uang_yang_sudah_ditarik():
    r = hitung_penarikan(400, KURS)
    tarik = {"tanggal": SENIN + timedelta(days=20), "jenis": "penarikan", "jumlah_usd": D("400"),
             "nilai_idr": D(0), "bersih_idr_diterima": r["bersih_idr_diterima"]}
    b = garis([trx_awal(), tarik], SENIN + timedelta(days=20))
    x = b[-1]
    assert x["kekayaan_bersih_idr"] == r["bersih_idr_diterima"] + x["nilai_bersih_cair_idr"]


def test_keuntungan_100_persen_berarti_kekayaan_dua_kali_modal():
    b = garis([trx_awal()], SENIN + timedelta(days=200))
    t = calc.tanggal_tercapai(b, 100)
    assert t is not None
    x = next(i for i in b if i["tanggal"] == t)
    assert x["kekayaan_bersih_idr"] >= 2 * x["total_modal_idr"]
    assert x["persen_untung"] >= 100
    prev = next(i for i in b if i["tanggal"] == t - timedelta(days=1))
    assert prev["kekayaan_bersih_idr"] < 2 * prev["total_modal_idr"]


def test_proyeksi_sesuai_hitungan_nyata():
    # proyeksi dari hari ke-5 harus jatuh pada tanggal yang sama dengan hitungan penuh
    penuh = garis([trx_awal()], SENIN + timedelta(days=300))
    nyata = calc.tanggal_tercapai(penuh, 100)
    sebagian = garis([trx_awal()], SENIN + timedelta(days=5))
    proy = calc.proyeksi_target(sebagian, PERSEN, Biaya(), KURS, SENIN + timedelta(days=5))
    assert abs((proy[100] - nyata).days) <= 1


def test_proyeksi_tidak_tercapai_bila_tidak_ada_keuntungan():
    b = garis([trx_awal()], SENIN + timedelta(days=3), persen=[D(0)] * 7)
    assert calc.proyeksi_target(b, [D(0)] * 7, Biaya(), KURS, SENIN)[100] is None


def test_simulasi_dan_horizon():
    h = calc.hasil_horizon(1000, SENIN, PERSEN, [7, 30])
    assert h[7]["saldo"] == garis([trx_awal()], SENIN + timedelta(days=6))[-1]["saldo_akhir"]
    assert h[30]["persen"] == (h[30]["saldo"] - 1000) / 10
    s = calc.simulasikan(1000, SENIN, SENIN + timedelta(days=29), PERSEN, KURS, Biaya())
    assert s["saldo_akhir"] == h[30]["saldo"]
    assert s["saldo_idr"] == calc.q0(h[30]["saldo"] * KURS)
