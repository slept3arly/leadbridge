$ErrorActionPreference = "Stop"

$AppPath = "C:\Development\leadbridge"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "        LeadBridge Production Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Checking PostgreSQL..." -ForegroundColor Yellow

$postgres = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue

if (-not $postgres) {
    Write-Host "ERROR: PostgreSQL service was not found." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if ($postgres.Status -ne "Running") {
    Write-Host "PostgreSQL is not running. Starting it..." -ForegroundColor Yellow
    Start-Service -Name "postgresql-x64-18"
    Start-Sleep -Seconds 3
}

Write-Host "PostgreSQL: Running" -ForegroundColor Green

Write-Host ""
Write-Host "[2/3] Starting LeadBridge..." -ForegroundColor Yellow

Set-Location $AppPath

Write-Host "Application: $AppPath" -ForegroundColor Gray
Write-Host "URL: http://192.168.29.105:3000" -ForegroundColor Gray
Write-Host ""

Write-Host "[3/3] Next.js production server starting..." -ForegroundColor Yellow
Write-Host "Keep this window open while LeadBridge is running." -ForegroundColor Gray
Write-Host ""

pnpm start -- -H 0.0.0.0