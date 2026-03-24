
import React, { useState, useMemo } from 'react';
import { useODT } from './ODTContext';
import { UserRole } from './types';
import { Icons } from './constants';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

const VirtualAuditor: React.FC = () => {
  const { projects, users, user: currentUser } = useODT();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if user has access to financial data
  const hasFinancialAccess = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.role === UserRole.Admin ||
      currentUser.role === UserRole.Cuentas_Lider ||
      currentUser.department === 'Administración' ||
      currentUser.department === 'Finanzas'
    );
  }, [currentUser]);

  const stats = useMemo(() => {
    const data = {
      totalProjects: projects.length,
      finishedProjects: projects.filter(p => p.status === 'Finalizado').length,
      byBrand: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      internalCorrections: 0,
      clientCorrections: 0,
      delays: 0,
      totalAmount: 0,
      avgProductionTime: 0,
      materialTypes: {} as Record<string, number>,
      areaStats: {} as Record<string, { projects: number, corrections: number, delays: number, totalAmount: number }>,
      userStats: {} as Record<string, { projects: number, corrections: number, delays: number }>,
    };

    let totalProductionTime = 0;
    let finishedWithTime = 0;

    projects.forEach(p => {
      // Brand
      data.byBrand[p.marca] = (data.byBrand[p.marca] || 0) + 1;
      // Category
      data.byCategory[p.category] = (data.byCategory[p.category] || 0) + 1;
      
      // Corrections
      const internal = p.comentarios?.filter(c => c.isSystemEvent && c.text.includes("RECHAZADO en [REVISIÓN QA")).length || 0;
      const client = p.comentarios?.filter(c => c.isSystemEvent && c.text.includes("RECHAZADO por Cliente")).length || 0;
      data.internalCorrections += internal;
      data.clientCorrections += client;

      // Financials (only if allowed, but we collect for the prompt if allowed)
      if (hasFinancialAccess) {
        data.totalAmount += (p.monto_proyectado || 0);
      }

      // Materials
      p.materiales?.forEach(m => {
        data.materialTypes[m.tipo] = (data.materialTypes[m.tipo] || 0) + 1;
      });

      // Delays
      if (p.fecha_entrega && p.fecha_finalizado) {
        const promised = new Date(p.fecha_entrega);
        const actual = new Date(p.fecha_finalizado);
        if (actual > promised) {
          data.delays += 1;
        }
      }

      // Production Time
      if (p.fecha_finalizado) {
        const created = new Date(p.createdAt);
        const finished = new Date(p.fecha_finalizado);
        totalProductionTime += (finished.getTime() - created.getTime());
        finishedWithTime += 1;
      }

      // Area Stats
      p.areas_seleccionadas?.forEach(area => {
        if (!data.areaStats[area]) {
          data.areaStats[area] = { projects: 0, corrections: 0, delays: 0, totalAmount: 0 };
        }
        data.areaStats[area].projects += 1;
        // Estimate amount per area
        if (hasFinancialAccess) {
          data.areaStats[area].totalAmount += (p.monto_proyectado || 0) / (p.areas_seleccionadas?.length || 1);
        }
      });

      // User Stats (based on assignments)
      p.asignaciones?.forEach(a => {
        const u = users.find(u => u.id === a.usuarioId);
        if (u) {
          if (!data.userStats[u.name]) {
            data.userStats[u.name] = { projects: 0, corrections: 0, delays: 0 };
          }
          data.userStats[u.name].projects += 1;
        }
      });
    });

    data.avgProductionTime = finishedWithTime > 0 ? totalProductionTime / finishedWithTime / (1000 * 60 * 60 * 24) : 0;

    return data;
  }, [projects, users, hasFinancialAccess]);

  const runAnalysis = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined') {
      setAnalysis("Error: La clave de API de Gemini (GEMINI_API_KEY) no está configurada en el entorno. Si estás en Vercel, asegúrate de añadirla en las variables de entorno del proyecto y volver a desplegar.");
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const promptData = {
        totalProjects: stats.totalProjects,
        finishedProjects: stats.finishedProjects,
        byBrand: stats.byBrand,
        byCategory: stats.byCategory,
        internalCorrections: stats.internalCorrections,
        clientCorrections: stats.clientCorrections,
        delays: stats.delays,
        avgProductionTimeDays: stats.avgProductionTime.toFixed(2),
        materialTypes: stats.materialTypes,
        areaStats: stats.areaStats,
        // We only include financial data if the user has access
        ...(hasFinancialAccess ? {
          totalAmountCharged: stats.totalAmount,
          avgAmountPerProject: stats.totalAmount / (stats.totalProjects || 1),
        } : {})
      };

      const systemInstruction = `
        Eres un Auditor Senior de ISO 9001:2015 y Experto en Consultoría Comercial para Agencias de Publicidad.
        Tu objetivo es analizar los datos operativos de la agencia APC Publicidad y proponer mejoras estratégicas.
        
        Analiza los siguientes datos:
        ${JSON.stringify(promptData, null, 2)}
        
        Considera:
        1. Eficiencia de procesos (tiempos de producción, retrasos).
        2. Calidad (correcciones internas vs externas).
        3. Rentabilidad y carga de trabajo por área.
        4. Cumplimiento de estándares ISO.
        
        ${!hasFinancialAccess ? 'NOTA: No tienes acceso a datos de costos o montos para este análisis, enfócate en la operatividad y calidad.' : 'Tienes acceso a datos financieros, úsalos para analizar rentabilidad.'}
        
        Estructura tu respuesta en Markdown con:
        - Resumen Ejecutivo.
        - Análisis de Riesgos (ISO 9001).
        - Cuellos de Botella Identificados.
        - Propuestas de Mejora (Acciones Inmediatas y a Largo Plazo).
        - Conclusión Estratégica.
        
        Sé crítico pero constructivo. Usa un tono profesional y experto.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Realiza el análisis de auditoría y mejora para la agencia basado en los datos proporcionados.",
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      setAnalysis(response.text || "No se pudo generar el análisis.");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setAnalysis("Error al conectar con el Auditor Virtual. Por favor, intente más tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex justify-between items-center bg-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-apc-pink/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Icons.Ai className="w-8 h-8 text-apc-pink animate-pulse" /> Auditor Virtual APC
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">
            Inteligencia Artificial aplicada a ISO 9001:2015 & Estrategia Comercial
          </p>
        </div>
        <button 
          onClick={runAnalysis}
          disabled={loading}
          className="relative z-10 px-8 py-4 bg-apc-pink text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-apc-pink/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Analizando Datos...
            </>
          ) : (
            <>
              <Icons.Ai className="w-4 h-4" /> Ejecutar Auditoría Global
            </>
          )}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Stats Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Métricas Operativas</h3>
            <div className="space-y-4">
              <StatItem label="Proyectos Totales" value={stats.totalProjects} icon={<Icons.Project className="text-blue-500" />} />
              <StatItem label="Correcciones Internas" value={stats.internalCorrections} icon={<Icons.Alert className="text-amber-500" />} />
              <StatItem label="Rechazos de Cliente" value={stats.clientCorrections} icon={<Icons.Alert className="text-rose-500" />} />
              <StatItem label="Retrasos en Entrega" value={stats.delays} icon={<Icons.Calendar className="text-rose-600" />} />
              <StatItem label="Tiempo Prom. Producción" value={`${stats.avgProductionTime.toFixed(1)} días`} icon={<Icons.Dashboard className="text-emerald-500" />} />
              {hasFinancialAccess && (
                <StatItem label="Monto Total Proyectado" value={`$${stats.totalAmount.toLocaleString()}`} icon={<Icons.Clients className="text-apc-green" />} />
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Distribución por Área</h3>
            <div className="space-y-3">
              {Object.entries(stats.areaStats).map(([area, data]) => (
                <div key={area} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-black text-slate-700 uppercase">{area}</span>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{data.projects} ODTs</p>
                    {hasFinancialAccess && <p className="text-[8px] font-bold text-slate-400">${data.totalAmount.toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Analysis Result */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-8 rounded-3xl border shadow-xl prose prose-slate max-w-none"
              >
                <div className="flex items-center justify-between mb-8 pb-4 border-b">
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight m-0">Informe de Auditoría AI</h2>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-widest">Generado en Tiempo Real</span>
                </div>
                <div className="markdown-body">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center flex flex-col items-center justify-center h-full">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 text-slate-300">
                  <Icons.Ai className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Listo para Auditar</h3>
                <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">
                  Haga clic en el botón superior para que el agente analice la base de datos y genere propuestas de mejora basadas en ISO 9001.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const StatItem: React.FC<{ label: string, value: string | number, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-all">
    <div className="w-10 h-10 bg-white border rounded-xl flex items-center justify-center shadow-sm">
      {icon}
    </div>
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-sm font-black text-slate-900">{value}</p>
    </div>
  </div>
);

export default VirtualAuditor;
