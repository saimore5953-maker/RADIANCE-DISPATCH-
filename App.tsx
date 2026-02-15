
import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from './services/database';
import { AuthState, Dispatch, DispatchStatus, ScanRecord, PartSummary } from './types';
import LoginScreen from './components/LoginScreen';
import HomeScreen from './components/HomeScreen';
import ScanScreen from './components/ScanScreen';
import HistoryScreen from './components/HistoryScreen';
import DispatchDetailScreen from './components/DispatchDetailScreen';
import CustomerSelectionScreen from './components/CustomerSelectionScreen';
import LogisticsDetailsScreen from './components/LogisticsDetailsScreen';
import SettingsScreen from './components/SettingsScreen';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ operatorId: null, isLoggedIn: false });
  const [currentView, setCurrentView] = useState<'LOGIN' | 'HOME' | 'SCAN' | 'HISTORY' | 'DETAIL' | 'SUMMARY' | 'CUSTOMER_SELECT' | 'LOGISTICS_DETAILS' | 'SETTINGS'>('LOGIN');
  const [activeDispatch, setActiveDispatch] = useState<Dispatch | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [isDbReady, setIsDbReady] = useState(false);
  
  // Temporary storage during flow
  const [tempCustomer, setTempCustomer] = useState<string | null>(null);

  useEffect(() => {
    dbService.init().then(() => setIsDbReady(true));
  }, []);

  const handleLogin = (id: string) => {
    setAuth({ operatorId: id, isLoggedIn: true });
    setCurrentView('HOME');
  };

  const handleLogout = () => {
    setAuth({ operatorId: null, isLoggedIn: false });
    setCurrentView('LOGIN');
  };

  const initiateNewDispatch = () => {
    setCurrentView('CUSTOMER_SELECT');
  };

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

  const viewHistory = () => setCurrentView('HISTORY');
  
  const viewDetail = (id: string) => {
    setSelectedDispatchId(id);
    setCurrentView('DETAIL');
  };

  const viewSummary = (id: string) => {
    setSelectedDispatchId(id);
    setCurrentView('SUMMARY');
  };

  if (!isDbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium uppercase tracking-widest">RADIANCE DISPATCH</p>
          <p className="text-slate-400 text-xs mt-2 italic">Loading Secure Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-white shadow-2xl overflow-hidden flex flex-col relative">
      {currentView === 'LOGIN' && <LoginScreen onLogin={handleLogin} />}
      
      {currentView === 'HOME' && (
        <HomeScreen 
          operatorId={auth.operatorId!} 
          onStart={initiateNewDispatch} 
          onHistory={viewHistory}
          onLogout={handleLogout}
          onOpenSettings={() => setCurrentView('SETTINGS')}
        />
      )}

      {currentView === 'SETTINGS' && (
        <SettingsScreen onBack={() => setCurrentView('HOME')} />
      )}

      {currentView === 'CUSTOMER_SELECT' && (
        <CustomerSelectionScreen 
          onSelect={handleCustomerSelected}
          onBack={() => setCurrentView('HOME')}
        />
      )}

      {currentView === 'LOGISTICS_DETAILS' && (
        <LogisticsDetailsScreen 
          onComplete={finalizeCreateDispatch}
          onBack={() => setCurrentView('CUSTOMER_SELECT')}
        />
      )}

      {currentView === 'SCAN' && activeDispatch && (
        <ScanScreen 
          dispatch={activeDispatch} 
          onBack={() => setCurrentView('HOME')}
          onComplete={(id) => viewDetail(id)}
        />
      )}

      {currentView === 'HISTORY' && (
        <HistoryScreen 
          operatorId={auth.operatorId!}
          onBack={() => setCurrentView('HOME')}
          onSelect={viewDetail}
          onResume={resumeDispatch}
        />
      )}

      {(currentView === 'DETAIL' || currentView === 'SUMMARY') && selectedDispatchId && (
        <DispatchDetailScreen 
          dispatchId={selectedDispatchId} 
          isFinalizedView={currentView === 'SUMMARY'}
          onBack={() => currentView === 'SUMMARY' ? setCurrentView('HOME') : setCurrentView('HISTORY')}
          onNewDispatch={initiateNewDispatch}
          onContinueScanning={resumeDispatch}
        />
      )}
    </div>
  );
};

export default App;
