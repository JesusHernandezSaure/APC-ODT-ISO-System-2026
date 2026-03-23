
import React from 'react';
import { Project, User, UserRole } from './types';
import { Icons } from './constants';
import { normalizeString, getPriorityInfo } from './workflowConfig';

interface ProjectTableProps {
  projects: Project[];
  onView: (id: string) => void;
  checkSLA: (p: Project) => { isAlert: boolean; text: string } | null;
  highlightUnassigned?: boolean;
  users: User[];
}

export const ProjectTable: React.FC<ProjectTableProps> = ({ projects, onView, checkSLA, highlightUnassigned, users }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest">
        <tr>
          <th className="px-6 py-5">ODT ID</th>
          <th className="px-6 py-5">Proyecto / Cliente</th>
          <th className="px-6 py-5">Responsable</th>
          <th className="px-6 py-5">Status</th>
          <th className="px-6 py-5">Entrega / Prioridad</th>
          <th className="px-6 py-5">SLA</th>
          <th className="px-6 py-5 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {projects?.map((p: Project) => {
          const sla = checkSLA(p);
          const priority = getPriorityInfo(p.fecha_entrega);
          const currentStage = (p.etapa_actual || p.etapaActual || '');
          const isQA = currentStage.toUpperCase().includes('QA') || p.status === 'QA';
          const targetArea = isQA ? 'QA' : currentStage;
          const assignment = p.asignaciones?.find(a => normalizeString(a.area) === normalizeString(targetArea));
          let responsible = users?.find((u: User) => u.id === assignment?.usuarioId);
          let isLeaderFallback = false;

          if (!responsible) {
            // Si no hay asignación directa, el responsable es el Líder del área actual
            responsible = users?.find((u: User) => 
              normalizeString(u.department) === normalizeString(targetArea) && 
              (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion)
            );
            if (responsible) isLeaderFallback = true;
          }

          const isUnassigned = highlightUnassigned && !responsible;

          const correctionCount = p.correction_count_after_presentation || 0;
          const isRejected = p.client_feedback === 'rejected';
          const isApproved = p.client_feedback === 'approved';

          let statusColorClass = 'bg-slate-100 text-slate-600';
          if (isApproved) statusColorClass = 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200';
          else if (isRejected || correctionCount >= 3 || p.is_alarm_active) statusColorClass = 'bg-rose-100 text-rose-700 animate-pulse shadow-sm border border-rose-200';
          else if (correctionCount === 2) statusColorClass = 'bg-orange-100 text-orange-700 shadow-sm border border-orange-200';
          else if (correctionCount === 1) statusColorClass = 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200';
          else if (p.status === 'QA') statusColorClass = 'bg-amber-100 text-amber-700 shadow-sm';

          const isFirstRejection = p.contadorCorrecciones === 1;
          const isSecondRejection = (p.contadorCorrecciones || 0) >= 2;

          return (
            <tr key={p?.id} className={`hover:bg-slate-50/50 transition-all ${isUnassigned ? 'bg-amber-50/30 font-bold' : sla?.isAlert ? 'bg-apc-pink/5' : ''} ${isSecondRejection ? 'bg-red-50 border-l-4 border-red-500' : ''}`}>
              <td className="px-6 py-4 font-mono font-black text-apc-pink text-xs">
                <div className="flex items-center gap-1">
                  {isSecondRejection && <Icons.Alert className="w-3 h-3 text-red-600 animate-pulse" />}
                  {p?.id}
                </div>
                {isUnassigned && (
                  <div className="text-[8px] text-apc-green font-black animate-pulse mt-1 tracking-tighter uppercase">
                    Pendiente Asignar
                  </div>
                )}
                {p.is_alarm_active && (
                  <div className="text-[8px] text-rose-600 font-black animate-pulse mt-1 tracking-tighter uppercase">
                    🚨 ALARMA ACTIVA
                  </div>
                )}
                {isSecondRejection && (
                  <div className="text-[8px] text-red-600 font-black mt-1 tracking-tighter uppercase">
                    ⚠️ RECHAZO REINCIDENTE
                  </div>
                )}
                {isFirstRejection && (
                  <div className="text-[8px] text-red-700 font-bold mt-1 tracking-tighter uppercase">
                    ⚠️ REQUIERE CORRECCIÓN
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-800 truncate max-w-[200px]">{p?.empresa}</div>
                <div className="text-[10px] text-slate-400 font-medium uppercase truncate max-w-[200px]">
                  {p?.marca} {p?.producto ? `| ${p.producto}` : ''}
                </div>
                <div className="text-[9px] text-slate-500 font-bold uppercase truncate max-w-[200px] mt-0.5">
                  {p?.subCategory || 'S/C'} | {p?.category || 'S/Cat'}
                </div>
              </td>
              <td className="px-6 py-4">
                 {responsible ? (
                    <div className="flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black border ${isLeaderFallback ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>
                          {(responsible.name || '??').substring(0,2).toUpperCase()}
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-600 uppercase leading-none">{responsible.name || 'Sin Nombre'}</span>
                          {isLeaderFallback && <span className="text-[7px] font-black text-amber-600 uppercase tracking-tighter mt-0.5">Líder de Área</span>}
                       </div>
                    </div>
                 ) : (
                    <span className="text-[10px] font-black text-rose-300 italic uppercase">Sin Asignar</span>
                 )}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${statusColorClass} ${p.status === 'Correcciones' ? (isFirstRejection ? 'text-red-700 font-bold border border-red-200 bg-red-50' : 'bg-rose-600 text-white') : ''}`}>
                  {isRejected ? 'RECHAZADA' : isApproved ? 'APROBADA' : p?.status}
                </span>
                <div className="text-[7px] font-black text-slate-400 mt-0.5 truncate max-w-[80px] uppercase">{(p?.etapa_actual || p?.etapaActual)}</div>
                {p?.category === 'PARRILLA RRSS' && p?.materiales && p.materiales.length > 0 && (
                  <div className="text-[8px] font-bold text-blue-500 mt-1 uppercase tracking-widest">
                    {p.materiales.filter(m => m.estado === 'Aprobado/Publicado').length}/{p.materiales.length} Mats
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {p.fecha_entrega && (
                    <div className={`w-3 h-3 ${priority.shape === 'rhombus' ? 'rotate-45' : 'rounded-full'} ${priority.color} shadow-sm`} title={priority.text}></div>
                  )}
                  {p.fecha_entrega ? (
                    <span className={`text-[10px] font-bold ${priority.textColor}`}>
                      {new Date(p.fecha_entrega + 'T00:00:00').toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300 italic">N/A</span>
                  )}
                </div>
                {p.fecha_entrega && (
                  <div className={`text-[7px] font-black uppercase mt-0.5 ${priority.textColor}`}>
                    {priority.text}
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                {sla?.isAlert ? (
                  <span className="text-apc-pink text-[10px] font-black animate-pulse flex items-center gap-1">
                    <Icons.Plus className="w-3 h-3" /> CRÍTICO
                  </span>
                ) : (
                  <span className="text-apc-green text-[10px] font-bold uppercase tracking-widest">OK</span>
                )}
              </td>
              <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                {p.last_delivery_link && (
                  <a 
                    href={p.last_delivery_link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all shadow-sm"
                    title="Ver último material"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </a>
                )}
                <button 
                  onClick={() => onView(p.id)} 
                  className="text-apc-pink font-black hover:text-apc-pink/80 transition-colors text-xs border-b-2 border-transparent hover:border-apc-pink/80 pb-0.5 uppercase tracking-widest"
                >
                  DETALLE
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
