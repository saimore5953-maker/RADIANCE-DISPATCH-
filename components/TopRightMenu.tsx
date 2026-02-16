
import React, { useState, useRef, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { logger } from '../services/logger';

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

  const handleOpenSpreadsheet = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { spreadsheetUrl } = settingsService.getSettings();
    if (!spreadsheetUrl) {
      alert("Spreadsheet URL not configured in Settings.");
      logger.warn('Attempted to open spreadsheet, but URL is not configured.');
      return;
    }
    logger.info('Opening spreadsheet.', { url: spreadsheetUrl });
    window.open(spreadsheetUrl, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-2 transition-all active:scale-95 rounded-lg ${isOpen ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-slate-400 hover:text-primary'}`}
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-3 w-60 bg-slate-950/95 backdrop-blur-xl rounded-xl border border-primary/30 py-2 z-[100] animate-in zoom-in-95 duration-150 origin-top-right shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        >
          {/* Corner Tech Accents */}
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary/40 rounded-tr-xl pointer-events-none"></div>
          
          <div className="px-4 py-2 border-b border-white/5 mb-1">
            <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">System Controls</span>
          </div>

          <button 
            onClick={handleOpenSpreadsheet}
            className="w-full px-5 py-3 text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-primary/20 flex items-center gap-3 transition-colors"
          >
            <div className="bg-success/10 text-success p-1.5 rounded-lg border border-success/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            DATABASE ACCESS
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenSettings(); setIsOpen(false); }}
            className="w-full px-5 py-3 text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-primary/20 flex items-center gap-3 transition-colors"
          >
            <div className="bg-primary/10 text-primary p-1.5 rounded-lg border border-primary/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            TERMINAL SETTINGS
          </button>
          
          <div className="h-px bg-white/5 my-1 mx-2"></div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onLogout(); setIsOpen(false); }}
            className="w-full px-5 py-3 text-left text-xs font-bold text-error hover:bg-error/10 flex items-center gap-3 transition-colors"
          >
            <div className="bg-error/10 text-error p-1.5 rounded-lg border border-error/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
            TERMINATE SESSION
          </button>
        </div>
      )}
    </div>
  );
};

export default TopRightMenu;
