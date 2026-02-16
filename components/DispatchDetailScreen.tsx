
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/database';
import { Dispatch, ScanRecord, PartSummary, DispatchStatus, ScanStatus } from '../types';
import { generateExports, triggerDownload, shareFile, ExportResult } from '../services/exportService';
import { settingsService } from '../services/settingsService';
import { logger } from '../services/logger';

/**
 * Local interface for UI-extended summary to fix TS inference issues
 */
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
  isFinalizedView = false, 
  onBack, 
  onNewDispatch,
  onContinueScanning
}) => {
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'LOG' | 'EDIT'>('SUMMARY');
  const [isExporting, setIsExporting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [exportedFile, setExportedFile] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  
  const [manualPartNo, setManualPartNo] = useState('');
  const [manualPartName, setManualPartName] = useState('');
  const [manualBoxes, setManualBoxes] = useState('');
  const [manualQtyPerBox, setManualQtyPerBox] = useState('');
  
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState<string | null>(null);
  const [showFinalizedAlert, setShowFinalizedAlert] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  const manualEntryRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const d = await dbService.getDispatchById(dispatchId);
    const s = await dbService.getScansForDispatch(dispatchId);
    setDispatch(d);
    setScans(s);
  };

  useEffect(() => {
    load();
  }, [dispatchId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!dispatch) return null;

  const summaries: Record<string, ExtendedPartSummary> = scans.reduce((acc, scan) => {
    if (!acc[scan.part_no]) {
      acc[scan.part_no] = { 
        part_no: scan.part_no, 
        part_name: scan.part_name, 
        boxes: 0, 
        total_qty: 0,
        is_manual: false
      };
    }
    const item = acc[scan.part_no];
    item.boxes += 1;
    item.total_qty += scan.qty_nos;
    if (scan.ocr_text_raw === "MANUAL ENTRY") {
      item.is_manual = true;
    }
    return acc;
  }, {} as Record<string, ExtendedPartSummary>);

  const summaryList = Object.values(summaries) as ExtendedPartSummary[];
  const filteredScans = scans.filter(s => s.ocr_text_raw !== 'MANUAL ENTRY');

  const handleExport = async (type: 'PDF' | 'EXCEL') => {
    logger.info(`Starting export generation.`, { type, dispatch_id: dispatch.dispatch_id });
    setIsExporting(true);
    setExportError(null);
    try {
      const exportSummaries: PartSummary[] = summaryList.map(s => ({ part_no: s.part_no, part_name: s.part_name, boxes: s.boxes, total_qty: s.total_qty }));
      const results = await generateExports(dispatch, scans, exportSummaries);
      const result = type === 'PDF' ? results.pdf : results.excel;
      logger.info('Export generated successfully.', { path: result.simulatedPath });
      triggerDownload(result);
      setExportedFile(result);
    } catch (err: any) {
      logger.error('Export generation failed.', err);
      setExportError(err.message || "Export failed to write to device storage.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFinalize = async () => {
    if (summaryList.length === 0) {
      alert("No items to finalize. Add scans or manual entries first.");
      return;
    }
    logger.info('Finalizing dispatch.', { dispatch_id: dispatch.dispatch_id });
    setIsFinalizing(true);
    try {
      const updatedDispatch: Dispatch = { ...dispatch, status: DispatchStatus.COMPLETED, end_time: new Date().toISOString(), total_boxes_cached: scans.length, total_qty_cached: summaryList.reduce((a, b) => a + b.total_qty, 0), parts_count_cached: summaryList.length };
      const exportSummaries: PartSummary[] = summaryList.map(s => ({ part_no: s.part_no, part_name: s.part_name, boxes: s.boxes, total_qty: s.total_qty }));
      const exports = await generateExports(updatedDispatch, scans, exportSummaries);
      updatedDispatch.pdf_path = exports.pdf.simulatedPath;
      updatedDispatch.excel_path = exports.excel.simulatedPath;
      updatedDispatch.generated_at = new Date().toISOString();
      await dbService.updateDispatch(updatedDispatch);
      await load();
      setToast("Batch Finalized Successfully");
      setExportedFile(exports.excel);
      logger.info('Dispatch finalized and updated in DB.');
    } catch (err: any) {
      logger.error('Finalization failed.', err);
      setExportError(err.message || "Finalization failed.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleUploadToSheet = async () => {
    if (dispatch.sheets_synced || isUploading) return;
    
    const settings = settingsService.getSettings();
    if (!settings.enableSheetsUpload) {
      alert("Upload to Sheet is disabled in Settings.");
      return;
    }

    logger.info('Starting upload to Google Sheet.', { dispatch_id: dispatch.dispatch_id });
    setIsUploading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const payload = { dispatch_no: dispatch.dispatch_no, dispatch_id: dispatch.dispatch_id, completed_at: dispatch.end_time || new Date().toISOString(), customer_name: dispatch.customer_name, dispatch_executive: dispatch.operator_id, driver_name: dispatch.driver_name, driver_mobile: dispatch.driver_mobile, vehicle_no: dispatch.vehicle_no, lr_no: dispatch.lr_no, summary: summaryList.map(s => ({ part_no: s.part_no, part_name: s.part_name, boxes: s.boxes, total_qty: s.total_qty })) };
      const response = await fetch(settings.webhookUrl, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 0) throw new Error(`Upload failed with status: ${response.status}`);
      
      const resultText = await response.text();
      logger.info('Upload to sheet successful.', { response: resultText });

      try {
        const updatedDispatch = { ...dispatch, sheets_synced: true, sheets_synced_at: new Date().toISOString() };
        await dbService.updateDispatch(updatedDispatch);
        setDispatch(updatedDispatch);
        setToast("Uploaded to Google Sheet");
        logger.info('Dispatch sync status persisted to DB.');
      } catch (dbError) {
        logger.error('CRITICAL: Upload succeeded but failed to persist sync status!', dbError);
        alert('Upload succeeded, but failed to save status locally. Please report this issue.');
      }

    } catch (err: any) {
      logger.error("Sheet Upload Error:", err);
      if (err.name === 'AbortError') {
        alert("Upload failed: Connection timed out. Check your internet.");
      } else {
        alert("Upload failed. Check internet and try again. (CORS/Network Issue)");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleShare = async () => {
    if (exportedFile) {
      const success = await shareFile(exportedFile);
      if (!success) alert("System share not available. File is ready in Downloads folder.");
    }
  };

  const onRemoveOne = async (partNo: string) => {
    logger.info('Removing one box.', { dispatch_id: dispatch.dispatch_id, part_no: partNo });
    await dbService.removeOneScan(dispatch.dispatch_id, partNo);
    await load();
    setToast("Removed 1 box");
  };

  const onRemoveAll = async (partNo: string) => {
    logger.info('Removing all boxes for part.', { dispatch_id: dispatch.dispatch_id, part_no: partNo });
    await dbService.removeAllScansForPart(dispatch.dispatch_id, partNo);
    await load();
    setToast(`Removed all boxes for ${partNo}`);
    setShowDeleteAllConfirm(null);
  };

  const handleAddManual = async () => {
    const boxes = parseInt(manualBoxes);
    const qty = parseInt(manualQtyPerBox);

    if (!manualPartNo.trim() || !manualPartName.trim() || isNaN(boxes) || isNaN(qty) || boxes <= 0 || qty <= 0) {
      alert("Please fill all fields with valid details (Boxes & Qty must be > 0).");
      return;
    }
    logger.info('Adding manual entry.', { dispatch_id: dispatch.dispatch_id, part_no: manualPartNo, boxes, qty });
    for (let i = 0; i < boxes; i++) {
      const newScan: ScanRecord = { id: crypto.randomUUID(), dispatch_id: dispatch.dispatch_id, timestamp: new Date().toISOString(), part_no: manualPartNo.trim().toUpperCase(), part_name: manualPartName.trim().toUpperCase(), qty_nos: qty, status: ScanStatus.ACCEPTED, ocr_text_raw: "MANUAL ENTRY", ocr_confidence: 1.0, ocr_text_hash: 'MANUAL', image_phash: 'MANUAL' };
      await dbService.addScan(newScan);
    }
    setManualPartNo(''); setManualPartName(''); setManualBoxes(''); setManualQtyPerBox('');
    await load();
    setToast(`Added ${boxes} boxes manually`);
  };

  const handleContinueScanningClick = () => {
    if (dispatch.status === DispatchStatus.DRAFT) {
      onContinueScanning?.(dispatch);
    } else {
      setShowFinalizedAlert(true);
    }
  };

  const handleManualEntryScroll = () => manualEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
      {dispatch.exports_outdated && ( <div className="bg-amber-100 p-2 text-center text-[9px] font-bold text-amber-800 uppercase tracking-widest border-b border-amber-200 shrink-0"> Edits made after finalize. Exports need regeneration. </div> )}
      <div className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-600 active:scale-95"> <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /> </svg> </button>
          <div className="flex-1 overflow-hidden">
            <h2 className="text-lg font-bold truncate">{dispatch.dispatch_id}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate"> {dispatch.customer_name} </p>
          </div>
        </div>
        <div className="flex gap-2"> <button disabled={isExporting} onClick={() => handleExport('EXCEL')} className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 active:scale-90 transition-all disabled:opacity-50"> <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> </button> </div>
      </div>
      <div className="flex bg-white border-b px-2 shrink-0 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('SUMMARY')} className={`px-4 py-4 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'SUMMARY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}> Packing Summary </button>
        <button onClick={() => setActiveTab('LOG')} className={`px-4 py-4 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'LOG' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}> Full Scan Log </button>
        <button onClick={() => setActiveTab('EDIT')} className={`px-4 py-4 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === 'EDIT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}> Edit Report </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="bg-slate-900 rounded-2xl p-6 text-white mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"> <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z"/></svg> </div>
          <div className="grid grid-cols-2 gap-4 mb-6 relative z-10 border-b border-white/10 pb-4">
            <div> <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">Executive</span> <span className="text-xs font-bold text-blue-400">{dispatch.operator_id}</span> </div>
            <div> <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">Vehicle</span> <span className="text-xs font-bold text-white">{dispatch.vehicle_no}</span> </div>
            <div> <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">Driver</span> <span className="text-xs font-bold text-white">{dispatch.driver_name}</span> </div>
            <div> <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block">LR No</span> <span className="text-xs font-bold text-white">{dispatch.lr_no}</span> </div>
          </div>
          <div className="grid grid-cols-3 gap-2 relative z-10">
            <div><p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Total Qty</p><p className="text-xl font-mono font-bold leading-none">{dispatch.total_qty_cached}</p><p className="text-[8px] text-slate-500 uppercase mt-1">NOS</p></div>
            <div><p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Total Boxes</p><p className="text-xl font-mono font-bold leading-none">{dispatch.total_boxes_cached}</p><p className="text-[8px] text-slate-500 uppercase mt-1">PACKS</p></div>
            <div><p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Part Types</p><p className="text-xl font-mono font-bold leading-none">{dispatch.parts_count_cached}</p><p className="text-[8px] text-slate-500 uppercase mt-1">SKUS</p></div>
          </div>
        </div>
        {activeTab === 'SUMMARY' && ( <div className="space-y-3"> {summaryList.length === 0 ? ( <p className="text-center text-slate-400 py-10 italic">No grouped data found.</p> ) : summaryList.map(s => ( <div key={s.part_no} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group"> <div className="flex-1 overflow-hidden pr-2"> <p className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{s.part_no}</p> <p className="text-[10px] text-slate-500 uppercase truncate"> {s.part_name} {s.is_manual ? <span className="text-blue-600 font-black">(Manual)</span> : ''} </p> </div> <div className="text-right shrink-0 border-l border-slate-50 pl-4"> <p className="text-blue-600 font-mono font-bold text-lg">{s.total_qty}</p> <p className="text-[9px] text-slate-400 font-bold uppercase">{s.boxes} BOXES</p> </div> </div> ))} </div> )}
        {activeTab === 'LOG' && ( <div className="space-y-4"> <div className="space-y-2"> {filteredScans.length === 0 ? ( <p className="text-center text-slate-400 py-10 italic">No camera scans found.</p> ) : filteredScans.map((scan, i) => ( <div key={scan.id} className="bg-white p-3 rounded-xl text-xs border border-slate-100 flex items-center justify-between select-none"> <div className="flex items-center gap-3"> <div className="w-6 h-6 bg-slate-50 rounded-md flex items-center justify-center text-[10px] font-bold text-slate-400"> {i + 1} </div> <div> <p className="font-bold text-slate-800">{scan.part_no}</p> <p className="text-[9px] text-slate-500 font-mono">{new Date(scan.timestamp).toLocaleTimeString()}</p> </div> </div> <div className="flex items-center gap-2 text-right"> <span className="bg-slate-100 px-2 py-1 rounded-md font-mono font-bold text-slate-700">{scan.qty_nos} NOS</span> </div> </div> ))} </div> </div> )}
        {activeTab === 'EDIT' && ( <div className="space-y-6"> <div className="space-y-3"> <h3 className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Correction Workspace</h3> {summaryList.length === 0 ? ( <p className="text-center text-slate-300 py-6 text-xs italic">No entries to edit.</p> ) : summaryList.map(s => ( <div key={s.part_no} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200"> <div className="flex justify-between items-start mb-4"> <div> <p className="font-mono font-bold text-slate-900">{s.part_no}</p> <p className="text-[9px] text-slate-500 uppercase truncate max-w-[140px]"> {s.part_name} {s.is_manual ? <span className="text-blue-600 font-black">(Manual)</span> : ''} </p> </div> <div className="text-right"> <p className="text-blue-600 font-mono font-bold">{s.total_qty} NOS</p> <p className="text-[9px] text-slate-400 font-bold uppercase">{s.boxes} BOXES</p> </div> </div> <div className="flex gap-2 border-t pt-3"> <button onClick={() => onRemoveOne(s.part_no)} className="flex-1 py-2 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded-lg border border-amber-100 active:scale-95 transition-all"> - 1 Box </button> <button onClick={() => setShowDeleteAllConfirm(s.part_no)} className="flex-1 py-2 bg-red-50 text-red-700 text-[10px] font-bold uppercase rounded-lg border border-red-100 active:scale-95 transition-all"> Remove All </button> </div> </div> ))} </div> <div ref={manualEntryRef} id="manual-entry-form" className="bg-white p-5 rounded-2xl shadow-sm border-2 border-dashed border-slate-200"> <div className="flex items-center gap-2 mb-4"> <div className="bg-blue-600 text-white p-1.5 rounded-lg shrink-0"> <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> </div> <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.15em]">Manual Correction</h3> </div> <div className="space-y-4"> <div> <label className="text-[9px] font-black text-slate-800 uppercase tracking-widest block mb-1 ml-1">Part Number</label> <input type="text" value={manualPartNo} onChange={(e) => setManualPartNo(e.target.value.toUpperCase())} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none caret-slate-900" placeholder="E.G. 3B0005299" /> </div> <div> <label className="text-[9px] font-black text-slate-800 uppercase tracking-widest block mb-1 ml-1">Part Name</label> <input type="text" value={manualPartName} onChange={(e) => setManualPartName(e.target.value.toUpperCase())} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none caret-slate-900" placeholder="E.G. DOOR LOCK COMP" /> </div> <div className="grid grid-cols-2 gap-3"> <div> <label className="text-[9px] font-black text-slate-800 uppercase tracking-widest block mb-1 ml-1">No. of Boxes</label> <input type="number" value={manualBoxes} onChange={(e) => setManualBoxes(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none caret-slate-900" placeholder="0" /> </div> <div> <label className="text-[9px] font-black text-slate-800 uppercase tracking-widest block mb-1 ml-1">Qty Per Box</label> <input type="number" value={manualQtyPerBox} onChange={(e) => setManualQtyPerBox(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none caret-slate-900" placeholder="0" /> </div> </div> <button onClick={handleAddManual} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-all uppercase tracking-widest text-[10px] mt-2 shadow-lg"> Apply Manual Correction </button> </div> </div> </div> )}
      </div>
      <div className="absolute bottom-0 inset-x-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-30 pb-8 flex flex-col gap-3"> {activeTab === 'SUMMARY' && ( dispatch.status === DispatchStatus.DRAFT ? ( <button onClick={handleFinalize} disabled={isFinalizing} className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 transition-all"> <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {isFinalizing ? 'Finalizing...' : 'Finalize Batch'} </button> ) : ( <div className="flex gap-3"> <div className="flex-1 py-4 bg-slate-100 text-slate-400 font-bold rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-xs"> <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Finalized </div> <button onClick={handleUploadToSheet} disabled={dispatch.sheets_synced || isUploading} className={`flex-1 py-4 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 transition-all ${ dispatch.sheets_synced ? 'bg-emerald-100 text-emerald-600 opacity-80' : 'bg-blue-600 text-white shadow-blue-500/20' }`}> {isUploading ? 'Uploading...' : dispatch.sheets_synced ? 'Uploaded ✅' : 'Upload to Sheet'} </button> </div> ) )} {activeTab === 'LOG' && ( <button onClick={handleContinueScanningClick} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 transition-all"> <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Continue Scanning </button> )} {activeTab === 'EDIT' && ( <button onClick={handleManualEntryScroll} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95 transition-all"> <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> Manual Entry </button> )} </div>
      {showFinalizedAlert && ( <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200"> <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl"> <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"> <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> </div> <h3 className="text-xl font-bold text-slate-900 mb-2">Batch Finalized</h3> <p className="text-slate-500 text-sm mb-8 leading-relaxed">This dispatch is finalized and cannot be continued. Please start a new batch to continue scanning.</p> <button onClick={() => setShowFinalizedAlert(false)} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs text-center shadow-xl">OK</button> </div> </div> )}
      {showDeleteAllConfirm && ( <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"> <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl"> <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"> <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> </div> <h3 className="text-xl font-bold text-slate-900 mb-2">Are you sure?</h3> <p className="text-slate-500 text-sm mb-6">Remove all scans for <span className="font-mono font-bold text-slate-900">{showDeleteAllConfirm}</span>? This action cannot be undone.</p> <div className="space-y-3"> <button onClick={() => onRemoveAll(showDeleteAllConfirm)} className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs">REMOVE ALL</button> <button onClick={() => setShowDeleteAllConfirm(null)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-xs">CANCEL</button> </div> </div> </div> )}
      {toast && ( <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-4 duration-300"> <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl text-xs font-bold uppercase tracking-widest whitespace-nowrap"> {toast} </div> </div> )}
      {isExporting && ( <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white text-center"> <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6 shadow-2xl"></div> <h3 className="text-xl font-bold mb-1 uppercase tracking-widest">Generating Report</h3> <p className="text-slate-400 text-xs">Accessing device storage to write export data...</p> </div> )}
      {exportedFile && ( <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm"> <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200"> <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6"> <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> </div> <h3 className="text-2xl font-bold text-slate-900 mb-2">Batch Finalized</h3> <div className="bg-slate-50 p-4 rounded-2xl mb-8 text-left border border-slate-100"> <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Excel Generated</p> <p className="font-mono text-[10px] text-blue-600 break-all leading-relaxed bg-white p-2 rounded-lg border border-blue-50"> {exportedFile.simulatedPath} </p> </div> <div className="space-y-3"> <button onClick={() => triggerDownload(exportedFile)} className="w-full py-5 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all text-lg"> DOWNLOAD EXCEL </button> <button onClick={handleUploadToSheet} disabled={dispatch.sheets_synced || isUploading} className={`w-full py-4 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 transition-all ${ dispatch.sheets_synced ? 'bg-emerald-100 text-emerald-600 opacity-80' : 'bg-blue-600 text-white shadow-blue-500/20' }`}> {isUploading ? 'Uploading...' : dispatch.sheets_synced ? 'Uploaded ✅' : 'Upload to Sheet'} </button> <button onClick={handleShare} className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2"> <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> SHARE REPORT </button> <button onClick={() => setExportedFile(null)} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 uppercase tracking-widest text-[10px]"> DONE </button> </div> </div> </div> )}
      {exportError && ( <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-6"> <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border-4 border-red-500"> <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"> <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> </div> <h3 className="text-xl font-bold text-slate-900 mb-2">Operation Failed</h3> <p className="text-slate-500 text-sm mb-6">{exportError}</p> <button onClick={() => setExportError(null)} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs"> ACKNOWLEDGE </button> </div> </div> )}
    </div>
  );
};

export default DispatchDetailScreen;
