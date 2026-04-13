@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "ACTION=%1"
if "%ACTION%"=="" set "ACTION=start"

if /i "%ACTION%"=="start" goto start
if /i "%ACTION%"=="stop" goto stop
if /i "%ACTION%"=="restart" goto restart

echo ========================================
echo    FoxBooks - Управление системой
echo ========================================
echo.
echo Использование:
echo   start.bat start   - запустить систему
echo   start.bat stop   - остановить систему
echo   start.bat restart - перезапустить систему
echo.
pause
exit /b

:start
echo ========================================
echo    FoxBooks - Запуск системы
echo ========================================
echo.

echo [1/3] Проверка Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Python не найден. Установите Python 3.12+
    pause
    exit /b 1
)

echo [2/3] Запуск бэкенда (порт 8000)...
cd /d "%~dp0backend"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo Бэкенд уже запущен (PID: %%a)
    goto skip_backend
)
start /b python -m uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1
:skip_backend
timeout /t 2 /nobreak >nul

echo [3/3] Запуск фронтенда (порт 3000)...
cd /d "%~dp0frontend"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Фронтенд уже запущен (PID: %%a)
    goto skip_frontend
)
start /b npm run dev > frontend.log 2>&1
:skip_frontend
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo    Система запущена!
echo ========================================
echo.
echo Бэкенд:   http://localhost:8000
echo Фронтенд: http://localhost:3000
echo Swagger: http://localhost:8000/docs
echo.
echo Логи: backend.log frontend.log
echo.
echo Для остановки: start.bat stop
echo.
pause
exit /b

:stop
echo ========================================
echo    FoxBooks - Остановка системы
echo ========================================
echo.

echo Остановка процессов на портах 8000 и 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo Остановка бэкенда (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Остановка фронтенда (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Система остановлена.
echo.
pause
exit /b

:restart
echo Перезапуск системы...
call :stop
timeout /t 2 /nobreak >nul
call :start
exit /b