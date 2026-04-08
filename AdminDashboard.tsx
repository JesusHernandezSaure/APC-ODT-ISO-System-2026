import React, { useState, useMemo } from 'react';
import { useODT } from './ODTContext';
import { UserRole } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import * as Constants from './constants';
import { OPERATIVE_AREAS } from './workflowConfig';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { generateMasterReport, downloadMasterCSV, fixOklchForHtml2Canvas } from './reportUtils';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const AdminDashboard: React.FC = () => {
  const { Icons } = Constants;
  const { projects, users, user } = useODT();
  const [executiveFilter, setExecutiveFilter] = useState('all');
  const [periodFilter] = useState('all');
  
  // Commercial Intelligence Filters
  const [filterBrand, setFilterBrand] = useState('Todas');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');

  const executives = useMemo(() => 
    (users || []).filter(u => {
      const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));
      // Exclude Admins even if they have executive roles
      if (hasRole(u, UserRole.Admin)) return false;
      return u?.role === UserRole.Cuentas_Opera || u?.role === UserRole.Cuentas_Lider;
    }), 
  [users]);

  const brands = useMemo(() => {
    if (!projects) return ['Todas'];
    const uniqueBrands = Array.from(new Set(projects.map(p => p?.marca).filter(Boolean)));
    return ['Todas', ...uniqueBrands.sort()];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    let filtered = [...projects];
    
    // Admin Filters
    if (executiveFilter !== 'all') filtered = filtered.filter(p => p?.assignedExecutives?.includes(executiveFilter));
    
    // Commercial Intelligence Filters
    if (filterBrand !== 'Todas') filtered = filtered.filter(p => p.marca === filterBrand);
    
    const now = new Date();
    if (periodFilter === 'this-month') {
      filtered = filtered.filter(p => {
        const pDate = new Date(p?.createdAt);
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      });
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter(p => new Date(p.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      filtered = filtered.filter(p => new Date(p.createdAt) <= to);
    }

    return filtered;
  }, [projects, executiveFilter, periodFilter, filterBrand, dateFrom, dateTo]);

  const saturationData = useMemo(() => {
    if (!filteredProjects) return [];
    const counts: Record<string, number> = {};
    OPERATIVE_AREAS.forEach(area => counts[area] = 0);

    filteredProjects?.forEach(p => {
      if (p?.status !== 'Finalizado' && p?.status !== 'Cancelado') {
        p?.areas_seleccionadas?.forEach(area => {
          if (counts[area] !== undefined) counts[area]++;
        });
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredProjects]);

  const areaDistributionData = useMemo(() => {
    if (!filteredProjects) return [];
    const counts: Record<string, number> = {};
    filteredProjects.forEach(p => {
      p.areas_seleccionadas?.forEach(area => {
        counts[area] = (counts[area] || 0) + 1;
      });
    });
    const COLORS = ['#8CC63F', '#E63383', '#3B82F6', '#F59E0B', '#10B981', '#6366F1', '#EC4899'];
    return Object.entries(counts).map(([name, value], index) => ({ 
      name, 
      value,
      fill: COLORS[index % COLORS.length]
    }));
  }, [filteredProjects]);

  const operationalMetrics = useMemo(() => {
    const total = filteredProjects.length;
    const activeProjects = filteredProjects.filter(p => p.status !== 'Finalizado' && p.status !== 'Cancelado');
    const finished = filteredProjects.filter(p => p.status === 'Finalizado' && p.fecha_finalizado);
    
    const totalDays = finished.reduce((acc, p) => {
      const created = new Date(p.createdAt);
      const finishedDate = new Date(p.fecha_finalizado!);
      return acc + (finishedDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    const avgDelivery = finished.length > 0 ? (totalDays / finished.length).toFixed(1) : 'N/A';
    
    // ODTs in QA stage (Normal process)
    const odtsInQA = filteredProjects.filter(p => p.status?.includes('QA')).length;
    
    // Total Real Rework (Actual rejections from history)
    const totalRealRework = filteredProjects.reduce((acc, p) => {
      const rejectionsInHistory = p.comentarios?.filter(c => 
        c.isSystemEvent && c.text.includes("RECHAZADO en [REVISIÓN QA")
      ).length || 0;
      return acc + rejectionsInHistory;
    }, 0);
    
    // Client Corrections
    const totalClientCorrections = filteredProjects.reduce((acc, p) => acc + (p.client_rejection_count || 0), 0);
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const onTimeCount = activeProjects.filter(p => {
      if (!p.fecha_entrega) return true;
      const delivery = new Date(p.fecha_entrega + 'T00:00:00');
      return delivery >= now;
    }).length;
    
    const delayedCount = activeProjects.filter(p => {
      if (!p.fecha_entrega) return false;
      const delivery = new Date(p.fecha_entrega + 'T00:00:00');
      return delivery < now;
    }).length;

    return {
      total,
      activeCount: activeProjects.length,
      avgDelivery,
      odtsInQA,
      totalRealRework,
      totalClientCorrections,
      onTimeCount,
      delayedCount
    };
  }, [filteredProjects]);

  const canSeeMoney = useMemo(() => {
    return user?.role === UserRole.Admin || 
           user?.role === UserRole.Cuentas_Lider || 
           user?.role === UserRole.Administracion_Lider;
  }, [user]);

  const runAIAnalysis = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined') {
      setAnalysis("Error: API Key no configurada.");
      return;
    }

    setLoadingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const dataForAI = filteredProjects.map(p => ({
        id: p.id,
        marca: p.marca,
        monto: p.monto_proyectado,
        status: p.status,
        correcciones: p.client_rejection_count || 0,
        areas: p.areas_seleccionadas
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analiza estos datos de la agencia y genera un reporte estratégico ejecutivo:\n\n${JSON.stringify(dataForAI, null, 2)}`,
        config: {
          systemInstruction: "Eres un Consultor Estratégico Senior. Proporciona un análisis macro del negocio, identificando rentabilidad, riesgos y 3 recomendaciones clave para escalar la agencia.",
          temperature: 0.7,
        }
      });

      setAnalysis(response.text || "No se pudo generar el análisis.");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setAnalysis("Error al conectar con la IA.");
    } finally {
      setLoadingAI(false);
    }
  };

  const downloadPDF = async () => {
    const element = document.getElementById('ai-analysis-content');
    if (!element) {
      console.error("Element #ai-analysis-content not found");
      return;
    }
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          fixOklchForHtml2Canvas(clonedDoc);
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reporte_Estrategico_APC_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const handleExportMasterReport = () => {
    if (!projects || projects.length === 0) return;
    
    const reportData = generateMasterReport(projects, users, exportDateFrom, exportDateTo);
    
    if (reportData.length === 0) {
      alert('No hay datos para el rango de fechas seleccionado.');
      return;
    }

    downloadMasterCSV(reportData, `REPORTE_MAESTRO_BI_${new Date().toISOString().split('T')[0]}`);
    setIsExportModalOpen(false);
  };

  if (!projects || !users) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apc-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panel Administrativo</h1>
          <p className="text-slate-500 font-medium text-sm italic">Métricas de Cumplimiento ISO 9001</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="bg-apc-pink text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-apc-pink/80 transition-all shadow-lg shadow-apc-pink/20 flex items-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" /> EXPORTAR REPORTE MAESTRO
          </button>
          <select className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-apc-green transition-all" value={executiveFilter} onChange={(e) => setExecutiveFilter(e.target.value)}>
            <option value="all">TODOS LOS EJECUTIVOS</option>
            {executives.map(e => <option key={e?.id} value={e?.id}>{(e?.name || '').toUpperCase()}</option>)}
          </select>
        </div>
      </header>

      {/* Commercial Intelligence Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Filtrar por Marca</label>
          <select 
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-xs appearance-none cursor-pointer"
          >
            {brands.map(b => <option key={b} value={b}>{(b || '').toUpperCase()}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Fecha Desde</label>
          <input 
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-xs"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Fecha Hasta</label>
          <input 
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-xs"
          />
        </div>
        <div className="flex items-end">
          <button 
            onClick={runAIAnalysis}
            disabled={loadingAI}
            className="w-full py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingAI ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Icons.Ai className="w-4 h-4" />
            )}
            {loadingAI ? 'ANALIZANDO...' : 'INTELIGENCIA IA'}
          </button>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Icons.Project />
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">ACTUAL</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ODTs Activas</p>
          <p className="text-3xl font-black text-slate-900">{operationalMetrics.activeCount}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Icons.Calendar />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">PROMEDIO</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tiempos de Entrega</p>
          <p className="text-3xl font-black text-slate-900">{operationalMetrics.avgDelivery} <span className="text-sm">días</span></p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Icons.Alert />
            </div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded">QA</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ODTs en Revisión QA</p>
          <p className="text-3xl font-black text-slate-900">{operationalMetrics.odtsInQA}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
              <Icons.Alert />
            </div>
            <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded">RETRABAJO</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Rechazos Internos</p>
          <p className="text-3xl font-black text-slate-900">{operationalMetrics.totalRealRework}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
              <Icons.Alert />
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded">CLIENTE</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correcciones de Cliente</p>
          <p className="text-3xl font-black text-slate-900">{operationalMetrics.totalClientCorrections}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Icons.Check />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">SLA OK</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ODTs a Tiempo</p>
          <p className="text-3xl font-black text-slate-900">{operationalMetrics.onTimeCount}</p>
        </div>

        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
              <Icons.Alert />
            </div>
            <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded">RETRASO</span>
          </div>
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">ODTs con Retraso</p>
          <p className="text-3xl font-black text-red-900">{operationalMetrics.delayedCount}</p>
        </div>

        {canSeeMoney && (
          <div className="bg-apc-green p-6 rounded-3xl text-white shadow-xl flex flex-col justify-between relative overflow-hidden md:col-span-2 lg:col-span-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icons.Clients />
              </div>
              <span className="text-[10px] font-black text-white/80 bg-white/20 px-2 py-1 rounded">FINANZAS</span>
            </div>
            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Monto Proyectado</p>
            <p className="text-3xl font-black relative z-10">${filteredProjects?.reduce((a, b) => a + (b?.monto_proyectado || 0), 0).toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Saturation Chart - All Areas */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-xl min-h-[450px] flex flex-col">
           <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Saturación por Área Operativa</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Proyectos en Proceso / Correcciones / QA</p>
              </div>
           </div>
           <div className="flex-1">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={saturationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                    itemStyle={{fontSize: '12px', fontWeight: 900}}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {saturationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8CC63F' : '#E63383'} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Distribution by Area Chart */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl min-h-[450px] flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Distribución por Área</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Volumen Histórico Total</p>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={areaDistributionData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {areaDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  wrapperStyle={{fontSize: '10px', fontWeight: 700, paddingTop: '20px'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Analysis Result */}
      <AnimatePresence mode="wait">
        {analysis && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Análisis Estratégico de Inteligencia</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={downloadPDF}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <Icons.Plus className="w-3 h-3" /> Descargar Reporte PDF
                </button>
                <button 
                  onClick={() => setAnalysis(null)}
                  className="text-slate-400 hover:text-slate-900 transition-all"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div id="ai-analysis-content" className="p-10 prose prose-slate max-w-none">
              <div className="mb-10 pb-6 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight m-0">Reporte Estratégico Ejecutivo</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  Generado por APC Intelligence AI • {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="markdown-body">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Exportar Reporte</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inteligencia de Negocios (BI)</p>
                  </div>
                  <button 
                    onClick={() => setIsExportModalOpen(false)}
                    className="p-2 hover:bg-slate-50 rounded-full transition-all"
                  >
                    <Icons.X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Fecha de Creación (Desde)</label>
                    <input 
                      type="date"
                      value={exportDateFrom}
                      onChange={(e) => setExportDateFrom(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-apc-pink transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Fecha de Creación (Hasta)</label>
                    <input 
                      type="date"
                      value={exportDateTo}
                      onChange={(e) => setExportDateTo(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-apc-pink transition-all font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsExportModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleExportMasterReport}
                    className="flex-1 py-4 bg-apc-pink text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-apc-pink/90 transition-all shadow-lg shadow-apc-pink/20"
                  >
                    Descargar CSV
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;