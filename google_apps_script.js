/**
 * GOOGLE APPS SCRIPT - DISPATCH MANAGEMENT (HOLD & FINALIZE)
 * 
 * This script handles two actions:
 * 1. 'hold': Saves dispatch data to a "Hold List" sheet.
 * 2. 'finalize': Moves data from "Hold List" to "Main Sheet" and adds Invoice No.
 */

const HOLD_SHEET = "Hold List";
const MAIN_SHEET = "Main Sheet";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = data.action; // 'hold' or 'finalize'

    if (action === 'hold') {
      return handleHold(ss, data);
    } else if (action === 'finalize') {
      return handleFinalize(ss, data);
    } else {
      return createResponse(false, "Invalid action");
    }
  } catch (err) {
    return createResponse(false, "Error: " + err.toString());
  }
}

function handleHold(ss, data) {
  let sheet = ss.getSheetByName(HOLD_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(HOLD_SHEET);
    const headers = [
      "Dispatch No", "Dispatch ID", "Date", "Customer", "Executive", 
      "Driver", "Mobile", "Vehicle", "LR No", "Part No", 
      "Part Name", "Per Box Qty", "Boxes", "Total Qty", "Synced At"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  const summary = data.summary || [];
  const now = new Date();
  const syncedAt = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");

  // Auto-increment Dispatch No
  const lastRow = sheet.getLastRow();
  let nextNo = 1;
  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    nextNo = Math.max(...values.map(r => parseInt(r[0]) || 0)) + 1;
  }

  const newRows = summary.map(item => [
    nextNo,
    data.dispatch_id,
    data.completed_at || syncedAt,
    data.customer_name,
    data.dispatch_executive,
    data.driver_name,
    data.driver_mobile,
    data.vehicle_no,
    data.lr_no,
    item.part_no,
    item.part_name,
    item.per_box_qty, // New Column
    item.boxes,
    item.total_qty,
    syncedAt
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  return createResponse(true, "Added to Hold List", nextNo);
}

function handleFinalize(ss, data) {
  const holdSheet = ss.getSheetByName(HOLD_SHEET);
  let mainSheet = ss.getSheetByName(MAIN_SHEET);
  
  if (!holdSheet) return createResponse(false, "Hold List sheet not found");
  
  if (!mainSheet) {
    mainSheet = ss.insertSheet(MAIN_SHEET);
    const headers = [
      "Dispatch No", "Dispatch ID", "Date", "Customer", "Executive", 
      "Driver", "Mobile", "Vehicle", "LR No", "Part No", 
      "Part Name", "Per Box Qty", "Boxes", "Total Qty", "Synced At", "Invoice No"
    ];
    mainSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    mainSheet.setFrozenRows(1);
  }

  const dispatchId = data.dispatch_id;
  const invoiceNo = data.invoice_no;
  const holdData = holdSheet.getDataRange().getValues();
  const rowsToMove = [];
  const rowsToDelete = [];

  // Find rows in Hold List matching Dispatch ID
  for (let i = 1; i < holdData.length; i++) {
    if (holdData[i][1] === dispatchId) {
      const row = holdData[i].slice(); // Copy row
      row.push(invoiceNo); // Add Invoice No
      rowsToMove.push(row);
      rowsToDelete.push(i + 1);
    }
  }

  if (rowsToMove.length === 0) return createResponse(false, "No data found for ID: " + dispatchId);

  // Auto-increment Dispatch No for Main Sheet
  const lastMainRow = mainSheet.getLastRow();
  let nextMainNo = 1;
  if (lastMainRow > 1) {
    const mainValues = mainSheet.getRange(2, 1, lastMainRow - 1, 1).getValues();
    nextMainNo = Math.max(...mainValues.map(r => parseInt(r[0]) || 0)) + 1;
  }

  // Update Dispatch No to Main Sheet's sequence
  rowsToMove.forEach(row => row[0] = nextMainNo);

  // Append to Main Sheet
  mainSheet.getRange(mainSheet.getLastRow() + 1, 1, rowsToMove.length, rowsToMove[0].length).setValues(rowsToMove);

  // Delete from Hold List (bottom-up to preserve indices)
  rowsToDelete.reverse().forEach(rowIdx => holdSheet.deleteRow(rowIdx));

  return createResponse(true, "Moved to Main Sheet", nextMainNo);
}

function createResponse(ok, message, dispatchNo = null) {
  const res = { ok: ok, message: message };
  if (dispatchNo !== null) res.dispatch_no = dispatchNo;
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}
