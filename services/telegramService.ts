
import { Dispatch, PartSummary } from '../types';
import { AppSettings } from './settingsService';
import { generateExports } from './exportService';

export const telegramService = {
  async sendDispatchToTelegram(dispatch: Dispatch, summary: PartSummary[], scans: any[], settings: AppSettings) {
    const { telegramBotWebhookUrl, telegramBotToken, telegramChatId } = settings;

    const payload = {
      dispatch_id: dispatch.dispatch_id,
      completed_at: new Date().toISOString().replace('T', ' ').split('.')[0],
      customer_name: dispatch.customer_name,
      dispatch_executive: dispatch.operator_id,
      driver_name: dispatch.driver_name,
      driver_mobile: dispatch.driver_mobile,
      vehicle_no: dispatch.vehicle_no,
      lr_no: dispatch.lr_no,
      summary: summary.map(s => ({
        part_no: s.part_no,
        part_name: s.part_name,
        boxes: s.boxes,
        total_qty: s.total_qty
      })),
      // Pass credentials to the webhook so it doesn't rely solely on server env vars
      bot_token: telegramBotToken,
      chat_id: telegramChatId
    };

    // Generate Excel for attachment
    const { excel } = await generateExports(dispatch, scans, summary);

    // 1. Automation Mode (Vercel Webhook / Local Server)
    if (telegramBotWebhookUrl && telegramBotWebhookUrl.trim() !== '') {
      try {
        let targetUrl = telegramBotWebhookUrl.trim();
        
        // If the URL matches the current origin, use a relative path to avoid CORS/Network issues
        const currentOrigin = window.location.origin;
        if (targetUrl.startsWith(currentOrigin)) {
          targetUrl = '/api/webhook';
        } else if (!targetUrl.startsWith('http') && !targetUrl.startsWith('/')) {
          // If it's just a path or a partial domain, try to make it relative
          targetUrl = '/api/webhook';
        } else if (!targetUrl.includes('/api/webhook') && targetUrl.startsWith('http')) {
          targetUrl = targetUrl.replace(/\/$/, '') + '/api/webhook';
        }

        const formData = new FormData();
        formData.append('data', JSON.stringify(payload));
        formData.append('excel', excel.blob, excel.fileName);

        const res = await fetch(targetUrl, {
          method: 'POST',
          body: formData,
          // Remove mode: 'cors' if it's a relative request to avoid issues
          ...(targetUrl.startsWith('/') ? {} : { mode: 'cors' })
        });

        if (!res.ok) {
          const errText = await res.text();
          let errorMessage = `Server returned ${res.status}`;
          try {
            const errJson = JSON.parse(errText);
            errorMessage = errJson.error || errorMessage;
          } catch (e) {
            errorMessage = errText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        return true;
      } catch (error: any) {
        console.error('Webhook Error:', error);
        // If webhook fails with a network error, we can optionally fall back to direct mode
        // but for now, let's just give a better error message
        if (error.message === 'Failed to fetch') {
          throw new Error(`Webhook Connection Failed: The browser could not reach the server. Please check if the Webhook URL is correct or try leaving it empty to use Direct Mode.`);
        }
        throw new Error(`Webhook Failed: ${error.message}`);
      }
    }

    // 2. Direct Mode (Browser -> Telegram API)
    if (telegramBotToken && telegramChatId) {
      const totalBoxes = summary.reduce((acc, s) => acc + s.boxes, 0);
      const caption = 
        `🚚 *Dispatch ID:* \`${dispatch.dispatch_id}\`\n` +
        `🏭 *Customer:* ${dispatch.customer_name}\n` +
        `📦 *Total Boxes:* ${totalBoxes}\n` +
        `🚛 *Vehicle:* ${dispatch.vehicle_no}\n` +
        `📄 *LR No:* ${dispatch.lr_no}\n` +
        `📎 *Excel File:* Attached Below`;

      try {
        const url = `https://api.telegram.org/bot${telegramBotToken}/sendDocument`;
        const formData = new FormData();
        formData.append('chat_id', telegramChatId);
        formData.append('document', excel.blob, excel.fileName);
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');

        const res = await fetch(url, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.description || 'Telegram API error');
        }
        return true;
      } catch (error: any) {
        console.error('Direct API Error:', error);
        throw new Error(`Direct Send Failed: ${error.message}`);
      }
    }

    throw new Error("Telegram not configured. Please set Webhook URL or Bot Token in Settings.");
  }
};
