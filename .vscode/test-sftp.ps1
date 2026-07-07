$ErrorActionPreference = "Stop"

$HostName = "na2041.pebblehost.net"
$Port = 2222
$UserName = "ksyed1324@gmail.com.588b5a1a"

function Ensure-PoshSSH {
    if (Get-Module -ListAvailable -Name Posh-SSH) { return }
    Write-Host "Installing Posh-SSH (one-time)..." -ForegroundColor Yellow
    if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force | Out-Null
    }
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
    Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
}

Ensure-PoshSSH
Import-Module Posh-SSH -ErrorAction Stop

Write-Host ""
Write-Host "PebbleHost SFTP login test" -ForegroundColor Cyan
Write-Host "Host: ${HostName}:${Port}"
Write-Host "User: $UserName"
Write-Host ""
Write-Host "PebbleHost is SFTP-only (no shell). Use your panel password below." -ForegroundColor Yellow
Write-Host ""

$SecurePass = Read-Host "Panel password" -AsSecureString
$Bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
try {
    $PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr).Trim()
}
finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
}
$Credential = New-Object System.Management.Automation.PSCredential($UserName, (ConvertTo-SecureString $PlainPassword -AsPlainText -Force))

Write-Host "Connecting..." -ForegroundColor Cyan
$Session = New-SFTPSession -ComputerName $HostName -Port $Port -Credential $Credential -AcceptKey -ConnectionTimeout 30
if (-not $Session) {
    Write-Host ""
    Write-Host "FAILED - could not connect." -ForegroundColor Red
    exit 1
}

try {
    $Items = Get-SFTPChildItem -SessionId $Session.SessionId -Path "/"
    Write-Host ""
    Write-Host "SUCCESS - logged in. Root folder contains:" -ForegroundColor Green
    foreach ($Item in $Items) {
        $Kind = if ($Item.IsDirectory) { "[dir]" } else { "     " }
        Write-Host "  $Kind $($Item.Name)"
    }
    Write-Host ""
    Write-Host "Run download.bat next." -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "FAILED - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if ($Session) {
        Remove-SFTPSession -SessionId $Session.SessionId | Out-Null
    }
}
