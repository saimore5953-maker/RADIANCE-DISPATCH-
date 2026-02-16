
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../services/database';
import { performOCR } from '../services/gemini';
import { Dispatch, ScanRecord, ScanStatus, PartSummary, DispatchStatus } from '../types';
import { settingsService } from '../services/settingsService';
import { logger } from '../services/logger';

interface Props {
  dispatch: Dispatch;
  onBack: () => void;
  onComplete: (dispatchId: string) => void;
}

const ScanScreen: React.FC<Props> = ({ dispatch, onBack, onComplete }) => {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
  const [settings] = useState(() => settingsService.getSettings());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    const data = await dbService.getScansForDispatch(dispatch.dispatch_id);
    if (isMounted.current) setScans(data);
  }, [dispatch.dispatch_id]);

  useEffect(() => {
    loadData();
    startCamera();
    return stopCamera;
  }, [loadData]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current && isMounted.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      if (isMounted.current) setErrorMsg("Camera access failed. Check permissions.");
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) {
      setIsProcessing(false);
      return;
    }
    
    // Resize image logic
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    const MAX_EDGE = 1024;
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;

    if (videoWidth > videoHeight) {
      if (videoWidth > MAX_EDGE) {
        targetWidth = MAX_EDGE;
        targetHeight = (videoHeight / videoWidth) * MAX_EDGE;
      }
    } else {
      if (videoHeight > MAX_EDGE) {
        targetHeight = MAX_EDGE;
        targetWidth = (videoWidth / videoHeight) * MAX_EDGE;
      }
    }

    canvasRef.current.width = targetWidth;
    canvasRef.current.height = targetHeight;
    context.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight);
    
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];

    // Logging timeout as requested
    console.log("OCR timeout seconds =", settings.ocrTimeoutSec);
    logger.info(`Starting OCR with ${settings.ocrTimeoutSec}s timeout`);

    try {
      // performOCR service internally handles the settings-based timeout via AbortController
      const ocrResult = await performOCR(base64);
      
      const newScan: ScanRecord = {
        id: crypto.randomUUID(),
        dispatch_id: dispatch.dispatch_id,
        timestamp: new Date().toISOString(),
        part_no: ocrResult.partNo,
        part_name: ocrResult.partName,
        qty_nos: ocrResult.qty,
        status: ScanStatus.ACCEPTED,
        ocr_text_raw: ocrResult.rawText,
        ocr_confidence: ocrResult.confidence,
        ocr_text_hash: 'CLOUD',
        image_phash: 'CLOUD',
      };

      await dbService.addScan(newScan);
      
      if (isMounted.current) {
        setLastScan(newScan);
        loadData();
        setTimeout(() => { if (isMounted.current) setLastScan(null); }, 3000);
      }
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted') || err.message === 'OCR_TIMEOUT';
      if (isTimeout) {
        alert(`OCR taking too long (exceeded ${settings.ocrTimeoutSec}s). Please try again.`);
      } else {
        alert(err.message || "Detection failed.");
      }
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 h-screen w-full relative select-none overflow-hidden">
      {/* SCANNER VIEWPORT */}
      <div className="flex-1 relative bg-black overflow-hidden flex flex-col">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Targeting Overlay (Controlled by Settings) */}
        {settings.showOcrViewport && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-12">
            <div className="w-full aspect-[4/3] border-2 border-white/20 rounded-2xl relative">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-sm"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-sm"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-sm"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-sm"></div>
            </div>
          </div>
        )}

        {/* Top Actions */}
        <div className="absolute top-6 inset-x-6 flex justify-between items-center z-20">
          <button onClick={() => setShowExitConfirm(true)} className="btn btn-circle bg-black/40 border-white/10 text-white backdrop-blur-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="badge badge-lg bg-black/50 border-white/10 text-white font-mono h-10 px-6 backdrop-blur-md">
            SCANS: {scans.length}
          </div>

          <button onClick={() => setIsDrawerOpen(true)} className="btn btn-circle bg-black/40 border-white/10 text-white backdrop-blur-md">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
          </button>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] z-30 flex items-center justify-center">
            <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/10 flex flex-col items-center gap-4 animate-in zoom-in duration-200">
               <span className="loading loading-spinner loading-lg text-blue-500"></span>
               <p className="text-white font-bold uppercase tracking-widest text-[10px]">Reading tag...</p>
            </div>
          </div>
        )}

        {/* Captured Feedback */}
        {lastScan && !isProcessing && (
          <div className="absolute bottom-6 inset-x-6 z-20">
            <div className="alert bg-blue-600 text-white border-none shadow-2xl animate-in slide-in-from-bottom duration-300">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
              <div>
                <h3 className="font-bold text-[10px] uppercase opacity-80 tracking-widest">Captured</h3>
                <div className="text-sm font-bold truncate">{lastScan.part_no} | {lastScan.qty_nos} NOS</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Area */}
      <div className="bg-slate-900 px-8 py-4 flex flex-col items-center border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40">
        
        {/* Diagnostic Timeout Line (Subtle) */}
        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-3 opacity-60">
          OCR timeout: {settings.ocrTimeoutSec}s
        </p>

        <button 
          onClick={captureAndScan}
          disabled={isProcessing}
          className={`btn btn-circle w-20 h-20 ${isProcessing ? 'btn-disabled bg-slate-800' : 'bg-blue-600 hover:bg-blue-500 border-none shadow-xl active:scale-95'}`}
        >
          {isProcessing ? (
            <span className="loading loading-spinner loading-md text-slate-500"></span>
          ) : (
            <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center">
               <div className="w-12 h-12 bg-white rounded-full"></div>
            </div>
          )}
        </button>

        <button 
          onClick={() => onComplete(dispatch.dispatch_id)}
          className="btn btn-ghost btn-block mt-3 text-slate-400 text-[10px] font-black tracking-widest uppercase hover:bg-white/5 h-10 min-h-0"
        >
          Review Dispatch
        </button>
      </div>

      {/* Control Modal */}
      {isDrawerOpen && (
        <div className="modal modal-open modal-bottom">
          <div className="modal-box bg-slate-800 rounded-t-3xl p-6 text-white border-t border-white/10">
            <h3 className="font-bold text-lg mb-6 uppercase tracking-widest">Options</h3>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => { setIsDrawerOpen(false); onComplete(dispatch.dispatch_id); }} className="btn btn-lg btn-block bg-slate-700 border-none text-white flex justify-start gap-4 h-16 rounded-2xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <span className="font-bold uppercase tracking-widest text-sm">Dispatch Details</span>
              </button>
              <button onClick={() => { setIsDrawerOpen(false); setShowDiscardConfirm(true); }} className="btn btn-lg btn-block btn-error text-white flex justify-start gap-4 h-16 rounded-2xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                <span className="font-bold uppercase tracking-widest text-sm">Discard Batch</span>
              </button>
              <button onClick={() => setIsDrawerOpen(false)} className="btn btn-ghost btn-block mt-2 font-bold uppercase tracking-widest">CANCEL</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/70" onClick={() => setIsDrawerOpen(false)}></div>
        </div>
      )}

      {/* Discard Confirmation */}
      {showDiscardConfirm && (
        <div className="modal modal-open">
          <div className="modal-box text-center bg-slate-800 border border-white/10 rounded-3xl p-8">
            <h3 className="font-black text-xl text-red-500 mb-2 uppercase tracking-tighter">Delete Batch?</h3>
            <p className="py-4 opacity-70 text-sm">This will permanently erase all captured data for this dispatch. This action cannot be undone.</p>
            <div className="modal-action flex-col gap-2">
              <button onClick={async () => { await dbService.discardDispatch(dispatch.dispatch_id); onBack(); }} className="btn btn-error text-white btn-block h-14 rounded-xl font-bold uppercase tracking-widest">YES, DISCARD</button>
              <button onClick={() => setShowDiscardConfirm(false)} className="btn btn-ghost btn-block h-12 rounded-xl font-bold uppercase tracking-widest">CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation */}
      {showExitConfirm && (
        <div className="modal modal-open">
          <div className="modal-box text-center bg-slate-800 border border-white/10 rounded-3xl p-8">
            <h3 className="font-black text-xl mb-2 uppercase tracking-tighter">Pause Batch?</h3>
            <p className="py-4 opacity-70 text-sm">You can safely resume this dispatch session from your history logs later.</p>
            <div className="modal-action flex-col gap-2">
              <button onClick={onBack} className="btn btn-primary bg-blue-600 btn-block border-none h-14 rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20">SAVE & EXIT</button>
              <button onClick={() => setShowExitConfirm(false)} className="btn btn-ghost btn-block h-12 rounded-xl font-bold uppercase tracking-widest">CONTINUE SCANNING</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanScreen;
