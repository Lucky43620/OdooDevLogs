# 🚀 Odoo DevLogs - Guide Complet des Fonctionnalités

## 📋 Table des Matières
1. [Panneau Admin](#panneau-admin)
2. [Design Moderne](#design-moderne)
3. [Raccourcis Clavier](#raccourcis-clavier)
4. [Fonctionnalités Intelligentes](#fonctionnalités-intelligentes)
5. [Configuration Serveur](#configuration-serveur)

---

## 🔧 Panneau Admin

### Accès
Cliquez sur l'onglet **"Admin"** dans la navigation

### Fonctionnalités

#### 1. **Import Incrémental**
- Importe uniquement les nouveaux commits
- Plus rapide, recommandé pour les mises à jour quotidiennes
- Bouton: "Import Incrémental"

#### 2. **Import Complet**
- Réimporte tous les commits depuis le début
- Utilise: Si données corrompues ou première installation
- Bouton: "Import Complet"

#### 3. **Statut en Temps Réel**
- Affiche l'état actuel de l'import
- Statuts possibles:
  - `running`: Import en cours
  - `completed`: Terminé avec succès
  - `error`: Erreur rencontrée
- Rafraîchissement automatique toutes les 5s pendant 30s après lancement

#### 4. **Historique des Imports**
- 10 derniers imports
- Durée de chaque import
- Nombre de commits importés
- Erreurs éventuelles

---

## 🎨 Design Moderne (Noir & Blanc)

### 2 Thèmes Disponibles

#### 1. **Style Original** (`style.css`)
- Coloré avec dégradés
- 3D et ombres
- Icons et emojis

#### 2. **Style Moderne** (`style-modern.css`) ⭐
- **Noir & Blanc pur**
- **Flat Design** (0% 3D)
- **Ultra Minimaliste**
- **Professionnel**

### Activer le Style Moderne

Dans `index.html`, remplacez:
```html
<link rel="stylesheet" href="style.css">
```

Par:
```html
<link rel="stylesheet" href="style-modern.css">
```

### Caractéristiques du Style Moderne
- ✓ Scrollbars ultra fines (4px)
- ✓ Aucune bordure arrondie (flat)
- ✓ Palette stricte noir/blanc/gris
- ✓ Typographie optimisée
- ✓ Pas d'icônes/emojis
- ✓ Animations minimales
- ✓ Performance optimale

---

## ⌨️ Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl + K` (ou `Cmd + K`) | Focus sur la recherche |
| `Ctrl + E` | Export CSV des résultats |
| `Ctrl + H` | Afficher l'historique de recherche |
| `Ctrl + B` | Afficher les favoris |
| `Escape` | Fermer modals/diffs |

### Utilisation
Les raccourcis sont actifs partout dans l'application.
Exemple: `Ctrl+K` → Le curseur se place automatiquement dans la barre de recherche migration

---

## 🧠 Fonctionnalités Intelligentes

### 1. **Suggestions Automatiques**
Tapez dans la recherche migration → Suggestions apparaissent:
- Champs Odoo courants: `invoice_id`, `partner_id`, `move_id`...
- Méthodes Python: `def _compute_`, `@api.depends`...
- Vos recherches précédentes

**Activation**: Automatique dès 2 caractères tapés

### 2. **Historique de Recherche**
- Sauvegarde automatique des 20 dernières recherches
- Stockage local (localStorage)
- Rejouer une recherche en 1 clic
- Accès: `Ctrl+H`

### 3. **Favoris/Bookmarks**
- Sauvegarder les commits importants
- Persiste entre les sessions
- Accès: `Ctrl+B`
- *(Note: À implémenter dans l'interface commits)*

### 4. **Copie Intelligente**
Boutons de copie partout:
- Copier le changement détecté
- Copier le diff complet
- Copie dans le presse-papiers
- Notification de confirmation

### 5. **Détection Automatique des Changements**
Pour chaque recherche migration:
- Analyse le diff automatiquement
- Extrait ce qui a changé
- Affiche côte-à-côte: Avant → Après
- Exemple:
  ```
  17.0: invoice_id = fields.Many2one(...)
    ↓
  18.0: move_id = fields.Many2one(...)
  ```

---

## 🌐 Configuration Serveur

### Déploiement Automatique

L'application détecte automatiquement l'environnement!

#### Sur `localhost`:
```
API: http://localhost:8000
```

#### Sur votre serveur (`51.77.215.238`):
```
API: http://51.77.215.238:8000
```

### Comment ça marche?

**`config.js`** détecte l'hostname:
```javascript
window.API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `http://${window.location.hostname}:8000`;
```

### Déployer sur Ton Serveur

1. **Upload les fichiers** sur `51.77.215.238`

2. **Configure `.env`**:
```env
API_HOST=51.77.215.238
API_PORT=8000
```

3. **Lance les services**:
```bash
./start.sh
# ou
start.bat
```

4. **Accède à**:
```
http://51.77.215.238:3000
```

✅ **Aucune modification du code nécessaire!**

---

## 📊 Nouvelles Statistiques

### En-tête Migration
Quand tu fais une recherche, tu vois:
- **Nombre total** de changements trouvés
- **Fichiers uniques** affectés
- **Modules uniques** touchés
- **Total lignes** ajoutées (+)
- **Total lignes** supprimées (-)
- Badge de version: `17.0 → 18.0`

### Exemple
```
╔═══════════════════════════════════════════╗
║ 5 changements trouvés    [17.0 → 18.0]    ║
║ 📊 3 Fichiers | 2 Modules | +127 | -98    ║
╚═══════════════════════════════════════════╝
```

---

## 🎯 Utilisation Recommandée

### Workflow Quotidien

1. **Matin**: Import Incrémental
   - Onglet Admin → "Import Incrémental"
   - Récupère les commits de la nuit

2. **Migration**: Recherche Intelligente
   - Onglet Migration
   - Tape ton champ: `invoice_id`
   - Sélectionne: `17.0` → `18.0`
   - Vois immédiatement: `invoice_id` → `move_id`

3. **Copie**: Export Rapide
   - `Ctrl+E` → Export CSV
   - Ou bouton "📋 Copier" sur chaque diff

4. **Historique**: Rejoue tes Recherches
   - `Ctrl+H` → Liste de tes recherches
   - Clic → Relance la recherche

---

## 🔥 Astuces Pro

### 1. Recherche Regex
☑️ Coche "Regex" dans Migration
Cherche: `def\s+_compute_.*tax`
→ Trouve toutes les méthodes compute liées aux taxes

### 2. Filtres Combinés
- Version: `16.0` → `18.0`
- Module: `account`
- Type: `[IMP]`
→ Tous les improvements du module account entre 16 et 18

### 3. Historique comme Documentation
- Recherche importante
- Automatiquement dans l'historique
- Retrouve-la demain avec `Ctrl+H`

### 4. Diff Côte-à-Côte
- Clique "Voir le diff complet"
- 2 colonnes: Avant | Après
- Scroll synchronisé
- Hover sur une ligne → Highlight

---

## 🐛 Dépannage

### Erreur "API_BASE_URL already declared"
**Solution**: Recharge la page (F5)
Le problème est résolu dans la nouvelle version.

### Import bloqué sur "running"
**Solution**:
1. Attends 2 minutes
2. Clique "Rafraîchir le statut"
3. Si toujours bloqué: Relance le serveur backend

### Aucun résultat de recherche
**Vérifications**:
1. As-tu lancé un import? (Onglet Admin)
2. Les versions existent-elles dans la DB?
3. Le terme existe-t-il vraiment?

### Serveur: Erreur 500
**Debug**:
```bash
# Backend logs
cd backend
python api.py
# Regarde les logs dans la console
```

---

## 📝 Prochaines Améliorations Possibles

1. ☐ Mode Sombre toggle (gardé pour compatibilité)
2. ☐ Comparaison 3+ versions simultanées
3. ☐ Graphe de dépendances des modules
4. ☐ Détection IA des breaking changes
5. ☐ Export PDF avec diffs formatés
6. ☐ Annotations/notes sur commits
7. ☐ Mode présentation (slides auto)
8. ☐ Intégration Jira/GitHub
9. ☐ Syntax highlighting dans diffs
10. ☐ Recherche par auteur/date

---

## 💬 Support

**Email**: [Ton email]
**GitHub**: [Ton repo]

---

**Dernière mise à jour**: $(date)
**Version**: 2.0.0
