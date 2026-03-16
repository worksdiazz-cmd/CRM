/* ==========================================
   GLOB CRM - Google Sheets Data Service
   Fetches & parses data from published Google Sheets
   ========================================== */

const SheetsService = {
    // Cache for fetched data
    _cache: {
        leads: [],
        transactions: [],
        issues: [],
        lastFetch: null,
    },

    // Build the CSV export URL for a given sheet
    _buildUrl(sheetName) {
        const id = CONFIG.SPREADSHEET_ID;
        if (!id) return null;
        return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    },

    // Parse CSV text into array of objects (using header row as keys)
    _parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 1) return [];

        // Parse CSV line handling quoted fields
        function parseLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        }

        const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseLine(lines[i]);
            const obj = {};
            headers.forEach((header, idx) => {
                let val = values[idx] || '';
                val = val.replace(/^"|"$/g, '').trim();
                obj[header] = val;
            });
            data.push(obj);
        }

        return data;
    },

    // Fetch a single sheet's data
    async _fetchSheet(sheetName) {
        const url = this._buildUrl(sheetName);
        if (!url) throw new Error('Spreadsheet ID not configured');

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${sheetName}: ${response.status} ${response.statusText}`);
        }
        const csvText = await response.text();
        return this._parseCSV(csvText);
    },

    // Fetch all sheets
    async fetchAll() {
        try {
            const [leads, transactions, issues] = await Promise.all([
                this._fetchSheet(CONFIG.SHEETS.LEADS_PIPELINE),
                this._fetchSheet(CONFIG.SHEETS.CUSTOMER_TRANSACTION),
                this._fetchSheet(CONFIG.SHEETS.CUSTOMER_ISSUE),
            ]);

            this._cache.leads = leads;
            this._cache.transactions = transactions;
            this._cache.issues = issues;
            this._cache.lastFetch = new Date();

            return { leads, transactions, issues };
        } catch (error) {
            console.error('SheetsService: Error fetching data:', error);
            throw error;
        }
    },

    // ==========================================
    // KPI Calculations
    // ==========================================

    // Incoming Chats = count of rows with Incoming_Chat_Date populated
    getIncomingChats(month = 'all') {
        return this._cache.leads.filter(lead => {
            if (!lead.Incoming_Chat_Date) return false;
            if (month === 'all') return true;
            const date = new Date(lead.Incoming_Chat_Date);
            return date.getMonth() === parseInt(month);
        }).length;
    },

    // Customer On Going = leads where Current_Status is NOT Closed Deal or Closed Issue
    getCustomerOnGoing(month = 'all') {
        return this._cache.leads.filter(lead => {
            const status = lead.Current_Status;
            if (status === 'Closed Deal' || status === 'Closed Issue') return false;
            if (month === 'all') return true;
            if (!lead.Incoming_Chat_Date) return false;
            const date = new Date(lead.Incoming_Chat_Date);
            return date.getMonth() === parseInt(month);
        }).length;
    },

    // Customer Transaction = number of rows in Customer_Transaction
    getCustomerTransactionCount(month = 'all') {
        if (month === 'all') return this._cache.transactions.length;
        return this._cache.transactions.filter(t => {
            if (!t.Date) return false;
            const date = new Date(t.Date);
            return date.getMonth() === parseInt(month);
        }).length;
    },

    // Total Revenue = sum of Value column in Customer_Transaction
    getTotalRevenue(month = 'all') {
        const filtered = month === 'all'
            ? this._cache.transactions
            : this._cache.transactions.filter(t => {
                if (!t.Date) return false;
                const date = new Date(t.Date);
                return date.getMonth() === parseInt(month);
            });

        return filtered.reduce((sum, t) => {
            const val = parseFloat(String(t.Value || '0').replace(/[^0-9.-]/g, ''));
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
    },

    // ==========================================
    // Pipeline Funnel Data
    // ==========================================

    getPipelineCounts() {
        const counts = {};
        CONFIG.PIPELINE_STAGES.forEach(stage => {
            counts[stage] = 0;
        });

        this._cache.leads.forEach(lead => {
            const status = lead.Current_Status;
            if (counts.hasOwnProperty(status)) {
                counts[status]++;
            }
        });

        return counts;
    },

    // ==========================================
    // Chart Data: Incoming Chat Comparison by Year
    // ==========================================

    getIncomingChatByMonth(year) {
        const monthlyCounts = new Array(12).fill(0);

        this._cache.leads.forEach(lead => {
            if (!lead.Incoming_Chat_Date) return;
            const date = new Date(lead.Incoming_Chat_Date);
            if (isNaN(date.getTime())) return;
            if (date.getFullYear() === year) {
                monthlyCounts[date.getMonth()]++;
            }
        });

        return monthlyCounts;
    },

    // ==========================================
    // Table Data Getters
    // ==========================================

    getLeadsPipelineData() {
        return this._cache.leads.map((lead, idx) => ({
            id: lead.Lead_ID || `L-${String(idx + 1).padStart(3, '0')}`,
            customerName: lead.Customer_Name || '',
            company: lead.Company || '',
            product: lead.Product || '',
            qty: lead.Qty || '',
            potentialValue: lead.Potential_Value || '',
            source: lead.Source || '',
            incomingChatDate: lead.Incoming_Chat_Date || '',
            askProductDate: lead.Ask_Product_Date || '',
            askPriceDate: lead.Ask_Price_Date || '',
            visitSampleDate: lead.Visit_or_Sample_Sent_Date || '',
            closedDealDate: lead.Closed_Deal_Date || '',
            closedIssueDate: lead.Closed_Issue_Date || '',
            currentStatus: lead.Current_Status || '',
            notes: lead.Notes || '',
        }));
    },

    getTransactionData() {
        return this._cache.transactions.map((t, idx) => ({
            id: t.Transaction_ID || `TXN-${String(idx + 1).padStart(3, '0')}`,
            company: t.Company || '',
            date: t.Date || '',
            value: t.Value || '',
            total: t.Total || '',
            product: t.Product || '',
        }));
    },

    getIssueData() {
        return this._cache.issues.map((issue, idx) => ({
            id: issue.Issue_ID || `ISS-${String(idx + 1).padStart(3, '0')}`,
            customerName: issue.Customer_Name || '',
            company: issue.Company || '',
            product: issue.Product || '',
            issueDate: issue.Issue_Date || '',
            issueDescription: issue.Issue_Description || '',
            resolutionStatus: issue.Resolution_Status || '',
            notes: issue.Notes || '',
        }));
    },

    // ==========================================
    // Auto-refresh
    // ==========================================

    _refreshTimer: null,

    startAutoRefresh(callback) {
        this.stopAutoRefresh();
        this._refreshTimer = setInterval(async () => {
            try {
                await this.fetchAll();
                if (callback) callback();
                console.log('SheetsService: Auto-refreshed at', new Date().toLocaleTimeString());
            } catch (err) {
                console.error('SheetsService: Auto-refresh failed:', err);
            }
        }, CONFIG.REFRESH_INTERVAL);
    },

    stopAutoRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    },

    // Check if Spreadsheet ID is configured
    isConfigured() {
        return CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== '';
    },
};
