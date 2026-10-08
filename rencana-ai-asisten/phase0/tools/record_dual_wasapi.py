#!/usr/bin/env python3
"""DISPOSABLE Phase 0 PoC — OPSI D: rekam mic + loopback audio sistem Windows (WASAPI) ke 2 file WAV terpisah.

STATUS: >>> BELUM DIUJI <<<  Ditulis tanpa akses Windows. API PyAudioWPatch dipakai sesuai dokumentasinya,
tetapi belum pernah dijalankan oleh penulis. Perlakukan sebagai titik awal uji, bukan bukti.

Pasang (Windows):  pip install PyAudioWPatch
Jalankan:          python record_dual_wasapi.py --seconds 60 --out ..\\results\\wasapi_test
Hasil:             <out>_mic.wav (mikrofon default) dan <out>_system.wav (loopback output default)
Catatan: loopback menangkap perangkat OUTPUT DEFAULT Windows. Jika Zoom diarahkan ke perangkat lain,
audionya TIDAK masuk.
"""
import argparse, time, wave
import pyaudiowpatch as pyaudio


def open_stream(p, dev, frames, sink):
    ch = int(dev["maxInputChannels"]); rate = int(dev["defaultSampleRate"])
    wf = wave.open(sink, "wb"); wf.setnchannels(ch); wf.setsampwidth(2); wf.setframerate(rate)

    def cb(in_data, frame_count, time_info, status):
        wf.writeframes(in_data)
        return (in_data, pyaudio.paContinue)

    st = p.open(format=pyaudio.paInt16, channels=ch, rate=rate, input=True, input_device_index=dev["index"],
                frames_per_buffer=frames, stream_callback=cb)
    return st, wf, f'{dev["name"]} ({ch}ch, {rate}Hz)'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=int, default=30)
    ap.add_argument("--out", default="wasapi_test")
    a = ap.parse_args()
    with pyaudio.PyAudio() as p:
        wasapi = p.get_host_api_info_by_type(pyaudio.paWASAPI)
        spk = p.get_device_info_by_index(wasapi["defaultOutputDevice"])
        if not spk.get("isLoopbackDevice"):
            for lb in p.get_loopback_device_info_generator():
                if spk["name"] in lb["name"]:
                    spk = lb
                    break
            else:
                raise SystemExit("Loopback untuk output default tidak ditemukan: " + spk["name"])
        mic = p.get_device_info_by_index(wasapi["defaultInputDevice"])
        s1, w1, d1 = open_stream(p, mic, 1024, a.out + "_mic.wav")
        s2, w2, d2 = open_stream(p, spk, 1024, a.out + "_system.wav")
        print("MIC   :", d1)
        print("SISTEM:", d2)
        print(f"Merekam {a.seconds} detik… (Ctrl+C untuk berhenti lebih awal)")
        try:
            time.sleep(a.seconds)
        except KeyboardInterrupt:
            pass
        for s, w in ((s1, w1), (s2, w2)):
            s.stop_stream(); s.close(); w.close()
        print("Selesai ->", a.out + "_mic.wav", a.out + "_system.wav")


if __name__ == "__main__":
    main()
