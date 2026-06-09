
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useODT } from './ODTContext';
import { UserRole, Project, User, ProjectAssignment } from './types';
import { normalizeString } from './workflowConfig';
import { generateAreaReport, downloadCSV, calculateWorkingTime } from './reportUtils';

interface LeaderDashboardProps {
  onViewProject: (id: string) => void;
}

const TeamAssignmentDropdown: React.FC<{
  project: Project;
  teamMembers: User[];
  currentAssignment: ProjectAssignment | undefined;
  currentAssignmentArea: string;
  delegateProject: (projectId: string, area: string, userIds: string[]) => void;
}> = ({ project, teamMembers, currentAssignment, currentAssignmentArea, delegateProject }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, showUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 280; // Slightly larger for safety
      const showUp = spaceBelow < menuHeight;

      setCoords({
        top: showUp ? rect.top - 8 : rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        showUp
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideButton = buttonRef.current && !buttonRef.current.contains(target);
      const isOutsideMenu = menuRef.current && !menuRef.current.contains(target);
      
      if (isOutsideButton && isOutsideMenu) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      <button 
        ref={buttonRef}
        onClick={toggleDropdown}
        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
          currentAssignment ? 'bg-apc-pink text-white shadow-sm' : 'bg-apc-green text-white animate-bounce shadow-lg shadow-apc-green/20'
        }`}
      >
        {currentAssignment ? 'GESTIONAR EQUIPO' : 'ASIGNAR EQUIPO'}
      </button>
      
      {isOpen && createPortal(
        <div 
          ref={menuRef}
          className={`fixed bg-white border border-slate-100 rounded-2xl shadow-2xl z-[9999] p-4 w-64 animate-fadeIn ${coords.showUp ? 'origin-bottom' : 'origin-top'}`}
          style={{ 
            top: coords.showUp ? 'auto' : coords.top,
            bottom: coords.showUp ? window.innerHeight - coords.top : 'auto',
            left: Math.min(coords.left + coords.width - 256, window.innerWidth - 272),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-3 border-b pb-2">
            <div className="flex flex-col">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Seleccionar Integrantes</p>
              <p className="text-[7px] font-bold text-slate-300 uppercase tracking-tighter">Área: {currentAssignmentArea}</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-slate-500 transition-colors p-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {teamMembers.map(m => {
              const isSelected = currentAssignment?.usuarioIds?.includes(m.id) || currentAssignment?.usuarioId === m.id;
              return (
                <label 
                  key={m.id} 
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-apc-pink/5 border border-apc-pink/10' : 'hover:bg-slate-50 border border-transparent'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        const currentIds = currentAssignment?.usuarioIds || (currentAssignment?.usuarioId ? [currentAssignment.usuarioId] : []);
                        const newIds = isSelected 
                          ? currentIds.filter((id: string) => id !== m.id)
                          : [...currentIds, m.id];
                        delegateProject(project.id, currentAssignmentArea, newIds);
                      }}
                      className="w-4 h-4 accent-apc-pink rounded border-slate-300 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[10px] font-bold uppercase truncate ${isSelected ? 'text-apc-pink' : 'text-slate-600'}`}>
                      {m.name}
                    </span>
                    <span className="text-[7px] text-slate-400 font-black uppercase tracking-tighter truncate">{m.role}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="mt-3 pt-2 border-t text-center">
            <button 
              onClick={() => setIsOpen(false)}
              className="text-[9px] font-black text-apc-pink uppercase tracking-widest hover:underline px-4 py-1"
            >
              Cerrar Panel
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ onViewProject }) => {
  const { user, projects, users, delegateProject } = useODT();
  const [memberFilter, setMemberFilter] = useState('all');
  const [qaTimeRange, setQaTimeRange] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('all');

  const getQAMetrics = (userId: string) => {
    let approved = 0;
    let rejected = 0;
    let checks = 0;
    let totalHoursSpent = 0;
    let countReviewed = 0;

    const cutoff = new Date();
    if (qaTimeRange === 'day') cutoff.setDate(cutoff.getDate() - 1);
    else if (qaTimeRange === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else if (qaTimeRange === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (qaTimeRange === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);
    else cutoff.setFullYear(2000); 

    projects?.forEach(p => {
      const qaComments = p.comentarios?.filter(c => 
        (c.isSystemEvent && (c.text?.includes('APROBADO en [REVISIÓN QA') || c.text?.includes('RECHAZADO en [REVISIÓN QA'))) ||
        (!c.isSystemEvent && c.text?.includes('ha validado:'))
      ) || [];

      const sortedComments = [...(p.comentarios || [])].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      qaComments.forEach(qaAction => {
        if (qaAction.authorId !== userId) return;
        
        const actionTime = new Date(qaAction.createdAt);
        if (actionTime.getTime() < cutoff.getTime()) return;

        let entryTime = new Date(p.createdAt);
        const priorEntry = sortedComments.filter(c => 
          c.isSystemEvent && 
          c.text?.includes('Enviado a [REVISIÓN QA') && 
          new Date(c.createdAt).getTime() <= actionTime.getTime()
        ).pop();

        if (priorEntry) {
          entryTime = new Date(priorEntry.createdAt);
        } else {
          const actionIdx = sortedComments.findIndex(c => c.id === qaAction.id);
          if (actionIdx > 0) {
            entryTime = new Date(sortedComments[actionIdx - 1].createdAt);
          }
        }

        const isFelipe = qaAction.authorName?.toLowerCase().includes('felipe lópez') || false;
        const timeSpent = calculateWorkingTime(entryTime, actionTime, isFelipe).totalHours;

        totalHoursSpent += timeSpent;
        countReviewed++;

        if (qaAction.text?.includes('APROBADO en')) approved++;
        else if (qaAction.text?.includes('RECHAZADO en')) rejected++;
        else if (qaAction.text?.includes('ha validado:')) checks++;
      });
    });

    const avgTime = countReviewed > 0 ? (totalHoursSpent / countReviewed).toFixed(1) : '0';

    return { approved, rejected, checks, avgTime, totalCalificadas: approved + rejected + checks };
  };

  const getOperativeAreaMetrics = (userId: string, areaName: string) => {
    let completed = 0;
    let onTime = 0;
    let late = 0;
    let qARejections = 0;
    let totalHoursSpent = 0;

    const cutoff = new Date();
    if (qaTimeRange === 'day') cutoff.setDate(cutoff.getDate() - 1);
    else if (qaTimeRange === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else if (qaTimeRange === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (qaTimeRange === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);
    else cutoff.setFullYear(2000); 

    const areaNorm = normalizeString(areaName);

    projects?.forEach(p => {
      const advancements = p.comentarios?.filter(c => 
        c.isSystemEvent && c.authorId === userId && 
        (c.text?.includes('Entrega Técnica') || c.text?.includes('completada'))
      ) || [];

      const isAssigned = p.asignaciones?.some(a => normalizeString(a.area) === areaNorm && (a.usuarioIds?.includes(userId) || a.usuarioId === userId));
      
      if (isAssigned) {
        const areaRejections = p.comentarios?.filter(c => 
          c.isSystemEvent && c.text?.includes(`RECHAZADO en [REVISIÓN QA (${areaName})]`) 
          && new Date(c.createdAt).getTime() >= cutoff.getTime()
        ) || [];
        qARejections += areaRejections.length;
      }

      const areaKey = Object.keys(p.fechasInternas || {}).find(k => normalizeString(k) === areaNorm) || areaName;
      const deadlineStr = p.fechasInternas ? p.fechasInternas[areaKey] : null;

      const sortedComments = [...(p.comentarios || [])].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      advancements.forEach(action => {
        const actionTime = new Date(action.createdAt);
        if (actionTime.getTime() < cutoff.getTime()) return;

        // Ensure this advancement was actually for the area we're evaluating.
        // Entrega Técnica or Completada logic usually falls under the user's assignment.
        // We ensure they are assigned to this area in this project at least.
        if (!isAssigned) return;

        completed++;

        if (deadlineStr) {
           const deadline = new Date(deadlineStr);
           deadline.setHours(23, 59, 59, 999);
           if (actionTime <= deadline) {
             onTime++;
           } else {
             late++;
           }
        }

        let entryTime = new Date(p.createdAt);
        const priorEntry = sortedComments.filter(c => 
          c.isSystemEvent && 
          c.text?.toLowerCase().includes(`enviado a [${areaNorm}`) && 
          new Date(c.createdAt).getTime() <= actionTime.getTime()
        ).pop();

        if (priorEntry) {
          entryTime = new Date(priorEntry.createdAt);
        } else {
          const actionIdx = sortedComments.findIndex(c => c.id === action.id);
          if (actionIdx > 0) {
             const anyPriorAdvancement = sortedComments.filter((c, i) => i < actionIdx && c.isSystemEvent && (c.text?.includes('completada') || c.text?.includes('APROBADO') || c.text?.includes('RECHAZADO') || c.text?.includes('Entrega Técnica'))).pop();
             if (anyPriorAdvancement) entryTime = new Date(anyPriorAdvancement.createdAt);
          }
        }

        const isFelipe = action.authorName?.toLowerCase().includes('felipe lópez') || false;
        const timeSpent = calculateWorkingTime(entryTime, actionTime, isFelipe).totalHours;
        totalHoursSpent += timeSpent;
      });
    });

    const avgTime = completed > 0 ? (totalHoursSpent / completed).toFixed(1) : '0';

    return { completed, onTime, late, avgTime, qARejections };
  };

  const handleDownloadReport = () => {
    if (!user || !projects || !users || !activeArea) return;
    const reportData = generateAreaReport(projects, users, activeArea, memberFilter);
    downloadCSV(reportData, `Reporte_Actividades_${activeArea}_${new Date().toISOString().split('T')[0]}`);
  };

  const availableAreas = useMemo(() => {
    if (!user) return [];
    if (user.role === UserRole.Medico_Lider) return ['Médico', 'QA'];
    if (user.department === 'QA' || user.role === UserRole.Correccion) return ['QA'];
    return [user.department];
  }, [user]);

  const [activeArea, setActiveArea] = useState(availableAreas[0] || '');

  const teamMembers = useMemo(() => {
    if (!user || !users) return [];
    
    return users.filter(u => {
      const memberDept = normalizeString(u.department);
      const activeAreaNorm = normalizeString(activeArea);
      
      // Helper to check if user has a role (primary or secondary)
      const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));

      // Exclude Admins from assignment lists to avoid cluttering operational lists
      if (hasRole(u, UserRole.Admin)) return false;

      if (activeAreaNorm === 'qa') {
        // En QA pueden estar: Correccion (QA Lider), QA_Opera, Medico_Lider, Medico_Opera
        return (
          hasRole(u, UserRole.Correccion) ||
          hasRole(u, UserRole.QA_Opera) ||
          hasRole(u, UserRole.Medico_Lider) ||
          hasRole(u, UserRole.Medico_Opera) ||
          memberDept === 'qa'
        );
      }

      if (activeAreaNorm === 'medico') {
        return (
          hasRole(u, UserRole.Medico_Lider) ||
          hasRole(u, UserRole.Medico_Opera) ||
          memberDept === 'medico'
        );
      }
      
      // Para otras áreas, por departamento
      return memberDept === activeAreaNorm;
    });
  }, [user, users, activeArea]);

  const areaProjects = useMemo(() => {
    if (!activeArea || !projects) return [];
    
    let filtered: Project[] = [];
    
    if (activeArea === 'QA') {
      filtered = projects.filter(p => {
        const stageStr = (p.etapa_actual || p.etapaActual || '').toUpperCase();
        return stageStr.includes('REVISIÓN QA') || p.status === 'QA';
      });
    } else {
      filtered = projects.filter(p => 
        p.areas_seleccionadas?.some(area => normalizeString(area) === normalizeString(activeArea))
      );
    }

    if (memberFilter !== 'all') {
      filtered = filtered.filter(p => p.asignaciones?.some(a => a.usuarioIds?.includes(memberFilter) || a.usuarioId === memberFilter));
    }
    
    return filtered;
  }, [projects, activeArea, memberFilter]);

  if (!user || !projects || !users) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apc-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex justify-between items-center border-b pb-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Control de Área: {activeArea}</h1>
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Supervisión Técnica Operativa (ISO 9001)</p>
          </div>
          
          {availableAreas.length > 1 && (
            <div className="flex gap-2">
              {availableAreas.map(area => (
                <button
                  key={area}
                  onClick={() => {
                    setActiveArea(area);
                    setMemberFilter('all');
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeArea === area 
                      ? 'bg-apc-pink text-white shadow-lg shadow-apc-pink/20' 
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  GESTIONAR {area}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-apc-green text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-apc-green/90 transition-all shadow-lg shadow-apc-green/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            DESCARGAR REPORTE {activeArea}
          </button>
          <div className="flex flex-col items-end">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 mr-1">Filtrar por Colaborador</label>
            <select className="bg-white border rounded-xl px-4 py-2 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-apc-pink" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
              <option value="all">TODO EL EQUIPO</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.id === user?.id ? `YO (${(m.name || '').toUpperCase()})` : (m.name || '').toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Tarjetas de Carga del Equipo o Control QA */}
      {activeArea === 'QA' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4 text-apc-pink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              Métricas de Rendimiento QA
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['day', 'week', 'month', 'year', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setQaTimeRange(range)}
                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md transition-all ${qaTimeRange === range ? 'bg-white shadow text-apc-pink' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {range === 'day' ? 'Día' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : range === 'year' ? 'Año' : 'Todo'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teamMembers.map(m => {
              const load = projects.filter(p => p.asignaciones?.some(a => a.usuarioIds?.includes(m.id) || a.usuarioId === m.id) && p.status !== 'Finalizado').length;
              const isMe = m.id === user?.id;
              const metrics = getQAMetrics(m.id);
              
              return (
                <div key={m.id} className={`p-4 rounded-3xl border transition-all shadow-sm bg-white ${isMe ? 'border-apc-green/20' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                    <div>
                      <p className={`text-xs font-black pr-2 ${isMe ? 'text-apc-green' : 'text-slate-800'}`}>
                        {isMe ? 'Mi Rendimiento' : m.name}
                      </p>
                      <span className={`text-[8px] font-black uppercase ${
                        m.role.includes('Lider') || m.role === UserRole.Correccion ? 'text-apc-green' : 'text-slate-400'
                      }`}>
                        {m.role.includes('Lider') || m.role === UserRole.Correccion ? 'LÍDER' : 'OPERATIVO'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-800">{load}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">En Progreso</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-100/50">
                      <p className="text-xl font-black text-slate-800">{metrics.totalCalificadas}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Calificadas</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-100/50">
                      <p className="text-xl font-black text-slate-800">{metrics.avgTime}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Hrs Promedio</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center justify-center bg-emerald-50/50 rounded-lg p-2 border border-emerald-100/50">
                      <svg className="w-3 h-3 text-emerald-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      <p className="text-xs font-black text-emerald-700">{metrics.approved}</p>
                      <p className="text-[7px] text-emerald-600/70 font-black uppercase tracking-widest">Aprobadas</p>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-rose-50/50 rounded-lg p-2 border border-rose-100/50">
                      <svg className="w-3 h-3 text-rose-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                      <p className="text-xs font-black text-rose-700">{metrics.rejected}</p>
                      <p className="text-[7px] text-rose-600/70 font-black uppercase tracking-widest">Rechazadas</p>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-blue-50/50 rounded-lg p-2 border border-blue-100/50">
                      <svg className="w-3 h-3 text-blue-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><polyline points="9 14 12 17 15 11"></polyline></svg>
                      <p className="text-xs font-black text-blue-700">{metrics.checks}</p>
                      <p className="text-[7px] text-blue-600/70 font-black uppercase tracking-widest">Check OK</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeArea !== 'QA' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4 text-apc-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
              Métricas de Rendimiento {activeArea}
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['day', 'week', 'month', 'year', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setQaTimeRange(range)}
                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md transition-all ${qaTimeRange === range ? 'bg-white shadow text-apc-green' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {range === 'day' ? 'Día' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : range === 'year' ? 'Año' : 'Todo'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teamMembers.map(m => {
              const load = projects.filter(p => p.asignaciones?.some(a => a.usuarioIds?.includes(m.id) || a.usuarioId === m.id) && p.status !== 'Finalizado').length;
              const isMe = m.id === user?.id;
              const metrics = getOperativeAreaMetrics(m.id, activeArea);
              
              return (
                <div key={m.id} className={`p-4 rounded-3xl border transition-all shadow-sm bg-white ${isMe ? 'border-apc-green/20' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                    <div>
                      <p className={`text-xs font-black pr-2 ${isMe ? 'text-apc-green' : 'text-slate-800'}`}>
                        {isMe ? 'Mi Rendimiento' : m.name}
                      </p>
                      <span className={`text-[8px] font-black uppercase ${
                        m.role.includes('Lider') ? 'text-apc-green' : 'text-slate-400'
                      }`}>
                        {m.role.includes('Lider') ? 'LÍDER' : 'OPERATIVO'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-800">{load}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">En Progreso (Activas)</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-100/50">
                      <p className="text-xl font-black text-slate-800">{metrics.completed}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Ya Trabajaron</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-100/50">
                      <p className="text-xl font-black text-slate-800">{metrics.avgTime}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Hrs Promedio (General)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center justify-center bg-emerald-50/50 rounded-lg p-2 border border-emerald-100/50">
                      <svg className="w-3 h-3 text-emerald-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      <p className="text-xs font-black text-emerald-700">{metrics.onTime}</p>
                      <p className="text-[7px] text-emerald-600/70 font-black uppercase tracking-widest text-center">Entregas a Tiempo</p>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-amber-50/50 rounded-lg p-2 border border-amber-100/50">
                      <svg className="w-3 h-3 text-amber-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      <p className="text-xs font-black text-amber-700">{metrics.late}</p>
                      <p className="text-[7px] text-amber-600/70 font-black uppercase tracking-widest text-center">Entregas a Destiempo</p>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-rose-50/50 rounded-lg p-2 border border-rose-100/50">
                      <svg className="w-3 h-3 text-rose-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                      <p className="text-xs font-black text-rose-700">{metrics.qARejections}</p>
                      <p className="text-[7px] text-rose-600/70 font-black uppercase tracking-widest text-center">Rechazos de QA</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamMembers.map(m => {
            const load = projects.filter(p => p.asignaciones?.some(a => a.usuarioIds?.includes(m.id) || a.usuarioId === m.id) && p.status !== 'Finalizado').length;
            const isMe = m.id === user?.id;
            
            return (
              <div key={m.id} className={`p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md ${isMe ? 'bg-apc-green/5 border-apc-green/20' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-start mb-3">
                  <p className={`text-xs font-black truncate pr-2 ${isMe ? 'text-apc-green' : 'text-slate-800'}`}>
                    {isMe ? 'Mi Carga (Líder)' : m.name}
                  </p>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                    m.role.includes('Lider') || m.role === UserRole.Correccion ? 'bg-apc-green text-white' :
                    m.role === UserRole.QA_Opera ? 'bg-apc-pink/10 text-apc-pink' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {m.role.includes('Lider') || m.role === UserRole.Correccion ? 'LÍDER' : m.role === UserRole.QA_Opera ? 'QA' : 'OP'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Carga: {load} ODTs Activas</p>
                <div className="w-full bg-slate-200/50 h-2 rounded-full mt-3 overflow-hidden border border-slate-100">
                  <div 
                    className={`h-full transition-all duration-500 ${load > 5 ? 'bg-apc-pink' : load > 3 ? 'bg-amber-500' : 'bg-apc-green'}`} 
                    style={{width: `${Math.min((load/8)*100, 100)}%`}}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla de Gestión de ODTs */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-widest">
            <tr>
              <th className="px-6 py-5">ODT / Empresa</th>
              <th className="px-6 py-5">Responsable Asignado</th>
              <th className="px-6 py-5">Estado de Fase</th>
              <th className="px-6 py-5 text-right">Delegar Gestión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {areaProjects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-300 italic font-medium uppercase text-[10px] tracking-widest">No hay proyectos activos requiriendo gestión en esta área estratégica.</td>
              </tr>
            ) : (
              areaProjects.map(p => {
                const currentAssignmentArea = activeArea;
                const currentAssignment = p.asignaciones?.find(a => normalizeString(a.area) === normalizeString(currentAssignmentArea));
                const isAssignedToMe = currentAssignment?.usuarioIds?.includes(user?.id || '') || currentAssignment?.usuarioId === user?.id;

                const hasClientLink = p.presentation_link || p.comentarios?.some(c => c.text.includes('PRESENTACIÓN PARA CLIENTE'));
                const displayStatus = (p.status === 'En revisión con cliente' || hasClientLink) ? 'En revisión con cliente' : p.status;

                return (
                  <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${isAssignedToMe ? 'bg-apc-green/5' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-mono font-black text-apc-pink text-xs">{p.id}</p>
                      <p className="text-[10px] font-bold text-slate-800 uppercase truncate max-w-[200px]">{p.empresa}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${currentAssignment ? 'bg-apc-green shadow-sm' : 'bg-apc-pink/30 animate-pulse'}`}></div>
                         <span className={`text-xs font-bold uppercase ${currentAssignment ? 'text-slate-600' : 'text-apc-pink italic'}`}>
                           {currentAssignment 
                             ? users.filter(m => currentAssignment.usuarioIds?.includes(m.id) || currentAssignment.usuarioId === m.id).map(u => u.name).join(', ')
                             : 'PENDIENTE ASIGNAR'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter ${displayStatus === 'En revisión con cliente' ? 'bg-purple-600 text-white shadow-sm' : p.status === 'QA' ? 'bg-apc-pink/10 text-apc-pink shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                        {displayStatus}
                      </span>
                      <div className="text-[7px] font-black text-slate-400 mt-0.5 uppercase">{p.etapa_actual}</div>
                      {p.category === 'PARRILLA RRSS' && p.materiales && p.materiales.length > 0 && (
                        <div className="text-[8px] font-bold text-apc-pink mt-1 uppercase tracking-widest">
                          {p.materiales.filter(m => m.estado === 'Aprobado/Publicado').length}/{p.materiales.length} Mats
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                       <button 
                         onClick={() => onViewProject(p.id)}
                         className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1 text-[9px] font-black uppercase"
                       >
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                         DETALLE
                       </button>
                       <TeamAssignmentDropdown 
                         project={p}
                         teamMembers={teamMembers}
                         currentAssignment={currentAssignment}
                         currentAssignmentArea={currentAssignmentArea}
                         delegateProject={delegateProject}
                       />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderDashboard;
