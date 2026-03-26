import React, { useState, useMemo } from 'react';
import { useODT } from './ODTContext';
import { UserRole } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import * as Constants from './constants';

const AdminDashboard: React.FC = () => {
  const { Icons } = Constants;
  const { projects, users } = useODT();
  const [executiveFilter, setExecutiveFilter] = useState('all');
  const [periodFilter] = useState('all');

  const executives = useMemo(() => 
    (users || []).filter(u => u?.role === UserRole.Cuentas_Opera || u?.role === UserRole.Cuentas_Lider), 
  [users]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    let filtered = [...projects];
    if (executiveFilter !== 'all') filtered = filtered.filter(p => p?.assignedExecutives?.includes(executiveFilter));
    const now = new Date();
    if (periodFilter === 'this-month') {
      filtered = filtered.filter(p => {
        const pDate = new Date(p?.createdAt);
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      });
    }
    return filtered;
  }, [projects, executiveFilter, periodFilter]);

  const saturationData = useMemo(() => {
    if (!filteredProjects) return [];
    const counts: Record<string, number> = { 'Creativo': 0, 'Arte': 0, 'Cuentas': 0, 'QA': 0, 'Finanzas': 0 };
    filteredProjects?.forEach(p => {
      if (p?.status !== 'Finalizado' && p?.status !== 'Cancelado') {
        p?.areas_seleccionadas?.forEach(area => {
          if (counts[area] !== undefined) counts[area]++;
        });
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredProjects]);

  const handleExportMasterReport = () => {
    if (!projects || projects.length === 0) return;

    // CSV Headers
    const headers = [
      'ODT ID', 'Cliente', 'Marca', 'Producto', 'Categoría', 'Subcategoría',
      'Status Final', 'Etapa Actual', 'Fecha Creación', 'Fecha Entrega', 'Fecha Finalización',
      'Días Totales', 'Monto Proyectado', 'Costo Promedio/Día',
      'Correcciones Cliente', 'Rechazos Cliente', 'Feedback Final',
      'Áreas Involucradas', 'Responsables', 'Comentarios Totales',
      'Eventos de Auditoría (Trazabilidad)'
    ];

    const rows = projects.map(p => {
      const createdAt = new Date(p.createdAt);
      const finishedAt = p.fecha_finalizado ? new Date(p.fecha_finalizado) : new Date();
      const diffTime = Math.abs(finishedAt.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      
      const avgCostPerDay = (p.monto_proyectado / diffDays).toFixed(2);
      
      const areas = p.areas_seleccionadas?.join(' | ') || 'N/A';
      const responsibles = p.asignaciones?.map(a => {
        const u = users.find(user => user.id === a.usuarioId);
        return `${a.area}: ${u?.name || 'Sin asignar'}`;
      }).join(' | ') || 'N/A';

      const auditTrail = p.comentarios?.map(c => 
        `[${new Date(c.createdAt).toLocaleString()}] ${c.authorName}: ${c.text.replace(/,/g, ';')}`
      ).join(' || ') || 'Sin comentarios';

      return [
        p.id,
        p.empresa,
        p.marca,
        p.producto,
        p.category,
        p.subCategory,
        p.status,
        p.etapa_actual,
        p.createdAt,
        p.fecha_entrega || 'N/A',
        p.fecha_finalizado || 'N/A',
        diffDays,
        p.monto_proyectado,
        avgCostPerDay,
        p.correction_count_after_presentation || 0,
        p.client_rejection_count || 0,
        p.client_feedback || 'N/A',
        areas,
        responsibles,
        p.comentarios?.length || 0,
        auditTrail
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `REPORTE_MAESTRO_APC_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!projects || !users) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apc-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panel Administrativo</h1>
          <p className="text-slate-500 font-medium text-sm italic">Métricas de Cumplimiento ISO 9001</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportMasterReport}
            className="bg-apc-pink text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-apc-pink/80 transition-all shadow-lg shadow-apc-pink/20 flex items-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" /> EXPORTAR REPORTE MAESTRO
          </button>
          <select className="bg-white border rounded-xl px-4 py-2 text-xs font-bold" value={executiveFilter} onChange={(e) => setExecutiveFilter(e.target.value)}>
            <option value="all">TODOS LOS EJECUTIVOS</option>
            {executives.map(e => <option key={e?.id} value={e?.id}>{(e?.name || '').toUpperCase()}</option>)}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-xl min-h-[400px]">
           <ResponsiveContainer width="100%" height="100%">
              <BarChart data={saturationData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <YAxis axisLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {saturationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8CC63F' : '#E63383'} />
                  ))}
                </Bar>
              </BarChart>
           </ResponsiveContainer>
        </div>
        <div className="bg-apc-green p-8 rounded-3xl text-white shadow-2xl flex flex-col justify-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full bg-striped-green opacity-10"></div>
           <h3 className="text-white/60 text-xs font-black uppercase tracking-widest mb-4 relative z-10">Monto Proyectado</h3>
           <p className="text-5xl font-black relative z-10">${filteredProjects?.reduce((a, b) => a + (b?.monto_proyectado || 0), 0).toLocaleString()}</p>
           <p className="text-xs text-white/40 mt-4 uppercase font-bold tracking-widest relative z-10">{filteredProjects?.length} Órdenes Activas</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;