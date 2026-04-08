
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useODT } from './ODTContext';
import { UserRole, Project, User, ProjectAssignment } from './types';
import { normalizeString } from './workflowConfig';
import { generateAreaReport, downloadCSV } from './reportUtils';

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

  const handleDownloadReport = () => {
    if (!user || !projects || !users || !activeArea) return;
    const reportData = generateAreaReport(projects, users, activeArea);
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

      {/* Tarjetas de Carga del Equipo */}
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
