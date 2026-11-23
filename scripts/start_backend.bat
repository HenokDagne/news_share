@echo off
echo ===================================================
echo [1/3] Checking PostgreSQL Database on port 5432...
echo ===================================================
netstat -ano | findstr "5432" >nul
if %ERRORLEVEL% equ 0 (
    echo PostgreSQL is already running on port 5432.
) else (
    echo Starting PostgreSQL server...
    start /B "" "C:\Program Files\PostgreSQL\16\bin\postgres.exe" -D "C:\Program Files\PostgreSQL\16\data"
    timeout /t 3 /nobreak >nul
    echo PostgreSQL started!
)

echo.
echo ===================================================
echo [2/3] Checking ADB Reverse Port Forwarding...
echo ===================================================
where adb >nul 2>&1
if %ERRORLEVEL% equ 0 (
    adb reverse tcp:3000 tcp:3000 2>nul
    echo ADB reverse port 3000 configured.
) else (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" reverse tcp:3000 tcp:3000 2>nul
        echo ADB reverse port 3000 configured via Android SDK.
    ) else (
        echo ADB not found or no device connected.
    )
)

echo.
echo ===================================================
echo [3/3] Starting NestJS Backend Server on port 3000...
echo ===================================================
cd /d "%~dp0..\backend"
npm run start:dev
