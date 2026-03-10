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
let activeBotToken = process.env.TELEGRAM_BOT_TOKEN;
let activeGasUrl = process.env.GAS_WEBHOOK_URL;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
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
      has_token: !!activeBotToken,
      has_chat_id: !!CHAT_ID,
      has_gas_url: !!activeGasUrl
    }
  });
});

// Unified endpoint for Telegram Webhooks AND Mobile App Dispatches
app.post('/api/webhook', upload.single('excel'), async (req, res) => {
  try {
    addLog("Incoming Webhook Request");
    
    // 1. MOBILE APP DISPATCH (Initial "Send to Telegram" click)
    if (req.body.data) {
      addLog("Type: Mobile App Dispatch (Hold Workflow)");
      const data = JSON.parse(req.body.data);
      const excelFile = req.file;
      
      const token = data.bot_token || activeBotToken;
      const chat_id = data.chat_id || CHAT_ID;
      const gas_url = data.gas_url || activeGasUrl;

      // Update active credentials for future callbacks
      if (token) activeBotToken = token;
      if (gas_url) activeGasUrl = gas_url;

      addLog(`Credentials: Token=${!!token}, ChatID=${!!chat_id}, GAS=${!!gas_url}`);

      if (!token || !chat_id) {
        addLog("Error: Missing Credentials");
        return res.status(400).json({ ok: false, error: "Telegram Bot Token or Chat ID not provided" });
      }

      // A. SEND TO GOOGLE SHEET (HOLD LIST)
      if (gas_url) {
        addLog("Sending to GAS Hold List...");
        try {
          const gasRes = await fetch(gas_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, action: 'hold' })
          });
          const gasResult: any = await gasRes.json();
          addLog(`GAS Hold Result: ${gasResult.ok ? 'Success' : 'Failed: ' + gasResult.message}`);
        } catch (e: any) {
          addLog("GAS Hold Error: " + e.message);
        }
      } else {
        addLog("Warning: No GAS URL provided, skipping Hold List");
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

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: formData });
        const tgData: any = await tgRes.json();
        if (!tgData.ok) {
          addLog(`Telegram Error: ${tgData.description}`);
          throw new Error(tgData.description);
        }
      } else {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat_id, text: messageText, parse_mode: 'HTML', reply_markup: keyboard })
        });
        const tgData: any = await tgRes.json();
        if (!tgData.ok) {
          addLog(`Telegram Error: ${tgData.description}`);
          throw new Error(tgData.description);
        }
      }
      addLog("Telegram Message Sent Successfully");
      return res.json({ ok: true });
    }

    // 2. TELEGRAM UPDATES
    const update: any = req.body;
    
    // Handle "Finalize Dispatch" Button Click
    if (update.callback_query) {
      const query = update.callback_query;
      if (query.data.startsWith('finalize_')) {
        const dispatchId = query.data.replace('finalize_', '');
        addLog(`Finalize Clicked for ID: ${dispatchId}`);
        
        await fetch(`https://api.telegram.org/bot${activeBotToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: query.id })
        });

        await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
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
        const promptText = replyTo.text;
        
        // Extract Dispatch ID from the prompt message
        const idMatch = promptText.match(/Dispatch ID: ([\w-]+)/);
        const dispatchId = idMatch ? idMatch[1] : null;

        if (!dispatchId) {
          addLog("Error: Could not find Dispatch ID in prompt");
          return res.send("ok");
        }

        const originalMsg = replyTo.reply_to_message;
        if (!originalMsg) return res.send("ok");

        if (!activeGasUrl) {
          await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: update.message.chat.id, text: "❌ GAS Webhook URL not set" })
          });
          return res.send("ok");
        }

        addLog(`Finalizing ID ${dispatchId} with Invoice ${invoiceNo}...`);
        const gasRes = await fetch(activeGasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dispatch_id: dispatchId,
            invoice_no: invoiceNo,
            action: 'finalize'
          })
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

          await fetch(`https://api.telegram.org/bot${activeBotToken}/${editMethod}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editPayload)
          });
          
          await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: update.message.chat.id, text: `✅ Success! Data moved to Main Sheet (No: ${gasData.dispatch_no})` })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: update.message.chat.id, text: `❌ Finalization Failed: ${gasData.message}` })
          });
        }
      }
    }

    res.send("ok");
  } catch (error: any) {
    addLog(`Server Error: ${error.message}`);
    res.status(500).json({ ok: false, error: error.message, stack: error.stack });
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
    bodyParser: false,
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
