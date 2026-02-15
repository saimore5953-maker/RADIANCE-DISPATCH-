
import React, { useState } from 'react';

interface LogisticsData {
  driver_name: string;
  driver_mobile: string;
  vehicle_no: string;
  lr_no: string;
}

interface Props {
  onComplete: (data: LogisticsData) => void;
  onBack: () => void;
}

const LogisticsDetailsScreen: React.FC<Props> = ({ onComplete, onBack }) => {
  const [data, setData] = useState<LogisticsData>({
    driver_name: '',
    driver_mobile: '',
    vehicle_no: '',
    lr_no: ''
  });

  const [errors, setErrors] = useState<Partial<LogisticsData>>({});

  const validate = () => {
    const newErrors: Partial<LogisticsData> = {};
    
    if (!data.driver_name.trim()) newErrors.driver_name = 'Required';
    
    if (!/^\d{10}$/.test(data.driver_mobile)) {
      newErrors.driver_mobile = 'Mobile number must be exactly 10 digits';
    }
    
    if (!/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/.test(data.vehicle_no.toUpperCase())) {
      newErrors.vehicle_no = 'Vehicle No must be like MH12AB1234';
    }
    
    if (!data.lr_no.trim()) newErrors.lr_no = 'Required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      onComplete({
        ...data,
        vehicle_no: data.vehicle_no.toUpperCase()
      });
    }
  };

  const isValid = 
    data.driver_name.trim() && 
    /^\d{10}$/.test(data.driver_mobile) && 
    /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/.test(data.vehicle_no.toUpperCase()) && 
    data.lr_no.trim();

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-white overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 bg-slate-800 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 text-slate-400 active:scale-95 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold tracking-tight">DISPATCH DETAILS</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Driver Name */}
        <div>
          <label className="block text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Driver Name</label>
          <input 
            type="text"
            value={data.driver_name}
            onChange={(e) => setData({ ...data, driver_name: e.target.value })}
            className={`w-full bg-slate-800 border-2 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none ${errors.driver_name ? 'border-red-500' : 'border-slate-700'}`}
            placeholder="Enter driver name"
          />
        </div>

        {/* Mobile No */}
        <div>
          <label className="block text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Driver Mobile No</label>
          <input 
            type="tel"
            maxLength={10}
            value={data.driver_mobile}
            onChange={(e) => setData({ ...data, driver_mobile: e.target.value.replace(/\D/g, '') })}
            className={`w-full bg-slate-800 border-2 rounded-xl px-4 py-4 text-white font-mono focus:ring-2 focus:ring-blue-500 transition-all outline-none ${errors.driver_mobile ? 'border-red-500' : 'border-slate-700'}`}
            placeholder="10 digit mobile number"
          />
          {errors.driver_mobile && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.driver_mobile}</p>}
        </div>

        {/* Vehicle No */}
        <div>
          <label className="block text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Vehicle No</label>
          <input 
            type="text"
            value={data.vehicle_no}
            onChange={(e) => setData({ ...data, vehicle_no: e.target.value.toUpperCase() })}
            className={`w-full bg-slate-800 border-2 rounded-xl px-4 py-4 text-white font-mono focus:ring-2 focus:ring-blue-500 transition-all outline-none ${errors.vehicle_no ? 'border-red-500' : 'border-slate-700'}`}
            placeholder="MH12AB1234"
          />
          {errors.vehicle_no && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.vehicle_no}</p>}
        </div>

        {/* LR No */}
        <div>
          <label className="block text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">LR No</label>
          <input 
            type="text"
            value={data.lr_no}
            onChange={(e) => setData({ ...data, lr_no: e.target.value })}
            className={`w-full bg-slate-800 border-2 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none ${errors.lr_no ? 'border-red-500' : 'border-slate-700'}`}
            placeholder="Enter LR number"
          />
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-6 bg-slate-800/50 backdrop-blur-md border-t border-slate-700">
        <button
          disabled={!isValid}
          onClick={handleContinue}
          className="w-full py-5 bg-blue-600 disabled:bg-slate-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-sm"
        >
          Confirm & Start Scan
        </button>
      </div>
    </div>
  );
};

export default LogisticsDetailsScreen;
