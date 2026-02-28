param(
    [Parameter(Mandatory = $true)]
    [string]$CertPath,

    [Parameter(Mandatory = $true)]
    [string]$CertPassword,

    [string]$Repo = "OptimumAF/WhatShouldIPlay"
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is required. Install it and run 'gh auth login' first."
}

if (-not (Test-Path -LiteralPath $CertPath)) {
    throw "Certificate file not found: $CertPath"
}

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $CertPath))
$base64 = [System.Convert]::ToBase64String($bytes)

$base64 | gh secret set WINDOWS_CERT_BASE64 --repo $Repo
$CertPassword | gh secret set WINDOWS_CERT_PASSWORD --repo $Repo

Write-Host "Updated secrets on $Repo:"
Write-Host "  - WINDOWS_CERT_BASE64"
Write-Host "  - WINDOWS_CERT_PASSWORD"
