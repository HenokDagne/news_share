$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " STARTING NESTJS BACKEND FOR FLUTTER INTEGRATION TESTING " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$backendDir = "c:\Users\hp\workspace\Personal\news_share\backend"
$frontendDir = "c:\Users\hp\workspace\Personal\news_share\frontend\news_share"

# Start NestJS backend process
$backendProc = Start-Process node -ArgumentList "dist/main.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden

Write-Host "Backend process launched with PID $($backendProc.Id). Waiting for readiness..." -ForegroundColor Yellow

$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:3000/docs-json" -Method Get -TimeoutSec 2
        if ($res -and $res.info -and $res.info.title) {
            Write-Host "Backend is READY! API: $($res.info.title) v$($res.info.version)" -ForegroundColor Green
            $ready = $true
            break
        }
    } catch {}
}

if (-not $ready) {
    Write-Host "Error: Backend failed to start or respond on port 3000 within 15 seconds." -ForegroundColor Red
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

try {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " RUNNING FLUTTER CLIENT <-> BACKEND INTEGRATION TEST SUITE " -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    Set-Location $frontendDir
    # Run flutter test with verbose reporting
    & flutter test test/integration/client_backend_integration_test.dart --reporter=expanded
    $testExitCode = $LASTEXITCODE
} finally {
    Write-Host "`nStopping backend process PID $($backendProc.Id)..." -ForegroundColor Yellow
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Backend process terminated." -ForegroundColor Green
}

exit $testExitCode
