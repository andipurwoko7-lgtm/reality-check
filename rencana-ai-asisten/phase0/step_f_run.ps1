<#
.SYNOPSIS
  Phase 0 / STEP F - Benchmark terkendali pada SATU rekaman (rekaman Step D). SEKALI PAKAI, bukan kode produksi.

.DESCRIPTION
  Urutan: small -> medium (-> large hanya jika Anda minta lewat -Large). Per model, 3 varian pada audio yang sama:
    v0 = bahasa id, tanpa prompt (sama dengan Step D)   v1 = id + prompt glosarium   v2 = bahasa auto, tanpa prompt
  Satu-satunya akses jaringan: mengunduh model yang belum ada (repo resmi di Hugging Face, SHA-256 diverifikasi).
  Model medium sekitar 1.5 GB (perkiraan ~20 menit pada kecepatan Step C). Inferensi lokal, CPU, int8.
  Audio TIDAK disalin, TIDAK diunggah. Username/hostname disaring menjadi <redacted> pada berkas hasil.

  Yang ditulis: phase0\results\step_f\ (hasil sebelumnya otomatis diarsipkan ke step_f_prev_<waktu>).
  STATUS: ditulis tanpa akses Windows; BELUM PERNAH DIJALANKAN oleh penulis. Jika ada error, salin APA ADANYA.

.PARAMETER Audio
  Path rekaman Step D (WAJIB, file yang sama agar perbandingan adil).

.PARAMETER Large
  Opsional: 'large-v3' (Systran) atau 'large-v3-turbo' (repo pihak ketiga mobiuslabsgmbh - hanya setelah persetujuan eksplisit).
  Kosong = tidak ada model besar.

.PARAMETER MaxRtfToContinue
  Model yang lebih berat hanya dijalankan jika RTF varian v0 model sebelumnya <= nilai ini (default 1.0).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\step_f_run.ps1 -Audio "D:\rekaman\sim_full.m4a"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Audio,
    [string]$WorkRoot = '',
    [string]$Large = '',
    [double]$MaxRtfToContinue = 1.0,
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
$venvPy = Join-Path $WorkRoot 'venv\Scripts\python.exe'
$script = Join-Path $phase0 'tools\step_f_bench.py'
$td     = Join-Path $phase0 'test_data'
$outDir = Join-Path $phase0 'results\step_f'

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
function Run-Py {
    param([string[]]$PyArgs)
    $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & $venvPy $script @PyArgs 2>&1 | ForEach-Object { Write-Host (Redact ($_.ToString())) }
    $c = $LASTEXITCODE
    $ErrorActionPreference = $old
    return $c
}

if (-not (Test-Path $Audio)) { Fail-Blocked ('Berkas audio tidak ditemukan: ' + $Audio) }
if (-not (Test-Path $venvPy)) { Fail-Blocked ('venv Step C tidak ditemukan di ' + $venvPy + '. Jalankan Step C dulu.') }
if (-not (Test-Path (Join-Path $WorkRoot 'models\faster-whisper-small\model.bin'))) { Fail-Blocked 'Model small belum ada (Step C).' }
if ($Large -and ($Large -ne 'large-v3') -and ($Large -ne 'large-v3-turbo')) { Fail-Blocked ('-Large hanya boleh large-v3 atau large-v3-turbo, bukan: ' + $Large) }
foreach ($f in @($script, (Join-Path $td 'ground_truth_full.txt'), (Join-Path $td 'key_facts.json'), (Join-Path $td 'key_terms.json'))) {
    if (-not (Test-Path $f)) { Fail-Blocked ('Berkas pendukung tidak ada: ' + $f + ' (ekstrak ulang ZIP terbaru).') }
}

if (Test-Path $outDir) {
    $stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
    Move-Item -Path $outDir -Destination ($outDir + '_prev_' + $stamp)
}
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$models = @('small', 'medium')
if ($Large) { $models += $Large }
$ran = @()
$statusLines = @()
$prevRtf = $null
foreach ($m in $models) {
    if ($null -ne $prevRtf -and $prevRtf -gt $MaxRtfToContinue) {
        Write-Host ('LEWATI ' + $m + ': RTF model sebelumnya ' + $prevRtf + ' > batas ' + $MaxRtfToContinue + ' (hardware dinilai belum layak).') -ForegroundColor Yellow
        $statusLines += ($m + ': SKIPPED (RTF sebelumnya terlalu tinggi)')
        continue
    }
    $mDir = Join-Path $WorkRoot ('models\faster-whisper-' + $m)
    if (-not (Test-Path (Join-Path $mDir 'model.bin'))) {
        $free = (Get-PSDrive -Name ($WorkRoot.Substring(0, 1))).Free
        if ($free -lt 8GB) { Fail-Blocked ('Ruang disk kosong kurang dari 8 GB di drive ' + $WorkRoot.Substring(0, 1)) }
        Write-Host ('== Unduh model ' + $m + ' (bisa belasan menit; jangan ditutup) ==')
        $c = Run-Py @('download', '--model', $m, '--model-dir', $mDir, '--out', (Join-Path $outDir ('download_' + $m + '.json')))
        if ($c -ne 0) { $statusLines += ($m + ': download gagal (kode ' + $c + ')'); Write-Host ('STATUS ' + $m + ': download gagal (kode ' + $c + '). Salin error di atas APA ADANYA.') -ForegroundColor Red; break }
    }
    Write-Host ('== Benchmark ' + $m + ' (3 varian, CPU/int8) ==')
    $c = Run-Py @('bench', '--model', $m, '--model-dir', $mDir, '--audio', $Audio, '--out-dir', $outDir, '--td', $td)
    if ($c -ne 0) { $statusLines += ($m + ': bench gagal (kode ' + $c + ')'); break }
    $statusLines += ($m + ': PASS')
    $ran += $m
    $bj = Join-Path $outDir ('bench_' + $m + '.json')
    try { $prevRtf = [double](Get-Content -Raw -Encoding UTF8 $bj | ConvertFrom-Json).variants.v0.rtf } catch { $prevRtf = $null }
}

if ($ran.Count -gt 0) {
    $null = Run-Py @('summarize', '--out-dir', $outDir, ('--notes=' + $Notes))
}

# saring semua hasil teks sebelum dikirim (transkrip mentah dibuat read-only; buka dulu hanya jika perlu)
$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($n in @('bench_*.json', 'download_*.json', 'step_f_summary.json', 'step_f_summary.md', 'step_f_table.csv')) {
    foreach ($p in (Get-ChildItem -Path $outDir -Filter $n -ErrorAction SilentlyContinue)) {
        $txt = Get-Content -Raw -Encoding UTF8 $p.FullName
        [System.IO.File]::WriteAllText($p.FullName, (Redact $txt), $enc)
    }
}
Write-Host ''
Write-Host '== RINGKASAN STATUS =='
$statusLines | ForEach-Object { Write-Host $_ }
Write-Host ('Hasil: ' + $outDir)
Write-Host 'Kirim ke chat (TEKS saja): step_f_summary.md dan step_f_summary.json. JANGAN kirim audio. Transkrip mentah (raw_*.txt) tidak perlu dikirim.'
if ($ran.Count -ge 1 -and ($statusLines | Where-Object { $_ -match 'gagal' }).Count -eq 0) { exit 0 } else { exit 1 }
