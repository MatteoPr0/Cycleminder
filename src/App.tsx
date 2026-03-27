import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { Calendar as CalendarIcon, Info, RefreshCw, Clock, CheckCircle2, AlertCircle, ArrowDownCircle, ArrowUpCircle, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Tipi e Costanti ---

interface CycleDates {
  insertion: Date;
  removal: Date;
  periodStart: Date;
  periodEnd: Date;
  nextInsertion: Date;
}

interface AppSettings {
  ringDuration: number;
  breakDuration: number;
  periodStartOffset: number;
  periodEndOffset: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  ringDuration: 21,
  breakDuration: 7,
  periodStartOffset: 23, // Venerdì (21 + 2 giorni) - Standard Clinico
  periodEndOffset: 28,   // Mercoledì successivo
};

// --- Utility Functions ---

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getDayName = (date: Date): string => {
  return date.toLocaleDateString('it-IT', { weekday: 'long' });
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// --- Componenti UI ---

export default function App() {
  const [refDateStr, setRefDateStr] = useState<string>(() => {
    return localStorage.getItem('cycle_ref_date') || '';
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cycle_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [showSettings, setShowSettings] = useState(false);
  const [today, setToday] = useState(new Date());

  useEffect(() => {
    localStorage.setItem('cycle_settings', JSON.stringify(settings));
  }, [settings]);

  // Aggiorna "oggi" ogni minuto per sicurezza
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRefDateStr(val);
    localStorage.setItem('cycle_ref_date', val);
  };

  const confirmNextInsertion = () => {
    if (cycleData?.activeCycle.nextInsertion) {
      const nextDate = cycleData.activeCycle.nextInsertion;
      const nextDateStr = nextDate.toISOString().split('T')[0];
      setRefDateStr(nextDateStr);
      localStorage.setItem('cycle_ref_date', nextDateStr);
    }
  };

  const isWednesday = useMemo(() => {
    if (!refDateStr) return true;
    const date = new Date(refDateStr);
    return date.getDay() === 3; // 3 is Wednesday
  }, [refDateStr]);

  const cycleData = useMemo(() => {
    if (!refDateStr) return null;

    const refDate = new Date(refDateStr);
    refDate.setHours(0, 0, 0, 0);

    const totalCycleDays = settings.ringDuration + settings.breakDuration;
    const diffTime = today.getTime() - refDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Numero di cicli passati (può essere negativo se la data è nel futuro)
    const cycleCount = Math.floor(diffDays / totalCycleDays);
    
    const calculateForCycle = (n: number): CycleDates => {
      const start = addDays(refDate, n * totalCycleDays);
      return {
        insertion: start,
        removal: addDays(start, settings.ringDuration),
        periodStart: addDays(start, settings.periodStartOffset),
        periodEnd: addDays(start, settings.periodEndOffset),
        nextInsertion: addDays(start, totalCycleDays),
      };
    };

    const current = calculateForCycle(cycleCount);
    
    // Se oggi è dopo la fine del ciclo calcolato, passiamo al prossimo
    const activeCycle = today >= current.nextInsertion ? calculateForCycle(cycleCount + 1) : current;

    // Prossimi 3 cicli per la vista calendario/lista
    const futureCycles = [0, 1, 2, 3].map(i => calculateForCycle(cycleCount + i));

    // Stato attuale
    let status = '';
    let badge = '';
    let badgeColor = '';
    let daysToPeriod = -1;

    const tTime = today.getTime();
    const remTime = activeCycle.removal.getTime();
    const pStartTime = activeCycle.periodStart.getTime();
    const pEndTime = activeCycle.periodEnd.getTime();
    const nextInsTime = activeCycle.nextInsertion.getTime();

    let action = '';
    let actionDetail = '';

    if (tTime < remTime) {
      status = 'Anello inserito';
      badge = 'Fase con anello';
      badgeColor = 'bg-rose-50 text-rose-500 border-rose-100';
      daysToPeriod = Math.ceil((pStartTime - tTime) / (1000 * 60 * 60 * 24));
      action = 'Tieni l\'anello inserito.';
      actionDetail = `Rimozione prevista per il ${formatDate(activeCycle.removal)}.`;
    } else if (tTime < pStartTime) {
      status = 'Pausa';
      badge = 'Pausa - Ciclo in arrivo';
      badgeColor = 'bg-indigo-50 text-indigo-500 border-indigo-100';
      daysToPeriod = Math.ceil((pStartTime - tTime) / (1000 * 60 * 60 * 24));
      action = 'Anello rimosso.';
      actionDetail = 'In attesa dell\'inizio del ciclo.';
    } else if (tTime < pEndTime) {
      status = 'Ciclo';
      badge = 'Ciclo in corso';
      badgeColor = 'bg-pink-100 text-pink-600 border-pink-200';
      daysToPeriod = 0;
      action = 'Ciclo in corso.';
      actionDetail = `Reinserimento previsto per il ${formatDate(activeCycle.nextInsertion)}.`;
    } else {
      status = 'Pausa';
      badge = 'Fase senza anello';
      badgeColor = 'bg-slate-50 text-slate-500 border-slate-100';
      daysToPeriod = Math.ceil((calculateForCycle(cycleCount + 1).periodStart.getTime() - tTime) / (1000 * 60 * 60 * 24));
      action = 'Ciclo terminato.';
      actionDetail = `Reinserimento previsto per il ${formatDate(activeCycle.nextInsertion)}.`;
    }

    // Calcolo progresso
    let progress = 0;
    if (tTime < remTime) {
      progress = ((tTime - activeCycle.insertion.getTime()) / (remTime - activeCycle.insertion.getTime())) * 100;
    } else if (tTime < nextInsTime) {
      progress = ((tTime - remTime) / (nextInsTime - remTime)) * 100;
    }

    return { activeCycle, futureCycles, status, badge, badgeColor, daysToPeriod, progress, action, actionDetail };
  }, [refDateStr, today, settings]);

  return (
    <div className="min-h-screen font-sans selection:bg-rose-100">
      <div className="max-w-md mx-auto px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-rose-50">
              <div className="w-6 h-6 bg-rose-400 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight font-display">Cycle Tracker</h1>
              <p className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">Medical Grade • Pro</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-rose-50 active:scale-90 transition-all"
          >
            <Info className="w-5 h-5 text-slate-400" />
          </button>
        </header>

        {/* Settings Panel - Clean Surface */}
        <AnimatePresence>
          {showSettings && (
            <motion.section 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-white rounded-[32px] p-8 mb-12 border border-slate-100 shadow-sm"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8 text-slate-400 text-center">Configurazione Clinica</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Data Riferimento (Mercoledì)</label>
                  <input 
                    type="date" 
                    value={refDateStr}
                    onChange={handleDateChange}
                    className="w-full bg-slate-50 rounded-2xl px-6 py-4 outline-none text-lg font-bold font-display border border-transparent focus:border-[#FF4081] transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Durata Anello</label>
                    <input 
                      type="number" 
                      value={settings.ringDuration}
                      onChange={(e) => setSettings({...settings, ringDuration: parseInt(e.target.value) || 21})}
                      className="w-full bg-slate-50 rounded-2xl px-6 py-4 outline-none text-lg font-bold font-display border border-transparent focus:border-[#FF4081] transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Inizio Ciclo</label>
                    <input 
                      type="number" 
                      value={settings.periodStartOffset}
                      onChange={(e) => setSettings({...settings, periodStartOffset: parseInt(e.target.value) || 23})}
                      className="w-full bg-slate-50 rounded-2xl px-6 py-4 outline-none text-lg font-bold font-display border border-transparent focus:border-[#FF4081] transition-all"
                    />
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {cycleData ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Hero Status - Cute & Unambiguous */}
              <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="cute-card p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-16 -mt-16 opacity-50" />
                
                <div className="relative z-10">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${cycleData.badgeColor} mb-6`}>
                    {cycleData.badge}
                  </div>
                  
                  <div className="flex flex-col mb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-7xl font-black font-display tracking-tighter text-[#2D2D2D]">
                        {cycleData.daysToPeriod >= 7 ? Math.floor(cycleData.daysToPeriod / 7) : cycleData.daysToPeriod}
                      </span>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                        {cycleData.daysToPeriod >= 7 ? 'Settimane' : 'Giorni al ciclo'}
                      </span>
                    </div>
                    {cycleData.daysToPeriod >= 7 && cycleData.daysToPeriod % 7 > 0 && (
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest -mt-2">
                        e {cycleData.daysToPeriod % 7} giorni
                      </p>
                    )}
                  </div>
                  
                  <p className="text-lg font-bold text-slate-600 mb-8">{cycleData.status}</p>

                  {/* Progress Bar */}
                  <div className="space-y-3">
                    <div className="h-3 w-full bg-rose-50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${cycleData.progress}%` }}
                        className="h-full bg-gradient-to-r from-rose-300 to-rose-400 rounded-full"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      <span>Inizio</span>
                      <span>Prossimo</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Action Card - Unambiguous */}
              <div className="bg-indigo-500 rounded-[40px] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full -mb-12 -mr-12" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-4">Cosa fare oggi</h3>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-tight mb-1">
                      {cycleData.action}
                    </p>
                    <p className="text-xs opacity-70 font-medium">
                      {cycleData.actionDetail}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="cute-card p-6">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Inizio Ciclo</p>
                  <p className="text-xl font-black font-display">{formatDate(cycleData.activeCycle.periodStart).split(' ')[0]}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(cycleData.activeCycle.periodStart).split(' ')[1]}</p>
                </div>
                <div className="cute-card p-6">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Fine Ciclo</p>
                  <p className="text-xl font-black font-display">{formatDate(cycleData.activeCycle.periodEnd).split(' ')[0]}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(cycleData.activeCycle.periodEnd).split(' ')[1]}</p>
                </div>
              </div>

              {/* Secondary Details */}
              <div className="cute-card p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                      <ArrowDownCircle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Rimozione Anello</p>
                      <p className="text-sm font-bold">{formatDate(cycleData.activeCycle.removal)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-rose-400 font-display">Mer.</p>
                  </div>
                </div>

                <div className="h-px bg-rose-50/50" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <ArrowUpCircle className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Reinserimento</p>
                      <p className="text-sm font-bold">{formatDate(cycleData.activeCycle.nextInsertion)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-indigo-400 font-display">Mer.</p>
                  </div>
                </div>
              </div>

              {/* Timeline Futura */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] px-2">Prossimi Cicli</h3>
                <div className="space-y-3">
                  {cycleData.futureCycles.slice(1).map((cycle, idx) => (
                    <div key={idx} className="cute-card p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                          <CalendarIcon className="w-5 h-5 text-rose-300" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#2D2D2D] capitalize font-display">
                            {cycle.periodStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 tracking-widest">
                            {formatDate(cycle.periodStart).slice(0, 5)} — {formatDate(cycle.periodEnd).slice(0, 5)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-rose-400 font-display">{getDayName(cycle.periodStart).slice(0, 3)}.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-24 px-10">
              <div className="bg-white w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-sm border border-rose-50">
                <CalendarIcon className="text-rose-100 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-[#2D2D2D] font-display mb-3">Ciao!</h2>
              <p className="text-slate-400 text-sm font-medium mb-10 leading-relaxed">Configura la data dell'ultimo mercoledì di inserimento per iniziare.</p>
              <button 
                onClick={() => setShowSettings(true)}
                className="bg-rose-400 text-white px-10 py-5 rounded-2xl font-black shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs font-display"
              >
                Inizia
              </button>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-20 text-center pb-12 opacity-30">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.5em]">Cycle Tracker • Professional Edition</p>
        </footer>

      </div>
    </div>
  );
}
