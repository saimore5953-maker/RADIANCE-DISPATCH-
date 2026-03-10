
import { APP_CONFIG } from '../constants';

export interface AppSettings {
  enableSheetsUpload: boolean;
  spreadsheetUrl: string;
  webhookUrl: string;
  showOcrViewport: boolean;
  ocrTimeoutSec: number;
  autoOpenExcel: boolean;
  largeButtons: boolean;
  useCustomApiKey: boolean;
  customApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramBotWebhookUrl: string;
  settingsSyncUrl: string;
}

const SETTINGS_KEY = 'radiance_dispatch_settings';

const defaultSettings: AppSettings = {
  enableSheetsUpload: true,
  spreadsheetUrl: APP_CONFIG.SPREADSHEET_URL,
  webhookUrl: APP_CONFIG.DEFAULT_WEBHOOK_URL,
  showOcrViewport: true,
  ocrTimeoutSec: 10, // Updated default to 10s
  autoOpenExcel: true,
  largeButtons: false,
  useCustomApiKey: false,
  customApiKey: '',
  telegramBotToken: '',
  telegramChatId: '',
  telegramBotWebhookUrl: '',
  settingsSyncUrl: '',
};

export const settingsService = {
  getSettings(): AppSettings {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return defaultSettings;
    try {
      const parsed = JSON.parse(saved);
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};
