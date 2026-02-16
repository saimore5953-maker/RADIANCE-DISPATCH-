
import React, { useState, useEffect } from 'react';
import { dbService } from './services/database';
import { AuthState, Dispatch, DispatchStatus } from './types';
import LoginScreen from './components/LoginScreen';
import HomeScreen from './components/HomeScreen';
import ScanScreen from './components/ScanScreen';
import HistoryScreen from './components/HistoryScreen';
import DispatchDetailScreen from './components/DispatchDetailScreen';
import CustomerSelectionScreen from './components/CustomerSelectionScreen';
import LogisticsDetailsScreen from './components/LogisticsDetailsScreen';
import SettingsScreen from './components/SettingsScreen';
import { logger } from './services/logger';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ operatorId: null, isLoggedIn: false });
  const [currentView, setCurrentView] = useState<'LOGIN' | 'HOME' | 'SCAN' | 'HISTORY' | 'DETAIL' | 'SUMMARY' | 'CUSTOMER_SELECT' | 'LOGISTICS_DETAILS' | 'SETTINGS'>('LOGIN');
  const [activeDispatch, setActiveDispatch] = useState<Dispatch | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [isDbReady, setIsDbReady] = useState(false);
  const [tempCustomer, setTempCustomer] = useState<string | null>(null);

  useEffect(() => {
    dbService.init().then(() => {
      setIsDbReady(true);
      logger.info('Digital Core initialized.');
    }).catch(err => logger.error('Core init failed.', err));
  }, []);

  const handleLogin = (id: string) => {
    setAuth({ operatorId: id, isLoggedIn: true });
    setCurrentView('HOME');
  };

  const handleLogout = () => {
    setAuth({ operatorId: null, isLoggedIn: false });
    setCurrentView('LOGIN');
  };

  const initiateNewDispatch = () => setCurrentView('CUSTOMER_SELECT');

  const handleCustomerSelected = (name: string) => {
    setTempCustomer(name);
    setCurrentView('LOGISTICS_DETAILS');
  };

  const finalizeCreateDispatch = async (logistics: { driver_name: string; driver_mobile: string; vehicle_no: string; lr_no: string }) => {
    if (!tempCustomer) return;
    const nextNo = await dbService.getNextDispatchNo();
    const date = new Date();
    const dateKey = date.toISOString().slice(0, 10).replace(/-/g, '');
    const dailySeq = await dbService.getDailySeq(dateKey);
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
    
    const newDispatch: Dispatch = {
      id: crypto.randomUUID(),
      dispatch_no: nextNo,
      dispatch_id: `DSP-${dateStr}-${String(dailySeq).padStart(2, '0')}`,
      operator_id: auth.operatorId || 'UNKNOWN',
      customer_name: tempCustomer,
      driver_name: logistics.driver_name,
      driver_mobile: logistics.driver_mobile,
      vehicle_no: logistics.vehicle_no,
      lr_no: logistics.lr_no,
      start_time: new Date().toISOString(),
      status: DispatchStatus.DRAFT,
      total_boxes_cached: 0,
      total_qty_cached: 0,
      parts_count_cached: 0,
    };
    
    await dbService.createDispatch(newDispatch);
    setActiveDispatch(newDispatch);
    setCurrentView('SCAN');
    setTempCustomer(null);
  };

  const resumeDispatch = (dispatch: Dispatch) => {
    setActiveDispatch(dispatch);
    setCurrentView('SCAN');
  };

  if (!isDbReady) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-950">
        <div className="text-center relative">
          <div className="loading loading-spinner loading-lg text-primary mb-6"></div>
          <p className="text-xl font-black uppercase tracking-[0.4em] text-white">Radiance</p>
          <div className="h-[2px] w-24 bg-primary/20 mx-auto mt-2 overflow-hidden relative">
             <div className="absolute inset-0 bg-primary w-1/2 animate-[slide_2s_infinite]"></div>
          </div>
          <p className="text-[8px] text-primary font-bold uppercase tracking-widest mt-4 opacity-40 italic">Booting Industrial Protocol...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen w-full overflow-hidden flex flex-col relative bg-transparent">
      {currentView === 'LOGIN' && <LoginScreen onLogin={handleLogin} />}
      {currentView === 'HOME' && (
        <HomeScreen 
          operatorId={auth.operatorId!} 
          onStart={initiateNewDispatch} 
          onHistory={() => setCurrentView('HISTORY')}
          onLogout={handleLogout}
          onOpenSettings={() => setCurrentView('SETTINGS')}
        />
      )}
      {currentView === 'SETTINGS' && <SettingsScreen onBack={() => setCurrentView('HOME')} />}
      {currentView === 'CUSTOMER_SELECT' && <CustomerSelectionScreen onSelect={handleCustomerSelected} onBack={() => setCurrentView('HOME')} />}
      {currentView === 'LOGISTICS_DETAILS' && <LogisticsDetailsScreen onComplete={finalizeCreateDispatch} onBack={() => setCurrentView('CUSTOMER_SELECT')} />}
      {currentView === 'SCAN' && activeDispatch && <ScanScreen dispatch={activeDispatch} onBack={() => setCurrentView('HOME')} onComplete={(id) => { setSelectedDispatchId(id); setCurrentView('DETAIL'); }} />}
      {currentView === 'HISTORY' && (
        <HistoryScreen 
          operatorId={auth.operatorId!}
          onBack={() => setCurrentView('HOME')}
          onSelect={(id) => { setSelectedDispatchId(id); setCurrentView('DETAIL'); }}
          onResume={resumeDispatch}
        />
      )}
      {currentView === 'DETAIL' && selectedDispatchId && (
        <DispatchDetailScreen 
          dispatchId={selectedDispatchId} 
          onBack={() => setCurrentView('HISTORY')}
          onContinueScanning={resumeDispatch}
        />
      )}
    </div>
  );
};

export default App;
