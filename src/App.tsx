import { useState, useEffect, useMemo } from 'react';
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="min-h-screen bg-[#FDF8F8] text-slate-800 font-sans selection:bg-rose-100">
      <div className="max-w-md mx-auto px-6 py-10">
        
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex-1"></div>
          <div className="flex-1 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-12 h-12 bg-rose-50 rounded-full mb-2 shadow-sm border border-rose-100"
            >
              <RefreshCw className="text-rose-400 w-6 h-6" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cycle Tracker</h1>
          </div>
          <div className="flex-1 flex justify-end">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <Info size={24} />
            </button>
          </div>
        </header>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.section 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-8"
            >
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-4">Parametri Ciclo</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Durata Anello (giorni)</label>
                  <input 
                    type="number" 
                    value={settings.ringDuration}
                    onChange={(e) => setSettings({...settings, ringDuration: parseInt(e.target.value) || 21})}
                    className="w-full bg-slate-50 rounded-xl p-3 mt-1 text-sm outline-none focus:ring-1 focus:ring-rose-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Inizio Ciclo (giorni da inserimento)</label>
                  <input 
                    type="number" 
                    value={settings.periodStartOffset}
                    onChange={(e) => setSettings({...settings, periodStartOffset: parseInt(e.target.value) || 23})}
                    className="w-full bg-slate-50 rounded-xl p-3 mt-1 text-sm outline-none focus:ring-1 focus:ring-rose-200"
                  />
                  <p className="text-[9px] text-slate-400 mt-1 italic">Standard: 23 (Venerdì se inserito Mercoledì)</p>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Input Section */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-8">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 ml-1">
            Data di riferimento (Mercoledì inserimento)
          </label>
          <div className="relative">
            <input 
              type="date" 
              value={refDateStr}
              onChange={handleDateChange}
              className={`w-full bg-slate-50 border-none rounded-2xl py-4 px-5 focus:ring-2 transition-all outline-none text-slate-700 ${!isWednesday ? 'ring-2 ring-amber-200' : 'focus:ring-rose-200'}`}
            />
          </div>
          {!isWednesday && (
            <p className="text-xs text-amber-500 mt-3 flex items-center gap-1 ml-1">
              <AlertCircle size={14} /> Attenzione: la data selezionata non è un mercoledì.
            </p>
          )}
          {!refDateStr && (
            <p className="text-xs text-rose-400 mt-3 flex items-center gap-1 ml-1">
              <Info size={14} /> Inserisci una data per iniziare
            </p>
          )}
        </section>

        <AnimatePresence mode="wait">
          {cycleData ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* Confirmation Prompt */}
              {today >= cycleData.activeCycle.nextInsertion && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 shadow-lg text-center"
                >
                  <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                    <RefreshCw size={24} className="animate-spin-slow" />
                  </div>
                  <h3 className="text-lg font-bold text-rose-900 mb-2">È mercoledì!</h3>
                  <p className="text-sm text-rose-700 mb-6">Hai reinserito l'anello oggi? Conferma per aggiornare il calendario al prossimo mese.</p>
                  <button 
                    onClick={confirmNextInsertion}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-md transition-all active:scale-95"
                  >
                    Sì, confermo il reinserimento
                  </button>
                </motion.div>
              )}

              {/* Status Badge */}
              <div className="flex justify-center">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${cycleData.badgeColor} shadow-sm uppercase tracking-widest`}>
                  {cycleData.badge}
                </span>
              </div>

              {/* Main Status Card */}
              <div className="bg-white rounded-3xl p-8 shadow-md border border-slate-50 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-200 via-rose-300 to-rose-200"></div>
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-2">Stato Attuale</h2>
                <div className="text-2xl font-bold text-slate-900 mb-4">{cycleData.status}</div>
                
                {cycleData.daysToPeriod > 0 && (
                  <div className="flex items-center justify-center gap-2 text-rose-500 font-medium">
                    <Clock size={18} />
                    <span>Mancano {cycleData.daysToPeriod} giorni al prossimo ciclo</span>
                  </div>
                )}
                {cycleData.daysToPeriod === 0 && (
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-bold animate-pulse">
                    <AlertCircle size={18} />
                    <span>Ciclo probabile in corso</span>
                  </div>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prossima Rimozione</p>
                    <p className="text-lg font-bold text-slate-800">{formatDate(cycleData.activeCycle.removal)}</p>
                    <p className="text-xs text-slate-400 capitalize">{getDayName(cycleData.activeCycle.removal)}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prossimo Reinserimento</p>
                    <p className="text-lg font-bold text-slate-800">{formatDate(cycleData.activeCycle.nextInsertion)}</p>
                    <p className="text-xs text-slate-400 capitalize">{getDayName(cycleData.activeCycle.nextInsertion)}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-400">
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Finestra Ciclo</p>
                    <p className="text-lg font-bold text-slate-800">
                      {formatDate(cycleData.activeCycle.periodStart)} - {formatDate(cycleData.activeCycle.periodEnd)}
                    </p>
                    <p className="text-xs text-slate-400">Domenica - Mercoledì</p>
                  </div>
                </div>
              </div>

              {/* Timeline / Prossimi Mesi */}
              <div className="mt-10">
                <h3 className="text-lg font-bold text-slate-900 mb-6 px-1">Prossimi 3 Mesi</h3>
                <div className="space-y-4">
                  {cycleData.futureCycles.slice(1).map((cycle, idx) => (
                    <div key={idx} className="relative pl-8 border-l-2 border-rose-100 pb-6 last:pb-0">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-rose-200 border-4 border-white shadow-sm"></div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                        <p className="text-sm font-bold text-slate-800 mb-2">Ciclo di {cycle.insertion.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</p>
                        <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-500">
                          <span className="font-medium">Rimozione:</span>
                          <span className="text-slate-700 font-semibold">{formatDate(cycle.removal)}</span>
                          <span className="font-medium">Reinserimento:</span>
                          <span className="text-slate-700 font-semibold">{formatDate(cycle.nextInsertion)}</span>
                          <span className="font-medium">Ciclo:</span>
                          <span className="text-rose-500 font-bold">{formatDate(cycle.periodStart)} - {formatDate(cycle.periodEnd)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 px-10"
            >
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CalendarIcon className="text-slate-300 w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-400">Nessun dato inserito</h2>
              <p className="text-slate-400 text-sm mt-2">Seleziona la data dell'ultimo mercoledì di inserimento per calcolare le fasi.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Disclaimer */}
        <footer className="mt-16 pt-8 border-t border-slate-100 text-center">
          <div className="bg-slate-50 rounded-2xl p-4 inline-block max-w-xs">
            <p className="text-[10px] leading-relaxed text-slate-400 italic">
              <Info size={10} className="inline mr-1 mb-0.5" />
              Questa app fornisce solo una stima orientativa e non sostituisce indicazioni mediche o un metodo contraccettivo.
            </p>
          </div>
          <p className="text-[10px] text-slate-300 mt-6 uppercase tracking-widest font-bold">Personal Use Only • v1.0</p>
        </footer>

      </div>
    </div>
  );
}
