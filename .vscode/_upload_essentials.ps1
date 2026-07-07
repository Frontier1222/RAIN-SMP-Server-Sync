$ErrorActionPreference = "Stop"
Import-Module Posh-SSH -ErrorAction Stop

$sftp = Get-Content (Join-Path $PSScriptRoot "sftp.json") -Raw | ConvertFrom-Json
$cred = New-Object System.Management.Automation.PSCredential(
    $sftp.username,
    (ConvertTo-SecureString $sftp.password -AsPlainText -Force)
)

Write-Host "Connecting to $($sftp.host):$($sftp.port)..." -ForegroundColor Cyan
$session = New-SFTPSession -ComputerName $sftp.host -Port $sftp.port -Credential $cred -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw "SFTP connect failed" }

try {
    $remoteCompiled = "/behavior_packs/Essentials BP/scripts/unlinked/compiled.js"
    $localCompiled = Join-Path (Split-Path $PSScriptRoot -Parent) "behavior_packs/Essentials BP/scripts/unlinked/compiled.js"
    $localManifest = Join-Path (Split-Path $PSScriptRoot -Parent) "behavior_packs/Essentials BP/manifest.json"

    $tmp = Join-Path $env:TEMP "ess-compiled-remote.js"
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
    Get-SFTPItem -SessionId $session.SessionId -Path $remoteCompiled -Destination $env:TEMP -Force | Out-Null
    $downloaded = Join-Path $env:TEMP "compiled.js"
    if (Test-Path $downloaded) { Move-Item $downloaded $tmp -Force }
    $head = [System.IO.File]::ReadAllText($tmp).Substring(0, [Math]::Min(200, (Get-Item $tmp).Length))
    Write-Host "Remote before upload has __ESS_PATCH:" ($head -match "__ESS_PATCH")

    Write-Host "Uploading compiled.js..." -ForegroundColor Yellow
    Set-SFTPItem -SessionId $session.SessionId -Path $localCompiled -Destination "/behavior_packs/Essentials BP/scripts/unlinked/" -Force
    Write-Host "Uploading manifest.json..." -ForegroundColor Yellow
    Set-SFTPItem -SessionId $session.SessionId -Path $localManifest -Destination "/behavior_packs/Essentials BP/" -Force

    Get-SFTPItem -SessionId $session.SessionId -Path $remoteCompiled -Destination $env:TEMP -Force | Out-Null
    $downloaded2 = Join-Path $env:TEMP "compiled.js"
    $head2 = [System.IO.File]::ReadAllText($downloaded2).Substring(0, [Math]::Min(200, (Get-Item $downloaded2).Length))
    Write-Host "Remote after upload has __ESS_PATCH:" ($head2 -match "__ESS_PATCH") -ForegroundColor Green

    $tmpManifest = Join-Path $env:TEMP "ess-manifest-remote.json"
    if (Test-Path $tmpManifest) { Remove-Item $tmpManifest -Force }
    Get-SFTPItem -SessionId $session.SessionId -Path "/behavior_packs/Essentials BP/manifest.json" -Destination $env:TEMP -Force | Out-Null
    $downloadedManifest = Join-Path $env:TEMP "manifest.json"
    if (Test-Path $downloadedManifest) { Move-Item $downloadedManifest $tmpManifest -Force }
    $manifestText = Get-Content $tmpManifest -Raw
    if ($manifestText -match '"module_name":"@minecraft/server","version":"([^"]+)"') {
        Write-Host "Remote manifest server version:" $Matches[1]
    }
}
finally {
    Remove-SFTPSession -SessionId $session.SessionId | Out-Null
}
