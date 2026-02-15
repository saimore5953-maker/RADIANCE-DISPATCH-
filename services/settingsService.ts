
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
}

const SETTINGS_KEY = 'radiance_dispatch_settings';

const defaultSettings: AppSettings = {
  enableSheetsUpload: true,
  spreadsheetUrl: APP_CONFIG.SPREADSHEET_URL,
  webhookUrl: APP_CONFIG.DEFAULT_WEBHOOK_URL,
  showOcrViewport: true,
  ocrTimeoutSec: 5,
  autoOpenExcel: true,
  largeButtons: false,
  useCustomApiKey: false,
  customApiKey: '',
};

export const settingsService = {
  getSettings(): AppSettings {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return defaultSettings;
    try {
      return { ...defaultSettings, ...JSON.parse(saved) };
    } catch {
      return defaultSettings;
    }
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};
