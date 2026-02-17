
import React, { useState } from 'react';

interface Props {
  onLogin: (name: string) => void;
}

const PIN_MAP: Record<string, string> = {
  '0001': 'Prajval Kulkarni',
  '0002': 'Ravi Tiwari',
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
    <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-slate-900">
      <div className="card w-full max-w-sm bg-slate-800 sober-border p-8 text-white rounded-2xl">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-widest text-center">Radiance Dispatch</h1>
          <p className="text-[10px] text-slate-400 font-medium uppercase mt-2">Industrial Terminal Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-[10px] font-bold uppercase tracking-widest text-slate-400">Operator PIN</span>
            </label>
            <input 
              type="password" 
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
              }}
              className={`input input-bordered w-full text-center text-3xl tracking-[0.5em] font-mono h-16 bg-slate-900 border-slate-700 rounded-xl focus:border-blue-500 transition-all ${error ? 'border-error' : ''}`}
              maxLength={4}
              required
              autoFocus
            />
            {error && (
              <p className="text-center text-error font-bold text-[10px] mt-4 uppercase tracking-widest">
                {error}
              </p>
            )}
          </div>

          <button 
            type="submit"
            className="btn btn-primary btn-block h-14 rounded-xl text-sm font-bold tracking-widest uppercase"
          >
            LOGIN
          </button>
        </form>
        
        <div className="mt-8 text-center border-t border-slate-700 pt-6">
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Secure Terminal • v1.2</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
