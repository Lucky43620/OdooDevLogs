@echo off
title Odoo DevLogs - Launcher
color 0A

echo ========================================
echo   Odoo DevLogs - Demarrage complet
echo ========================================
echo.

REM Verifier si .venv existe
if not exist ".venv" (
    echo [ERREUR] Environnement virtuel non trouve!
    echo Veuillez executer: python -m venv .venv
    pause
    exit /b 1
)

REM Verifier le fichier .env
if not exist ".env" (
    echo [AVERTISSEMENT] Fichier .env non trouve!
    echo Copie de .env.example vers .env...
    copy .env.example .env
    echo.
    echo IMPORTANT: Editez le fichier .env avec vos identifiants!
    pause
)

REM Activer l'environnement virtuel
echo [1/4] Activation de l'environnement virtuel...
call .venv\Scripts\activate.bat

REM Verifier les dependances
echo [2/4] Verification des dependances...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo [ERREUR] Installation des dependances echouee!
    pause
    exit /b 1
)

REM Demarrer l'API en arriere-plan
echo [3/4] Demarrage de l'API backend...
start "Odoo DevLogs - API" cmd /k "call .venv\Scripts\activate.bat && cd backend && python api.py"
timeout /t 3 /nobreak >nul

REM Demarrer le serveur web
echo [4/4] Demarrage du serveur web...
start "Odoo DevLogs - Web" cmd /k "call .venv\Scripts\activate.bat && cd frontend && python -m http.server 3000"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Demarrage termine!
echo ========================================
echo.
echo   API Backend:     http://localhost:8000
echo   Documentation:   http://localhost:8000/docs
echo   Interface Web:   http://localhost:3000
echo.
echo ========================================
echo.
echo Ouverture de l'interface web dans 3 secondes...
timeout /t 3 /nobreak >nul

REM Ouvrir le navigateur
start http://localhost:3000

echo.
echo Application lancee!
echo.
echo Pour arreter l'application:
echo   - Fermez les 2 fenetres "Odoo DevLogs"
echo   - Ou appuyez sur Ctrl+C dans chaque fenetre
echo.
pause
