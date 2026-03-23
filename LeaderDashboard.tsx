
import React, { useMemo, useState } from 'react';
import { useODT } from './ODTContext';
import { UserRole, Project } from './types';
import { normalizeString } from './workflowConfig';

interface LeaderDashboardProps {
  onViewProject: (id: string) => void;
}

const LeaderDashboard: React.FC<LeaderDashboardProps> = ({ onViewProject }) => {
  const { user, projects, users, delegateProject } = useODT();
  const [memberFilter, setMemberFilter] = useState('all');

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
      
      if (user.role === UserRole.Medico_Lider) {
        // El Medico Lider ve a ambos equipos si está en modo dual, 
        // pero filtramos por el área activa para mayor claridad en la delegación
        return memberDept === activeAreaNorm;
      }
      
      return memberDept === normalizeString(user.department);
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
      filtered = filtered.filter(p => p.asignaciones?.some(a => a.usuarioId === memberFilter));
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
        <div className="flex flex-col items-end">
          <label className="text-[9px] font-black text-slate-400 uppercase mb-1 mr-1">Filtrar por Colaborador</label>
          <select className="bg-white border rounded-xl px-4 py-2 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-apc-pink" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
            <option value="all">TODO EL EQUIPO</option>
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.id === user?.id ? `YO (${(m.name || '').toUpperCase()})` : (m.name || '').toUpperCase()}</option>)}
          </select>
        </div>
      </header>

      {/* Tarjetas de Carga del Equipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {teamMembers.map(m => {
          const load = projects.filter(p => p.asignaciones?.some(a => a.usuarioId === m.id) && p.status !== 'Finalizado').length;
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
                const isAssignedToMe = currentAssignment?.usuarioId === user?.id;

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
                           {users.find(m => m.id === currentAssignment?.usuarioId)?.name || 'PENDIENTE ASIGNAR'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter ${p.status === 'QA' ? 'bg-apc-pink/10 text-apc-pink shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                        {p.status}
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
                       <select 
                         className={`border-none rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all outline-none ${
                           currentAssignment ? 'bg-apc-pink text-white hover:bg-apc-pink/80' : 'bg-apc-green text-white hover:bg-apc-green/80 animate-bounce'
                         }`} 
                         onChange={(e) => {
                           if (e.target.value) delegateProject(p.id, currentAssignmentArea, e.target.value);
                         }}
                         value={currentAssignment?.usuarioId || ''}
                       >
                         <option value="">-- ASIGNAR RESPONSABLE --</option>
                         {teamMembers.map(m => (
                           <option key={m.id} value={m.id}>
                             {m.id === user?.id ? `MI PERSONA (${m.name.toUpperCase()})` : m.name.toUpperCase()}
                           </option>
                         ))}
                       </select>
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
