/**
 * Google Apps Script for Logistics Dispatch Automation
 * 
 * Deployment Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code.
 * 4. Click "Deploy" > "New Deployment".
 * 5. Select "Web App".
 * 6. Set "Execute as" to "Me".
 * 7. Set "Who has access" to "Anyone".
 * 8. Copy the Web App URL for the Telegram Bot.
 */

const SHEET_NAME = "DispatchSummary";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Initialize headers if sheet is new
      const headers = [
        "dispatch_no", "dispatch_id", "completed_at", "customer_name", 
        "dispatch_executive", "driver_name", "driver_mobile", "vehicle_no", 
        "lr_no", "part_no", "part_name", "boxes", "total_qty", "synced_at", "invoice_no"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }

    const invoiceNo = data.invoice_no;
    const dispatchId = data.dispatch_id;
    const summary = data.summary || [];
    const now = new Date();
    const syncedAt = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");

    // --- DUPLICATE PREVENTION RULES ---
    
    const rows = sheet.getDataRange().getValues();
    const header = rows[0];
    const invoiceColIdx = header.indexOf("invoice_no");
    const dateColIdx = header.indexOf("completed_at");
    const partNameColIdx = header.indexOf("part_name");
    const qtyColIdx = header.indexOf("total_qty");

    // 1. Primary rule: invoice_no
    if (invoiceNo) {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][invoiceColIdx] === invoiceNo) {
          return createResponse(false, true, "Duplicate invoice. Upload cancelled.");
        }
      }
    }

    // 2. Secondary rule: same day + part_name + total_qty
    const requestDate = data.completed_at.split(' ')[0]; // Extract YYYY-MM-DD
    for (let i = 1; i < rows.length; i++) {
      const rowDate = rows[i][dateColIdx].toString().split(' ')[0];
      if (rowDate === requestDate) {
        for (const item of summary) {
          if (rows[i][partNameColIdx] === item.part_name && rows[i][qtyColIdx] == item.total_qty) {
            return createResponse(false, true, "Duplicate detected (Same Day, Part + Qty). Upload cancelled.");
          }
        }
      }
    }

    // --- AUTO INCREMENT dispatch_no ---
    let lastDispatchNo = 0;
    if (rows.length > 1) {
      lastDispatchNo = Math.max(...rows.slice(1).map(r => parseInt(r[0]) || 0));
    }
    const nextDispatchNo = lastDispatchNo + 1;

    // --- APPEND ROWS ---
    const newRows = summary.map(item => [
      nextDispatchNo,
      dispatchId,
      data.completed_at,
      data.customer_name,
      data.dispatch_executive,
      data.driver_name,
      data.driver_mobile,
      data.vehicle_no,
      data.lr_no,
      item.part_no,
      item.part_name,
      item.boxes,
      item.total_qty,
      syncedAt,
      invoiceNo
    ]);

    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);

    return createResponse(true, false, "Success", nextDispatchNo);

  } catch (err) {
    return createResponse(false, false, "Error: " + err.toString());
  }
}

function createResponse(ok, duplicate, message, dispatchNo = null) {
  const res = {
    ok: ok,
    duplicate: duplicate,
    message: message
  };
  if (dispatchNo !== null) res.dispatch_no = dispatchNo;
  
  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}
