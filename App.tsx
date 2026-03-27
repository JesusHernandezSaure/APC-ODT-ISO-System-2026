
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole, ViewState } from './types';
import { Icons } from './constants';
import { ODTProvider, useODT } from './ODTContext';
import { AppRouter } from './AppRouter';
import AdminDashboard from './AdminDashboard';
import LeaderDashboard from './LeaderDashboard';
import ProjectDetail from './ProjectDetail';
import ClientsView from './ClientsView';
import UsersView from './UsersView';
import VirtualAuditor from './VirtualAuditor';
import CommercialIntelligence from './CommercialIntelligence';
import MedicalUserManual from './MedicalUserManual';
import { db } from './firebase';
import { ProjectTable } from './ProjectTable';
import { normalizeString } from './workflowConfig';

import ErrorBoundary from './ErrorBoundary';

import { CalendarView } from './CalendarView';

const AppContent: React.FC = () => {
  const { projects, deletedProjects, user, users, loading } = useODT();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!db || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-apc-green relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-full bg-striped-green opacity-5"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-apc-pink/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-apc-light-teal/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="apc-pill w-24 h-24 flex items-center justify-center mb-8 animate-pulse">
            <div className="apc-pill-inner">,</div>
          </div>
          <h1 className="text-white text-4xl font-black tracking-tighter mb-2">
            APC <span className="text-apc-pink">Control Hub</span>
          </h1>
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-4">
            <div className="h-full bg-apc-pink animate-loading-bar"></div>
          </div>
          <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.5em] mt-6 animate-pulse">
            Iniciando sistema...
          </p>
        </div>
      </div>
    );
  }

  const exportMasterCSV = () => {
    const headers = [
      "ID ODT", "Cliente", "Marca", "Producto", "Categoría", "Subcategoría", 
      "Fecha Creación", "Fecha Entrega (Prometida)", "Fecha Finalizado (Real)", 
      "Días en Sistema", "Etapa Actual", "Estatus", "Monto Proyectado", 
      "Facturado", "Pagado", "Costo Promedio por Día", "Costo por Área (Estimado)",
      "Correcciones QA (Total)", "Correcciones Cliente (Total)", 
      "Feedback Cliente Final", "Total Correcciones Post-Presentación",
      "Aprobadores (QA/Cuentas/Cliente)", "Integrantes por Área", 
      "Último Comentario", "Autor Último Comentario"
    ];

    const escapeCSV = (val: string | number | boolean | null | undefined) => {
      if (val === null || val === undefined) return "";
      let str = String(val).replace(/"/g, '""');
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        str = `"${str}"`;
      }
      return str;
    };

    const rows = projects.map(p => {
      const created = new Date(p.createdAt);
      const finished = p.fecha_finalizado ? new Date(p.fecha_finalizado) : new Date();
      const daysInSystem = Math.max(1, Math.floor((finished.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
      
      const avgCostPerDay = (p.monto_proyectado || 0) / daysInSystem;
      const numAreas = p.areas_seleccionadas?.length || 1;
      const costPerArea = (p.monto_proyectado || 0) / numAreas;

      const qaRejections = p.comentarios?.filter(c => c.isSystemEvent && c.text.includes("RECHAZADO en [REVISIÓN QA")).length || 0;
      const clientRejections = p.comentarios?.filter(c => c.isSystemEvent && c.text.includes("RECHAZADO por Cliente")).length || 0;
      
      const approvers = p.comentarios?.filter(c => c.isSystemEvent && c.text.includes("APROBADO"))
        .map(c => `${c.authorName} (${c.text.split(' ')[0]})`)
        .join(" | ") || "N/A";

      const assignments = p.asignaciones?.map(a => {
        const u = users.find(user => user.id === a.usuarioId);
        return `${a.area}: ${u?.name || 'Pte'}`;
      }).join(" | ") || "N/A";

      const lastComment = p.comentarios?.[0];

      return [
        p.id,
        p.empresa,
        p.marca,
        p.producto,
        p.category || "N/A",
        p.subCategory || "N/A",
        created.toLocaleDateString(),
        p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString() : "N/A",
        p.fecha_finalizado ? new Date(p.fecha_finalizado).toLocaleDateString() : "En Proceso",
        daysInSystem,
        p.etapa_actual,
        p.status,
        p.monto_proyectado || 0,
        p.facturado ? "SÍ" : "NO",
        p.pagado ? "SÍ" : "NO",
        avgCostPerDay.toFixed(2),
        costPerArea.toFixed(2),
        qaRejections,
        clientRejections,
        p.client_feedback || "Pte",
        p.correction_count_after_presentation || 0,
        approvers,
        assignments,
        lastComment?.text || "N/A",
        lastComment?.authorName || "N/A"
      ].map(escapeCSV).join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `APC_Master_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const MyInbox: React.FC<{ onViewProject: (id: string) => void }> = ({ onViewProject }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { user, projects, users, checkSLA, getRoadmapStages } = useODT();
    const isGlobalLead = user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider;
    
    const myProjects = projects?.filter(p => {
      if (!isGlobalLead) {
        const isDirectlyAssigned = p.asignaciones?.some(a => a.usuarioId === user?.id);
        const isAreaLead = user?.role === UserRole.Lider_Operativo || user?.role === UserRole.Medico_Lider;
        const isOwner = p.assignedExecutives?.includes(user?.id || '');
        
        const stages = getRoadmapStages(p);
        const currentStage = stages[p.current_stage_index || 0] || '';
        const userDept = normalizeString(user?.department || '');
        const normalizedCurrentStage = normalizeString(currentStage);
        
        let isMyCurrentStage = false;
        if (userDept === 'qa' || user?.role === UserRole.Correccion) {
          isMyCurrentStage = normalizedCurrentStage.includes('qa');
        } else if (userDept === 'cuentas') {
          isMyCurrentStage = normalizedCurrentStage.includes('cuentas');
        } else {
          isMyCurrentStage = normalizedCurrentStage === userDept;
        }

        const isRelevant = isDirectlyAssigned || (isAreaLead && isMyCurrentStage) || (isOwner && isMyCurrentStage);

        // Medical staff should NOT see QA tasks in their production inbox
        const isMedical = user?.role === UserRole.Medico_Lider || user?.role === UserRole.Medico_Opera;
        if (isMedical) {
          const inQAStage = normalizedCurrentStage.includes('qa') || p.status === 'QA';
          if (inQAStage) return false;
        }

        if (!isRelevant) return false;
      }

      if (searchTerm) {
        const search = normalizeString(searchTerm);
        return (
          normalizeString(p.id).includes(search) ||
          normalizeString(p.empresa).includes(search) ||
          normalizeString(p.marca).includes(search) ||
          normalizeString(p.producto).includes(search) ||
          normalizeString(p.category || '').includes(search) ||
          normalizeString(p.subCategory || '').includes(search) ||
          normalizeString(p.status).includes(search)
        );
      }
      
      return true;
    }) || [];
    
    return (
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black">Bandeja Operativa</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              {isGlobalLead ? 'VISTA GLOBAL DE CARTERA APC' : 'Tareas técnicas asignadas directamente'}
            </p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="BUSCAR ODT, MARCA, CLIENTE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-apc-pink focus:border-transparent transition-all outline-none"
            />
          </div>
        </header>
        <div className="bg-white p-6 rounded-xl border-2 border-dashed border-slate-200">
           {myProjects.length === 0 ? (
             <p className="text-slate-400 italic text-center py-10">
               {searchTerm ? 'No se encontraron resultados para su búsqueda.' : 'No tiene tareas asignadas en este momento.'}
             </p>
           ) : (
             <ProjectTable projects={myProjects} onView={onViewProject} checkSLA={checkSLA} users={users} />
           )}
        </div>
      </div>
    );
  };

  const QABox: React.FC<{ onViewProject: (id: string) => void }> = ({ onViewProject }) => {
    const { user, projects, users, checkSLA } = useODT();
    const qaProjects = projects?.filter(p => {
      const currentE = (p.etapa_actual || p.etapaActual || '').toUpperCase();
      const inQAStage = currentE.includes('REVISIÓN QA') || p.status === 'QA';
      
      if (!inQAStage) return false;

      // Admin, QA Leader, Medical Leader and Accounts see all pending QA
      if (user?.role === UserRole.Correccion || user?.role === UserRole.Admin || user?.role === UserRole.Medico_Lider || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera) return true;

      // QA Operatives and Medical Operatives see only assigned tasks in QA area
      if (user?.role === UserRole.QA_Opera || user?.role === UserRole.Medico_Opera) {
        return p.asignaciones?.some(a => a.usuarioId === user?.id && a.area === 'QA');
      }

      return false;
    }) || [];

    const isGlobalQA = user?.role === UserRole.Correccion || user?.role === UserRole.Admin || user?.role === UserRole.Medico_Lider;

    return (
      <div className="space-y-6 animate-fadeIn">
        <header>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Caja de QA</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 italic">
            {isGlobalQA ? 'Supervisión Global de Calidad (Todas las Revisiones)' : 'Tareas de Revisión Delegadas a su Perfil'}
          </p>
        </header>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
           {qaProjects.length === 0 ? (
             <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                   <Icons.Ai />
                </div>
                <p className="text-slate-400 italic font-medium">No hay revisiones técnicas pendientes en este momento.</p>
             </div>
           ) : (
             <ProjectTable 
               projects={qaProjects} 
               onView={onViewProject} 
               checkSLA={checkSLA} 
               users={users}
               highlightUnassigned={isGlobalQA} 
             />
           )}
        </div>
      </div>
    );
  };

  const Finances: React.FC<{ onViewProject: (id: string) => void }> = ({ onViewProject }) => {
    const { projects, updateBilling, updatePaymentStatus, getRoadmapStages } = useODT();
    const now = new Date();
    const billingProjects = projects?.filter(p => {
      const stages = getRoadmapStages(p);
      const closingIndex = stages.indexOf("CUENTAS (Cierre)");
      return p.current_stage_index >= closingIndex;
    }) || [];

    return (
      <div className="space-y-8 animate-fadeIn">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Módulo de Facturación</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Control de Tesorería - APC Realtime</p>
          </div>
          <button 
            onClick={exportMasterCSV}
            className="px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl"
          >
            <Icons.Dashboard /> EXPORTAR REPORTE MAESTRO (CSV)
          </button>
        </header>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="px-6 py-5">Identificador ODT</th>
                <th className="px-6 py-5">Cliente / Producto</th>
                <th className="px-6 py-5">Monto Proyectado</th>
                <th className="px-6 py-5 text-center">Fact..</th>
                <th className="px-6 py-5 text-center">Pagado</th>
                <th className="px-6 py-5">Estatus de Cobro</th>
                <th className="px-6 py-5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {billingProjects.map(p => {
                const stages = getRoadmapStages(p);
                const currentStage = stages[p.current_stage_index || 0];
                const lastUpdate = new Date(p.updatedAt);
                const daysInStage = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
                const isLateBilling = currentStage === "CUENTAS (Cierre)" && daysInStage >= 3 && !p.facturado;

                return (
                  <tr key={p.id} className={`hover:bg-slate-50/80 transition-all ${isLateBilling ? 'bg-rose-50' : ''}`}>
                    <td className="px-6 py-4 font-mono font-black text-blue-600 text-xs">
                      {p.id}
                      {isLateBilling && (
                        <div className="text-[9px] text-rose-600 font-black animate-pulse flex items-center gap-1 mt-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 2v10"/><path d="M12 16v.01"/></svg>
                          RIESGO DE FACTURACIÓN (+3D)
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-800 uppercase text-xs">{p.empresa}</div>
                      <div className="text-[10px] text-slate-400 font-bold">{p.producto}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900">
                      ${p.monto_proyectado?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={p.facturado} 
                        onChange={e => updateBilling(p.id, e.target.checked)}
                        className="w-6 h-6 accent-blue-600 cursor-pointer rounded-lg" 
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={p.pagado} 
                        onChange={e => updatePaymentStatus(p.id, e.target.checked)}
                        className="w-6 h-6 accent-emerald-600 cursor-pointer rounded-lg" 
                      />
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                         p.pagado ? 'bg-emerald-100 text-emerald-700' : 
                         p.facturado ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                       }`}>
                         {p.pagado ? 'CONCILIADO' : p.facturado ? 'FACTURADO' : 'POR FACTURAR'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button onClick={() => onViewProject(p.id)} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {billingProjects.length === 0 && (
            <div className="p-20 text-center text-slate-300 font-black uppercase tracking-[0.3em] text-xs">
              No hay proyectos en ciclo de cierre financiero
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderView = (view: ViewState | string, params?: { id?: string }) => {
    const onViewProject = (id: string) => {
      navigate(`/project/${encodeURIComponent(id)}`);
    };

    if (view === 'project-detail') {
      const id = params?.id || selectedProjectId;
      if (!id) return <div className="p-20 text-center font-black uppercase text-slate-400">ID de ODT no proporcionado</div>;
      
      const project = projects.find(p => p.id.trim().toUpperCase() === id.trim().toUpperCase());
      if (project) return <ProjectDetail project={project} onBack={() => navigate(-1)} />;
      
      // Also check in deleted projects if user is Admin
      if (user?.role === UserRole.Admin) {
        const deletedProject = deletedProjects.find(p => p.id.trim().toUpperCase() === id.trim().toUpperCase());
        if (deletedProject) return <ProjectDetail project={deletedProject} onBack={() => navigate(-1)} />;
      }
      
      return <div className="p-20 text-center font-black uppercase text-slate-400">Proyecto no encontrado</div>;
    }

    switch (view) {
      case 'dashboard': return <AdminDashboard />;
      case 'leader-dashboard': return <LeaderDashboard onViewProject={onViewProject} />;
      case 'my-projects': return <MyInbox onViewProject={onViewProject} />;
      case 'clients': return <ClientsView onViewProject={onViewProject} />;
      case 'qa-box': return <QABox onViewProject={onViewProject} />;
      case 'finances': return <Finances onViewProject={onViewProject} />;
      case 'calendar': return <CalendarView onOpenProject={onViewProject} />;
      case 'users': return <UsersView />;
      case 'auditor': return <VirtualAuditor />;
      case 'commercial-intelligence': return <CommercialIntelligence />;
      case 'medical-manual': return <MedicalUserManual />;
      case 'deleted-projects': return <DeletedProjectsView onViewProject={onViewProject} />;
      default: return <AdminDashboard />;
    }
  };

  return <AppRouter renderView={renderView} onRouteReset={() => setSelectedProjectId(null)} />;
};

const DeletedProjectsView: React.FC<{ onViewProject: (id: string) => void }> = ({ onViewProject }) => {
  const { deletedProjects, restoreProject, user } = useODT();
  
  if (user?.role !== UserRole.Admin) {
    return <div className="p-20 text-center font-black uppercase text-rose-600">Acceso Denegado</div>;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">ODTs Eliminadas</h1>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Historial de purga y recuperación</p>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
            <tr>
              <th className="px-6 py-5">ODT ID</th>
              <th className="px-6 py-5">Cliente / Proyecto</th>
              <th className="px-6 py-5">Eliminado Por</th>
              <th className="px-6 py-5">Fecha / Motivo</th>
              <th className="px-6 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {deletedProjects.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/80 transition-all">
                <td className="px-6 py-4 font-mono font-black text-slate-400 text-xs line-through">
                  {p.id}
                </td>
                <td className="px-6 py-4">
                  <div className="font-black text-slate-800 uppercase text-xs">{p.empresa}</div>
                  <div className="text-[10px] text-slate-400 font-bold">{p.producto}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700 text-xs uppercase">{p.deletedByName || 'N/A'}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">ID: {p.deletedBy}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-600 text-xs">
                    {p.deletedAt ? new Date(p.deletedAt).toLocaleString() : 'N/A'}
                  </div>
                  <div className="text-[10px] text-rose-500 font-medium italic mt-1">
                    "{p.deletionReason || 'Sin motivo especificado'}"
                  </div>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button 
                    onClick={() => onViewProject(p.id)}
                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-all"
                    title="Ver Detalles"
                  >
                    <Icons.Project className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`¿Seguro que deseas restaurar la ODT ${p.id}?`)) {
                        restoreProject(p.id);
                      }
                    }}
                    className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-all"
                    title="Restaurar ODT"
                  >
                    <Icons.Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deletedProjects.length === 0 && (
          <div className="p-20 text-center text-slate-300 font-black uppercase tracking-[0.3em] text-xs">
            No hay ODTs eliminadas en el historial
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ODTProvider>
      <AppContent />
    </ODTProvider>
  </ErrorBoundary>
);


export default App;
