/* ==========================================
   GLOB CRM - Express Server
   REST API for Google Sheets CRM
   ========================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { SheetsAPI } = require('./sheets-api');

const app = express();
const port = process.env.PORT || 3000;
const sheetsApi = new SheetsAPI();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Initialization
// ==========================================
async function initializeApp() {
    let authenticated = false;

    // In Vercel, use env variable
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
        authenticated = await sheetsApi.authenticate();
    } else {
        const credPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
        const fullCredPath = path.resolve(credPath);

        if (!fs.existsSync(fullCredPath)) {
            console.log('');
            console.log('⚠️  credentials.json not found.');
            console.log('   The server will start in DEMO MODE (no Google Sheets connection).');
            console.log('');
            console.log('   To connect to Google Sheets:');
            console.log('   1. Go to https://console.cloud.google.com/');
            console.log('   2. Enable Google Sheets API & Google Drive API');
            console.log('   3. Create a Service Account → Download JSON key');
            console.log('   4. Save as credentials.json in this folder');
            console.log('   5. Restart the server');
            console.log('');
            return;
        }
        authenticated = await sheetsApi.authenticate(fullCredPath);
    }

    if (!authenticated) return;

    // Check if we have a Spreadsheet ID
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (spreadsheetId && spreadsheetId.trim() !== '') {
        sheetsApi.setSpreadsheetId(spreadsheetId);
        await sheetsApi.ensureSheetsExist();
        console.log(`📊 Using spreadsheet: ${spreadsheetId}`);
    } else {
        console.log('ℹ️  No SPREADSHEET_ID set. Use Settings page or POST /api/config/create to create one.');
    }
}

// ==========================================
// API: Configuration
// ==========================================
app.get('/api/config/status', (req, res) => {
    res.json({
        authenticated: sheetsApi.isAuthenticated,
        spreadsheetId: sheetsApi.spreadsheetId || null,
        hasCredentials: !!process.env.GOOGLE_CREDENTIALS_JSON || fs.existsSync(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json'),
    });
});

app.post('/api/config/spreadsheet', async (req, res) => {
    try {
        const { spreadsheetId } = req.body;
        if (!spreadsheetId) return res.status(400).json({ error: 'spreadsheetId required' });

        sheetsApi.setSpreadsheetId(spreadsheetId);
        await sheetsApi.ensureSheetsExist();

        // Save to .env
        const envPath = path.join(__dirname, '.env');
        try {
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf-8');
            }
            if (envContent.includes('SPREADSHEET_ID=')) {
                envContent = envContent.replace(/SPREADSHEET_ID=.*/, `SPREADSHEET_ID=${spreadsheetId}`);
            } else {
                envContent += `\nSPREADSHEET_ID=${spreadsheetId}`;
            }
            fs.writeFileSync(envPath, envContent, 'utf-8');
        } catch (fsErr) {
            console.log('⚠️ Could not write to .env (expected in serverless environment like Vercel)');
        }
        process.env.SPREADSHEET_ID = spreadsheetId;

        res.json({ success: true, spreadsheetId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config/create', async (req, res) => {
    try {
        if (!sheetsApi.isAuthenticated) {
            return res.status(400).json({ error: 'Not authenticated. Add credentials.json first.' });
        }

        const spreadsheetId = await sheetsApi.createSpreadsheet();

        // Save to .env
        const envPath = path.join(__dirname, '.env');
        try {
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf-8');
            }
            if (envContent.includes('SPREADSHEET_ID=')) {
                envContent = envContent.replace(/SPREADSHEET_ID=.*/, `SPREADSHEET_ID=${spreadsheetId}`);
            } else {
                envContent += `\nSPREADSHEET_ID=${spreadsheetId}`;
            }
            fs.writeFileSync(envPath, envContent, 'utf-8');
        } catch (fsErr) {
            console.log('⚠️ Could not write to .env (expected in serverless environment like Vercel)');
        }
        process.env.SPREADSHEET_ID = spreadsheetId;

        res.json({
            success: true,
            spreadsheetId,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// API: Dashboard / KPIs
// ==========================================
app.get('/api/dashboard', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.json({ error: 'Not configured' });
        const kpis = await sheetsApi.getKPIs();
        res.json(kpis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// API: Leads
// ==========================================
app.get('/api/leads', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.json([]);
        const leads = await sheetsApi.getLeads();
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/leads', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.addLead(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/leads/:rowIndex', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.updateLead(parseInt(req.params.rowIndex), req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/leads/:rowIndex', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.deleteLead(parseInt(req.params.rowIndex));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// API: Transactions
// ==========================================
app.get('/api/transactions', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.json([]);
        const txns = await sheetsApi.getTransactions();
        res.json(txns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.addTransaction(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/transactions/:rowIndex', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.deleteTransaction(parseInt(req.params.rowIndex));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// API: Issues
// ==========================================
app.get('/api/issues', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.json([]);
        const issues = await sheetsApi.getIssues();
        res.json(issues);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/issues', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.addIssue(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/issues/:rowIndex', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.updateIssue(parseInt(req.params.rowIndex), req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/issues/:rowIndex', async (req, res) => {
    try {
        if (!sheetsApi.spreadsheetId) return res.status(400).json({ error: 'Not configured' });
        const result = await sheetsApi.deleteIssue(parseInt(req.params.rowIndex));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// Fallback: serve index.html
// ==========================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// Start Server
// ==========================================
app.listen(port, async () => {
    console.log('');
    console.log('================================================');
    console.log('  🚀 GLOB CRM Server');
    console.log(`  📡 http://localhost:${port}`);
    console.log('================================================');
    console.log('');
    await initializeApp();
});
