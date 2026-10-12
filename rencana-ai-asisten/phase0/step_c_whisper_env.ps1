<#
.SYNOPSIS
  Phase 0 / STEP C - Validasi lingkungan faster-whisper (C1..C7). SEKALI PAKAI, bukan kode produksi.

.DESCRIPTION
  Berjalan berurutan dan BERHENTI di kegagalan pertama (tidak melompat):
    C1 buat venv Python 3.12 terisolasi   (<WorkRoot>\venv, default D:\phase0-work\venv)
    C2 cek/naikkan pip (hanya jika -UpgradePip)
    C3 pip install faster-whisper          (tanpa pin, kecuali -AvPin)
    C4 import test + uji decode audio
    C5 unduh model 'small' dari sumber resmi (Hugging Face, Systran/faster-whisper-small) + verifikasi SHA-256
    C6 muat model (device=cpu, compute_type=int8)
    C7 inferensi minimal pada audio sintetis (suara TTS Windows, lokal, non-rahasia)

  Yang DIUBAH di komputer: hanya <WorkRoot>\venv, <WorkRoot>\models, dan phase0\results\step_c.
  <WorkRoot> sengaja PENDEK (default: akar drive tempat folder phase0, mis. D:\phase0-work). Alasan terukur: dengan lokasi
  ekstrak ZIP yang bersarang dua kali, berkas terdalam paket (onnxruntime ... .pyc, 127 karakter) + path venv di dalam folder
  phase0 menjadi +-302 karakter, melewati batas path Windows 260 karakter, sehingga pip install bisa gagal.
  Python global TIDAK diubah. ffmpeg TIDAK dipasang. Tidak ada audio dikirim ke mana pun.
  Akses jaringan: pip (pypi.org, files.pythonhosted.org) dan unduh model (huggingface.co dan CDN-nya).

  TIDAK diambil: username, hostname, domain, path profil (disaring menjadi <redacted> sebelum disimpan).

  STATUS: ditulis tanpa akses Windows; BELUM PERNAH DIJALANKAN oleh penulis. Jika ada error, salin APA ADANYA.

.PARAMETER WorkRoot
  Folder kerja pendek untuk venv dan model. Default: <drive folder phase0>\phase0-work.

.PARAMETER AvPin
  Opsional. Contoh: '<17' memasang faster-whisper bersama "av<17". Itu PHASE0_TEST_PIN, bukan dependency final.
  Default kosong = pasang apa adanya, supaya terlihat apakah instalasi alami bekerja.

.PARAMETER UpgradePip
  Naikkan pip di venv (C2). Default: tidak.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\step_c_whisper_env.ps1
#>
[CmdletBinding()]
param(
    [string]$WorkRoot = '',
    [string]$AvPin = '',
    [switch]$UpgradePip
)

$ErrorActionPreference = 'Stop'
$ScriptVersion = '1.0-stepC'
$env:PYTHONUTF8 = '1'
$env:HF_HUB_DISABLE_TELEMETRY = '1'

$phase0 = $PSScriptRoot
if (-not $phase0) { $phase0 = (Get-Location).Path }
$smoke   = Join-Path $phase0 'tools\step_c_smoke.py'
if (-not $WorkRoot) {
    $qual = $null
    try { $qual = Split-Path -Qualifier $phase0 } catch { }
    if (-not $qual) { $qual = $env:SystemDrive }
    $WorkRoot = Join-Path ($qual + '\') 'phase0-work'
}
$venv    = Join-Path $WorkRoot 'venv'
$venvPy  = Join-Path $venv 'Scripts\python.exe'
$modelsRoot = Join-Path $WorkRoot 'models'
$modelDir   = Join-Path $modelsRoot 'faster-whisper-small'
$outDir  = Join-Path $phase0 'results\step_c'
$jsonPath = Join-Path $outDir 'step_c_results.json'
$txtPath  = Join-Path $outDir 'step_c_summary.txt'

if (-not (Test-Path $smoke)) {
    Write-Host ('BLOCKED: berkas bantu tidak ada: ' + $smoke) -ForegroundColor Red
    Write-Host 'Pastikan seluruh folder phase0 (termasuk tools\step_c_smoke.py) ikut diekstrak dari ZIP terbaru.'
    exit 2
}
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if (-not (Test-Path $WorkRoot)) { New-Item -ItemType Directory -Path $WorkRoot -Force | Out-Null }

$secrets = @($env:USERNAME, $env:COMPUTERNAME, $env:USERDOMAIN, $env:USERPROFILE) | Where-Object { $_ -and $_.Length -ge 3 }
function Redact {
    param([string]$Text)
    if ($null -eq $Text) { return $null }
    $t = $Text
    foreach ($s in $secrets) { $t = [regex]::Replace($t, [regex]::Escape($s), '<redacted>', 'IgnoreCase') }
    return $t
}

function Run-Native {
    param([string]$Exe, [string[]]$ArgList)
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $code = -1
    $out = @()
    try {
        $out = @(& $Exe @ArgList 2>&1 | ForEach-Object { $_.ToString() })
        $code = $LASTEXITCODE
    } catch {
        $out = @($_.Exception.Message)
        $code = -1
    } finally {
        $ErrorActionPreference = $old
    }
    return [pscustomobject]@{ Code = $code; Out = $out }
}

function Read-Json {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    return (Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json)
}

$stages = [ordered]@{}
$extra  = [ordered]@{}
function Save-All {
    param([string]$Final)
    $res = [ordered]@{
        step = 'C - faster-whisper environment validation'
        script_version = $ScriptVersion
        generated_utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        model = 'small'
        device = 'cpu'
        compute_type = 'int8'
        work_root = $WorkRoot
        av_pin_argument = $(if ($AvPin) { 'av' + $AvPin + ' (PHASE0_TEST_PIN)' } else { 'tidak ada (instalasi apa adanya)' })
        gate_c_suggestion = $Final
        stages = $stages
        details = $extra
    }
    $json = Redact ($res | ConvertTo-Json -Depth 10)
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($jsonPath, $json, $enc)
}

function Set-Stage {
    param([string]$Id, [string]$Name, [string]$Status, $Evidence, [string]$Err)
    $stages[$Id] = [ordered]@{ name = $Name; status = $Status; evidence = $Evidence; error = (Redact $Err) }
    $color = 'Green'
    if ($Status -eq 'FAIL' -or $Status -eq 'BLOCKED') { $color = 'Red' } elseif ($Status -eq 'SKIPPED') { $color = 'Yellow' }
    Write-Host ('[' + $Id + '] ' + $Name + ' : ' + $Status) -ForegroundColor $color
    if ($Err) { Write-Host (Redact $Err) -ForegroundColor DarkYellow }
    Save-All 'BERJALAN'
}

function Finish {
    param([string]$Why)
    $failed = @($stages.Keys | Where-Object { $stages[$_].status -in @('FAIL', 'BLOCKED') })
    $final = 'PASS'
    if ($failed.Count -gt 0) { $final = 'BERHENTI di ' + $failed[0] + ' (' + $stages[$failed[0]].status + ')' }
    elseif ($stages.Count -lt 7) { $final = 'BELUM LENGKAP' }
    Save-All $final
    $L = New-Object System.Collections.Generic.List[string]
    $L.Add('PHASE 0 - STEP C - RINGKASAN')
    $L.Add('Model: small | Device: CPU | Compute type: int8')
    foreach ($k in $stages.Keys) { $L.Add('  ' + $k + '  ' + $stages[$k].name + '  ->  ' + $stages[$k].status) }
    $L.Add('Saran Gate C: ' + $final)
    $txt = Redact ($L -join "`r`n")
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($txtPath, $txt, $enc)
    Write-Host ''
    Write-Host $txt
    Write-Host ''
    Write-Host ('File hasil : ' + $jsonPath)
    Write-Host ('Daftar versi: ' + (Join-Path $outDir 'pip_freeze.txt'))
    Write-Host 'Kirim isi step_c_results.json (dan pip_freeze.txt) ke chat. Jangan kirim audio.'
    if ($Why) { Write-Host $Why }
    if ($final -eq 'PASS') { exit 0 } else { exit 1 }
}

# ---------------------------------------------------------------- pra-cek disk
try {
    $di = New-Object System.IO.DriveInfo((Split-Path -Qualifier $WorkRoot))
    $freeGb = [math]::Round($di.AvailableFreeSpace / 1GB, 1)
    $extra.free_disk_gb_on_workroot_drive = $freeGb
    if ($freeGb -lt 3) {
        Set-Stage 'C1' 'create venv' 'BLOCKED' ([ordered]@{ free_gb = $freeGb }) 'Ruang disk kurang dari 3 GB pada drive folder kerja.'
        Finish ''
    }
} catch { }

# ---------------------------------------------------------------- C1
Write-Host '== C1: membuat venv Python 3.12 =='
$pv = Run-Native 'py' @('-3.12', '--version')
if ($pv.Code -ne 0 -or -not ($pv.Out -match '^Python 3\.12')) {
    Set-Stage 'C1' 'create venv' 'BLOCKED' ([ordered]@{ py_output = $pv.Out }) 'Python 3.12 tidak tersedia lewat "py -3.12".'
    Finish ''
}
$reused = Test-Path $venvPy
if (-not $reused) {
    $mk = Run-Native 'py' @('-3.12', '-m', 'venv', $venv)
    if ($mk.Code -ne 0 -or -not (Test-Path $venvPy)) {
        Set-Stage 'C1' 'create venv' 'FAIL' ([ordered]@{ output = ($mk.Out | Select-Object -Last 15) }) 'Pembuatan venv gagal.'
        Finish ''
    }
}
$vv = Run-Native $venvPy @('--version')
Set-Stage 'C1' 'create venv' 'PASS' ([ordered]@{ venv_python = ($vv.Out | Select-Object -First 1); venv_reused = $reused; base_python = ($pv.Out | Select-Object -First 1) }) ''

# ---------------------------------------------------------------- C2
Write-Host '== C2: pip =='
$pipBefore = Run-Native $venvPy @('-m', 'pip', '--version')
$pipVer = $null
if (($pipBefore.Out | Select-Object -First 1) -match '^pip\s+(\S+)') { $pipVer = $Matches[1] }
if ($UpgradePip) {
    $up = Run-Native $venvPy @('-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--upgrade', 'pip')
    $pipAfter = Run-Native $venvPy @('-m', 'pip', '--version')
    $pipVer2 = $null
    if (($pipAfter.Out | Select-Object -First 1) -match '^pip\s+(\S+)') { $pipVer2 = $Matches[1] }
    if ($up.Code -ne 0) {
        Set-Stage 'C2' 'pip tooling' 'FAIL' ([ordered]@{ pip_before = $pipVer; output = ($up.Out | Select-Object -Last 15) }) 'Upgrade pip gagal.'
        Finish ''
    }
    Set-Stage 'C2' 'pip tooling' 'PASS' ([ordered]@{ pip_before = $pipVer; pip_after = $pipVer2 }) ''
} else {
    Set-Stage 'C2' 'pip tooling' 'SKIPPED' ([ordered]@{ pip_version = $pipVer; note = 'pip tidak dinaikkan (tidak diminta)' }) ''
}

# ---------------------------------------------------------------- C3
Write-Host '== C3: pip install faster-whisper (bisa 1-3 menit) =='
$pipArgs = @('-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', 'faster-whisper')
if ($AvPin) { $pipArgs += ('av' + $AvPin) }
$ins = Run-Native $venvPy $pipArgs
$log = Redact ($ins.Out -join "`r`n")
$enc0 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $outDir 'pip_install_log.txt'), $log, $enc0)
if ($ins.Code -ne 0) {
    Set-Stage 'C3' 'install faster-whisper' 'FAIL' ([ordered]@{ pip_args = ($pipArgs -join ' '); exit_code = $ins.Code; log_tail = ($ins.Out | Select-Object -Last 25) }) 'pip install gagal (lihat log_tail dan pip_install_log.txt).'
    Finish ''
}
$fr = Run-Native $venvPy @('-m', 'pip', 'freeze')
[System.IO.File]::WriteAllText((Join-Path $outDir 'pip_freeze.txt'), (Redact ($fr.Out -join "`r`n")), $enc0)
Set-Stage 'C3' 'install faster-whisper' 'PASS' ([ordered]@{ pip_args = ($pipArgs -join ' '); installed_packages = $fr.Out.Count }) ''

# ---------------------------------------------------------------- C4
Write-Host '== C4: import test + uji decode audio =='
$c4Json = Join-Path $outDir 'c4.json'
$null = Run-Native $venvPy @($smoke, 'check', '--out', $c4Json)
$c4 = Read-Json $c4Json
if ($null -eq $c4) {
    Set-Stage 'C4' 'import + decode test' 'FAIL' ([ordered]@{}) 'Skrip uji tidak menghasilkan hasil.'
    Finish ''
}
$extra.versions = $c4.versions
$extra.python_in_venv = $c4.python_full
$hint = ''
if ($c4.status -ne 'PASS') { $hint = 'Jangan diperbaiki sendiri. Kirim hasil ini. Jika penyebabnya versi av, pin av<17 (PHASE0_TEST_PIN) dapat dicoba setelah review: ulangi dengan -AvPin ''<17''.' }
Set-Stage 'C4' 'import + decode test' $c4.status $c4.evidence ([string]$c4.error + $(if ($hint) { "`r`n" + $hint } else { '' }))
if ($c4.status -ne 'PASS') { Finish '' }

# ---------------------------------------------------------------- C5
Write-Host '== C5: unduh model small (+- 460 MB) dari Hugging Face resmi =='
$c5Json = Join-Path $outDir 'c5.json'
$null = Run-Native $venvPy @($smoke, 'download', '--out', $c5Json, '--model-dir', $modelDir)
$c5 = Read-Json $c5Json
if ($null -eq $c5) {
    Set-Stage 'C5' 'model download' 'FAIL' ([ordered]@{}) 'Skrip unduh tidak menghasilkan hasil.'
    Finish ''
}
$c5hint = ''
if ($c5.status -eq 'BLOCKED') { $c5hint = 'Unduh diblok jaringan. Jangan pakai mirror tidak tepercaya. Salin error apa adanya; alternatif resmi dibahas di review.' }
Set-Stage 'C5' 'model download' $c5.status $c5.evidence ([string]$c5.error + $(if ($c5hint) { "`r`n" + $c5hint } else { '' }))
if ($c5.status -ne 'PASS') { Finish '' }

# ---------------------------------------------------------------- C6 + C7
Write-Host '== C6/C7: muat model dan inferensi minimal (audio sintetis TTS Windows) =='
$wav = Join-Path $outDir 'tts_sample.wav'
$expFile = Join-Path $outDir 'expected.txt'
$lang = 'en'
$text = 'This is a short synthetic test of the local transcription engine. The outstanding value is four hundred ninety five billion rupiah.'
$voiceInfo = $null
$ttsOk = $false
$ttsErr = ''
try {
    Add-Type -AssemblyName System.Speech
    $syn = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voices = @($syn.GetInstalledVoices() | Where-Object { $_.Enabled })
    $idv = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like 'id*' } | Select-Object -First 1
    $env1 = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like 'en*' } | Select-Object -First 1
    $pick = $null
    if ($idv) {
        $pick = $idv; $lang = 'id'
        $text = 'Ini adalah pengujian mesin transkripsi lokal. Nilai outstanding sebesar empat ratus sembilan puluh lima miliar rupiah.'
    } elseif ($env1) { $pick = $env1 }
    elseif ($voices.Count -gt 0) { $pick = $voices[0] }
    if ($pick) {
        $syn.SelectVoice($pick.VoiceInfo.Name)
        $voiceInfo = [ordered]@{ voice = $pick.VoiceInfo.Name; culture = $pick.VoiceInfo.Culture.Name; language_used = $lang }
        $syn.SetOutputToWaveFile($wav)
        $syn.Speak($text)
        $syn.SetOutputToNull()
        $ttsOk = (Test-Path $wav) -and ((Get-Item $wav).Length -gt 1000)
    } else { $ttsErr = 'Tidak ada suara TTS terpasang.' }
    $syn.Dispose()
} catch { $ttsErr = $_.Exception.Message }

if (-not $ttsOk) {
    $stages['C6'] = [ordered]@{ name = 'model load'; status = 'BLOCKED'; evidence = [ordered]@{}; error = 'Tidak dijalankan: audio uji sintetis tidak dapat dibuat.' }
    Set-Stage 'C7' 'minimal inference' 'BLOCKED' ([ordered]@{ tts_error = $ttsErr }) 'Audio sintetis TTS tidak dapat dibuat di komputer ini. Dibahas di review (tanpa audio perusahaan).'
    Finish ''
}
$extra.tts = $voiceInfo
[System.IO.File]::WriteAllText($expFile, $text, (New-Object System.Text.UTF8Encoding($false)))
$c6Json = Join-Path $outDir 'c6c7.json'
$null = Run-Native $venvPy @($smoke, 'loadinfer', '--out', $c6Json, '--model-dir', $modelDir, '--audio', $wav, '--lang', $lang, '--expected-file', $expFile)
$c67 = Read-Json $c6Json
if ($null -eq $c67) {
    Set-Stage 'C6' 'model load' 'FAIL' ([ordered]@{}) 'Skrip uji tidak menghasilkan hasil.'
    Finish ''
}
Set-Stage 'C6' 'model load' $c67.C6.status $c67.C6.evidence ([string]$c67.C6.error)
if ($c67.C6.status -ne 'PASS') { Finish '' }
Set-Stage 'C7' 'minimal inference' $c67.C7.status $c67.C7.evidence ([string]$c67.C7.error)
Finish ''
