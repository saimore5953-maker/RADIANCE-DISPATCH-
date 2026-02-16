
const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${getTimestamp()}: ${message}`, data || '');
  },
  debug: (message: string, data?: any) => {
    console.debug(`[DEBUG] ${getTimestamp()}: ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${getTimestamp()}: ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${getTimestamp()}: ${message}`, error || '');
  }
};
