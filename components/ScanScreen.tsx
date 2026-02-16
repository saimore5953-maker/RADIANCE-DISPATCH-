
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../services/database';
import { performOCR } from '../services/gemini';
import { Dispatch, ScanRecord, ScanStatus, PartSummary, DispatchStatus } from '../types';
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadData = useCallback(async () => {
    const data = await dbService.getScansForDispatch(dispatch.dispatch_id);
    setScans(data);
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
        video: { facingMode: { ideal: 'environment' } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setErrorMsg("Camera access failed. Check permissions.");
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
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
        ocr_text_hash: 'CLOUD',
        image_phash: 'CLOUD',
      };
      await dbService.addScan(newScan);
      setLastScan(newScan);
      loadData();
      setTimeout(() => setLastScan(null), 3000);
    } catch (err: any) {
      alert(err.message || "Detection failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral relative select-none overflow-hidden">
      {/* Viewfinder area */}
      <div className="relative flex-1 bg-black">
        <video 
          ref={videoRef} 
          autoPlay playsInline muted 
          className="w-full h-full object-cover opacity-80"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Targeting Overlays */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-12">
          <div className="w-full aspect-[4/3] border-2 border-white/20 rounded-3xl relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl"></div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="absolute top-6 inset-x-6 flex justify-between items-center z-20">
          <button onClick={() => setShowExitConfirm(true)} className="btn btn-circle btn-ghost bg-black/40 backdrop-blur text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="badge badge-lg bg-black/40 backdrop-blur border-white/10 text-white font-mono p-4 h-12">
            BOXES: {scans.length}
          </div>

          <button onClick={() => setIsDrawerOpen(true)} className="btn btn-circle btn-ghost bg-black/40 backdrop-blur text-white">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
          </button>
        </div>

        {lastScan && (
          <div className="absolute bottom-6 inset-x-6 z-20 animate-in slide-in-from-bottom duration-300">
            <div className="alert bg-primary text-primary-content shadow-2xl border-none">
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
              <div>
                <h3 className="font-bold text-xs uppercase tracking-widest opacity-70">Accepted</h3>
                <div className="text-lg font-black">{lastScan.part_no} | {lastScan.qty_nos} NOS</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Area */}
      <div className="bg-neutral p-8 pb-12 flex flex-col items-center">
        <button 
          onClick={captureAndScan}
          disabled={isProcessing}
          className={`btn btn-circle w-28 h-28 border-8 border-white/10 ${isProcessing ? 'btn-disabled' : 'btn-primary'} shadow-[0_0_50px_rgba(59,130,246,0.3)]`}
        >
          {isProcessing ? (
            <span className="loading loading-spinner loading-lg"></span>
          ) : (
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>

        <button 
          onClick={() => onComplete(dispatch.dispatch_id)}
          className="btn btn-ghost btn-block mt-8 text-neutral-content/40 text-[10px] font-black tracking-[0.3em] uppercase"
        >
          Review Packing List
        </button>
      </div>

      {/* daisyUI Drawer/Modal Implementation */}
      {isDrawerOpen && (
        <div className="modal modal-open modal-bottom">
          <div className="modal-box bg-base-100 rounded-t-[2.5rem]">
            <h3 className="font-black text-lg uppercase mb-4 tracking-tight">Session Controls</h3>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => { setIsDrawerOpen(false); onComplete(dispatch.dispatch_id); }} className="btn btn-lg btn-block btn-info text-white flex justify-start gap-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <span>View Summaries</span>
              </button>
              <button onClick={() => { setIsDrawerOpen(false); setShowDiscardConfirm(true); }} className="btn btn-lg btn-block btn-error text-white flex justify-start gap-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                <span>Discard Batch</span>
              </button>
              <button onClick={() => setIsDrawerOpen(false)} className="btn btn-ghost btn-block mt-2">CANCEL</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setIsDrawerOpen(false)}></div>
        </div>
      )}

      {showDiscardConfirm && (
        <div className="modal modal-open">
          <div className="modal-box text-center bg-base-100">
            <h3 className="font-black text-xl text-error mb-2 uppercase">Delete Everything?</h3>
            <p className="py-4 opacity-70">This will permanently erase all scanned data for this batch.</p>
            <div className="modal-action flex-col gap-2">
              <button onClick={async () => { await dbService.discardDispatch(dispatch.dispatch_id); onBack(); }} className="btn btn-error text-white btn-block">YES, DISCARD ALL</button>
              <button onClick={() => setShowDiscardConfirm(false)} className="btn btn-ghost btn-block">BACK TO SCANNER</button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="modal modal-open">
          <div className="modal-box text-center bg-base-100">
            <h3 className="font-black text-xl mb-2 uppercase">Pause Batch?</h3>
            <p className="py-4 opacity-70">Data is cached. You can resume this session later from the home screen.</p>
            <div className="modal-action flex-col gap-2">
              <button onClick={onBack} className="btn btn-neutral btn-block">SAVE & EXIT</button>
              <button onClick={() => setShowExitConfirm(false)} className="btn btn-ghost btn-block">CONTINUE SCANNING</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanScreen;
