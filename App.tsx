
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search,
  X,
  Trash2,
  Target,
  Package,
  Ship,
  ClipboardList,
  Clock,
  FileText,
  Calendar,
  Timer,
  Edit2,
  AlertTriangle,
  Download,
  Settings2,
  ChevronDown,
  Navigation,
  Flag,
  History,
  Zap,
  FileClock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { format, eachDayOfInterval, isSameDay, isWeekend, parseISO, startOfYear, endOfYear, startOfMonth, endOfMonth, addDays, isBefore, isAfter, startOfDay, differenceInDays, compareAsc } from 'date-fns';
import { PlannerEvent, CATEGORY_COLORS, CATEGORY_LABELS } from './types';
import { generateSmartSchedule } from './services/geminiService';
import { EventIcon } from './components/EventIcon';

const App: React.FC = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isYearConfigOpen, setIsYearConfigOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showYearFilter, setShowYearFilter] = useState(false);
  const [showMonthJump, setShowMonthJump] = useState(false);
  
  // Local state for the registry modal to handle per-row status update dates
  const [statusUpdateDates, setStatusUpdateDates] = useState<Record<string, string>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const availableYears = useMemo(() => {
    const base = new Date().getFullYear();
    return [base - 2, base - 1, base, base + 1, base + 2];
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(`logichronos-events-${currentYear}`);
    if (stored) setEvents(JSON.parse(stored));
    else setEvents([]);
  }, [currentYear]);

  useEffect(() => {
    if (events.length >= 0) {
      localStorage.setItem(`logichronos-events-${currentYear}`, JSON.stringify(events));
    }
  }, [events, currentYear]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const yearDays = useMemo(() => {
    const start = startOfYear(new Date(currentYear, 0, 1));
    const end = endOfYear(new Date(currentYear, 0, 1));
    return eachDayOfInterval({ start, end });
  }, [currentYear]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(currentYear, i, 1);
      return {
        name: format(d, 'MMMM'),
        daysInMonth: eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) }).length
      };
    });
  }, [currentYear]);

  const jumpToMonth = (monthIndex: number) => {
    if (!scrollContainerRef.current) return;
    const DAY_WIDTH = 44; 
    let scrollOffset = 0;
    for (let i = 0; i < monthIndex; i++) {
      scrollOffset += months[i].daysInMonth * DAY_WIDTH;
    }
    scrollContainerRef.current.scrollTo({ left: scrollOffset, behavior: 'smooth' });
    setShowMonthJump(false);
  };

  const today = startOfDay(new Date());

  const poRegistry = useMemo(() => {
    const registryMap = new Map<string, { 
      poName: string; 
      awbBlName: string; 
      events: PlannerEvent[]; 
      startDate: Date;
      currentStatus: string;
      latestDate: Date;
    }>();
    
    events.forEach(e => {
      const poKey = e.poName || 'UNASSIGNED';
      const existing = registryMap.get(poKey);
      const eventDate = parseISO(e.date);

      if (!existing) {
        registryMap.set(poKey, { 
          poName: poKey, 
          awbBlName: e.awbBlName || 'PENDING', 
          events: [e], 
          startDate: eventDate,
          currentStatus: e.category,
          latestDate: eventDate
        });
      } else {
        existing.events.push(e);
        if (isBefore(eventDate, existing.startDate)) {
          existing.startDate = eventDate;
        }
        if (isAfter(eventDate, existing.latestDate)) {
          existing.latestDate = eventDate;
        }
        
        // Current status is determined by the latest event chronologically
        const latestEvent = existing.events.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date))).reverse()[0];
        existing.currentStatus = latestEvent.category;
        
        if (e.awbBlName && (existing.awbBlName === 'PENDING' || existing.awbBlName === 'N/A' || existing.awbBlName === '')) {
          existing.awbBlName = e.awbBlName;
        }
      }
    });

    return Array.from(registryMap.values()).filter(po => 
      searchQuery === "" || 
      po.poName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.awbBlName.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => compareAsc(a.startDate, b.startDate));
  }, [events, searchQuery]);

  const handleUpdatePORegistry = (oldPoName: string, updates: Partial<{poName: string, awbBlName: string, startDate: string, status: string, statusDate?: string}>) => {
    if (updates.status) {
      const updateDate = updates.statusDate || format(today, 'yyyy-MM-dd');
      const newEvent: PlannerEvent = {
        id: Math.random().toString(36).substr(2, 9),
        title: `${CATEGORY_LABELS[updates.status]} Milestone`,
        date: updateDate,
        poName: oldPoName,
        awbBlName: poRegistry.find(p => p.poName === oldPoName)?.awbBlName || '',
        category: updates.status as any
      };
      setEvents(prev => [...prev, newEvent]);
    } else {
      setEvents(prev => prev.map(ev => {
        if (ev.poName === oldPoName) {
          const newEv = { ...ev };
          if (updates.poName) newEv.poName = updates.poName;
          if (updates.awbBlName) newEv.awbBlName = updates.awbBlName;
          if (updates.startDate) {
            const earliestDate = poRegistry.find(p => p.poName === oldPoName)?.startDate;
            if (earliestDate && isSameDay(parseISO(ev.date), earliestDate)) {
              newEv.date = updates.startDate;
            }
          }
          return newEv;
        }
        return ev;
      }));
    }
  };

  const handleAddEvent = (poName?: string, date?: string) => {
    const existingPo = poRegistry.find(p => p.poName === poName);
    setEditingEvent({
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      date: date || format(new Date(), 'yyyy-MM-dd'),
      category: (existingPo?.currentStatus as any) || 'local_process',
      description: '',
      poName: poName || '',
      awbBlName: existingPo?.awbBlName && existingPo.awbBlName !== 'PENDING' ? existingPo.awbBlName : ''
    });
    setIsModalOpen(true);
  };

  const handleEditShipment = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      setEditingEvent({ ...event });
      setIsModalOpen(true);
    }
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    setEvents(prev => {
      const idx = prev.findIndex(ev => ev.id === editingEvent.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = editingEvent;
        return next;
      }
      return [...prev, editingEvent];
    });
    setIsModalOpen(false);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2.5 rounded-2xl text-white shadow-xl rotate-3">
              <ClipboardList size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">LogiChronos</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Elite Operations Matrix</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowYearFilter(!showYearFilter)}
                className="flex items-center gap-2.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200 group"
              >
                <Calendar size={14} className="text-slate-500 group-hover:text-slate-900" />
                <span className="text-xs font-black text-slate-700">{currentYear}</span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${showYearFilter ? 'rotate-180' : ''}`} />
              </button>
              
              {showYearFilter && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 animate-in slide-in-from-top-2 z-[100]">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">Planning Year</div>
                  {availableYears.map(yr => (
                    <button 
                      key={yr}
                      onClick={() => { setCurrentYear(yr); setShowYearFilter(false); }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all
                        ${currentYear === yr ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}
                      `}
                    >
                      {yr} {yr === new Date().getFullYear() && "• Current"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowMonthJump(!showMonthJump)}
                className="flex items-center gap-2.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all border border-emerald-200 group"
              >
                <Navigation size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black uppercase tracking-tight">Month Jump</span>
                <ChevronDown size={12} className={`text-emerald-400 transition-transform ${showMonthJump ? 'rotate-180' : ''}`} />
              </button>
              
              {showMonthJump && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 animate-in slide-in-from-top-2 z-[100] grid grid-cols-2 gap-1">
                  {months.map((m, idx) => (
                    <button 
                      key={idx}
                      onClick={() => jumpToMonth(idx)}
                      className="text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsYearConfigOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-rose-100 transition-all active:scale-95 flex items-center gap-2 group"
              title="Registry Master Config"
            >
              <Edit2 size={14} className="group-hover:rotate-12 transition-transform" />
              <span className="text-xs font-black uppercase tracking-tight">Edit Registry</span>
            </button>

            <button 
              onClick={() => setIsLogModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2 group"
              title="Log Profile & History"
            >
              <FileClock size={14} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-tight">Log Profile</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900" size={14} />
            <input 
              type="text" placeholder="Quick Search PO..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold w-64 focus:ring-2 focus:ring-slate-900 outline-none transition-all shadow-inner"
            />
          </div>
          <button 
            onClick={() => handleAddEvent()}
            className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
          >
            <Plus size={16} /> New Entry
          </button>
        </div>
      </header>

      {/* Main Grid Wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex bg-white border-b border-slate-200 z-40 overflow-hidden" ref={headerRef}>
          <div className="w-[520px] flex-shrink-0 bg-slate-900 border-r border-slate-800 flex items-stretch">
             <div className="w-[180px] border-r border-slate-800 flex flex-col items-center justify-center p-3">
               <div className="flex items-center gap-2 mb-1">
                 <Package size={11} className="text-rose-500" />
                 <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">PO REGISTRY</span>
               </div>
               <div className="h-[1px] w-6 bg-slate-700" />
             </div>
             <div className="w-[180px] border-r border-slate-800 flex flex-col items-center justify-center p-3">
               <div className="flex items-center gap-2 mb-1">
                 <Ship size={11} className="text-emerald-500" />
                 <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">BL REFERENCE</span>
               </div>
               <div className="h-[1px] w-6 bg-slate-700" />
             </div>
             <div className="w-[160px] flex flex-col items-center justify-center p-3">
               <div className="flex items-center gap-2 mb-1">
                 <Timer size={11} className="text-amber-500" />
                 <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">TOTAL DAYS</span>
               </div>
               <div className="h-[1px] w-6 bg-slate-700" />
             </div>
          </div>
          
          <div className="flex min-w-max">
            {months.map((m, idx) => (
              <div key={idx} className="flex flex-col border-r border-slate-200" style={{ width: `calc(${m.daysInMonth} * 2.75rem)` }}>
                <div className="bg-slate-50/50 py-2 border-b border-slate-200 text-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{m.name}</span>
                </div>
                <div className="flex">
                  {eachDayOfInterval({ 
                    start: startOfMonth(new Date(currentYear, idx)), 
                    end: endOfMonth(new Date(currentYear, idx)) 
                  }).map((date, dIdx) => (
                    <div 
                      key={dIdx} 
                      className={`w-11 py-2 flex flex-col items-center justify-center border-r border-slate-100/50 relative
                        ${isSameDay(date, today) ? 'bg-slate-900 text-white font-bold' : (isWeekend(date) ? 'bg-slate-50/80 text-slate-400' : 'text-slate-500')}
                      `}
                    >
                      <span className="text-[11px] font-bold">{format(date, 'd')}</span>
                      <span className="text-[8px] font-black uppercase tracking-tighter opacity-70">{format(date, 'EEE')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div 
          className="flex-1 overflow-auto bg-slate-100 timeline-scrollbar"
          onScroll={handleScroll}
          ref={scrollContainerRef}
        >
          <div className="flex min-w-max">
            <div className="w-[520px] sticky left-0 z-30 bg-white shadow-2xl border-r border-slate-200 divide-y divide-slate-100">
              {poRegistry.map((po, i) => {
                const totalDaysElapsed = differenceInDays(today, po.startDate);
                const displayDays = totalDaysElapsed >= 0 ? totalDaysElapsed : 0;
                const agingColor = displayDays > 30 ? 'text-rose-600 bg-rose-50 border-rose-100' : 
                                  displayDays > 14 ? 'text-amber-600 bg-amber-50 border-amber-100' : 
                                  'text-emerald-600 bg-emerald-50 border-emerald-100';

                return (
                  <div key={po.poName} className={`h-28 flex transition-all group relative ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-rose-50/50`}>
                    <div className="w-[180px] border-r border-slate-100 p-4 flex flex-col justify-center gap-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-900 p-2 rounded-xl text-white shadow-md group-hover:bg-rose-600 transition-colors">
                          <Package size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">PO REGISTRY</div>
                          <div className="text-xs font-black text-slate-900 truncate uppercase leading-tight">{po.poName}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-1">
                        <Clock size={10} className="text-slate-300" />
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Started {format(po.startDate, 'MMM dd')}</span>
                      </div>
                    </div>
                    <div className="w-[180px] border-r border-slate-100 p-4 flex flex-col justify-center gap-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-500 p-2 rounded-xl text-white shadow-md">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[8px] font-black text-emerald-600/60 uppercase leading-none mb-1">REFERENCE</div>
                          <div className="text-xs font-black text-emerald-800 truncate uppercase leading-tight">{po.awbBlName}</div>
                        </div>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest w-fit border ${CATEGORY_COLORS[po.currentStatus]} text-white border-transparent`}>
                        {CATEGORY_LABELS[po.currentStatus]}
                      </div>
                    </div>
                    <div className="w-[160px] p-4 flex flex-col justify-center items-center text-center">
                      <div className={`px-5 py-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center min-w-[100px] shadow-sm ${agingColor}`}>
                         <span className="text-xl font-black leading-none">{displayDays}</span>
                         <span className="text-[8px] font-black uppercase tracking-widest mt-1 opacity-70">Days Transited</span>
                      </div>
                    </div>
                    <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleAddEvent(po.poName)}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-xl hover:scale-110 active:scale-95 transition-all"
                      >
                        <Plus size={14} className="text-rose-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col">
              {poRegistry.map((po, poIdx) => (
                <div key={po.poName} className={`flex h-28 border-b border-slate-100 transition-colors ${poIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  {yearDays.map((date, dayIdx) => {
                    const isTodayCell = isSameDay(date, today);
                    const isStartedDay = isSameDay(date, po.startDate);
                    const isHighlightedPath = (isSameDay(date, po.startDate) || isAfter(date, po.startDate)) && (isBefore(date, today) || isSameDay(date, today));
                    const cellEvents = po.events.filter(ev => isSameDay(parseISO(ev.date), date));

                    return (
                      <div 
                        key={dayIdx} 
                        className={`w-11 h-full border-r border-slate-100/50 flex items-center justify-center relative cursor-pointer hover:bg-rose-50/30 group/cell
                          ${isHighlightedPath ? 'bg-rose-500/[0.06]' : ''}
                        `}
                        onClick={() => handleAddEvent(po.poName, format(date, 'yyyy-MM-dd'))}
                      >
                        {isHighlightedPath && (
                          <div className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 h-3 z-0 flex items-center
                            ${isSameDay(date, po.startDate) ? 'rounded-l-full' : ''}
                            ${isSameDay(date, today) ? 'rounded-r-full' : ''}
                          `}>
                            <div className="w-full h-full bg-rose-500/10 border-y border-rose-200/40" />
                          </div>
                        )}
                        {isStartedDay && (
                          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-6 h-6 bg-rose-600 rounded-lg z-10 shadow-lg shadow-rose-200 flex items-center justify-center transform -translate-x-1/2">
                            <Target size={12} className="text-white" />
                          </div>
                        )}
                        {isTodayCell && (
                          <div className="absolute inset-y-4 left-1/2 -translate-x-1/2 w-[2px] bg-slate-900 z-30 shadow-[0_0_15px_rgba(0,0,0,0.3)] opacity-50" />
                        )}
                        {cellEvents.map((ev) => (
                          <div 
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); handleEditShipment(ev.id); }}
                            className={`absolute z-20 w-9 h-9 rounded-2xl ${CATEGORY_COLORS[ev.category]} shadow-xl flex flex-col items-center justify-center border-2 border-white transform hover:scale-125 transition-all hover:rotate-6 active:scale-95`}
                            title={`${CATEGORY_LABELS[ev.category]}: ${ev.title}`}
                          >
                            <EventIcon category={ev.category} className="text-white" />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MASTER REGISTRY CONFIG MODAL */}
      {isYearConfigOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-6xl h-[85vh] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 flex flex-col">
            <div className="px-10 py-7 border-b border-slate-100 flex items-center justify-between bg-rose-50/40">
              <div className="flex items-center gap-4">
                <div className="bg-rose-600 p-3 rounded-[1.5rem] text-white shadow-xl shadow-rose-100">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest leading-none">Registry Master Editor</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-[0.2em]">{currentYear} Advanced Management</p>
                </div>
              </div>
              <button onClick={() => setIsYearConfigOpen(false)} className="text-slate-400 hover:text-slate-900 transition-all p-3 bg-slate-100 rounded-full">
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-10">
              <div className="rounded-[2rem] border border-slate-100 overflow-hidden bg-slate-50/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] border-r border-slate-800">PO & Ref Details</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] border-r border-slate-800">Start Date</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Add New Milestone (Preserves History)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {poRegistry.map((po, idx) => {
                      const currentRowUpdateDate = statusUpdateDates[po.poName] || format(today, 'yyyy-MM-dd');
                      
                      return (
                        <tr key={idx} className="bg-white hover:bg-rose-50/10 transition-colors">
                          <td className="px-6 py-5 border-r border-slate-50 space-y-2 w-[280px]">
                            <div className="flex items-center gap-2">
                               <Package size={14} className="text-slate-400" />
                               <input 
                                type="text" value={po.poName} 
                                onChange={(e) => handleUpdatePORegistry(po.poName, { poName: e.target.value.toUpperCase() })}
                                className="w-full bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-black uppercase outline-none border-transparent border-2 focus:border-rose-500 focus:bg-white transition-all" 
                               />
                            </div>
                            <div className="flex items-center gap-2">
                               <Ship size={14} className="text-emerald-400" />
                               <input 
                                type="text" value={po.awbBlName} 
                                onChange={(e) => handleUpdatePORegistry(po.poName, { awbBlName: e.target.value.toUpperCase() })}
                                className="w-full bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 uppercase outline-none border-transparent border-2 focus:border-emerald-500 focus:bg-white transition-all" 
                               />
                            </div>
                          </td>
                          <td className="px-6 py-5 border-r border-slate-50 w-[180px]">
                            <div className="relative group">
                               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500" size={14} />
                               <input 
                                type="date" value={format(po.startDate, 'yyyy-MM-dd')} 
                                onChange={(e) => handleUpdatePORegistry(po.poName, { startDate: e.target.value })}
                                className="w-full bg-slate-50 pl-10 pr-3 py-2 rounded-lg text-xs font-black outline-none border-transparent border-2 focus:border-rose-500 focus:bg-white transition-all" 
                               />
                            </div>
                          </td>
                          <td className="px-6 py-5 flex items-center gap-4">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Milestone Date</span>
                              <input 
                                type="date" 
                                value={currentRowUpdateDate}
                                onChange={(e) => setStatusUpdateDates({...statusUpdateDates, [po.poName]: e.target.value})}
                                className="bg-rose-50 border-2 border-rose-100 rounded-xl px-3 py-2 text-xs font-black text-rose-700 outline-none focus:border-rose-500 transition-all"
                              />
                            </div>
                            
                            <div className="flex flex-col gap-1.5 flex-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Select New Phase to Apply</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                                  <button
                                    key={cat}
                                    onClick={() => handleUpdatePORegistry(po.poName, { status: cat, statusDate: currentRowUpdateDate })}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2
                                      ${po.currentStatus === cat 
                                        ? `${CATEGORY_COLORS[cat]} text-white border-transparent shadow-lg scale-105` 
                                        : 'bg-slate-100 text-slate-400 border-slate-100 hover:bg-slate-200'
                                      }
                                    `}
                                  >
                                    <EventIcon category={cat} className={po.currentStatus === cat ? 'text-white' : 'text-slate-300'} />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            <div className="pl-4 flex flex-col items-center justify-center border-l border-slate-100 ml-auto">
                                <History size={16} className="text-slate-200 mb-1" />
                                <span className="text-[8px] font-black text-slate-300 uppercase leading-none">{po.events.length} Points</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOG PROFILE MODAL */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-6xl h-[90vh] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 flex flex-col">
            <div className="px-12 py-10 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
              <div className="flex items-center gap-6">
                <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-2xl shadow-blue-200">
                   <FileClock size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Log Profile</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-2 tracking-[0.3em]">Lifecycle Duration Audit Registry</p>
                </div>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-all p-4 bg-slate-100 rounded-full">
                <X size={28} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-12">
              <div className="grid gap-12">
                {poRegistry.map((po, idx) => {
                  // Process events for log breakdown
                  const sortedEvents = [...po.events].sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));
                  const totalLife = differenceInDays(today, po.startDate);
                  
                  return (
                    <div key={idx} className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 overflow-hidden group hover:border-blue-200 transition-all">
                      <div className="px-10 py-6 border-b border-slate-100 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-8">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">PO Identifier</span>
                            <span className="text-lg font-black text-slate-900 uppercase">{po.poName}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reference</span>
                            <span className="text-lg font-black text-emerald-600 uppercase">{po.awbBlName}</span>
                          </div>
                          <div className="h-10 w-[1px] bg-slate-100" />
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-2xl">
                               <TrendingUp size={18} className="text-blue-600" />
                            </div>
                            <div>
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Active Age</span>
                               <span className="text-lg font-black text-blue-700">{totalLife} Days</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Current Milestone</span>
                           <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${CATEGORY_COLORS[po.currentStatus]} text-white`}>
                              {CATEGORY_LABELS[po.currentStatus]}
                           </div>
                        </div>
                      </div>

                      <div className="p-10">
                        <div className="relative">
                          {/* Vertical Line Connector */}
                          <div className="absolute left-6 top-4 bottom-4 w-[2px] bg-slate-200 dashed" />
                          
                          <div className="space-y-8">
                            {sortedEvents.map((ev, evIdx) => {
                              const evDate = parseISO(ev.date);
                              const nextEv = sortedEvents[evIdx + 1];
                              const nextDate = nextEv ? parseISO(nextEv.date) : today;
                              const phaseDuration = differenceInDays(nextDate, evDate);
                              
                              return (
                                <div key={evIdx} className="relative flex items-start gap-10 group/item">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center z-10 shadow-lg border-4 border-white transform transition-transform group-hover/item:scale-110 ${CATEGORY_COLORS[ev.category]}`}>
                                     <EventIcon category={ev.category} className="text-white" />
                                  </div>
                                  
                                  <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-3">
                                         <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{CATEGORY_LABELS[ev.category]}</h4>
                                         <span className="text-[10px] font-bold text-slate-300">•</span>
                                         <span className="text-[10px] font-black text-slate-400 uppercase">{ev.title || 'System Milestone'}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-slate-500">
                                         <Calendar size={12} />
                                         <span className="text-[11px] font-bold">{format(evDate, 'MMMM dd, yyyy')}</span>
                                         {nextEv && (
                                           <>
                                             <ArrowRight size={10} className="text-slate-300" />
                                             <span className="text-[11px] font-bold text-slate-400">{format(nextDate, 'MMM dd')}</span>
                                           </>
                                         )}
                                      </div>
                                    </div>
                                    
                                    <div className="text-right flex flex-col items-end">
                                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Duration</span>
                                       <div className="flex items-center gap-2">
                                          <span className="text-2xl font-black text-slate-900 leading-none">{phaseDuration}</span>
                                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Days</span>
                                       </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-10 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
               <div className="flex items-center gap-3 text-slate-400">
                 <Zap size={20} className="text-amber-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Durations are calculated based on milestone chronological order.</span>
               </div>
               <button className="px-10 py-5 bg-slate-900 hover:bg-black text-white rounded-3xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center gap-3">
                 <Download size={18} /> Export Full Audit PDF
               </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW REGISTRY ENTRY MODAL */}
      {isModalOpen && editingEvent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="bg-rose-600 p-3 rounded-2xl text-white">
                   <Target size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest leading-none">New Register Entry</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-[0.2em]">Logistics Hub Node</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-all p-3 bg-slate-100 rounded-full">
                <X size={22} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <Package size={12} className="text-slate-900" /> PO Number
                  </label>
                  <input 
                    type="text" 
                    value={editingEvent.poName} 
                    onChange={e => setEditingEvent({...editingEvent, poName: e.target.value.toUpperCase()})}
                    className="w-full px-6 py-5 bg-slate-50 rounded-[1.5rem] border-2 border-transparent focus:border-slate-900 focus:bg-white transition-all font-black text-slate-800 outline-none shadow-inner" 
                    placeholder="PO-0000"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <Ship size={12} className="text-emerald-600" /> AWB or BL Ref
                  </label>
                  <input 
                    type="text" 
                    value={editingEvent.awbBlName} 
                    onChange={e => setEditingEvent({...editingEvent, awbBlName: e.target.value.toUpperCase()})}
                    className="w-full px-6 py-5 bg-slate-50 rounded-[1.5rem] border-2 border-transparent focus:border-slate-900 focus:bg-white transition-all font-black text-emerald-700 outline-none shadow-inner" 
                    placeholder="REF-0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <Calendar size={12} className="text-rose-500" /> Started Date
                  </label>
                  <input 
                    type="date" 
                    value={editingEvent.date} 
                    onChange={e => setEditingEvent({...editingEvent, date: e.target.value})}
                    className="w-full px-6 py-5 bg-slate-50 rounded-[1.5rem] border-2 border-transparent focus:border-slate-900 focus:bg-white transition-all font-black text-slate-800 outline-none shadow-inner" 
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <Flag size={12} className="text-amber-500" /> Phase Note
                  </label>
                  <input 
                    type="text" 
                    value={editingEvent.title} 
                    onChange={e => setEditingEvent({...editingEvent, title: e.target.value})}
                    placeholder="e.g. Initial Processing"
                    className="w-full px-6 py-5 bg-slate-50 rounded-[1.5rem] border-2 border-transparent focus:border-slate-900 focus:bg-white transition-all font-black text-slate-800 outline-none shadow-inner" 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">PO Status Phase</label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                    <button
                      key={cat} type="button"
                      onClick={() => setEditingEvent({ ...editingEvent, category: cat as any })}
                      className={`py-4 px-2 rounded-2xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-2 border-2
                        ${editingEvent.category === cat 
                          ? `${CATEGORY_COLORS[cat]} text-white border-transparent shadow-xl scale-105` 
                          : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}
                      `}
                    >
                      <EventIcon category={cat} className={editingEvent.category === cat ? 'text-white' : 'text-slate-300'} />
                      <span className="text-center leading-none">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                {events.some(e => e.id === editingEvent.id) && (
                   <button 
                    type="button" 
                    onClick={() => { setEvents(prev => prev.filter(e => e.id !== editingEvent.id)); setIsModalOpen(false); }}
                    className="p-6 bg-slate-100 text-slate-400 hover:bg-rose-600 hover:text-white rounded-[2rem] transition-all group"
                  >
                    <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
                  </button>
                )}
                <button type="submit" className="flex-1 bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] hover:bg-black transition-all shadow-2xl shadow-slate-200 active:scale-95">
                  Confirm Registry Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
