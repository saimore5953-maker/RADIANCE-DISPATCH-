
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
      }))
    };

    // Generate Excel for attachment
    const { excel } = await generateExports(dispatch, scans, summary);

    // 1. Automation Mode (Vercel Webhook)
    if (telegramBotWebhookUrl && telegramBotWebhookUrl.trim() !== '') {
      try {
        const baseUrl = telegramBotWebhookUrl.replace(/\/$/, '');
        const formData = new FormData();
        formData.append('data', JSON.stringify(payload));
        formData.append('excel', excel.blob, excel.fileName);

        const res = await fetch(`${baseUrl}/api/dispatch`, {
          method: 'POST',
          body: formData,
          mode: 'cors'
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Webhook rejected request' }));
          throw new Error(err.error || `Server returned ${res.status}`);
        }
        return true;
      } catch (error: any) {
        console.error('Webhook Error:', error);
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
