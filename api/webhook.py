import os
import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ForceReply
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes

# --- CONFIGURATION ---
# These should be set in Vercel Environment Variables
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
GAS_WEBHOOK_URL = os.environ.get("GAS_WEBHOOK_URL")
# ---------------------

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Initialize Telegram Application
# We use a global application instance for serverless
telegram_app = Application.builder().token(BOT_TOKEN).build()

@app.route('/api/webhook', methods=['POST'])
async def webhook():
    """Handle incoming Telegram updates via Webhook"""
    if request.method == "POST":
        update = Update.de_json(request.get_json(force=True), telegram_app.bot)
        await telegram_app.process_update(update)
        return "ok", 200
    return "error", 400

@app.route('/api/dispatch', methods=['POST'])
async def receive_dispatch():
    """
    Handle incoming dispatch data and Excel file from the mobile app.
    """
    try:
        # Handle multipart/form-data
        if 'data' not in request.form:
            return jsonify({"ok": False, "error": "Missing 'data' field"}), 400
        
        data = json.loads(request.form['data'])
        excel_file = request.files.get('excel')
        
        chat_id = os.environ.get("TELEGRAM_CHAT_ID")
        if not chat_id:
            return jsonify({"ok": False, "error": "TELEGRAM_CHAT_ID not set"}), 500

        # Calculate total boxes
        total_boxes = sum(item.get('boxes', 0) for item in data.get('summary', []))
        parts_count = len(data.get('summary', []))

        # Format the message text
        message_text = (
            f"📦 *Dispatch Ready*\n\n"
            f"🚚 *Dispatch ID:* `{data['dispatch_id']}`\n"
            f"🏭 *Customer:* {data['customer_name']}\n"
            f"📦 *Total Boxes:* {total_boxes}\n"
            f"🚛 *Vehicle:* {data['vehicle_no']}\n"
            f"📄 *LR No:* {data['lr_no']}\n"
            f"👤 *Driver:* {data['driver_name']}\n"
            f"📎 *Parts:* {parts_count} items\n\n"
            f"---DATA---\n"
            f"{json.dumps(data)}"
        )

        # Create the inline button
        keyboard = [[InlineKeyboardButton("🚀 Upload to Spreadsheet", callback_data=f"upload_{data['dispatch_id']}")]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Send as document if file is present, otherwise as message
        if excel_file:
            # We need to read the file into bytes for Telegram
            file_bytes = excel_file.read()
            await telegram_app.bot.send_document(
                chat_id=chat_id,
                document=file_bytes,
                filename=excel_file.filename or "dispatch.xlsx",
                caption=message_text,
                parse_mode='Markdown',
                reply_markup=reply_markup
            )
        else:
            await telegram_app.bot.send_message(
                chat_id=chat_id,
                text=message_text,
                parse_mode='Markdown',
                reply_markup=reply_markup
            )

        return jsonify({"ok": True}), 200
    except Exception as e:
        print(f"Error in receive_dispatch: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the 'Upload to Spreadsheet' button click"""
    query = update.callback_query
    await query.answer()

    # Ask for invoice number using ForceReply
    # This ensures the user's next message is a reply to this one
    await query.message.reply_text(
        "📝 Please enter *Invoice Number* for this dispatch:",
        parse_mode='Markdown',
        reply_markup=ForceReply(selective=True)
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the user's reply with the invoice number"""
    if not update.message.reply_to_message:
        return

    # Check if this is a reply to our "Please enter Invoice Number" message
    reply_to = update.message.reply_to_message
    if "Please enter Invoice Number" not in reply_to.text:
        return

    invoice_no = update.message.text.strip()
    
    # The original dispatch message is the parent of the ForceReply message
    # Wait, actually the ForceReply is a separate message. 
    # We need to find the original dispatch message.
    # In Telegram, the ForceReply message is a reply to the original message? 
    # No, it's just a message. But we can find the original message by looking at the reply_to_message's reply_to_message?
    # Actually, it's easier: the original message is the one that HAS the data.
    # Let's assume the user replied to the ForceReply message.
    
    # We need to find the original message with the ---DATA--- block.
    # We can look at the chat history or just assume the ForceReply was sent by the bot 
    # and the user is replying to it.
    
    # To be robust, we'll look for the message that the ForceReply was replying to.
    original_msg = reply_to.reply_to_message
    if not original_msg or "---DATA---" not in original_msg.text:
        # Fallback: maybe the ForceReply wasn't a reply? 
        # Let's try to find the last message with data in this chat.
        await update.message.reply_text("❌ Could not find dispatch context. Please try clicking the button again.")
        return

    # Parse the data from the original message
    try:
        data_part = original_msg.text.split("---DATA---")[1].strip()
        dispatch_data = json.loads(data_part)
    except Exception as e:
        await update.message.reply_text(f"❌ Error parsing dispatch data: {e}")
        return

    # Add the invoice number to the payload
    dispatch_data['invoice_no'] = invoice_no

    # Send to Google Apps Script
    try:
        res = requests.post(GAS_WEBHOOK_URL, json=dispatch_data)
        res_data = res.json()

        if res_data.get('ok'):
            # Success! Edit the original message
            dispatch_no = res_data.get('dispatch_no')
            new_text = (
                f"✅ *Uploaded to Sheet*\n\n"
                f"📦 *Dispatch No:* `{dispatch_no}`\n"
                f"🚚 *Dispatch ID:* `{dispatch_data['dispatch_id']}`\n"
                f"🏭 *Customer:* {dispatch_data['customer_name']}\n"
                f"📄 *Invoice:* `{invoice_no}`\n"
                f"🚛 *Vehicle:* {dispatch_data['vehicle_no']}"
            )
            # Edit the original message (remove button)
            await original_msg.edit_text(text=new_text, parse_mode='Markdown', reply_markup=None)
            await update.message.reply_text(f"✅ Success! Dispatch No: {dispatch_no}")
        
        elif res_data.get('duplicate'):
            await update.message.reply_text(f"❌ *Duplicate Invoice Found*\nUpload Cancelled\n\n_{res_data.get('message')}_", parse_mode='Markdown')
        
        else:
            await update.message.reply_text(f"❌ *Upload Failed*\n{res_data.get('message')}", parse_mode='Markdown')

    except Exception as e:
        await update.message.reply_text(f"❌ *System Error*\n{str(e)}", parse_mode='Markdown')

# Register handlers
telegram_app.add_handler(CallbackQueryHandler(handle_callback, pattern="^upload_"))
telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

if __name__ == "__main__":
    # For local testing
    app.run(port=5000)
