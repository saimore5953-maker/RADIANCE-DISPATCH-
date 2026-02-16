
import React, { useState } from 'react';

interface Props {
  onLogin: (name: string) => void;
}

const PIN_MAP: Record<string, string> = {
  '0001': 'Prajval Kulkarni',
  '0002': 'Ravi Kumar',
  '0003': 'Sai More',
};

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const operatorName = PIN_MAP[pin];
    if (operatorName) {
      setError(null);
      onLogin(operatorName);
    } else {
      setError('ACCESS DENIED');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden h-full">
      {/* HUD Corner Accents */}
      <div className="absolute top-10 left-10 w-12 h-12 border-t-2 border-l-2 border-primary/40"></div>
      <div className="absolute top-10 right-10 w-12 h-12 border-t-2 border-r-2 border-primary/40"></div>
      <div className="absolute bottom-10 left-10 w-12 h-12 border-b-2 border-l-2 border-primary/40"></div>
      <div className="absolute bottom-10 right-10 w-12 h-12 border-b-2 border-r-2 border-primary/40"></div>

      <div className="card w-full max-w-sm bg-slate-900/80 backdrop-blur-xl tech-border p-8 text-white relative z-10">
        {/* Animated Scan Line */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/30 animate-[bounce_4s_infinite] opacity-50 shadow-[0_0_10px_#3b82f6]"></div>

        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/30 mb-4 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-10.429A9 9 0 0012 2c3.461 0 6.561 1.95 8.125 4.823M7 15a9.043 9.043 0 01-3.125-4.823M7 15L2 17M7 15L7 22M10.247 10.247L12 12m0 0l1.753 1.753m-1.753-1.753l1.753-1.753m-1.753 1.753L10.247 13.753" />
            </svg>
          </div>
          <h1 className="text-xl font-black uppercase tracking-[0.2em] text-center">Radiance Terminal</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest opacity-80">System: Secure-v1.2</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="form-control">
            <div className="flex justify-between items-end mb-2 px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Identity PIN</span>
              <span className="text-[8px] font-mono text-primary/60 uppercase">Auth Level 4</span>
            </div>
            
            <div className="relative group">
               <input 
                type="password" 
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                className={`input input-ghost w-full text-center text-3xl tracking-[0.8em] font-mono h-20 bg-black/40 border-slate-700/50 focus:border-primary/60 focus:bg-primary/5 rounded-xl transition-all ${error ? 'border-error text-error' : 'text-primary'}`}
                maxLength={4}
                required
                autoFocus
                placeholder="0000"
              />
              <div className="absolute inset-0 pointer-events-none rounded-xl border border-white/5 group-focus-within:border-primary/20"></div>
            </div>

            {error && (
              <p className="text-center text-error font-black text-[10px] mt-4 uppercase tracking-[0.3em] animate-pulse">
                {error}
              </p>
            )}
          </div>

          <button 
            type="submit"
            className="btn btn-primary btn-block h-16 btn-digital rounded-xl text-lg font-black tracking-[0.2em]"
          >
            INITIALIZE
          </button>
        </form>
        
        <div className="mt-10 flex flex-col items-center gap-1">
          <div className="h-[1px] w-12 bg-slate-800"></div>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.4em]">Industrial Protocol 8.0</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
