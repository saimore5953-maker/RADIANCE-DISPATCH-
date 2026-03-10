import express from "express";
import cors from "cors";
import multer from "multer";

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

// --- DEBUG LOGS ---
let logs: string[] = [];
const addLog = (msg: string) => {
  logs.push(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`);
  if (logs.length > 20) logs.shift();
};
// ------------------

// --- CONFIGURATION ---
// IMPORTANT: On Vercel, these MUST be set in the Dashboard Environment Variables
// because serverless functions are stateless and will "forget" values set at runtime.
const getBotToken = (reqBody?: any) => reqBody?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
const getGasUrl = (reqBody?: any) => reqBody?.gas_url || process.env.GAS_WEBHOOK_URL;
const getChatId = (reqBody?: any) => reqBody?.chat_id || process.env.TELEGRAM_CHAT_ID;
// ---------------------

app.use(cors());
app.use(express.json());

// Status check for debugging
app.get('/api/webhook', (req, res) => {
  res.json({ 
    status: "Bot Server is Running", 
    time: new Date().toISOString(),
    logs: logs,
    config: {
      has_token: !!process.env.TELEGRAM_BOT_TOKEN,
      has_chat_id: !!process.env.TELEGRAM_CHAT_ID,
      has_gas_url: !!process.env.GAS_WEBHOOK_URL
    }
  });
});

// Endpoint to register webhook (Server-side to avoid CORS/Encoding issues)
app.post('/api/setup-webhook', async (req, res) => {
  try {
    const { token, url, gas_url, chat_id } = req.body;
    if (!token || !url) return res.status(400).json({ ok: false, error: "Missing token or url" });
    
    // Append credentials to URL for total statelessness
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    urlObj.searchParams.set('token', token);
    if (gas_url) urlObj.searchParams.set('gas', gas_url);
    if (chat_id) urlObj.searchParams.set('chat', chat_id);
    
    const finalUrl = urlObj.toString();
    
    addLog(`Setting Webhook: ${finalUrl}`);
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(finalUrl)}`);
    const data = await tgRes.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Unified endpoint for Telegram Webhooks AND Mobile App Dispatches
app.post('/api/webhook', upload.single('excel'), async (req, res) => {
  const update = req.body || {};
  const token = (req.query.token as string) || getBotToken(update.data ? JSON.parse(update.data) : update);
  const gas_url = (req.query.gas as string) || getGasUrl(update.data ? JSON.parse(update.data) : update);
  const chat_id = (req.query.chat as string) || getChatId(update.data ? JSON.parse(update.data) : update);

  try {
    addLog(`Webhook: ${req.headers['content-type']} | Body: ${!!req.body}`);
    if (update.callback_query) addLog(`Callback: ${update.callback_query.data}`);
    if (update.message) addLog(`Message: ${update.message.text?.substring(0, 20)}`);
    
    // 1. MOBILE APP DISPATCH
    if (req.body.data) {
      const data = JSON.parse(req.body.data);
      const excelFile = req.file;
      
      if (!token || !chat_id) {
        return res.status(400).json({ ok: false, error: "Missing Telegram Credentials (Token/ChatID). Set them in Vercel Env Vars." });
      }

      // A. SEND TO GOOGLE SHEET (HOLD LIST)
      if (gas_url) {
        try {
          await fetch(gas_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, action: 'hold' })
          });
        } catch (e: any) {
          addLog("GAS Hold Error: " + e.message);
        }
      }

      // B. SEND TO TELEGRAM
      const totalBoxes = data.summary.reduce((acc: number, s: any) => acc + s.boxes, 0);
      const messageText = `🚚 <b>RADIANCE DISPATCH</b>\n\n` +
                          `📦 <b>Dispatch ID:</b> <code>${data.dispatch_id}</code>\n` +
                          `🏢 <b>Customer:</b> ${data.customer_name}\n` +
                          `📦 <b>Total Boxes:</b> ${totalBoxes}\n\n` +
                          `🚛 <b>Vehicle:</b> ${data.vehicle_no}\n` +
                          `📄 <b>LR No:</b> ${data.lr_no || 'N/A'}\n\n` +
                          `📎 <b>Packing Slip:</b> ${excelFile ? excelFile.originalname : 'N/A'}`;
      
      const keyboard = {
        inline_keyboard: [[{ text: "✅ Finalize Dispatch", callback_data: `finalize_${data.dispatch_id}` }]]
      };

      if (excelFile) {
        const formData = new FormData();
        formData.append('chat_id', chat_id);
        const fileBlob = new Blob([excelFile.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        formData.append('document', fileBlob, excelFile.originalname || "dispatch.xlsx");
        formData.append('caption', messageText);
        formData.append('parse_mode', 'HTML');
        formData.append('reply_markup', JSON.stringify(keyboard));

        await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: formData });
      } else {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat_id, text: messageText, parse_mode: 'HTML', reply_markup: keyboard })
        });
      }
      return res.json({ ok: true });
    }

    // 2. TELEGRAM UPDATES
    if (update.callback_query) {
      const query = update.callback_query;
      if (!token) {
        console.error("Callback failed: No Bot Token found in Env Vars");
        return res.send("ok");
      }

      if (query.data.startsWith('finalize_')) {
        const dispatchId = query.data.replace('finalize_', '');
        
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: query.id })
        });

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: query.message.chat.id,
            text: `📝 Please enter <b>Invoice Number</b> for Dispatch ID: <code>${dispatchId}</code>`,
            parse_mode: 'HTML',
            reply_markup: { force_reply: true, selective: true }
          })
        });
      }
      return res.send("ok");
    }

    // Handle Invoice Number Reply
    if (update.message && update.message.reply_to_message) {
      const replyTo = update.message.reply_to_message;
      if (replyTo.text && replyTo.text.includes("Please enter Invoice Number")) {
        const invoiceNo = update.message.text.trim();
        const idMatch = replyTo.text.match(/Dispatch ID: ([\w-]+)/);
        const dispatchId = idMatch ? idMatch[1] : null;

        if (!dispatchId || !token) return res.send("ok");

        const originalMsg = replyTo.reply_to_message;
        if (!originalMsg) return res.send("ok");

        if (!gas_url) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: update.message.chat.id, text: "❌ GAS Webhook URL not set in Vercel Env Vars" })
          });
          return res.send("ok");
        }

        const gasRes = await fetch(gas_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispatch_id: dispatchId, invoice_no: invoiceNo, action: 'finalize' })
        });
        const gasData: any = await gasRes.json();

        if (gasData.ok) {
          const newText = `✅ <b>Dispatch Finalized</b>\n\n` +
                          `📦 <b>Main Sheet No:</b> <code>${gasData.dispatch_no}</code>\n` +
                          `🚚 <b>ID:</b> <code>${dispatchId}</code>\n` +
                          `📄 <b>Invoice:</b> <code>${invoiceNo}</code>`;
          
          const editMethod = originalMsg.caption ? 'editMessageCaption' : 'editMessageText';
          const editPayload: any = {
            chat_id: update.message.chat.id,
            message_id: originalMsg.message_id,
            parse_mode: 'HTML',
            reply_markup: null
          };
          if (originalMsg.caption) editPayload.caption = newText;
          else editPayload.text = newText;

          await fetch(`https://api.telegram.org/bot${token}/${editMethod}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editPayload)
          });
        }
      }
    }

    res.send("ok");
  } catch (error: any) {
    console.error("Webhook Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global Error:", err);
  res.status(500).json({ 
    ok: false, 
    error: "Internal Server Error", 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Export for Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default app;

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Vite setup failed:", e);
    }
  } else {
    app.use(express.static("dist"));
  }
}

// Start Vite setup but don't block
setupVite().catch(console.error);

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
