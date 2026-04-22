@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       SoCake - Publier une mise à jour       ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM ── Vérifie le token GitHub ─────────────────────────────────
if "%GH_TOKEN%"=="" (
    echo [ERREUR] Variable GH_TOKEN non définie.
    echo.
    echo  Comment faire :
    echo  1. Allez sur https://github.com/settings/tokens
    echo  2. "Generate new token (classic)"
    echo  3. Cochez la case "repo"
    echo  4. Copiez le token généré
    echo  5. Dans ce terminal, tapez :
    echo     set GH_TOKEN=votre_token_ici
    echo  6. Relancez release.bat
    echo.
    pause & exit /b 1
)

REM ── Lit la version actuelle ─────────────────────────────────
for /f "tokens=*" %%v in ('node -e "process.stdout.write(require('./package.json').version)"') do set CURRENT=%%v
echo  Version actuelle : %CURRENT%
echo.

REM ── Choisit le type de version ─────────────────────────────
echo  Quel type de mise à jour ?
echo  [1] Correction de bug   (2.0.0 → 2.0.1)
echo  [2] Nouvelle fonctionnalité  (2.0.0 → 2.1.0)
echo  [3] Version majeure     (2.0.0 → 3.0.0)
echo.
set /p CHOICE="Votre choix (1/2/3) : "

if "%CHOICE%"=="1" set BUMP=patch
if "%CHOICE%"=="2" set BUMP=minor
if "%CHOICE%"=="3" set BUMP=major

if "%BUMP%"=="" (
    echo Choix invalide.
    pause & exit /b 1
)

REM ── Incrémente la version ───────────────────────────────────
for /f "tokens=*" %%v in ('node -e "const s=require('./package.json').version.split('.').map(Number);if('%BUMP%'=='patch'){s[2]++}else if('%BUMP%'=='minor'){s[1]++;s[2]=0}else{s[0]++;s[1]=0;s[2]=0};process.stdout.write(s.join('.'))"') do set NEW_VERSION=%%v

echo.
echo  Nouvelle version : %NEW_VERSION%
echo.
set /p CONFIRM="Confirmer et publier ? (o/n) : "
if /i not "%CONFIRM%"=="o" ( echo Annulé. & pause & exit /b 0 )

REM ── Met à jour package.json ─────────────────────────────────
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.version='%NEW_VERSION%';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');console.log('package.json mis à jour')"

REM ── Place le binaire Electron ───────────────────────────────
echo.
echo [1/3] Préparation du binaire Electron...
copy /Y "binaries\electron30\better_sqlite3.node" "node_modules\better-sqlite3\build\Release\better_sqlite3.node" >nul

REM ── Build + Publish ─────────────────────────────────────────
echo [2/3] Build et publication sur GitHub...
call npm run build -- --publish always
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Build ou publication échouée.
    copy /Y "binaries\node20\better_sqlite3.node" "node_modules\better-sqlite3\build\Release\better_sqlite3.node" >nul
    pause & exit /b 1
)

REM ── Restaure le binaire Node ────────────────────────────────
echo [3/3] Restauration binaire Node (localhost)...
copy /Y "binaries\node20\better_sqlite3.node" "node_modules\better-sqlite3\build\Release\better_sqlite3.node" >nul

echo.
echo  ✓ Version %NEW_VERSION% publiée sur GitHub !
echo  ✓ L'appli installée proposera la mise à jour au prochain démarrage.
echo.
pause
