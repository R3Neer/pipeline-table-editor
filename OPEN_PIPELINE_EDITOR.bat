@echo off
setlocal
cd /d "%~dp0"
cd app

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Install Node.js before opening the app.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependencies could not be installed.
    pause
    exit /b 1
  )
)

start "" cmd /c "timeout /t 2 >nul && start "" http://127.0.0.1:5173/"
call npm run dev -- --host 127.0.0.1 --port 5173
