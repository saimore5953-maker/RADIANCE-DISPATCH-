
/**
 * GOOGLE APPS SCRIPT - PRODUCTION READY DISPATCH WEBHOOK
 * 
 * Replace your existing Google Apps Script code with this version.
 * This version uses a robust idempotency check to allow appending data 
 * to non-empty sheets without duplication.
 */

function doPost(e) {
  try {
    // 1. Parse incoming JSON
    var body = JSON.parse(e.postData.contents);
    Logger.log("Incoming dispatch_id: " + body.dispatch_id);

    // 2. Select the first sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0]; 
    
    // 3. IDEMPOTENCY CHECK (Skip if already uploaded)
    var dispatchId = body.dispatch_id;
    if (dispatchIdExists_(sheet, dispatchId)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, skipped: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Prepare summary rows
    var rowsToAppend = [];
    body.summary.forEach(function(item) {
      rowsToAppend.push([
        body.dispatch_no,
        body.dispatch_id,
        safeFormatDateTime(body.completed_at),
        body.customer_name,
        body.dispatch_executive,
        body.driver_name,
        body.driver_mobile,
        body.vehicle_no,
        body.lr_no,
        item.part_no,
        item.part_name,
        item.boxes,
        item.total_qty
      ]);
    });

    // 5. APPEND NEW DATA
    rowsToAppend.forEach(function(row) {
      sheet.appendRow(row);
    });

    // 6. Return Success
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: true, 
      id: body.dispatch_id, 
      rows: rowsToAppend.length 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // Return Error
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: false, 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Targeted check for existing dispatch ID in Column B (exact match)
 */
function dispatchIdExists_(sheet, dispatchId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false; // only header exists

  // Column B = dispatch_id
  const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();

  for (const [cell] of values) {
    if (String(cell).trim() === String(dispatchId).trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Robust date formatting for Excel/Sheets.
 * Handles ISO strings and raw dates safely.
 */
function safeFormatDateTime(value) {
  try {
    if (!value) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    }
    var d = (value instanceof Date) ? value : new Date(value);
    if (isNaN(d.getTime())) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    }
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  } catch (e) {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  }
}
