
/**
 * GOOGLE APPS SCRIPT - ROBUST DATE FORMATTING
 * Copy and paste these helper functions into your Google Apps Script project.
 */

function safeFormatDateTime(value) {
  try {
    // 1. Handle missing or empty values
    if (!value) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    }

    // 2. Handle Date objects vs Strings
    const d = (value instanceof Date) ? value : new Date(value);

    // 3. Handle invalid date strings
    if (isNaN(d.getTime())) {
      return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    }

    // 4. Return the human-readable format
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  } catch (e) {
    // 5. Fallback to current time if anything fails
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  }
}

/**
 * Example usage in your doPost(e) function:
 * 
 * var body = JSON.parse(e.postData.contents);
 * Logger.log("Incoming dispatch_id: " + body.dispatch_id);
 * 
 * var row = [
 *   body.dispatch_no,
 *   body.dispatch_id,
 *   safeFormatDateTime(body.completed_at), // Use the safe formatter here
 *   body.customer_name,
 *   // ... rest of your columns
 * ];
 */
