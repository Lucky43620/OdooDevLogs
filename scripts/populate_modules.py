import os
import psycopg2
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "odoo_devlog"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": 5432
}

def populate_modules():
    """Peuple la table modules en extrayant les modules des file_changes"""
    try:
        conn = psycopg2.connect(**DB_CONFIG, options='-c client_encoding=UTF8')
        logger.info("✅ Connexion PostgreSQL réussie")

        with conn.cursor() as cur:
            cur.execute("SELECT id, full_name FROM odoo_devlog.repositories")
            repositories = cur.fetchall()

            for repo_id, repo_name in repositories:
                logger.info(f"\n📦 Traitement de {repo_name}")

                cur.execute("""
                    SELECT DISTINCT
                        CASE
                            WHEN filename LIKE 'addons/%' THEN
                                SPLIT_PART(SUBSTRING(filename FROM 8), '/', 1)
                            WHEN filename LIKE 'odoo/addons/%' THEN
                                SPLIT_PART(SUBSTRING(filename FROM 13), '/', 1)
                            ELSE
                                SPLIT_PART(filename, '/', 1)
                        END as module_name
                    FROM odoo_devlog.file_changes fc
                    INNER JOIN odoo_devlog.commits c ON c.id = fc.commit_id
                    WHERE c.repo_id = %s
                        AND (
                            filename LIKE 'addons/%/%'
                            OR filename LIKE 'odoo/addons/%/%'
                            OR (filename LIKE '%/__manifest__.py' AND filename NOT LIKE 'setup/%')
                            OR (filename LIKE '%/__openerp__.py' AND filename NOT LIKE 'setup/%')
                        )
                    ORDER BY module_name
                """, (repo_id,))

                modules = cur.fetchall()
                count = 0
                total = 0

                for row in modules:
                    total += 1
                    module_name = row[0] if row and len(row) > 0 else None

                    if not module_name or len(module_name) == 0 or module_name in ['.', '..', 'setup', 'addons', 'odoo', '']:
                        continue

                    try:
                        path_prefix = f"addons/{module_name}/"
                        cur.execute("""
                            INSERT INTO odoo_devlog.modules (repo_id, name, path_prefix)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (repo_id, name) DO NOTHING
                            RETURNING id
                        """, (repo_id, module_name, path_prefix))
                        result = cur.fetchone()
                        if result:
                            count += 1
                    except Exception as e:
                        logger.warning(f"⚠️  Erreur pour module {module_name}: {e}")
                        continue

                conn.commit()
                logger.info(f"✅ {count} nouveaux modules ajoutés (sur {total} trouvés) pour {repo_name}")

        conn.close()
        logger.info("\n✅ Population des modules terminée !")

    except Exception as e:
        logger.error(f"❌ Erreur : {e}")
        exit(1)

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("🔧 POPULATION DES MODULES")
    logger.info("=" * 60)
    populate_modules()
    logger.info("=" * 60)
