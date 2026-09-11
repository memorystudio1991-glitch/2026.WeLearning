@echo off
title AI_DAY2 Skeleton App
cd /d "%~dp0"

echo ===================================================
echo   AI_DAY2: WebCam Skeleton Tracker
echo ===================================================
echo Starting app... (Press 'q' in the camera window to exit)
echo.

if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" skeleton_app.py
) else (
    echo Virtual environment not found. Setting up...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    python skeleton_app.py
)

if errorlevel 1 (
    echo.
    echo An error occurred.
    pause
)
