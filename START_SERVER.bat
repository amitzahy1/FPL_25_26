@echo off
REM FPL Analytics Hub - Local Server Starter (Windows)

echo.
echo ========================================
echo   FPL Pro Analytics Hub
echo   Local Development Server
echo ========================================
echo.
echo Starting server...
echo.
echo IMPORTANT:
echo   - Server will run on http://localhost:8000
echo   - Press Ctrl+C to stop the server
echo   - Open your browser to: http://localhost:8000
echo.
echo ========================================
echo.

REM Try Python 3 first
python -m http.server 8000 2>NUL

REM If Python 3 doesn't work, try Python 2
if %errorlevel% neq 0 (
    echo Python 3 not found, trying Python 2...
    python -m SimpleHTTPServer 8000
)

REM If both fail
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Python not found!
    echo.
    echo Please install Python from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
)

