/* ==========================================
   GLOB CRM - Configuration
   ==========================================
   
   HOW TO USE:
   1. Create a Google Spreadsheet (or run setup.js)
   2. The spreadsheet must have 3 sheets:
      - Leads_Pipeline
      - Customer_Transaction
      - Customer_Issue
   3. Publish the spreadsheet: File → Share → Publish to web → Entire Document → Publish
   4. Copy the Spreadsheet ID from the URL:
      https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   5. Paste it below
   ========================================== */

const CONFIG = {
    // Paste your Google Spreadsheet ID here
    SPREADSHEET_ID: '',

    // Sheet names (must match exactly)
    SHEETS: {
        LEADS_PIPELINE: 'Leads_Pipeline',
        CUSTOMER_TRANSACTION: 'Customer_Transaction',
        CUSTOMER_ISSUE: 'Customer_Issue',
    },

    // Auto-refresh interval in milliseconds (60 seconds)
    REFRESH_INTERVAL: 60000,

    // CRM Pipeline stages in order
    PIPELINE_STAGES: [
        'Incoming Chat',
        'Ask Product',
        'Ask Price',
        'Visit / Sample Sent',
        'Closed Deal',
        'Closed Issue',
    ],

    // Pipeline stage colors
    PIPELINE_COLORS: {
        'Incoming Chat': '#3b82f6',
        'Ask Product': '#8b5cf6',
        'Ask Price': '#f59e0b',
        'Visit / Sample Sent': '#14b8a6',
        'Closed Deal': '#10b981',
        'Closed Issue': '#ef4444',
    },
};
