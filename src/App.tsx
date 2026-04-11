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
  ovulation: Date;
  fertileStart: Date;
  fertileEnd: Date;
}

interface AppSettings {
  ringDuration: number;
  breakDuration: number;
  periodStartOffset: number;
  periodEndOffset: number;
  theoreticalCycleLength: number;
  ovulationDay: number;
  fertileWindowBefore: number;
  fertileWindowAfter: number;
  showOvulation: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  ringDuration: 21,
  breakDuration: 7,
  periodStartOffset: 23, // Venerdì (21 + 2 giorni) - Standard Clinico
  periodEndOffset: 28,   // Mercoledì successivo
  theoreticalCycleLength: 28,
  ovulationDay: 14,
  fertileWindowBefore: 5,
  fertileWindowAfter: 1,
  showOvulation: true,
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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
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
      const periodStart = addDays(start, settings.periodStartOffset);
      // L'ovulazione teorica avviene circa 14 giorni PRIMA del sanguinamento
      const ovulation = addDays(periodStart, -settings.ovulationDay);
      
      return {
        insertion: start,
        removal: addDays(start, settings.ringDuration),
        periodStart: periodStart,
        periodEnd: addDays(start, settings.periodEndOffset),
        nextInsertion: addDays(start, totalCycleDays),
        ovulation: ovulation,
        fertileStart: addDays(ovulation, -settings.fertileWindowBefore),
        fertileEnd: addDays(ovulation, settings.fertileWindowAfter),
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
    const insTime = activeCycle.insertion.getTime();
    const diffInsDays = Math.floor((tTime - insTime) / (1000 * 60 * 60 * 24));
    
    // Calcolo settimana dell'anello (1, 2, 3 o Pausa)
    let ringWeek = Math.ceil((diffInsDays + 1) / 7);
    if (ringWeek > 3 && diffInsDays < totalCycleDays) ringWeek = 4; // Settimana di pausa
    
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

    let isFertile = tTime >= activeCycle.fertileStart.getTime() && tTime <= activeCycle.fertileEnd.getTime();
    let isOvulation = today.toDateString() === activeCycle.ovulation.toDateString();

    return { activeCycle, futureCycles, status, badge, heroBg, heroText, heroGradient, daysToPeriod, progress, action, actionDetail, isFertile, isOvulation, ringWeek, diffInsDays };
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

      <div className="max-w-md mx-auto px-4 py-6 relative z-10">
        {/* Header - Android Style Compact */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 15, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[16px] flex items-center justify-center shadow-lg shadow-pink-500/30"
            >
              <CalendarIcon className="w-5 h-5 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-black tracking-tight font-display text-m3-on-surface">Cycle Tracker</h1>
              <p className="text-[10px] font-bold text-pink-600 uppercase tracking-widest">Partner Edition</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-10 h-10 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-all shadow-md border border-white/50"
          >
            <SettingsIcon className="w-5 h-5 text-m3-on-surface-variant" />
          </button>
        </header>

        {/* Settings Panel - Android Style */}
        <AnimatePresence>
          {showSettings && (
            <motion.section 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white/70 backdrop-blur-xl rounded-[24px] p-6 mb-6 border border-white/60 shadow-2xl shadow-m3-primary/10"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-m3-on-secondary-container/70 text-center">Configurazione</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Data Riferimento</label>
                  <input 
                    type="date" 
                    value={refDateStr}
                    onChange={handleDateChange}
                    className="w-full bg-white/90 rounded-[16px] px-4 py-3 outline-none text-base font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Durata Anello</label>
                    <input 
                      type="number" 
                      value={settings.ringDuration}
                      onChange={(e) => setSettings({...settings, ringDuration: parseInt(e.target.value) || 21})}
                      className="w-full bg-white/90 rounded-[16px] px-4 py-3 outline-none text-base font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Durata Pausa</label>
                    <input 
                      type="number" 
                      value={settings.breakDuration}
                      onChange={(e) => setSettings({...settings, breakDuration: parseInt(e.target.value) || 7})}
                      className="w-full bg-white/90 rounded-[16px] px-4 py-3 outline-none text-base font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Inizio Ciclo (gg)</label>
                    <input 
                      type="number" 
                      value={settings.periodStartOffset}
                      onChange={(e) => setSettings({...settings, periodStartOffset: parseInt(e.target.value) || 23})}
                      className="w-full bg-white/90 rounded-[16px] px-4 py-3 outline-none text-base font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Fine Ciclo (gg)</label>
                    <input 
                      type="number" 
                      value={settings.periodEndOffset}
                      onChange={(e) => setSettings({...settings, periodEndOffset: parseInt(e.target.value) || 28})}
                      className="w-full bg-white/90 rounded-[16px] px-4 py-3 outline-none text-base font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                    />
                  </div>
                </div>
                
                <div className="pt-2 border-t border-m3-surface-variant/30">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-m3-on-secondary-container/40">Ovulazione Teorica</h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.showOvulation}
                        onChange={(e) => setSettings({...settings, showOvulation: e.target.checked})}
                        className="w-3 h-3 accent-pink-500"
                      />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-m3-on-surface-variant/60">Attiva</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Giorno Ciclo</label>
                      <input 
                        type="number" 
                        value={settings.ovulationDay}
                        onChange={(e) => setSettings({...settings, ovulationDay: parseInt(e.target.value) || 14})}
                        className="w-full bg-white/90 rounded-[16px] px-4 py-3 outline-none text-base font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-m3-on-secondary-container/50 uppercase tracking-widest block px-2">Finestra (gg)</label>
                      <input 
                        type="number" 
                        value={settings.fertileWindowBefore}
                        onChange={(e) => setSettings({...settings, fertileWindowBefore: parseInt(e.target.value) || 5})}
                        className="w-full bg-white/90 rounded-[16px] px-4 py-3 outline-none text-base font-bold font-display border-2 border-transparent focus:border-pink-500 transition-all shadow-inner"
                      />
                    </div>
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
              className="space-y-4"
            >
              {/* Hero Status - Android 17 Style Compact */}
              <motion.div 
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className={`bg-gradient-to-br ${cycleData.heroGradient} rounded-[32px] p-6 relative overflow-hidden shadow-2xl shadow-pink-500/20 border border-white/40`}
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/30 rounded-full -mr-24 -mt-24 blur-2xl" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/50 ${cycleData.heroText} backdrop-blur-sm border border-white/40`}>
                      {cycleData.badge}
                    </div>
                    {cycleData.isFertile && (
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-400/80 text-white backdrop-blur-sm border border-white/40 animate-pulse">
                        Finestra Fertile
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-6xl font-black font-display tracking-tighter ${cycleData.heroText} drop-shadow-sm`}>
                        {cycleData.ringWeek === 4 ? 'P' : cycleData.ringWeek}
                      </span>
                      <span className={`text-sm font-black ${cycleData.heroText} opacity-70 uppercase tracking-widest`}>
                        {cycleData.ringWeek === 4 ? 'ausa' : 'Sett.'}
                      </span>
                    </div>
                    <div className="h-10 w-px bg-white/20" />
                    <div>
                      <p className={`text-lg font-black ${cycleData.heroText} leading-tight`}>{cycleData.status}</p>
                      <p className={`text-[10px] font-bold ${cycleData.heroText} opacity-60 uppercase tracking-widest`}>
                        {cycleData.status === 'Anello inserito' 
                          ? `Giorno ${cycleData.diffInsDays + 1} di 21` 
                          : cycleData.daysToPeriod === 0 ? 'In corso' : `Ciclo tra ${cycleData.daysToPeriod} gg`}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar - Android Style */}
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-white/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/20">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${cycleData.progress}%` }}
                        className="h-full bg-white rounded-full shadow-lg"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Grid Details - Compact 2 Columns */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="m3-card-elevated bg-white/70 p-4 rounded-[24px] shadow-lg shadow-pink-500/5"
                >
                  <p className="text-[9px] font-black text-pink-600/50 uppercase tracking-widest mb-1">Inizio Ciclo</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black font-display text-pink-600">
                      {formatDate(cycleData.activeCycle.periodStart).split(' ')[1]} {formatDate(cycleData.activeCycle.periodStart).split(' ')[2]}
                    </p>
                    <p className="text-[10px] font-bold text-pink-400 uppercase">
                      {formatDate(cycleData.activeCycle.periodStart).split(' ')[0]}
                    </p>
                  </div>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="m3-card-elevated bg-white/70 p-4 rounded-[24px] shadow-lg shadow-indigo-500/5"
                >
                  <p className="text-[9px] font-black text-indigo-600/50 uppercase tracking-widest mb-1">Fine Ciclo</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black font-display text-indigo-600">
                      {formatDate(cycleData.activeCycle.periodEnd).split(' ')[1]} {formatDate(cycleData.activeCycle.periodEnd).split(' ')[2]}
                    </p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">
                      {formatDate(cycleData.activeCycle.periodEnd).split(' ')[0]}
                    </p>
                  </div>
                </motion.div>

                {settings.showOvulation && (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="m3-card-elevated bg-white/70 p-4 rounded-[24px] shadow-lg shadow-purple-500/5 col-span-2"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[9px] font-black text-purple-600/50 uppercase tracking-widest">Ovulazione Teorica</p>
                      <Info className="w-3 h-3 text-purple-600/30" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-black font-display text-purple-600">
                          {formatDate(cycleData.activeCycle.ovulation).split(' ')[1]} {formatDate(cycleData.activeCycle.ovulation).split(' ')[2]}
                        </p>
                        <p className="text-[10px] font-bold text-purple-400 uppercase">
                          {formatDate(cycleData.activeCycle.ovulation).split(' ')[0]}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-purple-600/40 uppercase tracking-widest">Finestra Fertile</p>
                        <p className="text-[10px] font-bold text-purple-600">
                          {formatDate(cycleData.activeCycle.fertileStart)} — {formatDate(cycleData.activeCycle.fertileEnd)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Action Cards - Compact */}
              <div className="m3-card p-5 bg-white/60 shadow-xl border-white/60 rounded-[24px] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-100 rounded-[14px] flex items-center justify-center">
                      <ArrowDownCircle className="w-5 h-5 text-rose-700" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-rose-600/60 uppercase tracking-widest">Rimozione Anello</p>
                      <p className="text-base font-black text-m3-on-surface">{formatDate(cycleData.activeCycle.removal)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">
                      {Math.ceil((cycleData.activeCycle.removal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 0 ? 'Oggi' : `Tra ${Math.ceil((cycleData.activeCycle.removal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} gg`}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-m3-surface-variant/20" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-[14px] flex items-center justify-center">
                      <ArrowUpCircle className="w-5 h-5 text-indigo-700" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-indigo-600/60 uppercase tracking-widest">Reinserimento</p>
                      <p className="text-base font-black text-m3-on-surface">{formatDate(cycleData.activeCycle.nextInsertion)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                      {Math.ceil((cycleData.activeCycle.nextInsertion.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 0 ? 'Oggi' : `Tra ${Math.ceil((cycleData.activeCycle.nextInsertion.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} gg`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline Futura - Compact List */}
              <div className="space-y-3 pt-2">
                <h3 className="text-[9px] font-black text-m3-on-surface-variant/40 uppercase tracking-[0.4em] px-4">Prossimi Cicli</h3>
                <div className="space-y-2">
                  {cycleData.futureCycles.slice(1, 4).map((cycle, idx) => (
                    <motion.div 
                      key={idx} 
                      whileHover={{ x: 4 }}
                      className="m3-card-elevated flex items-center justify-between bg-white/70 p-3 rounded-[20px] shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-pink-50 to-indigo-50 rounded-[12px] flex items-center justify-center">
                          <Clock className="w-4 h-4 text-m3-primary/40" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-m3-on-surface capitalize font-display">
                            {cycle.periodStart.toLocaleDateString('it-IT', { month: 'long' })}
                          </p>
                          <p className="text-[9px] font-bold text-m3-on-surface-variant/50 tracking-widest">
                            {formatDate(cycle.periodStart)} — {formatDate(cycle.periodEnd)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right px-2">
                        <p className="text-[9px] font-black text-pink-500/40 uppercase tracking-widest">Inizio</p>
                        <p className="text-[10px] font-bold text-pink-500">{formatDate(cycle.periodStart).split(' ')[1]} {formatDate(cycle.periodStart).split(' ')[2]}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-20 px-6">
              <div className="bg-gradient-to-br from-pink-500 to-purple-600 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-pink-500/40">
                <CalendarIcon className="text-white w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-m3-on-surface font-display mb-3">Benvenuto</h2>
              <p className="text-m3-on-surface-variant/60 text-sm font-medium mb-10 leading-relaxed px-4">Configura la data dell'ultimo inserimento per monitorare il ciclo della tua partner.</p>
              <button 
                onClick={() => setShowSettings(true)}
                className="m3-button-primary shadow-xl shadow-pink-500/30 w-full py-4 text-base bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-[1.02] active:scale-95"
              >
                Configura Ora
              </button>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-12 text-center pb-12 opacity-40">
          <p className="text-[9px] font-black text-pink-600 uppercase tracking-[0.6em]">Partner Tracker • Pro Edition</p>
        </footer>
      </div>
    </div>
  );
}
