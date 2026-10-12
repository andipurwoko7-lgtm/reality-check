<#
.SYNOPSIS
  Phase 0 / STEP D - Transkripsi pertama (model small, CPU, int8) + evaluasi. SEKALI PAKAI, bukan kode produksi.

.DESCRIPTION
  Menjalankan tools\step_d_transcribe.py di venv Step C pada SATU file rekaman simulasi (suara Anda membaca naskah fiktif).
  TIDAK memasang apa pun. TIDAK memakai jaringan (model dimuat dari disk, local_files_only). TIDAK mengirim audio ke mana pun.
  Satu konfigurasi saja: language=id, beam=5, VAD aktif, tanpa prompt. Perbandingan model/prompt = Step F.

  Yang ditulis: phase0\results\step_d\ (hasil sebelumnya otomatis diarsipkan ke step_d_prev_<waktu>).
  Audio Anda TIDAK disalin dan TIDAK ikut dicatat (hanya nama berkas). Username/hostname/path profil disaring menjadi <redacted>.

  STATUS: ditulis tanpa akses Windows; BELUM PERNAH DIJALANKAN oleh penulis. Jika ada error, salin APA ADANYA.

.PARAMETER Audio
  Path berkas rekaman (m4a, wav, mp3, webm, ogg). Wajib.

.PARAMETER Notes
  Opsional. Catatan penyimpangan dari naskah (mis. "lewat giliran ke-7").

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\step_d_run.ps1 -Audio "D:\rekaman\sim_full.m4a"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Audio,
    [string]$WorkRoot = '',
    [string]$Notes = ''
)

$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$phase0 = $PSScriptRoot
if (-not $phase0) { $phase0 = (Get-Location).Path }
if (-not $WorkRoot) {
    $qual = $null
    try { $qual = Split-Path -Qualifier $phase0 } catch { }
    if (-not $qual) { $qual = $env:SystemDrive }
    $WorkRoot = Join-Path ($qual + '\') 'phase0-work'
}
$venvPy   = Join-Path $WorkRoot 'venv\Scripts\python.exe'
$modelDir = Join-Path $WorkRoot 'models\faster-whisper-small'
$script   = Join-Path $phase0 'tools\step_d_transcribe.py'
$td       = Join-Path $phase0 'test_data'
$outDir   = Join-Path $phase0 'results\step_d'

$secrets = @($env:USERNAME, $env:COMPUTERNAME, $env:USERDOMAIN, $env:USERPROFILE) | Where-Object { $_ -and $_.Length -ge 3 }
function Redact {
    param([string]$Text)
    if ($null -eq $Text) { return $null }
    $t = $Text
    foreach ($s in $secrets) { $t = [regex]::Replace($t, [regex]::Escape($s), '<redacted>', 'IgnoreCase') }
    return $t
}
function Fail-Blocked {
    param([string]$Msg)
    Write-Host ('BLOCKED: ' + $Msg) -ForegroundColor Red
    exit 2
}

if (-not (Test-Path $Audio)) { Fail-Blocked ('Berkas audio tidak ditemukan: ' + $Audio) }
if (-not (Test-Path $venvPy)) { Fail-Blocked ('venv Step C tidak ditemukan di ' + $venvPy + '. Jalankan Step C dulu.') }
if (-not (Test-Path (Join-Path $modelDir 'model.bin'))) { Fail-Blocked ('Model small tidak ditemukan di ' + $modelDir + '. Jalankan Step C dulu.') }
foreach ($f in @($script, (Join-Path $td 'ground_truth_full.txt'), (Join-Path $td 'key_facts.json'), (Join-Path $td 'key_terms.json'))) {
    if (-not (Test-Path $f)) { Fail-Blocked ('Berkas pendukung tidak ada: ' + $f + ' (ekstrak ulang ZIP terbaru).') }
}

# arsipkan hasil sebelumnya, jangan menimpa bukti
if (Test-Path (Join-Path $outDir 'step_d_results.json')) {
    $stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
    Move-Item -Path $outDir -Destination ($outDir + '_prev_' + $stamp)
}
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

Write-Host '== STEP D: transkripsi pertama (small / CPU / int8). Audio 5-6 menit biasanya selesai dalam beberapa menit. =='
$old = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
# '--notes=' + nilai: PowerShell 5.1 membuang argumen string kosong saat memanggil program native, jadi bentuk '--notes' '' gagal.
& $venvPy $script '--audio' $Audio '--model-dir' $modelDir '--out-dir' $outDir '--truth' (Join-Path $td 'ground_truth_full.txt') `
    '--facts' (Join-Path $td 'key_facts.json') '--terms' (Join-Path $td 'key_terms.json') ('--notes=' + $Notes) 2>&1 | ForEach-Object { Write-Host (Redact ($_.ToString())) }
$code = $LASTEXITCODE
$ErrorActionPreference = $old

# saring hasil sebelum dikirim
$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($n in @('step_d_results.json', 'evaluation_summary.txt')) {
    $p = Join-Path $outDir $n
    if (Test-Path $p) {
        $txt = Get-Content -Raw -Encoding UTF8 $p
        [System.IO.File]::WriteAllText($p, (Redact $txt), $enc)
    }
}
Write-Host ''
if ($code -eq 0) { Write-Host 'STATUS: PASS (pipeline selesai; kualitas ada di ringkasan di atas)' -ForegroundColor Green } else { Write-Host ('STATUS: FAIL (kode ' + $code + '). Salin error di atas APA ADANYA.') -ForegroundColor Red }
Write-Host ('Hasil: ' + $outDir)
Write-Host 'Kirim ke chat: step_d_results.json dan evaluation_summary.txt. JANGAN kirim audio.'
if ($code -eq 0) { exit 0 } else { exit 1 }
