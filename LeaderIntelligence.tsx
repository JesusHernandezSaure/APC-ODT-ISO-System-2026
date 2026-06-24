import React, { useState, useMemo } from "react";
import { useODT } from "./ODTContext";
import { UserRole } from "./types";
import { Icons } from "./constants";
import ReactMarkdown from "react-markdown";
import { motion } from "motion/react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { fixOklchForHtml2Canvas } from "./reportUtils";
import { normalizeString } from "./workflowConfig";
import { analyzeLeaderPerformance } from "./services/geminiService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface LeaderIntelligenceProps {
  activeArea: string;
}

const LeaderIntelligence: React.FC<LeaderIntelligenceProps> = ({
  activeArea,
}) => {
  const { projects, users, user: currentUser } = useODT();

  const [filterUser, setFilterUser] = useState("Todos");
  const [dateRangeType, setDateRangeType] = useState("Este mes"); // Hoy, Esta semana, Semana pasada, Este mes, Mes pasado, Trimestre actual, Año actual, Personalizado
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const teamMembers = useMemo(() => {
    if (!users) return [];
    return users.filter(
      (u) =>
        normalizeString(u.department) === normalizeString(activeArea) ||
        (activeArea === "QA" &&
          (u.role === UserRole.Correccion || u.role === UserRole.QA_Opera)) ||
        u.id === filterUser, // Include selected user even if department doesn't match perfectly
    );
  }, [users, activeArea, filterUser]);

  const filteredProjects = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date();

    switch (dateRangeType) {
      case "Hoy":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
        );
        break;
      case "Esta semana": {
        const firstDayOfWeek = now.getDate() - now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), firstDayOfWeek);
        break;
      }
      case "Semana pasada": {
        const firstDayOfLastWeek = now.getDate() - now.getDay() - 7;
        start = new Date(now.getFullYear(), now.getMonth(), firstDayOfLastWeek);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          firstDayOfLastWeek + 6,
          23,
          59,
          59,
        );
        break;
      }
      case "Este mes":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "Mes pasado":
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case "Trimestre actual": {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStartMonth, 1);
        break;
      }
      case "Año actual":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "Personalizado":
        start = dateFrom ? new Date(dateFrom) : new Date(0);
        end = dateTo ? new Date(dateTo + "T23:59:59") : new Date();
        break;
    }

    return projects.filter((p) => {
      // Date filter
      const pDate = new Date(p.createdAt);
      if (pDate < start || pDate > end) return false;

      // Area filter: Project must have an assignment for this area or be active in it
      const hasAreaAssignment = p.asignaciones?.some(
        (a) => normalizeString(a.area) === normalizeString(activeArea),
      );
      if (!hasAreaAssignment) return false;

      // User filter
      if (filterUser !== "Todos") {
        const assignment = p.asignaciones?.find(
          (a) => normalizeString(a.area) === normalizeString(activeArea),
        );
        if (!assignment) return false;
        const userIds =
          assignment.usuarioIds ||
          (assignment.usuarioId ? [assignment.usuarioId] : []);
        if (!userIds.includes(filterUser)) return false;
      }

      return true;
    });
  }, [projects, activeArea, filterUser, dateRangeType, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const totalAttended = filteredProjects.length;
    let totalFinished = 0;
    let totalApprovedFirstTime = 0;
    let totalQARejections = 0;
    let totalClientRejections = 0;
    let slasMet = 0;
    let slasMissed = 0;
    let activeODTs = 0;
    let closedODTs = 0;
    let reworkIndexAccumulator = 0;

    const userStatsMap: Record<string, Record<string, unknown>> = {};

    filteredProjects.forEach((p) => {
      const assignment = p.asignaciones?.find(
        (a) => normalizeString(a.area) === normalizeString(activeArea),
      );
      const userIds =
        assignment?.usuarioIds ||
        (assignment?.usuarioId ? [assignment.usuarioId] : []);

      const isFinished = p.status === "Finalizado";
      if (isFinished) totalFinished++;
      if (
        p.status === "En Proceso" ||
        p.status === "Correcciones" ||
        p.status === "QA"
      )
        activeODTs++;
      if (isFinished || p.status === "Cancelado") closedODTs++;

      const qaRejections = p.metric_qaRejections || p.metric_retrabajoReal || 0;
      totalQARejections += qaRejections;
      reworkIndexAccumulator += qaRejections;

      const clientRejections =
        p.comentarios?.filter(
          (c) =>
            c.text.includes("RECHAZO DE CLIENTE") ||
            c.text.includes("CLIENTE SOLICITA CORRECCIÓN"),
        ).length || 0;
      totalClientRejections += clientRejections;

      if (qaRejections === 0 && clientRejections === 0 && isFinished) {
        totalApprovedFirstTime++;
      }

      // SLA Logic (Simplified for leader)
      const isMet = qaRejections + clientRejections === 0; // Simple SLA metric
      if (isMet) slasMet++;
      else slasMissed++;

      userIds.forEach((uid) => {
        if (!userStatsMap[uid]) {
          userStatsMap[uid] = {
            id: uid,
            name:
              users?.find((u) => u.id === uid)?.name || "Usuario Desconocido",
            attended: 0,
            rejections: 0,
            finished: 0,
            slasMet: 0,
            slasMissed: 0,
          };
        }
        userStatsMap[uid].attended++;
        userStatsMap[uid].rejections += qaRejections;
        if (isFinished) userStatsMap[uid].finished++;
        if (isMet) userStatsMap[uid].slasMet++;
        else userStatsMap[uid].slasMissed++;
      });
    });

    const userStats = Object.values(userStatsMap);

    return {
      totalAttended,
      totalFinished,
      totalApprovedFirstTime,
      totalQARejections,
      totalClientRejections,
      avgReworksPerODT:
        totalAttended > 0
          ? (reworkIndexAccumulator / totalAttended).toFixed(1)
          : "0",
      slasMet,
      slasMissed,
      slaCompliancePercentage:
        totalAttended > 0 ? Math.round((slasMet / totalAttended) * 100) : 0,
      activeODTs,
      closedODTs,
      firstPassApprovalPercentage:
        totalAttended > 0
          ? Math.round((totalApprovedFirstTime / totalAttended) * 100)
          : 0,
      userStats,
      // For types
      avgAttentionTime: "N/A",
      avgReviewTime: "N/A",
      avgTimeInQA: "N/A",
      reworkIndex:
        totalAttended > 0
          ? Math.round((reworkIndexAccumulator / totalAttended) * 100)
          : 0,
      avgCorrectionCycles:
        totalAttended > 0 ? reworkIndexAccumulator / totalAttended : 0,
    };
  }, [filteredProjects, activeArea, users]);

  const runAIAnalysis = async () => {
    setLoading(true);
    try {
      const result = await analyzeLeaderPerformance({
        leaderName: currentUser?.name || "Líder",
        area: activeArea,
        timeRange:
          dateRangeType === "Personalizado"
            ? `${dateFrom} al ${dateTo}`
            : dateRangeType,
        userFilter:
          filterUser === "Todos"
            ? "Todo el equipo"
            : users?.find((u) => u.id === filterUser)?.name || "Usuario",
        metrics: {
          totalAttended: metrics.totalAttended,
          totalFinished: metrics.totalFinished,
          totalApprovedFirstTime: metrics.totalApprovedFirstTime,
          totalQARejections: metrics.totalQARejections,
          totalClientRejections: metrics.totalClientRejections,
          avgReworksPerODT: parseFloat(metrics.avgReworksPerODT),
          avgAttentionTime: metrics.avgAttentionTime,
          avgReviewTime: metrics.avgReviewTime,
          avgTimeInQA: metrics.avgTimeInQA,
          slasMet: metrics.slasMet,
          slasMissed: metrics.slasMissed,
          slaCompliancePercentage: metrics.slaCompliancePercentage,
          activeODTs: metrics.activeODTs,
          closedODTs: metrics.closedODTs,
          firstPassApprovalPercentage: metrics.firstPassApprovalPercentage,
          reworkIndex: metrics.reworkIndex,
          avgCorrectionCycles: metrics.avgCorrectionCycles,
        },
        userStats: metrics.userStats,
      });
      setAnalysis(result || "No se pudo generar el análisis.");
    } catch (e: unknown) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 
                          (typeof e === 'object' && e !== null && 'message' in e) ? String((e as { message: unknown }).message) : 
                          String(e);
      
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        setAnalysis(
          "Se ha excedido el límite de uso de la IA (Quota Exceeded). Por favor, intenta de nuevo más tarde o verifica la configuración de tu API Key.",
        );
      } else if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("unavailable")) {
        setAnalysis(
          "El servicio de IA está experimentando una alta demanda en este momento. Por favor, intenta de nuevo en unos segundos.",
        );
      } else {
        setAnalysis("Error al generar el reporte inteligente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    const element = document.getElementById("leader-report-content");
    if (!element) return;
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: fixOklchForHtml2Canvas,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `Reporte_Inteligente_${activeArea}_${new Date().toISOString().split("T")[0]}.pdf`,
      );
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

  return (
    <div className="space-y-8 animate-fadeIn" id="leader-report-content">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Icons.BarChart2 className="w-8 h-8 text-indigo-400" /> Reporte
            Inteligente: {activeArea}
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">
            Análisis de Desempeño y Calidad Operativa
          </p>
        </div>
        <div className="flex gap-3 relative z-10">
          <button
            onClick={downloadPDF}
            className="px-6 py-4 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-700 transition-all shadow-xl flex items-center gap-3"
          >
            <Icons.Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={runAIAnalysis}
            disabled={loading}
            className="px-8 py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-3"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Icons.Ai className="w-4 h-4" />
            )}
            {loading ? "Analizando..." : "Generar Resumen AI"}
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
            Periodo
          </label>
          <select
            value={dateRangeType}
            onChange={(e) => setDateRangeType(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none"
          >
            {[
              "Hoy",
              "Esta semana",
              "Semana pasada",
              "Este mes",
              "Mes pasado",
              "Trimestre actual",
              "Año actual",
              "Personalizado",
            ].map((o) => (
              <option key={o} value={o}>
                {o.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        {dateRangeType === "Personalizado" && (
          <>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none"
              />
            </div>
          </>
        )}
        <div
          className={dateRangeType !== "Personalizado" ? "md:col-span-3" : ""}
        >
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
            Integrante del Equipo
          </label>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none"
          >
            <option value="Todos">TODOS LOS USUARIOS</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              ODTs Atendidas
            </p>
            <span className="p-2 bg-blue-50 text-blue-500 rounded-xl">
              <Icons.Briefcase className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black">{metrics.totalAttended}</p>
          <p className="text-xs text-slate-500 font-bold mt-2">
            Activas: {metrics.activeODTs} | Cerradas: {metrics.closedODTs}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Aprobación a la Primera
            </p>
            <span className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
              <Icons.CheckCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black">
            {metrics.firstPassApprovalPercentage}%
          </p>
          <p className="text-xs text-slate-500 font-bold mt-2">
            {metrics.totalApprovedFirstTime} ODTs sin rechazos
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Retrabajos (QA / Cliente)
            </p>
            <span className="p-2 bg-rose-50 text-rose-500 rounded-xl">
              <Icons.AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black">
            {metrics.totalQARejections + metrics.totalClientRejections}
          </p>
          <p className="text-xs text-slate-500 font-bold mt-2">
            Promedio por ODT: {metrics.avgReworksPerODT}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Cumplimiento SLA
            </p>
            <span className="p-2 bg-indigo-50 text-indigo-500 rounded-xl">
              <Icons.Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-3xl font-black">
            {metrics.slaCompliancePercentage}%
          </p>
          <p className="text-xs text-slate-500 font-bold mt-2">
            {metrics.slasMet} Cumplidos | {metrics.slasMissed} Fallidos
          </p>
        </div>
      </div>

      {/* AI Analysis Result */}
      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-indigo-100 rounded-3xl p-8 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-2">
            <Icons.Ai className="w-5 h-5" /> Resumen de Desempeño (IA)
          </h3>
          <div className="prose prose-sm max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-p:text-slate-600 prose-li:text-slate-600">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </motion.div>
      )}

      {/* Charts */}
      {filterUser === "Todos" && metrics.userStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
              Productividad por Usuario (ODTs)
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.userStats}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }}
                  />
                  <Bar
                    dataKey="attended"
                    name="Atendidas"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="finished"
                    name="Finalizadas"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
              Retrabajos por Usuario
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.userStats.filter((u) => u.rejections > 0)}
                    dataKey="rejections"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                  >
                    {metrics.userStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Individual User Raking Table */}
      {metrics.userStats.length > 0 && (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Desglose por Integrante
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-4 pl-6">Usuario</th>
                  <th className="p-4 text-center">Atendidas</th>
                  <th className="p-4 text-center">Finalizadas</th>
                  <th className="p-4 text-center">Retrabajos Generados</th>
                  <th className="p-4 text-center">SLA Cumplido</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-600">
                {metrics.userStats
                  .sort((a, b) => b.attended - a.attended)
                  .map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 pl-6 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        {u.name}
                      </td>
                      <td className="p-4 text-center">{u.attended}</td>
                      <td className="p-4 text-center text-emerald-600">
                        {u.finished}
                      </td>
                      <td className="p-4 text-center text-rose-500">
                        {u.rejections}
                      </td>
                      <td className="p-4 text-center">
                        {u.attended > 0
                          ? Math.round((u.slasMet / u.attended) * 100)
                          : 0}
                        %
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderIntelligence;
