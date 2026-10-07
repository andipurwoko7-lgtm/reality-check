"""Server aplikasi (FastAPI). Semua perhitungan dilakukan di sisi server."""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from fastapi import Body, Depends, FastAPI, File, Query, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import auth, service
from .calc import GalatHitung
from .db import buat_skema, sambung
from .service import Galat

STATIS = Path(__file__).resolve().parent / "static"
NAMA_COOKIE = "sesi_pelacak"


def _enc(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(f"Tipe tidak dikenal: {type(o)}")


class JSONRespon(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, default=_enc, ensure_ascii=False, allow_nan=False).encode("utf-8")


@asynccontextmanager
async def siklus(_app):
    conn = sambung()
    try:
        buat_skema(conn)
        auth.buat_pengguna_awal(conn)
        service.isi_data_contoh(conn)
    finally:
        conn.close()
    yield


app = FastAPI(title="Pelacak Modal Investor", default_response_class=JSONRespon, lifespan=siklus,
              docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(Galat)
async def _galat(_r: Request, e: Galat):
    return JSONRespon({"detail": e.pesan}, status_code=e.kode)


@app.exception_handler(GalatHitung)
async def _galat_hitung(_r: Request, e: GalatHitung):
    return JSONRespon({"detail": str(e)}, status_code=400)


@app.exception_handler(RequestValidationError)
async def _galat_validasi(_r: Request, _e: RequestValidationError):
    return JSONRespon({"detail": "Data yang dikirim tidak lengkap atau tidak sesuai. Periksa isian Anda."},
                      status_code=400)


def db():
    conn = sambung()
    try:
        yield conn
    finally:
        conn.close()


def pengguna(request: Request, conn=Depends(db)):
    u = auth.pengguna_dari_token(conn, request.cookies.get(NAMA_COOKIE))
    if not u:
        raise Galat("Sesi berakhir. Silakan masuk kembali.", 401)
    return u


# ---------------------------------------------------------------- login
@app.post("/api/masuk")
def masuk(request: Request, response: Response, body: dict = Body(...), conn=Depends(db)):
    ip = request.client.host if request.client else ""
    token, info = auth.masuk(conn, body.get("nama_pengguna"), body.get("kata_sandi"), ip)
    response.set_cookie(NAMA_COOKIE, token, httponly=True, samesite="lax",
                        max_age=auth.LAMA_SESI_HARI * 86400, secure=request.url.scheme == "https")
    return info


@app.post("/api/keluar")
def keluar(request: Request, response: Response, conn=Depends(db)):
    auth.keluar(conn, request.cookies.get(NAMA_COOKIE))
    response.delete_cookie(NAMA_COOKIE)
    return {"ok": True}


@app.get("/api/saya")
def saya(u=Depends(pengguna)):
    return auth.info_pengguna(u)


@app.post("/api/ganti-sandi")
def ganti_sandi(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    auth.ganti_sandi(conn, u["id"], body.get("sandi_lama"), body.get("sandi_baru"))
    return {"ok": True, "pesan": "Kata Sandi berhasil diganti."}


# ---------------------------------------------------------------- dashboard & investor
@app.get("/api/dashboard")
def dashboard(u=Depends(pengguna), conn=Depends(db)):
    return service.dashboard(conn)


@app.get("/api/investor")
def investor_daftar(u=Depends(pengguna), conn=Depends(db)):
    return {"investor": service.daftar_investor(conn), "kode_berikutnya": service.kode_berikutnya(conn),
            "kurs": service.tampil_pengaturan(conn)}


@app.post("/api/investor")
def investor_tambah(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.tambah_investor(conn, body)


@app.get("/api/investor/{iid}")
def investor_detail(iid: int, u=Depends(pengguna), conn=Depends(db)):
    return service.detail_investor(conn, iid)


@app.put("/api/investor/{iid}")
def investor_ubah(iid: int, body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.ubah_investor(conn, iid, body)


@app.delete("/api/investor/{iid}")
def investor_hapus(iid: int, u=Depends(pengguna), conn=Depends(db)):
    return service.hapus_investor(conn, iid)


# ---------------------------------------------------------------- transaksi
@app.post("/api/transaksi/modal")
def modal_tambah(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.tambah_modal(conn, body)


@app.put("/api/transaksi/{tid}")
def transaksi_ubah(tid: int, body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.ubah_transaksi(conn, tid, body)


@app.delete("/api/transaksi/{tid}")
def transaksi_hapus(tid: int, u=Depends(pengguna), conn=Depends(db)):
    return service.hapus_transaksi(conn, tid)


@app.get("/api/transaksi")
def transaksi_daftar(investor_id: int | None = None, dari: str | None = None, sampai: str | None = None,
                     jenis: str | None = None, q: str | None = None,
                     u=Depends(pengguna), conn=Depends(db)):
    return {"transaksi": service.riwayat_transaksi(conn, investor_id=investor_id, dari=dari or None,
                                                   sampai=sampai or None, jenis=jenis or None, q=q or None)}


@app.post("/api/penarikan/pratinjau")
def penarikan_pratinjau(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    body = dict(body)
    if not body.get("tanggal"):
        body["tanggal"] = service.hari_ini().isoformat()
    return service.pratinjau_penarikan(conn, body)


@app.post("/api/penarikan")
def penarikan_simpan(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.simpan_penarikan(conn, body)


# ---------------------------------------------------------------- perhitungan harian & grafik
@app.get("/api/harian")
def harian(tanggal: str | None = None, u=Depends(pengguna), conn=Depends(db)):
    tgl = service.ambil_tanggal({"t": tanggal}, "t", "Tanggal", wajib=False, bawaan=service.hari_ini())
    return service.harian_per_tanggal(conn, tgl)


@app.get("/api/harian/investor/{iid}")
def harian_inv(iid: int, dari: str | None = None, sampai: str | None = None,
               u=Depends(pengguna), conn=Depends(db)):
    d = service.ambil_tanggal({"t": dari}, "t", "Tanggal awal", wajib=False)
    s = service.ambil_tanggal({"t": sampai}, "t", "Tanggal akhir", wajib=False)
    return service.harian_investor(conn, iid, d, s)


@app.get("/api/grafik")
def grafik(investor_ids: str | None = None, dari: str | None = None, sampai: str | None = None,
           status: str | None = None, u=Depends(pengguna), conn=Depends(db)):
    ids = None
    if investor_ids:
        try:
            ids = {int(x) for x in investor_ids.split(",") if x.strip()}
        except ValueError:
            raise Galat("Pilihan investor tidak valid.")
    d = service.ambil_tanggal({"t": dari}, "t", "Tanggal awal", wajib=False)
    s = service.ambil_tanggal({"t": sampai}, "t", "Tanggal akhir", wajib=False)
    return service.data_grafik(conn, investor_ids=ids, dari=d, sampai=s, status=status)


# ---------------------------------------------------------------- pengaturan & kurs
@app.get("/api/pengaturan")
def pengaturan_baca(u=Depends(pengguna), conn=Depends(db)):
    return service.tampil_pengaturan(conn)


@app.put("/api/pengaturan")
def pengaturan_simpan(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.simpan_pengaturan(conn, body)


@app.post("/api/kurs")
def kurs_simpan(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.simpan_kurs(conn, body)


@app.post("/api/kurs/perbarui")
def kurs_perbarui(u=Depends(pengguna), conn=Depends(db)):
    return service.perbarui_kurs_online(conn)


@app.get("/api/kurs/riwayat")
def kurs_riwayat(u=Depends(pengguna), conn=Depends(db)):
    return {"riwayat": service.riwayat_kurs(conn)}


# ---------------------------------------------------------------- simulator, skenario, aktual
@app.post("/api/simulator")
def simulator(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.jalankan_simulator(conn, body)


@app.post("/api/skenario")
def skenario(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.analisis_skenario(conn, body)


@app.get("/api/aktual")
def aktual_daftar(u=Depends(pengguna), conn=Depends(db)):
    return {"aktual": service.daftar_aktual(conn)}


@app.post("/api/aktual")
def aktual_simpan(body: dict = Body(...), u=Depends(pengguna), conn=Depends(db)):
    return service.simpan_aktual(conn, body)


@app.delete("/api/aktual/{tanggal}")
def aktual_hapus(tanggal: str, u=Depends(pengguna), conn=Depends(db)):
    return service.hapus_aktual(conn, tanggal)


@app.get("/api/aktual/perbandingan")
def aktual_banding(investor_id: int | None = None, u=Depends(pengguna), conn=Depends(db)):
    return service.perbandingan_aktual(conn, investor_id)


# ---------------------------------------------------------------- cadangan
def _unduh(isi: bytes | str, nama: str, tipe: str) -> Response:
    data = isi.encode("utf-8") if isinstance(isi, str) else isi
    return Response(data, media_type=tipe, headers={"Content-Disposition": f'attachment; filename="{nama}"'})


@app.get("/api/cadangan/json")
def cadangan_json(u=Depends(pengguna), conn=Depends(db)):
    nama = f"cadangan-pelacak-modal-{service.hari_ini().isoformat()}.json"
    return _unduh(json.dumps(service.ekspor_json(conn), ensure_ascii=False, indent=1), nama, "application/json")


@app.get("/api/cadangan/csv")
def cadangan_csv(tabel: str = Query("transaksi"), u=Depends(pengguna), conn=Depends(db)):
    return _unduh(service.ekspor_csv(conn, tabel), f"{tabel}-{service.hari_ini().isoformat()}.csv",
                  "text/csv; charset=utf-8")


@app.get("/api/cadangan/xlsx")
def cadangan_xlsx(u=Depends(pengguna), conn=Depends(db)):
    return _unduh(service.ekspor_xlsx(conn), f"pelacak-modal-{service.hari_ini().isoformat()}.xlsx",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.post("/api/cadangan/impor")
def cadangan_impor(berkas: UploadFile = File(...), u=Depends(pengguna), conn=Depends(db)):
    mentah = berkas.file.read()
    if len(mentah) > 50_000_000:
        raise Galat("File terlalu besar.")
    try:
        isi = json.loads(mentah.decode("utf-8-sig"))
    except (ValueError, UnicodeDecodeError):
        raise Galat("File tidak dapat dibaca. Pastikan memilih file cadangan berformat JSON.")
    return service.impor_json(conn, isi)


@app.get("/api/pemeriksaan")
def pemeriksaan(u=Depends(pengguna), conn=Depends(db)):
    hasil = service.periksa_integritas(conn)
    hasil["riwayat"] = [dict(r) for r in conn.execute(
        "SELECT * FROM riwayat_perhitungan ORDER BY id DESC LIMIT 10")]
    return hasil


# ---------------------------------------------------------------- tampilan
app.mount("/static", StaticFiles(directory=STATIS), name="static")


@app.get("/", include_in_schema=False)
def beranda():
    return FileResponse(STATIS / "index.html", headers={"Cache-Control": "no-cache"})
