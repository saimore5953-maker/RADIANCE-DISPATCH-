
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900">
      {/* Top Bar */}
      <div className="h-16 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between relative z-50">
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Active Operator</span>
          <h2 className="text-sm font-bold text-white uppercase">{operatorId}</h2>
        </div>
        <TopRightMenu onOpenSettings={onOpenSettings} onLogout={onLogout} />
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1 overflow-y-auto">
        {/* Main Action */}
        <div 
          onClick={onStart}
          className="card bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors active:scale-[0.98] rounded-2xl shadow-lg"
        >
          <div className="card-body p-8 items-center text-center text-white">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold uppercase tracking-widest">New Dispatch</h2>
            <p className="text-[10px] font-medium uppercase opacity-80">Start Scan Protocol</p>
          </div>
        </div>

        {/* Secondary Action */}
        <div 
          onClick={onHistory}
          className="card bg-slate-800 sober-border hover:bg-slate-750 cursor-pointer transition-colors active:scale-[0.98] rounded-2xl"
        >
          <div className="card-body flex-row items-center p-6 gap-4">
            <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold uppercase text-white">Review History</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Access Archived Logs</p>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="mt-auto bg-slate-800/50 rounded-xl p-4 sober-border">
          <div className="flex justify-between items-center mb-2">
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System Status</span>
             <span className="text-[9px] font-mono text-emerald-500 uppercase">Online</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Database initialized. Local storage synced. <br/>
            Network: Ready for cloud upload.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
