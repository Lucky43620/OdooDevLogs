-- ============================================================
-- DATABASE : odoo_devlog
-- PURPOSE  : Structure pour le suivi des commits et changements Odoo
-- AUTHOR   : Lucky43
-- ============================================================

CREATE SCHEMA IF NOT EXISTS odoo_devlog;
SET search_path TO odoo_devlog;

-- ============================================================
-- TABLE : repositories
-- ============================================================
CREATE TABLE repositories (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) UNIQUE NOT NULL,   -- ex: odoo/odoo
    description TEXT,
    default_branch VARCHAR(100),
    html_url TEXT,
    clone_url TEXT,
    pushed_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- ============================================================
-- TABLE : branches
-- ============================================================
CREATE TABLE branches (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,              -- ex: 17.0, 18.0, master
    last_commit_sha VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    UNIQUE(repo_id, name)
);

-- ============================================================
-- TABLE : commits
-- ============================================================
CREATE TABLE commits (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    sha VARCHAR(50) UNIQUE NOT NULL,
    html_url TEXT,
    message TEXT,
    author_name VARCHAR(150),
    author_email VARCHAR(200),
    committer_name VARCHAR(150),
    committer_email VARCHAR(200),
    authored_date TIMESTAMP,
    committed_date TIMESTAMP,
    comment_count INT,
    additions INT DEFAULT 0,
    deletions INT DEFAULT 0,
    total_changes INT DEFAULT 0,
    parent_count INT DEFAULT 0,
    is_merge BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- TABLE : commit_parents
-- ============================================================
CREATE TABLE commit_parents (
    commit_id INTEGER REFERENCES commits(id) ON DELETE CASCADE,
    parent_sha VARCHAR(50) NOT NULL,
    PRIMARY KEY (commit_id, parent_sha)
);

-- ============================================================
-- TABLE : file_changes
-- ============================================================
CREATE TABLE file_changes (
    id SERIAL PRIMARY KEY,
    commit_id INTEGER NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('added', 'modified', 'removed', 'renamed')),
    additions INT DEFAULT 0,
    deletions INT DEFAULT 0,
    changes INT DEFAULT 0,
    previous_filename TEXT,
    patch TEXT,                              -- diff complet
    blob_url TEXT,
    raw_url TEXT,
    contents_url TEXT
);

CREATE INDEX idx_file_changes_commit_id ON file_changes(commit_id);

-- ============================================================
-- TABLE : modules (détection automatique ou ajout manuel)
-- ============================================================
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,              -- ex: account, sale, purchase
    path_prefix TEXT,                        -- ex: addons/account/
    UNIQUE(repo_id, name)
);

-- ============================================================
-- TABLE : module_changes (relie commits <-> modules)
-- ============================================================
CREATE TABLE module_changes (
    id SERIAL PRIMARY KEY,
    commit_id INTEGER NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    summary TEXT
);

-- ============================================================
-- TABLE : detected_changes (analyse des diffs)
-- ============================================================
CREATE TABLE detected_changes (
    id SERIAL PRIMARY KEY,
    file_change_id INTEGER REFERENCES file_changes(id) ON DELETE CASCADE,
    type VARCHAR(50),                        -- ex: field_rename, model_add, method_remove
    element_type VARCHAR(50),                -- ex: field, model, view, method
    element_old TEXT,
    element_new TEXT,
    module_name VARCHAR(100),
    confidence FLOAT DEFAULT 1.0,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_detected_changes_type ON detected_changes(type);
CREATE INDEX idx_detected_changes_module ON detected_changes(module_name);

-- ============================================================
-- TABLE : version_tracking (pour suivre les diffs entre versions)
-- ============================================================
CREATE TABLE version_tracking (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    from_branch VARCHAR(50),
    to_branch VARCHAR(50),
    compared_at TIMESTAMP DEFAULT NOW(),
    total_commits INT,
    total_files_changed INT,
    summary TEXT
);

-- ============================================================
-- TABLE : import_log (suivi des tâches d’importation GitHub)
-- ============================================================
CREATE TABLE import_log (
    id SERIAL PRIMARY KEY,
    repo_id INTEGER REFERENCES repositories(id),
    branch_name VARCHAR(100),
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    total_commits_imported INT DEFAULT 0,
    status VARCHAR(20) CHECK (status IN ('pending', 'running', 'success', 'failed')) DEFAULT 'pending',
    error_message TEXT
);
