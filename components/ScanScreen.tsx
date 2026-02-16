
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
    <div className="flex-1 flex flex-col bg-slate-900 relative select-none overflow-hidden">
      {/* Viewfinder area */}
      <div className="relative flex-1 bg-black">
        <video 
          ref={videoRef} 
          autoPlay playsInline muted 
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Simple Targeting Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-12">
          <div className="w-full aspect-[4/3] border-2 border-white/30 rounded-2xl"></div>
        </div>

        {/* Top Actions */}
        <div className="absolute top-6 inset-x-6 flex justify-between items-center z-20">
          <button onClick={() => setShowExitConfirm(true)} className="btn btn-circle bg-black/50 border-white/20 text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="badge badge-lg bg-black/60 border-white/20 text-white font-mono h-10 px-4">
            BOXES: {scans.length}
          </div>

          <button onClick={() => setIsDrawerOpen(true)} className="btn btn-circle bg-black/50 border-white/20 text-white">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
          </button>
        </div>

        {lastScan && (
          <div className="absolute bottom-6 inset-x-6 z-20">
            <div className="alert bg-blue-600 text-white border-none shadow-xl">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
              <div>
                <h3 className="font-bold text-[10px] uppercase opacity-80">Captured</h3>
                <div className="text-sm font-bold">{lastScan.part_no} | {lastScan.qty_nos} NOS</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Area */}
      <div className="bg-slate-900 p-8 flex flex-col items-center border-t border-white/5">
        <button 
          onClick={captureAndScan}
          disabled={isProcessing}
          className={`btn btn-circle w-24 h-24 ${isProcessing ? 'btn-disabled bg-slate-700' : 'btn-primary bg-blue-600 border-none shadow-lg'}`}
        >
          {isProcessing ? (
            <span className="loading loading-spinner loading-md"></span>
          ) : (
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>

        <button 
          onClick={() => onComplete(dispatch.dispatch_id)}
          className="btn btn-ghost btn-block mt-6 text-slate-400 text-[10px] font-bold tracking-widest uppercase"
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
              <button onClick={() => { setIsDrawerOpen(false); onComplete(dispatch.dispatch_id); }} className="btn btn-lg btn-block bg-slate-700 border-none text-white flex justify-start gap-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <span>Dispatch Details</span>
              </button>
              <button onClick={() => { setIsDrawerOpen(false); setShowDiscardConfirm(true); }} className="btn btn-lg btn-block btn-error text-white flex justify-start gap-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                <span>Discard Batch</span>
              </button>
              <button onClick={() => setIsDrawerOpen(false)} className="btn btn-ghost btn-block mt-2">CANCEL</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/60" onClick={() => setIsDrawerOpen(false)}></div>
        </div>
      )}

      {/* Discard Confirmation */}
      {showDiscardConfirm && (
        <div className="modal modal-open">
          <div className="modal-box text-center bg-slate-800 sober-border">
            <h3 className="font-bold text-xl text-error mb-2 uppercase">Delete Batch?</h3>
            <p className="py-4 opacity-70">This will permanently erase all data for this dispatch.</p>
            <div className="modal-action flex-col gap-2">
              <button onClick={async () => { await dbService.discardDispatch(dispatch.dispatch_id); onBack(); }} className="btn btn-error text-white btn-block">YES, DISCARD</button>
              <button onClick={() => setShowDiscardConfirm(false)} className="btn btn-ghost btn-block">CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation */}
      {showExitConfirm && (
        <div className="modal modal-open">
          <div className="modal-box text-center bg-slate-800 sober-border">
            <h3 className="font-bold text-xl mb-2 uppercase">Pause Batch?</h3>
            <p className="py-4 opacity-70">You can resume this dispatch from history later.</p>
            <div className="modal-action flex-col gap-2">
              <button onClick={onBack} className="btn btn-primary bg-blue-600 btn-block border-none">SAVE & EXIT</button>
              <button onClick={() => setShowExitConfirm(false)} className="btn btn-ghost btn-block">CONTINUE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanScreen;
