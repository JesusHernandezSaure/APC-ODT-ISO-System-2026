
import React, { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { UserRole, ViewState, User } from './types';
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

  const canAccessAdminDashboard = (u: User | null) => {
    if (!u) return false;
    const allowedRoles = [
      UserRole.Admin, 
      UserRole.Cuentas_Lider, 
      UserRole.Finanzas, 
      UserRole.Administracion_Lider, 
      UserRole.Administracion_Opera
    ];
    const allowedDepts = ['Administración', 'Finanzas'];
    return allowedRoles.includes(u.role) || allowedDepts.includes(u.department);
  };

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
    const [filterStatus, setFilterStatus] = useState('Todas');
    const [filterCategory, setFilterCategory] = useState('Todas');
    const [filterSubCategory, setFilterSubCategory] = useState('Todas');
    const [filterResponsible, setFilterResponsible] = useState('Todas');

    const { user, projects, users, checkSLA } = useODT();
    const isGlobalLead = user?.role === UserRole.Admin;

    const isLeader = user && [
      UserRole.Cuentas_Lider,
      UserRole.Lider_Operativo,
      UserRole.Correccion,
      UserRole.Medico_Lider,
      UserRole.Administracion_Lider,
      UserRole.Admin
    ].includes(user.role);

    const categories = useMemo(() => ['Todas', ...new Set(projects.map(p => p.category).filter(Boolean))], [projects]);
    const subCategories = useMemo(() => ['Todas', ...new Set(projects.map(p => p.subCategory).filter(Boolean))], [projects]);
    const assignableUsers = useMemo(() => ['Todas', ...new Set(users.map(u => u.name))], [users]);

    const myProjects = useMemo(() => {
      let result = projects?.filter(p => {
        const userRole = user?.role as UserRole;
        const userId = user?.id;
        const userDept = normalizeString(user?.department || '');
        const projectStage = normalizeString(p.etapa_actual || '');

        // 1. Admin sees everything
        if (userRole === UserRole.Admin) return true;

        // Define Leader roles
        const isLeaderRole = [
          UserRole.Cuentas_Lider,
          UserRole.Lider_Operativo,
          UserRole.Correccion,
          UserRole.Medico_Lider,
          UserRole.Administracion_Lider
        ].includes(userRole);

        // 2. RBAC Logic: Leaders vs Operatives
        if (isLeaderRole) {
          if (userDept === 'cuentas') {
            const isAssigned = p.asignaciones?.some(a => a.usuarioId === userId);
            const isOwner = p.assignedExecutives?.includes(userId || '');
            const isMyTurn = projectStage.includes('cuentas');
            if (!(isAssigned || isOwner || isMyTurn)) return false;
          } else if (userDept === 'qa') {
            const inQA = projectStage.includes('qa') || p.status === 'QA';
            if (!inQA) return false;
          } else {
            const isMyTurn = projectStage === userDept;
            const isCorrections = p.status === 'Correcciones' && projectStage === userDept;
            if (!isMyTurn && !isCorrections) return false;
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
          if (!isInMyTurn) return false;
          const isAssigned = p.asignaciones?.some(a => 
            a.usuarioId === userId && normalizeString(a.area) === userDept
          );
          const isOwner = userDept === 'cuentas' && p.assignedExecutives?.includes(userId || '');
          if (!isAssigned && !isOwner) return false;
        }
        return true;
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
          return p.asignaciones?.some(a => a.usuarioId === assignedUser?.id) || 
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

      // Apply Default Sorting (fechaEntrega earliest/overdue first)
      return result.sort((a, b) => {
        const dateA = a.fecha_entrega ? new Date(a.fecha_entrega).getTime() : Infinity;
        const dateB = b.fecha_entrega ? new Date(b.fecha_entrega).getTime() : Infinity;
        return dateA - dateB;
      });
    }, [projects, user, searchTerm, filterStatus, filterCategory, filterSubCategory, filterResponsible, users]);
    
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

        {/* Filter Bar */}
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
    const assignableUsers = useMemo(() => ['Todas', ...new Set(users.map(u => u.name))], [users]);

    const qaProjects = useMemo(() => {
      let result = projects?.filter(p => {
        const currentE = (p.etapa_actual || p.etapaActual || '').toUpperCase();
        const inQAStage = currentE.includes('REVISIÓN QA') || p.status === 'QA';
        
        if (!inQAStage) return false;

        const userRole = user?.role as UserRole;
        const userId = user?.id;

        // Admin, QA Leader, Medical Leader and Accounts Leader see all pending QA
        if (userRole === UserRole.Correccion || userRole === UserRole.Admin || userRole === UserRole.Medico_Lider || userRole === UserRole.Cuentas_Lider) return true;

        // Cuentas Operatives see only ODTs they own or are assigned to
        if (userRole === UserRole.Cuentas_Opera) {
          const isAssigned = p.asignaciones?.some(a => a.usuarioId === userId);
          const isOwner = p.assignedExecutives?.includes(userId || '');
          return isAssigned || isOwner;
        }

        // QA Operatives and Medical Operatives see only assigned tasks in QA area
        if (userRole === UserRole.QA_Opera || userRole === UserRole.Medico_Opera) {
          return p.asignaciones?.some(a => a.usuarioId === userId && normalizeString(a.area) === 'qa');
        }

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
          return p.asignaciones?.some(a => a.usuarioId === assignedUser?.id) || 
                 p.assignedExecutives?.includes(assignedUser?.id || '');
        });
      }

      // Apply Default Sorting (fechaEntrega earliest/overdue first)
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

        {/* Filter Bar */}
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
      case 'dashboard': 
        if (canAccessAdminDashboard(user)) return <AdminDashboard />;
        return <Navigate to="/my-projects" replace />;
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
