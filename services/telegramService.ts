
import { Dispatch } from '../types';

export const telegramService = {
  async sendDispatchToTelegram(dispatch: Dispatch, totalBoxes: number, excelBlob: Blob, fileName: string, botToken: string, chatId: string) {
    const message = 
      `🚚 *Dispatch ID:* ${dispatch.dispatch_id}\n` +
      `🏭 *Customer:* ${dispatch.customer_name}\n` +
      `📦 *Total Boxes:* ${totalBoxes}\n` +
      `🚛 *Vehicle:* ${dispatch.vehicle_no}\n` +
      `📄 *LR No:* ${dispatch.lr_no}\n` +
      `📎 *Excel File:* Attached Below`;

    try {
      // 1. Send text message
      const textUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const textRes = await fetch(textUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      if (!textRes.ok) {
        const err = await textRes.json();
        throw new Error(err.description || 'Failed to send message');
      }

      // 2. Send document
      const docUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', excelBlob, fileName);
      
      const docRes = await fetch(docUrl, {
        method: 'POST',
        body: formData
      });

      if (!docRes.ok) {
        const err = await docRes.json();
        throw new Error(err.description || 'Failed to send document');
      }

      return true;
    } catch (error: any) {
      console.error('Telegram Error:', error);
      throw error;
    }
  }
};
