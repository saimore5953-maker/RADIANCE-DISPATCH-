
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../services/database';
import { performOCR } from '../services/gemini';
import { Dispatch, ScanRecord, ScanStatus, PartSummary, DispatchStatus } from '../types';
import { settingsService } from '../services/settingsService';
import { logger } from '../services/logger';
import { generateUUID } from '../services/utils';

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

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = async () => {
    if (!isMounted.current) return;
    setErrorMsg(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("Camera API not supported in this browser environment.");
      return;
    }

    const constraintSets = [
      { 
        video: { 
          facingMode: { exact: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      },
      { 
        video: { 
          facingMode: 'environment' 
        } 
      },
      { 
        video: true 
      }
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintSets) {
      try {
        logger.info('Attempting camera access...', constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break; 
      } catch (err: any) {
        lastError = err;
        logger.warn(`Constraint set failed: ${err.name}`);
      }
    }

    if (stream && videoRef.current && isMounted.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
        logger.info('Camera active.');
      } catch (playErr) {
        logger.error('Video play error', playErr);
      }
    } else if (!stream && isMounted.current) {
      logger.error("Camera access failed", lastError);
      setErrorMsg("No camera hardware found or matching your device. Check if another app is using it.");
    }
  };

  useEffect(() => {
    loadData();
    startCamera();
    return stopCamera;
  }, [loadData]);

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    // Ensure video is actually streaming
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      logger.warn("Video stream dimensions are 0. Camera might not be ready.");
      return;
    }

    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) {
      setIsProcessing(false);
      return;
    }
    
    try {
      const video = videoRef.current;
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const uiRect = video.getBoundingClientRect();
      const uiW = uiRect.width;
      const uiH = uiRect.height;

      const scale = Math.max(uiW / vW, uiH / vH);
      const offsetX = (vW * scale - uiW) / 2;
      const offsetY = (vH * scale - uiH) / 2;

      const padding = 48; 
      const vpw = uiW - (padding * 2);
      const vph = vpw * 0.75; 
      const vpx = padding;
      const vpy = (uiH - vph) / 2;

      let sx = (vpx + offsetX) / scale;
      let sy = (vpy + offsetY) / scale;
      let sw = vpw / scale;
      let sh = vph / scale;

      // Final bounds check
      sx = Math.max(0, sx);
      sy = Math.max(0, sy);
      sw = Math.min(vW - sx, sw);
      sh = Math.min(vH - sy, sh);

      if (sw <= 0 || sh <= 0) throw new Error("Invalid viewport calculation");

      const MAX_EDGE = 1024;
      let targetWidth = sw;
      let targetHeight = sh;

      if (sw > MAX_EDGE) {
        targetWidth = MAX_EDGE;
        targetHeight = (sh / sw) * MAX_EDGE;
      }

      canvasRef.current.width = targetWidth;
      canvasRef.current.height = targetHeight;
      
      context.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
      const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      logger.info('Capturing viewport for OCR...');

      const ocrResult = await performOCR(base64);
      
      const newScan: ScanRecord = {
        id: generateUUID(),
        dispatch_id: dispatch.dispatch_id,
        timestamp: new Date().toISOString(),
        part_no: ocrResult.partNo,
        part_name: ocrResult.partName,
        qty_nos: ocrResult.qty, 
        status: ScanStatus.ACCEPTED,
        ocr_text_raw: ocrResult.rawText,
        ocr_confidence: ocrResult.confidence,
        ocr_text_hash: 'SYNC_V1',
        image_phash: 'VIEWPORT_READY',
      } as ScanRecord;

      await dbService.addScan(newScan);
      
      if (isMounted.current) {
        setLastScan(newScan);
        loadData();
        setTimeout(() => { if (isMounted.current) setLastScan(null); }, 3000);
      }
    } catch (err: any) {
      logger.error('Scan process failed', err);
      alert(err.message || "Detection failed. Try holding the camera steadier.");
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0f172a] h-screen w-full relative select-none overflow-hidden">
      {/* CAMERA UNAVAILABLE SCREEN (REQUESTED DESIGN) */}
      {errorMsg && (
        <div className="absolute inset-0 z-50 bg-[#0f172a] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center justify-center mb-10">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h1 className="text-white font-black text-2xl uppercase tracking-widest mb-4">Camera Unavailable</h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[300px] mb-14">
            No camera hardware found or matching your device. Check if another app is using it.
          </p>

          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button 
              onClick={() => onComplete(dispatch.dispatch_id)}
              className="w-full h-16 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-95"
            >
              Manual Entry
            </button>
            
            <button 
              onClick={startCamera}
              className="w-full h-16 border border-slate-700 bg-white/5 hover:bg-white/10 text-slate-200 font-bold uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95"
            >
              Retry Access
            </button>

            <button 
              onClick={onBack}
              className="w-full h-10 text-slate-500 hover:text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-6 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      )}

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
        
        {settings.showOcrViewport && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-12">
            <div className="w-full aspect-[4/3] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.6)]">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
            </div>
          </div>
        )}

        {/* HUD */}
        <div className="absolute top-8 inset-x-6 flex justify-between items-center z-20">
          <button onClick={() => setShowExitConfirm(true)} className="btn btn-circle bg-black/40 border-white/10 text-white backdrop-blur-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="badge badge-lg bg-black/60 border-white/10 text-white font-mono h-12 px-8 backdrop-blur-xl shadow-2xl rounded-full tracking-[0.2em] text-[10px] font-black">
            BATCH: {scans.length}
          </div>

          <button onClick={() => setIsDrawerOpen(true)} className="btn btn-circle bg-black/40 border-white/10 text-white backdrop-blur-xl">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
          </button>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[4px] z-30 flex items-center justify-center">
            <div className="bg-slate-900/90 p-8 rounded-[2.5rem] border border-white/10 flex flex-col items-center gap-6 shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="relative">
                 <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                 </div>
               </div>
               <p className="text-white font-black uppercase tracking-[0.4em] text-[10px] text-center">Reading Dispatch Tag</p>
            </div>
          </div>
        )}

        {lastScan && !isProcessing && (
          <div className="absolute bottom-8 inset-x-8 z-20">
            <div className="alert bg-blue-600 text-white border-none shadow-2xl animate-in slide-in-from-bottom-4 duration-500 rounded-[2rem] p-5">
              <div className="bg-white/20 p-2 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="overflow-hidden">
                <h3 className="font-black text-[9px] uppercase opacity-70 tracking-widest leading-none mb-1">Captured Successfully</h3>
                <div className="text-sm font-black truncate tracking-tight">{lastScan.part_no} • {lastScan.qty_nos} NOS</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="bg-[#0f172a] px-10 py-8 flex flex-col items-center border-t border-white/5 shadow-[0_-10px_60px_rgba(0,0,0,0.8)] z-40">
        <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mb-6 opacity-40">
          Industrial OCR Engine • v1.4
        </p>

        <button 
          onClick={captureAndScan}
          disabled={isProcessing || !!errorMsg}
          className={`group relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${isProcessing || !!errorMsg ? 'bg-slate-800' : 'bg-blue-600 hover:bg-blue-500 active:scale-90 shadow-[0_0_50px_rgba(37,99,235,0.4)]'}`}
        >
          {isProcessing ? (
            <span className="loading loading-spinner loading-md text-slate-400"></span>
          ) : (
            <div className="w-20 h-20 rounded-full border-[6px] border-white/20 flex items-center justify-center transition-transform group-hover:scale-95">
               <div className="w-14 h-14 bg-white rounded-full shadow-inner"></div>
            </div>
          )}
        </button>

        <button 
          onClick={() => onComplete(dispatch.dispatch_id)}
          className="mt-8 text-slate-500 hover:text-white transition-colors text-[10px] font-black tracking-[0.4em] uppercase"
        >
          Review Batch
        </button>
      </div>

      {/* MODALS (UNCHANGED LOGIC, REFINED STYLE) */}
      {isDrawerOpen && (
        <div className="modal modal-open modal-bottom">
          <div className="modal-box bg-slate-900 border-t border-white/10 rounded-t-[3rem] p-8">
            <h3 className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-8">Session Options</h3>
            <div className="space-y-4">
              <button onClick={() => { setIsDrawerOpen(false); onComplete(dispatch.dispatch_id); }} className="w-full h-20 bg-slate-800 hover:bg-slate-700 text-white rounded-3xl flex items-center px-8 gap-6 transition-all active:scale-95">
                <div className="bg-blue-600/20 text-blue-500 p-3 rounded-2xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <span className="font-black uppercase tracking-widest text-sm">Batch Details</span>
              </button>
              <button onClick={() => { setIsDrawerOpen(false); setShowDiscardConfirm(true); }} className="w-full h-20 bg-red-600 hover:bg-red-500 text-white rounded-3xl flex items-center px-8 gap-6 transition-all active:scale-95">
                <div className="bg-white/20 p-3 rounded-2xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                </div>
                <span className="font-black uppercase tracking-widest text-sm">Discard Session</span>
              </button>
              <button onClick={() => setIsDrawerOpen(false)} className="w-full py-4 text-slate-500 font-black uppercase text-[10px] tracking-[0.3em] mt-2">Close</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/80 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
        </div>
      )}

      {showDiscardConfirm && (
        <div className="modal modal-open">
          <div className="modal-box bg-slate-900 border border-white/10 p-10 rounded-[3rem] text-center">
            <h3 className="text-2xl font-black text-red-500 uppercase tracking-tighter mb-4">Wipe Session?</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-10">This will permanently erase all <b>{scans.length} captured scans</b> for this customer. This cannot be undone.</p>
            <div className="flex flex-col gap-4">
              <button onClick={async () => { await dbService.discardDispatch(dispatch.dispatch_id); onBack(); }} className="h-16 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-600/20 active:scale-95 transition-all">Yes, Wipe Data</button>
              <button onClick={() => setShowDiscardConfirm(false)} className="h-12 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="modal modal-open">
          <div className="modal-box bg-slate-900 border border-white/10 p-10 rounded-[3rem] text-center">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Pause Scanning?</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-10">Your current progress is saved locally. You can resume this dispatch from the history log at any time.</p>
            <div className="flex flex-col gap-4">
              <button onClick={onBack} className="h-16 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Save & Exit</button>
              <button onClick={() => setShowExitConfirm(false)} className="h-12 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Continue Scanning</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanScreen;
