import os
import psycopg2
from github import Github, GithubException
from dotenv import load_dotenv
from datetime import datetime
import logging
import time

# ============================================================
# CONFIGURATION
# ============================================================
load_dotenv()

# Configuration du logging avec support UTF-8
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fetch_commits.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Fix pour l'encodage UTF-8 sur Windows
import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "odoo_devlog"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": 5432
}

REPOSITORIES = [
    "odoo/odoo",
    "odoo/enterprise"
]
BRANCHES = ["16.0","17.0", "18.0", "19.0", "master"]

# Limite de commits à récupérer par branche (0 = illimité)
# Pour récupérer TOUS les commits, mettre à 0 ou très grand nombre
MAX_COMMITS_PER_BRANCH = int(os.getenv("MAX_COMMITS_PER_BRANCH", 0))

# ============================================================
# CONNEXION À LA BDD
# ============================================================
def connect_db():
    try:
        conn = psycopg2.connect(**DB_CONFIG, options='-c client_encoding=UTF8')
        logger.info("✅ Connexion PostgreSQL réussie")
        return conn
    except Exception as e:
        logger.error(f"❌ Erreur de connexion à PostgreSQL : {e}")
        exit(1)

# ============================================================
# INSÉRER UN COMMIT
# ============================================================
def insert_commit(conn, repo_id, commit, branch_id):
    try:
        sha = commit.sha
        message = commit.commit.message
        author = commit.commit.author.name if commit.commit.author else None
        author_email = commit.commit.author.email if commit.commit.author else None
        committer = commit.commit.committer.name if commit.commit.committer else None
        committer_email = commit.commit.committer.email if commit.commit.committer else None
        authored_date = commit.commit.author.date.replace(tzinfo=None) if commit.commit.author and commit.commit.author.date else None
        committed_date = commit.commit.committer.date.replace(tzinfo=None) if commit.commit.committer and commit.commit.committer.date else None
        stats = commit.stats if hasattr(commit, "stats") else None
        additions = stats.additions if stats else 0
        deletions = stats.deletions if stats else 0
        total = stats.total if stats else 0
        parent_count = len(commit.parents)
        is_merge = parent_count > 1
        comment_count = commit.commit.comment_count if hasattr(commit.commit, "comment_count") else 0

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO odoo_devlog.commits (
                    repo_id, branch_id, sha, html_url, message,
                    author_name, author_email, committer_name, committer_email,
                    authored_date, committed_date,
                    comment_count, additions, deletions, total_changes,
                    parent_count, is_merge
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (sha) DO NOTHING
                RETURNING id;
            """, (
                repo_id,
                branch_id,
                sha,
                commit.html_url,
                message,
                author,
                author_email,
                committer,
                committer_email,
                authored_date,
                committed_date,
                comment_count,
                additions,
                deletions,
                total,
                parent_count,
                is_merge
            ))
            result = cur.fetchone()
            commit_id = result[0] if result else None
            conn.commit()
            return commit_id
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'insertion du commit {sha}: {e}")
        conn.rollback()
        return None

# ============================================================
# INSÉRER LES FICHIERS MODIFIÉS
# ============================================================
def insert_files_changed(conn, commit_id, files):
    try:
        with conn.cursor() as cur:
            for file in files:
                cur.execute("""
                    INSERT INTO odoo_devlog.file_changes (
                        commit_id, filename, status, additions, deletions, changes, patch,
                        previous_filename, blob_url, raw_url, contents_url
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING;
                """, (
                    commit_id,
                    file.filename,
                    file.status,
                    file.additions,
                    file.deletions,
                    file.changes,
                    file.patch[:50000] if hasattr(file, "patch") and file.patch else None,
                    getattr(file, "previous_filename", None),
                    getattr(file, "blob_url", None),
                    getattr(file, "raw_url", None),
                    getattr(file, "contents_url", None)
                ))
            conn.commit()
    except Exception as e:
        logger.error(f"❌ Erreur lors de l'insertion des fichiers pour le commit {commit_id}: {e}")
        conn.rollback()

# ============================================================
# CRÉER UNE ENTRÉE DANS LE LOG D'IMPORT
# ============================================================
def create_import_log(conn, repo_id, branch_name):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO odoo_devlog.import_log (repo_id, branch_name, status)
            VALUES (%s, %s, 'running')
            RETURNING id;
        """, (repo_id, branch_name))
        log_id = cur.fetchone()[0]
        conn.commit()
        return log_id

def update_import_log(conn, log_id, status, total_commits=0, error_message=None):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE odoo_devlog.import_log
            SET status = %s, total_commits_imported = %s, ended_at = NOW(), error_message = %s
            WHERE id = %s;
        """, (status, total_commits, error_message, log_id))
        conn.commit()

# ============================================================
# RÉCUPÉRER ET INSÉRER LES COMMITS D'UNE BRANCHE
# ============================================================
def fetch_commits_for_branch(repo_name, branch_name):
    conn = None
    log_id = None

    try:
        g = Github(GITHUB_TOKEN)
        repo = g.get_repo(repo_name)
        conn = connect_db()

        with conn.cursor() as cur:
            cur.execute("SELECT id FROM odoo_devlog.repositories WHERE full_name = %s;", (repo_name,))
            result = cur.fetchone()
            if not result:
                logger.error(f"❌ Dépôt {repo_name} non trouvé dans la base.")
                return
            repo_id = result[0]

            cur.execute("SELECT id FROM odoo_devlog.branches WHERE repo_id = %s AND name = %s;", (repo_id, branch_name))
            branch_data = cur.fetchone()
            if not branch_data:
                logger.error(f"❌ Branche {branch_name} non trouvée dans la base pour {repo_name}.")
                return
            branch_id = branch_data[0]

        # Créer une entrée de log
        log_id = create_import_log(conn, repo_id, branch_name)
        logger.info(f"🔄 Récupération des commits de {repo_name} ({branch_name})...")

        commits = repo.get_commits(sha=branch_name)
        count = 0
        skipped = 0

        for commit in commits:
            # Vérifier le rate limit GitHub
            rate_limit = g.get_rate_limit()
            if rate_limit.core.remaining < 100:
                logger.warning(f"⚠️  Rate limit faible: {rate_limit.core.remaining} requêtes restantes. Pause de 60 secondes...")
                time.sleep(60)

            commit_id = insert_commit(conn, repo_id, commit, branch_id)
            if commit_id:
                if commit.files:
                    insert_files_changed(conn, commit_id, commit.files)
                count += 1
            else:
                skipped += 1

            if count % 50 == 0:
                logger.info(f"   → {count} commits enregistrés, {skipped} ignorés (déjà présents)...")

            # Limite de sécurité (si MAX_COMMITS_PER_BRANCH > 0)
            if MAX_COMMITS_PER_BRANCH > 0 and count >= MAX_COMMITS_PER_BRANCH:
                logger.warning(f"⚠️  Limite de {MAX_COMMITS_PER_BRANCH} commits atteinte. Arrêt.")
                break

        # Mettre à jour le log avec succès
        update_import_log(conn, log_id, 'success', count)
        logger.info(f"✅ Synchronisation terminée : {count} commits importés, {skipped} ignorés pour {repo_name} ({branch_name}).")

    except GithubException as e:
        error_msg = f"Erreur GitHub API: {e.status} - {e.data}"
        logger.error(f"❌ {error_msg}")
        if log_id and conn:
            update_import_log(conn, log_id, 'failed', error_message=error_msg)
    except Exception as e:
        error_msg = f"Erreur inattendue: {str(e)}"
        logger.error(f"❌ {error_msg}")
        if log_id and conn:
            update_import_log(conn, log_id, 'failed', error_message=error_msg)
    finally:
        if conn:
            conn.close()

# ============================================================
# FONCTION : Fetch incrémental (seulement les nouveaux commits)
# ============================================================
def fetch_new_commits_only(repo_name, branch_name):
    """Récupère uniquement les commits plus récents que le dernier stocké en BDD"""
    conn = None
    log_id = None

    try:
        g = Github(GITHUB_TOKEN)
        repo = g.get_repo(repo_name)
        conn = connect_db()

        with conn.cursor() as cur:
            cur.execute("SELECT id FROM odoo_devlog.repositories WHERE full_name = %s;", (repo_name,))
            result = cur.fetchone()
            if not result:
                logger.error(f"❌ Dépôt {repo_name} non trouvé dans la base.")
                return
            repo_id = result[0]

            cur.execute("SELECT id FROM odoo_devlog.branches WHERE repo_id = %s AND name = %s;", (repo_id, branch_name))
            branch_data = cur.fetchone()
            if not branch_data:
                logger.error(f"❌ Branche {branch_name} non trouvée dans la base pour {repo_name}.")
                return
            branch_id = branch_data[0]

            # Récupérer le dernier commit stocké pour cette branche
            cur.execute("""
                SELECT sha, committed_date
                FROM odoo_devlog.commits
                WHERE branch_id = %s
                ORDER BY committed_date DESC
                LIMIT 1;
            """, (branch_id,))
            last_commit = cur.fetchone()

        # Créer une entrée de log
        log_id = create_import_log(conn, repo_id, branch_name)

        if last_commit:
            last_sha, last_date = last_commit
            logger.info(f"🔄 Récupération des nouveaux commits de {repo_name} ({branch_name}) depuis {last_sha[:7]} ({last_date})...")
        else:
            logger.info(f"🔄 Première récupération des commits de {repo_name} ({branch_name})...")

        commits = repo.get_commits(sha=branch_name)
        count = 0
        skipped = 0

        for commit in commits:
            # Si on atteint le dernier commit connu, on arrête
            if last_commit and commit.sha == last_commit[0]:
                logger.info(f"✅ Dernier commit connu atteint ({commit.sha[:7]}). Arrêt.")
                break

            # Vérifier le rate limit GitHub
            rate_limit = g.get_rate_limit()
            if rate_limit.core.remaining < 100:
                logger.warning(f"⚠️  Rate limit faible: {rate_limit.core.remaining} requêtes restantes. Pause de 60 secondes...")
                time.sleep(60)

            commit_id = insert_commit(conn, repo_id, commit, branch_id)
            if commit_id:
                if commit.files:
                    insert_files_changed(conn, commit_id, commit.files)
                count += 1
            else:
                skipped += 1

            if count % 50 == 0:
                logger.info(f"   → {count} nouveaux commits enregistrés, {skipped} ignorés...")

            # Limite de sécurité (si MAX_COMMITS_PER_BRANCH > 0)
            if MAX_COMMITS_PER_BRANCH > 0 and count >= MAX_COMMITS_PER_BRANCH:
                logger.warning(f"⚠️  Limite de {MAX_COMMITS_PER_BRANCH} commits atteinte. Arrêt.")
                break

        # Mettre à jour le log avec succès
        update_import_log(conn, log_id, 'success', count)
        logger.info(f"✅ Synchronisation terminée : {count} nouveaux commits importés pour {repo_name} ({branch_name}).")

    except GithubException as e:
        error_msg = f"Erreur GitHub API: {e.status} - {e.data}"
        logger.error(f"❌ {error_msg}")
        if log_id and conn:
            update_import_log(conn, log_id, 'failed', error_message=error_msg)
    except Exception as e:
        error_msg = f"Erreur inattendue: {str(e)}"
        logger.error(f"❌ {error_msg}")
        if log_id and conn:
            update_import_log(conn, log_id, 'failed', error_message=error_msg)
    finally:
        if conn:
            conn.close()

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    import sys

    # Mode incrémental par défaut (seulement les nouveaux commits)
    mode = sys.argv[1] if len(sys.argv) > 1 else "incremental"

    if MAX_COMMITS_PER_BRANCH == 0:
        logger.info("📊 Configuration : AUCUNE LIMITE de commits (récupération complète)")
    else:
        logger.info(f"📊 Configuration : Limite de {MAX_COMMITS_PER_BRANCH} commits par branche")

    if mode == "full":
        logger.info("🚀 Mode FULL : récupération de tous les commits")
        for repo in REPOSITORIES:
            for branch in BRANCHES:
                fetch_commits_for_branch(repo, branch)
    else:
        logger.info("🚀 Mode INCREMENTAL : récupération des nouveaux commits uniquement")
        for repo in REPOSITORIES:
            for branch in BRANCHES:
                fetch_new_commits_only(repo, branch)
