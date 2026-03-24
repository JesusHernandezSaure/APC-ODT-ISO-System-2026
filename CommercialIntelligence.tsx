
import React, { useState, useMemo } from 'react';
import { useODT } from './ODTContext';
import { UserRole } from './types';
import { Icons } from './constants';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CommercialIntelligence: React.FC = () => {
  const { projects, users, user: currentUser } = useODT();
  
  // 1. Global Filtering State
  const [filterBrand, setFilterBrand] = useState('Todas');
  const [filterExecutive, setFilterExecutive] = useState('Todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 2. RBAC Logic for Data Access
  const filteredProjects = useMemo(() => {
    if (!currentUser) return [];

    let base = projects;

    // Role-based scoping
    if (currentUser.role === UserRole.Cuentas_Opera) {
      base = base.filter(p => p.ownerId === currentUser.id);
    }

    // Apply Filters
    return base.filter(p => {
      const matchBrand = filterBrand === 'Todas' || p.marca === filterBrand;
      const matchExecutive = filterExecutive === 'Todos' || p.ownerId === filterExecutive;
      
      const projectDate = new Date(p.createdAt);
      const matchDateFrom = !dateFrom || projectDate >= new Date(dateFrom);
      const matchDateTo = !dateTo || projectDate <= new Date(dateTo + 'T23:59:59');

      return matchBrand && matchExecutive && matchDateFrom && matchDateTo;
    });
  }, [projects, currentUser, filterBrand, filterExecutive, dateFrom, dateTo]);

  const brands = useMemo(() => {
    const uniqueBrands = Array.from(new Set(projects.map(p => p.marca)));
    return ['Todas', ...uniqueBrands.sort()];
  }, [projects]);

  const executives = useMemo(() => {
    const execUsers = users.filter(u => u.role === UserRole.Cuentas_Opera || u.role === UserRole.Cuentas_Lider);
    return [{ id: 'Todos', name: 'Todos' }, ...execUsers.sort((a, b) => a.name.localeCompare(b.name))];
  }, [users]);

  // 3. Reactive KPIs
  const kpis = useMemo(() => {
    const total = filteredProjects.length;
    
    // Avg Delivery Time
    const finished = filteredProjects.filter(p => p.status === 'Finalizado' && p.fecha_finalizado);
    const totalDays = finished.reduce((acc, p) => {
      const created = new Date(p.createdAt);
      const finishedDate = new Date(p.fecha_finalizado!);
      return acc + (finishedDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    const avgDelivery = finished.length > 0 ? (totalDays / finished.length).toFixed(1) : 'N/A';

    // Rejection Rate
    const totalRejections = filteredProjects.reduce((acc, p) => acc + (p.contadorCorrecciones || 0), 0);
    const rejectionRate = total > 0 ? (totalRejections / total).toFixed(1) : '0';

    // Financials
    const totalAmount = filteredProjects.reduce((acc, p) => acc + (p.monto_proyectado || 0), 0);
    const totalFacturado = filteredProjects.filter(p => p.facturado).reduce((acc, p) => acc + (p.monto_proyectado || 0), 0);
    const totalPagado = filteredProjects.filter(p => p.pagado).reduce((acc, p) => acc + (p.monto_proyectado || 0), 0);

    return {
      total,
      avgDelivery,
      rejectionRate,
      totalAmount,
      totalFacturado,
      totalPagado
    };
  }, [filteredProjects]);

  // 4. AI Intelligence Engine
  const runAIAnalysis = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Package data for AI
      const dataForAI = filteredProjects.map(p => ({
        id: p.id,
        marca: p.marca,
        monto: p.monto_proyectado,
        status: p.status,
        facturado: p.facturado,
        pagado: p.pagado,
        correcciones: p.contadorCorrecciones || 0,
        createdAt: p.createdAt,
        finishedAt: p.fecha_finalizado,
        areas: p.areas_seleccionadas
      }));

      let systemInstruction = '';
      if (currentUser.role === UserRole.Cuentas_Opera) {
        systemInstruction = `Eres un estratega comercial. Analiza el historial de este ejecutivo. Identifica: 1. Servicios (áreas) que sus clientes no están usando para hacer cross-selling. 2. Ideas creativas o tipos de entregables que podría proponer en su próxima junta para hacer crecer la cuenta. 3. Puntos débiles en sus ODTs (ej. retrasos) para mejorar.`;
      } else if (currentUser.role === UserRole.Cuentas_Lider) {
        systemInstruction = `Eres un Director de Cuentas. Analiza estos datos de la agencia. Identifica: 1. Ejecutivos o marcas estancadas (baja de volumen). 2. Cuellos de botella globales (áreas que más retrasan proyectos). 3. Ajustes sugeridos en distribución de cuentas o servicios.`;
      } else if (currentUser.department === 'Administración' || currentUser.department === 'Finanzas') {
        systemInstruction = `Eres un Analista Financiero. Revisa estos datos de facturación y producción. Analiza: 1. Costo de producción vs. Tiempos de pago. 2. Riesgo de pérdida de clientes (Churn Risk por inactividad). 3. Eficiencia de cobro y clientes más/menos rentables.`;
      } else if (currentUser.role === UserRole.Admin) {
        systemInstruction = `Eres un Consultor Estratégico y Director General (CEO) de una agencia de marketing médico. Analiza la totalidad de los datos históricos, operativos y financieros. Tu objetivo es proporcionar un análisis macro del negocio.
Basado en los datos, identifica:
1. Rentabilidad Real: ¿Cuáles son los clientes y servicios (áreas) más rentables cuando cruzamos los montos facturados con el tiempo invertido y los costos ocultos (reprocesos en QA)? ¿Cuáles nos están haciendo perder dinero por ineficiencia?
2. Riesgos Sistémicos: Detecta si existe una dependencia peligrosa de uno o dos clientes (concentración de ingresos) o si hay cuellos de botella crónicos en áreas operativas específicas que requieran contratar más personal.
3. Tendencias del Negocio: ¿Qué servicios están creciendo en demanda y cuáles están estancados?
4. Estrategia de Crecimiento: Proporciona 3 recomendaciones directivas (accionables de alto nivel) para escalar la agencia, optimizar el margen de ganancia o abrir nuevas líneas de negocio.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analiza los siguientes datos de la agencia y genera el reporte estratégico solicitado:\n\n${JSON.stringify(dataForAI, null, 2)}`,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      setAnalysis(response.text || "No se pudo generar el análisis.");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setAnalysis("Error al conectar con el motor de Inteligencia Comercial. Por favor, intente más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    const element = document.getElementById('ai-report-content');
    if (!element) return;
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Reporte_Inteligencia_Comercial_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const showFinancials = currentUser?.role === UserRole.Admin || currentUser?.role === UserRole.Cuentas_Lider || currentUser?.department === 'Administración' || currentUser?.department === 'Finanzas';

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Icons.TrendingUp className="w-8 h-8 text-blue-400" /> Inteligencia Comercial
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">
            Análisis Predictivo & Estrategia de Negocio APC
          </p>
        </div>
        <button 
          onClick={runAIAnalysis}
          disabled={loading}
          className="relative z-10 px-8 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Procesando Datos...
            </>
          ) : (
            <>
              <Icons.Ai className="w-4 h-4" /> Generar Proyección con IA
            </>
          )}
        </button>
      </header>

      {/* 1. Global Filtering Controls */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Marca / Cliente</label>
          <select 
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-xs appearance-none cursor-pointer"
          >
            {brands.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
          </select>
        </div>

        {(currentUser?.role === UserRole.Admin || currentUser?.role === UserRole.Cuentas_Lider) && (
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Ejecutivo</label>
            <select 
              value={filterExecutive}
              onChange={(e) => setFilterExecutive(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-xs appearance-none cursor-pointer"
            >
              {executives.map(e => <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Desde</label>
          <input 
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-xs"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Hasta</label>
          <input 
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-xs"
          />
        </div>
      </div>

      {/* 3. Reactive KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard label="Volumen ODTs" value={kpis.total} icon={<Icons.Project className="text-blue-500" />} />
        <KPICard label="Entrega Promedio" value={`${kpis.avgDelivery} días`} icon={<Icons.Calendar className="text-emerald-500" />} />
        <KPICard label="Tasa de Rechazo" value={kpis.rejectionRate} icon={<Icons.Alert className="text-rose-500" />} />
        {showFinancials && (
          <KPICard label="Monto Total" value={`$${kpis.totalAmount.toLocaleString()}`} icon={<Icons.Clients className="text-apc-green" />} />
        )}
      </div>

      {showFinancials && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Facturado</p>
              <p className="text-2xl font-black text-slate-900">${kpis.totalFacturado.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Icons.Check />
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Pagado</p>
              <p className="text-2xl font-black text-slate-900">${kpis.totalPagado.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Icons.Check />
            </div>
          </div>
        </div>
      )}

      {/* 5. Report Visualization */}
      <AnimatePresence mode="wait">
        {analysis && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Reporte de Inteligencia</h3>
              <button 
                onClick={downloadPDF}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <Icons.Plus className="w-3 h-3" /> Descargar Reporte PDF
              </button>
            </div>
            <div id="ai-report-content" className="p-10 prose prose-slate max-w-none">
              <div className="mb-10 pb-6 border-b border-slate-100">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight m-0">Análisis Estratégico APC</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  Generado por Gemini AI • {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="markdown-body">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
              <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.5em]">
                  Documento Confidencial • APC Publicidad
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const KPICard: React.FC<{ label: string, value: string | number, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all group">
    <div className="flex items-center justify-between mb-4">
      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-2xl font-black text-slate-900">{value}</p>
  </div>
);

export default CommercialIntelligence;
