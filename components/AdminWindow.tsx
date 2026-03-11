
import React, { useState, useEffect, useRef } from 'react';
import { adminService, Operator, Customer } from '../services/adminService';
import { dbService } from '../services/database';
import { Dispatch } from '../types';
import SettingsScreen, { SettingsScreenHandle } from './SettingsScreen';

interface Props {
  onBack: () => void;
}

const AdminWindow: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'operators' | 'customers' | 'settings' | 'history'>('operators');
  const [operators, setOperators] = useState<Operator[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  
  // Dirty state tracking
  const [operatorsDirty, setOperatorsDirty] = useState(false);
  const [customersDirty, setCustomersDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [historyDirty, setHistoryDirty] = useState(false);
  
  const [dispatchesToDelete, setDispatchesToDelete] = useState<Set<string>>(new Set());
  
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const settingsRef = useRef<SettingsScreenHandle>(null);
  
  // Operator Edit State
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [newOp, setNewOp] = useState({ id: '', name: '', pin: '' });
  
  // Customer Edit State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newCust, setNewCust] = useState({ name: '', location: '', transport: '' });

  useEffect(() => {
    setOperators(adminService.getOperators());
    setCustomers(adminService.getCustomers());
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await dbService.getAllDispatches();
    setDispatches(data.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
  };

  const isAdminDirty = operatorsDirty || customersDirty || settingsDirty || historyDirty;

  const handleSaveAll = async () => {
    if (operatorsDirty) {
      adminService.saveOperators(operators);
      setOperatorsDirty(false);
    }
    if (customersDirty) {
      adminService.saveCustomers(customers);
      setCustomersDirty(false);
    }
    if (settingsDirty && settingsRef.current) {
      settingsRef.current.save();
    }
    if (historyDirty) {
      for (const id of dispatchesToDelete) {
        await dbService.discardDispatch(id);
      }
      setDispatchesToDelete(new Set());
      setHistoryDirty(false);
      await loadHistory();
    }
    alert("All Admin Data Saved Successfully");
  };

  const handleSaveOperator = () => {
    let updated;
    if (editingOperator) {
      updated = operators.map(o => o.id === editingOperator.id ? editingOperator : o);
    } else {
      if (!newOp.id || !newOp.name || !newOp.pin) return alert("All fields required");
      if (operators.find(o => o.id === newOp.id)) return alert("ID already exists");
      updated = [...operators, { ...newOp }];
    }
    setOperators(updated);
    setOperatorsDirty(true);
    setEditingOperator(null);
    setNewOp({ id: '', name: '', pin: '' });
  };

  const handleDeleteOperator = (id: string) => {
    if (!confirm("Are you sure you want to remove this operator?")) return;
    const updated = operators.filter(o => o.id !== id);
    setOperators(updated);
    setOperatorsDirty(true);
  };

  const handleSaveCustomer = () => {
    let updated;
    if (editingCustomer) {
      updated = customers.map(c => c.id === editingCustomer.id ? editingCustomer : c);
    } else {
      if (!newCust.name || !newCust.location || !newCust.transport) return alert("All fields required");
      updated = [...customers, { id: Date.now().toString(), ...newCust }];
    }
    setCustomers(updated);
    setCustomersDirty(true);
    setEditingCustomer(null);
    setNewCust({ name: '', location: '', transport: '' });
  };

  const handleDeleteCustomer = (id: string) => {
    if (!confirm("Are you sure you want to remove this customer?")) return;
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated);
    setCustomersDirty(true);
  };

  const toggleDispatchDelete = (id: string) => {
    const newSet = new Set(dispatchesToDelete);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setDispatchesToDelete(newSet);
    setHistoryDirty(newSet.size > 0);
  };

  const handleClearAllHistory = () => {
    if (!confirm("Mark ALL history for deletion? Changes will be applied when you click SAVE ALL DATA.")) return;
    const allIds = dispatches.map(d => d.dispatch_id);
    setDispatchesToDelete(new Set(allIds));
    setHistoryDirty(true);
  };

  const handleLogoutClick = () => {
    if (isAdminDirty) {
      setShowExitConfirm(true);
    } else {
      onBack();
    }
  };

  const handleConfirmExit = async (save: boolean) => {
    if (save) {
      await handleSaveAll();
    }
    setShowExitConfirm(false);
    onBack();
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-white overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="navbar bg-slate-800 border-b border-white/5 px-4 h-16 z-30 shadow-md">
        <div className="flex-1">
          <h2 className="text-xl font-black tracking-[0.3em] uppercase text-white ml-2">
            ADMIN
          </h2>
        </div>
        <div className="flex-none flex items-center gap-2">
          <button 
            onClick={handleSaveAll}
            className={`btn btn-ghost text-emerald-400 font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-400/10 ${isAdminDirty ? 'animate-pulse bg-emerald-400/5' : ''}`}
          >
            SAVE ALL DATA
          </button>
          <button 
            onClick={handleLogoutClick}
            className="btn btn-ghost text-red-400 font-bold uppercase text-[10px] tracking-widest hover:bg-red-400/10"
          >
            LOG OUT
          </button>
        </div>
      </div>

      {/* Tab Bar - Three Button Structure */}
      <div className="flex bg-slate-800 border-b border-white/5 p-1 z-30">
        <button 
          onClick={() => setActiveTab('operators')} 
          className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'operators' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Operators
        </button>
        <button 
          onClick={() => setActiveTab('customers')} 
          className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'customers' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Customers
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          History
        </button>
        <button 
          onClick={() => setActiveTab('settings')} 
          className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Settings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {activeTab === 'operators' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl p-5 border border-white/5 shadow-sm">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Operator Registry</h3>
              <div className="space-y-2">
                {operators.map(op => (
                  <div key={op.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5">
                    <div>
                      <p className="font-bold text-sm text-white">{op.name}</p>
                      <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">ID: {op.id} • PIN: {op.pin}</p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setEditingOperator(op)}
                        className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteOperator(op.id)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-2xl p-5 border border-white/5 shadow-sm">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">
                {editingOperator ? `Edit: ${editingOperator.name}` : 'Register New Operator'}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Operator ID</span></label>
                    <input 
                      type="text" 
                      placeholder="ID"
                      value={editingOperator ? editingOperator.id : newOp.id}
                      disabled={!!editingOperator}
                      onChange={(e) => editingOperator ? setEditingOperator({...editingOperator, id: e.target.value}) : setNewOp({...newOp, id: e.target.value})}
                      className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-40"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Login PIN</span></label>
                    <input 
                      type="text" 
                      placeholder="PIN"
                      maxLength={4}
                      value={editingOperator ? editingOperator.pin : newOp.pin}
                      onChange={(e) => editingOperator ? setEditingOperator({...editingOperator, pin: e.target.value}) : setNewOp({...newOp, pin: e.target.value})}
                      className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Full Name</span></label>
                  <input 
                    type="text" 
                    placeholder="Operator Name"
                    value={editingOperator ? editingOperator.name : newOp.name}
                    onChange={(e) => editingOperator ? setEditingOperator({...editingOperator, name: e.target.value}) : setNewOp({...newOp, name: e.target.value})}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleSaveOperator}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                  >
                    {editingOperator ? 'Update Record' : 'Create Operator'}
                  </button>
                  {editingOperator && (
                    <button 
                      onClick={() => setEditingOperator(null)}
                      className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl p-5 border border-white/5 shadow-sm">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Customer Master List</h3>
              <div className="space-y-2">
                {customers.map(cust => (
                  <div key={cust.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5">
                    <div className="max-w-[70%]">
                      <p className="font-bold text-sm text-white truncate">{cust.name}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">{cust.location} • {cust.transport}</p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setEditingCustomer(cust)}
                        className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteCustomer(cust.id)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-2xl p-5 border border-white/5 shadow-sm">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">
                {editingCustomer ? `Edit: ${editingCustomer.name}` : 'Add Permanent Customer'}
              </h3>
              <div className="space-y-3">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Customer Name</span></label>
                  <input 
                    type="text" 
                    placeholder="Full Business Name"
                    value={editingCustomer ? editingCustomer.name : newCust.name}
                    onChange={(e) => editingCustomer ? setEditingCustomer({...editingCustomer, name: e.target.value}) : setNewCust({...newCust, name: e.target.value})}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Location</span></label>
                    <input 
                      type="text" 
                      placeholder="City/Plant"
                      value={editingCustomer ? editingCustomer.location : newCust.location}
                      onChange={(e) => editingCustomer ? setEditingCustomer({...editingCustomer, location: e.target.value}) : setNewCust({...newCust, location: e.target.value})}
                      className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-[8px] font-bold text-slate-500 uppercase">Transport</span></label>
                    <input 
                      type="text" 
                      placeholder="Agency Name"
                      value={editingCustomer ? editingCustomer.transport : newCust.transport}
                      onChange={(e) => editingCustomer ? setEditingCustomer({...editingCustomer, transport: e.target.value}) : setNewCust({...newCust, transport: e.target.value})}
                      className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleSaveCustomer}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                  >
                    {editingCustomer ? 'Update Record' : 'Save Customer'}
                  </button>
                  {editingCustomer && (
                    <button 
                      onClick={() => setEditingCustomer(null)}
                      className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl p-5 border border-white/5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Dispatch History</h3>
                <button 
                  onClick={handleClearAllHistory}
                  className="text-[8px] font-bold text-red-400 uppercase tracking-widest hover:underline"
                >
                  Mark All for Deletion
                </button>
              </div>
              <div className="space-y-2">
                {dispatches.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-[10px] font-bold uppercase tracking-widest">No history found</div>
                ) : (
                  dispatches.map(d => (
                    <div 
                      key={d.dispatch_id} 
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        dispatchesToDelete.has(d.dispatch_id) 
                          ? 'bg-red-900/20 border-red-500/50 opacity-60' 
                          : 'bg-slate-900/50 border-white/5'
                      }`}
                    >
                      <div className="max-w-[70%]">
                        <p className="font-bold text-sm text-white truncate">{d.customer_name}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">
                          {d.dispatch_id} • {new Date(d.start_time).toLocaleDateString()}
                        </p>
                      </div>
                      <button 
                        onClick={() => toggleDispatchDelete(d.dispatch_id)}
                        className={`p-2 rounded-lg transition-all ${
                          dispatchesToDelete.has(d.dispatch_id) 
                            ? 'text-emerald-400 hover:bg-emerald-400/10' 
                            : 'text-red-400 hover:bg-red-400/10'
                        }`}
                      >
                        {dispatchesToDelete.has(d.dispatch_id) ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SettingsScreen 
              ref={settingsRef}
              onBack={() => setActiveTab('operators')} 
              onDirtyChange={setSettingsDirty}
            />
          </div>
        )}
      </div>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="bg-amber-500/20 text-amber-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Unsaved Changes</h3>
              <p className="text-xs text-slate-400 leading-relaxed">You have modified settings without saving. How would you like to proceed?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleConfirmExit(true)}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
              >
                Save and Exit
              </button>
              <button 
                onClick={() => handleConfirmExit(false)}
                className="w-full py-4 bg-slate-800 text-white font-bold rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all"
              >
                Exit without Saving
              </button>
              <button 
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-4 bg-transparent text-slate-500 font-bold rounded-2xl text-[10px] uppercase tracking-widest hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWindow;
