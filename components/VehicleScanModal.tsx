
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { performVehicleOCR } from '../services/gemini';
import { logger } from '../services/logger';

interface Props {
  onScan: (vehicleNo: string) => void;
  onClose: () => void;
}

const VehicleScanModal: React.FC<Props> = ({ onScan, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

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
      setErrorMsg("Camera API not supported.");
      return;
    }

    stopCamera();

    const constraintSets = [
      { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'user' } },
      { video: true }
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintSets) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break; 
      } catch (err: any) {
        lastError = err;
      }
    }

    if (stream && videoRef.current && isMounted.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (playErr) {
        videoRef.current.muted = true;
        await videoRef.current.play().catch(e => logger.error('Muted play failed', e));
      }
    } else if (isMounted.current) {
      setErrorMsg(lastError?.message || "Could not access camera.");
    }
  };

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, []);

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
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
      
      // Capture the center area
      const sw = vW * 0.8;
      const sh = sw * 0.3;
      const sx = (vW - sw) / 2;
      const sy = (vH - sh) / 2;

      canvasRef.current.width = 800;
      canvasRef.current.height = (sh / sw) * 800;
      
      context.drawImage(video, sx, sy, sw, sh, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      const result = await performVehicleOCR(base64);
      if (result.vehicleNo && result.vehicleNo !== "UNKNOWN") {
        onScan(result.vehicleNo);
      } else {
        alert("Could not read number plate. Please try again.");
      }
    } catch (err: any) {
      logger.error('Vehicle scan failed', err);
      alert(err.message || "Detection failed.");
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="p-6 flex justify-between items-center bg-slate-900/50 backdrop-blur-md border-b border-white/5">
        <h3 className="text-white font-black uppercase tracking-widest text-sm">Scan Number Plate</h3>
        <button onClick={onClose} className="p-2 text-slate-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Viewport Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
          <div className="w-full aspect-[3/1] border-2 border-blue-500/50 rounded-xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.7)]">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400/50 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-[scan_2s_infinite_linear]"></div>
          </div>
          <p className="mt-6 text-[10px] text-blue-400 font-black uppercase tracking-widest bg-black/40 px-4 py-2 rounded-full">Align Number Plate in Frame</p>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50">
            <div className="loading loading-spinner loading-lg text-blue-500"></div>
            <p className="text-white font-black uppercase tracking-[0.3em] text-[10px]">Analyzing Plate...</p>
          </div>
        )}

        {errorMsg && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-10 text-center">
            <p className="text-red-500 font-bold mb-4">{errorMsg}</p>
            <button onClick={onClose} className="btn btn-primary">Close</button>
          </div>
        )}
      </div>

      <div className="p-10 bg-slate-900 flex flex-col items-center gap-6">
        <button 
          onClick={captureAndScan}
          disabled={isProcessing}
          className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-50"
        >
          <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center">
            <div className="w-10 h-10 bg-white rounded-full"></div>
          </div>
        </button>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tap to Capture</p>
      </div>
    </div>
  );
};

export default VehicleScanModal;
