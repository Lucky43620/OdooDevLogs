# 🚀 Odoo DevLogs

Système complet de visualisation et d'analyse des commits Odoo avec interface web moderne.

## 📋 Fonctionnalités

- **Import automatique** des commits depuis GitHub (odoo/odoo et odoo/enterprise)
- **API REST** complète avec FastAPI
- **Interface web moderne** avec dark mode
- **Comparaison de branches** pour analyser les différences
- **Statistiques détaillées** sur les contributeurs et les commits
- **Recherche et filtres** avancés

## 🛠️ Installation

### 1. Prérequis
- Python 3.11+
- PostgreSQL 12+
- Git

### 2. Installation

```bash
# Cloner le projet (si applicable)
git clone <url-du-repo>
cd OdooDevLogs

# Créer l'environnement virtuel
python -m venv .venv

# Activer l'environnement virtuel
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### 3. Configuration

Copier `.env.example` vers `.env` et configurer :

```bash
cp .env.example .env
```

Éditer `.env` avec vos valeurs :
```env
GITHUB_TOKEN=votre_token_github
DB_USER=votre_utilisateur
DB_PASSWORD=votre_mot_de_passe
DB_HOST=localhost
DB_NAME=odoo_devlog
```

### 4. Initialisation de la base de données

```bash
# Créer la base PostgreSQL
createdb odoo_devlog

# Initialiser le schéma et les dépôts
python init_db.py
```

## 🚀 Utilisation

### Import des commits

```bash
# Mode incrémental (seulement les nouveaux commits)
python fetch_commits.py

# Mode complet (tous les commits)
python fetch_commits.py full
```

### Lancer l'API

```bash
python api.py
```

L'API sera accessible à : `http://localhost:8000`

Documentation interactive : `http://localhost:8000/docs`

### Lancer l'interface web

Ouvrir `web/index.html` dans un navigateur **OU** utiliser un serveur HTTP simple :

```bash
# Depuis le dossier web/
python -m http.server 3000
```

Puis ouvrir : `http://localhost:3000`

## 📁 Structure du projet

```
OdooDevLogs/
├── .env                    # Configuration (ne pas commiter!)
├── .env.example            # Template de configuration
├── requirements.txt        # Dépendances Python
├── schema.sql             # Schéma de la base de données
├── init_db.py             # Script d'initialisation
├── fetch_commits.py       # Script d'import des commits
├── api.py                 # API REST FastAPI
├── fetch_commits.log      # Logs d'import
├── web/                   # Interface web
│   ├── index.html
│   ├── style.css
│   └── app.js
├── README.md              # Ce fichier
└── CLAUDE.md              # Guide pour Claude Code
```

## 🌐 Endpoints de l'API

### Informations générales
- `GET /` - Informations API
- `GET /stats/summary` - Statistiques globales
- `GET /stats/top-contributors` - Top contributeurs

### Dépôts et branches
- `GET /repositories` - Liste des dépôts
- `GET /repositories/{repo_id}/branches` - Branches d'un dépôt

### Commits
- `GET /branches/{branch_id}/commits` - Liste des commits (avec pagination)
- `GET /commits/{commit_id}` - Détails d'un commit

### Comparaison
- `GET /compare` - Comparer deux branches
  - Paramètres : `repo_id`, `branch1`, `branch2`, `limit`

## 🎨 Fonctionnalités de l'interface web

### Dashboard
- Statistiques globales (commits, contributeurs, lignes modifiées)
- Top 10 des contributeurs

### Commits
- Liste paginée des commits
- Filtres par dépôt, branche, auteur, message
- Détails complets d'un commit (fichiers modifiés)

### Comparaison
- Comparaison côte à côte de deux branches
- Commits uniques à chaque branche
- Statistiques comparatives

## 📊 Base de données

Le schéma PostgreSQL comprend :
- `repositories` - Métadonnées des dépôts GitHub
- `branches` - Branches de chaque dépôt
- `commits` - Commits avec statistiques
- `file_changes` - Fichiers modifiés par commit
- `commit_parents` - Relations entre commits
- `modules` - Modules Odoo détectés
- `module_changes` - Changements par module
- `detected_changes` - Analyse des diffs
- `version_tracking` - Suivi des versions
- `import_log` - Logs d'import

## 🔧 Développement

### Ajouter un nouveau dépôt

Éditer `init_db.py` et `fetch_commits.py` :

```python
REPOSITORIES = [
    "odoo/odoo",
    "odoo/enterprise",
    "votre-org/votre-repo"  # Ajouter ici
]
```

### Ajouter une nouvelle branche

Éditer `fetch_commits.py` :

```python
BRANCHES = ["17.0", "18.0", "master", "19.0"]  # Ajouter ici
```

## 📝 Logs

Les logs d'import sont enregistrés dans :
- Console (stdout)
- `fetch_commits.log`
- Table `import_log` en base de données

## ⚠️ Notes importantes

- Le premier import complet peut prendre **plusieurs heures** (des milliers de commits)
- Respectez les limites de l'API GitHub (5000 requêtes/heure)
- Le script gère automatiquement le rate limiting
- Les commits sont dédupliqués par SHA

## 🐛 Troubleshooting

### Erreur d'encodage UTF-8 sur Windows
✅ Déjà géré automatiquement dans le code

### Base de données non accessible
```bash
# Vérifier que PostgreSQL est lancé
sudo systemctl status postgresql  # Linux
# Ou vérifier les services Windows
```

### API ne démarre pas
```bash
# Vérifier les dépendances
pip install -r requirements.txt

# Vérifier le .env
cat .env
```

## 📄 Licence

Ce projet est à usage interne/éducatif.

## 👤 Auteur

Lucky43 (Lucas Bruyère)
