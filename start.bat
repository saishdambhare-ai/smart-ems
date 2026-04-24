@echo off
title EMS Launcher
color 0A
echo.
echo  ==========================================
echo   Employee Management System — Launcher
echo  ==========================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Install from https://nodejs.org
    pause
    exit
)

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install from https://python.org
    pause
    exit
)

REM Check node_modules
if not exist "node_modules" (
    echo [INFO] Installing Node.js packages...
    npm install
    echo [INFO] Done installing packages.
    echo.
)

REM Check ml_service datasets
if not exist "ml_service\salary_dataset.csv" (
    echo [INFO] Generating ML datasets...
    cd ml_service
    python generate_dataset.py
    cd ..
    echo.
)

echo [INFO] Starting ML service on port 5001...
start "EMS ML Service" cmd /k "cd ml_service && pip install flask flask-cors scikit-learn pandas numpy -q && python ml_server.py"

echo [INFO] Waiting 5 seconds for ML service to start...
timeout /t 5 /nobreak >nul

echo [INFO] Starting Node.js server on port 3000...
start "EMS Node Server" cmd /k "node server.js"

echo [INFO] Waiting 3 seconds for server to start...
timeout /t 3 /nobreak >nul

echo.
echo  ==========================================
echo   App is running at: http://localhost:3000
echo   Admin login: admin / admin123
echo  ==========================================
echo.

start "" "http://localhost:3000"
pause