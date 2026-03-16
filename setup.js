/* ==========================================
   GLOB CRM - Google Sheets Setup Script
   
   Creates a Google Spreadsheet with:
   - Leads_Pipeline sheet
   - Customer_Transaction sheet
   - Customer_Issue sheet
   
   Each sheet includes headers and sample data.
   
   PREREQUISITES:
   1. Create a Google Cloud project
   2. Enable Google Sheets API & Google Drive API
   3. Create a Service Account and download the JSON key
   4. Save the key file as 'credentials.json' in this folder
   
   USAGE:
   npm install
   npm run setup
   
   Or if you prefer to create manually, see MANUAL_SETUP below.
   ========================================== */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ==========================================
// Configuration
// ==========================================
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const SPREADSHEET_TITLE = 'GLOB CRM Database';

// ==========================================
// Sheet Definitions
// ==========================================

const LEADS_PIPELINE_HEADERS = [
    'Lead_ID',
    'Customer_Name',
    'Company',
    'Product',
    'Qty',
    'Potential_Value',
    'Source',
    'Incoming_Chat_Date',
    'Ask_Product_Date',
    'Ask_Price_Date',
    'Visit_or_Sample_Sent_Date',
    'Closed_Deal_Date',
    'Closed_Issue_Date',
    'Current_Status',
    'Notes',
];

const LEADS_SAMPLE_DATA = [
    ['L-001', 'Ahmad Fauzi', 'PT Maju Sejahtera', 'Chemical A', '500', '75000000', 'WhatsApp', '2025-01-15', '2025-01-16', '2025-01-18', '2025-01-25', '2025-02-01', '', 'Closed Deal', 'Repeat customer'],
    ['L-002', 'Budi Santoso', 'CV Karya Bersama', 'Chemical B', '200', '30000000', 'Website', '2025-01-20', '2025-01-21', '2025-01-23', '', '', '', 'Ask Price', 'Waiting for price approval'],
    ['L-003', 'Citra Dewi', 'PT Global Chemicals', 'Chemical C', '1000', '150000000', 'Email', '2025-02-05', '2025-02-06', '2025-02-08', '2025-02-15', '2025-02-20', '', 'Closed Deal', 'Big order'],
    ['L-004', 'Dani Hermawan', 'PT Industri Nusantara', 'Chemical A', '300', '45000000', 'Exhibition', '2025-02-10', '2025-02-11', '', '', '', '', 'Ask Product', 'Met at trade show'],
    ['L-005', 'Eka Putri', 'CV Sukses Mandiri', 'Chemical D', '150', '22500000', 'Referral', '2025-03-01', '2025-03-02', '2025-03-04', '2025-03-10', '', '2025-03-12', 'Closed Issue', 'Price too high'],
    ['L-006', 'Fajar Rahman', 'PT Tekno Kimia', 'Chemical B', '800', '120000000', 'WhatsApp', '2025-03-05', '2025-03-06', '2025-03-08', '2025-03-15', '2025-03-20', '', 'Closed Deal', 'Rush order'],
    ['L-007', 'Gita Maharani', 'PT Sumber Makmur', 'Chemical E', '250', '37500000', 'LinkedIn', '2025-03-10', '2025-03-11', '2025-03-13', '', '', '', 'Ask Price', 'Comparing with competitors'],
    ['L-008', 'Hendra Wijaya', 'CV Prima Utama', 'Chemical A', '600', '90000000', 'Website', '2025-04-02', '2025-04-03', '', '', '', '', 'Ask Product', 'New customer inquiry'],
    ['L-009', 'Indah Lestari', 'PT Kimia Farma Plus', 'Chemical C', '400', '60000000', 'Email', '2025-04-10', '', '', '', '', '', 'Incoming Chat', 'Initial inquiry via email'],
    ['L-010', 'Joko Susanto', 'PT Abadi Jaya', 'Chemical B', '350', '52500000', 'WhatsApp', '2025-04-15', '2025-04-16', '2025-04-18', '2025-04-25', '', '2025-04-28', 'Closed Issue', 'Could not meet delivery date'],
    ['L-011', 'Kartika Sari', 'CV Bintang Timur', 'Chemical D', '100', '15000000', 'Referral', '2025-05-01', '2025-05-02', '2025-05-04', '2025-05-10', '2025-05-15', '', 'Closed Deal', 'Small trial order'],
    ['L-012', 'Lukman Hakim', 'PT Mega Persada', 'Chemical E', '700', '105000000', 'Exhibition', '2025-05-10', '2025-05-11', '', '', '', '', 'Ask Product', 'Interested in bulk pricing'],
    ['L-013', 'Maya Anggraini', 'PT Aneka Kimia', 'Chemical A', '450', '67500000', 'Website', '2025-06-01', '', '', '', '', '', 'Incoming Chat', 'First contact'],
    ['L-014', 'Nanda Pratama', 'CV Cipta Karya', 'Chemical C', '550', '82500000', 'WhatsApp', '2025-06-10', '2025-06-11', '2025-06-13', '2025-06-20', '2025-06-25', '', 'Closed Deal', 'Standard order'],
    ['L-015', 'Oscar Wijaya', 'PT Sentosa Chemical', 'Chemical B', '900', '135000000', 'LinkedIn', '2025-07-01', '2025-07-02', '2025-07-04', '2025-07-12', '', '', 'Visit / Sample Sent', 'Sample delivered, waiting decision'],
    ['L-016', 'Putri Amalia', 'PT Indo Chemical', 'Chemical D', '200', '30000000', 'Email', '2026-01-10', '2026-01-11', '2026-01-13', '', '', '', 'Ask Price', 'New year inquiry'],
    ['L-017', 'Rizky Maulana', 'CV Perkasa Jaya', 'Chemical A', '350', '52500000', 'WhatsApp', '2026-01-15', '2026-01-16', '2026-01-18', '2026-01-25', '2026-01-30', '', 'Closed Deal', '2026 first deal'],
    ['L-018', 'Siti Nurhaliza', 'PT Gemilang Utama', 'Chemical E', '500', '75000000', 'Referral', '2026-02-05', '2026-02-06', '', '', '', '', 'Ask Product', '2026 new prospect'],
    ['L-019', 'Teguh Prakoso', 'PT Mandiri Chemical', 'Chemical C', '650', '97500000', 'Exhibition', '2026-02-15', '', '', '', '', '', 'Incoming Chat', 'Trade show contact 2026'],
    ['L-020', 'Utami Rahayu', 'CV Bersama Maju', 'Chemical B', '400', '60000000', 'Website', '2026-03-01', '2026-03-02', '2026-03-04', '2026-03-10', '', '2026-03-12', 'Closed Issue', 'Spec mismatch'],
];

const CUSTOMER_TRANSACTION_HEADERS = [
    'Transaction_ID',
    'Company',
    'Date',
    'Value',
    'Total',
    'Product',
];

const TRANSACTION_SAMPLE_DATA = [
    ['TXN-001', 'PT Maju Sejahtera', '2025-02-01', '75000000', '75000000', 'Chemical A'],
    ['TXN-002', 'PT Global Chemicals', '2025-02-20', '150000000', '150000000', 'Chemical C'],
    ['TXN-003', 'PT Tekno Kimia', '2025-03-20', '120000000', '120000000', 'Chemical B'],
    ['TXN-004', 'CV Bintang Timur', '2025-05-15', '15000000', '15000000', 'Chemical D'],
    ['TXN-005', 'CV Cipta Karya', '2025-06-25', '82500000', '82500000', 'Chemical C'],
    ['TXN-006', 'CV Perkasa Jaya', '2026-01-30', '52500000', '52500000', 'Chemical A'],
];

const CUSTOMER_ISSUE_HEADERS = [
    'Issue_ID',
    'Customer_Name',
    'Company',
    'Product',
    'Issue_Date',
    'Issue_Description',
    'Resolution_Status',
    'Notes',
];

const ISSUE_SAMPLE_DATA = [
    ['ISS-001', 'Eka Putri', 'CV Sukses Mandiri', 'Chemical D', '2025-03-12', 'Price too high, customer chose competitor', 'Closed', 'Offered discount for next order'],
    ['ISS-002', 'Joko Susanto', 'PT Abadi Jaya', 'Chemical B', '2025-04-28', 'Could not meet requested delivery date', 'Closed', 'Logistics issue resolved'],
    ['ISS-003', 'Utami Rahayu', 'CV Bersama Maju', 'Chemical B', '2026-03-12', 'Product specification mismatch', 'Open', 'Reviewing alternative products'],
];

// ==========================================
// Google Apps Script for Automation
// ==========================================
const APPS_SCRIPT_CODE = `
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Leads_Pipeline') return;
  
  var row = e.range.getRow();
  if (row <= 1) return; // Skip header
  
  var statusCol = 14; // Current_Status column (N)
  var status = sheet.getRange(row, statusCol).getValue();
  
  if (status === 'Closed Deal') {
    copyToTransaction(sheet, row, e.source);
  } else if (status === 'Closed Issue') {
    copyToIssue(sheet, row, e.source);
  }
}

function copyToTransaction(sourceSheet, row, spreadsheet) {
  var targetSheet = spreadsheet.getSheetByName('Customer_Transaction');
  if (!targetSheet) return;
  
  var data = sourceSheet.getRange(row, 1, 1, 15).getValues()[0];
  var lastRow = targetSheet.getLastRow();
  var txnId = 'TXN-' + String(lastRow).padStart(3, '0');
  
  // Map: Transaction_ID, Company, Date, Value, Total, Product
  var newRow = [
    txnId,
    data[2],  // Company
    data[11], // Closed_Deal_Date
    data[5],  // Potential_Value
    data[5],  // Total (same as value for single transaction)
    data[3],  // Product
  ];
  
  targetSheet.appendRow(newRow);
}

function copyToIssue(sourceSheet, row, spreadsheet) {
  var targetSheet = spreadsheet.getSheetByName('Customer_Issue');
  if (!targetSheet) return;
  
  var data = sourceSheet.getRange(row, 1, 1, 15).getValues()[0];
  var lastRow = targetSheet.getLastRow();
  var issueId = 'ISS-' + String(lastRow).padStart(3, '0');
  
  // Map: Issue_ID, Customer_Name, Company, Product, Issue_Date, Issue_Description, Resolution_Status, Notes
  var newRow = [
    issueId,
    data[1],  // Customer_Name
    data[2],  // Company
    data[3],  // Product
    data[12], // Closed_Issue_Date
    'From pipeline: ' + (data[14] || 'No notes'),  // Issue_Description from Notes
    'Open',   // Resolution_Status
    data[14], // Notes
  ];
  
  targetSheet.appendRow(newRow);
}
`;

// ==========================================
// Main Setup Function
// ==========================================
async function setupSpreadsheet() {
    console.log('');
    console.log('================================================');
    console.log('  GLOB CRM - Google Sheets Setup');
    console.log('================================================');
    console.log('');

    // Check for credentials
    if (!fs.existsSync(CREDENTIALS_FILE)) {
        console.log('❌ credentials.json not found!');
        console.log('');
        console.log('To use this script, you need a Google Service Account:');
        console.log('1. Go to https://console.cloud.google.com/');
        console.log('2. Create a new project (or select existing)');
        console.log('3. Enable "Google Sheets API" and "Google Drive API"');
        console.log('4. Create a Service Account (IAM & Admin > Service Accounts)');
        console.log('5. Create a key (JSON) and save as credentials.json here');
        console.log('');
        console.log('================================================');
        console.log('  MANUAL SETUP (Alternative)');
        console.log('================================================');
        console.log('');
        console.log('If you prefer manual setup:');
        console.log('');
        console.log('1. Create a new Google Spreadsheet');
        console.log('2. Rename Sheet1 to "Leads_Pipeline"');
        console.log('3. Add sheet "Customer_Transaction"');
        console.log('4. Add sheet "Customer_Issue"');
        console.log('');
        console.log('5. Add these headers to Leads_Pipeline (row 1):');
        console.log('   ' + LEADS_PIPELINE_HEADERS.join(' | '));
        console.log('');
        console.log('6. Add these headers to Customer_Transaction (row 1):');
        console.log('   ' + CUSTOMER_TRANSACTION_HEADERS.join(' | '));
        console.log('');
        console.log('7. Add these headers to Customer_Issue (row 1):');
        console.log('   ' + CUSTOMER_ISSUE_HEADERS.join(' | '));
        console.log('');
        console.log('8. Publish: File > Share > Publish to web > Entire Document > Publish');
        console.log('');
        console.log('9. Copy the Spreadsheet ID from URL:');
        console.log('   https://docs.google.com/spreadsheets/d/[THIS_IS_THE_ID]/edit');
        console.log('');
        console.log('10. Paste the ID into config.js SPREADSHEET_ID field');
        console.log('');
        console.log('For automation (auto-copy on status change):');
        console.log('   Go to Extensions > Apps Script');
        console.log('   Paste the code from setup.js APPS_SCRIPT_CODE section');
        console.log('');

        // Generate a template CSV for each sheet
        generateCSVTemplates();
        return;
    }

    try {
        // Authenticate
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_FILE,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive',
            ],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const drive = google.drive({ version: 'v3', auth });

        console.log('✅ Authenticated with Google API');

        // Create spreadsheet
        console.log('📊 Creating spreadsheet...');
        const spreadsheet = await sheets.spreadsheets.create({
            requestBody: {
                properties: { title: SPREADSHEET_TITLE },
                sheets: [
                    { properties: { title: 'Leads_Pipeline' } },
                    { properties: { title: 'Customer_Transaction' } },
                    { properties: { title: 'Customer_Issue' } },
                ],
            },
        });

        const spreadsheetId = spreadsheet.data.spreadsheetId;
        console.log(`✅ Spreadsheet created: ${spreadsheetId}`);

        // Add headers and data to Leads_Pipeline
        console.log('📝 Adding Leads_Pipeline data...');
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Leads_Pipeline!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [LEADS_PIPELINE_HEADERS, ...LEADS_SAMPLE_DATA],
            },
        });

        // Add headers and data to Customer_Transaction
        console.log('📝 Adding Customer_Transaction data...');
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Customer_Transaction!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [CUSTOMER_TRANSACTION_HEADERS, ...TRANSACTION_SAMPLE_DATA],
            },
        });

        // Add headers and data to Customer_Issue
        console.log('📝 Adding Customer_Issue data...');
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Customer_Issue!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [CUSTOMER_ISSUE_HEADERS, ...ISSUE_SAMPLE_DATA],
            },
        });

        // Format header rows (bold, frozen)
        console.log('🎨 Formatting headers...');
        const sheetIds = spreadsheet.data.sheets.map(s => s.properties.sheetId);
        const formatRequests = sheetIds.map(sheetId => ([
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.2, green: 0.3, blue: 0.5 },
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
        ])).flat();

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: formatRequests },
        });

        // Make publicly readable
        console.log('🌐 Publishing spreadsheet...');
        await drive.permissions.create({
            fileId: spreadsheetId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // Update config.js
        console.log('⚙️  Updating config.js...');
        const configPath = path.join(__dirname, 'config.js');
        let configContent = fs.readFileSync(configPath, 'utf-8');
        configContent = configContent.replace(
            "SPREADSHEET_ID: ''",
            `SPREADSHEET_ID: '${spreadsheetId}'`
        );
        fs.writeFileSync(configPath, configContent, 'utf-8');

        console.log('');
        console.log('================================================');
        console.log('  ✅ SETUP COMPLETE!');
        console.log('================================================');
        console.log('');
        console.log(`Spreadsheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
        console.log(`Spreadsheet ID:  ${spreadsheetId}`);
        console.log('');
        console.log('config.js has been updated automatically.');
        console.log('');
        console.log('IMPORTANT: To enable automation (auto-copy on status change):');
        console.log('1. Open the spreadsheet URL above');
        console.log('2. Go to Extensions > Apps Script');
        console.log('3. Replace the code with the following:');
        console.log('');
        console.log(APPS_SCRIPT_CODE);
        console.log('');
        console.log('4. Save and authorize the script');
        console.log('');
        console.log('Now open index.html in your browser to see the dashboard!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// ==========================================
// Generate CSV Templates (for manual setup)
// ==========================================
function generateCSVTemplates() {
    console.log('📁 Generating CSV template files...');
    console.log('');

    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
    }

    // Leads Pipeline CSV
    const leadsCSV = [LEADS_PIPELINE_HEADERS.join(',')];
    LEADS_SAMPLE_DATA.forEach(row => {
        leadsCSV.push(row.map(v => `"${v}"`).join(','));
    });
    fs.writeFileSync(path.join(templatesDir, 'Leads_Pipeline.csv'), leadsCSV.join('\n'), 'utf-8');

    // Transaction CSV
    const transCSV = [CUSTOMER_TRANSACTION_HEADERS.join(',')];
    TRANSACTION_SAMPLE_DATA.forEach(row => {
        transCSV.push(row.map(v => `"${v}"`).join(','));
    });
    fs.writeFileSync(path.join(templatesDir, 'Customer_Transaction.csv'), transCSV.join('\n'), 'utf-8');

    // Issue CSV
    const issueCSV = [CUSTOMER_ISSUE_HEADERS.join(',')];
    ISSUE_SAMPLE_DATA.forEach(row => {
        issueCSV.push(row.map(v => `"${v}"`).join(','));
    });
    fs.writeFileSync(path.join(templatesDir, 'Customer_Issue.csv'), issueCSV.join('\n'), 'utf-8');

    console.log('✅ Templates saved to ./templates/ folder:');
    console.log('   - templates/Leads_Pipeline.csv');
    console.log('   - templates/Customer_Transaction.csv');
    console.log('   - templates/Customer_Issue.csv');
    console.log('');
    console.log('You can import these into Google Sheets:');
    console.log('1. Create a new Google Spreadsheet');
    console.log('2. File > Import > Upload each CSV file');
    console.log('3. Or just copy-paste the data');

    // Also save the Apps Script code
    fs.writeFileSync(path.join(templatesDir, 'AppsScript.gs'), APPS_SCRIPT_CODE.trim(), 'utf-8');
    console.log('   - templates/AppsScript.gs (for Extensions > Apps Script)');
    console.log('');
}

// Run
setupSpreadsheet();
