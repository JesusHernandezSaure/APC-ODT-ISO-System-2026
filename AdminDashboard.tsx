import React, { useState, useMemo, useEffect } from 'react';
import { useODT } from './ODTContext';
import { Project, UserRole } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AdminDashboard: React.FC = () => {
  const { projects, users } = useODT();
  const [executiveFilter, setExecutiveFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const executives = useMemo(() => 
    (users || []).filter(u => u?.role === UserRole.Cuentas_Opera || u?.role === UserRole.Cuentas_Lider), 
  [users]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    let filtered = [...projects];
    if (executiveFilter !== 'all') filtered = filtered.filter(p => p?.ownerId === executiveFilter);
    const now = new Date();
    if (periodFilter === 'this-month') {
      filtered = filtered.filter(p => {
        const pDate = new Date(p?.createdAt);
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      });
    }
    return filtered;
  }, [projects, executiveFilter, periodFilter]);

  if (!projects || !users) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const saturationData = useMemo(() => {
    const counts: Record<string, number> = { 'Creativo': 0, 'Diseño': 0, 'Cuentas': 0, 'QA': 0, 'Finanzas': 0 };
    filteredProjects?.forEach(p => {
      if (p?.status !== 'Finalizado' && p?.status !== 'Cancelado') {
        p?.areas_seleccionadas?.forEach(area => {
          if (counts[area] !== undefined) counts[area]++;
        });
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredProjects]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panel Administrativo</h1>
          <p className="text-slate-500 font-medium text-sm italic">Métricas de Cumplimiento ISO 9001</p>
        </div>
        <div className="flex gap-3">
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
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#3b82f6" />
              </BarChart>
           </ResponsiveContainer>
        </div>
        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl flex flex-col justify-center">
           <h3 className="text-blue-400 text-xs font-black uppercase tracking-widest mb-4">Monto Proyectado</h3>
           <p className="text-5xl font-black">${filteredProjects?.reduce((a, b) => a + (b?.monto_proyectado || 0), 0).toLocaleString()}</p>
           <p className="text-xs text-slate-400 mt-4 uppercase font-bold tracking-widest">{filteredProjects?.length} Órdenes Activas</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;