
import React, { useState } from 'react';

interface Props {
  onSelect: (customerName: string) => void;
  onBack: () => void;
}

const CUSTOMERS = [
  "FLEETGUARD FILTURM,DHARWAD",
  "FLEETGUARD FILTURM,HOSUR",
  "FLEETGUARD FILTURM,SITARGANJ",
  "FLEETGUARD FILTURM,NANDUR",
  "FLEETGUARD FILTURM,LONI",
  "FLEETGUARD FILTURM,WADKI",
  "KINETIC MOTORS",
  "ITW"
];

const CustomerSelectionScreen: React.FC<Props> = ({ onSelect, onBack }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [manualName, setManualName] = useState("");

  const handleContinue = () => {
    if (isManual) {
      if (manualName.trim()) {
        onSelect(manualName.trim());
      }
    } else if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-white overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 bg-slate-800 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 text-slate-400 active:scale-95 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold tracking-tight">SELECT CUSTOMER</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {CUSTOMERS.map(name => (
          <button
            key={name}
            onClick={() => { setSelected(name); setIsManual(false); }}
            className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
              selected === name && !isManual 
                ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' 
                : 'bg-slate-800 border-slate-700 hover:border-slate-600'
            }`}
          >
            <p className={`font-bold text-sm ${selected === name && !isManual ? 'text-white' : 'text-slate-300'}`}>
              {name}
            </p>
          </button>
        ))}

        {/* Manual Entry Toggle */}
        <button
          onClick={() => { setIsManual(true); setSelected(null); }}
          className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${
            isManual 
              ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' 
              : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <p className={`font-bold text-sm ${isManual ? 'text-white' : 'text-slate-300'}`}>
              + New Customer
            </p>
          </div>
        </button>

        {isManual && (
          <div className="pt-4 animate-in slide-in-from-top-2 duration-300 px-2">
             <label className="block text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Manual Customer Name</label>
             <input 
              type="text"
              autoFocus
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Enter customer name..."
              className="w-full bg-slate-800 border-2 border-blue-500/50 rounded-xl px-4 py-4 text-white text-lg focus:ring-2 focus:ring-blue-500 transition-all outline-none"
             />
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="p-6 bg-slate-800/50 backdrop-blur-md border-t border-slate-700">
        <button
          disabled={(!selected && !isManual) || (isManual && !manualName.trim())}
          onClick={handleContinue}
          className="w-full py-5 bg-blue-600 disabled:bg-slate-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-sm"
        >
          Confirm & Start Scan
        </button>
      </div>
    </div>
  );
};

export default CustomerSelectionScreen;
