# 🚀 Odoo DevLogs

Système complet de visualisation et d'analyse des commits Odoo avec interface web moderne.

## 📁 Structure du projet

```
OdooDevLogs/
│
├── 📂 backend/              # API REST FastAPI
│   └── api.py              # Serveur API avec tous les endpoints
│
├── 📂 database/            # Base de données
│   ├── schema.sql          # Structure PostgreSQL
│   └── init_db.py          # Script d'initialisation
│
├── 📂 scripts/             # Scripts d'import
│   └── fetch_commits.py    # Import des commits depuis GitHub
│
├── 📂 frontend/            # Interface web
│   ├── index.html          # Page principale
│   ├── style.css           # Styles (dark theme)
│   └── app.js              # Logique applicative
│
├── 📂 docs/                # Documentation
│   ├── README.md           # Documentation complète
│   ├── QUICKSTART.md       # Guide rapide
│   └── CLAUDE.md           # Guide pour Claude Code
│
├── 📂 .venv/               # Environnement virtuel Python
│
├── 📄 .env                 # Configuration (ne pas commiter!)
├── 📄 .env.example         # Template de configuration
├── 📄 .gitignore           # Fichiers à ignorer
├── 📄 requirements.txt     # Dépendances Python
├── 📄 start.bat            # Lanceur Windows
├── 📄 start.sh             # Lanceur Linux/Mac
└── 📄 README.md            # Ce fichier
```

## 🚀 Démarrage rapide

### Option 1 : Lancement automatique (recommandé)

**Windows :**
```bash
# Double-cliquer sur start.bat
# OU
start.bat
```

**Linux/Mac :**
```bash
chmod +x start.sh
./start.sh
```

Le script va :
1. ✅ Vérifier l'environnement virtuel
2. ✅ Installer les dépendances
3. ✅ Lancer l'API backend (port 8000)
4. ✅ Lancer le serveur web (port 3000)
5. ✅ Ouvrir automatiquement le navigateur

### Option 2 : Lancement manuel

```bash
# Terminal 1 - API
.venv\Scripts\activate
cd backend
python api.py

# Terminal 2 - Web
.venv\Scripts\activate
cd frontend
python -m http.server 3000
```

## 📋 Installation initiale

### 1. Prérequis
- Python 3.11+
- PostgreSQL 12+
- Git

### 2. Installer les dépendances

```bash
# Créer l'environnement virtuel
python -m venv .venv

# Activer l'environnement
.venv\Scripts\activate     # Windows
source .venv/bin/activate  # Linux/Mac

# Installer les packages
pip install -r requirements.txt
```

### 3. Configuration

```bash
# Le fichier .env sera créé automatiquement au premier lancement
# Sinon, le créer manuellement :
cp .env.example .env

# Éditer .env avec vos identifiants
```

Variables requises dans `.env` :
```env
GITHUB_TOKEN=your_token_here
DB_USER=your_username
DB_PASSWORD=your_password
DB_HOST=localhost
DB_NAME=odoo_devlog
```

### 4. Initialiser la base de données

```bash
# Créer la base PostgreSQL
createdb odoo_devlog

# Initialiser le schéma
.venv\Scripts\activate
cd database
python init_db.py
```

## 📥 Import des commits

### Première fois (tous les commits)
```bash
.venv\Scripts\activate
cd scripts
python fetch_commits.py full
```
⚠️ **Peut prendre plusieurs heures !**

### Mises à jour régulières (nouveaux commits uniquement)
```bash
.venv\Scripts\activate
cd scripts
python fetch_commits.py
```
✅ **Rapide - Seulement les nouveaux**

## 🌐 Accès

Une fois lancé :

- **Interface Web** : http://localhost:3000
- **API Backend** : http://localhost:8000
- **Documentation API** : http://localhost:8000/docs

## 🎯 Fonctionnalités

### 📊 Dashboard
- Statistiques globales (commits, contributeurs, lignes modifiées)
- Top 10 des contributeurs
- Vue d'ensemble complète

### 📝 Commits
- Liste paginée des commits
- Filtres par dépôt, branche, auteur, message
- Détails complets de chaque commit
- Liste des fichiers modifiés

### 🔄 Comparaison
- Comparaison côte à côte de deux branches
- Commits uniques à chaque branche
- Statistiques comparatives détaillées

### 📈 Statistiques
- Analyses détaillées
- Top contributeurs
- Lignes ajoutées/supprimées

## 🛠️ Développement

### Ajouter un nouveau dépôt

Éditer `database/init_db.py` et `scripts/fetch_commits.py` :

```python
REPOSITORIES = [
    "odoo/odoo",
    "odoo/enterprise",
    "votre-org/votre-repo"  # Ajouter ici
]
```

### Ajouter une nouvelle branche

Éditer `scripts/fetch_commits.py` :

```python
BRANCHES = ["17.0", "18.0", "master", "19.0"]  # Ajouter ici
```

## 📚 Documentation complète

Pour plus de détails, consultez :
- [docs/QUICKSTART.md](docs/QUICKSTART.md) - Guide de démarrage rapide
- [docs/README.md](docs/README.md) - Documentation complète
- [docs/CLAUDE.md](docs/CLAUDE.md) - Architecture technique

## 🐛 Troubleshooting

### start.bat ne fonctionne pas
- Vérifier que Python est dans le PATH
- Vérifier que l'environnement virtuel existe : `.venv/`
- Réinstaller les dépendances : `pip install -r requirements.txt`

### L'interface web est blanche
- Vérifier que l'API tourne sur http://localhost:8000
- Ouvrir la console du navigateur (F12) pour voir les erreurs
- Vérifier que le .env est configuré correctement

### Pas de commits affichés
- Lancer l'import : `cd scripts && python fetch_commits.py full`
- Vérifier les logs : `fetch_commits.log`
- Vérifier la BDD : `SELECT COUNT(*) FROM odoo_devlog.commits;`

## 📄 Licence

Ce projet est à usage interne/éducatif.

## 👤 Auteur

Lucky43 (Lucas Bruyère)
