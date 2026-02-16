
import React, { useState, useEffect } from 'react';
import { settingsService, AppSettings } from '../services/settingsService';

interface Props {
  onBack: () => void;
}

const SettingsScreen: React.FC<Props> = ({ onBack }) => {
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
  const [showApiKey, setShowApiKey] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(settings.customApiKey);
  const [isSaved, setIsSaved] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('Saved');

  const updateSetting = (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    settingsService.saveSettings(newSettings);
    triggerToast("Setting Updated");
  };

  const handleSaveApiKey = () => {
    if (settings.useCustomApiKey && !localApiKey.trim()) {
      alert("API Key cannot be empty when custom key is enabled.");
      return;
    }
    const newSettings = { ...settings, customApiKey: localApiKey };
    setSettings(newSettings);
    settingsService.saveSettings(newSettings);
    setIsSaved(true);
    triggerToast("API Key Saved");
  };

  const handleResetApiKey = () => {
    setLocalApiKey('');
    const newSettings = { ...settings, useCustomApiKey: false, customApiKey: '' };
    setSettings(newSettings);
    settingsService.saveSettings(newSettings);
    setIsSaved(true);
    triggerToast("Reset Successfully");
  };

  const triggerToast = (msg: string = "Saved") => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 bg-white border-b flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="p-2 text-slate-600 active:scale-95 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {/* Section: API Configuration */}
        <div>
          <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 ml-1">API Configuration</h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 text-slate-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Use Custom API Key</p>
                  <p className="text-[10px] text-slate-400 font-medium">Override system environment key</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.useCustomApiKey}
                  onChange={(e) => updateSetting('useCustomApiKey', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1 ml-1">API Key</label>
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    value={localApiKey}
                    disabled={!settings.useCustomApiKey}
                    onChange={(e) => {
                      setLocalApiKey(e.target.value);
                      setIsSaved(false);
                    }}
                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!settings.useCustomApiKey ? 'opacity-40 grayscale pointer-events-none' : 'text-slate-900'}`}
                    placeholder="Enter Google Gemini API Key"
                  />
                  <button 
                    type="button"
                    disabled={!settings.useCustomApiKey}
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showApiKey ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 italic px-1 leading-relaxed">Keep this key private. Stored locally on this device. Manual keys are intended for advanced diagnostic use.</p>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveApiKey}
                  disabled={isSaved || !settings.useCustomApiKey}
                  className={`flex-1 py-3 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all ${isSaved || !settings.useCustomApiKey ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white shadow-lg active:scale-95'}`}
                >
                  Save API Key
                </button>
                <button 
                  onClick={handleResetApiKey}
                  className="px-4 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Cloud Integration */}
        <div>
          <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 ml-1">Cloud Integration</h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Enable Upload to Sheet</p>
                  <p className="text-[10px] text-slate-400">Auto-sync after finalization</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.enableSheetsUpload}
                  onChange={(e) => updateSetting('enableSheetsUpload', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Spreadsheet URL</label>
                <input 
                  type="text"
                  value={settings.spreadsheetUrl}
                  onChange={(e) => updateSetting('spreadsheetUrl', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Webhook URL</label>
                <input 
                  type="text"
                  value={settings.webhookUrl}
                  onChange={(e) => updateSetting('webhookUrl', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Scan Engine */}
        <div>
          <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 ml-1">Scan Engine</h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Show OCR Viewport</p>
                  <p className="text-[10px] text-slate-400">Targeting box on scanner</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.showOcrViewport}
                  onChange={(e) => updateSetting('showOcrViewport', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="p-4">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">OCR Timeout (seconds)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  value={settings.ocrTimeoutSec}
                  onChange={(e) => updateSetting('ocrTimeoutSec', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-sm font-mono font-bold text-slate-900 w-8">{settings.ocrTimeoutSec}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Export & UI */}
        <div>
          <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 ml-1">Export & UI</h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 text-amber-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Auto-open Excel</p>
                  <p className="text-[10px] text-slate-400">Launch after generation</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.autoOpenExcel}
                  onChange={(e) => updateSetting('autoOpenExcel', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 text-purple-600 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Large Buttons</p>
                  <p className="text-[10px] text-slate-400">Optimized for glove usage</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.largeButtons}
                  onChange={(e) => updateSetting('largeButtons', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="text-center pt-4">
          <p className="text-[9px] text-slate-300 uppercase font-black tracking-widest leading-loose">
            Radiance Dispatch Engine v1.0.4<br/>
            Secure Industrial Protocol Enabled
          </p>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl">
            {toastMsg}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
