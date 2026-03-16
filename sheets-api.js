/* ==========================================
   GLOB CRM - Google Sheets API Service
   Full CRUD + Auto-create sheets + Automation
   ========================================== */

const { google } = require('googleapis');
const path = require('path');

// Sheet definitions
const SHEET_CONFIGS = {
    leads: {
        name: 'Leads_Pipeline',
        headers: [
            'Lead_ID', 'Customer_Name', 'Company', 'Product', 'Qty',
            'Potential_Value', 'Source', 'Incoming_Chat_Date', 'Ask_Product_Date',
            'Ask_Price_Date', 'Visit_or_Sample_Sent_Date', 'Closed_Deal_Date',
            'Closed_Issue_Date', 'Current_Status', 'Notes'
        ]
    },
    transactions: {
        name: 'Customer_Transaction',
        headers: ['Transaction_ID', 'Company', 'Date', 'Value', 'Total', 'Product']
    },
    issues: {
        name: 'Customer_Issue',
        headers: ['Issue_ID', 'Customer_Name', 'Company', 'Product', 'Issue_Date', 'Issue_Description', 'Resolution_Status', 'Notes']
    }
};

const PIPELINE_STAGES = [
    'Incoming Chat', 'Ask Product', 'Ask Price',
    'Visit / Sample Sent', 'Closed Deal', 'Closed Issue'
];

class SheetsAPI {
    constructor() {
        this.sheets = null;
        this.drive = null;
        this.spreadsheetId = null;
        this.isAuthenticated = false;
    }

    // ==========================================
    // Authentication
    // ==========================================
    async authenticate(credentialsPath) {
        try {
            let credentials;
            let auth;

            // Check if Vercel Environment Variable is present
            if (process.env.GOOGLE_CREDENTIALS_JSON) {
                credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
                auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: [
                        'https://www.googleapis.com/auth/spreadsheets',
                        'https://www.googleapis.com/auth/drive',
                    ],
                });
            } else {
                // Fallback to local file
                auth = new google.auth.GoogleAuth({
                    keyFile: credentialsPath,
                    scopes: [
                        'https://www.googleapis.com/auth/spreadsheets',
                        'https://www.googleapis.com/auth/drive',
                    ],
                });
            }

            this.sheets = google.sheets({ version: 'v4', auth });
            this.drive = google.drive({ version: 'v3', auth });
            this.isAuthenticated = true;
            console.log('✅ Google Sheets API authenticated');
            return true;
        } catch (err) {
            console.error('❌ Authentication failed:', err.message);
            this.isAuthenticated = false;
            return false;
        }
    }

    setSpreadsheetId(id) {
        this.spreadsheetId = id;
    }

    // ==========================================
    // Auto-create Spreadsheet & Sheets
    // ==========================================
    async createSpreadsheet() {
        if (!this.isAuthenticated) throw new Error('Not authenticated');

        const spreadsheet = await this.sheets.spreadsheets.create({
            requestBody: {
                properties: { title: 'GLOB CRM Database' },
                sheets: Object.values(SHEET_CONFIGS).map(cfg => ({
                    properties: { title: cfg.name }
                }))
            }
        });

        this.spreadsheetId = spreadsheet.data.spreadsheetId;

        // Add headers to each sheet
        for (const cfg of Object.values(SHEET_CONFIGS)) {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${cfg.name}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [cfg.headers] },
            });
        }

        // Format headers (bold, blue background, frozen row)
        const sheetIds = spreadsheet.data.sheets.map(s => s.properties.sheetId);
        const formatRequests = sheetIds.flatMap(sheetId => ([
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.133, green: 0.545, blue: 0.133 },
                            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                        },
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat)',
                },
            },
            {
                updateSheetProperties: {
                    properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                    fields: 'gridProperties.frozenRowCount',
                },
            },
        ]));

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: { requests: formatRequests },
        });

        // Make publicly readable
        await this.drive.permissions.create({
            fileId: this.spreadsheetId,
            requestBody: { role: 'reader', type: 'anyone' },
        });

        console.log(`✅ Spreadsheet created: ${this.spreadsheetId}`);
        return this.spreadsheetId;
    }

    async ensureSheetsExist() {
        if (!this.spreadsheetId || !this.isAuthenticated) return;

        try {
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });
            const existingSheetNames = spreadsheet.data.sheets.map(s => s.properties.title);

            for (const cfg of Object.values(SHEET_CONFIGS)) {
                if (!existingSheetNames.includes(cfg.name)) {
                    await this.sheets.spreadsheets.batchUpdate({
                        spreadsheetId: this.spreadsheetId,
                        requestBody: {
                            requests: [{ addSheet: { properties: { title: cfg.name } } }]
                        }
                    });
                    await this.sheets.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range: `${cfg.name}!A1`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: [cfg.headers] },
                    });
                    console.log(`  ✅ Created sheet: ${cfg.name}`);
                }
            }
        } catch (err) {
            console.error('Error ensuring sheets exist:', err.message);
        }
    }

    // ==========================================
    // Generic Sheet Helpers
    // ==========================================
    async _getSheetData(sheetName) {
        const res = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A:Z`,
        });
        const rows = res.data.values || [];
        if (rows.length < 1) return [];

        const headers = rows[0];
        return rows.slice(1).map((row, idx) => {
            const obj = { _rowIndex: idx + 2 }; // 1-indexed + header row
            headers.forEach((h, i) => { obj[h] = row[i] || ''; });
            return obj;
        });
    }

    async _appendRow(sheetName, values) {
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
        });
    }

    async _updateRow(sheetName, rowIndex, values) {
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
        });
    }

    async _deleteRow(sheetName, rowIndex) {
        // Get sheet ID
        const spreadsheet = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId,
        });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) return;

        await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1,  // 0-indexed
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
    }

    // ==========================================
    // LEADS CRUD
    // ==========================================
    async getLeads() {
        return await this._getSheetData(SHEET_CONFIGS.leads.name);
    }

    async addLead(data) {
        const leads = await this.getLeads();
        const nextNum = leads.length + 1;
        const leadId = 'L-' + String(nextNum).padStart(3, '0');
        const today = new Date().toISOString().split('T')[0];

        const row = [
            leadId,
            data.customer_name || '',
            data.company || '',
            data.product || '',
            data.qty || '',
            data.potential_value || '',
            data.source || '',
            data.incoming_chat_date || today,
            '', '', '', '', '',  // stage dates empty
            'Incoming Chat',
            data.notes || ''
        ];

        await this._appendRow(SHEET_CONFIGS.leads.name, row);
        return { lead_id: leadId };
    }

    async updateLead(rowIndex, data) {
        const row = [
            data.Lead_ID || '',
            data.Customer_Name || '',
            data.Company || '',
            data.Product || '',
            data.Qty || '',
            data.Potential_Value || '',
            data.Source || '',
            data.Incoming_Chat_Date || '',
            data.Ask_Product_Date || '',
            data.Ask_Price_Date || '',
            data.Visit_or_Sample_Sent_Date || '',
            data.Closed_Deal_Date || '',
            data.Closed_Issue_Date || '',
            data.Current_Status || '',
            data.Notes || ''
        ];

        await this._updateRow(SHEET_CONFIGS.leads.name, rowIndex, row);

        // AUTOMATION: Handle status changes
        if (data.Current_Status === 'Closed Deal') {
            await this._autoCreateTransaction(data);
        } else if (data.Current_Status === 'Closed Issue') {
            await this._autoCreateIssue(data);
        }

        return { success: true };
    }

    async deleteLead(rowIndex) {
        await this._deleteRow(SHEET_CONFIGS.leads.name, rowIndex);
        return { success: true };
    }

    // ==========================================
    // TRANSACTIONS CRUD
    // ==========================================
    async getTransactions() {
        return await this._getSheetData(SHEET_CONFIGS.transactions.name);
    }

    async addTransaction(data) {
        const txns = await this.getTransactions();
        const nextNum = txns.length + 1;
        const txnId = 'TXN-' + String(nextNum).padStart(3, '0');

        const row = [
            txnId,
            data.company || '',
            data.date || new Date().toISOString().split('T')[0],
            data.value || '',
            data.total || data.value || '',
            data.product || ''
        ];

        await this._appendRow(SHEET_CONFIGS.transactions.name, row);
        return { transaction_id: txnId };
    }

    async deleteTransaction(rowIndex) {
        await this._deleteRow(SHEET_CONFIGS.transactions.name, rowIndex);
        return { success: true };
    }

    // ==========================================
    // ISSUES CRUD
    // ==========================================
    async getIssues() {
        return await this._getSheetData(SHEET_CONFIGS.issues.name);
    }

    async addIssue(data) {
        const issues = await this.getIssues();
        const nextNum = issues.length + 1;
        const issueId = 'ISS-' + String(nextNum).padStart(3, '0');

        const row = [
            issueId,
            data.customer_name || '',
            data.company || '',
            data.product || '',
            data.issue_date || new Date().toISOString().split('T')[0],
            data.issue_description || '',
            data.resolution_status || 'Open',
            data.notes || ''
        ];

        await this._appendRow(SHEET_CONFIGS.issues.name, row);
        return { issue_id: issueId };
    }

    async updateIssue(rowIndex, data) {
        const row = [
            data.Issue_ID || '',
            data.Customer_Name || '',
            data.Company || '',
            data.Product || '',
            data.Issue_Date || '',
            data.Issue_Description || '',
            data.Resolution_Status || '',
            data.Notes || ''
        ];
        await this._updateRow(SHEET_CONFIGS.issues.name, rowIndex, row);
        return { success: true };
    }

    async deleteIssue(rowIndex) {
        await this._deleteRow(SHEET_CONFIGS.issues.name, rowIndex);
        return { success: true };
    }

    // ==========================================
    // AUTOMATION
    // ==========================================
    async _autoCreateTransaction(leadData) {
        try {
            await this.addTransaction({
                company: leadData.Company,
                date: leadData.Closed_Deal_Date || new Date().toISOString().split('T')[0],
                value: leadData.Potential_Value,
                total: leadData.Potential_Value,
                product: leadData.Product,
            });
            console.log(`  ✅ Auto-created transaction for ${leadData.Company}`);
        } catch (err) {
            console.error('Auto-create transaction failed:', err.message);
        }
    }

    async _autoCreateIssue(leadData) {
        try {
            await this.addIssue({
                customer_name: leadData.Customer_Name,
                company: leadData.Company,
                product: leadData.Product,
                issue_date: leadData.Closed_Issue_Date || new Date().toISOString().split('T')[0],
                issue_description: 'From pipeline: ' + (leadData.Notes || 'No notes'),
                resolution_status: 'Open',
                notes: leadData.Notes,
            });
            console.log(`  ✅ Auto-created issue for ${leadData.Company}`);
        } catch (err) {
            console.error('Auto-create issue failed:', err.message);
        }
    }

    // ==========================================
    // KPI Calculations
    // ==========================================
    async getKPIs() {
        const leads = await this.getLeads();
        const transactions = await this.getTransactions();

        const incomingChats = leads.length;
        const ongoing = leads.filter(l =>
            l.Current_Status && !['Closed Deal', 'Closed Issue'].includes(l.Current_Status)
        ).length;
        const txnCount = transactions.length;
        const revenue = transactions.reduce((sum, t) => {
            const val = parseFloat(String(t.Value || '0').replace(/[^0-9.-]/g, ''));
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

        // Pipeline counts
        const pipeline = {};
        PIPELINE_STAGES.forEach(s => pipeline[s] = 0);
        leads.forEach(l => {
            if (pipeline.hasOwnProperty(l.Current_Status)) {
                pipeline[l.Current_Status]++;
            }
        });

        // Monthly incoming chats for chart (2025 & 2026)
        const monthlyChat2025 = new Array(12).fill(0);
        const monthlyChat2026 = new Array(12).fill(0);
        leads.forEach(l => {
            if (!l.Incoming_Chat_Date) return;
            const d = new Date(l.Incoming_Chat_Date);
            if (isNaN(d.getTime())) return;
            if (d.getFullYear() === 2025) monthlyChat2025[d.getMonth()]++;
            if (d.getFullYear() === 2026) monthlyChat2026[d.getMonth()]++;
        });

        return {
            incomingChats,
            ongoing,
            txnCount,
            revenue,
            pipeline,
            monthlyChat2025,
            monthlyChat2026,
        };
    }
}

module.exports = { SheetsAPI, SHEET_CONFIGS, PIPELINE_STAGES };
