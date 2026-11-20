@echo off
echo Starting PostgreSQL server...
netstat -ano | findstr "5432" >nul
if %ERRORLEVEL% equ 0 (
    echo PostgreSQL is already running on port 5432.
) else (
    start /B "" "C:\Program Files\PostgreSQL\16\bin\postgres.exe" -D "C:\Program Files\PostgreSQL\16\data"
    timeout /t 3 /nobreak >nul
    echo PostgreSQL server is now running on port 5432.
)
pause
