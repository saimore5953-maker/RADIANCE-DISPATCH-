
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/database';
import { Dispatch, ScanRecord, PartSummary, DispatchStatus, ScanStatus } from '../types';
import { generateExports, triggerDownload, shareFile, ExportResult } from '../services/exportService';
import { settingsService } from '../services/settingsService';
import { logger } from '../services/logger';

interface ExtendedPartSummary extends PartSummary {
  is_manual: boolean;
}

interface Props {
  dispatchId: string;
  isFinalizedView?: boolean;
  onBack: () => void;
  onNewDispatch?: () => void;
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
  const [isExporting, setIsExporting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [dispatchId]);

  const load = async () => {
    const d = await dbService.getDispatchById(dispatchId);
    const s = await dbService.getScansForDispatch(dispatchId);
    setDispatch(d);
    setScans(s);
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

  const handleFinalize = async () => {
    setIsFinalizing(true);
    const updatedDispatch = { ...dispatch, status: DispatchStatus.COMPLETED, end_time: new Date().toISOString() };
    await dbService.updateDispatch(updatedDispatch);
    await load();
    setToast("Batch Finalized");
    setIsFinalizing(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-base-200 overflow-hidden">
      <div className="navbar bg-base-100 shadow-sm px-4">
        <div className="flex-none">
          <button onClick={onBack} className="btn btn-ghost btn-circle">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
        <div className="flex-1">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight">{dispatch.dispatch_id}</h2>
            <p className="text-[10px] opacity-50 font-bold uppercase truncate max-w-[120px]">{dispatch.customer_name}</p>
          </div>
        </div>
        <div className="flex-none">
          <button onClick={() => generateExports(dispatch, scans, summaryList).then(res => triggerDownload(res.excel))} className="btn btn-ghost text-success btn-circle">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-4m3 4v-4m3 4v-4m-9 4h9a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>
        </div>
      </div>

      <div className="tabs tabs-box bg-base-100 mx-4 mt-4 mb-2 p-1 rounded-2xl shadow-sm">
        <button onClick={() => setActiveTab('SUMMARY')} className={`tab flex-1 uppercase tracking-widest text-[10px] font-black ${activeTab === 'SUMMARY' ? 'tab-active btn-primary text-white rounded-xl' : ''}`}>Summary</button>
        <button onClick={() => setActiveTab('LOG')} className={`tab flex-1 uppercase tracking-widest text-[10px] font-black ${activeTab === 'LOG' ? 'tab-active btn-primary text-white rounded-xl' : ''}`}>Log</button>
        <button onClick={() => setActiveTab('EDIT')} className={`tab flex-1 uppercase tracking-widest text-[10px] font-black ${activeTab === 'EDIT' ? 'tab-active btn-primary text-white rounded-xl' : ''}`}>Edit</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        <div className="card bg-neutral text-neutral-content shadow-xl">
          <div className="card-body grid grid-cols-2 gap-4 p-6">
            <div className="col-span-2 border-b border-white/10 pb-2 mb-2">
              <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block">Customer Batch</span>
              <span className="text-lg font-black">{dispatch.customer_name}</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block">Total Qty</span>
              <span className="text-2xl font-mono font-black">{summaryList.reduce((a, b) => a + b.total_qty, 0)}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase opacity-60 tracking-widest block">Box Count</span>
              <span className="text-2xl font-mono font-black">{scans.length}</span>
            </div>
          </div>
        </div>

        {activeTab === 'SUMMARY' && (
          <div className="space-y-2">
            {summaryList.map(s => (
              <div key={s.part_no} className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body p-4 flex-row justify-between items-center">
                  <div>
                    <h3 className="font-mono font-black text-primary">{s.part_no}</h3>
                    <p className="text-[10px] opacity-60 uppercase font-bold">{s.part_name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-mono font-black">{s.total_qty}</div>
                    <div className="badge badge-sm badge-neutral text-[9px] font-black">{s.boxes} BOXES</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Other tabs omitted for brevity but following the same pattern */}
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-base-100/80 backdrop-blur-md border-t border-base-300 z-30 pb-10">
        {dispatch.status === DispatchStatus.DRAFT ? (
          <button onClick={handleFinalize} disabled={isFinalizing} className="btn btn-primary btn-block btn-lg shadow-xl shadow-primary/20">
            {isFinalizing ? <span className="loading loading-spinner"></span> : <><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> FINALIZE BATCH</>}
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn btn-disabled btn-block btn-lg flex-1">FINALIZED ✅</button>
            <button onClick={onBack} className="btn btn-neutral btn-lg flex-1">HOME</button>
          </div>
        )}
      </div>

      {toast && (
        <div className="toast toast-center toast-bottom z-50 mb-32">
          <div className="alert alert-success shadow-2xl font-black uppercase text-xs tracking-widest py-3 px-6">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchDetailScreen;
