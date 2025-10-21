# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a complete web-based system for tracking, analyzing, and visualizing Odoo development changes from GitHub repositories. It consists of:
- **Data fetcher** (fetch_commits.py) - Imports commits from GitHub
- **REST API** (api.py) - FastAPI backend serving commit data
- **Web interface** (web/) - Modern dark-themed SPA for visualization and comparison

## Environment Setup

1. **Virtual environment**: Python virtual environment is located in `.venv/`
   ```bash
   source .venv/bin/activate  # Linux/Mac
   .venv\Scripts\activate     # Windows
   ```

2. **Dependencies**: Install with:
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment variables**: Copy and configure `.env` file with:
   - `GITHUB_TOKEN`: GitHub personal access token (required)
   - `DB_USER`: PostgreSQL username
   - `DB_PASSWORD`: PostgreSQL password
   - `DB_HOST`: Database host (default: localhost)
   - `DB_NAME`: Database name (default: odoo_devlog)
   - `DB_PORT`: Database port (default: 5432)
   - `MAX_COMMITS_PER_BRANCH`: Limit per branch (default: 0 = unlimited)

## Common Commands

### Initialize Database
Creates the schema and populates repository/branch metadata:
```bash
python init_db.py
```

### Fetch Commits

**Mode incrémental (par défaut)** - Récupère uniquement les nouveaux commits depuis le dernier import:
```bash
python fetch_commits.py
```

**Mode complet** - Récupère tous les commits:
```bash
python fetch_commits.py full
```

**Configuration de la limite**:
- Par défaut: `MAX_COMMITS_PER_BRANCH=0` (illimité, récupère TOUS les commits)
- Pour limiter: Ajouter `MAX_COMMITS_PER_BRANCH=1000` dans `.env`

**Logs**: Les logs sont enregistrés dans `fetch_commits.log` et affichés dans la console (encodage UTF-8).

### Run API Server
Start the FastAPI backend:
```bash
python api.py
```
Access at http://localhost:8000, docs at http://localhost:8000/docs

### Run Web Interface
Option 1 - Direct file open: Open `web/index.html` in browser

Option 2 - HTTP server:
```bash
cd web
python -m http.server 3000
```
Then open http://localhost:3000

## Architecture

### Database Schema
The PostgreSQL database uses a schema named `odoo_devlog` with these core tables:

- **repositories**: Stores GitHub repo metadata (odoo/odoo, odoo/enterprise)
- **branches**: Tracks branches per repository (17.0, 18.0, master)
- **commits**: Individual commit records with stats (additions, deletions, merge status)
- **commit_parents**: Tracks commit parent relationships
- **file_changes**: Per-file changes in each commit, including patches
- **modules**: Odoo module definitions (linked by path prefix)
- **module_changes**: Associates commits with affected modules
- **detected_changes**: Structured change detection (field renames, model additions, etc.)
- **version_tracking**: Branch comparison metadata
- **import_log**: Tracks import job status and errors

### Data Flow

1. **init_db.py**:
   - Executes schema.sql to create database structure
   - Connects to GitHub API using PyGithub
   - Inserts repository and branch metadata
   - Runs once to set up the database

2. **fetch_commits.py**:
   - Iterates through configured repositories and branches
   - Fetches commits via GitHub API
   - Stores commit metadata, statistics, and file changes
   - Handles merge commits (parent_count > 1)
   - Limits patch storage to 50KB per file
   - Two modes: incremental (default) or full
   - Logs to import_log table for tracking

3. **api.py** (FastAPI Backend):
   - Provides REST endpoints for querying commits
   - Endpoints: repositories, branches, commits, stats, compare
   - CORS enabled for frontend access
   - Pydantic models for data validation
   - Connection pooling via get_db_connection()

4. **web/** (Frontend):
   - Single-page application (HTML/CSS/JS)
   - Dark themed modern interface
   - Four main views: Dashboard, Commits, Compare, Stats
   - Real-time API communication
   - Modal for commit details

### Configuration

Scripts share configuration via .env:
- `REPOSITORIES`: List of repos to track (hardcoded in init_db.py and fetch_commits.py)
- `BRANCHES`: List of branches to monitor (hardcoded: 17.0, 18.0, master)
- `API_HOST` and `API_PORT`: API server configuration

### Database Connection

Uses psycopg2 with UTF-8 encoding:
```python
conn = psycopg2.connect(**DB_CONFIG, options='-c client_encoding=UTF8')
```

## Important Notes

- The `.env` file contains sensitive credentials and should never be committed
- Commits are deduplicated by SHA (ON CONFLICT DO NOTHING)
- File patches are truncated at 50,000 characters to prevent storage issues
- Progress is logged every 50 commits during import
- All timestamps are stored without timezone info (tzinfo=None)
- GitHub API rate limiting is monitored (pauses when < 100 requests remaining)
- Default: NO LIMIT (MAX_COMMITS_PER_BRANCH=0) - fetches ALL commits
- Import status is tracked in the `import_log` table with timestamps and error messages
- UTF-8 encoding configured for Windows compatibility with emojis

## Error Handling

- All database operations include rollback on error
- GitHub API exceptions are caught and logged separately
- Import logs track success/failure status with detailed error messages
- Logging outputs to both console and `fetch_commits.log` file
