import psycopg2
from github import Github
import os
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "odoo_devlog"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": 5432
}

if not GITHUB_TOKEN:
    print("⚠️  Aucun token GitHub trouvé dans .env.")
    print("➡️  Ajoute-le sous la clé GITHUB_TOKEN.")
    exit(1)
    
schema_file = Path(__file__).parent / "schema.sql"
if not schema_file.exists():
    print("❌ Fichier 'schema.sql' introuvable.")
    exit(1)

schema_sql = schema_file.read_text(encoding="utf-8")

# ============================================================
# INITIALISATION DE LA BASE
# ============================================================
try:
    conn = psycopg2.connect(**DB_CONFIG, options='-c client_encoding=UTF8')
    cur = conn.cursor()
    cur.execute(schema_sql)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Base de données initialisée avec succès !")
except Exception as e:
    print(f"❌ Erreur de connexion à PostgreSQL : {e}")
    exit(1)

# ============================================================
# DÉPÔTS À INITIALISER
# ============================================================
REPOSITORIES = [
    "odoo/odoo",
    "odoo/enterprise"
]

# ============================================================
# FONCTION : Connexion PostgreSQL
# ============================================================
def connect_db():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("✅ Connexion PostgreSQL réussie !")
        return conn
    except Exception as e:
        print(f"❌ Erreur de connexion à PostgreSQL : {e}")
        exit(1)

# ============================================================
# FONCTION : Initialiser un dépôt
# ============================================================
def init_repository(conn, repo_name):
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(repo_name)

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO odoo_devlog.repositories
            (full_name, description, default_branch, html_url, clone_url, pushed_at, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (full_name) DO UPDATE SET
                description = EXCLUDED.description,
                default_branch = EXCLUDED.default_branch,
                pushed_at = EXCLUDED.pushed_at,
                updated_at = EXCLUDED.updated_at
            RETURNING id;
        """, (
            repo.full_name,
            repo.description,
            repo.default_branch,
            repo.html_url,
            repo.clone_url,
            repo.pushed_at.replace(tzinfo=None) if repo.pushed_at else None,
            repo.created_at.replace(tzinfo=None) if repo.created_at else None,
            repo.updated_at.replace(tzinfo=None) if repo.updated_at else None
        ))
        repo_id = cur.fetchone()[0]
        conn.commit()
        print(f"✅ Dépôt enregistré : {repo.full_name} (ID {repo_id})")
        return repo_id

# ============================================================
# FONCTION : Initialiser les branches
# ============================================================
def init_branches(conn, repo_id, repo_name):
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(repo_name)

    with conn.cursor() as cur:
        for branch in repo.get_branches():
            cur.execute("""
                INSERT INTO odoo_devlog.branches (repo_id, name, last_commit_sha, is_default)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (repo_id, name) DO UPDATE SET
                    last_commit_sha = EXCLUDED.last_commit_sha,
                    is_default = EXCLUDED.is_default;
            """, (
                repo_id,
                branch.name,
                branch.commit.sha,
                branch.name == repo.default_branch
            ))
        conn.commit()
    print(f"✅ Branches synchronisées pour {repo_name}.")

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    conn = connect_db()

    for repo_name in REPOSITORIES:
        repo_id = init_repository(conn, repo_name)
        init_branches(conn, repo_id, repo_name)

    conn.close()
    print("\n🎉 Initialisation terminée ! Base prête à recevoir les commits.")
