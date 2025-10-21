# 📁 Structure du projet OdooDevLogs

## Vue d'ensemble

```
OdooDevLogs/
│
├── 📂 backend/                    # API REST
│   └── api.py                    # Serveur FastAPI (port 8000)
│
├── 📂 database/                   # Base de données
│   ├── schema.sql                # Structure PostgreSQL
│   └── init_db.py                # Initialisation BDD
│
├── 📂 scripts/                    # Scripts d'import
│   └── fetch_commits.py          # Import commits GitHub
│
├── 📂 frontend/                   # Interface web
│   ├── index.html                # Page principale
│   ├── style.css                 # Styles dark theme
│   └── app.js                    # Application JavaScript
│
├── 📂 docs/                       # Documentation
│   ├── README.md                 # Doc complète
│   ├── QUICKSTART.md             # Guide rapide
│   └── CLAUDE.md                 # Guide technique
│
├── 📂 .venv/                      # Environnement Python
│
├── 📄 .env                        # Config (SECRET!)
├── 📄 .env.example                # Template config
├── 📄 .gitignore                  # Git ignore
├── 📄 requirements.txt            # Dépendances
├── 📄 start.bat                   # Lanceur Windows 🚀
├── 📄 start.sh                    # Lanceur Linux/Mac 🚀
├── 📄 README.md                   # Readme principal
└── 📄 STRUCTURE.md                # Ce fichier
```

## 🎯 Fichiers principaux

### Configuration
- **.env** : Contient tes identifiants (GitHub token, BDD)
- **requirements.txt** : Liste des packages Python nécessaires

### Backend (API)
- **backend/api.py** :
  - Serveur FastAPI
  - 10+ endpoints REST
  - Port 8000
  - Documentation auto : `/docs`

### Base de données
- **database/schema.sql** :
  - Structure complète PostgreSQL
  - 12 tables (commits, branches, files, etc.)

- **database/init_db.py** :
  - Crée le schéma
  - Initialise les dépôts
  - Récupère les branches

### Scripts
- **scripts/fetch_commits.py** :
  - Import des commits depuis GitHub
  - Mode incrémental ou complet
  - Gestion du rate limiting
  - Logs détaillés

### Frontend (Interface web)
- **frontend/index.html** : Structure HTML
- **frontend/style.css** : Design moderne dark theme
- **frontend/app.js** : Logique complète
  - 4 vues (Dashboard, Commits, Compare, Stats)
  - Communication avec l'API
  - Filtres et recherche

## 🚀 Démarrage

### Méthode simple (recommandé)

**Windows :**
```bash
start.bat
```

**Linux/Mac :**
```bash
./start.sh
```

Le script lance :
1. API backend → http://localhost:8000
2. Serveur web → http://localhost:3000
3. Ouvre le navigateur automatiquement

### Ce que fait start.bat/start.sh

1. ✅ Vérifie l'environnement virtuel
2. ✅ Vérifie le fichier .env
3. ✅ Installe les dépendances
4. ✅ Lance l'API en arrière-plan
5. ✅ Lance le serveur web
6. ✅ Ouvre le navigateur

## 📊 Workflow complet

### 1️⃣ Installation initiale
```bash
# Créer l'environnement
python -m venv .venv

# Installer dépendances
.venv\Scripts\activate
pip install -r requirements.txt

# Créer la BDD
createdb odoo_devlog

# Initialiser
cd database
python init_db.py
```

### 2️⃣ Premier import
```bash
cd scripts
python fetch_commits.py full
```
⏱️ Peut prendre plusieurs heures !

### 3️⃣ Lancer l'application
```bash
# Depuis la racine
start.bat
```

### 4️⃣ Utiliser l'interface
- Dashboard : Statistiques
- Commits : Liste et détails
- Compare : Comparaison branches
- Stats : Analyses

### 5️⃣ Mises à jour quotidiennes
```bash
cd scripts
python fetch_commits.py  # Mode incrémental
```

## 🔄 Flux de données

```
GitHub API
    ↓
fetch_commits.py → PostgreSQL → api.py → frontend (navigateur)
    ↓                              ↓
fetch_commits.log            localhost:8000
```

## 📦 Dépendances principales

### Backend
- `fastapi` : Framework API
- `uvicorn` : Serveur ASGI
- `psycopg2-binary` : PostgreSQL
- `PyGithub` : Client GitHub API
- `python-dotenv` : Variables d'environnement

### Frontend
- Vanilla JavaScript (pas de framework)
- CSS moderne (dark theme)
- Fetch API pour communication

## 🗄️ Base de données

### Tables principales
1. **repositories** : Dépôts GitHub
2. **branches** : Branches par dépôt
3. **commits** : Tous les commits
4. **file_changes** : Fichiers modifiés
5. **import_log** : Suivi des imports

### Schéma
```
repositories → branches → commits → file_changes
                            ↓
                      commit_parents
```

## 🌐 Endpoints API

- `GET /` : Info API
- `GET /repositories` : Liste dépôts
- `GET /repositories/{id}/branches` : Branches
- `GET /branches/{id}/commits` : Liste commits
- `GET /commits/{id}` : Détails commit
- `GET /compare` : Comparer branches
- `GET /stats/summary` : Stats globales
- `GET /stats/top-contributors` : Top contributeurs

## 🎨 Interface Web

### Pages
1. **Dashboard** : Vue d'ensemble
2. **Commits** : Liste avec filtres
3. **Compare** : Comparaison branches
4. **Stats** : Analyses détaillées

### Fonctionnalités
- ✅ Pagination
- ✅ Recherche
- ✅ Filtres (auteur, message)
- ✅ Modal détails
- ✅ Design responsive
- ✅ Dark theme

## 📝 Logs et monitoring

- **fetch_commits.log** : Logs d'import
- **Console API** : Requêtes HTTP
- **Table import_log** : Historique imports

## ⚙️ Configuration

### .env
```env
GITHUB_TOKEN=ghp_xxxxx
DB_USER=username
DB_PASSWORD=password
DB_HOST=localhost
DB_NAME=odoo_devlog
DB_PORT=5432
MAX_COMMITS_PER_BRANCH=0
API_HOST=0.0.0.0
API_PORT=8000
```

## 🔧 Personnalisation

### Ajouter un dépôt
Modifier dans `database/init_db.py` et `scripts/fetch_commits.py` :
```python
REPOSITORIES = ["odoo/odoo", "odoo/enterprise", "nouveau/depot"]
```

### Ajouter une branche
Modifier dans `scripts/fetch_commits.py` :
```python
BRANCHES = ["17.0", "18.0", "master", "19.0"]
```

## 🚨 Troubleshooting

| Problème | Solution |
|----------|----------|
| start.bat ne marche pas | Vérifier que .venv existe |
| Page web blanche | Vérifier que l'API tourne (port 8000) |
| Pas de commits | Lancer `fetch_commits.py full` |
| Erreur BDD | Vérifier PostgreSQL + .env |

## 📚 Documentation

- [README.md](README.md) : Vue d'ensemble
- [docs/QUICKSTART.md](docs/QUICKSTART.md) : Démarrage rapide
- [docs/README.md](docs/README.md) : Documentation complète
- [docs/CLAUDE.md](docs/CLAUDE.md) : Architecture technique

---

✅ **Projet organisé et prêt à l'emploi !**
