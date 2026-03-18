
import React, { useState } from 'react';
import { Project, UserRole, ViewState } from './types';
import { Icons } from './constants';
import { ODTProvider, useODT } from './ODTContext';
import { AppRouter } from './AppRouter';
import AdminDashboard from './AdminDashboard';
import LeaderDashboard from './LeaderDashboard';
import ProjectDetail from './ProjectDetail';
import ClientsView from './ClientsView';
import UsersView from './UsersView';
import { db } from './firebase';
import { ProjectTable } from './ProjectTable';

import ErrorBoundary from './ErrorBoundary';

const AppContent: React.FC = () => {
  const { user, projects, users, checkSLA, updateBilling, updatePaymentStatus, loading, getRoadmapStages } = useODT();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  if (!db || loading) {
    return (
      <div className="bg-[#0f172a] h-screen w-screen flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-t-blue-500 border-slate-700 rounded-full animate-spin"></div>
        <div className="text-center animate-pulse">
          <h1 className="text-white font-black text-xl tracking-[0.3em] uppercase">Iniciando Servicios APC...</h1>
          <p className="text-slate-500 text-xs mt-2 font-bold tracking-widest uppercase">Estableciendo conexión con Realtime Database</p>
        </div>
      </div>
    );
  }

  const exportMasterCSV = () => {
    const headers = ["ID ODT", "Cliente", "Marca", "Producto", "Fecha Creación", "Fecha Entrega", "Monto", "Facturado", "Pagado", "Días en Sistema"];
    const rows = projects.map(p => {
      const created = new Date(p.createdAt);
      const finished = p.fecha_finalizado ? new Date(p.fecha_finalizado) : new Date();
      const daysInSystem = Math.floor((finished.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      
      return [
        p.id,
        p.empresa,
        p.marca,
        p.producto,
        created.toLocaleDateString(),
        p.fecha_finalizado ? new Date(p.fecha_finalizado).toLocaleDateString() : "Pte",
        p.monto_proyectado,
        p.facturado ? "SÍ" : "NO",
        p.pagado ? "SÍ" : "NO",
        daysInSystem
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `APC_Master_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMyInbox = () => {
    const isGlobalLead = user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider;
    const myProjects = projects?.filter(p => {
      if (isGlobalLead) return true;
      const isDirectlyAssigned = p.asignaciones?.some(a => a.usuarioId === user?.id);
      const isAreaLead = user?.role === UserRole.Lider_Operativo;
      if (isAreaLead) {
        const stages = getRoadmapStages(p);
        const currentStage = stages[p.current_stage_index || 0];
        return currentStage === user?.department || isDirectlyAssigned;
      }
      return isDirectlyAssigned;
    }) || [];
    
    return (
      <div className="space-y-6">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black">Bandeja Operativa</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              {isGlobalLead ? 'VISTA GLOBAL DE CARTERA APC' : 'Tareas técnicas asignadas directamente'}
            </p>
          </div>
        </header>
        <div className="bg-white p-6 rounded-xl border-2 border-dashed border-slate-200">
           {myProjects.length === 0 ? (
             <p className="text-slate-400 italic text-center py-10">No tiene tareas asignadas en este momento.</p>
           ) : (
             <ProjectTable projects={myProjects} onView={(p: Project) => setSelectedProjectId(p.id)} checkSLA={checkSLA} users={users} />
           )}
        </div>
      </div>
    );
  };

  const renderQABox = () => {
    const qaProjects = projects?.filter(p => {
      // Detección robusta de etapa QA por texto (snake y camel case)
      const currentE = (p.etapa_actual || (p as any).etapaActual || '').toUpperCase();
      const inQAStage = currentE.includes('REVISIÓN QA') || p.status === 'QA';
      
      if (!inQAStage) return false;

      // Líder de QA y Admin: Ven TODO lo que está en etapa de QA
      if (user?.role === UserRole.Correccion || user?.role === UserRole.Admin) return true;

      // QA Operativo: Solo ve lo que tiene asignado expresamente bajo el área 'QA'
      if (user?.role === UserRole.QA_Opera) {
        return p.asignaciones?.some(a => a.usuarioId === user?.id && a.area === 'QA');
      }

      return false;
    }) || [];

    return (
      <div className="space-y-6 animate-fadeIn">
        <header>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Caja de QA</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 italic">
            {user?.role === UserRole.Correccion || user?.role === UserRole.Admin ? 'Supervisión Global de Calidad (Todas las Revisiones)' : 'Tareas de Revisión Delegadas a su Perfil'}
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
               onView={(p: Project) => setSelectedProjectId(p.id)} 
               checkSLA={checkSLA} 
               users={users}
               highlightUnassigned={user?.role === UserRole.Correccion || user?.role === UserRole.Admin} 
             />
           )}
        </div>
      </div>
    );
  };

  const renderFinances = () => {
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
                       <button onClick={() => setSelectedProjectId(p.id)} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
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

  const renderView = (view: ViewState) => {
    if (selectedProject) return <ProjectDetail project={selectedProject} onBack={() => setSelectedProjectId(null)} />;
    switch (view) {
      case 'dashboard': return <AdminDashboard />;
      case 'leader-dashboard': return <LeaderDashboard />;
      case 'my-projects': return renderMyInbox();
      case 'clients': return <ClientsView onViewProject={setSelectedProjectId} />;
      case 'qa-box': return renderQABox();
      case 'finances': return renderFinances();
      case 'users': return <UsersView />;
      default: return <AdminDashboard />;
    }
  };

  return <AppRouter renderView={renderView} />;
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ODTProvider>
      <AppContent />
    </ODTProvider>
  </ErrorBoundary>
);

export default App;
