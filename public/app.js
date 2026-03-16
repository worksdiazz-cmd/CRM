/* ==========================================
   GLOB CRM - Frontend Application
   ========================================== */

const API = '';  // Same origin

// ==========================================
// State
// ==========================================
let allLeads = [];
let allTransactions = [];
let allIssues = [];
let chartInstance = null;
let currentCustomerPage = 1;
let currentTxnPage = 1;
let currentIssuePage = 1;
const PER_PAGE = 8;

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupEventListeners();
    loadAllData();
});

// ==========================================
// Navigation
// ==========================================
const pageTitles = {
    dashboard: { title: 'Performance Overview', breadcrumb: 'Dashboard / Overview' },
    customers: { title: 'Customer Pipeline', breadcrumb: 'CRM / Customer List' },
    transactions: { title: 'Customer Existing', breadcrumb: 'CRM / Transactions' },
    issues: { title: 'Customer Issues', breadcrumb: 'CRM / Issue Tracking' },
    settings: { title: 'Settings', breadcrumb: 'System / Configuration' },
};

function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const target = document.getElementById(`page-${page}`);
            if (target) target.classList.add('active');
            if (pageTitles[page]) {
                document.getElementById('pageTitle').textContent = pageTitles[page].title;
                document.getElementById('pageBreadcrumb').textContent = pageTitles[page].breadcrumb;
            }
            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('visible');
        });
    });

    // Mobile menu
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('visible');
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('visible');
    });
}

function setupEventListeners() {
    // Lead form
    document.getElementById('leadForm').addEventListener('submit', handleLeadSubmit);

    // Search & filters
    document.getElementById('customerSearch')?.addEventListener('input', () => { currentCustomerPage = 1; renderLeads(); });
    document.getElementById('pipelineStatusFilter')?.addEventListener('change', () => { currentCustomerPage = 1; renderLeads(); });
    document.getElementById('transactionSearch')?.addEventListener('input', () => { currentTxnPage = 1; renderTransactions(); });
    document.getElementById('txnYearFilter')?.addEventListener('change', () => { currentTxnPage = 1; renderTransactions(); });
    document.getElementById('issueSearch')?.addEventListener('input', () => { currentIssuePage = 1; renderIssues(); });

    // Load config status on settings page
    checkConfigStatus();
}

// ==========================================
// Data Loading
// ==========================================
async function loadAllData() {
    showLoading();
    try {
        const [leads, transactions, issues, dashboard] = await Promise.all([
            fetch(`${API}/api/leads`).then(r => r.json()),
            fetch(`${API}/api/transactions`).then(r => r.json()),
            fetch(`${API}/api/issues`).then(r => r.json()),
            fetch(`${API}/api/dashboard`).then(r => r.json()),
        ]);

        allLeads = Array.isArray(leads) ? leads : [];
        allTransactions = Array.isArray(transactions) ? transactions : [];
        allIssues = Array.isArray(issues) ? issues : [];

        renderDashboard(dashboard);
        renderLeads();
        renderTransactions();
        renderIssues();
        updateConnectionStatus(true);
    } catch (err) {
        console.error('Load failed:', err);
        updateConnectionStatus(false);
        showToast('Failed to load data. Check server connection.', 'error');
    }
    hideLoading();
}

// ==========================================
// Dashboard
// ==========================================
function renderDashboard(data) {
    if (!data || data.error) {
        document.getElementById('kpiIncoming').textContent = allLeads.length;
        document.getElementById('kpiOngoing').textContent = allLeads.filter(l => !['Closed Deal', 'Closed Issue'].includes(l.Current_Status)).length;
        document.getElementById('kpiTransaction').textContent = allTransactions.length;
        document.getElementById('kpiRevenue').textContent = formatRupiah(allTransactions.reduce((s, t) => s + (parseFloat(t.Value) || 0), 0));
        renderPipeline({});
        return;
    }

    animateValue('kpiIncoming', data.incomingChats || 0);
    animateValue('kpiOngoing', data.ongoing || 0);
    animateValue('kpiTransaction', data.txnCount || 0);
    document.getElementById('kpiRevenue').textContent = formatRupiah(data.revenue || 0);

    renderPipeline(data.pipeline || {});
    renderChart(data.monthlyChat2025 || [], data.monthlyChat2026 || []);
}

function renderPipeline(pipeline) {
    const container = document.getElementById('pipelineFunnel');
    if (!container) return;

    const stages = ['Incoming Chat', 'Ask Product', 'Ask Price', 'Visit / Sample Sent', 'Closed Deal', 'Closed Issue'];
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#14b8a6', '#22c55e', '#ef4444'];
    const total = Object.values(pipeline).reduce((a, b) => a + b, 0) || 1;

    container.innerHTML = stages.map((stage, i) => {
        const count = pipeline[stage] || 0;
        const pct = Math.round((count / total) * 100);
        return `
        <div class="pipeline-step">
            <div class="pipeline-number" style="background:${colors[i]}15;color:${colors[i]}">${i + 1}</div>
            <div class="pipeline-info">
                <div class="pipeline-name">${stage}</div>
                <div class="pipeline-count">${count} lead${count !== 1 ? 's' : ''}</div>
            </div>
            <div class="pipeline-bar-wrap">
                <div class="pipeline-bar" style="width:${pct}%;background:${colors[i]}"></div>
            </div>
        </div>`;
    }).join('');
}

function renderChart(data2025, data2026) {
    const ctx = document.getElementById('chatChart');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: '2025', data: data2025,
                    borderColor: '#22c55e', borderWidth: 2.5,
                    fill: true, backgroundColor: 'rgba(34,197,94,0.08)',
                    tension: 0.4, pointRadius: 4, pointBackgroundColor: '#22c55e',
                },
                {
                    label: '2026', data: data2026,
                    borderColor: '#3b82f6', borderWidth: 2.5,
                    fill: true, backgroundColor: 'rgba(59,130,246,0.06)',
                    tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6',
                    borderDash: [5, 5],
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#fff', titleColor: '#111', bodyColor: '#555',
                    borderColor: '#e5e7eb', borderWidth: 1, cornerRadius: 8, padding: 12,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} chats` }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                y: {
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1, callback: v => Math.floor(v) === v ? v : '' }
                }
            }
        }
    });
}

function animateValue(id, end) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 400;
    const t0 = performance.now();
    function step(t) {
        const p = Math.min((t - t0) / duration, 1);
        el.textContent = Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ==========================================
// Leads Table
// ==========================================
function renderLeads() {
    const tbody = document.getElementById('customerBody');
    if (!tbody) return;

    let data = [...allLeads];
    const search = document.getElementById('customerSearch')?.value?.toLowerCase() || '';
    const status = document.getElementById('pipelineStatusFilter')?.value || 'all';

    if (search) data = data.filter(l => (l.Company || '').toLowerCase().includes(search) || (l.Customer_Name || '').toLowerCase().includes(search) || (l.Product || '').toLowerCase().includes(search));
    if (status !== 'all') data = data.filter(l => l.Current_Status === status);

    const totalPages = Math.max(1, Math.ceil(data.length / PER_PAGE));
    if (currentCustomerPage > totalPages) currentCustomerPage = totalPages;
    const start = (currentCustomerPage - 1) * PER_PAGE;
    const pageData = data.slice(start, start + PER_PAGE);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-tertiary)">No leads found</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(l => {
            const initials = (l.Company || 'NA').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            const statusClass = getStatusClass(l.Current_Status);
            return `
            <tr>
                <td><div style="display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:8px;background:var(--accent-green-soft);color:var(--accent-green);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700">${initials}</div>
                    <strong>${l.Company || ''}</strong>
                </div></td>
                <td>${l.Customer_Name || ''}</td>
                <td>${l.Product || ''}</td>
                <td><strong>${formatRupiah(l.Potential_Value)}</strong></td>
                <td>${l.Source || ''}</td>
                <td>${l.Incoming_Chat_Date || ''}</td>
                <td><span class="status-badge ${statusClass}">${l.Current_Status || ''}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="editLead(${l._rowIndex})" title="Edit"><span class="material-icons-outlined">edit</span></button>
                        <button class="action-btn delete" onclick="deleteLead(${l._rowIndex})" title="Delete"><span class="material-icons-outlined">delete</span></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    renderPagination('customerPagination', data.length, currentCustomerPage, totalPages, p => { currentCustomerPage = p; renderLeads(); });
}

// ==========================================
// Transactions Table
// ==========================================
function renderTransactions() {
    const tbody = document.getElementById('transactionBody');
    if (!tbody) return;

    let data = [...allTransactions];
    const search = document.getElementById('transactionSearch')?.value?.toLowerCase() || '';
    const year = document.getElementById('txnYearFilter')?.value || 'all';

    if (search) data = data.filter(t => (t.Company || '').toLowerCase().includes(search) || (t.Product || '').toLowerCase().includes(search));
    if (year !== 'all') data = data.filter(t => (t.Date || '').startsWith(year));

    // Update stats
    const uniqueCompanies = new Set(allTransactions.map(t => t.Company)).size;
    const totalRevenue = allTransactions.reduce((s, t) => s + (parseFloat(t.Value) || 0), 0);
    const avgOrder = allTransactions.length > 0 ? totalRevenue / allTransactions.length : 0;
    document.getElementById('statCompanies').textContent = uniqueCompanies;
    document.getElementById('statTxnCount').textContent = allTransactions.length;
    document.getElementById('statRevenue').textContent = formatRupiah(totalRevenue);
    document.getElementById('statAvgOrder').textContent = formatRupiah(avgOrder);

    const totalPages = Math.max(1, Math.ceil(data.length / PER_PAGE));
    if (currentTxnPage > totalPages) currentTxnPage = totalPages;
    const start = (currentTxnPage - 1) * PER_PAGE;
    const pageData = data.slice(start, start + PER_PAGE);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-tertiary)">No transactions found</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map((t, i) => `
            <tr>
                <td>${start + i + 1}</td>
                <td><strong>${t.Company || ''}</strong></td>
                <td>${t.Date || ''}</td>
                <td>${formatRupiah(t.Value)}</td>
                <td>${formatRupiah(t.Total)}</td>
                <td>${t.Product || ''}</td>
                <td><button class="action-btn delete" onclick="deleteTransaction(${t._rowIndex})" title="Delete"><span class="material-icons-outlined">delete</span></button></td>
            </tr>
        `).join('');
    }

    renderPagination('transactionPagination', data.length, currentTxnPage, totalPages, p => { currentTxnPage = p; renderTransactions(); });
}

// ==========================================
// Issues Table
// ==========================================
function renderIssues() {
    const tbody = document.getElementById('issueBody');
    if (!tbody) return;

    let data = [...allIssues];
    const search = document.getElementById('issueSearch')?.value?.toLowerCase() || '';
    if (search) data = data.filter(i => (i.Company || '').toLowerCase().includes(search) || (i.Customer_Name || '').toLowerCase().includes(search));

    const totalPages = Math.max(1, Math.ceil(data.length / PER_PAGE));
    if (currentIssuePage > totalPages) currentIssuePage = totalPages;
    const start = (currentIssuePage - 1) * PER_PAGE;
    const pageData = data.slice(start, start + PER_PAGE);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-tertiary)">No issues found</td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(iss => {
            const statusClass = (iss.Resolution_Status || '').toLowerCase().replace(/\s/g, '-');
            return `
            <tr>
                <td>${iss.Issue_ID || ''}</td>
                <td>${iss.Customer_Name || ''}</td>
                <td><strong>${iss.Company || ''}</strong></td>
                <td>${iss.Product || ''}</td>
                <td>${iss.Issue_Date || ''}</td>
                <td><span class="status-badge ${statusClass}">${iss.Resolution_Status || ''}</span></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${iss.Issue_Description || ''}">${iss.Issue_Description || ''}</td>
                <td><button class="action-btn delete" onclick="deleteIssue(${iss._rowIndex})" title="Delete"><span class="material-icons-outlined">delete</span></button></td>
            </tr>`;
        }).join('');
    }

    renderPagination('issuePagination', data.length, currentIssuePage, totalPages, p => { currentIssuePage = p; renderIssues(); });
}

// ==========================================
// Pagination
// ==========================================
function renderPagination(containerId, total, current, totalPages, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const startItem = total > 0 ? ((current - 1) * PER_PAGE) + 1 : 0;
    const endItem = Math.min(current * PER_PAGE, total);

    let pageButtons = '';
    const maxButtons = 5;
    let startPage = Math.max(1, current - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

    for (let i = startPage; i <= endPage; i++) {
        pageButtons += `<button class="pagination-btn ${i === current ? 'active' : ''}" data-p="${i}">${i}</button>`;
    }

    container.innerHTML = `
        <span class="pagination-info">Showing ${startItem}-${endItem} of ${total}</span>
        <div class="pagination-buttons">
            <button class="pagination-btn" data-p="prev" ${current <= 1 ? 'disabled' : ''}><span class="material-icons-outlined">chevron_left</span></button>
            ${pageButtons}
            <button class="pagination-btn" data-p="next" ${current >= totalPages ? 'disabled' : ''}><span class="material-icons-outlined">chevron_right</span></button>
        </div>
    `;

    container.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = btn.dataset.p;
            if (p === 'prev' && current > 1) onChange(current - 1);
            else if (p === 'next' && current < totalPages) onChange(current + 1);
            else if (p !== 'prev' && p !== 'next') onChange(parseInt(p));
        });
    });
}

// ==========================================
// Lead Modal
// ==========================================
function showAddLeadModal() {
    document.getElementById('modalTitle').textContent = 'Add New Lead';
    document.getElementById('leadForm').reset();
    document.getElementById('editRowIndex').value = '';
    document.getElementById('editLeadId').value = '';
    document.getElementById('editFields').style.display = 'none';
    document.getElementById('leadModal').classList.add('visible');
}

function editLead(rowIndex) {
    const lead = allLeads.find(l => l._rowIndex === rowIndex);
    if (!lead) return;

    document.getElementById('modalTitle').textContent = 'Edit Lead';
    document.getElementById('editRowIndex').value = rowIndex;
    document.getElementById('editLeadId').value = lead.Lead_ID || '';
    document.getElementById('formCustomerName').value = lead.Customer_Name || '';
    document.getElementById('formCompany').value = lead.Company || '';
    document.getElementById('formProduct').value = lead.Product || '';
    document.getElementById('formQty').value = lead.Qty || '';
    document.getElementById('formPotentialValue').value = lead.Potential_Value || '';
    document.getElementById('formSource').value = lead.Source || '';
    document.getElementById('formStatus').value = lead.Current_Status || 'Incoming Chat';
    document.getElementById('formIncomingDate').value = lead.Incoming_Chat_Date || '';
    document.getElementById('formAskProductDate').value = lead.Ask_Product_Date || '';
    document.getElementById('formAskPriceDate').value = lead.Ask_Price_Date || '';
    document.getElementById('formVisitDate').value = lead.Visit_or_Sample_Sent_Date || '';
    document.getElementById('formClosedDealDate').value = lead.Closed_Deal_Date || '';
    document.getElementById('formClosedIssueDate').value = lead.Closed_Issue_Date || '';
    document.getElementById('formNotes').value = lead.Notes || '';

    document.getElementById('editFields').style.display = 'block';
    document.getElementById('leadModal').classList.add('visible');
}

function closeLeadModal() {
    document.getElementById('leadModal').classList.remove('visible');
}

async function handleLeadSubmit(e) {
    e.preventDefault();
    const rowIndex = document.getElementById('editRowIndex').value;
    const isEdit = !!rowIndex;

    if (isEdit) {
        const data = {
            Lead_ID: document.getElementById('editLeadId').value,
            Customer_Name: document.getElementById('formCustomerName').value,
            Company: document.getElementById('formCompany').value,
            Product: document.getElementById('formProduct').value,
            Qty: document.getElementById('formQty').value,
            Potential_Value: document.getElementById('formPotentialValue').value,
            Source: document.getElementById('formSource').value,
            Current_Status: document.getElementById('formStatus').value,
            Incoming_Chat_Date: document.getElementById('formIncomingDate').value,
            Ask_Product_Date: document.getElementById('formAskProductDate').value,
            Ask_Price_Date: document.getElementById('formAskPriceDate').value,
            Visit_or_Sample_Sent_Date: document.getElementById('formVisitDate').value,
            Closed_Deal_Date: document.getElementById('formClosedDealDate').value,
            Closed_Issue_Date: document.getElementById('formClosedIssueDate').value,
            Notes: document.getElementById('formNotes').value,
        };
        try {
            await fetch(`${API}/api/leads/${rowIndex}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            showToast('Lead updated successfully!', 'success');
        } catch (err) {
            showToast('Error updating lead', 'error');
        }
    } else {
        const data = {
            customer_name: document.getElementById('formCustomerName').value,
            company: document.getElementById('formCompany').value,
            product: document.getElementById('formProduct').value,
            qty: document.getElementById('formQty').value,
            potential_value: document.getElementById('formPotentialValue').value,
            source: document.getElementById('formSource').value,
            notes: document.getElementById('formNotes').value,
        };
        try {
            await fetch(`${API}/api/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            showToast('New lead added!', 'success');
        } catch (err) {
            showToast('Error adding lead', 'error');
        }
    }

    closeLeadModal();
    await loadAllData();
}

// ==========================================
// Delete Operations
// ==========================================
async function deleteLead(rowIndex) {
    if (!confirm('Delete this lead? This action cannot be undone.')) return;
    try {
        await fetch(`${API}/api/leads/${rowIndex}`, { method: 'DELETE' });
        showToast('Lead deleted', 'success');
        await loadAllData();
    } catch (err) { showToast('Error deleting lead', 'error'); }
}

async function deleteTransaction(rowIndex) {
    if (!confirm('Delete this transaction?')) return;
    try {
        await fetch(`${API}/api/transactions/${rowIndex}`, { method: 'DELETE' });
        showToast('Transaction deleted', 'success');
        await loadAllData();
    } catch (err) { showToast('Error deleting transaction', 'error'); }
}

async function deleteIssue(rowIndex) {
    if (!confirm('Delete this issue?')) return;
    try {
        await fetch(`${API}/api/issues/${rowIndex}`, { method: 'DELETE' });
        showToast('Issue deleted', 'success');
        await loadAllData();
    } catch (err) { showToast('Error deleting issue', 'error'); }
}

// ==========================================
// Settings
// ==========================================
async function checkConfigStatus() {
    try {
        const res = await fetch(`${API}/api/config/status`);
        const data = await res.json();
        const status = document.getElementById('settingsStatus');

        if (data.authenticated && data.spreadsheetId) {
            status.className = 'settings-status success';
            status.textContent = `✅ Connected to spreadsheet: ${data.spreadsheetId}`;
            document.getElementById('settingsSpreadsheetId').value = data.spreadsheetId;
        } else if (data.hasCredentials) {
            status.className = 'settings-status info';
            status.textContent = 'ℹ️ Credentials found. Enter Spreadsheet ID or create new.';
        } else {
            status.className = 'settings-status error';
            status.textContent = '❌ credentials.json not found. See instructions above.';
        }
    } catch (err) {
        console.error('Config check failed:', err);
    }
}

async function saveSpreadsheetId() {
    const id = document.getElementById('settingsSpreadsheetId').value.trim();
    if (!id) { showToast('Enter a Spreadsheet ID', 'error'); return; }

    try {
        const res = await fetch(`${API}/api/config/spreadsheet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId: id })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Connected successfully!', 'success');
            await checkConfigStatus();
            await loadAllData();
        } else {
            showToast(data.error || 'Connection failed', 'error');
        }
    } catch (err) {
        showToast('Error connecting', 'error');
    }
}

async function createNewSpreadsheet() {
    try {
        showToast('Creating spreadsheet...', 'info');
        const res = await fetch(`${API}/api/config/create`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            document.getElementById('settingsSpreadsheetId').value = data.spreadsheetId;
            showToast(`Spreadsheet created! ID: ${data.spreadsheetId}`, 'success');
            await checkConfigStatus();
            await loadAllData();
        } else {
            showToast(data.error || 'Failed to create spreadsheet', 'error');
        }
    } catch (err) {
        showToast('Error creating spreadsheet', 'error');
    }
}

// ==========================================
// Utilities
// ==========================================
function formatRupiah(val) {
    const num = parseFloat(String(val || '0').replace(/[^0-9.-]/g, ''));
    if (isNaN(num) || num === 0) return 'Rp 0';
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

function getStatusClass(status) {
    const map = {
        'Incoming Chat': 'incoming-chat', 'Ask Product': 'ask-product',
        'Ask Price': 'ask-price', 'Visit / Sample Sent': 'visit-sample',
        'Closed Deal': 'closed-deal', 'Closed Issue': 'closed-issue',
    };
    return map[status] || '';
}

function showLoading() { document.getElementById('loadingOverlay')?.classList.add('visible'); }
function hideLoading() { document.getElementById('loadingOverlay')?.classList.remove('visible'); }

function updateConnectionStatus(connected) {
    const dot = document.getElementById('connectionDot');
    const text = document.getElementById('connectionText');
    if (dot) dot.className = `connection-dot ${connected ? 'connected' : 'disconnected'}`;
    if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type} visible`;
    setTimeout(() => toast.classList.remove('visible'), 4000);
}

// Auto-refresh every 60 seconds
setInterval(loadAllData, 60000);
