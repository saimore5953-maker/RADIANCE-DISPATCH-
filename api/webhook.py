import os
import json
import requests
import asyncio
from flask import Flask, request, jsonify
from flask_cors import CORS
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ForceReply, Bot
from telegram.ext import Application, CallbackQueryHandler, MessageHandler, filters, ContextTypes

# --- CONFIGURATION ---
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
GAS_WEBHOOK_URL = os.environ.get("GAS_WEBHOOK_URL")
# ---------------------

app = Flask(__name__)
CORS(app)

# Initialize Bot for direct sending (faster for mobile app requests)
bot = Bot(token=BOT_TOKEN)

# Initialize Application for webhook handling
# We disable the updater and job_queue as they are not needed in serverless
telegram_app = Application.builder().token(BOT_TOKEN).updater(None).build()

# Flag to ensure application is initialized only once per instance
_initialized = False

async def get_application():
    global _initialized
    if not _initialized:
        await telegram_app.initialize()
        _initialized = True
    return telegram_app

@app.route('/api/webhook', methods=['POST'])
async def webhook():
    """Handle incoming Telegram updates via Webhook"""
    try:
        application = await get_application()
        data = request.get_json(force=True)
        update = Update.de_json(data, application.bot)
        await application.process_update(update)
        return "ok", 200
    except Exception as e:
        print(f"Webhook Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/dispatch', methods=['POST'])
async def receive_dispatch():
    """
    Handle incoming dispatch data and Excel file from the mobile app.
    Optimized for Vercel serverless execution.
    """
    try:
        # Handle multipart/form-data
        if 'data' not in request.form:
            return jsonify({"ok": False, "error": "Missing 'data' field"}), 400
        
        data = json.loads(request.form['data'])
        excel_file = request.files.get('excel')
        
        chat_id = os.environ.get("TELEGRAM_CHAT_ID")
        if not chat_id:
            return jsonify({"ok": False, "error": "TELEGRAM_CHAT_ID not set in environment"}), 500

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

        # Send as document if file is present
        if excel_file:
            file_bytes = excel_file.read()
            await bot.send_document(
                chat_id=chat_id,
                document=file_bytes,
                filename=excel_file.filename or "dispatch.xlsx",
                caption=message_text,
                parse_mode='Markdown',
                reply_markup=reply_markup
            )
        else:
            await bot.send_message(
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
    await query.message.reply_text(
        "📝 Please enter *Invoice Number* for this dispatch:",
        parse_mode='Markdown',
        reply_markup=ForceReply(selective=True)
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the user's reply with the invoice number"""
    if not update.message or not update.message.reply_to_message:
        return

    reply_to = update.message.reply_to_message
    # Check if this is a reply to our "Please enter Invoice Number" message
    if not reply_to.text or "Please enter Invoice Number" not in reply_to.text:
        return

    invoice_no = update.message.text.strip()
    
    # The original dispatch message is the one the ForceReply was replying to
    original_msg = reply_to.reply_to_message
    
    # Robust check for the data block
    if not original_msg or not original_msg.caption and not original_msg.text:
        await update.message.reply_text("❌ Context lost. Please click the 'Upload' button again.")
        return

    msg_content = original_msg.caption if original_msg.caption else original_msg.text
    
    if "---DATA---" not in msg_content:
        await update.message.reply_text("❌ Dispatch data not found in message history.")
        return

    # Parse the data from the original message
    try:
        data_part = msg_content.split("---DATA---")[1].strip()
        dispatch_data = json.loads(data_part)
    except Exception as e:
        await update.message.reply_text(f"❌ Error parsing data: {str(e)}")
        return

    # Add the invoice number to the payload
    dispatch_data['invoice_no'] = invoice_no

    # Send to Google Apps Script
    try:
        res = requests.post(GAS_WEBHOOK_URL, json=dispatch_data, timeout=15)
        res_data = res.json()

        if res_data.get('ok'):
            dispatch_no = res_data.get('dispatch_no')
            new_text = (
                f"✅ *Uploaded to Sheet*\n\n"
                f"📦 *Dispatch No:* `{dispatch_no}`\n"
                f"🚚 *Dispatch ID:* `{dispatch_data['dispatch_id']}`\n"
                f"🏭 *Customer:* {dispatch_data['customer_name']}\n"
                f"📄 *Invoice:* `{invoice_no}`\n"
                f"🚛 *Vehicle:* {dispatch_data['vehicle_no']}"
            )
            
            # Update the original message (remove button and data block)
            if original_msg.caption:
                await original_msg.edit_caption(caption=new_text, parse_mode='Markdown', reply_markup=None)
            else:
                await original_msg.edit_text(text=new_text, parse_mode='Markdown', reply_markup=None)
                
            await update.message.reply_text(f"✅ Success! Master Sheet Updated (No: {dispatch_no})")
        
        elif res_data.get('duplicate'):
            await update.message.reply_text(f"⚠️ *Duplicate Detected*\n{res_data.get('message')}", parse_mode='Markdown')
        else:
            await update.message.reply_text(f"❌ *Upload Failed*\n{res_data.get('message')}", parse_mode='Markdown')

    except Exception as e:
        await update.message.reply_text(f"❌ *System Error*\n{str(e)}", parse_mode='Markdown')

# Register handlers
telegram_app.add_handler(CallbackQueryHandler(handle_callback, pattern="^upload_"))
telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

if __name__ == "__main__":
    app.run(port=5000)
