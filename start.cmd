@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "HOST=127.0.0.1"
set "PORT=7788"
set "URL=http://%HOST%:%PORT%"
set "DRY_RUN="

if /I "%~1"=="--dry-run" set "DRY_RUN=1"

cd /d "%ROOT%"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] python was not found. Install Python or add it to PATH.
  pause
  exit /b 1
)

python -c "import fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
  echo [INFO] FastAPI or uvicorn was not found. Installing VulnClaw web dependencies...
  python -m pip install -e ".[web]"
  if errorlevel 1 (
    echo [ERROR] Failed to install Web UI dependencies.
    echo [ERROR] Try running: python -m pip install -e ".[web]"
    pause
    exit /b 1
  )
)

if defined DRY_RUN (
  echo [DRY-RUN] Root: %ROOT%
  echo [DRY-RUN] Web UI: %URL%
  echo [DRY-RUN] Backend command: python -m vulnclaw.cli.main web --host %HOST% --port %PORT%
  echo [DRY-RUN] CLI command: python -m vulnclaw.cli.main
  exit /b 0
)

if not exist "frontend\dist\index.html" (
  echo [INFO] frontend\dist\index.html was not found. Building Web UI...
  if not exist "frontend\package.json" (
    echo [WARN] frontend\package.json was not found. Skipping frontend build.
  ) else (
    where npm >nul 2>nul
    if errorlevel 1 (
      echo [WARN] npm was not found. Skipping frontend build.
      echo [WARN] Web UI may show the fallback page.
    ) else (
      pushd "frontend"
      if not exist "node_modules" (
        echo [INFO] node_modules was not found. Running npm install...
        call npm install
        if errorlevel 1 (
          popd
          echo [ERROR] npm install failed.
          pause
          exit /b 1
        )
      )
      call npm run build
      if errorlevel 1 (
        popd
        echo [ERROR] Web UI build failed.
        pause
        exit /b 1
      )
      popd
    )
  )
)

echo [INFO] Starting VulnClaw Web UI: %URL%
start "VulnClaw Web UI" /D "%ROOT%" cmd /k "python -m vulnclaw.cli.main web --host %HOST% --port %PORT%"

echo [INFO] Starting VulnClaw CLI / REPL...
start "VulnClaw CLI" /D "%ROOT%" cmd /k "python -m vulnclaw.cli.main"

echo [INFO] Opening browser after the Web UI starts...
timeout /t 3 /nobreak >nul
start "" "%URL%"

echo [OK] Started. Web UI: %URL%
endlocal
