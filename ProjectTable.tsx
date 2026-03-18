
import React from 'react';
import { Project } from './types';
import { Icons } from './constants';

export const ProjectTable = ({ projects, onView, checkSLA, highlightUnassigned, users }: any) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest">
        <tr>
          <th className="px-6 py-5">ODT ID</th>
          <th className="px-6 py-5">Proyecto / Cliente</th>
          <th className="px-6 py-5">Responsable</th>
          <th className="px-6 py-5">Status</th>
          <th className="px-6 py-5">SLA</th>
          <th className="px-6 py-5 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {projects?.map((p: Project) => {
          const sla = checkSLA(p);
          const currentStage = (p.etapa_actual || (p as any).etapaActual || '');
          const isQA = currentStage.toUpperCase().includes('QA') || p.status === 'QA';
          const targetArea = isQA ? 'QA' : currentStage;
          const assignment = p.asignaciones?.find(a => a.area === targetArea);
          let responsible = users?.find((u: any) => u.id === assignment?.usuarioId);
          let isLeaderFallback = false;

          if (!responsible) {
            // Si no hay asignación directa, el responsable es el Líder del área actual
            responsible = users?.find((u: any) => 
              u.department === targetArea && 
              (u.role === 'Lider_Operativo' || u.role === 'Correccion')
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

          return (
            <tr key={p?.id} className={`hover:bg-slate-50/50 transition-all ${isUnassigned ? 'bg-amber-50/30 font-bold' : sla?.isAlert ? 'bg-pink-50/20' : ''}`}>
              <td className="px-6 py-4 font-mono font-black text-blue-600 text-xs">
                {p?.id}
                {isUnassigned && (
                  <div className="text-[8px] text-amber-600 font-black animate-pulse mt-1 tracking-tighter uppercase">
                    Pendiente Asignar
                  </div>
                )}
                {p.is_alarm_active && (
                  <div className="text-[8px] text-rose-600 font-black animate-pulse mt-1 tracking-tighter uppercase">
                    🚨 ALARMA ACTIVA
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-800 truncate max-w-[200px]">{p?.empresa}</div>
                <div className="text-[10px] text-slate-400 font-medium uppercase truncate max-w-[200px]">{p?.producto}</div>
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
                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${statusColorClass}`}>
                  {isRejected ? 'RECHAZADA' : isApproved ? 'APROBADA' : p?.status}
                </span>
                <div className="text-[7px] font-black text-slate-400 mt-0.5 truncate max-w-[80px] uppercase">{(p?.etapa_actual || (p as any).etapaActual)}</div>
                {p?.category === 'PARRILLA RRSS' && p?.materiales && p.materiales.length > 0 && (
                  <div className="text-[8px] font-bold text-blue-500 mt-1 uppercase tracking-widest">
                    {p.materiales.filter(m => m.estado === 'Aprobado/Publicado').length}/{p.materiales.length} Mats
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                {sla?.isAlert ? (
                  <span className="text-pink-600 text-[10px] font-black animate-pulse flex items-center gap-1">
                    <Icons.Plus /> CRÍTICO
                  </span>
                ) : (
                  <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">OK</span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => onView(p)} className="text-blue-600 font-black hover:text-blue-800 transition-colors text-xs border-b-2 border-transparent hover:border-blue-800 pb-0.5">DETALLE</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
