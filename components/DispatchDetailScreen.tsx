
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/database';
import { Dispatch, ScanRecord, PartSummary, DispatchStatus, ScanStatus } from '../types';
import { generateExports, triggerDownload } from '../services/exportService';
import { settingsService } from '../services/settingsService';
import { logger } from '../services/logger';

interface ExtendedPartSummary extends PartSummary {
  is_manual: boolean;
}

interface Props {
  dispatchId: string;
  onBack: () => void;
  onContinueScanning?: (dispatch: Dispatch) => void;
}

const DispatchDetailScreen: React.FC<Props> = ({ 
  dispatchId, 
  onBack, 
  onContinueScanning
}) => {
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'LOG' | 'EDIT'>('SUMMARY');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showFinalizeOptions, setShowFinalizeOptions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  
  const [manualPartNo, setManualPartNo] = useState('');
  const [manualPartName, setManualPartName] = useState('');
  const [manualBoxes, setManualBoxes] = useState('1');
  const [manualQtyPerBox, setManualQtyPerBox] = useState('');

  useEffect(() => {
    load();
  }, [dispatchId]);

  const load = async () => {
    const d = await dbService.getDispatchById(dispatchId);
    const s = await dbService.getScansForDispatch(dispatchId);
    if (isMounted.current) {
      setDispatch(d);
      setScans(s);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    if (!isMounted.current) return;
    setToast({ message, type });
    setTimeout(() => { if (isMounted.current) setToast(null); }, 3000);
  };

  if (!dispatch) return null;

  const summaries: Record<string, ExtendedPartSummary> = scans.reduce((acc, scan) => {
    if (!acc[scan.part_no]) {
      acc[scan.part_no] = { 
        part_no: scan.part_no, 
        part_name: scan.part_name, 
        boxes: 0, 
        total_qty: 0,
        is_manual: scan.ocr_text_raw === "MANUAL ENTRY"
      };
    }
    acc[scan.part_no].boxes += 1;
    acc[scan.part_no].total_qty += scan.qty_nos;
    return acc;
  }, {} as Record<string, ExtendedPartSummary>);

  const summaryList = Object.values(summaries);
  const realScans = scans.filter(s => s.ocr_text_raw !== "MANUAL ENTRY");

  const handleManualEntry = async () => {
    if (!manualPartNo || !manualQtyPerBox) return;
    const boxes = parseInt(manualBoxes) || 1;
    const qty = parseInt(manualQtyPerBox) || 0;

    for (let i = 0; i < boxes; i++) {
      const newScan: ScanRecord = {
        id: crypto.randomUUID(),
        dispatch_id: dispatch.dispatch_id,
        timestamp: new Date().toISOString(),
        part_no: manualPartNo.toUpperCase(),
        part_name: manualPartName.toUpperCase() || "MANUAL ENTRY",
        qty_nos: qty,
        status: ScanStatus.ACCEPTED,
        ocr_text_raw: "MANUAL ENTRY",
        ocr_confidence: 1.0,
        ocr_text_hash: 'MANUAL',
        image_phash: 'MANUAL',
      };
      await dbService.addScan(newScan);
    }
    
    setManualPartNo('');
    setManualPartName('');
    setManualBoxes('1');
    setManualQtyPerBox('');
    load();
    showToast("Manual entries added", "success");
  };

  const confirmFinalize = async () => {
    setIsFinalizing(true);
    const updated = { 
      ...dispatch, 
      status: DispatchStatus.COMPLETED, 
      end_time: new Date().toISOString() 
    };
    await dbService.updateDispatch(updated);
    if (isMounted.current) {
      setDispatch(updated);
      setIsFinalizing(false);
    }
  };

  const handleDownload = async () => {
    if (dispatch.status !== DispatchStatus.COMPLETED) {
        await confirmFinalize();
    }
    const res = await generateExports(dispatch, scans, summaryList);
    triggerDownload(res.excel);
  };

  const handleUploadToSheet = async () => {
    const settings = settingsService.getSettings();
    const webhookUrl = settings.webhookUrl;

    if (!webhookUrl) {
      alert("Webhook URL not configured in Settings.");
      return;
    }

    if (dispatch.status !== DispatchStatus.COMPLETED) {
        await confirmFinalize();
    }

    setIsUploading(true);
    
    // PAYLOAD: Sending raw ISO strings for dates as requested for maximum reliability.
    const payload = {
      dispatch_no: dispatch.dispatch_no,
      dispatch_id: dispatch.dispatch_id,
      completed_at: dispatch.end_time || new Date().toISOString(),
      customer_name: dispatch.customer_name,
      dispatch_executive: dispatch.operator_id,
      driver_name: dispatch.driver_name,
      driver_mobile: dispatch.driver_mobile,
      vehicle_no: dispatch.vehicle_no,
      lr_no: dispatch.lr_no,
      summary: summaryList.map(s => ({
        part_no: s.part_no,
        part_name: s.part_name,
        boxes: s.boxes,
        total_qty: s.total_qty
      }))
    };

    logger.info('Initiating spreadsheet upload...', { dispatch_id: dispatch.dispatch_id });

    try {
      // MODE: 'no-cors' is mandatory for Google Apps Script to work across all mobile browsers.
      // HEADERS: 'text/plain' prevents the browser from sending an OPTIONS preflight request.
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      // In no-cors mode, the response is opaque. If fetch doesn't throw, we assume success.
      const updated = { 
        ...dispatch, 
        sheets_synced: true, 
        sheets_synced_at: new Date().toISOString() 
      };
      await dbService.updateDispatch(updated);
      
      if (isMounted.current) {
        setDispatch(updated);
        showToast("Upload requested successfully", "success");
      }
      logger.info('Upload triggered successfully (no-cors mode).');
    } catch (err: any) {
      logger.error('Upload failed.', err);
      showToast(`Upload failed: ${err.message || 'Network error'}`, "error");
    } finally {
      if (isMounted.current) setIsUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl animate-in slide-in-from-top duration-300 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
          {toast.message}
        </div>
      )}

      <div className="navbar bg-slate-800 border-b border-white/5 px-4 h-16 z-30 shadow-md">
        <div className="flex-none">
          <button onClick={onBack} className="btn btn-ghost btn-circle text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
        <div className="flex-1">
          <div>
            <h2 className="text-[10px] font-bold uppercase text-blue-400 tracking-widest">{dispatch.dispatch_id}</h2>
            <p className="text-sm font-bold text-white truncate max-w-[180px]">{dispatch.customer_name}</p>
          </div>
        </div>
        <div className="flex-none">
           <div className={`badge badge-sm font-bold ${dispatch.status === DispatchStatus.COMPLETED ? 'badge-success' : 'badge-primary'} uppercase text-[8px]`}>
            {dispatch.status}
           </div>
        </div>
      </div>

      <div className="flex bg-slate-800 border-b border-white/5 p-1 z-30">
        <button onClick={() => setActiveTab('SUMMARY')} className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'SUMMARY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Packing Summary</button>
        <button onClick={() => setActiveTab('LOG')} className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'LOG' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Full Scan Log</button>
        <button onClick={() => setActiveTab('EDIT')} className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'EDIT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Edit Report</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {activeTab === 'SUMMARY' && (
          <div className="space-y-2">
             {summaryList.length === 0 ? (
               <div className="py-20 text-center opacity-30 uppercase font-bold text-xs tracking-widest">Waiting for data...</div>
             ) : (
               summaryList.map(s => (
                <div key={s.part_no} className="bg-slate-800 sober-border p-4 rounded-xl flex justify-between items-center shadow-sm border border-white/5">
                    <div>
                      <h3 className="font-mono font-bold text-blue-400 text-sm">{s.part_no}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{s.part_name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-white">{s.total_qty}</div>
                      <div className="text-[8px] font-bold uppercase text-slate-500">{s.boxes} BOXES</div>
                    </div>
                </div>
               ))
             )}
          </div>
        )}

        {activeTab === 'LOG' && (
          <div className="space-y-2">
            {realScans.length === 0 ? (
              <div className="py-20 text-center opacity-30 uppercase font-bold text-xs tracking-widest">No scan records</div>
            ) : (
              realScans.map(s => (
                <div key={s.id} className="bg-slate-800/40 p-4 rounded-xl sober-border flex justify-between items-center border border-white/5">
                   <div className="flex gap-4 items-center">
                      <div className="bg-slate-700 p-2 rounded-lg text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold text-white">{s.part_no}</p>
                        <p className="text-[8px] text-slate-500 font-mono">{new Date(s.timestamp).toLocaleTimeString()}</p>
                      </div>
                   </div>
                   <div className="font-mono font-bold text-blue-400">{s.qty_nos}</div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'EDIT' && (
          <div className="space-y-6">
             <div className="bg-slate-800 sober-border p-6 rounded-2xl space-y-4 shadow-lg border border-white/5">
                <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Add Manual Entry</h3>
                <div className="space-y-4">
                  <input value={manualPartNo} onChange={e => setManualPartNo(e.target.value)} placeholder="PART NUMBER" className="input input-bordered w-full bg-slate-900 text-white font-mono uppercase text-sm border-slate-700 focus:border-blue-500" />
                  <input value={manualPartName} onChange={e => setManualPartName(e.target.value)} placeholder="PART NAME (OPTIONAL)" className="input input-bordered w-full bg-slate-900 text-white uppercase text-xs border-slate-700 focus:border-blue-500" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Boxes</span></label>
                      <input type="number" value={manualBoxes} onChange={e => setManualBoxes(e.target.value)} className="input input-bordered bg-slate-900 text-white font-mono border-slate-700 focus:border-blue-500" />
                    </div>
                    <div className="form-control">
                      <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Qty / Box</span></label>
                      <input type="number" value={manualQtyPerBox} onChange={e => setManualQtyPerBox(e.target.value)} className="input input-bordered bg-slate-900 text-white font-mono border-slate-700 focus:border-blue-500" />
                    </div>
                  </div>
                  <button onClick={handleManualEntry} className="btn btn-primary btn-block h-14 font-bold uppercase tracking-widest text-xs rounded-xl border-none shadow-lg">Manual Entry</button>
                </div>
             </div>

             {summaryList.length > 0 && (
               <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1 border-b border-white/5 pb-2">Modify Records</h3>
                  {summaryList.map(s => (
                    <div key={s.part_no} className="bg-slate-800/60 p-4 rounded-xl sober-border flex justify-between items-center border border-white/5">
                        <div>
                          <p className="font-mono font-bold text-white text-xs">{s.part_no}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Stored: {s.boxes} Boxes</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => dbService.removeOneScan(dispatch.dispatch_id, s.part_no).then(load)} className="btn btn-sm btn-outline btn-error border-2 font-bold uppercase text-[9px] px-3 h-10">Remove 1</button>
                          <button onClick={() => dbService.removeAllScansForPart(dispatch.dispatch_id, s.part_no).then(load)} className="btn btn-sm btn-error font-bold uppercase text-[9px] px-3 h-10">Remove All</button>
                        </div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-slate-800/90 backdrop-blur-md border-t border-white/5 z-40 pb-8">
        {activeTab === 'SUMMARY' && (
          <button 
            disabled={scans.length === 0 || isFinalizing}
            onClick={() => {
              if (scans.length === 0) alert("No items to finalize");
              else setShowFinalizeOptions(true);
            }} 
            className="btn btn-primary btn-block h-16 rounded-2xl text-sm font-bold tracking-widest uppercase shadow-xl border-none"
          >
            {isFinalizing ? 'Finalizing...' : 'Finalize'}
          </button>
        )}
        {activeTab === 'LOG' && (
          <button 
            onClick={() => {
              if (dispatch.status === DispatchStatus.COMPLETED) {
                alert("This batch is finalized and cannot be continued.");
              } else {
                onContinueScanning?.(dispatch);
              }
            }}
            className={`btn btn-block h-16 rounded-2xl text-sm font-bold tracking-widest uppercase border-none ${dispatch.status === DispatchStatus.COMPLETED ? 'btn-disabled opacity-40' : 'bg-slate-700 text-white'}`}
          >
            Continue Scanning
          </button>
        )}
        {activeTab === 'EDIT' && (
          <button onClick={() => setActiveTab('SUMMARY')} className="btn btn-ghost btn-block text-[10px] font-bold text-slate-500 tracking-widest uppercase h-14">
            Exit Edit Mode
          </button>
        )}
      </div>

      {showFinalizeOptions && (
        <div className="modal modal-open modal-bottom">
          <div className="modal-box bg-slate-800 rounded-t-3xl p-8 text-white border-t border-white/10">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-8 text-center">Batch Finalize Options</h3>
            <div className="space-y-3">
              <button 
                onClick={() => { setShowFinalizeOptions(false); handleDownload(); }} 
                className="btn btn-lg btn-block bg-blue-600 hover:bg-blue-700 text-white border-none flex justify-start gap-4 h-20 rounded-2xl px-6"
              >
                <div className="bg-white/20 p-2 rounded-xl shadow-inner"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></div>
                <div className="text-left">
                  <p className="font-bold text-sm uppercase tracking-tight">Download Excel</p>
                  <p className="text-[9px] opacity-60 font-bold uppercase tracking-widest">Local Packing Slip</p>
                </div>
              </button>
              
              <button 
                disabled={isUploading}
                onClick={handleUploadToSheet} 
                className={`btn btn-lg btn-block text-white border-none flex justify-start gap-4 h-20 rounded-2xl px-6 transition-all ${dispatch.sheets_synced ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'} disabled:bg-slate-700 disabled:opacity-50`}
              >
                <div className="bg-white/20 p-2 rounded-xl shadow-inner">
                  {isUploading ? <span className="loading loading-spinner loading-xs"></span> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm uppercase tracking-tight">
                    {isUploading ? 'Uploading...' : (dispatch.sheets_synced ? 'Uploaded ✅' : 'Upload to Spreadsheet')}
                  </p>
                  <p className="text-[9px] opacity-60 font-bold uppercase tracking-widest">
                    {isUploading ? 'Contacting Server...' : 'Cloud Data Sync'}
                  </p>
                </div>
              </button>

              <button onClick={() => setShowFinalizeOptions(false)} className="btn btn-ghost btn-block mt-4 text-slate-500 font-bold uppercase text-xs tracking-widest h-12">BACK</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/70" onClick={() => setShowFinalizeOptions(false)}></div>
        </div>
      )}
    </div>
  );
};

export default DispatchDetailScreen;
