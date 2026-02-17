
/**
 * GOOGLE APPS SCRIPT - DISPATCH MANAGEMENT WEBHOOK
 * 
 * This script assigns sequential Dispatch Numbers and daily Dispatch IDs.
 * It also prevents duplicates on the same day for Part Name + Total Qty.
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0]; 
    
    // 1. DUPLICATE PREVENTION: Check for Same Day, same Part Name + Total Qty
    if (isDuplicateToday(sheet, body.summary)) {
      return ContentService.createTextOutput(JSON.stringify({ 
        ok: true, 
        duplicate: true, 
        message: "Duplicate entry for today (Part + Qty already exists)" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. GENERATE DISPATCH IDs
    var ids = generateNextIds(sheet);
    var nextNo = ids.nextNo;
    var dispatchId = ids.dispatchId;

    // 3. PREPARE ROWS
    var timestampStr = safeFormatDateTime(body.completed_at);
    var rowsToAppend = [];
    body.summary.forEach(function(item) {
      rowsToAppend.push([
        nextNo,
        dispatchId,
        timestampStr,
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

    // 4. APPEND DATA
    rowsToAppend.forEach(function(row) {
      sheet.appendRow(row);
    });

    // 5. RETURN ASSIGNED IDs
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: true, 
      dispatch_no: nextNo, 
      dispatch_id: dispatchId, 
      rows: rowsToAppend.length 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: false, 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Checks if any part in the incoming dispatch matches a part name + qty uploaded today.
 */
function isDuplicateToday(sheet, summaryItems) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues(); // Check first 13 columns
  
  for (var i = 0; i < summaryItems.length; i++) {
    var item = summaryItems[i];
    
    var isDup = data.some(function(row) {
      var rowDate = row[2]; // Column C: Date
      var rowPartName = row[10]; // Column K: Part Name
      var rowQty = row[12]; // Column M: Total Qty
      
      var formattedRowDate = (rowDate instanceof Date) 
        ? Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "dd/MM/yyyy")
        : String(rowDate).split(' ')[0]; // Basic check
      
      return formattedRowDate === today && 
             String(rowPartName).trim() === String(item.part_name).trim() && 
             Number(rowQty) === Number(item.total_qty);
    });
    
    if (isDup) return true;
  }
  return false;
}

/**
 * Generates the next sequential Dispatch No and daily formatted ID.
 */
function generateNextIds(sheet) {
  const lastRow = sheet.getLastRow();
  let nextNo = 1;
  let dailySeq = 1;
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyMMdd");
  const todayPrefix = "DSP-" + dateStr;

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    
    // Global max Dispatch No (Column A)
    const nos = values.map(function(r) { return Number(r[0]); }).filter(function(n) { return !isNaN(n); });
    if (nos.length > 0) nextNo = Math.max.apply(null, nos) + 1;
    
    // Daily Seq (Column B)
    const ids = values.map(function(r) { return String(r[1]); });
    const todayIds = ids.filter(function(id) { return id.indexOf(todayPrefix) === 0; });
    if (todayIds.length > 0) {
      const seqs = todayIds.map(function(id) {
        var parts = id.split('-');
        return Number(parts[parts.length - 1]);
      }).filter(function(s) { return !isNaN(s); });
      dailySeq = Math.max.apply(null, seqs) + 1;
    }
  }
  
  const dispatchId = todayPrefix + "-" + String(dailySeq).padStart(2, '0');
  return { nextNo: nextNo, dispatchId: dispatchId };
}

/**
 * Safe date formatter.
 */
function safeFormatDateTime(value) {
  try {
    if (!value) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    var d = (value instanceof Date) ? value : new Date(value);
    if (isNaN(d.getTime())) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  } catch (e) {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  }
}
