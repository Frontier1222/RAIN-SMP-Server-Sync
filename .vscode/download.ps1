# Downloads behavior_packs and resource_packs from PebbleHost via SFTP.
# PebbleHost is SFTP-only - ssh/scp shell tests fail with "exec request failed".

$ErrorActionPreference = "Stop"

$HostName = "na2041.pebblehost.net"
$Port = 2222
$UserName = "ksyed1324@gmail.com.588b5a1a"
$LocalRoot = Split-Path $PSScriptRoot -Parent

function Ensure-PoshSSH {
    if (Get-Module -ListAvailable -Name Posh-SSH) { return }
    Write-Host "Installing Posh-SSH (one-time)..." -ForegroundColor Yellow
    if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force | Out-Null
    }
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
    Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
}

function Copy-SFTPDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [int]$SessionId,
        [Parameter(Mandatory = $true)]
        [string]$RemotePath,
        [Parameter(Mandatory = $true)]
        [string]$LocalPath
    )

    New-Item -ItemType Directory -Force -Path $LocalPath | Out-Null
    $Items = Get-SFTPChildItem -SessionId $SessionId -Path $RemotePath
    $FileCount = 0

    foreach ($Item in $Items) {
        $RemoteItem = "$($RemotePath.TrimEnd('/'))/$($Item.Name)"
        $LocalItem = Join-Path $LocalPath $Item.Name

        if ($Item.IsDirectory) {
            Copy-SFTPDirectory -SessionId $SessionId -RemotePath $RemoteItem -LocalPath $LocalItem
            continue
        }

        $Parent = Split-Path $LocalItem -Parent
        New-Item -ItemType Directory -Force -Path $Parent | Out-Null
        Get-SFTPItem -SessionId $SessionId -Path $RemoteItem -Destination $Parent -Force | Out-Null
        $FileCount++
        if (($FileCount % 50) -eq 0) {
            Write-Host "  ... $FileCount files" -ForegroundColor DarkGray
        }
    }
}

Ensure-PoshSSH
Import-Module Posh-SSH -ErrorAction Stop

Write-Host ""
Write-Host "PebbleHost download (SFTP)" -ForegroundColor Cyan
Write-Host "Host: ${HostName}:${Port}"
Write-Host "User: $UserName"
Write-Host ""

$SecurePass = Read-Host "Panel password" -AsSecureString
$Bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
try {
    $PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr).Trim()
}
finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
}
$Credential = New-Object System.Management.Automation.PSCredential(
    $UserName,
    (ConvertTo-SecureString $PlainPassword -AsPlainText -Force)
)

Write-Host "Connecting..." -ForegroundColor Cyan
$Session = New-SFTPSession -ComputerName $HostName -Port $Port -Credential $Credential -AcceptKey -ConnectionTimeout 30
if (-not $Session) {
    throw "Could not connect. Run test-sftp.bat first."
}

try {
    $RootItems = Get-SFTPChildItem -SessionId $Session.SessionId -Path "/"
    Write-Host ""
    Write-Host "Connected. Server root:" -ForegroundColor Green
    foreach ($Item in $RootItems) {
        $Kind = if ($Item.IsDirectory) { "[dir]" } else { "     " }
        Write-Host "  $Kind $($Item.Name)"
    }
    Write-Host ""

    foreach ($Dir in @("behavior_packs", "resource_packs")) {
        $Remote = "/$Dir"
        $Local = Join-Path $LocalRoot $Dir

        $Exists = $RootItems | Where-Object { $_.Name -eq $Dir -and $_.IsDirectory }
        if (-not $Exists) {
            Write-Warning "/$Dir not found on server - skipped."
            continue
        }

        New-Item -ItemType Directory -Force -Path $Local | Out-Null
        Write-Host "Downloading $Remote -> $Local" -ForegroundColor Yellow
        Copy-SFTPDirectory -SessionId $Session.SessionId -RemotePath $Remote -LocalPath $Local
        Write-Host "Done: $Dir" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "All done!" -ForegroundColor Green
    $Paths = @(
        (Join-Path $LocalRoot "behavior_packs"),
        (Join-Path $LocalRoot "resource_packs")
    )
    Get-ChildItem $Paths -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $($_.FullName)"
    }
}
finally {
    if ($Session) {
        Remove-SFTPSession -SessionId $Session.SessionId | Out-Null
    }
}
