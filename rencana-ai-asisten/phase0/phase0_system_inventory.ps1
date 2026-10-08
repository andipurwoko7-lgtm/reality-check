<#
.SYNOPSIS
  Phase 0 / STEP A - System Inventory (HANYA MEMBACA).

.DESCRIPTION
  Mengumpulkan informasi perangkat untuk keputusan Phase 0. Tidak mengubah konfigurasi komputer,
  tidak menginstal apa pun, tidak membuka koneksi jaringan, tidak butuh hak Administrator.

  Perintah yang dipakai: Get-CimInstance, baca registry (HKLM/HKCU), Get-Command,
  nvidia-smi (query nama/VRAM/driver), python --version, python -m pip --version, py -0,
  ffmpeg -version, powercfg /getactivescheme, dan Add-Type (kompilasi di memori untuk membaca
  perangkat audio default + fitur CPU; hanya jika Language Mode = FullLanguage).
  Satu-satunya yang DITULIS: dua file hasil (JSON dan TXT) di folder OutDir.

  TIDAK diambil: username, hostname, nama domain, password, serial number, IP, MAC, UUID,
  path folder profil, daftar proses, daftar file, isi dokumen. Sebagai pengaman, teks hasil
  disaring: nilai username/hostname/profil milik komputer ini diganti <redacted> sebelum disimpan.

  STATUS: ditulis tanpa akses Windows; BELUM PERNAH DIJALANKAN oleh penulis. Jika ada error,
  salin pesan error APA ADANYA.

.PARAMETER OutDir
  Folder hasil. Default: folder 'results' di samping skrip ini.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\phase0_system_inventory.ps1
#>
[CmdletBinding()]
param(
    [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$ScriptVersion = '1.0-stepA'

$here = $PSScriptRoot
if (-not $here) { $here = (Get-Location).Path }
if (-not $OutDir) { $OutDir = Join-Path $here 'results' }

$inv    = [ordered]@{}   # data
$status = [ordered]@{}   # ok | failed per bagian
$errors = [ordered]@{}   # pesan error per bagian

function Run-Section {
    param([string]$Name, [scriptblock]$Block)
    try {
        $inv[$Name] = & $Block
        $status[$Name] = 'ok'
    } catch {
        $inv[$Name] = $null
        $status[$Name] = 'failed'
        $errors[$Name] = $_.Exception.Message
    }
}

# Jalankan program native tanpa membuat stderr menjadi error fatal (PowerShell 5.1).
function Invoke-Native {
    param([string]$Exe, [string[]]$ArgList)
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Exe @ArgList 2>&1 | ForEach-Object { $_.ToString() }
    } finally {
        $ErrorActionPreference = $old
    }
    return @($out)
}

function To-Gb {
    param($Bytes)
    if ($null -eq $Bytes) { return $null }
    return [math]::Round(([double]$Bytes) / 1GB, 2)
}

# ---------------------------------------------------------------- 0. meta
Run-Section 'meta' {
    $isAdmin = $false
    try {
        $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
        $isAdmin = $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { }
    $ep = @()
    try {
        $ep = @(Get-ExecutionPolicy -List | ForEach-Object { [ordered]@{ scope = $_.Scope.ToString(); policy = $_.ExecutionPolicy.ToString() } })
    } catch { }
    [ordered]@{
        script_version      = $ScriptVersion
        generated_utc       = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        powershell_version  = $PSVersionTable.PSVersion.ToString()
        language_mode       = $ExecutionContext.SessionState.LanguageMode.ToString()
        running_as_admin    = $isAdmin
        culture             = (Get-Culture).Name
        execution_policy    = $ep
    }
}

# ---------------------------------------------------------------- 1. Windows
Run-Section 'windows' {
    $os = Get-CimInstance Win32_OperatingSystem
    $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
    [ordered]@{
        caption         = $os.Caption
        version         = $os.Version
        build_number    = $os.BuildNumber
        display_version = $cv.DisplayVersion
        ubr             = $cv.UBR
        architecture    = $os.OSArchitecture
    }
}

# ---------------------------------------------------------------- 2. CPU
Run-Section 'cpu' {
    $list = @(Get-CimInstance Win32_Processor | ForEach-Object {
        [ordered]@{
            name            = ($_.Name -replace '\s+', ' ').Trim()
            cores           = $_.NumberOfCores
            logical         = $_.NumberOfLogicalProcessors
            max_clock_mhz   = $_.MaxClockSpeed
        }
    })
    [ordered]@{ processors = $list }
}

# ---------------------------------------------------------------- 3. RAM
Run-Section 'memory' {
    $os = Get-CimInstance Win32_OperatingSystem
    [ordered]@{
        total_gb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        free_gb  = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    }
}

# ---------------------------------------------------------------- 4. GPU
Run-Section 'gpu' {
    $ctrl = @(Get-CimInstance Win32_VideoController | ForEach-Object {
        $d = $null
        if ($_.DriverDate) { $d = ([datetime]$_.DriverDate).ToString('yyyy-MM-dd') }
        [ordered]@{
            name                    = $_.Name
            driver_version          = $_.DriverVersion
            driver_date             = $d
            adapter_ram_reported_gb = (To-Gb $_.AdapterRAM)   # catatan: WMI membatasi ~4 GB; lihat vram_registry
        }
    })
    # VRAM yang lebih akurat dari registry (read-only)
    $vram = @()
    try {
        $base = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
        Get-ChildItem $base -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^\d{4}$' } | ForEach-Object {
            try {
                $p = Get-ItemProperty $_.PSPath -ErrorAction Stop
                $raw = $p.'HardwareInformation.qwMemorySize'
                if ($null -ne $raw) {
                    if ($raw -is [byte[]]) { $b = [BitConverter]::ToUInt64($raw, 0) } else { $b = [uint64]$raw }
                    $vram += [ordered]@{ adapter = $p.DriverDesc; vram_gb = (To-Gb $b) }
                }
            } catch { }
        }
    } catch { }
    [ordered]@{ controllers = $ctrl; vram_registry = $vram }
}

# ---------------------------------------------------------------- 5. NVIDIA / CUDA
Run-Section 'nvidia' {
    $exe = $null
    $cmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if ($cmd) { $exe = $cmd.Source }
    if (-not $exe) {
        $cand = Join-Path $env:ProgramFiles 'NVIDIA Corporation\NVSMI\nvidia-smi.exe'
        if (Test-Path $cand) { $exe = $cand }
    }
    if (-not $exe) {
        return [ordered]@{ nvidia_smi_found = $false; cuda_visible = $false; note = 'nvidia-smi tidak ditemukan (tidak ada GPU NVIDIA atau driver belum terpasang)' }
    }
    $q = Invoke-Native $exe @('--query-gpu=name,memory.total,driver_version', '--format=csv,noheader')
    $gpus = @()
    foreach ($line in $q) {
        $parts = $line -split ',\s*'
        if ($parts.Count -ge 3) { $gpus += [ordered]@{ name = $parts[0]; memory_total = $parts[1]; driver_version = $parts[2] } }
    }
    # Versi CUDA driver dari header nvidia-smi. Hanya angka versi yang disimpan (bukan seluruh keluaran).
    $full = (Invoke-Native $exe @()) -join "`n"
    $cuda = $null
    if ($full -match 'CUDA Version:\s*([0-9]+\.[0-9]+)') { $cuda = $Matches[1] }
    $nvcc = [bool](Get-Command nvcc -ErrorAction SilentlyContinue)
    [ordered]@{
        nvidia_smi_found     = $true
        gpus                 = $gpus
        driver_cuda_version  = $cuda
        cuda_visible         = [bool]$cuda
        cuda_toolkit_nvcc_on_path = $nvcc
        raw_query_lines      = @($q | Select-Object -First 4)
    }
}

# ---------------------------------------------------------------- 6. Python & pip
Run-Section 'python' {
    $res = [ordered]@{}
    $py = Get-Command python -ErrorAction SilentlyContinue
    $res.python_command_found = [bool]$py
    if ($py) {
        $res.command_in_windowsapps = ($py.Source -like '*\WindowsApps\*')   # alias Store; path tidak disimpan
        $v = Invoke-Native 'python' @('--version')
        $first = ($v | Select-Object -First 1)
        $res.python_version_raw = $first
        $res.python_ok = ($first -match '^Python\s+\d+\.\d+')
        if ($res.python_ok) {
            $bits = Invoke-Native 'python' @('-c', 'import struct;print(struct.calcsize("P")*8)')
            $res.python_bits = ($bits | Select-Object -First 1)
            $pipv = Invoke-Native 'python' @('-m', 'pip', '--version')
            $pf = ($pipv | Select-Object -First 1)
            if ($pf -match '^pip\s+(\S+)') { $res.pip_version = $Matches[1] } else { $res.pip_version = $null; $res.pip_raw = $pf }
        }
    }
    $pl = Get-Command py -ErrorAction SilentlyContinue
    $res.py_launcher_found = [bool]$pl
    if ($pl) { $res.py_launcher_versions = @(Invoke-Native 'py' @('-0')) }
    $ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
    $res.ffmpeg_found = [bool]$ff
    if ($ff) { $res.ffmpeg_version_line = (Invoke-Native 'ffmpeg' @('-version') | Select-Object -First 1) }
    $res
}

# ---------------------------------------------------------------- 7. Disk
Run-Section 'disk' {
    $drives = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
        [ordered]@{ drive = $_.DeviceID; size_gb = (To-Gb $_.Size); free_gb = (To-Gb $_.FreeSpace) }
    })
    $cur = $null
    try { $cur = ((Get-Item $here).PSDrive.Name) + ':' } catch { }
    [ordered]@{ fixed_drives = $drives; drive_of_this_script = $cur }
}

# ---------------------------------------------------------------- 8. Audio (registry + COM)
$script:AudioNames = @{}   # GUID -> nama, dipakai untuk memetakan perangkat default
Run-Section 'audio' {
    $formNames = @{ 0 = 'RemoteNetworkDevice'; 1 = 'Speakers'; 2 = 'LineLevel'; 3 = 'Headphones'; 4 = 'Microphone'; 5 = 'Headset'; 6 = 'Handset'; 7 = 'UnknownDigitalPassthrough'; 8 = 'SPDIF'; 9 = 'DigitalAudioDisplayDevice'; 10 = 'UnknownFormFactor' }
    $stateNames = @{ 1 = 'active'; 2 = 'disabled'; 4 = 'notpresent'; 8 = 'unplugged' }
    $root = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio'
    $out = [ordered]@{}
    $regOk = $true
    foreach ($flow in @('Render', 'Capture')) {
        $items = @()
        try {
            Get-ChildItem (Join-Path $root $flow) -ErrorAction Stop | ForEach-Object {
                $guid = $_.PSChildName
                $k = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                $props = Get-ItemProperty (Join-Path $_.PSPath 'Properties') -ErrorAction SilentlyContinue
                $desc = $null; $iface = $null; $form = $null
                if ($props) {
                    $pd = $props.PSObject.Properties['{a45c254e-df1c-4efd-8020-67d146a850e0},2']
                    $pi = $props.PSObject.Properties['{b3f8fa53-0004-438e-9003-51a46e139bfc},6']
                    $pf = $props.PSObject.Properties['{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},0']
                    if ($pd) { $desc = [string]$pd.Value }
                    if ($pi) { $iface = [string]$pi.Value }
                    if ($pf) { $form = [int]$pf.Value }
                }
                if ($desc -and $iface) { $name = "$desc ($iface)" } elseif ($desc) { $name = $desc } elseif ($iface) { $name = $iface } else { $name = '(nama tidak terbaca)' }
                $ds = [int]$k.DeviceState
                $stateText = $stateNames[$ds]; if (-not $stateText) { $stateText = "code$ds" }
                $formText = $null; if ($null -ne $form) { $formText = $formNames[$form] }
                $script:AudioNames[$guid.ToLower()] = $name
                $items += [ordered]@{ name = $name; state = $stateText; form_factor = $formText; bluetooth_handsfree_hint = [bool]($name -match 'Hands-?Free|HFP') }
            }
        } catch {
            $regOk = $false
            $out["${flow}_error"] = $_.Exception.Message
        }
        $out[$flow.ToLower()] = $items
    }
    # Cadangan bila registry tidak terbaca
    if (-not $regOk) {
        try { $out.sound_devices_cim = @(Get-CimInstance Win32_SoundDevice | ForEach-Object { [ordered]@{ name = $_.Name; status = $_.Status } }) } catch { }
    }
    # Stereo Mix (hanya dicatat; tidak dibutuhkan oleh WASAPI loopback / browser capture)
    $sm = @($out.capture | Where-Object { $_.name -match 'stereo\s*mix|stereo\s*mixer|what\s*u\s*hear|wave\s*out\s*mix|loopback' })
    $out.stereo_mix = [ordered]@{ present = ($sm.Count -gt 0); entries = @($sm | ForEach-Object { [ordered]@{ name = $_.name; state = $_.state } }) }
    $out
}

# Perangkat DEFAULT (butuh Add-Type; dilewati jika Constrained Language Mode)
Run-Section 'audio_defaults_and_cpu_features' {
    $res = [ordered]@{}
    if ($ExecutionContext.SessionState.LanguageMode.ToString() -ne 'FullLanguage') {
        $res.skipped = 'LanguageMode bukan FullLanguage (Add-Type diblokir kebijakan). Default device & fitur CPU tidak dibaca.'
        return $res
    }
    if (-not ('Phase0Inv.Native' -as [type])) {
        $src = @'
using System;
using System.Runtime.InteropServices;
namespace Phase0Inv {
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    int OpenPropertyStore(int stgmAccess, out IntPtr ppProperties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    int GetState(out int pdwState);
  }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorComObject { }
  public static class Native {
    [DllImport("kernel32.dll")]
    public static extern bool IsProcessorFeaturePresent(uint feature);
    public static string DefaultId(int flow, int role) {
      IMMDeviceEnumerator e = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
      IMMDevice d;
      int hr = e.GetDefaultAudioEndpoint(flow, role, out d);
      if (hr != 0 || d == null) return null;
      string id;
      d.GetId(out id);
      return id;
    }
  }
}
'@
        Add-Type -TypeDefinition $src -Language CSharp
    }
    # Fitur CPU (penting untuk kecepatan CTranslate2 di CPU)
    $res.cpu_features = [ordered]@{
        avx  = [Phase0Inv.Native]::IsProcessorFeaturePresent(39)
        avx2 = [Phase0Inv.Native]::IsProcessorFeaturePresent(40)
        avx512f = [Phase0Inv.Native]::IsProcessorFeaturePresent(41)
    }
    # flow: 0 = Render (output), 1 = Capture (input). role: 0 = Console, 1 = Multimedia, 2 = Communications
    $def = [ordered]@{}
    foreach ($pair in @(@('render_console', 0, 0), @('render_communications', 0, 2), @('capture_console', 1, 0), @('capture_communications', 1, 2))) {
        $label = $pair[0]
        try {
            $id = [Phase0Inv.Native]::DefaultId([int]$pair[1], [int]$pair[2])
            if ($id -and ($id -match '\{([0-9a-fA-F\-]{36})\}$')) {
                $g = ('{' + $Matches[1] + '}').ToLower()
                $nm = $script:AudioNames[$g]; if (-not $nm) { $nm = '(GUID tidak ada di daftar registry)' }
                $def[$label] = $nm
            } else { $def[$label] = $null }
        } catch { $def[$label] = 'ERROR: ' + $_.Exception.Message }
    }
    $res.default_devices = $def
    $res
}

# ---------------------------------------------------------------- 9. Aplikasi
Run-Section 'apps' {
    $keys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $want = 'Zoom*', 'OBS Studio*', 'Google Chrome*', 'Microsoft Edge'
    $found = @()
    foreach ($k in $keys) {
        Get-ItemProperty $k -ErrorAction SilentlyContinue | ForEach-Object {
            $n = $_.DisplayName
            if ($n) {
                foreach ($w in $want) {
                    if ($n -like $w) { $found += [ordered]@{ name = $n; version = $_.DisplayVersion }; break }
                }
            }
        }
    }
    $uniq = @($found | Sort-Object { $_.name + '|' + $_.version } -Unique)
    [ordered]@{
        zoom      = @($uniq | Where-Object { $_.name -like 'Zoom*' })
        obs       = @($uniq | Where-Object { $_.name -like 'OBS Studio*' })
        chrome    = @($uniq | Where-Object { $_.name -like 'Google Chrome*' })
        edge      = @($uniq | Where-Object { $_.name -eq 'Microsoft Edge' })
    }
}

# ---------------------------------------------------------------- 10. Daya
Run-Section 'power' {
    $plan = $null
    $o = Invoke-Native 'powercfg' @('/getactivescheme') | Select-Object -First 1
    if ($o -match '\(([^)]+)\)\s*$') { $plan = $Matches[1] }
    $bat = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)
    $code = $null
    if ($bat.Count -gt 0) { $code = $bat[0].BatteryStatus }
    [ordered]@{
        active_power_plan   = $plan
        has_battery         = ($bat.Count -gt 0)
        battery_status_code = $code   # 1 = baterai (discharging), 2 = AC. Kode lain: lihat dokumentasi Win32_Battery
    }
}

# ---------------------------------------------------------------- Status keseluruhan
$core = @('windows', 'cpu', 'memory')
$coreFailed = @($core | Where-Object { $status[$_] -ne 'ok' })
$failed = @($status.Keys | Where-Object { $status[$_] -ne 'ok' })
if ($coreFailed.Count -gt 0) { $overall = 'FAIL' }
elseif ($failed.Count -gt 0) { $overall = 'PARTIAL' }
else { $overall = 'PASS' }

$result = [ordered]@{
    step            = 'A - System Inventory'
    overall_status  = $overall
    status_meaning  = 'PASS = seluruh bagian inventaris berhasil dibaca. BUKAN berarti laptop siap; itu dinilai setelah review.'
    sections_status = $status
    section_errors  = $errors
    privacy         = [ordered]@{
        not_collected = @('username', 'hostname', 'domain', 'password', 'serial number', 'IP address', 'MAC address', 'GUID/UUID perangkat', 'path profil pengguna', 'daftar proses/file', 'isi dokumen')
        redaction_hits = 0
    }
    data            = $inv
}

# ---------------------------------------------------------------- Penyaringan pengaman (nilai privat tidak pernah disimpan)
$json = $result | ConvertTo-Json -Depth 8
$hits = 0
$secrets = @($env:USERNAME, $env:COMPUTERNAME, $env:USERDOMAIN, $env:USERPROFILE)
foreach ($s in $secrets) {
    if ($s -and $s.Length -ge 3) {
        $pat = [regex]::Escape($s)
        $m = [regex]::Matches($json, $pat, 'IgnoreCase')
        if ($m.Count -gt 0) { $hits += $m.Count; $json = [regex]::Replace($json, $pat, '<redacted>', 'IgnoreCase') }
    }
}
if ($hits -gt 0) { $json = $json -replace '"redaction_hits":\s*0', ('"redaction_hits": ' + $hits) }

# ---------------------------------------------------------------- Ringkasan TXT
$d = $inv
$L = New-Object System.Collections.Generic.List[string]
function Add-Line { param([string]$t) $L.Add($t) | Out-Null }
Add-Line 'PHASE 0 - STEP A - SYSTEM INVENTORY'
Add-Line ('Dibuat (UTC)  : ' + $d.meta.generated_utc)
Add-Line ('STATUS        : ' + $overall + '   (bagian gagal: ' + $(if ($failed.Count -gt 0) { $failed -join ', ' } else { 'tidak ada' }) + ')')
Add-Line ('PowerShell    : ' + $d.meta.powershell_version + ' | LanguageMode=' + $d.meta.language_mode + ' | Admin=' + $d.meta.running_as_admin)
Add-Line ''
Add-Line '[Windows]'
if ($d.windows) { Add-Line ('  ' + $d.windows.caption + ' | versi ' + $d.windows.version + ' (build ' + $d.windows.build_number + ', ' + $d.windows.display_version + ') | ' + $d.windows.architecture) }
Add-Line '[CPU]'
if ($d.cpu) { foreach ($c in $d.cpu.processors) { Add-Line ('  ' + $c.name + ' | ' + $c.cores + ' core / ' + $c.logical + ' thread | ' + $c.max_clock_mhz + ' MHz') } }
if ($d.audio_defaults_and_cpu_features -and $d.audio_defaults_and_cpu_features.cpu_features) {
    $f = $d.audio_defaults_and_cpu_features.cpu_features
    Add-Line ('  AVX=' + $f.avx + ' AVX2=' + $f.avx2 + ' AVX512F=' + $f.avx512f)
}
Add-Line '[RAM]'
if ($d.memory) { Add-Line ('  total ' + $d.memory.total_gb + ' GB | bebas saat ini ' + $d.memory.free_gb + ' GB') }
Add-Line '[GPU]'
if ($d.gpu) {
    foreach ($g in $d.gpu.controllers) { Add-Line ('  ' + $g.name + ' | driver ' + $g.driver_version + ' (' + $g.driver_date + ')') }
    foreach ($v in $d.gpu.vram_registry) { Add-Line ('  VRAM (registry): ' + $v.adapter + ' = ' + $v.vram_gb + ' GB') }
}
if ($d.nvidia) {
    if ($d.nvidia.nvidia_smi_found) {
        foreach ($g in $d.nvidia.gpus) { Add-Line ('  NVIDIA: ' + $g.name + ' | ' + $g.memory_total + ' | driver ' + $g.driver_version) }
        Add-Line ('  CUDA (driver) terlihat: ' + $d.nvidia.cuda_visible + ' | versi ' + $d.nvidia.driver_cuda_version + ' | nvcc di PATH: ' + $d.nvidia.cuda_toolkit_nvcc_on_path)
    } else { Add-Line '  NVIDIA/CUDA: tidak terlihat (nvidia-smi tidak ada)' }
}
Add-Line '[Python / pip / ffmpeg]'
if ($d.python) {
    Add-Line ('  python: ' + $d.python.python_version_raw + ' | 64/32-bit: ' + $d.python.python_bits + ' | alias WindowsApps: ' + $d.python.command_in_windowsapps)
    Add-Line ('  pip: ' + $d.python.pip_version)
    Add-Line ('  py launcher: ' + $d.python.py_launcher_found + ' ' + ($d.python.py_launcher_versions -join ' ; '))
    Add-Line ('  ffmpeg: ' + $d.python.ffmpeg_found + ' ' + $d.python.ffmpeg_version_line)
}
Add-Line '[Disk]'
if ($d.disk) {
    foreach ($x in $d.disk.fixed_drives) { Add-Line ('  ' + $x.drive + ' total ' + $x.size_gb + ' GB | bebas ' + $x.free_gb + ' GB') }
    Add-Line ('  drive folder skrip: ' + $d.disk.drive_of_this_script)
}
Add-Line '[Audio - output/playback]'
if ($d.audio) { foreach ($x in $d.audio.render) { Add-Line ('  - ' + $x.name + ' | ' + $x.state + ' | ' + $x.form_factor + $(if ($x.bluetooth_handsfree_hint) { ' | HANDS-FREE?' } else { '' })) } }
Add-Line '[Audio - input/recording]'
if ($d.audio) { foreach ($x in $d.audio.capture) { Add-Line ('  - ' + $x.name + ' | ' + $x.state + ' | ' + $x.form_factor + $(if ($x.bluetooth_handsfree_hint) { ' | HANDS-FREE?' } else { '' })) } }
if ($d.audio -and $d.audio.stereo_mix) { Add-Line ('  Stereo Mix tersedia: ' + $d.audio.stereo_mix.present + ' ' + (($d.audio.stereo_mix.entries | ForEach-Object { $_.name + ' [' + $_.state + ']' }) -join '; ')) }
Add-Line '[Audio - default]'
$dd = $null
if ($d.audio_defaults_and_cpu_features) { $dd = $d.audio_defaults_and_cpu_features.default_devices }
if ($dd) {
    Add-Line ('  output default (console)       : ' + $dd.render_console)
    Add-Line ('  output default (communications): ' + $dd.render_communications)
    Add-Line ('  mic default (console)          : ' + $dd.capture_console)
    Add-Line ('  mic default (communications)   : ' + $dd.capture_communications)
} else {
    $why = 'tidak terbaca'
    if ($d.audio_defaults_and_cpu_features -and $d.audio_defaults_and_cpu_features.skipped) { $why = $d.audio_defaults_and_cpu_features.skipped }
    Add-Line ('  ' + $why)
}
Add-Line '[Aplikasi]'
if ($d.apps) {
    foreach ($k in @('zoom', 'obs', 'chrome', 'edge')) {
        $items = @($d.apps.$k)
        if ($items.Count -gt 0) { foreach ($i in $items) { Add-Line ('  ' + $k + ': ' + $i.name + ' ' + $i.version) } } else { Add-Line ('  ' + $k + ': tidak terdeteksi') }
    }
}
Add-Line '[Daya]'
if ($d.power) { Add-Line ('  power plan: ' + $d.power.active_power_plan + ' | baterai: ' + $d.power.has_battery + ' | kode status baterai: ' + $d.power.battery_status_code) }
if ($errors.Count -gt 0) {
    Add-Line ''
    Add-Line '[ERROR per bagian - salin apa adanya]'
    foreach ($k in $errors.Keys) { Add-Line ('  ' + $k + ': ' + $errors[$k]) }
}
$txt = ($L -join "`r`n")
foreach ($s in $secrets) {
    if ($s -and $s.Length -ge 3) { $txt = [regex]::Replace($txt, [regex]::Escape($s), '<redacted>', 'IgnoreCase') }
}

# ---------------------------------------------------------------- Tulis file (satu-satunya yang ditulis)
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$jsonPath = Join-Path $OutDir 'phase0_system_inventory.json'
$txtPath  = Join-Path $OutDir 'phase0_system_inventory.txt'
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($jsonPath, $json, $enc)
[System.IO.File]::WriteAllText($txtPath, $txt, $enc)

Write-Host ''
Write-Host $txt
Write-Host ''
Write-Host ('STATUS: ' + $overall)
Write-Host ('File JSON: ' + $jsonPath)
Write-Host ('File TXT : ' + $txtPath)
Write-Host 'Buka file TXT, pastikan tidak ada yang tidak ingin kamu bagikan, lalu kirim JSON (atau tempel isi TXT).'
