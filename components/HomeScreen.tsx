
import React from 'react';
import TopRightMenu from './TopRightMenu';

interface Props {
  operatorId: string;
  onStart: () => void;
  onHistory: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}

const HomeScreen: React.FC<Props> = ({ operatorId, onStart, onHistory, onLogout, onOpenSettings }) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Digital Top Bar */}
      <div className="h-20 bg-slate-900/50 backdrop-blur-md border-b border-primary/20 px-6 flex items-center justify-between shadow-lg">
        <div className="flex flex-col">
          <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-1">Authenticated Terminal</span>
          <div className="flex items-center gap-2">
             <div className="avatar placeholder online">
                <div className="bg-primary/20 text-primary border border-primary/30 rounded-lg w-8 h-8">
                  <span className="text-xs font-black">{operatorId[0]}</span>
                </div>
              </div>
             <h2 className="text-sm font-black text-white uppercase tracking-tight">{operatorId}</h2>
          </div>
        </div>
        <TopRightMenu onOpenSettings={onOpenSettings} onLogout={onLogout} />
      </div>

      <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
        
        {/* System Overview HUD */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
             <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Session Lock</span>
             <span className="text-[10px] font-mono text-primary uppercase">Active-S21</span>
          </div>
          <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5 text-right">
             <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Local Latency</span>
             <span className="text-[10px] font-mono text-success uppercase">0.04ms</span>
          </div>
        </div>

        {/* Action Modules */}
        <div 
          onClick={onStart}
          className="group relative cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity"></div>
          <div className="relative card bg-primary/10 border border-primary/30 tech-border text-white">
            <div className="card-body p-8 items-center text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/40 group-hover:bg-primary/40 transition-colors">
                <svg className="w-8 h-8 text-primary shadow-[0_0_10px_#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-1">New Scan Batch</h2>
              <p className="text-[10px] text-primary font-bold uppercase tracking-[0.1em] opacity-80">Initialize Dispatch Protocol</p>
            </div>
          </div>
        </div>

        <div 
          onClick={onHistory}
          className="card bg-slate-900/60 border border-slate-700/50 cursor-pointer active:scale-[0.98] transition-all hover:bg-slate-800/80"
        >
          <div className="card-body flex-row items-center p-6 gap-6">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black uppercase tracking-tight text-white">Archive Access</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Review Completed Logs</p>
            </div>
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>

        {/* Global Feed Ticker */}
        <div className="mt-auto p-4 bg-black/40 rounded-xl border border-white/5">
          <div className="flex justify-between items-center mb-3">
             <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">System Telemetry</span>
             <span className="text-[8px] font-mono text-slate-600 uppercase">Buffer: 4.2kb</span>
          </div>
          <div className="space-y-2">
             <div className="flex gap-4 items-center opacity-40">
                <span className="text-[8px] font-mono text-primary">[14:02:11]</span>
                <span className="text-[9px] font-bold uppercase text-slate-300">Database Core Synchronized</span>
             </div>
             <div className="flex gap-4 items-center opacity-70">
                <span className="text-[8px] font-mono text-primary">[14:02:08]</span>
                <span className="text-[9px] font-bold uppercase text-slate-300">OCR Engine Warmed Up (Model: F3)</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
