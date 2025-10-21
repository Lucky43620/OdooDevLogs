// Configuration de l'API
const API_BASE_URL = 'http://localhost:8000';

// État de l'application
let state = {
    currentPage: 0,
    currentBranch: null,
    repositories: [],
    branches: []
};

// ============================================================
// INITIALISATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadDashboard();
    loadRepositories();
    loadCommitTypes();
    loadModules();
    setupEventListeners();
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

    // Modal
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('commitModal');
        if (e.target === modal) {
            closeModal();
        }
    });
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
    const offset = state.currentPage * 100;

    const container = document.getElementById('commitsList');
    container.innerHTML = '<p class="loading">Chargement des commits</p>';

    try {
        let url = `${API_BASE_URL}/branches/${branchId}/commits?limit=100&offset=${offset}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (author) url += `&author=${encodeURIComponent(author)}`;
        if (commitType) url += `&search=${encodeURIComponent('[' + commitType + ']')}`;

        const response = await fetch(url);
        const commits = await response.json();

        if (commits.length === 0) {
            container.innerHTML = '<p class="info-text">Aucun commit trouvé</p>';
            return;
        }

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
    modal.classList.add('show');

    try {
        const response = await fetch(`${API_BASE_URL}/commits/${commitId}`);
        const commit = await response.json();

        details.innerHTML = `
            <h2>Détails du commit</h2>
            <div style="margin: 20px 0;">
                <div style="margin-bottom: 10px;">
                    <strong>SHA:</strong> <span class="commit-sha">${commit.sha}</span>
                    <a href="${commit.html_url}" target="_blank" style="margin-left: 10px; color: var(--primary-color);">
                        Voir sur GitHub →
                    </a>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Auteur:</strong> ${commit.author_name} (${commit.author_email})
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Date:</strong> ${formatDate(commit.committed_date)}
                </div>
                <div style="margin-bottom: 20px;">
                    <strong>Message:</strong><br>
                    <pre style="background: var(--card-bg); padding: 15px; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(commit.message)}</pre>
                </div>
                <div style="margin-bottom: 20px;">
                    <strong>Statistiques:</strong><br>
                    <span class="stat-add">➕ ${commit.additions} ajouts</span>
                    <span class="stat-del" style="margin-left: 15px;">➖ ${commit.deletions} suppressions</span>
                    <span style="margin-left: 15px;">📝 ${commit.total_changes} changements</span>
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
    document.getElementById('commitModal').classList.remove('show');
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
                        <div class="commit-item" style="margin-bottom: 10px;">
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
                        <div class="commit-item" style="margin-bottom: 10px;">
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

async function loadModules() {
    try {
        const response = await fetch(`${API_BASE_URL}/modules`);
        const modules = await response.json();

        const moduleSelect = document.getElementById('migrationModule');
        moduleSelect.innerHTML = '<option value="">Tous les modules...</option>' +
            modules.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
    }
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

    resultsDiv.innerHTML = '<p class="loading">Recherche en cours</p>';

    try {
        let url = `${API_BASE_URL}/search/migration?term=${encodeURIComponent(searchTerm)}&from_version=${fromVersion}&to_version=${toVersion}`;
        if (module) url += `&module=${module}`;
        if (commitType) url += `&commit_type=${commitType}`;
        if (useRegex) url += `&use_regex=true`;

        const response = await fetch(url);
        const data = await response.json();

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

    resultsDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>${data.count} résultat(s) trouvé(s)</h3>
            <div style="display: flex; gap: 15px; align-items: center;">
                <button onclick="exportMigrationResults()" class="btn-secondary" style="font-size: 0.9rem;">
                    Exporter CSV
                </button>
                <span style="color: var(--text-secondary);">${data.from_version} → ${data.to_version}</span>
            </div>
        </div>
        <div class="migration-results-list">
            ${data.results.map((result, index) => {
                const detectedChange = analyzeChange(result.file.patch, searchTerm);
                return `
                <div class="migration-result-item">
                    <div class="migration-result-header">
                        <div>
                            <strong>${result.file.filename}</strong>
                            <span class="file-status status-${result.file.status}">${result.file.status}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${result.commit.branch}
                        </div>
                    </div>
                    <div class="migration-result-commit">
                        <span class="commit-sha">${result.commit.sha.substring(0, 7)}</span>
                        ${escapeHtml(result.commit.message.split('\n')[0])}
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 10px; font-size: 0.85rem; color: var(--text-secondary);">
                        <span>👤 ${result.commit.author || 'Unknown'}</span>
                        <span>📅 ${formatDate(result.commit.date)}</span>
                        <span class="stat-add">+${result.file.additions}</span>
                        <span class="stat-del">-${result.file.deletions}</span>
                    </div>

                    ${detectedChange ? `
                        <div class="detected-change-summary">
                            <strong>Changement détecté:</strong>
                            <div class="change-comparison">
                                <div class="change-side">
                                    <div class="change-label">${data.from_version}</div>
                                    <div class="change-old">${escapeHtml(detectedChange.old)}</div>
                                </div>
                                <div class="change-arrow">→</div>
                                <div class="change-side">
                                    <div class="change-label">${data.to_version}</div>
                                    <div class="change-new">${escapeHtml(detectedChange.new)}</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <button onclick="showMigrationDiff(${index})" class="btn-secondary" style="margin-top: 10px;">
                        Voir le diff complet
                    </button>
                    <div class="diff-viewer" id="migration-diff-${index}">
                        ${highlightSearchTerm(renderDiffSideBySide(result.file.patch, data.from_version, data.to_version), searchTerm)}
                    </div>
                </div>
            `}).join('')}
        </div>
    `;

    // Stocker les résultats
    window.migrationResults = data.results;
}

function showMigrationDiff(index) {
    const diffViewer = document.getElementById(`migration-diff-${index}`);
    diffViewer.classList.toggle('show');
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

    // En-têtes
    csvRows.push(['SHA', 'Date', 'Auteur', 'Message', 'Branche', 'Fichier', 'Status', 'Additions', 'Deletions'].join(','));

    // Données
    window.migrationResults.forEach(result => {
        const row = [
            result.commit.sha.substring(0, 7),
            result.commit.date,
            `"${(result.commit.author || '').replace(/"/g, '""')}"`,
            `"${result.commit.message.split('\n')[0].replace(/"/g, '""')}"`,
            result.commit.branch,
            `"${result.file.filename.replace(/"/g, '""')}"`,
            result.file.status,
            result.file.additions,
            result.file.deletions
        ];
        csvRows.push(row.join(','));
    });

    downloadCSV(csvRows.join('\n'), 'migration_results.csv');
}

function exportModuleAnalytics() {
    if (!window.moduleAnalyticsData || window.moduleAnalyticsData.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    const csvRows = [];

    // En-têtes
    csvRows.push(['Module', 'Commits', 'Contributeurs', 'Additions', 'Deletions', 'Dernière Modification'].join(','));

    // Données
    window.moduleAnalyticsData.forEach(module => {
        const row = [
            `"${module.module}"`,
            module.commits,
            module.contributors,
            module.additions,
            module.deletions,
            module.last_modified || ''
        ];
        csvRows.push(row.join(','));
    });

    downloadCSV(csvRows.join('\n'), 'module_analytics.csv');
}

function exportDetectedChanges() {
    if (!window.detectedChangesData || window.detectedChangesData.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    const csvRows = [];

    // En-têtes
    csvRows.push(['Type', 'SHA', 'Date', 'Auteur', 'Message', 'Fichier'].join(','));

    // Données
    window.detectedChangesData.forEach(change => {
        const row = [
            change.type,
            change.commit_sha,
            change.date,
            `"${change.author.replace(/"/g, '""')}"`,
            `"${change.commit_message.replace(/"/g, '""')}"`,
            `"${change.filename.replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
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

    // Populate timeline repo select
    loadRepositories().then(() => {
        const timelineSelect = document.getElementById('timelineRepo');
        const repoSelect = document.getElementById('repoSelect');
        timelineSelect.innerHTML = repoSelect.innerHTML;
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

    const html = `
        <div style="margin-bottom: 20px;">
            <h4 style="color: var(--text-secondary);">Activité des ${data.days} derniers jours</h4>
        </div>
        <div class="timeline-bar">
            ${data.timeline.reverse().map(day => {
                const height = (day.commit_count / maxCommits) * 100;
                const dateObj = new Date(day.date);
                const dateLabel = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

                return `
                    <div class="timeline-column">
                        <div class="timeline-bar-item" style="height: ${height}%;" title="${day.commit_count} commits">
                            <span class="timeline-value">${day.commit_count} commits<br>+${day.total_additions} -${day.total_deletions}</span>
                        </div>
                        <small class="timeline-label">${dateLabel}</small>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div style="background: var(--darker-bg); padding: 15px; border-radius: 6px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">
                    ${data.timeline.reduce((sum, d) => sum + d.commit_count, 0)}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Commits</div>
            </div>
            <div style="background: var(--darker-bg); padding: 15px; border-radius: 6px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--success-color);">
                    +${data.timeline.reduce((sum, d) => sum + d.total_additions, 0).toLocaleString()}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">Lignes ajoutées</div>
            </div>
            <div style="background: var(--darker-bg); padding: 15px; border-radius: 6px; text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--danger-color);">
                    -${data.timeline.reduce((sum, d) => sum + d.total_deletions, 0).toLocaleString()}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">Lignes supprimées</div>
            </div>
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

    const html = data.modules.map(module => `
        <div class="module-card">
            <h4>${module.module}</h4>
            <div class="module-stat">
                <span class="module-stat-label">Commits</span>
                <span class="module-stat-value">${module.commits}</span>
            </div>
            <div class="module-stat">
                <span class="module-stat-label">Contributeurs</span>
                <span class="module-stat-value">${module.contributors}</span>
            </div>
            <div class="module-stat">
                <span class="module-stat-label">Lignes ajoutées</span>
                <span class="module-stat-value stat-add">+${module.additions.toLocaleString()}</span>
            </div>
            <div class="module-stat">
                <span class="module-stat-label">Lignes supprimées</span>
                <span class="module-stat-value stat-del">-${module.deletions.toLocaleString()}</span>
            </div>
            ${module.last_modified ? `
                <div class="module-stat">
                    <span class="module-stat-label">Dernière modif</span>
                    <span class="module-stat-value">${formatDate(module.last_modified)}</span>
                </div>
            ` : ''}
        </div>
    `).join('');

    analyticsDiv.innerHTML = exportBtn + '<div class="module-analytics">' + html + '</div>';
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
