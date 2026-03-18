
import React, { useMemo, useState } from 'react';
import { useODT } from './ODTContext';
import { UserRole, Project } from './types';

const LeaderDashboard: React.FC = () => {
  const { user, projects, users, checkSLA, delegateProject } = useODT();
  const [memberFilter, setMemberFilter] = useState('all');

  const leaderArea = useMemo(() => {
    if (user?.department === 'QA' || user?.role === UserRole.Correccion) return 'QA';
    if (user?.department === 'Creativo') return 'Creativo';
    if (user?.department === 'Diseño') return 'Diseño';
    if (user?.department === 'Digital') return 'Digital';
    return user?.department || '';
  }, [user]);

  const teamMembers = useMemo(() => {
    if (!user || !users) return [];
    return users.filter(u => u.department === user.department);
  }, [user, users]);

  const areaProjects = useMemo(() => {
    if (!leaderArea || !projects) return [];
    
    let filtered: Project[] = [];
    
    // Filtro unificado para Líder de Calidad / Corrección
    if (leaderArea === 'QA' || user?.role === UserRole.Correccion) {
      filtered = projects.filter(p => {
        const stageStr = (p.etapa_actual || (p as any).etapaActual || '').toUpperCase();
        return stageStr.includes('REVISIÓN QA') || p.status === 'QA';
      });
    } else {
      // Otros líderes operativos ven ODTs activas de su área ISO
      filtered = projects.filter(p => p.areas_seleccionadas?.includes(leaderArea));
    }

    if (memberFilter !== 'all') {
      filtered = filtered.filter(p => p.asignaciones?.some(a => a.usuarioId === memberFilter));
    }
    
    return filtered;
  }, [projects, leaderArea, memberFilter, user]);

  if (!user || !projects || !users) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex justify-between items-center border-b pb-6">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Control de Área: {user?.department || 'CALIDAD'}</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Supervisión Técnica Operativa (ISO 9001)</p>
        </div>
        <div className="flex flex-col items-end">
          <label className="text-[9px] font-black text-slate-400 uppercase mb-1 mr-1">Filtrar por Colaborador</label>
          <select className="bg-white border rounded-xl px-4 py-2 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-blue-500" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
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
            <div key={m.id} className={`p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md ${isMe ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-100'}`}>
              <div className="flex justify-between items-start mb-3">
                <p className={`text-xs font-black truncate pr-2 ${isMe ? 'text-blue-700' : 'text-slate-800'}`}>
                  {isMe ? 'Mi Carga (Líder)' : m.name}
                </p>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                  m.role.includes('Lider') || m.role === UserRole.Correccion ? 'bg-blue-600 text-white' :
                  m.role === UserRole.QA_Opera ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {m.role.includes('Lider') || m.role === UserRole.Correccion ? 'LÍDER' : m.role === UserRole.QA_Opera ? 'QA' : 'OP'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Carga: {load} ODTs Activas</p>
              <div className="w-full bg-slate-200/50 h-2 rounded-full mt-3 overflow-hidden border border-slate-100">
                <div 
                  className={`h-full transition-all duration-500 ${load > 5 ? 'bg-rose-500' : load > 3 ? 'bg-amber-500' : 'bg-blue-500'}`} 
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
                const currentAssignmentArea = (user?.role === UserRole.Correccion || user?.department === 'QA') ? 'QA' : leaderArea;
                const currentAssignment = p.asignaciones?.find(a => a.area === currentAssignmentArea);
                const isAssignedToMe = currentAssignment?.usuarioId === user?.id;

                return (
                  <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${isAssignedToMe ? 'bg-blue-50/20' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-mono font-black text-blue-600 text-xs">{p.id}</p>
                      <p className="text-[10px] font-bold text-slate-800 uppercase truncate max-w-[200px]">{p.empresa}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${currentAssignment ? 'bg-blue-600 shadow-sm' : 'bg-rose-300 animate-pulse'}`}></div>
                         <span className={`text-xs font-bold uppercase ${currentAssignment ? 'text-slate-600' : 'text-rose-400 italic'}`}>
                           {users.find(m => m.id === currentAssignment?.usuarioId)?.name || 'PENDIENTE ASIGNAR'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter ${p.status === 'QA' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                        {p.status}
                      </span>
                      <div className="text-[7px] font-black text-slate-400 mt-0.5 uppercase">{(p.etapa_actual || (p as any).etapaActual)}</div>
                      {p.category === 'PARRILLA RRSS' && p.materiales && p.materiales.length > 0 && (
                        <div className="text-[8px] font-bold text-blue-500 mt-1 uppercase tracking-widest">
                          {p.materiales.filter(m => m.estado === 'Aprobado/Publicado').length}/{p.materiales.length} Mats
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <select 
                         className={`border-none rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all outline-none ${
                           currentAssignment ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-900 text-white hover:bg-slate-800 animate-bounce'
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
