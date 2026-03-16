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