#!/usr/bin/env bash
# Menjalankan aplikasi. Buka http://localhost:8000 di browser.
cd "$(dirname "$0")"
exec python3 -m uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
