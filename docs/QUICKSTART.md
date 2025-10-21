# 🚀 Guide de démarrage rapide

## Installation (première fois uniquement)

### 1. Installer les dépendances
```bash
# Créer l'environnement virtuel
python -m venv .venv

# Activer l'environnement
.venv\Scripts\activate     # Windows
source .venv/bin/activate  # Linux/Mac

# Installer les packages
pip install -r requirements.txt
```

### 2. Configurer la base de données
```bash
# Créer la base PostgreSQL
createdb odoo_devlog

# Copier et configurer .env
cp .env.example .env
# Éditer .env avec vos identifiants
```

### 3. Initialiser la base
```bash
python init_db.py
```

## Utilisation quotidienne

### Lancer l'application

#### Option 1 : Script automatique (recommandé)
```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

#### Option 2 : Manuelle

**Terminal 1 - API Backend**
```bash
.venv\Scripts\activate
python api.py
```

**Terminal 2 - Interface Web**
```bash
cd web
python -m http.server 3000
```

Puis ouvrir : **http://localhost:3000**

### Importer des commits

**Première fois (tous les commits)**
```bash
.venv\Scripts\activate
python fetch_commits.py full
```
⚠️ Peut prendre plusieurs heures !

**Mises à jour (nouveaux commits uniquement)**
```bash
.venv\Scripts\activate
python fetch_commits.py
```
✅ Rapide, seulement les nouveaux commits

## Accès

- **Interface Web** : http://localhost:3000
- **API** : http://localhost:8000
- **Documentation API** : http://localhost:8000/docs

## Fonctionnalités

### Dashboard
- Vue d'ensemble des statistiques
- Top contributeurs
- Totaux (commits, lignes ajoutées/supprimées)

### Commits
- Liste des commits par dépôt/branche
- Filtres : auteur, message
- Détails complets de chaque commit

### Comparer
- Comparaison de deux branches
- Commits uniques à chaque branche
- Statistiques comparatives

### Statistiques
- Analyses détaillées
- (À venir : graphiques, tendances)

## Troubleshooting

### L'API ne démarre pas
```bash
# Vérifier les dépendances
pip install -r requirements.txt

# Vérifier le .env
cat .env  # Linux/Mac
type .env # Windows
```

### La page web est blanche
- Vérifier que l'API tourne sur http://localhost:8000
- Ouvrir la console du navigateur (F12) pour voir les erreurs
- Vérifier que CORS est bien activé dans api.py

### Pas de commits affichés
- Vérifier que `python fetch_commits.py full` a été exécuté
- Vérifier les logs dans `fetch_commits.log`
- Vérifier la table `import_log` dans la BDD

### Erreur "ModuleNotFoundError"
```bash
# Activer l'environnement virtuel
.venv\Scripts\activate
pip install -r requirements.txt
```

## Prochaines étapes

1. Laisser tourner `fetch_commits.py full` pour importer tous les commits
2. Lancer l'API avec `python api.py`
3. Ouvrir l'interface web
4. Explorer les données !

## Support

Voir [README.md](README.md) pour la documentation complète.
