/* ==========================================
   GLOB CRM - Application Logic (SQLite Version)
   ========================================== */

const API_URL = 'http://localhost:3000/api';

// ==========================================
// DOM References
// ==========================================
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');
const pageBreadcrumb = document.getElementById('pageBreadcrumb');

const leadModal = document.getElementById('leadModal');
const leadForm = document.getElementById('leadForm');

// ==========================================
// State
// ==========================================
let leadsData = [];
let transactionsData = [];
let revenueChartInstance = null;
let sparklineInstances = {};

// ==========================================
// API Calls
// ==========================================
async function fetchLeads() {
    try {
        const res = await fetch(`${API_URL}/leads`);
        leadsData = await res.json();
        return leadsData;
    } catch (err) {
        console.error('Error fetching leads:', err);
        return [];
    }
}

async function fetchTransactions() {
    try {
        const res = await fetch(`${API_URL}/transactions`);
        transactionsData = await res.json();
        return transactionsData;
    } catch (err) {
        console.error('Error fetching transactions:', err);
        return [];
    }
}

async function saveLead(data) {
    const isEdit = data.id;
    const url = isEdit ? `${API_URL}/leads/${data.id}` : `${API_URL}/leads`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showStatusMessage(isEdit ? 'Lead updated!' : 'Lead added!', 'success');
        refreshAllData();
    } catch (err) {
        showStatusMessage('Error saving lead', 'error');
    }
}

async function deleteLead(id) {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
        await fetch(`${API_URL}/leads/${id}`, { method: 'DELETE' });
        showStatusMessage('Lead deleted!', 'success');
        refreshAllData();
    } catch (err) {
        showStatusMessage('Error deleting lead', 'error');
    }
}

// ==========================================
// Core Functions
// ==========================================
async function refreshAllData() {
    showLoading();
    await Promise.all([fetchLeads(), fetchTransactions()]);
    renderDashboard();
    renderLeadsTable();
    renderTransactionsTable();
    hideLoading();
    updateConnectionStatus(true);
}

function renderDashboard() {
    // KPI Calculations
    const incoming = leadsData.length;
    const ongoing = leadsData.filter(l => !['Closed Deal', 'Closed Issue'].includes(l.current_status)).length;
    const txnCount = transactionsData.length;
    const revenue = transactionsData.reduce((sum, t) => sum + (parseFloat(t.value) || 0), 0);

    animateValue('kpiIncoming', incoming);
    animateValue('kpiOngoing', ongoing);
    animateValue('kpiTransaction', txnCount);
    document.getElementById('kpiRevenue').textContent = formatRupiah(revenue);

    renderPipelineFunnel();
    renderMainChart();
}

function renderPipelineFunnel() {
    const container = document.getElementById('pipelineFunnel');
    if (!container) return;

    const stages = ['Incoming Chat', 'Ask Product', 'Ask Price', 'Visit / Sample Sent', 'Closed Deal', 'Closed Issue'];
    const counts = {};
    stages.forEach(s => counts[s] = leadsData.filter(l => l.current_status === s).length);
    
    const total = leadsData.length || 1;

    container.innerHTML = stages.map((stage, idx) => {
        const count = counts[stage];
        const progress = Math.round((count / total) * 100);
        const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#14b8a6', '#10b981', '#ef4444'];
        
        return `
        <div class="pipeline-step">
            <div class="pipeline-number" style="background: ${colors[idx]}20; color: ${colors[idx]}">${idx + 1}</div>
            <div class="pipeline-info">
                <div class="pipeline-name">${stage}</div>
                <div class="pipeline-date">${count} leads</div>
            </div>
            <div class="pipeline-bar-container">
                <div class="pipeline-bar" style="width: ${progress}%; background: ${colors[idx]}"></div>
            </div>
        </div>`;
    }).join('');
}

function renderLeadsTable() {
    const tbody = document.getElementById('customerBody');
    if (!tbody) return;

    tbody.innerHTML = leadsData.map(l => `
        <tr>
            <td><strong>${l.company}</strong></td>
            <td>${l.customer_name}</td>
            <td>${l.product}</td>
            <td>${formatRupiah(l.potential_value)}</td>
            <td>${l.incoming_chat_date}</td>
            <td><span class="status-badge ${getStatusClass(l.current_status)}">${l.current_status}</span></td>
            <td>
                <div class="action-buttons">
                    <button onclick="editLead(${l.id})" class="action-btn edit" title="Edit"><span class="material-icons-outlined">edit</span></button>
                    <button onclick="deleteLead(${l.id})" class="action-btn delete" title="Delete"><span class="material-icons-outlined">delete</span></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transactionBody');
    if (!tbody) return;

    tbody.innerHTML = transactionsData.map(t => `
        <tr>
            <td>${t.transaction_id}</td>
            <td>${t.company}</td>
            <td>${t.date}</td>
            <td>${formatRupiah(t.value)}</td>
            <td>${t.product}</td>
            <td>
                <button onclick="deleteTransaction(${t.id})" class="action-btn delete"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// Modal Logic
// ==========================================
function showAddLeadModal() {
    document.getElementById('modalTitle').textContent = 'Add New Lead';
    leadForm.reset();
    document.getElementById('editLeadId').value = '';
    leadModal.style.display = 'flex';
}

function editLead(id) {
    const lead = leadsData.find(l => l.id === id);
    if (!lead) return;

    document.getElementById('modalTitle').textContent = 'Edit Lead';
    document.getElementById('editLeadId').value = lead.id;
    document.getElementById('formCustomerName').value = lead.customer_name;
    document.getElementById('formCompany').value = lead.company;
    document.getElementById('formProduct').value = lead.product;
    document.getElementById('formQty').value = lead.qty;
    document.getElementById('formPotentialValue').value = lead.potential_value;
    document.getElementById('formSource').value = lead.source;
    document.getElementById('formStatus').value = lead.current_status;
    document.getElementById('formNotes').value = lead.notes;

    leadModal.style.display = 'flex';
}

function closeLeadModal() {
    leadModal.style.display = 'none';
}

leadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
        id: document.getElementById('editLeadId').value,
        customer_name: document.getElementById('formCustomerName').value,
        company: document.getElementById('formCompany').value,
        product: document.getElementById('formProduct').value,
        qty: document.getElementById('formQty').value,
        potential_value: document.getElementById('formPotentialValue').value,
        source: document.getElementById('formSource').value,
        current_status: document.getElementById('formStatus').value,
        notes: document.getElementById('formNotes').value,
        incoming_chat_date: new Date().toISOString().split('T')[0]
    };
    saveLead(data);
    closeLeadModal();
});

// ==========================================
// Utilities & Init
// ==========================================
function formatRupiah(val) {
    return 'Rp ' + (parseFloat(val) || 0).toLocaleString('id-ID');
}

function animateValue(id, end) {
    const el = document.getElementById(id);
    if (el) el.textContent = end;
}

function getStatusClass(status) {
    return status.toLowerCase().replace(/\s+/g, '-');
}

function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }
function showStatusMessage(msg) { console.log(msg); }
function updateConnectionStatus(status) {
    const dot = document.getElementById('connectionDot');
    if (dot) dot.className = `connection-dot ${status ? 'connected' : 'disconnected'}`;
}

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        pages.forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
    });
});

function renderMainChart() {
    // Basic chart mockup for now
}

document.addEventListener('DOMContentLoaded', refreshAllData);
window.showAddLeadModal = showAddLeadModal;
window.closeLeadModal = closeLeadModal;
window.editLead = editLead;
window.deleteLead = deleteLead;
