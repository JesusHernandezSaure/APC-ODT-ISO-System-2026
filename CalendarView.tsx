
import React, { useState, useEffect } from 'react';
import { useODT } from './ODTContext';
import { UserRole } from './types';
import { Icons } from './constants';
import { ref, onValue, get, update } from "firebase/database";
import { db } from './firebase';

export const CalendarView = ({ onOpenProject }: { onOpenProject: (id: string) => void }) => {
  const { user } = useODT();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Record<string, unknown> | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<Record<string, unknown>[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  useEffect(() => {
    if (!db) return;
    const eventsRef = ref(db, 'calendar_events');
    const unsub = onValue(eventsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.values(data).filter((e: Record<string, unknown>) => !e.deleted);
        setCalendarEvents(list);
      } else {
        setCalendarEvents([]);
      }
    });
    return () => unsub();
  }, []);

  const projectsInMonth = calendarEvents.filter(p => {
    if (!p.fecha_entrega) return false;
    const deliveryDate = new Date(p.fecha_entrega + 'T00:00:00');
    return deliveryDate.getMonth() === month && deliveryDate.getFullYear() === year;
  });

  const getProjectsForDay = (day: number) => {
    return projectsInMonth.filter(p => {
      if (!p.fecha_entrega) return false;
      const deliveryDate = new Date(p.fecha_entrega + 'T00:00:00');
      return deliveryDate.getDate() === day;
    });
  };

  const handleSyncHistory = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage("Iniciando sincronización... Por favor espera.");
      
      // 1. Descargamos el historial directamente de Firebase (no del contexto)
      const snapshot = await get(ref(db, 'projects'));
      
      if (!snapshot.exists()) {
        setIsSyncing(false);
        setSyncMessage("No se encontraron proyectos en la base de datos.");
        return;
      }

      const allProjectsData = snapshot.val();
      const updates: Record<string, unknown> = {};
      let count = 0;

      // 2. Iteramos sobre todos los proyectos
      Object.keys(allProjectsData).forEach(key => {
        const p = allProjectsData[key];
        
        // Solo copiamos los que NO están eliminados
        if (!p.deleted) {
          updates[key] = {
            id: key,
            empresa: p.empresa || p.clientId || 'Sin Empresa',
            fecha_entrega: p.fecha_entrega || null,
            etapa_actual: p.etapa_actual || p.etapaActual || '',
            status: p.status || '',
            deleted: null
          };
          count++;
        }
      });

      // 3. Guardamos todo de golpe en el nuevo nodo
      if (Object.keys(updates).length > 0) {
        await update(ref(db, 'calendar_events'), updates);
        setSyncMessage(`¡Éxito! Se sincronizaron ${count} ODTs.`);
      } else {
        setSyncMessage("No hay proyectos activos para sincronizar.");
      }
      setIsSyncing(false);
      
    } catch (error) {
      console.error("Error en la sincronización:", error);
      setIsSyncing(false);
      setSyncMessage("Hubo un error de sincronización.");
    }
  };

  const renderProjectDetail = (p: Record<string, unknown>) => {
    // Para el detalle complemamos con datos que podrían no estar en el evento ligero 
    // pero intentamos usar lo que tenemos. Si el usuario abre la ODT completa, ahí verá todo.
    
    const now = new Date();
    
    let daysRemaining = 'N/A';
    let isOnTime = true;
    if (p.fecha_entrega) {
      const delivery = new Date(p.fecha_entrega + 'T00:00:00');
      const diff = Math.ceil((delivery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = diff.toString();
      isOnTime = diff >= 0;
    }

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
          <div className="bg-apc-green p-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black tracking-tighter">Detalle de Entrega</h3>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">ODT: {p.id}</p>
            </div>
            <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-white/10 rounded-full transition-all">
              <Icons.Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cliente / Empresa</label>
                <p className="font-bold text-slate-800 uppercase text-xs">{p.empresa}</p>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Etapa Actual</label>
                <p className="font-bold text-slate-800 uppercase text-xs">{p.etapa_actual || 'N/A'}</p>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estatus</label>
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${p.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.status}
                </span>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">¿A tiempo?</label>
                <p className={`font-black uppercase text-xs ${isOnTime ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isOnTime ? 'SÍ' : 'RETRASADO'}
                </p>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Días para entrega</label>
                <p className="font-black text-xl text-slate-900">{daysRemaining}</p>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 italic font-medium">Nota: Para ver asignaciones y historial completo, abre la ODT.</p>
            <button 
              onClick={() => {
                onOpenProject(p.id);
                setSelectedProject(null);
              }}
              className="w-full py-4 bg-apc-pink text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-apc-pink/20"
            >
              Ver ODT Completa
            </button>
          </div>
        </div>
      </div>
    );
  };

  const showSyncButton = user && (user.role === UserRole.Admin || user.role === UserRole.Cuentas_Lider);

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Calendario de Entregas</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest italic">Cronograma de finalización de proyectos</p>
            {showSyncButton && (
              <button 
                onClick={handleSyncHistory}
                disabled={isSyncing}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${isSyncing ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-apc-pink border-apc-pink hover:bg-apc-pink hover:text-white'}`}
              >
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Historial'}
              </button>
            )}
            {syncMessage && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest animate-bounce">{syncMessage}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-apc-pink">
            <Icons.ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-black uppercase tracking-widest text-slate-700 min-w-[150px] text-center">
            {monthNames[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-apc-pink">
            <Icons.ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <div key={d} className="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 border-b border-r border-slate-50 bg-slate-50/30"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayProjects = getProjectsForDay(day);
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            
            return (
              <div key={day} className={`h-32 border-b border-r border-slate-50 p-2 hover:bg-slate-50/50 transition-all relative ${isToday ? 'bg-apc-pink/5' : ''}`}>
                <span className={`text-sm font-black ${isToday ? 'text-apc-pink' : 'text-slate-300'}`}>{day}</span>
                <div className="mt-1 space-y-1 overflow-y-auto max-h-[80%] custom-scrollbar">
                  {dayProjects.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => setSelectedProject(p)}
                      className="w-full text-left px-2 py-1 bg-white border border-slate-100 rounded-md shadow-sm hover:border-apc-pink transition-all group"
                    >
                      <div className="text-[10px] font-black text-apc-pink truncate">{p.id}</div>
                      <div className="text-[9px] font-bold text-slate-600 truncate uppercase group-hover:text-slate-900">{p.empresa}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedProject && renderProjectDetail(selectedProject)}
    </div>
  );
};
