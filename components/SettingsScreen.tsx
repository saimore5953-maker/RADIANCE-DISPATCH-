
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
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/webhook');
      const data = await res.json();
      setLogs(data.logs || []);
      setShowLogs(true);
    } catch (e) {
      triggerToast("Could not fetch logs");
    }
  };

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('/api/webhook');
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch (e) {
        setServerStatus('offline');
      }
    };
    checkServer();
  }, []);

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
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden animate-in slide-in-from-right duration-300">
      <div className="flex-1 overflow-y-auto space-y-6 pb-20">
        {/* Section: API Configuration */}
        <div>
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 ml-1">API Configuration</h3>
          <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-slate-700 text-slate-300 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Use Custom API Key</p>
                  <p className="text-[10px] text-slate-500 font-medium">Override system environment key</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.useCustomApiKey}
                  onChange={(e) => updateSetting('useCustomApiKey', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1 ml-1">API Key</label>
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    value={localApiKey}
                    disabled={!settings.useCustomApiKey}
                    onChange={(e) => {
                      setLocalApiKey(e.target.value);
                      setIsSaved(false);
                    }}
                    className={`w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 pr-12 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!settings.useCustomApiKey ? 'opacity-40 grayscale pointer-events-none' : 'text-white'}`}
                    placeholder="Enter Google Gemini API Key"
                  />
                  <button 
                    type="button"
                    disabled={!settings.useCustomApiKey}
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showApiKey ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 italic px-1 leading-relaxed">Keep this key private. Stored locally on this device. Manual keys are intended for advanced diagnostic use.</p>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveApiKey}
                  disabled={isSaved || !settings.useCustomApiKey}
                  className={`flex-1 py-3 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all ${isSaved || !settings.useCustomApiKey ? 'bg-slate-800 text-slate-600' : 'bg-blue-600 text-white shadow-lg active:scale-95'}`}
                >
                  Save API Key
                </button>
                <button 
                  onClick={handleResetApiKey}
                  className="px-4 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Cloud Integration */}
        <div>
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 ml-1">Cloud Integration</h3>
          <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-900/30 text-emerald-400 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Enable Upload to Sheet</p>
                  <p className="text-[10px] text-slate-500">Auto-sync after finalization</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.enableSheetsUpload}
                  onChange={(e) => updateSetting('enableSheetsUpload', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Spreadsheet URL</label>
                <input 
                  type="text"
                  value={settings.spreadsheetUrl}
                  onChange={(e) => updateSetting('spreadsheetUrl', e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Webhook URL</label>
                <input 
                  type="text"
                  value={settings.webhookUrl}
                  onChange={(e) => updateSetting('webhookUrl', e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Telegram Integration */}
        <div>
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 ml-1">Telegram Integration</h3>
          <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-900/30 text-blue-400 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Telegram Bot</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] text-slate-500">Send dispatch reports to group</p>
                    <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : serverStatus === 'offline' ? 'bg-red-500' : 'bg-slate-500 animate-pulse'}`}></div>
                  </div>
                </div>
              </div>
              <button 
                onClick={fetchLogs}
                className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
              >
                View Logs
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1 ml-1">Bot Token</label>
                <input 
                  type="password"
                  value={settings.telegramBotToken}
                  onChange={(e) => updateSetting('telegramBotToken', e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter Bot Token"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1 ml-1">Chat ID / Group ID</label>
                <input 
                  type="text"
                  value={settings.telegramChatId}
                  onChange={(e) => updateSetting('telegramChatId', e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter Chat ID (e.g. -100...)"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1 ml-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Bot Webhook URL</label>
                  <button 
                    onClick={() => updateSetting('telegramBotWebhookUrl', '/api/webhook')}
                    className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
                  >
                    Use Built-in Bot
                  </button>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={settings.telegramBotWebhookUrl}
                    onChange={(e) => updateSetting('telegramBotWebhookUrl', e.target.value)}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://your-bot.vercel.app"
                  />
                  <button 
                    onClick={async () => {
                      try {
                        const url = settings.telegramBotWebhookUrl.trim() || '/api/webhook';
                        const testUrl = url.includes('http') ? url : window.location.origin + (url.startsWith('/') ? url : '/' + url);
                        const res = await fetch(testUrl);
                        if (res.ok) triggerToast("Connection OK");
                        else triggerToast("Server Error: " + res.status);
                      } catch (e) {
                        triggerToast("Connection Failed");
                      }
                    }}
                    className="px-3 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors"
                    title="Test Connection"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    if (!settings.telegramBotToken) {
                      alert("Please enter Bot Token first");
                      return;
                    }
                    try {
                      console.log("Registering webhook...");
                      const webhookUrl = window.location.origin + '/api/webhook';
                      console.log("Webhook URL:", webhookUrl);
                      
                      const res = await fetch('/api/setup-webhook', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          token: settings.telegramBotToken, 
                          url: webhookUrl,
                          gas_url: settings.webhookUrl,
                          chat_id: settings.telegramChatId
                        })
                      });
                      
                      if (!res.ok) {
                        const errorText = await res.text();
                        console.error("Server responded with error:", errorText);
                        alert(`❌ Server Error (${res.status}): ${errorText}`);
                        return;
                      }

                      const data = await res.json();
                      console.log("Webhook response:", data);
                      
                      if (data.ok) {
                        alert("✅ Webhook Registered Successfully! Buttons will now work.");
                      } else {
                        alert("❌ Telegram Error: " + (data.description || data.error || "Unknown error"));
                      }
                    } catch (e: any) {
                      console.error("Registration catch block:", e);
                      alert("❌ Network/Client Error: " + e.message);
                    }
                  }}
                  className="flex-1 py-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-blue-600/30 transition-all"
                >
                  Register Webhook
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/webhook', { method: 'GET' });
                      const data = await res.json();
                      alert("✅ Server Status: " + JSON.stringify(data, null, 2));
                    } catch (e: any) {
                      alert("❌ Server Offline: " + e.message);
                    }
                  }}
                  className="px-4 py-3 bg-slate-700/50 text-slate-400 border border-slate-600/30 font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all"
                  title="Test Server Connection"
                >
                  Test
                </button>
              </div>

              <p className="text-[9px] text-slate-500 italic px-1 leading-relaxed">Ensure the bot is an admin in your group to send documents.</p>
            </div>
          </div>
        </div>

        {/* Section: Scan Engine */}
        <div>
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 ml-1">Scan Engine</h3>
          <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-900/30 text-blue-400 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Show OCR Viewport</p>
                  <p className="text-[10px] text-slate-500">Targeting box on scanner</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.showOcrViewport}
                  onChange={(e) => updateSetting('showOcrViewport', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="p-4">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">OCR Timeout (seconds)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  value={settings.ocrTimeoutSec}
                  onChange={(e) => updateSetting('ocrTimeoutSec', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-sm font-mono font-bold text-white w-8">{settings.ocrTimeoutSec}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Export & UI */}
        <div>
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3 ml-1">Export & UI</h3>
          <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="bg-amber-900/30 text-amber-400 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Auto-open Excel</p>
                  <p className="text-[10px] text-slate-500">Launch after generation</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.autoOpenExcel}
                  onChange={(e) => updateSetting('autoOpenExcel', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-900/30 text-purple-400 p-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Large Buttons</p>
                  <p className="text-[10px] text-slate-500">Optimized for glove usage</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.largeButtons}
                  onChange={(e) => updateSetting('largeButtons', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="text-center pt-4">
          <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest leading-loose">
            Radiance Dispatch Engine v1.0.4<br/>
            Secure Industrial Protocol Enabled
          </p>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <div className="bg-blue-600 text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl">
            {toastMsg}
          </div>
        </div>
      )}

      {showLogs && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Server Debug Logs</h2>
            <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 bg-black rounded-2xl border border-white/10 p-4 font-mono text-[10px] overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">No logs recorded yet...</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="text-emerald-500/80 break-all">{log}</p>
              ))
            )}
          </div>
          <button 
            onClick={fetchLogs}
            className="mt-4 w-full py-4 bg-slate-800 text-white font-bold rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
          >
            Refresh Logs
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
