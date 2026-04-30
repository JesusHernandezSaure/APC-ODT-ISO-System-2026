
import React, { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { UserRole, ViewState, User, Project, ProjectComment, ProjectAssignment } from './types';
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
import AgencyHubView from './AgencyHubView';
import AgencyHubODTDetail from './AgencyHubODTDetail';
import { db } from './firebase';
import { ProjectTable } from './ProjectTable';
import { normalizeString, GLOBAL_STAGES } from './workflowConfig';

import ErrorBoundary from './ErrorBoundary';

import { CalendarView } from './CalendarView';
import { useCallback } from 'react';

const exportMasterCSV = (projects: Project[], users: User[]) => {
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

    const qaRejections = p.comentarios?.filter((c: ProjectComment) => c.isSystemEvent && c.text.includes("RECHAZADO en [REVISIÓN QA")).length || 0;
    const clientRejections = p.client_rejection_count || 0;
    
    const approvers = p.comentarios?.filter((c: ProjectComment) => c.isSystemEvent && c.text.includes("APROBADO"))
      .map((c: ProjectComment) => `${c.authorName} (${c.text.split(' ')[0]})`)
      .join(" | ") || "N/A";

    const assignments = p.asignaciones?.map((a: ProjectAssignment) => {
      const assignedUsers = users.filter((u: User) => a.usuarioIds?.includes(u.id) || a.usuarioId === u.id);
      const names = assignedUsers.map(u => u.name).join(", ");
      return `${a.area}: ${names || 'Pte'}`;
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

const AppContent: React.FC = () => {
  const { projects, deletedProjects, user, users, isInitialLoad } = useODT();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  const canAccessAdminDashboard = (u: User | null) => {
    if (!u) return false;
    const hasRole = (r: UserRole) => u.role === r || (u.roles && u.roles.includes(r));
    const allowedRoles = [
      UserRole.Admin, 
      UserRole.Cuentas_Lider, 
      UserRole.Finanzas, 
      UserRole.Administracion_Lider, 
      UserRole.Administracion_Opera
    ];
    const allowedDepts = ['Administración', 'Finanzas'];
    return allowedRoles.some(r => hasRole(r)) || allowedDepts.includes(u.department);
  };

  if (!db || isInitialLoad) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-apc-green relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-full bg-striped-green opacity-5"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-apc-pink/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-apc-light-teal/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="apc-pill w-24 h-24 flex items-center justify-center mb-8 animate-pulse">
            <div className="apc-pill-inner"></div>
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

  const handleExport = () => exportMasterCSV(projects, users);

  const renderView = (view: ViewState | string, params?: { id?: string }) => {
    const onViewProject = (id: string) => {
      navigate(`/project/${encodeURIComponent(id)}`);
    };

    if (view === 'project-detail') {
      const id = params?.id || selectedProjectId;
      if (!id) return <div className="p-20 text-center font-black uppercase text-slate-400">ID de ODT no proporcionado</div>;
      
      const project = projects.find(p => (p.id || '').trim().toUpperCase() === id.trim().toUpperCase());
      if (project) return <ProjectDetail project={project} onBack={() => navigate(-1)} />;
      
      // Also check in deleted projects if user is Admin
      if (user?.role === UserRole.Admin) {
        const deletedProject = deletedProjects.find(p => (p.id || '').trim().toUpperCase() === id.trim().toUpperCase());
        if (deletedProject) return <ProjectDetail project={deletedProject} onBack={() => navigate(-1)} />;
      }
      
      return <div className="p-20 text-center font-black uppercase text-slate-400">Proyecto no encontrado</div>;
    }

    switch (view) {
      case 'agency-hub': return <AgencyHubView />;
      case 'agency-hub-odt-detail': return <AgencyHubODTDetail />;
      case 'dashboard': 
        if (canAccessAdminDashboard(user)) return <AdminDashboard />;
        return <Navigate to={user?.role === UserRole.Cliente ? "/agency-hub" : "/my-projects"} replace />;
      case 'leader-dashboard': return <LeaderDashboard onViewProject={onViewProject} />;
      case 'my-projects': return <MyInbox onViewProject={onViewProject} />;
      case 'clients': return <ClientsView onViewProject={onViewProject} />;
      case 'qa-box': return <QABox onViewProject={onViewProject} />;
      case 'finances': return <Finances onViewProject={onViewProject} onExport={handleExport} />;
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

const Finances: React.FC<{ onViewProject: (id: string) => void, onExport: () => void }> = ({ onViewProject, onExport }) => {
  const { projects, clients, updateBilling, updatePaymentStatus, updateClient } = useODT();
  const [activeTab, setActiveTab] = useState<'igualas' | 'extra' | 'rentabilidad'>('igualas');
  const [searchTerm, setSearchTerm] = useState('');
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>((now.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(now.getFullYear().toString());

  const months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
  ];

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const availableYears = new Set([currentYear.toString()]);
    projects.forEach(p => {
      if (p.createdAt) {
        availableYears.add(new Date(p.createdAt).getFullYear().toString());
      }
    });
    return Array.from(availableYears).sort((a, b) => b.localeCompare(a));
  }, [projects]);

  const normalizedSearch = searchTerm.toLowerCase().trim();

  // Helper for date filtering
  const isInSelectedPeriod = useCallback((dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const m = (date.getMonth() + 1).toString();
    const y = date.getFullYear().toString();
    return m === selectedMonth && y === selectedYear;
  }, [selectedMonth, selectedYear]);

  // Tab 1: Igualas del Mes
  const filteredIgualas = useMemo(() => {
    return (clients || []).filter(c => (c.montoIgualaMensual || 0) > 0).filter(c => {
      if (!normalizedSearch) return true;
      return [c.name, c.montoIgualaMensual?.toString()].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
    });
  }, [clients, normalizedSearch]);

  // Tab 2: Proyectos Extra
  const filteredExtra = useMemo(() => {
    return (projects || []).filter(p => {
      const isExtra = p.tipoCargo === 'extra' || (p.monto_proyectado || 0) > 0;
      const isInBilling = p.etapa_actual === GLOBAL_STAGES.BILLING;
      const isNotStandby = !p.enStandby;
      const matchPeriod = isInSelectedPeriod(p.createdAt);

      return isExtra && isInBilling && isNotStandby && matchPeriod;
    }).filter(p => {
      if (!normalizedSearch) return true;
      return [
        p.id, p.empresa, p.marca, p.producto, p.category, p.subCategory, p.monto_proyectado?.toString()
      ].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
    });
  }, [projects, normalizedSearch, isInSelectedPeriod]);

  // Tab 3: Rentabilidad
  const profitabilityData = useMemo(() => {
    if (!clients) return [];
    
    // Filter projects for the selected period that are Iguala, Internal, or old ones without tipoCargo but with monto 0
    const periodProjects = projects.filter(p => {
      const isRelevant = p.tipoCargo === 'iguala' || p.tipoCargo === 'interno' || (p.monto_proyectado === 0 && !p.tipoCargo);
      return isRelevant && isInSelectedPeriod(p.createdAt);
    });

    const periodExtras = projects.filter(p => p.tipoCargo === 'extra' && isInSelectedPeriod(p.createdAt));

    return clients
      .map(client => {
        const clientProjects = periodProjects.filter(p => p.clientId === client.id);
        const totalValorTeorico = clientProjects.reduce((acc, p) => acc + (p.monto_valor_teorico || 0), 0);
        const totalFacturadoExtra = periodExtras.filter(p => p.clientId === client.id).reduce((acc, p) => acc + (p.monto_proyectado || 0), 0);
        
        return {
          ...client,
          totalValorTeorico,
          totalFacturadoExtra,
        };
      })
      .filter(c => (c.montoIgualaMensual || 0) > 0 || c.totalValorTeorico > 0)
      .filter(c => {
        if (!normalizedSearch) return true;
        return [c.name].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch);
      });
  }, [clients, projects, normalizedSearch, isInSelectedPeriod]);

  const noResults = (activeTab === 'igualas' && filteredIgualas.length === 0) ||
                    (activeTab === 'extra' && filteredExtra.length === 0) ||
                    (activeTab === 'rentabilidad' && profitabilityData.length === 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Módulo de Facturación</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Control de Tesorería - APC Realtime</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onExport}
            className="px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl"
          >
            <Icons.Dashboard /> EXPORTAR CSV
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-apc-pink transition-colors">
            <Icons.Search className="w-5 h-5" />
          </div>
          <input 
            type="text"
            placeholder="🔍 Buscar por ODT, Marca, Material, Campaña o Monto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-600 focus:border-apc-pink focus:ring-4 focus:ring-apc-pink/5 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-apc-pink transition-all"
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-apc-pink transition-all"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex border-b border-slate-100">
        {[
          { id: 'igualas', label: 'Igualas del Mes' },
          { id: 'extra', label: 'Proyectos Extra' },
          { id: 'rentabilidad', label: 'Rentabilidad (Auditoría)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'igualas' | 'extra' | 'rentabilidad')}
            className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
              activeTab === tab.id ? 'text-apc-pink' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-apc-pink animate-slideIn"></div>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
        {noResults ? (
           <div className="p-20 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Icons.Search />
              </div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No se encontraron registros que coincidan con su búsqueda</p>
           </div>
        ) : (
          <table className="w-full text-sm text-left">
            {activeTab === 'igualas' && (
              <>
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-5">Cliente</th>
                    <th className="px-6 py-5">Monto Iguala</th>
                    <th className="px-6 py-5 text-center">Facturado</th>
                    <th className="px-6 py-5 text-center">Pagado</th>
                    <th className="px-6 py-5 text-right">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredIgualas.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-6 py-4 font-black text-slate-800 uppercase">{c.name}</td>
                      <td className="px-6 py-4 font-black text-slate-900">${c.montoIgualaMensual?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={c.igualaFacturada}
                          onChange={e => updateClient(c.id, { igualaFacturada: e.target.checked })}
                          className="w-6 h-6 accent-blue-600 cursor-pointer rounded-lg" 
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={c.igualaPagada}
                          onChange={e => updateClient(c.id, { igualaPagada: e.target.checked })}
                          className="w-6 h-6 accent-emerald-600 cursor-pointer rounded-lg" 
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                           c.igualaPagada ? 'bg-emerald-100 text-emerald-700' : 
                           c.igualaFacturada ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                         }`}>
                           {c.igualaPagada ? 'PAGADO' : c.igualaFacturada ? 'FACTURADO' : 'PENDIENTE'}
                         </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === 'extra' && (
              <>
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-5">ODT / Marca</th>
                    <th className="px-6 py-5">Producto / Material</th>
                    <th className="px-6 py-5">Monto Extra</th>
                    <th className="px-6 py-5 text-center">Fact.</th>
                    <th className="px-6 py-5 text-center">Pag.</th>
                    <th className="px-6 py-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExtra.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-6 py-4">
                        <div className="font-mono font-black text-blue-600 text-xs">{p.id}</div>
                        <div className="text-[10px] text-slate-800 font-black uppercase">{p.marca}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-800 uppercase text-xs truncate max-w-[200px]">{p.producto}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{p.subCategory} ({p.category})</div>
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
                      <td className="px-6 py-4 text-right">
                         <button onClick={() => onViewProject(p.id)} className="p-2 hover:bg-slate-200 rounded-xl transition-all">
                            <Icons.ChevronRight className="w-4 h-4" />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === 'rentabilidad' && (
              <>
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-5">Cliente</th>
                    <th className="px-6 py-5">Iguala Mensual</th>
                    <th className="px-6 py-5">Valor Teórico (Operativo)</th>
                    <th className="px-6 py-5">Facturado Extra</th>
                    <th className="px-6 py-5 text-right">Estado de Rentabilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {profitabilityData.map(c => {
                    const efficiency = c.montoIgualaMensual ? (c.totalValorTeorico / c.montoIgualaMensual) : 0;
                    const isHighRisk = efficiency > 1.2; // Over 120% of equal value
                    const isLowProfit = efficiency > 0.8 && efficiency <= 1.2;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-6 py-4 font-black text-slate-800 uppercase">{c.name}</td>
                        <td className="px-6 py-4 font-black text-slate-900">${c.montoIgualaMensual?.toLocaleString()}</td>
                        <td className="px-6 py-4 font-black text-slate-600">${c.totalValorTeorico.toLocaleString()}</td>
                        <td className="px-6 py-4 font-black text-blue-600">${c.totalFacturadoExtra.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex flex-col items-end">
                             <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                               isHighRisk ? 'bg-rose-100 text-rose-700' : 
                               isLowProfit ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                             }`}>
                               {isHighRisk ? 'RIESGO: SOBRE-ESFUERZO' : isLowProfit ? 'MARGEN ACEPTABLE' : 'ALTA RENTABILIDAD'}
                             </span>
                             <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Indice: {(efficiency * 100).toFixed(1)}%</span>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}
          </table>
        )}
      </div>
    </div>
  );
};

const MyInbox: React.FC<{ onViewProject: (id: string) => void }> = ({ onViewProject }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todas');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterSubCategory, setFilterSubCategory] = useState('Todas');
  const [filterResponsible, setFilterResponsible] = useState('Todas');
  const [activeTab, setActiveTab] = useState<'tasks' | 'standby'>('tasks');

  const { user, projects, users, checkSLA } = useODT();
  const isGlobalLead = user?.role === UserRole.Admin;

  const isLeader = useMemo(() => {
    if (!user) return false;
    const hasRole = (r: UserRole) => user.role === r || (user.roles && user.roles.includes(r));
    const leaderRoles = [
      UserRole.Cuentas_Lider,
      UserRole.Lider_Operativo,
      UserRole.Correccion,
      UserRole.Medico_Lider,
      UserRole.Administracion_Lider,
      UserRole.Admin
    ];
    return leaderRoles.some(r => hasRole(r));
  }, [user]);

  const categories = useMemo(() => ['Todas', ...new Set(projects.map(p => p.category).filter(Boolean))], [projects]);
  const subCategories = useMemo(() => ['Todas', ...new Set(projects.map(p => p.subCategory).filter(Boolean))], [projects]);
  const assignableUsers = useMemo(() => {
    const filtered = users.filter(u => {
      const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));
      return !hasRole(u, UserRole.Admin);
    });
    return ['Todas', ...new Set(filtered.map(u => u.name))];
  }, [users]);

  const myProjects = useMemo(() => {
    const search = normalizeString(searchTerm);
    const userRole = user?.role as UserRole;
    const isCuentasOrAdmin = user?.department === 'Cuentas' || userRole === UserRole.Cuentas_Lider || userRole === UserRole.Cuentas_Opera || userRole === UserRole.Admin;
    
    let result = projects?.filter(p => {
      const userId = user?.id;
      const userDept = normalizeString(user?.department || '');
      const projectStage = normalizeString(p.etapa_actual || '');

      const isStandby = p.enStandby || p.status === 'En revisión con cliente' || projectStage.includes('en revision con cliente');

      // REGLA: Excluir de bandejas operativas normales si no es Cuentas/Admin
        if (!isCuentasOrAdmin && isStandby) return false;

        // REGLA: Filtrar por pestaña para Cuentas/Admin
        if (isCuentasOrAdmin) {
          if (activeTab === 'tasks' && isStandby) return false;
          if (activeTab === 'standby' && !isStandby) return false;
        }

        const isIdSearch = search && normalizeString(p.id).includes(search);
        
        // 1. Admin sees everything
        if (userRole === UserRole.Admin) return true;

        const isLeaderRole = [
          UserRole.Cuentas_Lider,
          UserRole.Lider_Operativo,
          UserRole.Correccion,
          UserRole.Medico_Lider,
          UserRole.Administracion_Lider
        ].includes(userRole);

        // 2. RBAC Logic: Leaders vs Operatives
        let passesRBAC = false;
        if (isLeaderRole) {
          if (userDept === 'cuentas') {
            const isAssigned = p.asignaciones?.some(a => a.usuarioIds?.includes(userId || '') || a.usuarioId === userId);
            const isOwner = p.assignedExecutives?.includes(userId || '');
            const isMyTurn = projectStage.includes('cuentas');
            if (isAssigned || isOwner || isMyTurn) passesRBAC = true;
          } else if (userDept === 'qa') {
            const inQA = projectStage.includes('qa') || p.status === 'QA';
            if (inQA) passesRBAC = true;
          } else {
            const isMyTurn = projectStage === userDept;
            const isCorrections = p.status === 'Correcciones' && projectStage === userDept;
            if (isMyTurn || isCorrections) passesRBAC = true;
          }
        } else {
          let isInMyTurn = false;
          if (userDept === 'cuentas') {
            isInMyTurn = projectStage.includes('cuentas');
          } else if (userDept === 'qa') {
            isInMyTurn = projectStage.includes('qa') || p.status === 'QA';
          } else {
            isInMyTurn = projectStage === userDept || (p.status === 'Correcciones' && projectStage === userDept);
          }
          
          const isAssigned = p.asignaciones?.some(a => 
            (a.usuarioIds?.includes(userId || '') || a.usuarioId === userId) && normalizeString(a.area) === userDept
          );
          const isOwner = userDept === 'cuentas' && p.assignedExecutives?.includes(userId || '');
          
          if (isInMyTurn && (isAssigned || isOwner)) passesRBAC = true;
        }

        if (passesRBAC) return true;
        if (isIdSearch) return true;

        return false;
      }) || [];

      // Apply Filters
      if (filterStatus !== 'Todas') {
        if (filterStatus === 'Vencidas') {
          result = result.filter(p => p.fecha_entrega && new Date(p.fecha_entrega) < new Date());
        } else if (filterStatus === 'En Corrección') {
          result = result.filter(p => p.status === 'Correcciones');
        } else if (filterStatus === 'Reincidentes') {
          result = result.filter(p => (p.contadorCorrecciones || 0) >= 2);
        }
      }

      if (filterCategory !== 'Todas') {
        result = result.filter(p => p.category === filterCategory);
      }

      if (filterSubCategory !== 'Todas') {
        result = result.filter(p => p.subCategory === filterSubCategory);
      }

      if (filterResponsible !== 'Todas') {
        result = result.filter(p => {
          const assignedUser = users.find(u => u.name === filterResponsible);
          return p.asignaciones?.some(a => a.usuarioIds?.includes(assignedUser?.id || '') || a.usuarioId === assignedUser?.id) || 
                 p.assignedExecutives?.includes(assignedUser?.id || '');
        });
      }

      // Apply Search
      if (searchTerm) {
        const search = normalizeString(searchTerm);
        result = result.filter(p => 
          normalizeString(p.id).includes(search) ||
          normalizeString(p.empresa).includes(search) ||
          normalizeString(p.marca).includes(search) ||
          normalizeString(p.producto).includes(search) ||
          normalizeString(p.status).includes(search)
        );
      }

      return result.sort((a, b) => {
        const dateA = a.fecha_entrega ? new Date(a.fecha_entrega).getTime() : Infinity;
        const dateB = b.fecha_entrega ? new Date(b.fecha_entrega).getTime() : Infinity;
        return dateA - dateB;
      });
    }, [projects, user, searchTerm, filterStatus, filterCategory, filterSubCategory, filterResponsible, users, activeTab]);
    
    return (
      <div className="space-y-6 max-h-[calc(100vh-100px)] overflow-y-auto pr-2 custom-scrollbar relative">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sticky top-0 bg-white z-20 py-4 border-b border-slate-100 -mx-2 px-2">
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

        {(user?.department === 'Cuentas' || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera || user?.role === UserRole.Admin) && (
          <div className="flex border-b border-slate-100 -mx-2 px-2 sticky top-[80px] bg-white z-10 pt-2">
            <button 
              onClick={() => setActiveTab('tasks')}
              className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'tasks' ? 'border-apc-pink text-apc-pink' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Mis Tareas
            </button>
            <button 
              onClick={() => setActiveTab('standby')}
              className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === 'standby' ? 'border-apc-purple text-apc-purple' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Esperando Cliente / Standby
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado/Prioridad</label>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
            >
              <option value="Todas">Todas</option>
              <option value="Vencidas">Vencidas</option>
              <option value="En Corrección">En Corrección</option>
              <option value="Reincidentes">Reincidentes</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Subcategoría</label>
            <select 
              value={filterSubCategory} 
              onChange={(e) => setFilterSubCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
            >
              {subCategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {isLeader && (
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Responsable</label>
              <select 
                value={filterResponsible} 
                onChange={(e) => setFilterResponsible(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
              >
                {assignableUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border-2 border-dashed border-slate-200">
           {myProjects.length === 0 ? (
             <p className="text-slate-400 italic text-center py-10">
               {searchTerm || filterStatus !== 'Todas' || filterCategory !== 'Todas' || filterSubCategory !== 'Todas' || filterResponsible !== 'Todas' 
                 ? 'No se encontraron resultados para los filtros aplicados.' 
                 : 'No tiene tareas asignadas en este momento.'}
             </p>
           ) : (
             <ProjectTable projects={myProjects} onView={onViewProject} checkSLA={checkSLA} users={users} />
           )}
        </div>
      </div>
    );
};

const QABox: React.FC<{ onViewProject: (id: string) => void }> = ({ onViewProject }) => {
  const [filterStatus, setFilterStatus] = useState('Todas');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterSubCategory, setFilterSubCategory] = useState('Todas');
  const [filterResponsible, setFilterResponsible] = useState('Todas');

  const { user, projects, users, checkSLA } = useODT();

  const categories = useMemo(() => ['Todas', ...new Set(projects.map(p => p.category).filter(Boolean))], [projects]);
  const subCategories = useMemo(() => ['Todas', ...new Set(projects.map(p => p.subCategory).filter(Boolean))], [projects]);
  const assignableUsers = useMemo(() => {
    const filtered = users.filter(u => {
      const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));
      return !hasRole(u, UserRole.Admin);
    });
    return ['Todas', ...new Set(filtered.map(u => u.name))];
  }, [users]);

  const qaProjects = useMemo(() => {
    let result = projects?.filter(p => {
      const currentE = (p.etapa_actual || p.etapaActual || '').toUpperCase();
      const inQAStage = currentE.includes('REVISIÓN QA') || p.status === 'QA';
      
      const isStandby = p.enStandby || p.status === 'En revisión con cliente' || currentE.includes('EN REVISIÓN CON CLIENTE');
      if (isStandby) return false;

      if (!inQAStage) return false;

      const userRole = user?.role as UserRole;
      const userId = user?.id;

      if (userRole === UserRole.Correccion || userRole === UserRole.Admin || userRole === UserRole.Medico_Lider || userRole === UserRole.Cuentas_Lider) return true;

      if (userRole === UserRole.Cuentas_Opera) {
        const isAssigned = p.asignaciones?.some(a => a.usuarioIds?.includes(userId || '') || a.usuarioId === userId);
        const isOwner = p.assignedExecutives?.includes(userId || '');
        return isAssigned || isOwner;
      }

      if (userRole === UserRole.QA_Opera || userRole === UserRole.Medico_Opera) {
        return p.asignaciones?.some(a => (a.usuarioIds?.includes(userId || '') || a.usuarioId === userId) && normalizeString(a.area) === 'qa');
      }

      return false;
    }) || [];

    if (filterStatus !== 'Todas') {
      if (filterStatus === 'Vencidas') {
        result = result.filter(p => p.fecha_entrega && new Date(p.fecha_entrega) < new Date());
      } else if (filterStatus === 'En Corrección') {
        result = result.filter(p => p.status === 'Correcciones');
      } else if (filterStatus === 'Reincidentes') {
        result = result.filter(p => (p.contadorCorrecciones || 0) >= 2);
      }
    }

    if (filterCategory !== 'Todas') {
      result = result.filter(p => p.category === filterCategory);
    }

    if (filterSubCategory !== 'Todas') {
      result = result.filter(p => p.subCategory === filterSubCategory);
    }

    if (filterResponsible !== 'Todas') {
      result = result.filter(p => {
        const assignedUser = users.find(u => u.name === filterResponsible);
        return p.asignaciones?.some(a => a.usuarioIds?.includes(assignedUser?.id || '') || a.usuarioId === assignedUser?.id) || 
               p.assignedExecutives?.includes(assignedUser?.id || '');
      });
    }

    return result.sort((a, b) => {
      const dateA = a.fecha_entrega ? new Date(a.fecha_entrega).getTime() : Infinity;
      const dateB = b.fecha_entrega ? new Date(b.fecha_entrega).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [projects, user, filterStatus, filterCategory, filterSubCategory, filterResponsible, users]);

  const isGlobalQA = user?.role === UserRole.Correccion || user?.role === UserRole.Admin || user?.role === UserRole.Medico_Lider;

  return (
    <div className="space-y-6 animate-fadeIn max-h-[calc(100vh-100px)] overflow-y-auto pr-2 custom-scrollbar relative">
      <header className="sticky top-0 bg-white z-20 py-4 border-b border-slate-100 -mx-2 px-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Caja de QA</h1>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 italic">
          {isGlobalQA ? 'Supervisión Global de Calidad (Todas las Revisiones)' : 'Tareas de Revisión Delegadas a su Perfil'}
        </p>
      </header>

      <div className="flex flex-wrap gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado/Prioridad</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
          >
            <option value="Todas">Todas</option>
            <option value="Vencidas">Vencidas</option>
            <option value="En Corrección">En Corrección</option>
            <option value="Reincidentes">Reincidentes</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Subcategoría</label>
          <select 
            value={filterSubCategory} 
            onChange={(e) => setFilterSubCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
          >
            {subCategories.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Responsable</label>
          <select 
            value={filterResponsible} 
            onChange={(e) => setFilterResponsible(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-apc-pink transition-all"
          >
            {assignableUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
         {qaProjects.length === 0 ? (
           <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                 <Icons.Ai />
              </div>
              <p className="text-slate-400 italic font-medium">No se encontraron revisiones con los filtros aplicados.</p>
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
