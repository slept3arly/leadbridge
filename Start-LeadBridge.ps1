
$ErrorActionPreference = "Stop"

# ==================================================
# CONFIGURATION
# ==================================================

$AppPath = "C:\Development\leadbridge"
$AppUrl = "http://192.168.29.105:3000"
$Port = 3000

$PostgresService = "postgresql-x64-18"

$LogDirectory = Join-Path $AppPath "logs"
$LogFile = Join-Path $LogDirectory "deployment-$(Get-Date -Format 'yyyy-MM-dd').log"

$PreviousBuild = Join-Path $AppPath ".next.previous"
$CurrentBuild = Join-Path $AppPath ".next"

# ==================================================
# LOGGING
# ==================================================

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"

    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

function Invoke-CheckedCommand {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Description
    )

    Write-Log $Description

    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

# ==================================================
# DEPLOYMENT
# ==================================================

try {
    Write-Log "========================================"
    Write-Log "LeadBridge deployment started."

    Set-Location $AppPath

    # Node and pnpm.
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js not found in PATH."
    }

    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw "pnpm not found in PATH."
    }

    Write-Log "Node: $(node --version)"
    Write-Log "pnpm: $(pnpm --version)"

    # PostgreSQL.
    Write-Log "Checking PostgreSQL..."

    $postgres = Get-Service -Name $PostgresService -ErrorAction Stop

    if ($postgres.Status -ne "Running") {
        Start-Service -Name $PostgresService
        $postgres.WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
    }

    Write-Log "PostgreSQL is running."

    # Stop only a process identified as this LeadBridge installation.
    $connections = @(
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    )

    foreach ($connection in $connections) {
        $processId = $connection.OwningProcess

        $process = Get-CimInstance Win32_Process `
            -Filter "ProcessId = $processId"

        if (
            $process -and
            $process.Name -eq "node.exe" -and
            $process.CommandLine -match [regex]::Escape($AppPath)
        ) {
            Write-Log "Stopping existing LeadBridge process $processId."
            Stop-Process -Id $processId -Force
        }
        else {
            throw "Port $Port is occupied by another process. PID: $processId"
        }
    }

    Start-Sleep -Seconds 2

    # Dependencies.
    Invoke-CheckedCommand "pnpm" `
        @("install", "--frozen-lockfile") `
        "Installing dependencies."

    # Prisma Client only. Never run migrations automatically.
    Invoke-CheckedCommand "pnpm" `
        @("db:generate") `
        "Generating Prisma Client."

    # Increase Node.js heap for build.
    $PreviousNodeOptions = $env:NODE_OPTIONS
    $env:NODE_OPTIONS = "--max-old-space-size=6144"

    try {
        # Preserve previous production build.
        if (Test-Path $PreviousBuild) {
            Remove-Item $PreviousBuild -Recurse -Force
        }

        if (Test-Path $CurrentBuild) {
            Rename-Item $CurrentBuild ".next.previous"
        }

        # Build latest application.
        Invoke-CheckedCommand "pnpm" `
            @("build") `
            "Building Next.js production application."

        if (-not (Test-Path $CurrentBuild)) {
            throw "Next.js build directory was not created."
        }

        Write-Log "Production build completed."
    }
    catch {
        Write-Log "New build failed. Restoring previous build." "ERROR"

        if (Test-Path $CurrentBuild) {
            Remove-Item $CurrentBuild -Recurse -Force
        }

        if (Test-Path $PreviousBuild) {
            Rename-Item $PreviousBuild ".next"
        }

        throw
    }
    finally {
        $env:NODE_OPTIONS = $PreviousNodeOptions
    }

    # Start production server.
    $env:PORT = "$Port"
    $env:HOSTNAME = "0.0.0.0"

    Write-Log "Starting LeadBridge production server."
    Write-Log "Application URL: $AppUrl"

    & pnpm start -- -H 0.0.0.0

    if ($LASTEXITCODE -ne 0) {
        throw "LeadBridge server exited with code $LASTEXITCODE."
    }
}
catch {
    Write-Log "DEPLOYMENT FAILED: $($_.Exception.Message)" "ERROR"
    exit 1
}
