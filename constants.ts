
export const APP_CONFIG = {
  OCR_TIMEOUT_MS: 10000, // Default fallback, but settings should override
  DUPLICATE_WINDOW_MS: 5000,
  DAILY_PREFIX: 'DSP',
  SPREADSHEET_URL: "https://docs.google.com/spreadsheets/d/1MWsjA8DhP_EbmZpDGJi5UZPv3Q0q33TJziXNBPiYk_Q/edit?gid=0#gid=0",
  DEFAULT_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbxDlCXUTKzJMDbp_AQrktUo0cWZiB_jKCrE0FvLDAuG55q26c8PuhwnhRJEsCpS9VyW/exec"
};

export const PARSE_RULES = {
  // Regex examples for tag extraction
  PART_NO: /(?:PART\s*NO[:\-\s]*)([A-Z0-9]+)/i,
  PART_NAME: /(?:PART\s*NAME[:\-\s]*)([A-Z0-9\s]+?)(?=\n|QTY|NOS|$)/i,
  QTY: /(\d+)\s*NOS/i,
  DATE: /(\d{2}\.\d{2}\.\d{4})/,
};

export const FLUTTER_VERSION_REQS = {
  camera: '^0.11.0',
  google_mlkit_text_recognition: '^0.11.0',
  sqflite: '^2.3.0',
  path_provider: '^2.1.1',
  permission_handler: '^11.0.1',
  share_plus: '^7.1.0',
  pdf: '^3.10.7',
  excel: '^4.0.0',
  crypto: '^3.0.3',
  image: '^4.1.3',
  intl: '^0.19.0',
  flutter_riverpod: '^2.4.9',
};
