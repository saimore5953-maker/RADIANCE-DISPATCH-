import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import multer from "multer";

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// ---------------------

app.use(cors());
app.use(express.json());

// Unified endpoint for Telegram Webhooks AND Mobile App Dispatches
app.post('/api/webhook', upload.single('excel'), async (req, res) => {
  try {
    // 1. Check if this is a Dispatch from the Mobile App (Multipart Form)
    if (req.body.data) {
      const data = JSON.parse(req.body.data);
      const excelFile = req.file;
      
      // Use credentials from request if not in server environment
      const token = data.bot_token || BOT_TOKEN;
      const chat_id = data.chat_id || CHAT_ID;

      if (!token || !chat_id) {
        return res.status(400).json({ ok: false, error: "Telegram Bot Token or Chat ID not provided in request or server settings" });
      }

      const totalBoxes = data.summary.reduce((acc: number, s: any) => acc + s.boxes, 0);
      const messageText = `📦 *Dispatch Ready*\n\n🚚 *ID:* \`${data.dispatch_id}\`\n🏭 *Customer:* ${data.customer_name}\n📦 *Boxes:* ${totalBoxes}\n🚛 *Vehicle:* ${data.vehicle_no}\n\n---DATA---\n${JSON.stringify(data)}`;
      
      const keyboard = {
        inline_keyboard: [[{ text: "🚀 Upload to Spreadsheet", callback_data: `upload_${data.dispatch_id}` }]]
      };

      if (excelFile) {
        const formData = new FormData();
        formData.append('chat_id', chat_id);
        // Use a proper Blob with a filename for Telegram
        const fileBlob = new Blob([excelFile.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        formData.append('document', fileBlob, excelFile.originalname || "dispatch.xlsx");
        formData.append('caption', messageText);
        formData.append('parse_mode', 'Markdown');
        formData.append('reply_markup', JSON.stringify(keyboard));

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: 'POST',
          body: formData
        });
        const tgData: any = await tgRes.json();
        if (!tgData.ok) throw new Error(tgData.description || 'Telegram API Error');
      } else {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat_id,
            text: messageText,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          })
        });
        const tgData: any = await tgRes.json();
        if (!tgData.ok) throw new Error(tgData.description || 'Telegram API Error');
      }
      return res.json({ ok: true });
    }

    // 2. Otherwise, treat it as a Telegram Update (JSON)
    const update: any = req.body;
    
    // Handle Callback Query (Button Click)
    if (update.callback_query) {
      const query = update.callback_query;
      const callbackData = query.data;

      if (callbackData.startsWith('upload_')) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: query.id })
        });

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: query.message.chat.id,
            text: "📝 Please enter *Invoice Number* for this dispatch:",
            parse_mode: 'Markdown',
            reply_markup: { force_reply: true, selective: true }
          })
        });
      }
      return res.send("ok");
    }

    // Handle Message (Invoice Number Entry)
    if (update.message && update.message.reply_to_message) {
      const replyTo = update.message.reply_to_message;
      if (replyTo.text && replyTo.text.includes("Please enter Invoice Number")) {
        const invoiceNo = update.message.text.trim();
        const originalMsg = replyTo.reply_to_message;
        
        if (!originalMsg) return res.send("ok");
        
        const msgContent = originalMsg.caption || originalMsg.text || "";
        if (!msgContent.includes("---DATA---")) return res.send("ok");

        const dataPart = msgContent.split("---DATA---")[1].trim();
        const dispatchData = JSON.parse(dataPart);
        dispatchData.invoice_no = invoiceNo;

        if (!GAS_WEBHOOK_URL) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: update.message.chat.id, text: "❌ GAS Webhook URL not set in AI Studio Settings" })
          });
          return res.send("ok");
        }

        const gasRes = await fetch(GAS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dispatchData)
        });
        const gasData: any = await gasRes.json();

        if (gasData.ok) {
          const newText = `✅ *Uploaded to Sheet*\n\n📦 *Dispatch No:* \`${gasData.dispatch_no}\`\n🚚 *Dispatch ID:* \`${dispatchData.dispatch_id}\`\n🏭 *Customer:* ${dispatchData.customer_name}\n📄 *Invoice:* \`${invoiceNo}\``;
          
          const editMethod = originalMsg.caption ? 'editMessageCaption' : 'editMessageText';
          const editPayload: any = {
            chat_id: update.message.chat.id,
            message_id: originalMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: null
          };
          if (originalMsg.caption) editPayload.caption = newText;
          else editPayload.text = newText;

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${editMethod}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editPayload)
          });
          
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: update.message.chat.id, text: `✅ Success! Master Sheet Updated (No: ${gasData.dispatch_no})` })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: update.message.chat.id, text: `❌ Upload Failed: ${gasData.message}` })
          });
        }
      }
    }

    res.send("ok");
  } catch (error: any) {
    console.error('Bot Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
