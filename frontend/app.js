// Configuration de l'API - utilise window.API_BASE_URL défini dans config.js
let API_BASE_URL = window.API_BASE_URL || 'http://localhost:8000';

// État de l'application
let state = {
    currentPage: 0,
    currentBranch: null,
    repositories: [],
    branches: [],
    config: null,
    searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]')
};

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Charger la config d'abord
    if (window.loadConfig) {
        state.config = await window.loadConfig();
        API_BASE_URL = window.API_BASE_URL; // Mise à jour après chargement config
    }

    initTabs();
    loadDashboard();
    loadRepositories();
    loadCommitTypes();
    loadMigrationVersions();
    loadModules();
    loadAdminReposAndBranches();
    setupEventListeners();
    initKeyboardShortcuts();
    checkSyncStatus();

    // Charger le statut fetch si on est sur l'onglet Admin
    let fetchStatusLoaded = false;
    const adminTab = document.querySelector('[data-tab="admin"]');
    if (adminTab) {
        adminTab.addEventListener('click', () => {
            if (!fetchStatusLoaded) {
                fetchStatusLoaded = true;
                setTimeout(() => {
                    loadFetchStatus();
                }, 100);
            }
        });
    }
});

// ============================================================
// GESTION DES TABS
// ============================================================
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Désactiver tous les tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activer le tab sélectionné
            btn.classList.add('active');
            document.getElementById(tabName).classList.add('active');

            // Charger les données selon le tab
            if (tabName === 'stats') {
                loadDetailedStats();
            }
        });
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // Commits tab
    document.getElementById('repoSelect').addEventListener('change', onRepoChange);
    document.getElementById('branchSelect').addEventListener('change', onBranchChange);
    document.getElementById('commitTypeFilter').addEventListener('change', onSearchChange);
    document.getElementById('commitFileExtension').addEventListener('change', onSearchChange);
    document.getElementById('searchInput').addEventListener('input', debounce(onSearchChange, 500));
    document.getElementById('authorFilter').addEventListener('input', debounce(onSearchChange, 500));

    // Compare tab
    document.getElementById('compareRepoSelect').addEventListener('change', onCompareRepoChange);
    document.getElementById('compareBtn').addEventListener('click', onCompareClick);

    // Migration tab
    document.getElementById('migrationSearch').addEventListener('input', debounce(searchMigrationChanges, 800));
    document.getElementById('migrationFromVersion').addEventListener('change', () => {
        if (document.getElementById('migrationSearch').value.trim().length >= 3) {
            searchMigrationChanges();
        }
    });
    document.getElementById('migrationToVersion').addEventListener('change', () => {
        if (document.getElementById('migrationSearch').value.trim().length >= 3) {
            searchMigrationChanges();
        }
    });
    document.getElementById('migrationModule').addEventListener('change', () => {
        if (document.getElementById('migrationSearch').value.trim().length >= 3) {
            searchMigrationChanges();
        }
    });
    document.getElementById('migrationCommitType').addEventListener('change', () => {
        if (document.getElementById('migrationSearch').value.trim().length >= 3) {
            searchMigrationChanges();
        }
    });
    document.getElementById('migrationFileExtension').addEventListener('change', () => {
        if (document.getElementById('migrationSearch').value.trim().length >= 3) {
            searchMigrationChanges();
        }
    });

    // Modal - plus besoin car géré dans le HTML avec onclick
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats/summary`);
        const data = await response.json();

        document.getElementById('totalRepos').textContent = data.total_repositories;
        document.getElementById('totalBranches').textContent = data.total_branches;
        document.getElementById('totalCommits').textContent = formatNumber(data.total_commits);
        document.getElementById('uniqueAuthors').textContent = data.unique_authors;
        document.getElementById('totalAdditions').textContent = formatNumber(data.total_additions);
        document.getElementById('totalDeletions').textContent = formatNumber(data.total_deletions);

        loadTopContributors();
    } catch (error) {
        console.error('Erreur lors du chargement du dashboard:', error);
    }
}

async function loadTopContributors() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats/top-contributors?limit=10`);
        const data = await response.json();

        const container = document.getElementById('topContributors');
        container.innerHTML = data.map((contributor, index) => `
            <div class="contributor-item">
                <div>
                    <span style="color: var(--primary-color); font-weight: 700; margin-right: 10px;">#${index + 1}</span>
                    <span class="contributor-name">${contributor.author}</span>
                </div>
                <div class="contributor-stats">
                    <span>💾 ${contributor.commits} commits</span>
                    <span class="stat-add">➕ ${formatNumber(contributor.additions)}</span>
                    <span class="stat-del">➖ ${formatNumber(contributor.deletions)}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erreur lors du chargement des contributeurs:', error);
    }
}

// ============================================================
// REPOSITORIES & BRANCHES
// ============================================================
async function loadRepositories() {
    try {
        const response = await fetch(`${API_BASE_URL}/repositories`);
        state.repositories = await response.json();

        const repoSelect = document.getElementById('repoSelect');
        const compareRepoSelect = document.getElementById('compareRepoSelect');

        const options = state.repositories.map(repo =>
            `<option value="${repo.id}">${repo.full_name}</option>`
        ).join('');

        repoSelect.innerHTML = '<option value="">Sélectionner un dépôt...</option>' + options;
        compareRepoSelect.innerHTML = '<option value="">Sélectionner un dépôt...</option>' + options;
    } catch (error) {
        console.error('Erreur lors du chargement des dépôts:', error);
    }
}

async function onRepoChange(e) {
    const repoId = e.target.value;
    const branchSelect = document.getElementById('branchSelect');

    if (!repoId) {
        branchSelect.disabled = true;
        branchSelect.innerHTML = '<option value="">Sélectionner une branche...</option>';
        document.getElementById('commitsList').innerHTML = '<p class="info-text">Sélectionnez un dépôt et une branche</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/repositories/${repoId}/branches`);
        state.branches = await response.json();

        branchSelect.innerHTML = '<option value="">Sélectionner une branche...</option>' +
            state.branches.map(branch =>
                `<option value="${branch.id}">${branch.name}${branch.is_default ? ' (défaut)' : ''}</option>`
            ).join('');
        branchSelect.disabled = false;
    } catch (error) {
        console.error('Erreur lors du chargement des branches:', error);
    }
}

async function onBranchChange(e) {
    const branchId = e.target.value;
    if (!branchId) {
        document.getElementById('commitsList').innerHTML = '<p class="info-text">Sélectionnez une branche</p>';
        return;
    }

    state.currentBranch = branchId;
    state.currentPage = 0;
    loadCommits();
}

// ============================================================
// COMMITS
// ============================================================
async function loadCommits() {
    const branchId = state.currentBranch;
    const search = document.getElementById('searchInput').value;
    const author = document.getElementById('authorFilter').value;
    const commitType = document.getElementById('commitTypeFilter').value;
    const fileExtension = document.getElementById('commitFileExtension').value;
    const module = document.getElementById('commitModule').value;
    const offset = state.currentPage * 100;

    const container = document.getElementById('commitsList');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Chargement des commits...</p></div>';

    try {
        let url = `${API_BASE_URL}/branches/${branchId}/commits?limit=500&offset=${offset}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (author) url += `&author=${encodeURIComponent(author)}`;
        if (commitType) url += `&search=${encodeURIComponent('[' + commitType + ']')}`;
        if (module) url += `&module=${encodeURIComponent(module)}`;

        const response = await fetch(url);
        let commits = await response.json();

        if (fileExtension) {
            const filteredCommits = [];
            const batchSize = 10;

            for (let i = 0; i < commits.length && filteredCommits.length < 100; i += batchSize) {
                const batch = commits.slice(i, i + batchSize);
                const promises = batch.map(async commit => {
                    try {
                        const detailResponse = await fetch(`${API_BASE_URL}/commits/${commit.id}`);
                        const detail = await detailResponse.json();
                        const hasFileWithExtension = detail.files_changed.some(file =>
                            file.filename.endsWith(fileExtension)
                        );
                        return hasFileWithExtension ? commit : null;
                    } catch (err) {
                        return null;
                    }
                });

                const results = await Promise.all(promises);
                results.forEach(result => {
                    if (result) filteredCommits.push(result);
                });
            }
            commits = filteredCommits;
        }

        if (commits.length === 0) {
            container.innerHTML = '<p class="info-text">Aucun commit trouvé</p>';
            return;
        }

        commits = commits.slice(0, 100);

        container.innerHTML = commits.map(commit => {
            const commitType = extractCommitType(commit.message);
            return `
            <div class="commit-item" onclick="showCommitDetails(${commit.id})">
                <div class="commit-header">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <span class="commit-sha">${commit.sha.substring(0, 7)}</span>
                        ${commitType ? `<span class="commit-type-badge" style="background: ${commitType.color};">${commitType.code}</span>` : ''}
                    </div>
                    <span class="commit-date">${formatDate(commit.committed_date)}</span>
                </div>
                <div class="commit-message">${escapeHtml(commit.message.split('\n')[0])}</div>
                <div class="commit-meta">
                    <span class="commit-author">${commit.author_name || 'Unknown'}</span>
                    <div class="commit-stats">
                        <span class="stat-add">+${commit.additions}</span>
                        <span class="stat-del">-${commit.deletions}</span>
                        ${commit.is_merge ? '<span style="color: var(--accent-color);">Merge</span>' : ''}
                    </div>
                </div>
            </div>
        `}).join('');

        updatePagination(commits.length);
    } catch (error) {
        console.error('Erreur lors du chargement des commits:', error);
        container.innerHTML = '<p class="info-text">Erreur lors du chargement des commits</p>';
    }
}

function updatePagination(resultsCount) {
    const pagination = document.getElementById('pagination');
    const hasNext = resultsCount === 100;

    pagination.innerHTML = `
        <button class="page-btn" ${state.currentPage === 0 ? 'disabled' : ''} onclick="changePage(-1)">
            ← Précédent
        </button>
        <span class="page-btn active">Page ${state.currentPage + 1}</span>
        <button class="page-btn" ${!hasNext ? 'disabled' : ''} onclick="changePage(1)">
            Suivant →
        </button>
    `;
}

function changePage(direction) {
    state.currentPage += direction;
    loadCommits();
}

function onSearchChange() {
    state.currentPage = 0;
    loadCommits();
}

// ============================================================
// COMMIT DETAILS
// ============================================================
async function showCommitDetails(commitId) {
    const modal = document.getElementById('commitModal');
    const details = document.getElementById('commitDetails');

    details.innerHTML = '<p class="loading">Chargement des détails</p>';
    modal.classList.add('active');

    try {
        const response = await fetch(`${API_BASE_URL}/commits/${commitId}`);
        const commit = await response.json();

        details.innerHTML = `
            <div style="margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; padding: 20px; background: var(--gray-50); border-left: 4px solid var(--black);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <span style="font-size: 0.85rem; color: var(--gray-600); font-weight: 600; text-transform: uppercase;">SHA</span>
                            <span class="commit-sha" style="font-size: 1rem; font-weight: 700;">${commit.sha.substring(0, 12)}</span>
                            <button onclick="copyToClipboard('${commit.sha}')" class="btn-secondary" style="padding: 5px 10px; font-size: 0.75rem;">
                                📋 Copier
                            </button>
                            <a href="${commit.html_url}" target="_blank" class="btn" style="padding: 5px 15px; font-size: 0.75rem; text-decoration: none;">
                                Voir sur GitHub →
                            </a>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <span style="font-size: 0.85rem; color: var(--gray-600); font-weight: 600;">👤</span>
                            <strong>${commit.author_name}</strong>
                            <span style="color: var(--gray-600); margin-left: 5px;">(${commit.author_email})</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--gray-600);">
                            <span style="font-weight: 600;">📅</span> ${formatDate(commit.committed_date)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; align-items: center; background: var(--white); padding: 15px; border: 1px solid var(--gray-200);">
                        <div style="text-align: center;">
                            <div class="stat-add" style="font-size: 1.5rem; font-weight: 700;">+${commit.additions}</div>
                            <div style="font-size: 0.75rem; color: var(--gray-600); text-transform: uppercase;">Ajouts</div>
                        </div>
                        <div style="width: 1px; height: 40px; background: var(--gray-200);"></div>
                        <div style="text-align: center;">
                            <div class="stat-del" style="font-size: 1.5rem; font-weight: 700;">-${commit.deletions}</div>
                            <div style="font-size: 0.75rem; color: var(--gray-600); text-transform: uppercase;">Suppressions</div>
                        </div>
                        <div style="width: 1px; height: 40px; background: var(--gray-200);"></div>
                        <div style="text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--black);">${commit.total_changes}</div>
                            <div style="font-size: 0.75rem; color: var(--gray-600); text-transform: uppercase;">Total</div>
                        </div>
                    </div>
                </div>
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 0.85rem; color: var(--gray-600); font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">Message du commit</div>
                    <pre style="background: var(--gray-50); padding: 15px; border-left: 4px solid var(--gray-300); white-space: pre-wrap; font-size: 0.9rem; line-height: 1.6;">${escapeHtml(commit.message)}</pre>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>Fichiers modifiés (${commit.files_changed.length})</h3>
                <div>
                    <button onclick="expandAllDiffs()" class="btn-secondary" style="margin-right: 10px;">Tout ouvrir</button>
                    <button onclick="collapseAllDiffs()" class="btn-secondary">Tout fermer</button>
                </div>
            </div>
            <div class="file-changes">
                ${commit.files_changed.map((file, index) => `
                    <div class="file-item">
                        <div class="file-header" onclick="toggleDiff(${index})">
                            <div style="display: flex; align-items: center; flex: 1;">
                                <span class="expand-icon" id="expand-${index}">▶</span>
                                <span class="file-status status-${file.status}">${file.status}</span>
                                <span class="file-name">
                                    ${file.filename}
                                    ${file.previous_filename ? `<br><small style="color: var(--text-secondary);">← ${file.previous_filename}</small>` : ''}
                                </span>
                            </div>
                            <div class="file-stats">
                                <span class="stat-add">+${file.additions}</span>
                                <span class="stat-del">-${file.deletions}</span>
                            </div>
                        </div>
                        <div class="diff-viewer" id="diff-${index}">
                            ${file.patch ? renderDiff(file.patch) : '<div class="no-diff">Pas de diff disponible (fichier binaire ou trop gros)</div>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Erreur lors du chargement des détails:', error);
        details.innerHTML = '<p class="info-text">Erreur lors du chargement des détails</p>';
    }
}

function closeModal() {
    document.getElementById('commitModal').classList.remove('active');
}

// ============================================================
// COMPARE
// ============================================================
async function onCompareRepoChange(e) {
    const repoId = e.target.value;
    const branch1Select = document.getElementById('compareBranch1');
    const branch2Select = document.getElementById('compareBranch2');
    const compareBtn = document.getElementById('compareBtn');

    if (!repoId) {
        branch1Select.disabled = true;
        branch2Select.disabled = true;
        compareBtn.disabled = true;
        branch1Select.innerHTML = '<option value="">Sélectionner...</option>';
        branch2Select.innerHTML = '<option value="">Sélectionner...</option>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/repositories/${repoId}/branches`);
        const branches = await response.json();

        const options = branches.map(branch =>
            `<option value="${branch.name}">${branch.name}${branch.is_default ? ' (défaut)' : ''}</option>`
        ).join('');

        branch1Select.innerHTML = '<option value="">Sélectionner...</option>' + options;
        branch2Select.innerHTML = '<option value="">Sélectionner...</option>' + options;
        branch1Select.disabled = false;
        branch2Select.disabled = false;

        branch1Select.addEventListener('change', updateCompareBtn);
        branch2Select.addEventListener('change', updateCompareBtn);
    } catch (error) {
        console.error('Erreur lors du chargement des branches:', error);
    }
}

function updateCompareBtn() {
    const branch1 = document.getElementById('compareBranch1').value;
    const branch2 = document.getElementById('compareBranch2').value;
    const compareBtn = document.getElementById('compareBtn');

    compareBtn.disabled = !branch1 || !branch2 || branch1 === branch2;
}

async function onCompareClick() {
    const repoId = document.getElementById('compareRepoSelect').value;
    const branch1 = document.getElementById('compareBranch1').value;
    const branch2 = document.getElementById('compareBranch2').value;
    const results = document.getElementById('compareResults');

    results.innerHTML = '<p class="loading">Comparaison en cours</p>';

    try {
        const response = await fetch(
            `${API_BASE_URL}/compare?repo_id=${repoId}&branch1=${branch1}&branch2=${branch2}&limit=100`
        );
        const data = await response.json();

        results.innerHTML = `
            <div class="compare-grid">
                <div class="branch-comparison">
                    <h3>🌿 ${data.branch1.name}</h3>
                    <div class="comparison-stats">
                        <div class="stat-card">
                            <div class="stat-value">${formatNumber(data.branch1.stats.total_commits)}</div>
                            <div class="stat-label">Total commits</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${data.branch1.stats.unique_authors}</div>
                            <div class="stat-label">Contributeurs</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value stat-add">${formatNumber(data.branch1.stats.total_additions)}</div>
                            <div class="stat-label">Lignes ajoutées</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value stat-del">${formatNumber(data.branch1.stats.total_deletions)}</div>
                            <div class="stat-label">Lignes supprimées</div>
                        </div>
                    </div>
                    <h4>Commits uniques (${data.branch1.unique_commits.length})</h4>
                    <div class="unique-commits">
                        ${data.branch1.unique_commits.map(commit => `
                            <div class="commit-item">
                                <div class="commit-sha">${commit.sha.substring(0, 7)}</div>
                                <div class="commit-message">${escapeHtml(commit.message.split('\n')[0])}</div>
                                <div class="commit-meta">
                                    <span>👤 ${commit.author}</span>
                                    <span>${formatDate(commit.date)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="branch-comparison">
                    <h3>🌿 ${data.branch2.name}</h3>
                    <div class="comparison-stats">
                        <div class="stat-card">
                            <div class="stat-value">${formatNumber(data.branch2.stats.total_commits)}</div>
                            <div class="stat-label">Total commits</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${data.branch2.stats.unique_authors}</div>
                            <div class="stat-label">Contributeurs</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value stat-add">${formatNumber(data.branch2.stats.total_additions)}</div>
                            <div class="stat-label">Lignes ajoutées</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value stat-del">${formatNumber(data.branch2.stats.total_deletions)}</div>
                            <div class="stat-label">Lignes supprimées</div>
                        </div>
                    </div>
                    <h4>Commits uniques (${data.branch2.unique_commits.length})</h4>
                    <div class="unique-commits">
                        ${data.branch2.unique_commits.map(commit => `
                            <div class="commit-item">
                                <div class="commit-sha">${commit.sha.substring(0, 7)}</div>
                                <div class="commit-message">${escapeHtml(commit.message.split('\n')[0])}</div>
                                <div class="commit-meta">
                                    <span>👤 ${commit.author}</span>
                                    <span>${formatDate(commit.date)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erreur lors de la comparaison:', error);
        results.innerHTML = '<p class="info-text">Erreur lors de la comparaison</p>';
    }
}

// ============================================================
// DETAILED STATS
// ============================================================
async function loadDetailedStats() {
    const container = document.getElementById('detailedStats');
    container.innerHTML = '<p class="loading">Chargement des statistiques détaillées</p>';

    // Pour l'instant, réutiliser les stats existantes
    // Tu peux ajouter d'autres endpoints pour plus de détails
    await loadDashboard();
    container.innerHTML = '<p class="info-text">Plus de statistiques à venir...</p>';
}

// ============================================================
// UTILITAIRES
// ============================================================
function formatNumber(num) {
    return new Intl.NumberFormat('fr-FR').format(num);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================
// DIFF VIEWER
// ============================================================
function toggleDiff(index) {
    const diffViewer = document.getElementById(`diff-${index}`);
    const expandIcon = document.getElementById(`expand-${index}`);

    if (diffViewer.classList.contains('show')) {
        diffViewer.classList.remove('show');
        expandIcon.classList.remove('expanded');
    } else {
        diffViewer.classList.add('show');
        expandIcon.classList.add('expanded');
    }
}

function renderDiff(patch) {
    if (!patch) return '<div class="no-diff">Pas de diff disponible</div>';

    const lines = patch.split('\n');
    let html = '';

    for (const line of lines) {
        let cssClass = 'diff-line-context';

        if (line.startsWith('@@')) {
            cssClass = 'diff-line-header';
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            cssClass = 'diff-line-add';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            cssClass = 'diff-line-remove';
        }

        html += `<div class="diff-line ${cssClass}">${escapeHtml(line)}</div>`;
    }

    return html;
}

function expandAllDiffs() {
    document.querySelectorAll('.diff-viewer').forEach(viewer => {
        viewer.classList.add('show');
    });
    document.querySelectorAll('.expand-icon').forEach(icon => {
        icon.classList.add('expanded');
    });
}

function collapseAllDiffs() {
    document.querySelectorAll('.diff-viewer').forEach(viewer => {
        viewer.classList.remove('show');
    });
    document.querySelectorAll('.expand-icon').forEach(icon => {
        icon.classList.remove('expanded');
    });
}

// ============================================================
// LOAD DYNAMIC DATA
// ============================================================
async function loadCommitTypes() {
    try {
        const response = await fetch(`${API_BASE_URL}/commit-types`);
        const types = await response.json();
        window.commitTypes = types;

        // Remplir le select dans Commits tab
        const typeFilter = document.getElementById('commitTypeFilter');
        typeFilter.innerHTML = '<option value="">Tous les types...</option>' +
            types.map(t => `<option value="${t.code}" style="color: ${t.color};">${t.code} - ${t.label}</option>`).join('');

        // Remplir le select dans Migration tab
        const migrationTypeFilter = document.getElementById('migrationCommitType');
        migrationTypeFilter.innerHTML = '<option value="">Tous les types...</option>' +
            types.map(t => `<option value="${t.code}" style="color: ${t.color};">${t.code} - ${t.label}</option>`).join('');
    } catch (error) {
        console.error('Erreur lors du chargement des types:', error);
    }
}

async function loadMigrationVersions() {
    try {
        const response = await fetch(`${API_BASE_URL}/repositories`);
        const repos = await response.json();

        if (repos.length === 0) return;

        const branchesResponse = await fetch(`${API_BASE_URL}/repositories/${repos[0].id}/branches`);
        const branches = await branchesResponse.json();

        const fromVersionSelect = document.getElementById('migrationFromVersion');
        const toVersionSelect = document.getElementById('migrationToVersion');

        const versionOptions = branches.map(b =>
            `<option value="${b.name}">${b.name}</option>`
        ).join('');

        fromVersionSelect.innerHTML = '<option value="">Sélectionner...</option>' + versionOptions;
        toVersionSelect.innerHTML = '<option value="">Sélectionner...</option>' + versionOptions;
    } catch (error) {
        console.error('Erreur lors du chargement des versions:', error);
    }
}

let modulesData = [];

async function loadModules() {
    try {
        const response = await fetch(`${API_BASE_URL}/modules`);
        const modules = await response.json();
        modulesData = modules.map(m => m.name);
        console.log(`✅ ${modulesData.length} modules chargés`);
        setupModuleAutocomplete();
        setupCommitModuleAutocomplete();
    } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
        modulesData = [];
    }
}

function setupModuleAutocomplete() {
    const input = document.getElementById('migrationModule');
    const suggestionsDiv = document.getElementById('moduleSuggestions');

    if (!input || !suggestionsDiv) return;

    input.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();

        if (value.length < 1) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        const filtered = modulesData
            .filter(m => m.toLowerCase().includes(value))
            .slice(0, 20);

        if (filtered.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        suggestionsDiv.innerHTML = filtered
            .map(m => `<div class="suggestion-item" onclick="selectModule('${m}')">${m}</div>`)
            .join('');
        suggestionsDiv.style.display = 'block';
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            suggestionsDiv.style.display = 'none';
        }, 200);
    });

    input.addEventListener('focus', (e) => {
        if (e.target.value.length > 0) {
            e.target.dispatchEvent(new Event('input'));
        }
    });
}

function selectModule(moduleName) {
    const input = document.getElementById('migrationModule');
    input.value = moduleName;
    document.getElementById('moduleSuggestions').style.display = 'none';
}

function setupCommitModuleAutocomplete() {
    const input = document.getElementById('commitModule');
    const suggestionsDiv = document.getElementById('commitModuleSuggestions');

    if (!input || !suggestionsDiv) return;

    input.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();

        if (value.length < 1) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        const filtered = modulesData
            .filter(m => m.toLowerCase().includes(value))
            .slice(0, 20);

        if (filtered.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        suggestionsDiv.innerHTML = filtered
            .map(m => `<div class="suggestion-item" onclick="selectCommitModule('${m}')">${m}</div>`)
            .join('');
        suggestionsDiv.style.display = 'block';
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            suggestionsDiv.style.display = 'none';
        }, 200);
    });

    input.addEventListener('focus', (e) => {
        if (e.target.value.length > 0) {
            e.target.dispatchEvent(new Event('input'));
        }
    });
}

function selectCommitModule(moduleName) {
    const input = document.getElementById('commitModule');
    input.value = moduleName;
    document.getElementById('commitModuleSuggestions').style.display = 'none';
}

// ============================================================
// MIGRATION HELPER
// ============================================================
async function searchMigrationChanges() {
    const searchTerm = document.getElementById('migrationSearch').value.trim();
    const fromVersion = document.getElementById('migrationFromVersion').value;
    const toVersion = document.getElementById('migrationToVersion').value;
    const module = document.getElementById('migrationModule').value;
    const commitType = document.getElementById('migrationCommitType').value;
    const fileExtension = document.getElementById('migrationFileExtension').value;
    const useRegex = document.getElementById('migrationRegex').checked;
    const resultsDiv = document.getElementById('migrationResults');

    if (!searchTerm || searchTerm.length < 2) {
        resultsDiv.innerHTML = '<p class="info-text">Entrez au moins 2 caractères pour lancer la recherche</p>';
        return;
    }

    if (!fromVersion || !toVersion) {
        resultsDiv.innerHTML = '<p class="info-text">Sélectionnez les versions source et cible</p>';
        return;
    }

    resultsDiv.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Recherche en cours...</p></div>';

    try {
        let url = `${API_BASE_URL}/search/migration?term=${encodeURIComponent(searchTerm)}&from_version=${fromVersion}&to_version=${toVersion}`;
        if (module) url += `&module=${module}`;
        if (commitType) url += `&commit_type=${commitType}`;
        if (useRegex) url += `&use_regex=true`;

        const response = await fetch(url);
        let data = await response.json();

        if (fileExtension) {
            data.results = data.results.filter(r => r.file.filename.endsWith(fileExtension));
            data.count = data.results.length;
        }

        addToSearchHistory(searchTerm, fromVersion, toVersion);

        displayMigrationResults(data, searchTerm);
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        resultsDiv.innerHTML = '<p class="info-text">Erreur lors de la recherche. Vérifiez que des commits sont importés.</p>';
    }
}

function displayMigrationResults(data, searchTerm) {
    const resultsDiv = document.getElementById('migrationResults');

    if (!data.results || data.results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="info-text">
                <p>Aucun changement trouvé pour "<strong>${searchTerm}</strong>"</p>
                <p style="margin-top: 10px; font-size: 0.9rem;">Entre ${data.from_version} et ${data.to_version}</p>
            </div>
        `;
        return;
    }

    const totalAdditions = data.results.reduce((sum, r) => sum + r.file.additions, 0);
    const totalDeletions = data.results.reduce((sum, r) => sum + r.file.deletions, 0);
    const uniqueFiles = new Set(data.results.map(r => r.file.filename)).size;
    const uniqueModules = new Set(data.results.map(r => r.file.filename.split('/')[0])).size;

    let displayedResults = 0;
    const resultsPerPage = 20;

    window.migrationResults = data.results;

    resultsDiv.innerHTML = `
        <div class="migration-summary" style="margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; padding: 20px; background: var(--gray-50); border-left: 4px solid var(--black);">
                <div>
                    <h3 style="font-size: 1.5rem; margin-bottom: 10px;">${data.count} changement(s) trouvé(s)</h3>
                    <div style="display: inline-block; padding: 6px 15px; background: var(--black); color: var(--white); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                        ${data.from_version} → ${data.to_version}
                    </div>
                    <div style="margin-top: 10px; color: var(--gray-600); font-size: 0.9rem;">
                        Recherche: <strong style="color: var(--black);">${escapeHtml(searchTerm)}</strong>
                    </div>
                </div>
                <button onclick="exportMigrationResults()" class="btn-secondary" style="padding: 10px 20px;">
                    📥 Exporter CSV
                </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="padding: 20px; background: var(--white); border: 1px solid var(--gray-200); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
                    <div style="font-size: 0.8rem; color: var(--gray-600); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Fichiers</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--black);">${uniqueFiles}</div>
                </div>
                <div style="padding: 20px; background: var(--white); border: 1px solid var(--gray-200); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
                    <div style="font-size: 0.8rem; color: var(--gray-600); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Modules</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--black);">${uniqueModules}</div>
                </div>
                <div style="padding: 20px; background: var(--white); border: 1px solid var(--gray-200); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
                    <div style="font-size: 0.8rem; color: var(--gray-600); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Ajouts</div>
                    <div style="font-size: 2rem; font-weight: 700;" class="stat-add">+${totalAdditions}</div>
                </div>
                <div style="padding: 20px; background: var(--white); border: 1px solid var(--gray-200); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);">
                    <div style="font-size: 0.8rem; color: var(--gray-600); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Suppressions</div>
                    <div style="font-size: 2rem; font-weight: 700;" class="stat-del">-${totalDeletions}</div>
                </div>
            </div>
        </div>

        <div class="migration-results-list" id="migrationResultsList">
            ${data.results.slice(0, resultsPerPage).map((result, index) => {
                const detectedChange = analyzeChange(result.file.patch, searchTerm);
                return `
                <div style="background: var(--white); padding: 20px; border: 1px solid var(--gray-200); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08); margin-bottom: 20px;">
                    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--gray-200);">
                        <div>
                            <div style="font-size: 1rem; font-weight: 600; color: var(--black); margin-bottom: 8px; word-break: break-all; font-family: 'Courier New', monospace;">${result.file.filename}</div>
                            <div style="display: flex; gap: 10px; align-items: center; font-size: 0.85rem; color: var(--gray-600);">
                                <span class="file-status status-${result.file.status}">${result.file.status}</span>
                                <span>${result.commit.branch}</span>
                            </div>
                        </div>
                    </div>

                    <div class="migration-commit-info" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <span class="commit-sha">${result.commit.sha.substring(0, 7)}</span>
                        <span style="flex: 1; min-width: 200px;">${escapeHtml(result.commit.message.split('\n')[0])}</span>
                        ${result.commit.html_url ? `
                            <a href="${result.commit.html_url}" target="_blank" class="btn" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none;">
                                Voir sur GitHub →
                            </a>
                        ` : ''}
                    </div>

                    <div style="display: flex; gap: 15px; margin-bottom: 15px; font-size: 0.85rem; color: var(--gray-600); flex-wrap: wrap;">
                        <span>👤 <strong style="color: var(--black);">${result.commit.author || 'Unknown'}</strong></span>
                        <span>📅 ${formatDate(result.commit.date)}</span>
                        <span class="stat-add" style="font-weight: 700;">+${result.file.additions}</span>
                        <span class="stat-del" style="font-weight: 700;">-${result.file.deletions}</span>
                    </div>

                    ${detectedChange ? `
                        <div class="diff-comparison">
                            <div class="diff-version">
                                <div class="diff-version-title">${data.from_version}</div>
                                <div class="diff-version-content">${escapeHtml(detectedChange.old)}</div>
                            </div>
                            <div class="diff-version">
                                <div class="diff-version-title">${data.to_version}</div>
                                <div class="diff-version-content">${escapeHtml(detectedChange.new)}</div>
                            </div>
                        </div>
                    ` : ''}

                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="showMigrationDiff(${index})" class="btn" style="padding: 8px 15px; font-size: 0.85rem;">
                            Voir le diff complet
                        </button>
                        <button onclick="copyDiff(${index})" class="btn-secondary" style="padding: 8px 15px; font-size: 0.85rem;">
                            📋 Copier
                        </button>
                    </div>

                    <div class="diff-viewer" id="migration-diff-${index}" style="display: none; margin-top: 15px; border-top: 1px solid var(--gray-200); padding-top: 15px;">
                        ${highlightSearchTerm(renderDiffSideBySide(result.file.patch, data.from_version, data.to_version), searchTerm)}
                    </div>
                </div>
            `}).join('')}
        </div>

        ${data.results.length > resultsPerPage ? `
            <div style="text-align: center; margin: 30px 0;">
                <button id="loadMoreResults" class="btn" style="padding: 12px 30px;">
                    Charger plus de résultats (${data.results.length - resultsPerPage} restants)
                </button>
            </div>
        ` : ''}
    `;

    displayedResults = Math.min(resultsPerPage, data.results.length);

    if (data.results.length > resultsPerPage) {
        const loadMoreBtn = document.getElementById('loadMoreResults');
        loadMoreBtn?.addEventListener('click', () => {
            const nextBatch = data.results.slice(displayedResults, displayedResults + resultsPerPage);
            const resultsList = document.getElementById('migrationResultsList');

            nextBatch.forEach((result, i) => {
                const index = displayedResults + i;
                const detectedChange = analyzeChange(result.file.patch, searchTerm);

                const resultHTML = `
                <div style="background: var(--white); padding: 20px; border: 1px solid var(--gray-200); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08); margin-bottom: 20px;">
                    <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--gray-200);">
                        <div>
                            <div style="font-size: 1rem; font-weight: 600; color: var(--black); margin-bottom: 8px; word-break: break-all; font-family: 'Courier New', monospace;">${result.file.filename}</div>
                            <div style="display: flex; gap: 10px; align-items: center; font-size: 0.85rem; color: var(--gray-600);">
                                <span class="file-status status-${result.file.status}">${result.file.status}</span>
                                <span>${result.commit.branch}</span>
                            </div>
                        </div>
                    </div>

                    <div class="migration-commit-info" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <span class="commit-sha">${result.commit.sha.substring(0, 7)}</span>
                        <span style="flex: 1; min-width: 200px;">${escapeHtml(result.commit.message.split('\n')[0])}</span>
                        ${result.commit.html_url ? `
                            <a href="${result.commit.html_url}" target="_blank" class="btn" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none;">
                                Voir sur GitHub →
                            </a>
                        ` : ''}
                    </div>

                    <div style="display: flex; gap: 15px; margin-bottom: 15px; font-size: 0.85rem; color: var(--gray-600); flex-wrap: wrap;">
                        <span>👤 <strong style="color: var(--black);">${result.commit.author || 'Unknown'}</strong></span>
                        <span>📅 ${formatDate(result.commit.date)}</span>
                        <span class="stat-add" style="font-weight: 700;">+${result.file.additions}</span>
                        <span class="stat-del" style="font-weight: 700;">-${result.file.deletions}</span>
                    </div>

                    ${detectedChange ? `
                        <div class="diff-comparison">
                            <div class="diff-version">
                                <div class="diff-version-title">${data.from_version}</div>
                                <div class="diff-version-content">${escapeHtml(detectedChange.old)}</div>
                            </div>
                            <div class="diff-version">
                                <div class="diff-version-title">${data.to_version}</div>
                                <div class="diff-version-content">${escapeHtml(detectedChange.new)}</div>
                            </div>
                        </div>
                    ` : ''}

                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="showMigrationDiff(${index})" class="btn" style="padding: 8px 15px; font-size: 0.85rem;">
                            Voir le diff complet
                        </button>
                        <button onclick="copyDiff(${index})" class="btn-secondary" style="padding: 8px 15px; font-size: 0.85rem;">
                            📋 Copier
                        </button>
                    </div>

                    <div class="diff-viewer" id="migration-diff-${index}" style="display: none; margin-top: 15px; border-top: 1px solid var(--gray-200); padding-top: 15px;">
                        ${highlightSearchTerm(renderDiffSideBySide(result.file.patch, data.from_version, data.to_version), searchTerm)}
                    </div>
                </div>
                `;

                resultsList.insertAdjacentHTML('beforeend', resultHTML);
            });

            displayedResults += nextBatch.length;

            if (displayedResults >= data.results.length) {
                loadMoreBtn.remove();
            } else {
                loadMoreBtn.textContent = `Charger plus de résultats (${data.results.length - displayedResults} restants)`;
            }

            showNotification(`${nextBatch.length} résultats supplémentaires chargés`, 'success');
        });
    }
}

function showMigrationDiff(index) {
    const diffViewer = document.getElementById(`migration-diff-${index}`);
    if (diffViewer.style.display === 'none') {
        diffViewer.style.display = 'block';
    } else {
        diffViewer.style.display = 'none';
    }
}

function copyDiff(index) {
    if (!window.migrationResults || !window.migrationResults[index]) return;

    const result = window.migrationResults[index];
    const patch = result.file.patch || '';

    copyToClipboard(patch);
}

function copyToClipboard(text) {
    // Nettoyer le texte des caractères d'échappement HTML
    text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");

    navigator.clipboard.writeText(text).then(() => {
        // Notification visuelle
        showNotification('Copié dans le presse-papiers!', 'success');
    }).catch(err => {
        console.error('Erreur lors de la copie:', err);
        showNotification('Erreur lors de la copie', 'error');
    });
}

function showNotification(message, type = 'success') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach((notif, index) => {
        notif.style.bottom = `${(index + 1) * 70 + 20}px`;
    });

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.bottom = '20px';
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
            const remainingNotifs = document.querySelectorAll('.notification');
            remainingNotifs.forEach((notif, index) => {
                notif.style.bottom = `${index * 70 + 20}px`;
            });
        }, 300);
    }, 2000);
}

function highlightSearchTerm(html, term) {
    if (!term) return html;
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    return html.replace(regex, '<mark style="background: #fbbf24; color: #000; padding: 2px 4px; border-radius: 2px;">$1</mark>');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCommitType(message) {
    if (!message || !window.commitTypes) return null;

    const match = message.match(/^\[([A-Z0-9]+)\]/);
    if (!match) return null;

    const code = match[1];
    return window.commitTypes.find(t => t.code === code);
}

// ============================================================
// SMART DIFF ANALYSIS
// ============================================================
function analyzeChange(patch, searchTerm) {
    if (!patch || !searchTerm) return null;

    const lines = patch.split('\n');
    const oldLines = [];
    const newLines = [];

    // Extraire les lignes qui contiennent le terme de recherche
    for (let line of lines) {
        const lowerLine = line.toLowerCase();
        const lowerTerm = searchTerm.toLowerCase();

        if (lowerLine.includes(lowerTerm)) {
            if (line.startsWith('-') && !line.startsWith('---')) {
                oldLines.push(line.substring(1).trim());
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                newLines.push(line.substring(1).trim());
            }
        }
    }

    // Si on a trouvé des changements
    if (oldLines.length > 0 || newLines.length > 0) {
        return {
            old: oldLines.length > 0 ? oldLines.join('\n') : '(rien)',
            new: newLines.length > 0 ? newLines.join('\n') : '(supprimé)'
        };
    }

    return null;
}

function renderDiffSideBySide(patch, fromVersion, toVersion) {
    if (!patch) return '<p class="info-text">Pas de diff disponible</p>';

    const lines = patch.split('\n');
    let html = '<div class="diff-side-by-side">';
    html += `
        <div class="diff-header-row">
            <div class="diff-column">
                <strong>${fromVersion || 'Ancien'}</strong>
            </div>
            <div class="diff-column">
                <strong>${toVersion || 'Nouveau'}</strong>
            </div>
        </div>
    `;

    let leftContent = [];
    let rightContent = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
            continue; // Skip diff headers
        }

        if (line.startsWith('-')) {
            leftContent.push(`<div class="diff-line diff-del">${escapeHtml(line)}</div>`);
            rightContent.push(`<div class="diff-line diff-empty"></div>`);
        } else if (line.startsWith('+')) {
            leftContent.push(`<div class="diff-line diff-empty"></div>`);
            rightContent.push(`<div class="diff-line diff-add">${escapeHtml(line)}</div>`);
        } else {
            // Context line
            const escapedLine = escapeHtml(line);
            leftContent.push(`<div class="diff-line diff-context">${escapedLine}</div>`);
            rightContent.push(`<div class="diff-line diff-context">${escapedLine}</div>`);
        }
    }

    html += `
        <div class="diff-content-row">
            <div class="diff-column">
                ${leftContent.join('')}
            </div>
            <div class="diff-column">
                ${rightContent.join('')}
            </div>
        </div>
    `;

    html += '</div>';
    return html;
}

// ============================================================
// EXPORT FUNCTIONALITY
// ============================================================
function exportMigrationResults() {
    if (!window.migrationResults || window.migrationResults.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    const csvRows = [];

    csvRows.push(['SHA', 'Date', 'Auteur', 'Message', 'Branche', 'Fichier', 'Status', 'Additions', 'Deletions'].join(';'));

    window.migrationResults.forEach(result => {
        const row = [
            result.commit.sha.substring(0, 7),
            result.commit.date || '',
            (result.commit.author || '').replace(/;/g, ','),
            result.commit.message.split('\n')[0].replace(/;/g, ',').replace(/"/g, '""'),
            result.commit.branch || '',
            result.file.filename.replace(/;/g, ','),
            result.file.status || '',
            result.file.additions || 0,
            result.file.deletions || 0
        ];
        csvRows.push(row.join(';'));
    });

    downloadCSV(csvRows.join('\n'), 'migration_results.csv');
}

function exportModuleAnalytics() {
    if (!window.moduleAnalyticsData || window.moduleAnalyticsData.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    const csvRows = [];

    csvRows.push(['Module', 'Commits', 'Contributeurs', 'Additions', 'Deletions', 'Dernière Modification'].join(';'));

    window.moduleAnalyticsData.forEach(module => {
        const row = [
            module.module.replace(/;/g, ','),
            module.commits,
            module.contributors,
            module.additions,
            module.deletions,
            module.last_modified || ''
        ];
        csvRows.push(row.join(';'));
    });

    downloadCSV(csvRows.join('\n'), 'module_analytics.csv');
}

function exportDetectedChanges() {
    if (!window.detectedChangesData || window.detectedChangesData.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    const csvRows = [];

    csvRows.push(['Type', 'SHA', 'Date', 'Auteur', 'Message', 'Fichier'].join(';'));

    window.detectedChangesData.forEach(change => {
        const row = [
            change.type,
            change.commit_sha,
            change.date,
            change.author.replace(/;/g, ','),
            change.commit_message.replace(/;/g, ',').replace(/"/g, '""'),
            change.filename.replace(/;/g, ',')
        ];
        csvRows.push(row.join(';'));
    });

    downloadCSV(csvRows.join('\n'), 'detected_changes.csv');
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ============================================================
// ANALYTICS TAB
// ============================================================
function setupAnalyticsListeners() {
    // Timeline
    document.getElementById('timelineRepo').addEventListener('change', onTimelineRepoChange);
    document.getElementById('timelineBranch').addEventListener('change', loadTimelineGraph);
    document.getElementById('timelineRange').addEventListener('change', loadTimelineGraph);

    // Module Analytics
    document.getElementById('moduleAnalyticsBranch').addEventListener('change', loadModuleAnalytics);

    // Detected Changes
    document.getElementById('detectedChangesBranch').addEventListener('change', loadDetectedChanges);
    document.getElementById('detectedChangesType').addEventListener('change', loadDetectedChanges);

    // Populate timeline repo select and branches
    loadRepositories().then(() => {
        const timelineSelect = document.getElementById('timelineRepo');
        const repoSelect = document.getElementById('repoSelect');
        timelineSelect.innerHTML = repoSelect.innerHTML;
    });

    loadMigrationVersions().then(() => {
        const moduleAnalyticsBranch = document.getElementById('moduleAnalyticsBranch');
        const detectedChangesBranch = document.getElementById('detectedChangesBranch');
        const fromVersionSelect = document.getElementById('migrationFromVersion');

        if (fromVersionSelect && moduleAnalyticsBranch) {
            moduleAnalyticsBranch.innerHTML = fromVersionSelect.innerHTML;
        }
        if (fromVersionSelect && detectedChangesBranch) {
            detectedChangesBranch.innerHTML = fromVersionSelect.innerHTML;
        }
    });
}

async function onTimelineRepoChange() {
    const repoId = document.getElementById('timelineRepo').value;
    const branchSelect = document.getElementById('timelineBranch');

    if (!repoId) {
        branchSelect.disabled = true;
        branchSelect.innerHTML = '<option value="">Sélectionner une branche...</option>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/repositories/${repoId}/branches`);
        const branches = await response.json();

        branchSelect.innerHTML = '<option value="">Sélectionner une branche...</option>' +
            branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        branchSelect.disabled = false;
    } catch (error) {
        console.error('Erreur lors du chargement des branches:', error);
    }
}

async function loadTimelineGraph() {
    const branchId = document.getElementById('timelineBranch').value;
    const days = document.getElementById('timelineRange').value;
    const graphDiv = document.getElementById('timelineGraph');

    if (!branchId) {
        graphDiv.innerHTML = '<p class="info-text">Sélectionnez un dépôt et une branche</p>';
        return;
    }

    graphDiv.innerHTML = '<p class="loading">Chargement...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/analytics/timeline?branch_id=${branchId}&days=${days}`);
        const data = await response.json();

        displayTimelineGraph(data);
    } catch (error) {
        console.error('Erreur lors du chargement du timeline:', error);
        graphDiv.innerHTML = '<p class="info-text">Erreur lors du chargement</p>';
    }
}

function displayTimelineGraph(data) {
    const graphDiv = document.getElementById('timelineGraph');

    if (!data.timeline || data.timeline.length === 0) {
        graphDiv.innerHTML = '<p class="info-text">Aucune donnée disponible pour cette période</p>';
        return;
    }

    // Trouver la valeur max pour normaliser les barres
    const maxCommits = Math.max(...data.timeline.map(d => d.commit_count));

    const totalCommits = data.timeline.reduce((sum, d) => sum + d.commit_count, 0);
    const totalAdditions = data.timeline.reduce((sum, d) => sum + d.total_additions, 0);
    const totalDeletions = data.timeline.reduce((sum, d) => sum + d.total_deletions, 0);

    const html = `
        <div style="background: var(--white); border: 1px solid var(--gray-200); margin-bottom: 20px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--gray-100); border-bottom: 2px solid var(--black);">
                        <th style="padding: 12px 15px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Date</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Commits</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Ajouts</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Suppressions</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Auteurs</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.timeline.reverse().map((day, index) => {
                        const dateObj = new Date(day.date);
                        const dateLabel = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
                        const bgColor = index % 2 === 0 ? 'var(--white)' : 'var(--gray-50)';

                        return `
                            <tr style="background: ${bgColor}; border-bottom: 1px solid var(--gray-200); transition: background 0.2s;">
                                <td style="padding: 12px 15px; font-weight: 500;">${dateLabel}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: var(--black);">${day.commit_count}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: var(--green);">+${day.total_additions.toLocaleString()}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: var(--red);">-${day.total_deletions.toLocaleString()}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600;">${day.author_count}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr style="background: var(--black); color: var(--white); font-weight: 700;">
                        <td style="padding: 15px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">TOTAL</td>
                        <td style="padding: 15px; text-align: center; font-size: 1.1rem;">${totalCommits}</td>
                        <td style="padding: 15px; text-align: center; font-size: 1.1rem; color: var(--green);">+${totalAdditions.toLocaleString()}</td>
                        <td style="padding: 15px; text-align: center; font-size: 1.1rem; color: var(--red);">-${totalDeletions.toLocaleString()}</td>
                        <td style="padding: 15px; text-align: center;"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    graphDiv.innerHTML = html;
}

async function loadModuleAnalytics() {
    const branch = document.getElementById('moduleAnalyticsBranch').value;
    const analyticsDiv = document.getElementById('moduleAnalytics');

    if (!branch) {
        analyticsDiv.innerHTML = '<p class="info-text">Sélectionnez une branche</p>';
        return;
    }

    analyticsDiv.innerHTML = '<p class="loading">Chargement...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/analytics/modules?branch_name=${branch}`);
        const data = await response.json();

        console.log('Analytics response:', data);
        console.log('Modules count:', data.modules ? data.modules.length : 0);

        displayModuleAnalytics(data);
    } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
        analyticsDiv.innerHTML = '<p class="info-text">Erreur lors du chargement</p>';
    }
}

function displayModuleAnalytics(data) {
    const analyticsDiv = document.getElementById('moduleAnalytics');

    if (!data.modules || data.modules.length === 0) {
        analyticsDiv.innerHTML = '<p class="info-text">Aucun module trouvé</p>';
        return;
    }

    // Stocker les données pour l'export
    window.moduleAnalyticsData = data.modules;

    const exportBtn = `
        <div style="text-align: right; margin-bottom: 15px;">
            <button onclick="exportModuleAnalytics()" class="btn-secondary" style="font-size: 0.9rem;">
                Exporter CSV
            </button>
        </div>
    `;

    const html = `
        <div style="background: var(--white); border: 1px solid var(--gray-200); overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--gray-100); border-bottom: 2px solid var(--black);">
                        <th style="padding: 12px 15px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Module</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Commits</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Contributeurs</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Ajouts</th>
                        <th style="padding: 12px 15px; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.85rem;">Suppressions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.modules.map((module, index) => {
                        const bgColor = index % 2 === 0 ? 'var(--white)' : 'var(--gray-50)';
                        return `
                            <tr style="background: ${bgColor}; border-bottom: 1px solid var(--gray-200);" onmouseover="this.style.background='var(--gray-100)'" onmouseout="this.style.background='${bgColor}'">
                                <td style="padding: 12px 15px; font-weight: 600; font-family: 'Courier New', monospace; font-size: 0.9rem;">${module.module}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600;">${module.commits}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600;">${module.contributors}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: var(--green);">+${module.additions.toLocaleString()}</td>
                                <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: var(--red);">-${module.deletions.toLocaleString()}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    analyticsDiv.innerHTML = exportBtn + html;
}

async function loadDetectedChanges() {
    const branch = document.getElementById('detectedChangesBranch').value;
    const changeType = document.getElementById('detectedChangesType').value;
    const changesDiv = document.getElementById('detectedChanges');

    if (!branch) {
        changesDiv.innerHTML = '<p class="info-text">Sélectionnez une branche</p>';
        return;
    }

    changesDiv.innerHTML = '<p class="loading">Chargement...</p>';

    try {
        let url = `${API_BASE_URL}/analytics/detected-changes?branch_name=${branch}`;
        if (changeType) url += `&change_type=${changeType}`;

        const response = await fetch(url);
        const data = await response.json();

        displayDetectedChanges(data);
    } catch (error) {
        console.error('Erreur lors du chargement des changements:', error);
        changesDiv.innerHTML = '<p class="info-text">Erreur lors du chargement</p>';
    }
}

function displayDetectedChanges(data) {
    const changesDiv = document.getElementById('detectedChanges');

    if (!data.changes || data.changes.length === 0) {
        changesDiv.innerHTML = '<p class="info-text">Aucun changement détecté</p>';
        return;
    }

    // Stocker les données pour l'export
    window.detectedChangesData = data.changes;

    const exportBtn = `
        <div style="text-align: right; margin-bottom: 15px;">
            <button onclick="exportDetectedChanges()" class="btn-secondary" style="font-size: 0.9rem;">
                Exporter CSV
            </button>
        </div>
    `;

    const html = data.changes.map(change => `
        <div class="detected-change-item type-${change.type}">
            <div class="detected-change-header">
                <div>
                    <span class="detected-change-type ${change.type}">${change.type.replace('_', ' ')}</span>
                </div>
                <div style="text-align: right; font-size: 0.85rem; color: var(--text-secondary);">
                    <div>${change.author}</div>
                    <div>${formatDate(change.date)}</div>
                </div>
            </div>
            <div style="margin-top: 10px;">
                <strong>${change.filename}</strong>
            </div>
            <div style="margin-top: 8px; color: var(--text-secondary); font-size: 0.9rem;">
                <span class="commit-sha">${change.commit_sha}</span>
                ${escapeHtml(change.commit_message)}
            </div>
            ${change.old_value || change.new_value ? `
                <div class="detected-change-details">
                    ${change.old_value ? `<div class="detected-change-old">${escapeHtml(change.old_value)}</div>` : ''}
                    ${change.new_value ? `<div class="detected-change-new">${escapeHtml(change.new_value)}</div>` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');

    changesDiv.innerHTML = exportBtn + html;
}

// Initialiser les listeners pour Analytics quand le document est prêt
document.addEventListener('DOMContentLoaded', () => {
    setupAnalyticsListeners();
});

// ============================================================
// RACCOURCIS CLAVIER
// ============================================================
function initKeyboardShortcuts() {
    let currentResultIndex = -1;
    const results = [];

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            if (e.key !== 'Escape') return;
        }

        // Ctrl/Cmd + K: Focus sur la recherche
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'migration') {
                const searchInput = document.getElementById('migrationSearch');
                searchInput?.focus();
                searchInput?.select();
            } else if (activeTab && activeTab.id === 'commits') {
                const searchInput = document.getElementById('searchInput');
                searchInput?.focus();
                searchInput?.select();
            }
        }

        // Ctrl/Cmd + E: Export
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            if (window.migrationResults && window.migrationResults.length > 0) {
                exportMigrationResults();
                showNotification('Export CSV en cours...', 'info');
            }
        }

        // Escape: Fermer les modals/diffs
        if (e.key === 'Escape') {
            const modal = document.getElementById('commitModal');
            if (modal?.classList.contains('active')) {
                closeModal();
                return;
            }
            const openDiffs = document.querySelectorAll('.diff-viewer[style*="display: block"]');
            openDiffs.forEach(diff => diff.style.display = 'none');
        }

        // Ctrl/Cmd + H: Afficher l'historique de recherche
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            e.preventDefault();
            showSearchHistory();
        }

        // Ctrl/Cmd + B: Afficher les favoris
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            showFavorites();
        }

        // Navigation J/K dans les résultats (comme Vim)
        if (e.key === 'j' || e.key === 'k') {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab?.id === 'migration') {
                const resultCards = document.querySelectorAll('.migration-results-list > div');
                if (resultCards.length === 0) return;

                e.preventDefault();

                if (e.key === 'j') {
                    currentResultIndex = Math.min(currentResultIndex + 1, resultCards.length - 1);
                } else {
                    currentResultIndex = Math.max(currentResultIndex - 1, 0);
                }

                resultCards.forEach((card, i) => {
                    if (i === currentResultIndex) {
                        card.style.outline = '3px solid var(--black)';
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        card.style.outline = 'none';
                    }
                });
            }
        }

        // Entrée pour ouvrir le diff du résultat sélectionné
        if (e.key === 'Enter' && currentResultIndex >= 0) {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab?.id === 'migration') {
                e.preventDefault();
                showMigrationDiff(currentResultIndex);
            }
        }

        // Ctrl/Cmd + / : Afficher les raccourcis
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            showKeyboardShortcuts();
        }

        // Chiffres 1-6 : Changer d'onglet
        if (e.key >= '1' && e.key <= '6' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const tabs = ['dashboard', 'commits', 'migration', 'compare', 'analytics', 'admin'];
            const index = parseInt(e.key) - 1;
            if (tabs[index]) {
                document.querySelector(`[data-tab="${tabs[index]}"]`)?.click();
            }
        }
    });

    console.log(`
🎹 Raccourcis clavier disponibles:
  • Ctrl/Cmd + K : Focus recherche
  • Ctrl/Cmd + E : Export CSV
  • Ctrl/Cmd + H : Historique
  • Ctrl/Cmd + B : Favoris
  • Ctrl/Cmd + 1-6 : Changer d'onglet
  • Ctrl/Cmd + / : Afficher les raccourcis
  • J/K : Naviguer dans les résultats (Vim style)
  • Entrée : Ouvrir le diff sélectionné
  • Escape : Fermer
    `);
}

function showKeyboardShortcuts() {
    const modal = document.getElementById('commitModal');
    const details = document.getElementById('commitDetails');

    details.innerHTML = `
        <div style="padding: 20px;">
            <h2 style="margin-bottom: 20px;">⌨️ Raccourcis clavier</h2>
            <div style="display: grid; gap: 15px;">
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--black);">
                    <strong>Ctrl/Cmd + K</strong> : Focus sur la recherche
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--black);">
                    <strong>Ctrl/Cmd + E</strong> : Exporter en CSV
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--black);">
                    <strong>Ctrl/Cmd + H</strong> : Afficher l'historique
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--black);">
                    <strong>Ctrl/Cmd + B</strong> : Afficher les favoris
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--black);">
                    <strong>Ctrl/Cmd + 1-6</strong> : Changer d'onglet
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--black);">
                    <strong>Ctrl/Cmd + /</strong> : Afficher cette aide
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--green);">
                    <strong>J / K</strong> : Naviguer dans les résultats (style Vim)
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--green);">
                    <strong>Entrée</strong> : Ouvrir le diff du résultat sélectionné
                </div>
                <div style="padding: 15px; background: var(--gray-50); border-left: 4px solid var(--red);">
                    <strong>Escape</strong> : Fermer les modals et diffs
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// ============================================================
// HISTORIQUE DE RECHERCHE
// ============================================================
function addToSearchHistory(searchTerm, fromVersion, toVersion) {
    const entry = {
        term: searchTerm,
        fromVersion,
        toVersion,
        timestamp: new Date().toISOString()
    };

    // Éviter les doublons
    state.searchHistory = state.searchHistory.filter(
        h => !(h.term === searchTerm && h.fromVersion === fromVersion && h.toVersion === toVersion)
    );

    state.searchHistory.unshift(entry);
    state.searchHistory = state.searchHistory.slice(0, 20); // Garder 20 max

    localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory));
}

function showSearchHistory() {
    if (state.searchHistory.length === 0) {
        showNotification('Aucun historique de recherche', 'info');
        return;
    }

    const modal = document.getElementById('commitModal');
    const details = document.getElementById('commitDetails');

    details.innerHTML = `
        <h2>Historique de recherche</h2>
        <div style="max-height: 500px; overflow-y: auto;">
            ${state.searchHistory.map((entry, index) => `
                <div class="history-item" onclick="replaySearch(${index})">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: var(--primary-color); font-size: 1.1rem;">${escapeHtml(entry.term)}</strong>
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 5px;">
                                ${entry.fromVersion} → ${entry.toVersion}
                            </div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${formatDate(entry.timestamp)}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <button onclick="clearSearchHistory()" class="btn-secondary" style="margin-top: 20px;">
            Effacer l'historique
        </button>
    `;

    modal.style.display = 'block';
}

function replaySearch(index) {
    const entry = state.searchHistory[index];

    // Aller dans l'onglet Migration
    document.querySelector('[data-tab="migration"]').click();

    // Remplir les champs
    document.getElementById('migrationSearch').value = entry.term;
    document.getElementById('migrationFromVersion').value = entry.fromVersion;
    document.getElementById('migrationToVersion').value = entry.toVersion;

    // Fermer le modal
    closeModal();

    // Lancer la recherche
    setTimeout(() => searchMigrationChanges(), 300);
}

function clearSearchHistory() {
    state.searchHistory = [];
    localStorage.removeItem('searchHistory');
    closeModal();
    showNotification('Historique effacé', 'success');
}

// ============================================================
// FAVORIS / BOOKMARKS
// ============================================================
function addToFavorites(commitId, commitData) {
    const favorite = {
        id: commitId,
        sha: commitData.sha,
        message: commitData.message,
        author: commitData.author,
        date: commitData.date,
        timestamp: new Date().toISOString()
    };

    // Éviter les doublons
    state.favorites = state.favorites.filter(f => f.id !== commitId);
    state.favorites.unshift(favorite);

    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    showNotification('Ajouté aux favoris', 'success');
}

function showFavorites() {
    if (state.favorites.length === 0) {
        showNotification('Aucun favori enregistré', 'info');
        return;
    }

    const modal = document.getElementById('commitModal');
    const details = document.getElementById('commitDetails');

    details.innerHTML = `
        <h2>Favoris</h2>
        <div style="max-height: 500px; overflow-y: auto;">
            ${state.favorites.map((fav, index) => `
                <div class="favorite-item">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <span class="commit-sha">${fav.sha.substring(0, 7)}</span>
                                <strong style="color: var(--text-primary);">${escapeHtml(fav.message.split('\n')[0])}</strong>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">
                                ${fav.author} • ${formatDate(fav.date)}
                            </div>
                        </div>
                        <button onclick="removeFavorite(${index})" class="btn-copy" style="background: var(--danger-color); border-color: var(--danger-color);">
                            ✕
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    modal.style.display = 'block';
}

function removeFavorite(index) {
    state.favorites.splice(index, 1);
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    showFavorites(); // Rafraîchir
    showNotification('Retiré des favoris', 'success');
}

// ============================================================
// SUGGESTIONS INTELLIGENTES
// ============================================================
function initSmartSuggestions() {
    const searchInput = document.getElementById('migrationSearch');
    if (!searchInput) return;

    // Créer le conteneur de suggestions
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.id = 'smartSuggestions';
    suggestionsDiv.className = 'smart-suggestions';
    searchInput.parentNode.insertBefore(suggestionsDiv, searchInput.nextSibling);

    searchInput.addEventListener('input', debounce(showSuggestions, 300));
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) showSuggestions();
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

function showSuggestions() {
    const searchInput = document.getElementById('migrationSearch');
    const suggestionsDiv = document.getElementById('smartSuggestions');
    const term = searchInput.value.trim();

    if (term.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    // Suggestions basées sur les recherches populaires Odoo
    const commonOdooFields = [
        'invoice_id', 'move_id', 'partner_id', 'product_id',
        'sale_order_id', 'purchase_order_id', 'account_id',
        'company_id', 'user_id', 'state', 'date', 'amount_total',
        'tax_ids', 'line_ids', 'payment_state', 'currency_id'
    ];

    const commonMethods = [
        'def _compute_', 'def _onchange_', 'def action_',
        'def create', 'def write', 'def unlink',
        '@api.depends', '@api.onchange', '@api.model'
    ];

    const suggestions = [
        ...commonOdooFields.filter(f => f.toLowerCase().includes(term.toLowerCase())),
        ...commonMethods.filter(m => m.toLowerCase().includes(term.toLowerCase())),
        ...state.searchHistory.map(h => h.term).filter(t => t.toLowerCase().includes(term.toLowerCase()))
    ].slice(0, 8);

    if (suggestions.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    suggestionsDiv.innerHTML = suggestions.map(s => `
        <div class="suggestion-item" onclick="applySuggestion('${escapeHtml(s)}')">
            ${highlightTerm(s, term)}
        </div>
    `).join('');

    suggestionsDiv.style.display = 'block';
}

function applySuggestion(suggestion) {
    document.getElementById('migrationSearch').value = suggestion;
    document.getElementById('smartSuggestions').style.display = 'none';
    searchMigrationChanges();
}

function highlightTerm(text, term) {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    return escapeHtml(text).replace(regex, '<strong style="color: var(--primary-color);">$1</strong>');
}

// Initialiser les suggestions
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initSmartSuggestions, 500);
});

// ============================================================
// ADMIN PANEL - FETCH MANAGEMENT
// ============================================================
let pollingInterval = null;
let logPosition = 0;

async function triggerFetch(mode) {
    try {
        const incrementalBtn = document.getElementById('incrementalBtn');
        const fullBtn = document.getElementById('fullBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        incrementalBtn.disabled = true;
        fullBtn.disabled = true;

        const repoSelect = document.getElementById('adminRepoSelect');
        const branchSelect = document.getElementById('adminBranchSelect');

        const selectedRepos = Array.from(repoSelect.selectedOptions).map(opt => opt.value);
        const selectedBranches = Array.from(branchSelect.selectedOptions).map(opt => opt.value);

        if (selectedRepos.length === 0 || selectedBranches.length === 0) {
            showNotification('Veuillez sélectionner au moins un dépôt et une branche', 'error');
            incrementalBtn.disabled = false;
            fullBtn.disabled = false;
            return;
        }

        showNotification(`Lancement de la synchronisation ${mode}...`, 'info');
        addTerminalLine(`$ Démarrage de la synchronisation ${mode}...`, 'prompt');
        addTerminalLine(`$ Dépôts: ${selectedRepos.join(', ')}`, 'info');
        addTerminalLine(`$ Branches: ${selectedBranches.join(', ')}`, 'info');

        const response = await fetch(`${API_BASE_URL}/admin/fetch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: mode,
                repositories: selectedRepos,
                branches: selectedBranches
            })
        });

        const data = await response.json();

        if (data.status === 'already_running') {
            showNotification(data.message, 'warning');
            addTerminalLine(data.message, 'warning');
            incrementalBtn.disabled = false;
            fullBtn.disabled = false;
            cancelBtn.style.display = 'inline-block';
            return;
        }

        if (response.ok && data.status === 'started') {
            showSyncIndicator();
            showNotification('Synchronisation démarrée', 'success');
            addTerminalLine(`✅ Synchronisation démarrée (PID: ${data.pid})`, 'success');

            cancelBtn.style.display = 'inline-block';
            startStreamingLogs();

        } else {
            showNotification('Erreur lors du démarrage', 'error');
            addTerminalLine('❌ Erreur lors du démarrage de la synchronisation', 'error');
            incrementalBtn.disabled = false;
            fullBtn.disabled = false;
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur de connexion à l\'API', 'error');
        addTerminalLine(`❌ Erreur: ${error.message}`, 'error');
        document.getElementById('incrementalBtn').disabled = false;
        document.getElementById('fullBtn').disabled = false;
    }
}

function showSyncIndicator() {
    let indicator = document.getElementById('syncIndicatorGlobal');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'syncIndicatorGlobal';
        indicator.className = 'sync-indicator';
        indicator.innerHTML = '<div class="spinner-small"></div><span>Synchronisation en cours...</span>';
        document.body.appendChild(indicator);
    }
}

function hideSyncIndicator() {
    const indicator = document.getElementById('syncIndicatorGlobal');
    if (indicator) {
        indicator.remove();
    }
}

let pollingErrorCount = 0;

function startStreamingLogs() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    logPosition = 0;
    pollingErrorCount = 0;

    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/fetch-logs?last_position=${logPosition}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            pollingErrorCount = 0;

            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    addTerminalLine(log.message, log.type);
                });
                logPosition = data.position;
            }

            if (data.completed) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                hideSyncIndicator();
                const incrementalBtn = document.getElementById('incrementalBtn');
                const fullBtn = document.getElementById('fullBtn');
                const cancelBtn = document.getElementById('cancelBtn');
                if (incrementalBtn) incrementalBtn.disabled = false;
                if (fullBtn) fullBtn.disabled = false;
                if (cancelBtn) cancelBtn.style.display = 'none';
                showNotification('Synchronisation terminée', 'success');
                addTerminalLine('', 'info');
                addTerminalLine('✅ Synchronisation terminée', 'success');
                loadFetchStatus();
            }
        } catch (error) {
            console.error('Erreur polling logs:', error);
            pollingErrorCount++;

            if (pollingErrorCount >= 5) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                hideSyncIndicator();
                addTerminalLine('❌ Erreur répétée lors de la récupération des logs', 'error');
                addTerminalLine('ℹ️  La synchronisation continue en arrière-plan', 'info');
                const incrementalBtn = document.getElementById('incrementalBtn');
                const fullBtn = document.getElementById('fullBtn');
                const cancelBtn = document.getElementById('cancelBtn');
                if (incrementalBtn) incrementalBtn.disabled = false;
                if (fullBtn) fullBtn.disabled = false;
                if (cancelBtn) cancelBtn.style.display = 'none';
            }
        }
    }, 500);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    hideSyncIndicator();
    const incrementalBtn = document.getElementById('incrementalBtn');
    const fullBtn = document.getElementById('fullBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    if (incrementalBtn) incrementalBtn.disabled = false;
    if (fullBtn) fullBtn.disabled = false;
    if (cancelBtn) cancelBtn.style.display = 'none';
}

async function cancelSync() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/cancel-fetch`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            stopPolling();
            showNotification('Synchronisation annulée', 'info');
            addTerminalLine('⚠️  Synchronisation annulée par l\'utilisateur', 'warning');
        } else {
            showNotification('Impossible d\'annuler la synchronisation', 'error');
            addTerminalLine(`❌ Erreur: ${data.detail || 'Erreur inconnue'}`, 'error');
        }
    } catch (error) {
        console.error('Erreur lors de l\'annulation:', error);
        showNotification('Erreur lors de l\'annulation', 'error');
        addTerminalLine(`❌ Erreur: ${error.message}`, 'error');
    }
}

function addTerminalLine(message, type = 'info') {
    const terminalBody = document.getElementById('terminalBody');
    if (!terminalBody) return;

    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = message;

    terminalBody.appendChild(line);
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

function clearTerminal() {
    const terminalBody = document.getElementById('terminalBody');
    if (terminalBody) {
        terminalBody.innerHTML = '<div class="terminal-line">$ Terminal effacé</div>';
    }
}

async function loadAdminReposAndBranches() {
    try {
        const reposResponse = await fetch(`${API_BASE_URL}/repositories`);
        const repos = await reposResponse.json();

        const repoSelect = document.getElementById('adminRepoSelect');
        if (repoSelect && repos.length > 0) {
            repoSelect.innerHTML = repos.map(repo =>
                `<option value="${repo.full_name}" selected>${repo.full_name}</option>`
            ).join('');
        }

        const allBranches = new Set();
        for (const repo of repos) {
            const branchesResponse = await fetch(`${API_BASE_URL}/repositories/${repo.id}/branches`);
            const branches = await branchesResponse.json();
            branches.forEach(branch => allBranches.add(branch.name));
        }

        const branchSelect = document.getElementById('adminBranchSelect');
        if (branchSelect && allBranches.size > 0) {
            const sortedBranches = Array.from(allBranches).sort((a, b) => {
                const aNum = parseFloat(a);
                const bNum = parseFloat(b);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                if (a === 'master') return 1;
                if (b === 'master') return -1;
                return a.localeCompare(b);
            });

            branchSelect.innerHTML = sortedBranches.map(branch =>
                `<option value="${branch}" selected>${branch}</option>`
            ).join('');
        }

        console.log(`✅ Chargé ${repos.length} repos et ${allBranches.size} branches pour Admin`);
    } catch (error) {
        console.error('Erreur chargement repos/branches Admin:', error);
    }
}

async function checkSyncStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/fetch-running`);
        const data = await response.json();

        if (data.running) {
            showSyncIndicator();
            const terminalBody = document.getElementById('terminalBody');
            if (terminalBody) {
                addTerminalLine('⚠️  Une synchronisation est en cours (détectée au chargement)', 'warning');
                startStreamingLogs();
            }
        }
    } catch (error) {
        console.error('Erreur vérification sync:', error);
    }
}

async function loadFetchStatus() {
    const historyDiv = document.getElementById('fetchHistory');

    if (!historyDiv) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/fetch-status`);
        const data = await response.json();
        if (data.logs && data.logs.length > 0) {
            historyDiv.innerHTML = `
                <div class="history-list">
                    ${data.logs.map(log => `
                        <div class="history-item">
                            <div class="history-item-header">
                                <span class="history-item-status" style="color: ${log.status === 'success' ? 'var(--green)' : log.status === 'failed' ? 'var(--red)' : 'var(--gray-600)'}; font-weight: 700;">
                                    ${log.status === 'success' ? '✅' : log.status === 'failed' ? '❌' : '⏳'} ${log.status.toUpperCase()}
                                </span>
                                <span class="history-item-time">${formatDate(log.started_at)}</span>
                            </div>
                            <div class="history-item-details">
                                ${log.branch_name || 'Toutes les branches'} •
                                <strong>${log.commits_imported || 0}</strong> commits importés
                                ${log.duration ? ` • Durée: ${Math.round(log.duration)}s` : ''}
                                ${log.error_message ? `<br><span style="color: var(--red);">Erreur: ${escapeHtml(log.error_message)}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            historyDiv.innerHTML = '<p class="info-text">Aucun historique disponible</p>';
        }
    } catch (error) {
        console.error('Erreur lors du chargement du statut:', error);
        historyDiv.innerHTML = '<p class="info-text">Erreur lors du chargement du statut</p>';
    }
}

function stopFetchInterval() {
    if (window.fetchStatusInterval) {
        clearInterval(window.fetchStatusInterval);
        window.fetchStatusInterval = null;
        const stopBtn = document.getElementById('stopIntervalBtn');
        if (stopBtn) stopBtn.style.display = 'none';
        showNotification('Suivi automatique arrêté', 'info');
    }
}
