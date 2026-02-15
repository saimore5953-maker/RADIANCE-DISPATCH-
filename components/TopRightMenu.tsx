
import React, { useState, useRef, useEffect } from 'react';
import { APP_CONFIG } from '../constants';

interface Props {
  onOpenSettings: () => void;
  onLogout: () => void;
}

const TopRightMenu: React.FC<Props> = ({ onOpenSettings, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenSpreadsheet = () => {
    if (!APP_CONFIG.SPREADSHEET_URL) {
      alert("Spreadsheet URL not configured");
      return;
    }
    window.open(APP_CONFIG.SPREADSHEET_URL, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-blue-600 transition-colors active:scale-95"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[100] animate-in zoom-in-95 duration-150 origin-top-right">
          <button 
            onClick={handleOpenSpreadsheet}
            className="w-full px-5 py-4 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
          >
            <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            Open Spreadsheet
          </button>
          
          <button 
            onClick={() => { onOpenSettings(); setIsOpen(false); }}
            className="w-full px-5 py-4 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
          >
            <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            Settings
          </button>
          
          <div className="h-px bg-slate-100 my-1 mx-2"></div>
          
          <button 
            onClick={() => { onLogout(); setIsOpen(false); }}
            className="w-full px-5 py-4 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
          >
            <div className="bg-red-50 text-red-500 p-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            Log Out
          </button>
        </div>
      )}
    </div>
  );
};

export default TopRightMenu;
