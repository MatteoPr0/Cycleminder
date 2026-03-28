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
    weekday: 'short',
    day: '2-digit',
    month: 'short',
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

    let heroBg = 'bg-m3-primary-container';
    let heroText = 'text-m3-on-primary-container';
    let heroGradient = 'from-purple-400 to-indigo-400';

    if (tTime < remTime) {
      status = 'Anello inserito';
      badge = 'Fase con anello';
      heroBg = 'bg-rose-100';
      heroText = 'text-rose-900';
      heroGradient = 'from-rose-400 to-pink-300';
      daysToPeriod = Math.ceil((pStartTime - tTime) / (1000 * 60 * 60 * 24));
      action = 'Fase attiva';
      actionDetail = `Rimozione prevista: ${formatDate(activeCycle.removal)}.`;
    } else if (tTime < pStartTime) {
      status = 'Pausa';
      badge = 'In attesa del ciclo';
      heroBg = 'bg-indigo-100';
      heroText = 'text-indigo-900';
      heroGradient = 'from-indigo-400 to-blue-300';
      daysToPeriod = Math.ceil((pStartTime - tTime) / (1000 * 60 * 60 * 24));
      action = 'Anello rimosso';
      actionDetail = 'Il ciclo inizierà a breve.';
    } else if (tTime < pEndTime) {
      status = 'Ciclo';
      badge = 'Ciclo in corso';
      heroBg = 'bg-pink-200';
      heroText = 'text-pink-900';
      heroGradient = 'from-pink-500 to-rose-400';
      daysToPeriod = 0;
      action = 'Fase mestruale';
      actionDetail = `Reinserimento: ${formatDate(activeCycle.nextInsertion)}.`;
    } else {
      status = 'Pausa';
      badge = 'Fine ciclo';
      heroBg = 'bg-slate-200';
      heroText = 'text-slate-900';
      heroGradient = 'from-slate-400 to-gray-400';
      daysToPeriod = Math.ceil((calculateForCycle(cycleCount + 1).periodStart.getTime() - tTime) / (1000 * 60 * 60 * 24));
      action = 'Ciclo terminato';
      actionDetail = `Prossimo inserimento: ${formatDate(activeCycle.nextInsertion)}.`;
    }

    // Calcolo progresso
    let progress = 0;
    if (tTime < remTime) {
      progress = ((tTime - activeCycle.insertion.getTime()) / (remTime - activeCycle.insertion.getTime())) * 100;
    } else if (tTime < nextInsTime) {
      progress = ((tTime - remTime) / (nextInsTime - remTime)) * 100;
    }

    return { activeCycle, futureCycles, status, badge, heroBg, heroText, heroGradient, daysToPeriod, progress, action, actionDetail };
  }, [refDateStr, today, settings]);

  return (
    <div className="min-h-screen font-sans selection:bg-m3-primary-container relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 30, 0], rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ x: [0, -50, 0], y: [0, -30, 0], rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 -right-24 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute bottom-0 left-1/4 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl"
        />
      </div>

      <div className="max-w-md mx-auto px-6 py-12 relative z-10">
        {/* Header - Android Style */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 15, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[24px] flex items-center justify-center shadow-lg shadow-pink-500/30"
            >
              <CalendarIcon className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-black tracking-tight font-display text-m3-on-surface">Cycle Tracker</h1>
              <p className="text-xs font-bold text-pink-600 uppercase tracking-widest">Partner Edition</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-12 h-12 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-all shadow-md border border-white/50"
          >
            <SettingsIcon className="w-6 h-6 text-m3-on-surface-variant" />
          </button>
        </header>

        {/* Settings Panel - Android Style */}
        <AnimatePresence>
          {showSettings && (
            <motion.section 
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              className="overflow-hidden bg-white/70 backdrop-blur-xl rounded-[32px] p-8 mb-12 border border-white/60 shadow-2xl shadow-m3-primary/10"
            >
              <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-8 text-m3-on-secondary-container/70 text-center">Configurazione</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Data Riferimento</label>
                  <input 
                    type="date" 
                    value={refDateStr}
                    onChange={handleDateChange}
                    className="w-full bg-white/90 rounded-[24px] px-6 py-4 outline-none text-lg font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Durata Anello</label>
                    <input 
                      type="number" 
                      value={settings.ringDuration}
                      onChange={(e) => setSettings({...settings, ringDuration: parseInt(e.target.value) || 21})}
                      className="w-full bg-white/90 rounded-[24px] px-6 py-4 outline-none text-lg font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Inizio Ciclo</label>
                    <input 
                      type="number" 
                      value={settings.periodStartOffset}
                      onChange={(e) => setSettings({...settings, periodStartOffset: parseInt(e.target.value) || 23})}
                      className="w-full bg-white/90 rounded-[24px] px-6 py-4 outline-none text-lg font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
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
              className="space-y-8"
            >
              {/* Hero Status - Android 17 Style */}
              <motion.div 
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className={`bg-gradient-to-br ${cycleData.heroGradient} rounded-[48px] p-10 relative overflow-hidden shadow-2xl shadow-pink-500/20 border border-white/40`}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/30 rounded-full -mr-32 -mt-32 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/20 rounded-full -ml-24 -mb-24 blur-xl" />
                
                <div className="relative z-10">
                  <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/50 ${cycleData.heroText} mb-8 backdrop-blur-sm border border-white/40`}>
                    {cycleData.badge}
                  </div>
                  
                  <div className="flex flex-col mb-4">
                    <div className="flex items-baseline gap-3">
                      <span className={`text-8xl font-black font-display tracking-tighter ${cycleData.heroText} drop-shadow-sm`}>
                        {cycleData.daysToPeriod >= 7 ? Math.floor(cycleData.daysToPeriod / 7) : cycleData.daysToPeriod}
                      </span>
                      <span className={`text-lg font-black ${cycleData.heroText} opacity-70 uppercase tracking-widest`}>
                        {cycleData.daysToPeriod >= 7 ? 'Sett.' : 'Giorni'}
                      </span>
                    </div>
                    {cycleData.daysToPeriod >= 7 && cycleData.daysToPeriod % 7 > 0 && (
                      <p className={`text-xl font-black ${cycleData.heroText} opacity-70 uppercase tracking-widest -mt-4`}>
                        e {cycleData.daysToPeriod % 7} giorni
                      </p>
                    )}
                  </div>
                  
                  <p className={`text-2xl font-black ${cycleData.heroText} mb-10`}>{cycleData.status}</p>

                  {/* Progress Bar - Android Style */}
                  <div className="space-y-4">
                    <div className="h-5 w-full bg-white/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${cycleData.progress}%` }}
                        className="h-full bg-white rounded-full shadow-lg"
                      />
                    </div>
                    <div className={`flex justify-between text-[11px] font-black ${cycleData.heroText} opacity-50 uppercase tracking-widest`}>
                      <span>Inizio</span>
                      <span>Fine</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Grid Details - Android Style */}
              <div className="grid grid-cols-2 gap-6">
                <motion.div 
                  whileHover={{ scale: 1.05, y: -4 }}
                  className="m3-card-elevated bg-white/70 shadow-lg shadow-pink-500/5"
                >
                  <p className="text-[10px] font-black text-pink-600/50 uppercase tracking-widest mb-3">Inizio Ciclo</p>
                  <p className="text-2xl font-black font-display text-pink-600 leading-none mb-1">
                    {formatDate(cycleData.activeCycle.periodStart).split(' ')[1]} {formatDate(cycleData.activeCycle.periodStart).split(' ')[2]}
                  </p>
                  <p className="text-xs font-black text-pink-500 uppercase tracking-widest">
                    {formatDate(cycleData.activeCycle.periodStart).split(' ')[0]}
                  </p>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.05, y: -4 }}
                  className="m3-card-elevated bg-white/70 shadow-lg shadow-indigo-500/5"
                >
                  <p className="text-[10px] font-black text-indigo-600/50 uppercase tracking-widest mb-3">Fine Ciclo</p>
                  <p className="text-2xl font-black font-display text-indigo-600 leading-none mb-1">
                    {formatDate(cycleData.activeCycle.periodEnd).split(' ')[1]} {formatDate(cycleData.activeCycle.periodEnd).split(' ')[2]}
                  </p>
                  <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">
                    {formatDate(cycleData.activeCycle.periodEnd).split(' ')[0]}
                  </p>
                </motion.div>
              </div>

              {/* Secondary Details - Android Style */}
              <div className="m3-card space-y-8 bg-white/60 shadow-xl border-white/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-rose-200 rounded-[20px] flex items-center justify-center shadow-md shadow-rose-200/50">
                      <ArrowDownCircle className="w-6 h-6 text-rose-700" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-rose-600/60 uppercase tracking-widest mb-1">Rimozione Anello</p>
                      <p className="text-lg font-black text-m3-on-surface">{formatDate(cycleData.activeCycle.removal)}</p>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-m3-surface-variant/50" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-indigo-200 rounded-[20px] flex items-center justify-center shadow-md shadow-indigo-200/50">
                      <ArrowUpCircle className="w-6 h-6 text-indigo-700" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-1">Reinserimento</p>
                      <p className="text-lg font-black text-m3-on-surface">{formatDate(cycleData.activeCycle.nextInsertion)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Futura - Android Style */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-m3-on-surface-variant/50 uppercase tracking-[0.4em] px-4">Calendario</h3>
                <div className="space-y-4">
                  {cycleData.futureCycles.slice(1).map((cycle, idx) => (
                    <motion.div 
                      key={idx} 
                      whileHover={{ x: 12, scale: 1.02 }}
                      className="m3-card-elevated flex items-center justify-between bg-white/70 shadow-md"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-indigo-100 rounded-[20px] flex items-center justify-center">
                          <Clock className="w-6 h-6 text-m3-primary" />
                        </div>
                        <div>
                          <p className="text-lg font-black text-m3-on-surface capitalize font-display">
                            {cycle.periodStart.toLocaleDateString('it-IT', { month: 'long' })}
                          </p>
                          <p className="text-[10px] font-bold text-m3-on-surface-variant/70 tracking-widest">
                            {formatDate(cycle.periodStart)} — {formatDate(cycle.periodEnd)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-32 px-10">
              <div className="bg-gradient-to-br from-pink-500 to-purple-600 w-28 h-28 rounded-[48px] flex items-center justify-center mx-auto mb-12 shadow-2xl shadow-pink-500/40">
                <CalendarIcon className="text-white w-12 h-12" />
              </div>
              <h2 className="text-3xl font-black text-m3-on-surface font-display mb-4">Benvenuto</h2>
              <p className="text-m3-on-surface-variant/60 text-base font-medium mb-12 leading-relaxed px-4">Configura la data dell'ultimo inserimento per monitorare il ciclo della tua partner.</p>
              <button 
                onClick={() => setShowSettings(true)}
                className="m3-button-primary shadow-xl shadow-pink-500/30 w-full py-5 text-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-[1.02] active:scale-95"
              >
                Configura Ora
              </button>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-24 text-center pb-16 opacity-40">
          <p className="text-[10px] font-black text-pink-600 uppercase tracking-[0.6em]">Partner Tracker • Ultra Vibrant</p>
        </footer>
      </div>
    </div>
  );
}
