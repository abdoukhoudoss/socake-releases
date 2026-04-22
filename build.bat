@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════╗
echo  ║       SoCake - Build .exe            ║
echo  ╚══════════════════════════════════════╝
echo.

REM ── Vérifie que le binaire Electron existe ──────────────────
if not exist "binaries\electron30\better_sqlite3.node" (
    echo [ERREUR] binaries\electron30\better_sqlite3.node introuvable.
    pause & exit /b 1
)
if not exist "binaries\node20\better_sqlite3.node" (
    echo [ERREUR] binaries\node20\better_sqlite3.node introuvable.
    pause & exit /b 1
)

REM ── Arrête le serveur Node si actif ────────────────────────
echo [1/4] Arret du serveur Node si actif...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq SoCake*" >nul 2>&1
timeout /t 1 /nobreak >nul

REM ── Place le binaire Electron ───────────────────────────────
echo [2/4] Preparation du binaire Electron 30...
copy /Y "binaries\electron30\better_sqlite3.node" "node_modules\better-sqlite3\build\Release\better_sqlite3.node" >nul
echo      OK

REM ── Build ───────────────────────────────────────────────────
echo [3/4] Build en cours (peut prendre 1-2 minutes)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] Build echoue.
    REM Restaure quand meme le binaire Node
    copy /Y "binaries\node20\better_sqlite3.node" "node_modules\better-sqlite3\build\Release\better_sqlite3.node" >nul
    pause & exit /b 1
)

REM ── Restaure le binaire Node 20 (localhost) ─────────────────
echo [4/4] Restauration du binaire Node (localhost)...
copy /Y "binaries\node20\better_sqlite3.node" "node_modules\better-sqlite3\build\Release\better_sqlite3.node" >nul
echo      OK

echo.
echo  ✓ Build termine ! Fichiers dans : dist\
echo  ✓ Localhost restaure : node server.js
echo.
echo  → dist\SoCake Setup 2.0.0.exe   (installeur)
echo  → dist\SoCake-Portable-2.0.0.exe (portable)
echo.
pause
