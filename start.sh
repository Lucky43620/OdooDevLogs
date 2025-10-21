#!/bin/bash

echo "========================================"
echo "  Odoo DevLogs - Démarrage complet"
echo "========================================"
echo ""

# Vérifier si .venv existe
if [ ! -d ".venv" ]; then
    echo "[ERREUR] Environnement virtuel non trouvé!"
    echo "Veuillez exécuter: python -m venv .venv"
    exit 1
fi

# Vérifier le fichier .env
if [ ! -f ".env" ]; then
    echo "[AVERTISSEMENT] Fichier .env non trouvé!"
    echo "Copie de .env.example vers .env..."
    cp .env.example .env
    echo ""
    echo "IMPORTANT: Éditez le fichier .env avec vos identifiants!"
    read -p "Appuyez sur Entrée pour continuer..."
fi

# Activer l'environnement virtuel
echo "[1/4] Activation de l'environnement virtuel..."
source .venv/bin/activate

# Vérifier les dépendances
echo "[2/4] Vérification des dépendances..."
pip install -q -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERREUR] Installation des dépendances échouée!"
    exit 1
fi

# Fonction pour arrêter les processus
cleanup() {
    echo ""
    echo "Arrêt des serveurs..."
    kill $API_PID $WEB_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Démarrer l'API en arrière-plan
echo "[3/4] Démarrage de l'API backend..."
cd backend
python api.py &
API_PID=$!
cd ..
sleep 3

# Démarrer le serveur web en arrière-plan
echo "[4/4] Démarrage du serveur web..."
cd frontend
python -m http.server 3000 &
WEB_PID=$!
cd ..
sleep 2

echo ""
echo "========================================"
echo "  Démarrage terminé!"
echo "========================================"
echo ""
echo "  API Backend:     http://localhost:8000"
echo "  Documentation:   http://localhost:8000/docs"
echo "  Interface Web:   http://localhost:3000"
echo ""
echo "========================================"
echo ""
echo "Ouverture de l'interface web..."

# Ouvrir le navigateur selon l'OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 2>/dev/null || echo "Ouvrez manuellement: http://localhost:3000"
fi

echo ""
echo "Application lancée!"
echo ""
echo "Pour arrêter l'application, appuyez sur Ctrl+C"
echo ""

# Attendre
wait
