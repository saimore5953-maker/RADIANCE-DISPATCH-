
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../services/database';
import { performOCR } from '../services/gemini';
import { Dispatch, ScanRecord, ScanStatus, PartSummary, DispatchStatus } from '../types';

interface Props {
  dispatch: Dispatch;
  onBack: () => void;
  onComplete: (dispatchId: string) => void;
}

const ScanScreen: React.FC<Props> = ({ dispatch, onBack, onComplete }) => {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [summaries, setSummaries] = useState<PartSummary[]>([]);
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    const data = await dbService.getScansForDispatch(dispatch.dispatch_id);
    setScans(data);
    updateSummaries(data);
  }, [dispatch.dispatch_id]);

  useEffect(() => {
    const handleResize = () => setScreenHeight(window.innerHeight);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExitConfirm(true);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("Camera access requires a secure (HTTPS) connection or a modern browser.");
      return;
    }

    stopCamera();

    const constraintOptions = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: { ideal: 'environment' } } },
      { video: true }
    ];

    let success = false;
    
    for (const constraints of constraintOptions) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          success = true;
          setErrorMsg(null);
          break; 
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      } catch (err: any) {
        console.warn(`Constraint attempt failed (${err.name}):`, constraints);
      }
    }

    if (!success) {
      setErrorMsg("Could not connect to any camera. Please check permissions.");
    }
  }, [stopCamera]);

  useEffect(() => {
    loadData();
    startCamera();
    return stopCamera;
  }, [loadData, startCamera, stopCamera]);

  const updateSummaries = (data: ScanRecord[]) => {
    const groups = data.reduce((acc, scan) => {
      if (!acc[scan.part_no]) {
        acc[scan.part_no] = { 
          part_no: scan.part_no, 
          part_name: scan.part_name, 
          boxes: 0, 
          total_qty: 0 
        };
      }
      acc[scan.part_no].boxes += 1;
      acc[scan.part_no].total_qty += scan.qty_nos;
      return acc;
    }, {} as Record<string, PartSummary>);
    setSummaries(Object.values(groups));
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    
    canvasRef.current.width = videoRef.current.videoWidth || 1280;
    canvasRef.current.height = videoRef.current.videoHeight || 720;
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
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
        ocr_text_hash: btoa(ocrResult.rawText).slice(0, 10),
        image_phash: 'CLOUD_GEMINI_SOURCE',
      };
      await saveScan(newScan);
    } catch (err: any) {
      alert(err.message || "Cloud Detection failed. Try manual entry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveScan = async (scan: ScanRecord) => {
    await dbService.addScan(scan);
    setLastScan(scan);
    loadData();
    setTimeout(() => setLastScan(null), 3000);
  };

  const handleDiscard = async () => {
    await dbService.discardDispatch(dispatch.dispatch_id);
    onBack();
  };

  const handleTouchStart = () => {
    longPressTimerRef.current = window.setTimeout(() => setShowExitConfirm(true), 2000);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div 
      className="flex-1 flex flex-col bg-slate-900 relative select-none overflow-hidden"
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. TOP: LIVE SUMMARY / VIEWFINDER */}
      <div className="relative flex-1 bg-black overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transition-opacity duration-500 ${errorMsg ? 'opacity-0' : 'opacity-80'}`}
        />
        
        {errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900/90 backdrop-blur-xl z-50">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight uppercase">Hardware Connection Failed</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-xs">{errorMsg}</p>
            <button 
              onClick={() => startCamera()}
              className="px-8 py-4 bg-white text-slate-900 font-black rounded-2xl active:scale-95 transition-all text-xs tracking-[0.2em] uppercase shadow-2xl"
            >
              Initialize Camera
            </button>
          </div>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
        
        {!errorMsg && (
          <div className="absolute inset-0 border-[2px] border-white/10 m-8 rounded-3xl pointer-events-none flex items-center justify-center">
             <div className="w-64 h-32 border-2 border-blue-500/50 rounded-xl relative">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500"></div>
             </div>
          </div>
        )}

        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="absolute top-6 right-6 p-3 bg-black/40 backdrop-blur-md text-white rounded-2xl active:scale-90 transition-all z-20"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
        </button>

        <button 
          onClick={() => setShowExitConfirm(true)}
          className="absolute top-6 left-6 p-3 bg-black/40 backdrop-blur-md text-white rounded-2xl active:scale-90 transition-all z-20"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {!errorMsg && (
          <div className="absolute top-20 right-6 flex flex-col gap-2 z-20">
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Boxes</p>
                  <p className="text-xl font-mono font-bold text-white leading-none">{scans.length}</p>
              </div>
          </div>
        )}
      </div>

      {/* 2. BOTTOM: CONTROLS */}
      <div className="bg-slate-900 p-8 pt-4 pb-12 flex flex-col items-center">
        {lastScan && (
          <div className="mb-6 bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-blue-500/20 animate-in slide-in-from-bottom-2 duration-300">
             <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Last Accepted</p>
             <p className="font-bold text-lg">{lastScan.part_no} x {lastScan.qty_nos}</p>
          </div>
        )}

        <div className="flex items-center gap-12">
            <button 
                onClick={captureAndScan}
                disabled={isProcessing || !!errorMsg}
                className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all ${
                    isProcessing ? 'border-slate-700 bg-slate-800' : 'border-white bg-blue-600 shadow-2xl shadow-blue-500/40 active:scale-90 hover:bg-blue-500'
                } ${errorMsg ? 'opacity-20 border-slate-700 grayscale cursor-not-allowed' : ''}`}
            >
                {isProcessing ? (
                   <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                )}
            </button>
        </div>

        <button 
            onClick={() => onComplete(dispatch.dispatch_id)}
            className="mt-10 w-full py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl border border-slate-700 active:bg-slate-700 transition-all uppercase tracking-[0.3em] text-[10px]"
        >
            DISPATCH DETAILS
        </button>
      </div>

      {isDrawerOpen && (
        <>
            <div className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsDrawerOpen(false)}></div>
            <div className="fixed inset-x-0 bottom-0 z-[110] bg-white rounded-t-[2.5rem] shadow-2xl p-6 pt-4 flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-300">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 shrink-0"></div>
                <h2 className="text-lg font-bold text-slate-900 mb-6 px-2">Dispatch Controls</h2>
                <div className="overflow-y-auto space-y-2 pb-10">
                    <button onClick={() => { setIsDrawerOpen(false); onComplete(dispatch.dispatch_id); }} className="w-full flex items-center gap-4 p-5 bg-blue-50 text-blue-700 rounded-2xl text-left active:scale-[0.98] transition-all">
                        <div className="bg-blue-600 text-white p-2 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
                        <div className="flex-1"><p className="font-bold">Dispatch Details</p><p className="text-[10px] opacity-60 uppercase font-bold">Review current progress</p></div>
                    </button>
                    <button onClick={() => { setIsDrawerOpen(false); setShowDiscardConfirm(true); }} className="w-full flex items-center gap-4 p-5 bg-red-50 text-red-700 rounded-2xl text-left active:scale-[0.98] transition-all">
                        <div className="bg-red-600 text-white p-2 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
                        <div className="flex-1"><p className="font-bold text-red-700">Exit without saving</p><p className="text-[10px] opacity-60 uppercase font-bold">Discard all scans</p></div>
                    </button>
                </div>
            </div>
        </>
      )}

      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Discard this dispatch?</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">This will delete this dispatch and all scanned data. This cannot be undone.</p>
                <div className="space-y-3">
                    <button onClick={handleDiscard} className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs">DISCARD & EXIT</button>
                    <button onClick={() => setShowDiscardConfirm(false)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-xs">CANCEL</button>
                </div>
            </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Save Progress?</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">Your current scans are securely cached. You can return to this session anytime.</p>
                <div className="space-y-3">
                    <button onClick={onBack} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl active:scale-95 transition-all">SAVE & EXIT</button>
                    <button onClick={() => setShowExitConfirm(false)} className="w-full py-4 text-slate-400 font-bold">CANCEL</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ScanScreen;
