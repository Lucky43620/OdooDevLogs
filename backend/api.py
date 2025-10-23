import os
import psycopg2
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime
from dotenv import load_dotenv
from pydantic import BaseModel
import json

# ============================================================
# CONFIGURATION
# ============================================================
load_dotenv()

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "odoo_devlog"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": 5432
}

# ============================================================
# FASTAPI APP
# ============================================================
app = FastAPI(
    title="Odoo DevLogs API",
    description="API pour consulter et comparer les commits Odoo",
    version="1.0.0"
)

# CORS pour permettre l'accès depuis le frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En production, spécifier les domaines autorisés
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# MODÈLES PYDANTIC
# ============================================================
class Repository(BaseModel):
    id: int
    full_name: str
    description: Optional[str]
    default_branch: Optional[str]
    html_url: Optional[str]

class Branch(BaseModel):
    id: int
    name: str
    is_default: bool
    last_commit_sha: Optional[str]

class Commit(BaseModel):
    id: int
    sha: str
    message: str
    author_name: Optional[str]
    author_email: Optional[str]
    committed_date: Optional[datetime]
    additions: int
    deletions: int
    total_changes: int
    is_merge: bool
    html_url: Optional[str]

class CommitDetail(Commit):
    files_changed: List[dict]

# ============================================================
# CONNEXION À LA BDD
# ============================================================
def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG, options='-c client_encoding=UTF8')
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de connexion à la base de données: {str(e)}")

# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Bienvenue sur l'API Odoo DevLogs",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/config")
def get_config():
    """Retourne la configuration pour le frontend"""
    api_url = os.getenv('API_URL')
    if not api_url:
        api_url = f"http://{os.getenv('API_HOST', 'localhost')}:{os.getenv('API_PORT', 8000)}"

    return {
        "api_url": api_url,
        "version": "1.0.0",
        "features": {
            "analytics": True,
            "export": True,
            "regex_search": True
        }
    }

@app.get("/repositories", response_model=List[Repository])
def get_repositories():
    """Liste tous les dépôts"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, full_name, description, default_branch, html_url
                FROM odoo_devlog.repositories
                ORDER BY full_name;
            """)
            rows = cur.fetchall()
            return [
                Repository(
                    id=row[0],
                    full_name=row[1],
                    description=row[2],
                    default_branch=row[3],
                    html_url=row[4]
                ) for row in rows
            ]
    finally:
        conn.close()

@app.get("/repositories/{repo_id}/branches", response_model=List[Branch])
def get_branches(repo_id: int):
    """Liste toutes les branches d'un dépôt"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, is_default, last_commit_sha
                FROM odoo_devlog.branches
                WHERE repo_id = %s
                ORDER BY is_default DESC, name;
            """, (repo_id,))
            rows = cur.fetchall()
            return [
                Branch(
                    id=row[0],
                    name=row[1],
                    is_default=row[2],
                    last_commit_sha=row[3]
                ) for row in rows
            ]
    finally:
        conn.close()

@app.get("/commits/all", response_model=List[Commit])
def get_all_commits(
    branch_name: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    author: Optional[str] = None,
    search: Optional[str] = None,
    module: Optional[str] = None
):
    """Liste les commits de tous les dépôts pour une branche donnée"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if module:
                query = """
                    SELECT DISTINCT c.id, c.sha, c.message, c.author_name, c.author_email, c.committed_date,
                           c.additions, c.deletions, c.total_changes, c.is_merge, c.html_url
                    FROM odoo_devlog.commits c
                    INNER JOIN odoo_devlog.branches b ON c.branch_id = b.id
                    INNER JOIN odoo_devlog.file_changes fc ON fc.commit_id = c.id
                    WHERE b.name = %s
                      AND (fc.filename LIKE %s OR fc.filename LIKE %s OR fc.filename LIKE %s)
                """
                params = [branch_name, f'addons/{module}/%', f'odoo/addons/{module}/%', f'{module}/%']
            else:
                query = """
                    SELECT c.id, c.sha, c.message, c.author_name, c.author_email, c.committed_date,
                           c.additions, c.deletions, c.total_changes, c.is_merge, c.html_url
                    FROM odoo_devlog.commits c
                    INNER JOIN odoo_devlog.branches b ON c.branch_id = b.id
                    WHERE b.name = %s
                """
                params = [branch_name]

            if author:
                query += " AND c.author_name ILIKE %s"
                params.append(f"%{author}%")

            if search:
                query += " AND c.message ILIKE %s"
                params.append(f"%{search}%")

            query += " ORDER BY c.committed_date DESC LIMIT %s OFFSET %s;"
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()
            return [
                Commit(
                    id=row[0],
                    sha=row[1],
                    message=row[2],
                    author_name=row[3],
                    author_email=row[4],
                    committed_date=row[5],
                    additions=row[6],
                    deletions=row[7],
                    total_changes=row[8],
                    is_merge=row[9],
                    html_url=row[10]
                ) for row in rows
            ]
    finally:
        conn.close()

@app.get("/branches/{branch_id}/commits", response_model=List[Commit])
def get_commits(
    branch_id: int,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    author: Optional[str] = None,
    search: Optional[str] = None,
    module: Optional[str] = None
):
    """Liste les commits d'une branche avec pagination et filtres"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if module:
                query = """
                    SELECT DISTINCT c.id, c.sha, c.message, c.author_name, c.author_email, c.committed_date,
                           c.additions, c.deletions, c.total_changes, c.is_merge, c.html_url
                    FROM odoo_devlog.commits c
                    INNER JOIN odoo_devlog.file_changes fc ON fc.commit_id = c.id
                    WHERE c.branch_id = %s
                      AND (fc.filename LIKE %s OR fc.filename LIKE %s OR fc.filename LIKE %s)
                """
                params = [branch_id, f'addons/{module}/%', f'odoo/addons/{module}/%', f'{module}/%']
            else:
                query = """
                    SELECT id, sha, message, author_name, author_email, committed_date,
                           additions, deletions, total_changes, is_merge, html_url
                    FROM odoo_devlog.commits
                    WHERE branch_id = %s
                """
                params = [branch_id]

            if author:
                query += " AND author_name ILIKE %s"
                params.append(f"%{author}%")

            if search:
                query += " AND message ILIKE %s"
                params.append(f"%{search}%")

            query += " ORDER BY committed_date DESC LIMIT %s OFFSET %s;"
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()
            return [
                Commit(
                    id=row[0],
                    sha=row[1],
                    message=row[2],
                    author_name=row[3],
                    author_email=row[4],
                    committed_date=row[5],
                    additions=row[6],
                    deletions=row[7],
                    total_changes=row[8],
                    is_merge=row[9],
                    html_url=row[10]
                ) for row in rows
            ]
    finally:
        conn.close()

@app.get("/commits/{commit_id}", response_model=CommitDetail)
def get_commit_detail(commit_id: int):
    """Détails d'un commit avec les fichiers modifiés"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Récupérer le commit
            cur.execute("""
                SELECT id, sha, message, author_name, author_email, committed_date,
                       additions, deletions, total_changes, is_merge, html_url
                FROM odoo_devlog.commits
                WHERE id = %s;
            """, (commit_id,))
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Commit non trouvé")

            # Récupérer les fichiers modifiés avec le patch
            cur.execute("""
                SELECT filename, status, additions, deletions, changes, previous_filename, patch
                FROM odoo_devlog.file_changes
                WHERE commit_id = %s
                ORDER BY filename;
            """, (commit_id,))
            files = cur.fetchall()

            return CommitDetail(
                id=row[0],
                sha=row[1],
                message=row[2],
                author_name=row[3],
                author_email=row[4],
                committed_date=row[5],
                additions=row[6],
                deletions=row[7],
                total_changes=row[8],
                is_merge=row[9],
                html_url=row[10],
                files_changed=[
                    {
                        "filename": f[0],
                        "status": f[1],
                        "additions": f[2],
                        "deletions": f[3],
                        "changes": f[4],
                        "previous_filename": f[5],
                        "patch": f[6]
                    } for f in files
                ]
            )
    finally:
        conn.close()

@app.get("/compare/all")
def compare_all_branches(
    branch1: str = Query(..., description="Nom de la première branche"),
    branch2: str = Query(..., description="Nom de la deuxième branche"),
    limit: int = Query(500, ge=1, le=5000)
):
    """Compare deux branches sur tous les dépôts"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT sha, message, author_name, committed_date, additions, deletions
                FROM odoo_devlog.commits c
                INNER JOIN odoo_devlog.branches b ON c.branch_id = b.id
                WHERE b.name = %s
                  AND sha NOT IN (
                      SELECT c2.sha FROM odoo_devlog.commits c2
                      INNER JOIN odoo_devlog.branches b2 ON c2.branch_id = b2.id
                      WHERE b2.name = %s
                  )
                ORDER BY committed_date DESC
                LIMIT %s;
            """, (branch1, branch2, limit))
            only_in_branch1 = cur.fetchall()

            cur.execute("""
                SELECT sha, message, author_name, committed_date, additions, deletions
                FROM odoo_devlog.commits c
                INNER JOIN odoo_devlog.branches b ON c.branch_id = b.id
                WHERE b.name = %s
                  AND sha NOT IN (
                      SELECT c2.sha FROM odoo_devlog.commits c2
                      INNER JOIN odoo_devlog.branches b2 ON c2.branch_id = b2.id
                      WHERE b2.name = %s
                  )
                ORDER BY committed_date DESC
                LIMIT %s;
            """, (branch2, branch1, limit))
            only_in_branch2 = cur.fetchall()

            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(additions) as total_additions,
                    SUM(deletions) as total_deletions,
                    COUNT(DISTINCT author_name) as unique_authors
                FROM odoo_devlog.commits c
                INNER JOIN odoo_devlog.branches b ON c.branch_id = b.id
                WHERE b.name = %s;
            """, (branch1,))
            stats_b1 = cur.fetchone()

            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(additions) as total_additions,
                    SUM(deletions) as total_deletions,
                    COUNT(DISTINCT author_name) as unique_authors
                FROM odoo_devlog.commits c
                INNER JOIN odoo_devlog.branches b ON c.branch_id = b.id
                WHERE b.name = %s;
            """, (branch2,))
            stats_b2 = cur.fetchone()

            return {
                "branch1": {
                    "name": branch1,
                    "stats": {
                        "total_commits": stats_b1[0],
                        "total_additions": stats_b1[1] or 0,
                        "total_deletions": stats_b1[2] or 0,
                        "unique_authors": stats_b1[3]
                    },
                    "unique_commits": [
                        {
                            "sha": c[0],
                            "message": c[1],
                            "author": c[2],
                            "date": c[3].isoformat() if c[3] else None,
                            "additions": c[4],
                            "deletions": c[5]
                        } for c in only_in_branch1
                    ]
                },
                "branch2": {
                    "name": branch2,
                    "stats": {
                        "total_commits": stats_b2[0],
                        "total_additions": stats_b2[1] or 0,
                        "total_deletions": stats_b2[2] or 0,
                        "unique_authors": stats_b2[3]
                    },
                    "unique_commits": [
                        {
                            "sha": c[0],
                            "message": c[1],
                            "author": c[2],
                            "date": c[3].isoformat() if c[3] else None,
                            "additions": c[4],
                            "deletions": c[5]
                        } for c in only_in_branch2
                    ]
                }
            }
    finally:
        conn.close()

@app.get("/compare")
def compare_branches(
    repo_id: int = Query(..., description="ID du dépôt"),
    branch1: str = Query(..., description="Nom de la première branche"),
    branch2: str = Query(..., description="Nom de la deuxième branche"),
    limit: int = Query(500, ge=1, le=5000)
):
    """Compare deux branches d'un même dépôt"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Récupérer les IDs des branches
            cur.execute("""
                SELECT id, name FROM odoo_devlog.branches
                WHERE repo_id = %s AND name IN (%s, %s);
            """, (repo_id, branch1, branch2))
            branches = cur.fetchall()

            if len(branches) != 2:
                raise HTTPException(status_code=404, detail="Une ou plusieurs branches non trouvées")

            branch_map = {b[1]: b[0] for b in branches}
            b1_id = branch_map.get(branch1)
            b2_id = branch_map.get(branch2)

            # Commits uniquement dans branch1
            cur.execute("""
                SELECT sha, message, author_name, committed_date, additions, deletions
                FROM odoo_devlog.commits
                WHERE branch_id = %s
                  AND sha NOT IN (
                      SELECT sha FROM odoo_devlog.commits WHERE branch_id = %s
                  )
                ORDER BY committed_date DESC
                LIMIT %s;
            """, (b1_id, b2_id, limit))
            only_in_branch1 = cur.fetchall()

            # Commits uniquement dans branch2
            cur.execute("""
                SELECT sha, message, author_name, committed_date, additions, deletions
                FROM odoo_devlog.commits
                WHERE branch_id = %s
                  AND sha NOT IN (
                      SELECT sha FROM odoo_devlog.commits WHERE branch_id = %s
                  )
                ORDER BY committed_date DESC
                LIMIT %s;
            """, (b2_id, b1_id, limit))
            only_in_branch2 = cur.fetchall()

            # Statistiques
            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(additions) as total_additions,
                    SUM(deletions) as total_deletions,
                    COUNT(DISTINCT author_name) as unique_authors
                FROM odoo_devlog.commits
                WHERE branch_id = %s;
            """, (b1_id,))
            stats_b1 = cur.fetchone()

            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(additions) as total_additions,
                    SUM(deletions) as total_deletions,
                    COUNT(DISTINCT author_name) as unique_authors
                FROM odoo_devlog.commits
                WHERE branch_id = %s;
            """, (b2_id,))
            stats_b2 = cur.fetchone()

            return {
                "branch1": {
                    "name": branch1,
                    "stats": {
                        "total_commits": stats_b1[0],
                        "total_additions": stats_b1[1] or 0,
                        "total_deletions": stats_b1[2] or 0,
                        "unique_authors": stats_b1[3]
                    },
                    "unique_commits": [
                        {
                            "sha": c[0],
                            "message": c[1],
                            "author": c[2],
                            "date": c[3].isoformat() if c[3] else None,
                            "additions": c[4],
                            "deletions": c[5]
                        } for c in only_in_branch1
                    ]
                },
                "branch2": {
                    "name": branch2,
                    "stats": {
                        "total_commits": stats_b2[0],
                        "total_additions": stats_b2[1] or 0,
                        "total_deletions": stats_b2[2] or 0,
                        "unique_authors": stats_b2[3]
                    },
                    "unique_commits": [
                        {
                            "sha": c[0],
                            "message": c[1],
                            "author": c[2],
                            "date": c[3].isoformat() if c[3] else None,
                            "additions": c[4],
                            "deletions": c[5]
                        } for c in only_in_branch2
                    ]
                }
            }
    finally:
        conn.close()

@app.get("/stats/summary")
def get_summary_stats():
    """Statistiques générales"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    (SELECT COUNT(*) FROM odoo_devlog.repositories) as total_repos,
                    (SELECT COUNT(*) FROM odoo_devlog.branches) as total_branches,
                    (SELECT COUNT(*) FROM odoo_devlog.commits) as total_commits,
                    (SELECT COUNT(*) FROM odoo_devlog.file_changes) as total_file_changes,
                    (SELECT COUNT(DISTINCT author_name) FROM odoo_devlog.commits) as unique_authors,
                    (SELECT SUM(additions) FROM odoo_devlog.commits) as total_additions,
                    (SELECT SUM(deletions) FROM odoo_devlog.commits) as total_deletions;
            """)
            row = cur.fetchone()
            return {
                "total_repositories": row[0],
                "total_branches": row[1],
                "total_commits": row[2],
                "total_file_changes": row[3],
                "unique_authors": row[4],
                "total_additions": row[5] or 0,
                "total_deletions": row[6] or 0
            }
    finally:
        conn.close()

@app.get("/stats/top-contributors")
def get_top_contributors(limit: int = Query(10, ge=1, le=100)):
    """Top contributeurs par nombre de commits"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    author_name,
                    COUNT(*) as commit_count,
                    SUM(additions) as total_additions,
                    SUM(deletions) as total_deletions
                FROM odoo_devlog.commits
                WHERE author_name IS NOT NULL
                GROUP BY author_name
                ORDER BY commit_count DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
            return [
                {
                    "author": row[0],
                    "commits": row[1],
                    "additions": row[2] or 0,
                    "deletions": row[3] or 0
                } for row in rows
            ]
    finally:
        conn.close()

@app.get("/search/migration")
def search_migration_changes(
    term: str = Query(..., min_length=2),
    from_version: str = Query(...),
    to_version: str = Query(...),
    module: Optional[str] = None,
    commit_type: Optional[str] = None,
    use_regex: bool = Query(False, description="Use regex search"),
    limit: int = Query(100, ge=1, le=500)
):
    """Recherche les changements entre deux versions avec support module"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            search_operator = "~*" if use_regex else "LIKE"
            search_term = term if use_regex else f'%{term.lower()}%'

            query = f"""
                SELECT DISTINCT
                    c.id, c.sha, c.message, c.author_name, c.committed_date,
                    c.additions, c.deletions, b.name as branch_name, c.html_url,
                    fc.id as file_id, fc.filename, fc.status, fc.additions as file_additions,
                    fc.deletions as file_deletions, fc.patch
                FROM odoo_devlog.commits c
                INNER JOIN odoo_devlog.branches b ON c.branch_id = b.id
                INNER JOIN odoo_devlog.file_changes fc ON fc.commit_id = c.id
                WHERE b.name IN (%s, %s)
                  AND fc.patch IS NOT NULL
                  AND {"fc.patch" if use_regex else "LOWER(fc.patch)"} {search_operator} %s
            """

            params = [from_version, to_version, search_term]

            if module:
                query += " AND (fc.filename LIKE %s OR fc.filename LIKE %s OR fc.filename LIKE %s OR fc.filename LIKE %s)"
                params.extend([f'addons/{module}/%', f'odoo/addons/{module}/%', f'{module}/%', f'%/{module}/%'])

            if commit_type:
                query += " AND UPPER(c.message) LIKE %s"
                params.append(f'[{commit_type.upper()}]%')

            query += " ORDER BY c.committed_date DESC LIMIT %s;"
            params.append(limit)

            cur.execute(query, params)
            rows = cur.fetchall()

            results = []
            for row in rows:
                results.append({
                    "commit": {
                        "id": row[0],
                        "sha": row[1],
                        "message": row[2],
                        "author": row[3],
                        "date": row[4].isoformat() if row[4] else None,
                        "additions": row[5],
                        "deletions": row[6],
                        "branch": row[7],
                        "html_url": row[8]
                    },
                    "file": {
                        "id": row[9],
                        "filename": row[10],
                        "status": row[11],
                        "additions": row[12],
                        "deletions": row[13],
                        "patch": row[14]
                    }
                })

            return {
                "results": results,
                "count": len(results),
                "from_version": from_version,
                "to_version": to_version
            }
    finally:
        conn.close()

@app.get("/modules")
def get_modules(search: Optional[str] = None, limit: int = Query(100, ge=1, le=500)):
    """Liste tous les modules détectés avec recherche optionnelle"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if search:
                cur.execute("""
                    SELECT DISTINCT m.name, m.path_prefix, r.full_name
                    FROM odoo_devlog.modules m
                    JOIN odoo_devlog.repositories r ON m.repo_id = r.id
                    WHERE m.name ILIKE %s
                    ORDER BY m.name
                    LIMIT %s;
                """, (f'%{search}%', limit))
            else:
                cur.execute("""
                    SELECT DISTINCT m.name, m.path_prefix, r.full_name
                    FROM odoo_devlog.modules m
                    JOIN odoo_devlog.repositories r ON m.repo_id = r.id
                    ORDER BY m.name
                    LIMIT %s;
                """, (limit,))
            rows = cur.fetchall()
            return [{"name": r[0], "path": r[1], "repo": r[2]} for r in rows]
    finally:
        conn.close()

@app.get("/commit-types")
def get_commit_types():
    """Extrait les types de commits du message"""
    return [
        {"code": "FIX", "label": "Bug Fix", "color": "#ef4444"},
        {"code": "IMP", "label": "Improvement", "color": "#3b82f6"},
        {"code": "ADD", "label": "Addition", "color": "#22c55e"},
        {"code": "REF", "label": "Refactoring", "color": "#f59e0b"},
        {"code": "REM", "label": "Removal", "color": "#9ca3af"},
        {"code": "MOV", "label": "Move", "color": "#8b5cf6"},
        {"code": "REV", "label": "Revert", "color": "#ec4899"},
        {"code": "I18N", "label": "Translation", "color": "#06b6d4"}
    ]

# ============================================================
# ANALYTICS ENDPOINTS
# ============================================================
@app.get("/analytics/timeline")
def get_timeline(
    branch_id: int = Query(..., description="Branch ID"),
    days: int = Query(30, ge=1, le=365, description="Number of days")
):
    """Retourne les commits groupés par date pour créer un timeline graph"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                DATE(c.committed_date) as date,
                COUNT(*) as commit_count,
                SUM(c.additions) as total_additions,
                SUM(c.deletions) as total_deletions,
                COUNT(DISTINCT c.author_name) as author_count
            FROM odoo_devlog.commits c
            WHERE c.branch_id = %s
                AND c.committed_date >= NOW() - INTERVAL '%s days'
            GROUP BY DATE(c.committed_date)
            ORDER BY date DESC
        """

        # Utiliser format pour injecter days de manière sûre (c'est un int validé)
        formatted_query = query % ('%s', days)
        cursor.execute(formatted_query, (branch_id,))
        rows = cursor.fetchall()

        results = []
        for row in rows:
            results.append({
                "date": row[0].isoformat() if row[0] else None,
                "commit_count": row[1],
                "total_additions": row[2] or 0,
                "total_deletions": row[3] or 0,
                "author_count": row[4]
            })

        cursor.close()
        conn.close()

        return {
            "branch_id": branch_id,
            "days": days,
            "timeline": results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/modules")
def get_module_analytics(
    branch_name: str = Query(..., description="Branch name (e.g., 17.0)")
):
    """Retourne les statistiques par module pour une branche donnée"""
    print(f"=== MODULE ANALYTICS CALLED WITH branch_name={branch_name} ===")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                m.name,
                COUNT(DISTINCT fc.commit_id) as commit_count,
                COALESCE(SUM(fc.additions), 0) as total_additions,
                COALESCE(SUM(fc.deletions), 0) as total_deletions,
                COUNT(DISTINCT c.author_name) as contributor_count,
                MAX(c.committed_date) as last_modified
            FROM odoo_devlog.modules m
            INNER JOIN odoo_devlog.file_changes fc ON (
                fc.filename LIKE CONCAT('addons/', m.name, '/%%')
                OR fc.filename LIKE CONCAT('odoo/addons/', m.name, '/%%')
                OR fc.filename LIKE CONCAT(m.name, '/%%')
            )
            INNER JOIN odoo_devlog.commits c ON c.id = fc.commit_id
            INNER JOIN odoo_devlog.branches b ON b.id = c.branch_id
            WHERE b.name = %s AND m.name IS NOT NULL
            GROUP BY m.name
            HAVING COUNT(DISTINCT fc.commit_id) > 0
            ORDER BY commit_count DESC
            LIMIT 50
        """

        cursor.execute(query, (branch_name,))
        rows = cursor.fetchall()

        results = []
        for row in rows:
            if len(row) < 6:
                print(f"ERROR: Row has {len(row)} columns instead of 6: {row}")
                continue
            results.append({
                "module": row[0],
                "commits": row[1],
                "additions": row[2] or 0,
                "deletions": row[3] or 0,
                "contributors": row[4],
                "last_modified": row[5].isoformat() if row[5] else None
            })

        cursor.close()
        conn.close()

        return {
            "branch": branch_name,
            "modules": results
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/detected-changes")
def get_detected_changes(
    branch_name: str = Query(..., description="Branch name"),
    change_type: Optional[str] = Query(None, description="Type of change")
):
    """Retourne les changements détectés automatiquement"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Pour l'instant, on simule car la table detected_changes n'est peut-être pas remplie
        # On va analyser les file_changes pour détecter des patterns
        query = """
            SELECT
                c.id,
                c.sha,
                c.message,
                c.author_name,
                c.commit_date,
                fc.filename,
                fc.status,
                fc.patch
            FROM odoo_devlog.commits c
            JOIN odoo_devlog.file_changes fc ON fc.commit_id = c.id
            JOIN odoo_devlog.branches b ON b.id = c.branch_id
            WHERE b.name = %s
                AND fc.patch IS NOT NULL
                AND (
                    fc.patch LIKE '%renamed%'
                    OR fc.patch LIKE '%removed%'
                    OR fc.patch LIKE '%deleted%'
                    OR (fc.status = 'renamed' OR fc.status = 'removed')
                )
            ORDER BY c.commit_date DESC
            LIMIT 100
        """

        cursor.execute(query, (branch_name,))
        rows = cursor.fetchall()

        results = []
        for row in rows:
            # Détection simple du type de changement
            patch = row[7] or ""
            status = row[6]

            detected_type = "other"
            old_value = None
            new_value = None

            if status == "renamed" or "renamed" in patch.lower():
                if ".py" in row[5]:
                    if "def " in patch:
                        detected_type = "method_renamed"
                    elif "class " in patch:
                        detected_type = "class_renamed"
                    else:
                        detected_type = "field_renamed"
            elif status == "removed" or "removed" in patch.lower() or "deleted" in patch.lower():
                if "def " in patch:
                    detected_type = "method_removed"
                elif "class " in patch:
                    detected_type = "class_removed"
                else:
                    detected_type = "field_removed"

            # Si le type correspond au filtre ou pas de filtre
            if not change_type or detected_type == change_type:
                results.append({
                    "commit_id": row[0],
                    "commit_sha": row[1][:7],
                    "commit_message": row[2].split('\n')[0],
                    "author": row[3],
                    "date": row[4].isoformat() if row[4] else None,
                    "filename": row[5],
                    "type": detected_type,
                    "old_value": old_value,
                    "new_value": new_value
                })

        cursor.close()
        conn.close()

        return {
            "branch": branch_name,
            "change_type": change_type,
            "changes": results[:50]  # Limiter à 50 résultats
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# ADMIN / FETCH MANAGEMENT
# ============================================================
import asyncio
from fastapi.responses import StreamingResponse
import tempfile
from pathlib import Path

current_fetch_process = None
fetch_lock = asyncio.Lock()
current_log_file = None

class FetchRequest(BaseModel):
    mode: str
    repositories: Optional[List[str]] = None
    branches: Optional[List[str]] = None

@app.post("/admin/fetch")
async def trigger_fetch(request: FetchRequest):
    """Déclenche un fetch des commits"""
    import subprocess
    import sys

    global current_fetch_process, current_log_file

    async with fetch_lock:
        if current_fetch_process and current_fetch_process.poll() is None:
            return {
                "status": "already_running",
                "mode": request.mode,
                "pid": current_fetch_process.pid,
                "message": "Une synchronisation est déjà en cours"
            }

        try:
            script_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "fetch_commits.py")

            cmd = [sys.executable, "-u", script_path]

            if request.mode == "full":
                cmd.append("full")

            if request.repositories:
                cmd.append("--repos")
                cmd.extend(request.repositories)

            if request.branches:
                cmd.append("--branches")
                cmd.extend(request.branches)

            log_dir = Path(__file__).parent.parent / "logs"
            log_dir.mkdir(exist_ok=True)
            current_log_file = log_dir / f"sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

            log_handle = open(current_log_file, 'w', encoding='utf-8')

            env = os.environ.copy()
            env['PYTHONUNBUFFERED'] = '1'

            current_fetch_process = subprocess.Popen(
                cmd,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                env=env
            )

            return {
                "status": "started",
                "mode": request.mode,
                "pid": current_fetch_process.pid,
                "log_file": str(current_log_file),
                "repositories": request.repositories or ["all"],
                "branches": request.branches or ["all"],
                "message": f"Fetch {request.mode} démarré"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@app.get("/admin/fetch-logs")
def get_fetch_logs(last_position: int = 0):
    """Récupère les nouveaux logs depuis la dernière position"""
    global current_log_file, current_fetch_process

    if not current_log_file or not Path(current_log_file).exists():
        return {
            "running": False,
            "logs": [],
            "position": 0,
            "completed": True
        }

    try:
        with open(current_log_file, 'r', encoding='utf-8') as f:
            f.seek(last_position)
            new_lines = f.readlines()
            new_position = f.tell()

        logs = []
        for line in new_lines:
            line = line.strip()
            if line:
                log_type = 'info'
                if '✅' in line or 'success' in line.lower() or 'réussie' in line.lower():
                    log_type = 'success'
                elif '❌' in line or 'error' in line.lower() or 'erreur' in line.lower():
                    log_type = 'error'
                elif '⚠️' in line or 'warning' in line.lower():
                    log_type = 'warning'

                logs.append({'type': log_type, 'message': line})

        is_running = current_fetch_process and current_fetch_process.poll() is None

        return {
            "running": is_running,
            "logs": logs,
            "position": new_position,
            "completed": not is_running
        }
    except Exception as e:
        return {
            "running": False,
            "logs": [{'type': 'error', 'message': f'Erreur: {str(e)}'}],
            "position": last_position,
            "completed": True
        }

@app.get("/admin/fetch-running")
def is_fetch_running():
    """Vérifie si un fetch est en cours"""
    global current_fetch_process

    if current_fetch_process and current_fetch_process.poll() is None:
        return {
            "running": True,
            "pid": current_fetch_process.pid
        }
    return {"running": False}

@app.post("/admin/cancel-fetch")
async def cancel_fetch():
    """Annule la synchronisation en cours"""
    global current_fetch_process

    async with fetch_lock:
        if not current_fetch_process or current_fetch_process.poll() is not None:
            return {
                "status": "no_process",
                "message": "Aucune synchronisation en cours"
            }

        try:
            current_fetch_process.terminate()

            try:
                current_fetch_process.wait(timeout=5)
            except:
                current_fetch_process.kill()

            return {
                "status": "cancelled",
                "message": "Synchronisation annulée"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur lors de l'annulation: {str(e)}")

@app.get("/admin/fetch-status")
def get_fetch_status():
    """Retourne le statut du dernier fetch"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, started_at, ended_at, status, total_commits_imported, error_message, repo_id, branch_name
            FROM odoo_devlog.import_log
            ORDER BY started_at DESC
            LIMIT 10
        """)

        rows = cursor.fetchall()
        logs = []

        for row in rows:
            duration = None
            if row[1] and row[2]:
                duration = (row[2] - row[1]).total_seconds()

            logs.append({
                "id": row[0],
                "started_at": row[1].isoformat() if row[1] else None,
                "completed_at": row[2].isoformat() if row[2] else None,
                "status": row[3],
                "commits_imported": row[4] or 0,
                "error_message": row[5],
                "repo_id": row[6],
                "branch_name": row[7],
                "duration": duration
            })

        cursor.close()
        conn.close()

        return {
            "logs": logs,
            "last_fetch": logs[0] if logs else None
        }
    except Exception as e:
        return {"logs": [], "last_fetch": None, "error": str(e)}

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=True
    )
