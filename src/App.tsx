import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { Calendar as CalendarIcon, Info, RefreshCw, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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

    if (tTime < remTime) {
      status = 'Anello inserito';
      badge = 'Fase con anello';
      badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
      daysToPeriod = Math.ceil((pStartTime - tTime) / (1000 * 60 * 60 * 24));
    } else if (tTime < pStartTime) {
      status = 'Settimana senza anello (Pausa)';
      badge = 'Ciclo probabile in arrivo';
      badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
      daysToPeriod = Math.ceil((pStartTime - tTime) / (1000 * 60 * 60 * 24));
    } else if (tTime < pEndTime) {
      status = 'Finestra probabile ciclo';
      badge = 'Ciclo probabile in corso';
      badgeColor = 'bg-rose-100 text-rose-700 border-rose-200';
      daysToPeriod = 0;
    } else {
      status = 'In attesa di reinserimento';
      badge = 'Fase senza anello';
      badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
      daysToPeriod = Math.ceil((calculateForCycle(cycleCount + 1).periodStart.getTime() - tTime) / (1000 * 60 * 60 * 24));
    }

    return { activeCycle, futureCycles, status, badge, badgeColor, daysToPeriod };
  }, [refDateStr, today]);

  return (
    <div className="min-h-screen bg-[#F5EDED] text-[#1D1B1E] font-sans selection:bg-[#EADDFF]">
      <div className="max-w-md mx-auto px-4 py-8">
        
        {/* Header - Material 3 Style */}
        <header className="mb-10 flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#FF4081] rounded-[24px] flex items-center justify-center text-white shadow-lg border-2 border-white/30">
              <RefreshCw size={28} />
            </div>
            <h1 className="text-3xl font-black tracking-tight font-display text-[#31111D]">Cycle Tracker</h1>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-white hover:bg-[#EADDFF] transition-all text-[#49454F] shadow-md active:scale-90 border border-slate-100"
          >
            <Info size={28} />
          </button>
        </header>

        {/* Settings Panel - Material 3 Surface */}
        <AnimatePresence>
          {showSettings && (
            <motion.section 
              initial={{ height: 0, opacity: 0, scale: 0.9 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.9 }}
              className="overflow-hidden bg-[#EDE7F6] rounded-[50px] p-8 mb-10 border-2 border-[#CAC4D0] shadow-xl"
            >
              <h3 className="text-sm font-black uppercase tracking-[0.3em] mb-8 text-[#6750A4] text-center">Configurazione</h3>
              <div className="space-y-6">
                <div className="bg-white rounded-[30px] p-6 shadow-sm border border-slate-100">
                  <label className="text-[10px] font-black text-[#49454F] uppercase tracking-widest mb-2 block">Data Riferimento (Mercoledì)</label>
                  <input 
                    type="date" 
                    value={refDateStr}
                    onChange={handleDateChange}
                    className="w-full bg-transparent border-b-4 border-[#FF4081] py-3 outline-none text-xl font-black font-display"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-[30px] p-6 shadow-sm border border-slate-100">
                    <label className="text-[10px] font-black text-[#49454F] uppercase tracking-widest mb-2 block">Durata Anello</label>
                    <input 
                      type="number" 
                      value={settings.ringDuration}
                      onChange={(e) => setSettings({...settings, ringDuration: parseInt(e.target.value) || 21})}
                      className="w-full bg-transparent border-b-4 border-[#6750A4] py-3 outline-none text-xl font-black font-display"
                    />
                  </div>
                  <div className="bg-white rounded-[30px] p-6 shadow-sm border border-slate-100">
                    <label className="text-[10px] font-black text-[#49454F] uppercase tracking-widest mb-2 block">Inizio Ciclo</label>
                    <input 
                      type="number" 
                      value={settings.periodStartOffset}
                      onChange={(e) => setSettings({...settings, periodStartOffset: parseInt(e.target.value) || 23})}
                      className="w-full bg-transparent border-b-4 border-[#6750A4] py-3 outline-none text-xl font-black font-display"
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
              key="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* HERO CARD - Prioritizing "Weeks to Period" */}
              <div className="bg-[#FF4081] rounded-[60px] p-12 shadow-2xl text-white relative overflow-hidden border-4 border-white/40">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/20 rounded-full blur-[80px]"></div>
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-[#7C4DFF]/40 rounded-full blur-[80px]"></div>
                
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="px-6 py-2 rounded-full text-[11px] font-black border-2 border-white/30 mb-10 uppercase tracking-[0.3em] bg-white/20 backdrop-blur-md">
                    {cycleData.badge}
                  </div>
                  
                  {cycleData.daysToPeriod > 0 ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-[10rem] font-black tracking-tighter font-display leading-[0.8]">
                          {Math.floor(cycleData.daysToPeriod / 7)}
                        </span>
                        <div className="flex flex-col items-start">
                          <span className="text-4xl font-black font-display opacity-90 leading-none">
                            sett.
                          </span>
                        </div>
                      </div>
                      <div className="text-2xl font-black opacity-80 font-display tracking-tight mt-4">
                        e {cycleData.daysToPeriod % 7} giorni al ciclo
                      </div>
                    </div>
                  ) : cycleData.daysToPeriod === 0 ? (
                    <div className="py-8">
                      <div className="text-6xl font-black tracking-tight mb-4 font-display leading-tight">Ciclo in corso</div>
                      <div className="flex items-center justify-center gap-4 font-black text-xl opacity-90">
                        <AlertCircle size={32} />
                        <span className="font-display">Finestra probabile</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Confirmation Prompt - Material Style */}
              {today >= cycleData.activeCycle.nextInsertion && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[#7C4DFF] rounded-[50px] p-10 shadow-2xl border-4 border-white/30 text-white"
                >
                  <h3 className="text-3xl font-black mb-4 flex items-center gap-4 font-display">
                    <RefreshCw size={36} className="animate-spin-slow" />
                    È mercoledì!
                  </h3>
                  <p className="text-lg mb-8 font-bold opacity-90 leading-relaxed font-display">Hai reinserito l'anello oggi? Conferma per aggiornare il calendario.</p>
                  <button 
                    onClick={confirmNextInsertion}
                    className="w-full bg-white text-[#7C4DFF] font-black py-6 rounded-[30px] shadow-xl active:scale-95 transition-all text-xl uppercase tracking-widest font-display"
                  >
                    Conferma Reinserimento
                  </button>
                </motion.div>
              )}

              {/* KEY INFO GRID - Optimized for Start/End days */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#E3F2FD] rounded-[50px] p-8 shadow-lg border-2 border-white flex flex-col justify-between min-h-[200px] relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <CalendarIcon size={120} />
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-white rounded-[20px] flex items-center justify-center text-[#1976D2] mb-6 shadow-sm">
                      <CalendarIcon size={24} />
                    </div>
                    <p className="text-[10px] font-black text-[#1976D2] uppercase tracking-[0.3em] mb-2">Inizio Ciclo</p>
                  </div>
                  <div>
                    <p className="text-5xl font-black text-[#0D47A1] font-display leading-none mb-2">
                      {cycleData.activeCycle.periodStart.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                    </p>
                    <p className="text-[10px] font-black text-[#1976D2] uppercase tracking-[0.2em] opacity-60">
                      {getDayName(cycleData.activeCycle.periodStart)}
                    </p>
                  </div>
                </div>

                <div className="bg-[#FBE9E7] rounded-[50px] p-8 shadow-lg border-2 border-white flex flex-col justify-between min-h-[200px] relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Clock size={120} />
                  </div>
                  <div>
                    <div className="w-12 h-12 bg-white rounded-[20px] flex items-center justify-center text-[#D84315] mb-6 shadow-sm">
                      <Clock size={24} />
                    </div>
                    <p className="text-[10px] font-black text-[#D84315] uppercase tracking-[0.3em] mb-2">Fine Ciclo</p>
                  </div>
                  <div>
                    <p className="text-5xl font-black text-[#BF360C] font-display leading-none mb-2">
                      {cycleData.activeCycle.periodEnd.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                    </p>
                    <p className="text-[10px] font-black text-[#D84315] uppercase tracking-[0.2em] opacity-60">
                      {getDayName(cycleData.activeCycle.periodEnd)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Secondary Info - Compact */}
              <div className="bg-white/40 backdrop-blur-xl rounded-full p-3 flex items-center justify-between border-2 border-white shadow-md">
                <div className="flex-1 bg-white rounded-full py-4 px-6 flex items-center justify-center gap-4 shadow-sm">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                    <Clock size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rimozione</p>
                    <p className="text-sm font-black font-display">{formatDate(cycleData.activeCycle.removal).slice(0, 5)}</p>
                  </div>
                </div>
                <div className="w-4"></div>
                <div className="flex-1 bg-white rounded-full py-4 px-6 flex items-center justify-center gap-4 shadow-sm">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reinserimento</p>
                    <p className="text-sm font-black font-display">{formatDate(cycleData.activeCycle.nextInsertion).slice(0, 5)}</p>
                  </div>
                </div>
              </div>

              {/* Timeline - Material List */}
              <div className="pt-8 px-2">
                <h3 className="text-sm font-black text-[#1D1B1E] uppercase tracking-[0.4em] mb-8 text-center">Calendario Futuro</h3>
                <div className="space-y-6">
                  {cycleData.futureCycles.slice(1).map((cycle, idx) => (
                    <div key={idx} className="bg-white/70 backdrop-blur-md rounded-[40px] p-6 flex items-center justify-between border-2 border-white shadow-lg hover:bg-white transition-all">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-[#EDE7F6] rounded-[20px] flex items-center justify-center text-[#6750A4] font-black text-lg font-display">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-lg font-black text-[#1D1B1E] capitalize font-display">{cycle.insertion.toLocaleDateString('it-IT', { month: 'long' })}</p>
                          <p className="text-xs font-bold text-[#49454F] tracking-widest opacity-60">
                            {formatDate(cycle.periodStart).slice(0, 5)} — {formatDate(cycle.periodEnd).slice(0, 5)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right bg-[#FF4081] px-6 py-3 rounded-[24px] text-white shadow-md">
                        <p className="text-sm font-black capitalize font-display">{getDayName(cycle.periodStart).slice(0, 3)}.</p>
                        <p className="text-[9px] font-black uppercase tracking-tighter opacity-80">Inizio</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-24 px-10">
              <div className="bg-white w-32 h-32 rounded-[60px] flex items-center justify-center mx-auto mb-10 shadow-2xl border-4 border-[#FF4081]/10">
                <CalendarIcon className="text-[#FF4081] w-16 h-16 opacity-30" />
              </div>
              <h2 className="text-3xl font-black text-[#31111D] font-display mb-4">Pronta a iniziare?</h2>
              <p className="text-[#49454F] text-lg font-medium mb-12 leading-relaxed font-display">Configura la data dell'ultimo mercoledì di inserimento per attivare il tracker.</p>
              <button 
                onClick={() => setShowSettings(true)}
                className="bg-[#FF4081] text-white px-12 py-6 rounded-full font-black shadow-2xl active:scale-95 transition-all uppercase tracking-[0.2em] text-lg font-display"
              >
                Configura Ora
              </button>
            </div>
          )}
        </AnimatePresence>

        {/* Disclaimer - Discrete Material Style */}
        <footer className="mt-20 text-center px-10">
          <div className="bg-white/40 backdrop-blur-md rounded-[30px] p-6 border-2 border-white shadow-sm">
            <p className="text-[11px] leading-relaxed text-[#49454F] font-bold italic font-display">
              Questa app fornisce solo una stima orientativa e non sostituisce indicazioni mediche o un metodo contraccettivo.
            </p>
          </div>
          <p className="mt-10 text-[10px] font-black text-[#49454F] uppercase tracking-[0.5em] opacity-30">v1.2 • Personal Use Only</p>
        </footer>

      </div>
    </div>
  );
}
