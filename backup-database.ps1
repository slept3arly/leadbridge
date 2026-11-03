$ErrorActionPreference = "Stop"

# ==================================================
# CONFIGURATION
# ==================================================

$AppPath = "C:\Development\leadbridge"

$PrimaryRoot = "D:\leadbridge-backups"
$SecondaryRoot = "\\Server-rd\D\leadbridge-backups"

$Retention = @{
    daily   = 7
    weekly  = 4
    monthly = 12
}

$PostgresBin = "C:\Program Files\PostgreSQL\18\bin"
$PgDump = Join-Path $PostgresBin "pg_dump.exe"
$PgRestore = Join-Path $PostgresBin "pg_restore.exe"

$LogDirectory = Join-Path $PrimaryRoot "logs"
$PendingDirectory = Join-Path $PrimaryRoot ".pending"
$TempDirectory = Join-Path $PrimaryRoot ".temp"
$LockFile = Join-Path $PrimaryRoot ".backup-running.lock"

# ==================================================
# INITIALIZATION
# ==================================================

foreach ($directory in @(
    $PrimaryRoot,
    $LogDirectory,
    $PendingDirectory,
    $TempDirectory
)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

foreach ($category in $Retention.Keys) {
    New-Item -ItemType Directory -Force `
        -Path (Join-Path $PrimaryRoot $category) | Out-Null
}

$LogFile = Join-Path $LogDirectory (
    "backup-" + (Get-Date -Format "yyyy-MM") + ".log"
)

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"

    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

# ==================================================
# LOCK
# ==================================================

if (Test-Path $LockFile) {
    $lockAge = (Get-Date) - (Get-Item $LockFile).LastWriteTime

    if ($lockAge.TotalHours -lt 6) {
        Write-Log "Another backup process appears to be running." "WARNING"
        exit 1
    }

    Write-Log "Removing stale lock file." "WARNING"
    Remove-Item $LockFile -Force
}

New-Item -ItemType File -Path $LockFile -Force | Out-Null

# ==================================================
# DATABASE CONNECTION
# ==================================================

function Set-DatabaseEnvironment {
    $EnvFile = Join-Path $AppPath ".env"

    if (-not (Test-Path $EnvFile)) {
        throw ".env file not found."
    }

    $DatabaseUrl = $null

    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.*?)\s*$') {
            $DatabaseUrl = $matches[1].Trim()

            if (
                ($DatabaseUrl.StartsWith('"') -and $DatabaseUrl.EndsWith('"')) -or
                ($DatabaseUrl.StartsWith("'") -and $DatabaseUrl.EndsWith("'"))
            ) {
                $DatabaseUrl = $DatabaseUrl.Substring(
                    1,
                    $DatabaseUrl.Length - 2
                )
            }

            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
        throw "DATABASE_URL not found in .env."
    }

    try {
        $uri = [System.Uri]::new($DatabaseUrl)

        if ($uri.Scheme -notin @("postgres", "postgresql")) {
            throw "Unsupported database URL scheme."
        }

        $userInfo = $uri.UserInfo.Split(":", 2)

        if ($userInfo.Count -ne 2) {
            throw "Database URL must contain a username and password."
        }

        $env:PGHOST = $uri.Host
        $env:PGPORT = if ($uri.Port -gt 0) { "$($uri.Port)" } else { "5432" }
        $env:PGUSER = [System.Uri]::UnescapeDataString($userInfo[0])
        $env:PGPASSWORD = [System.Uri]::UnescapeDataString($userInfo[1])
        $env:PGDATABASE = [System.Uri]::UnescapeDataString(
            $uri.AbsolutePath.TrimStart("/")
        )

        # Apply sslmode if specified in the URL.
        $env:PGSSLMODE = "prefer"

        if ($uri.Query) {
            foreach ($parameter in $uri.Query.TrimStart("?").Split("&")) {
                $parts = $parameter.Split("=", 2)

                if ($parts.Count -eq 2 -and $parts[0] -eq "sslmode") {
                    $env:PGSSLMODE = [System.Uri]::UnescapeDataString($parts[1])
                }
            }
        }

        if (
            [string]::IsNullOrWhiteSpace($env:PGHOST) -or
            [string]::IsNullOrWhiteSpace($env:PGUSER) -or
            [string]::IsNullOrWhiteSpace($env:PGPASSWORD) -or
            [string]::IsNullOrWhiteSpace($env:PGDATABASE)
        ) {
            throw "Incomplete database connection details."
        }
    }
    catch {
        throw "Could not parse DATABASE_URL: $($_.Exception.Message)"
    }
}

# ==================================================
# DATABASE BACKUP TOOLS
# ==================================================

function Invoke-DatabaseBackup {
    param([string]$OutputFile)

    $output = & $PgDump `
        --no-password `
        --format=custom `
        "--file=$OutputFile" 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed: $($output -join ' ')"
    }

    if (-not (Test-Path $OutputFile)) {
        throw "Backup file was not created."
    }

    if ((Get-Item $OutputFile).Length -eq 0) {
        throw "Backup file is empty."
    }

    $validation = & $PgRestore --list $OutputFile 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw "Backup archive validation failed: $($validation -join ' ')"
    }
}

# ==================================================
# FILE VERIFICATION
# ==================================================

function Test-FileHashMatch {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (
        -not (Test-Path $Source) -or
        -not (Test-Path $Destination)
    ) {
        return $false
    }

    $sourceHash = (Get-FileHash $Source -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash $Destination -Algorithm SHA256).Hash

    return $sourceHash -eq $destinationHash
}

# ==================================================
# VERIFIED COPY
# ==================================================

function Copy-VerifiedBackup {
    param(
        [string]$Source,
        [string]$Destination
    )

    $destinationDirectory = Split-Path $Destination -Parent

    New-Item -ItemType Directory -Force `
        -Path $destinationDirectory | Out-Null

    $partialFile = "$Destination.partial"

    try {
        Copy-Item -LiteralPath $Source `
            -Destination $partialFile -Force

        if (-not (Test-FileHashMatch $Source $partialFile)) {
            throw "SHA-256 verification failed."
        }

        Move-Item -LiteralPath $partialFile `
            -Destination $Destination -Force

        if (-not (Test-FileHashMatch $Source $Destination)) {
            throw "Final destination verification failed."
        }
    }
    catch {
        Remove-Item $partialFile -Force -ErrorAction SilentlyContinue
        throw
    }
}

# ==================================================
# PENDING NETWORK COPIES
# ==================================================

function Save-PendingCopy {
    param(
        [string]$Source,
        [string]$Destination
    )

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Destination)
    $hash = [System.Security.Cryptography.SHA256]::HashData($bytes)
    $id = [Convert]::ToHexString($hash)

    $pendingFile = Join-Path $PendingDirectory "$id.json"
    $temporaryFile = "$pendingFile.tmp"

    $data = @{
        Source = $Source
        Destination = $Destination
    } | ConvertTo-Json

    Set-Content -Path $temporaryFile -Value $data -Encoding UTF8

    Move-Item -LiteralPath $temporaryFile `
        -Destination $pendingFile -Force
}

function Retry-PendingCopies {
    Write-Log "Checking pending network backups."

    $pendingFiles = Get-ChildItem $PendingDirectory `
        -Filter "*.json" -File

    foreach ($pendingFile in $pendingFiles) {
        try {
            $pending = Get-Content $pendingFile.FullName -Raw |
                ConvertFrom-Json

            if (-not (Test-Path $pending.Source)) {
                Write-Log "Pending source missing: $($pending.Source)" "ERROR"
                continue
            }

            Copy-VerifiedBackup `
                -Source $pending.Source `
                -Destination $pending.Destination

            Remove-Item $pendingFile.FullName -Force

            Write-Log "Pending network backup verified: $($pending.Destination)"
        }
        catch {
            Write-Log "Pending copy failed: $($_.Exception.Message)" "WARNING"
        }
    }
}

# ==================================================
# BACKUP CALENDAR
# ==================================================

function Get-BackupCategories {
    $today = (Get-Date).Date
    $categories = @("daily")

    if ($today.DayOfWeek -eq [DayOfWeek]::Saturday) {
        $categories += "weekly"
    }

    $lastDay = [datetime]::new(
        $today.Year,
        $today.Month,
        [datetime]::DaysInMonth($today.Year, $today.Month)
    )

    if ($lastDay.DayOfWeek -eq [DayOfWeek]::Saturday) {
        $monthlyDate = $lastDay.AddDays(-1)
    }
    elseif ($lastDay.DayOfWeek -eq [DayOfWeek]::Sunday) {
        $monthlyDate = $lastDay.AddDays(-2)
    }
    else {
        $monthlyDate = $lastDay
    }

    if ($today -eq $monthlyDate.Date) {
        $categories += "monthly"
    }

    return $categories
}

# ==================================================
# CREATE BACKUP
# ==================================================

function Create-Backup {
    param([string[]]$Categories)

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupName = "leadbridge_$timestamp.dump"
    $tempBackup = Join-Path $TempDirectory $backupName

    Write-Log "Creating PostgreSQL backup."

    Invoke-DatabaseBackup -OutputFile $tempBackup

    Write-Log "PostgreSQL backup validated successfully."

    foreach ($category in $Categories) {
        $primaryDirectory = Join-Path $PrimaryRoot $category
        $primaryBackup = Join-Path $primaryDirectory $backupName

        Copy-VerifiedBackup `
            -Source $tempBackup `
            -Destination $primaryBackup

        Write-Log "Primary backup verified: $category/$backupName"

        $secondaryDirectory = Join-Path $SecondaryRoot $category
        $secondaryBackup = Join-Path $secondaryDirectory $backupName

        try {
            Copy-VerifiedBackup `
                -Source $primaryBackup `
                -Destination $secondaryBackup

            Write-Log "Secondary backup verified: $category/$backupName"
        }
        catch {
            Write-Log "Secondary copy failed: $($_.Exception.Message)" "WARNING"

            Save-PendingCopy `
                -Source $primaryBackup `
                -Destination $secondaryBackup

            Write-Log "Network copy queued for retry."
        }
    }

    Remove-Item $tempBackup -Force
}

# ==================================================
# RETENTION
# ==================================================

function Apply-Retention {
    param(
        [string]$Root,
        [int]$Keep,
        [bool]$ProtectPending = $false
    )

    if (-not (Test-Path $Root)) {
        return
    }

    $files = @(
        Get-ChildItem $Root -Filter "*.dump" -File |
            Sort-Object LastWriteTime -Descending
    )

    $protectedPaths = @()

    if ($ProtectPending) {
        foreach ($pendingFile in Get-ChildItem $PendingDirectory -Filter "*.json" -File) {
            try {
                $pending = Get-Content $pendingFile.FullName -Raw |
                    ConvertFrom-Json

                $protectedPaths += $pending.Source
            }
            catch {
                Write-Log "Could not read pending manifest." "WARNING"
            }
        }
    }

    $normalKept = 0

    foreach ($file in $files) {
        if ($protectedPaths -contains $file.FullName) {
            continue
        }

        if ($normalKept -lt $Keep) {
            $normalKept++
            continue
        }

        Remove-Item $file.FullName -Force

        Write-Log "Retention removed: $($file.FullName)"
    }
}

function Run-Retention {
    foreach ($category in $Retention.Keys) {
        $keep = $Retention[$category]

        Apply-Retention `
            -Root (Join-Path $PrimaryRoot $category) `
            -Keep $keep `
            -ProtectPending $true

        try {
            Apply-Retention `
                -Root (Join-Path $SecondaryRoot $category) `
                -Keep $keep
        }
        catch {
            Write-Log "Secondary retention skipped: $($_.Exception.Message)" "WARNING"
        }
    }
}

# ==================================================
# MAIN
# ==================================================

try {
    Write-Log "========================================"
    Write-Log "LeadBridge backup started."

    if (-not (Test-Path $PgDump)) {
        throw "pg_dump.exe not found: $PgDump"
    }

    if (-not (Test-Path $PgRestore)) {
        throw "pg_restore.exe not found: $PgRestore"
    }

    Set-DatabaseEnvironment

    Write-Log "Database connection configuration loaded."

    Retry-PendingCopies

    $categories = @(Get-BackupCategories)

    Write-Log "Backup categories: $($categories -join ', ')"

    Create-Backup -Categories $categories

    Run-Retention

    Write-Log "LeadBridge backup completed successfully."
}
catch {
    Write-Log "BACKUP FAILED: $($_.Exception.Message)" "ERROR"
    exit 1
}
finally {
    Remove-Item Env:\PGHOST -ErrorAction SilentlyContinue
    Remove-Item Env:\PGPORT -ErrorAction SilentlyContinue
    Remove-Item Env:\PGUSER -ErrorAction SilentlyContinue
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\PGDATABASE -ErrorAction SilentlyContinue
    Remove-Item Env:\PGSSLMODE -ErrorAction SilentlyContinue

    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}