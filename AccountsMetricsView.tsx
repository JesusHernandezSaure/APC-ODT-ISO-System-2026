import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useODT } from './ODTContext';
import { UserRole, User } from './types';
import { Icons } from './constants';
import Markdown from 'react-markdown';
import { analyzeExecutivePerformance } from './services/geminiService';

export const AccountsMetricsView: React.FC = () => {
  const { projects, clients, users } = useODT();
  const { Folder, Search } = Icons;

  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estados para el Modal de Descarga de Reporte
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadRange, setDownloadRange] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [downloadExecId, setDownloadExecId] = useState<string>('all');
  const [downloadClientId, setDownloadClientId] = useState<string>('all');

  // Estados para el Análisis IA
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReportText, setAiReportText] = useState<string>('');

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((isAnalyzing || aiReportText) && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isAnalyzing, aiReportText]);

  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    
    const execName = selectedExecutiveId === 'all' ? 'Toda la Agencia' :
                     selectedExecutiveId === 'unassigned' ? 'Sin Asignar' :
                     accountsUsers.find(u => u.id === selectedExecutiveId)?.name || 'Cuentas';

    const rangeName = timeRange === 'day' ? 'Hoy' :
                      timeRange === 'week' ? 'Última Semana' :
                      timeRange === 'month' ? 'Último Mes' :
                      timeRange === 'year' ? 'Último Año' : 'Todo el Tiempo';

    const brandName = selectedClientId === 'all' ? 'Todas las marcas' :
                      filteredClientsForExecutive.find(c => c.id === selectedClientId)?.name || 'Marca específica';

    // Preparar un subset de proyectos acotado para el análisis operativo sin saturar tokens
    const simplifiedProjectsForAI = filteredProjects.map(p => {
      let slaStatusForAI = 'Sin entrega';
      if (p.fecha_entrega && p.client_standby_periods?.[0]?.start) {
        const actionTime = new Date(p.client_standby_periods[0].start);
        const deadlineDateStr = p.fecha_entrega.includes('T') ? p.fecha_entrega.split('T')[0] : p.fecha_entrega;
        const deadline = new Date(`${deadlineDateStr}T23:59:59`);
        slaStatusForAI = actionTime <= deadline ? 'A Tiempo' : 'Tarde';
      }

      return {
        id: p.id,
        client: p.empresa,
        brand: p.marca,
        product: p.producto,
        created: p.createdAt ? p.createdAt.split('T')[0] : '',
        due: p.fecha_entrega || 'S/F',
        status: p.status,
        type: p.tipoCargo === 'extra' ? 'Extra' : 'Iguala',
        monto: p.monto_proyectado || 0,
        sla_intento: slaStatusForAI
      };
    });

    try {
      const response = await analyzeExecutivePerformance({
        executiveName: execName,
        timeRange: rangeName,
        brandName: brandName,
        metrics: {
          totalIgualasVal: accountsMetrics.totalIgualasVal,
          totalExtrasVal: accountsMetrics.totalExtrasVal,
          totalCreatedCount: accountsMetrics.totalCreatedCount,
          activeODTsCount: accountsMetrics.activeODTsCount,
          enRevisionCount: accountsMetrics.enRevisionCount,
          enTiempoCount: accountsMetrics.enTiempoCount,
          conRetrasoCount: accountsMetrics.conRetrasoCount,
          entregasATiempoCount: accountsMetrics.entregasATiempoCount,
          entregasTardeCount: accountsMetrics.entregasTardeCount,
        },
        projects: simplifiedProjectsForAI.slice(0, 40) // Tomamos un tope generoso para el prompt
      });
      
      if (response) {
        setAiReportText(response);
      }
    } catch (error) {
      console.error('Error generating AI Performance report:', error);
      alert('Hubo un error al generar el análisis con IA. Por favor, verifica tu conexión o API key.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPDF = () => {
    const execName = selectedExecutiveId === 'all' ? 'Toda la Agencia' :
                     selectedExecutiveId === 'unassigned' ? 'Sin Asignar' :
                     accountsUsers.find(u => u.id === selectedExecutiveId)?.name || 'Cuentas';

    const rangeName = timeRange === 'day' ? 'Hoy' :
                      timeRange === 'week' ? 'Última Semana' :
                      timeRange === 'month' ? 'Último Mes' :
                      timeRange === 'year' ? 'Último Año' : 'Todo el Tiempo';

    const brandName = selectedClientId === 'all' ? 'Todas las marcas' :
                      filteredClientsForExecutive.find(c => c.id === selectedClientId)?.name || 'Marca específica';

    const parseMarkdownToHtml = (markdown: string): string => {
      let html = markdown;
      
      // Headings
      html = html.replace(/^### (.*$)/gim, '<h3 style="font-family: Inter, sans-serif; font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-top: 20px; margin-bottom: 8px; border-left: 4px solid #4f46e5; padding-left: 10px; background-color: #f8fafc; padding-top: 6px; padding-bottom: 6px; border-radius: 4px; page-break-after: avoid;">$1</h3>');
      html = html.replace(/^## (.*$)/gim, '<h2 style="font-family: Inter, sans-serif; font-size: 15px; font-weight: 800; color: #312e81; text-transform: uppercase; margin-top: 24px; margin-bottom: 8px; page-break-after: avoid;">$1</h2>');
      html = html.replace(/^# (.*$)/gim, '<h1 style="font-family: Inter, sans-serif; font-size: 17px; font-weight: 900; color: #111827; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 28px; margin-bottom: 12px; text-transform: uppercase; page-break-after: avoid;">$1</h1>');

      // Bold Text
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');

      // Blockquotes
      html = html.replace(/^> (.*$)/gim, '<blockquote style="border-left: 4px solid #f59e0b; background-color: #fffbeb; padding: 10px 14px; margin: 12px 0; border-radius: 0 8px 8px 0; font-style: italic; color: #4b5563; font-size: 11px;">$1</blockquote>');

      // List Elements
      html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-bottom: 4px; font-size: 11px; font-weight: 500; color: #374151;">$1</li>');
      html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-bottom: 4px; font-size: 11px; font-weight: 500; color: #374151; list-style-type: decimal;">$1</li>');

      // Horizon Splitters
      html = html.replace(/^---/gm, '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;">');

      const lines = html.split('\n');
      const formattedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<block') || trimmed.startsWith('<hr') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
          return line;
        }
        return `<p style="font-family: Inter, sans-serif; font-size: 11px; color: #374151; line-height: 1.6; margin-bottom: 10px; font-weight: 500; text-align: justify;">${line}</p>`;
      });

      html = formattedLines.join('\n');
      
      // Group contiguous list tags
      html = html.replace(/(<li.*?>.*?<\/li>)+/g, '<ul style="padding-left: 20px; list-style-type: disc; margin-bottom: 12px;">$&</ul>');

      return html;
    };

    const renderedReportHtml = parseMarkdownToHtml(aiReportText);

    const docSetupHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reporte de Rendimiento - ${execName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: letter;
            margin: 18mm 18mm 18mm 18mm;
          }
          body {
            font-family: 'Inter', sans-serif;
            color: #334155;
            line-height: 1.6;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .title-area h4 {
            margin: 0;
            font-weight: 800;
            font-size: 10px;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 1.5px;
          }
          .title-area h2 {
            margin: 4px 0 0 0;
            font-weight: 900;
            font-size: 18px;
            color: #0f172a;
            text-transform: uppercase;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .meta-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 10px 14px;
            border-radius: 8px;
          }
          .meta-title {
            font-size: 8px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0;
          }
          .meta-value {
            font-size: 11px;
            font-weight: 700;
            color: #1e293b;
            margin: 2px 0 0 0;
            text-transform: uppercase;
          }
          .metrics-box {
            background: linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%);
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .metrics-box-title {
            font-size: 10px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
          .metric-item {
            display: flex;
            flex-direction: column;
          }
          .metric-label {
            font-size: 9px;
            font-weight: 600;
            color: #64748b;
          }
          .metric-val {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          .report-content {
            font-size: 11px;
          }
          .footer-watermark {
            margin-top: 30px;
            border-top: 1px solid #f1f5f9;
            padding-top: 8px;
            font-size: 8px;
            color: #94a3b8;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          h1, h2, h3, h4, blockquote, .meta-card, .metrics-box {
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h4>Sistema ISO 9001:2015 – Control de Gestión</h4>
            <h2>ANÁLISIS DIRECTIVO DE RENDIMIENTO</h2>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Fecha Impresión</div>
            <div style="font-size: 11px; font-weight: bold; color: #334155;">${new Date().toLocaleDateString('es-MX')}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-card">
            <p class="meta-title">Ejecutivo de Cuentas</p>
            <p class="meta-value">${execName}</p>
          </div>
          <div class="meta-card">
            <p class="meta-title">Rango de Evaluación</p>
            <p class="meta-value">${rangeName}</p>
          </div>
          <div class="meta-card">
            <p class="meta-title">Marcas Seleccionadas</p>
            <p class="meta-value" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${brandName}</p>
          </div>
        </div>

        <div class="metrics-box">
          <div class="metrics-box-title">Métricas Clave del Periodo</div>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Valor de Igualas</span>
              <span class="metric-val">$ ${accountsMetrics.totalIgualasVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Valor Extra s/Iguala</span>
              <span class="metric-val">$ ${accountsMetrics.totalExtrasVal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">ODTs Creadas</span>
              <span class="metric-val">${accountsMetrics.totalCreatedCount} asignadas</span>
            </div>
            <div class="metric-item" style="margin-top: 10px;">
              <span class="metric-label">ODTs Activas</span>
              <span class="metric-val">${accountsMetrics.activeODTsCount} activas</span>
            </div>
            <div class="metric-item" style="margin-top: 10px;">
              <span class="metric-label">En Tiempo vs SLA</span>
              <span class="metric-val">${accountsMetrics.enTiempoCount} en tiempo</span>
            </div>
            <div class="metric-item" style="margin-top: 10px;">
              <span class="metric-label">Cumplimiento SLA (Primer Envío)</span>
              <span class="metric-val">
                ${accountsMetrics.entregasATiempoCount + accountsMetrics.entregasTardeCount > 0 
                  ? `${Math.round((accountsMetrics.entregasATiempoCount / (accountsMetrics.entregasATiempoCount + accountsMetrics.entregasTardeCount)) * 100)}%`
                  : '100%'}
              </span>
            </div>
          </div>
        </div>

        <div class="report-content">
          ${renderedReportHtml}
        </div>

        <div class="footer-watermark">
          Generado dinámicamente mediante auditoría asistida por IA inteligente bajo el estándar de calidad ISO 9001:2015.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    // Usamos Blob y abrimos en una nueva pestaña (o descargamos si las ventanas están bloqueadas)
    try {
      const blob = new Blob([docSetupHtml], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Intentamos abrir en una pestaña nueva
      const newTab = window.open(url, '_blank');
      
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        // Bloqueo de ventanas emergentes (Pop-up blocker), activamos descarga manual
        triggerDownloadFallback(docSetupHtml, execName);
      }
      
      // Limpiamos el URL después de un tiempo razonable para que la nueva pestaña lo cargue
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.warn("Fallo general al crear PDF/HTML:", err);
      triggerDownloadFallback(docSetupHtml, execName);
    }
  };

  const triggerDownloadFallback = (htmlContent: string, execName: string) => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Clean and descriptive filename
    const cleanName = execName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.download = `reporte_desempeno_${cleanName || 'ejecutivo'}.html`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    // Muestra una guía intuitiva de un solo paso
    alert(
      'Para garantizar la descarga debido a políticas de seguridad del navegador, se ha descargado un archivo interactivo listo para imprimir:\n\n' +
      '📁 "reporte_desempeno_' + (cleanName || 'ejecutivo') + '.html"\n\n' +
      '¡Solo dale doble click para abrirlo, y se desplegará el menú de Guardar como PDF automáticamente!'
    );
  };

  const openDownloadModal = () => {
    setDownloadRange(timeRange);
    setDownloadExecId(selectedExecutiveId);
    setDownloadClientId(selectedClientId);
    setIsDownloadModalOpen(true);
  };

  const handleModalExecutiveChange = (execId: string) => {
    setDownloadExecId(execId);
    setDownloadClientId('all');
  };

  // Marcas válidas para el modal de descarga
  const modalClientsList = useMemo(() => {
    if (!clients) return [];
    if (downloadExecId === 'all') {
      return clients;
    }
    if (downloadExecId === 'unassigned') {
      return clients.filter(c => !c.assignedExecutives || c.assignedExecutives.length === 0);
    }
    return clients.filter(c => c.assignedExecutives?.includes(downloadExecId));
  }, [clients, downloadExecId]);

  // Generador de Excel/CSV UTF-8 BOM sin problemas de codificación de acentos o símbolos
  const handleDownloadExcel = (overrideRange?: string, overrideExecId?: string, overrideClientId?: string) => {
    const activeRange = overrideRange || timeRange;
    const activeExecId = overrideExecId || selectedExecutiveId;
    const activeClientId = overrideClientId || selectedClientId;

    // Filtrar marcas según ejecutivo seleccionado para reporte
    const targetClients = !clients ? [] : (
      activeExecId === 'all' ? clients :
      activeExecId === 'unassigned' ? clients.filter(c => !c.assignedExecutives || c.assignedExecutives.length === 0) :
      clients.filter(c => c.assignedExecutives?.includes(activeExecId))
    );

    const selectedClientObjects = activeClientId === 'all' 
      ? targetClients 
      : targetClients.filter(c => c.id === activeClientId);

    const validClientIds = selectedClientObjects.map(c => c.id);

    // Filtrar por rango
    const isWithinPeriodForReport = (createdAt: string, range: string) => {
      if (range === 'all') return true;
      const createdDate = new Date(createdAt);
      const now = new Date();
      const cutoff = new Date();
      if (range === 'day') {
        cutoff.setHours(0, 0, 0, 0);
        return createdDate.getTime() >= cutoff.getTime();
      } else if (range === 'week') {
        cutoff.setDate(now.getDate() - 7);
        return createdDate.getTime() >= cutoff.getTime();
      } else if (range === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
        return createdDate.getTime() >= cutoff.getTime();
      } else if (range === 'year') {
        cutoff.setFullYear(now.getFullYear() - 1);
        return createdDate.getTime() >= cutoff.getTime();
      }
      return true;
    };

    let reportProjects = !projects ? [] : projects.filter(p => !p.deleted);
    reportProjects = reportProjects.filter(p => p.clientId && validClientIds.includes(p.clientId));
    reportProjects = reportProjects.filter(p => p.createdAt && isWithinPeriodForReport(p.createdAt, activeRange));

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase().trim();
      reportProjects = reportProjects.filter(p => 
        p.id?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q) ||
        p.empresa?.toLowerCase().includes(q) ||
        p.producto?.toLowerCase().includes(q)
      );
    }

    // Calcular Métricas
    const totalIgualasVal = selectedClientObjects.reduce((sum, c) => sum + (c.montoIgualaMensual || 0), 0);
    const totalExtrasVal = reportProjects
      .filter(p => p.tipoCargo === 'extra' && p.status !== 'Cancelado')
      .reduce((sum, p) => sum + (p.monto_proyectado || 0), 0);

    const totalCreatedCount = reportProjects.length;
    const activeODTsCount = reportProjects.filter(p => p.status !== 'Finalizado' && p.status !== 'Cancelado').length;
    const enRevisionCount = reportProjects.filter(p => p.status === 'En revisión con cliente' || p.enStandby).length;

    const todayStr = new Date().toISOString().split('T')[0];

    const enTiempoCount = reportProjects.filter(p => {
      const isActive = p.status !== 'Finalizado' && p.status !== 'Cancelado';
      const isNotWithClient = p.status !== 'En revisión con cliente' && !p.enStandby;
      if (!isActive || !isNotWithClient) return false;
      if (!p.fecha_entrega) return true;
      return p.fecha_entrega >= todayStr;
    }).length;

    const conRetrasoCount = reportProjects.filter(p => {
      const isActive = p.status !== 'Finalizado' && p.status !== 'Cancelado';
      const isNotWithClient = p.status !== 'En revisión con cliente' && !p.enStandby;
      if (!isActive || !isNotWithClient) return false;
      if (!p.fecha_entrega) return false;
      return p.fecha_entrega < todayStr;
    }).length;

    let entregasATiempoCount = 0;
    let entregasTardeCount = 0;

    reportProjects.forEach(p => {
      let firstDeliveryStr = p.client_standby_periods?.[0]?.start || null;
      if (!firstDeliveryStr) {
        const standbyComments = p.comentarios?.filter(c => c.isSystemEvent && c.text?.includes('puesta en Standby')) || [];
        if (standbyComments.length > 0) {
          firstDeliveryStr = standbyComments[standbyComments.length - 1].createdAt;
        }
      }

      if (firstDeliveryStr && p.fecha_entrega) {
        const actionTime = new Date(firstDeliveryStr);
        const deadlineDateStr = p.fecha_entrega.includes('T') ? p.fecha_entrega.split('T')[0] : p.fecha_entrega;
        const deadline = new Date(`${deadlineDateStr}T23:59:59`);
        if (actionTime <= deadline) {
          entregasATiempoCount++;
        } else {
          entregasTardeCount++;
        }
      }
    });

    const execName = activeExecId === 'all' ? 'Toda la Agencia' :
                     activeExecId === 'unassigned' ? 'Sin Asignar' :
                     accountsUsers.find(u => u.id === activeExecId)?.name || 'Cuentas';

    const rangeName = activeRange === 'day' ? 'Hoy' :
                      activeRange === 'week' ? 'Última Semana' :
                      activeRange === 'month' ? 'Último Mes' :
                      activeRange === 'year' ? 'Último Año' : 'Todo el Tiempo';

    const brandName = activeClientId === 'all' ? 'Todas las marcas' :
                      selectedClientObjects.find(c => c.id === activeClientId)?.name || 'Marca específica';

    const escapeCsvValue = (val: string | number | boolean | null | undefined) => {
      const str = val === null || val === undefined ? '' : String(val);
      // UTF-8 CSV formatting: double quotes around text and double double-quotes to escape quotes
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows: string[] = [];

    // Título y filtros aplicados
    csvRows.push(`${escapeCsvValue('REPORTE DE GESTIÓN DE CUENTAS')},`);
    csvRows.push(`${escapeCsvValue('Fecha de Generación:')},${escapeCsvValue(new Date().toLocaleDateString('es-MX') + ' ' + new Date().toLocaleTimeString('es-MX'))}`);
    csvRows.push(`${escapeCsvValue('Rango de Tiempo de ODTs:')},${escapeCsvValue(rangeName)}`);
    csvRows.push(`${escapeCsvValue('Ejecutivo de Cuentas:')},${escapeCsvValue(execName)}`);
    csvRows.push(`${escapeCsvValue('Marca / Cliente:')},${escapeCsvValue(brandName)}`);
    if (searchTerm.trim()) {
      csvRows.push(`${escapeCsvValue('Filtro de Búsqueda Activo:')},${escapeCsvValue(searchTerm)}`);
    }
    csvRows.push('');

    // Resumen de Métricas
    csvRows.push(`${escapeCsvValue('RESUMEN DE MÉTRICAS DE CUENTA (KPIs)')},,`);
    csvRows.push(`${escapeCsvValue('Métrica')},${escapeCsvValue('Valor')},${escapeCsvValue('Descripción')}`);
    
    csvRows.push(`${escapeCsvValue('Valor Operativo (Igualas Contratadas)')},${escapeCsvValue(`$ ${totalIgualasVal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`)},${escapeCsvValue('Suma de igualas fijas de marcas incluidas en esta selección')}`);
    csvRows.push(`${escapeCsvValue('Valor Operativo (Extra s/Iguala)')},${escapeCsvValue(`$ ${totalExtrasVal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`)},${escapeCsvValue('Monto acumulado de proyectos extraordinarios activos en este rango')}`);
    csvRows.push(`${escapeCsvValue('Total ODTs Creadas')},${escapeCsvValue(totalCreatedCount)},${escapeCsvValue('Volumen total de proyectos iniciados en el período')}`);
    csvRows.push(`${escapeCsvValue('ODTs Activas de Cuenta')},${escapeCsvValue(activeODTsCount)},${escapeCsvValue('Proyectos actualmente en fase de desarrollo o revisión')}`);
    csvRows.push(`${escapeCsvValue('En Revisión con Cliente / Standby')},${escapeCsvValue(enRevisionCount)},${escapeCsvValue('Proyectos temporalmente congelados en espera de feedback o aprobación del cliente')}`);
    csvRows.push(`${escapeCsvValue('ODTs Activas En Tiempo')},${escapeCsvValue(enTiempoCount)},${escapeCsvValue('Proyectos en desarrollo cuyo SLA prometido no ha vencido')}`);
    csvRows.push(`${escapeCsvValue('ODTs Activas Con Retraso')},${escapeCsvValue(conRetrasoCount)},${escapeCsvValue('Proyectos activos que ya superaron su fecha de entrega prometida')}`);
    csvRows.push(`${escapeCsvValue('Primer Envío Hecho A Tiempo (SLA)')},${escapeCsvValue(entregasATiempoCount)},${escapeCsvValue('Proyectos con primer envío realizado antes o durante la fecha límite')}`);
    csvRows.push(`${escapeCsvValue('Primer Envío Hecho Tarde (SLA)')},${escapeCsvValue(entregasTardeCount)},${escapeCsvValue('Proyectos con primer envío realizado posterior a la fecha pactada')}`);
    
    csvRows.push('');

    // Detalle de ODTs
    csvRows.push(`${escapeCsvValue('DETALLE COMPLETO DE ODTs FILTRADAS')},,,,,,,,`);
    
    const headers = [
      'ID ODT', 'Cliente / Empresa', 'Marca', 'Producto', 
      'Fecha Creación', 'Fecha Entrega Prometida', 'Estatus', 'Tipo Cargo', 'Monto Proyectado (MXN)', 'SLA Primer Envío'
    ];
    
    csvRows.push(headers.map(escapeCsvValue).join(','));

    reportProjects.forEach(p => {
      let slaStatus = 'Sin Envío registrado';
      let firstDeliveryStr = p.client_standby_periods?.[0]?.start || null;
      if (!firstDeliveryStr) {
        const standbyComments = p.comentarios?.filter(c => c.isSystemEvent && c.text?.includes('puesta en Standby')) || [];
        if (standbyComments.length > 0) {
          firstDeliveryStr = standbyComments[standbyComments.length - 1].createdAt;
        }
      }
      if (firstDeliveryStr && p.fecha_entrega) {
        const actionTime = new Date(firstDeliveryStr);
        const deadlineDateStr = p.fecha_entrega.includes('T') ? p.fecha_entrega.split('T')[0] : p.fecha_entrega;
        const deadline = new Date(`${deadlineDateStr}T23:59:59`);
        slaStatus = actionTime <= deadline ? 'Entregado a Tiempo' : 'Entregado Tarde';
      }

      const row = [
        p.id || '',
        p.empresa || '',
        p.marca || '',
        p.producto || '',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-MX') : '',
        p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString('es-MX') : 'S/Fecha',
        p.status || '',
        p.tipoCargo === 'extra' ? 'Extra' : 'Iguala',
        p.monto_proyectado || 0,
        slaStatus
      ];
      
      csvRows.push(row.map(escapeCsvValue).join(','));
    });

    const csvContent = csvRows.join('\n');

    // Excel UTF-8 BOM injection for absolute compatibility with accents and special characters
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const formattedExecName = execName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Reporte_Metricas_Cuentas_${formattedExecName}_${new Date().toISOString().split('T')[0]}`;
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Filtrar ejecutivos de cuentas
  const accountsUsers = useMemo(() => {
    return (users || []).filter(u => {
      const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles?.includes(role));
      if (hasRole(u, UserRole.Admin)) return false;
      return u.role === UserRole.Cuentas_Opera || u.role === UserRole.Cuentas_Lider;
    });
  }, [users]);

  // 2. Filtrar marcas según el ejecutivo de cuentas seleccionado
  const filteredClientsForExecutive = useMemo(() => {
    if (!clients) return [];
    if (selectedExecutiveId === 'all') {
      return clients;
    }
    if (selectedExecutiveId === 'unassigned') {
      return clients.filter(c => !c.assignedExecutives || c.assignedExecutives.length === 0);
    }
    return clients.filter(c => c.assignedExecutives?.includes(selectedExecutiveId));
  }, [clients, selectedExecutiveId]);

  // 3. Filtrar proyectos (ODTs) que pertenecen a los clientes seleccionados, al rango y al ejecutivo
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    // Helper de filtrado por fecha
    const isWithinPeriod = (createdAt: string) => {
      if (timeRange === 'all') return true;
      const createdDate = new Date(createdAt);
      const now = new Date();
      const cutoff = new Date();
      if (timeRange === 'day') {
        cutoff.setHours(0, 0, 0, 0);
        return createdDate.getTime() >= cutoff.getTime();
      } else if (timeRange === 'week') {
        cutoff.setDate(now.getDate() - 7);
        return createdDate.getTime() >= cutoff.getTime();
      } else if (timeRange === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
        return createdDate.getTime() >= cutoff.getTime();
      } else if (timeRange === 'year') {
        cutoff.setFullYear(now.getFullYear() - 1);
        return createdDate.getTime() >= cutoff.getTime();
      }
      return true;
    };

    // Proyectos no eliminados
    let base = projects.filter(p => !p.deleted);

    // Filtrar por Marca/Cliente seleccionado
    if (selectedClientId !== 'all') {
      base = base.filter(p => p.clientId === selectedClientId);
    } else {
      // Si no hay una marca específica seleccionada, filtramos por los clientes del ejecutivo
      const validClientIds = filteredClientsForExecutive.map(c => c.id);
      base = base.filter(p => p.clientId && validClientIds.includes(p.clientId));
    }

    // Filtrar por período de tiempo (basado en la fecha de creación del proyecto)
    base = base.filter(p => p.createdAt && isWithinPeriod(p.createdAt));

    // Filtrar por término de búsqueda (ID, nombre, marca)
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase().trim();
      base = base.filter(p => 
        p.id?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q) ||
        p.empresa?.toLowerCase().includes(q) ||
        p.producto?.toLowerCase().includes(q)
      );
    }

    return base;
  }, [projects, selectedClientId, filteredClientsForExecutive, timeRange, searchTerm]);

  // Contar carpetas asociadas con cada ejecutivo para las pestañas
  const executiveFolderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!clients) return counts;
    clients.forEach(c => {
      c.assignedExecutives?.forEach(execId => {
        counts[execId] = (counts[execId] || 0) + 1;
      });
    });
    return counts;
  }, [clients]);

  const unassignedCount = useMemo(() => {
    if (!clients) return 0;
    return clients.filter(c => !c.assignedExecutives || c.assignedExecutives.length === 0).length;
  }, [clients]);

  // Cálculos de métricas de control y financieros de cuentas consolidando los proyectos resultantes
  const accountsMetrics = useMemo(() => {
    // 1. Métricas Financieras y de Carga
    // Igualas Mensuales sumamos los montos de los clientes que están en el filtro actual
    let targetClients = filteredClientsForExecutive;
    if (selectedClientId !== 'all') {
      targetClients = filteredClientsForExecutive.filter(c => c.id === selectedClientId);
    }
    const totalIgualasVal = targetClients.reduce((sum, c) => sum + (c.montoIgualaMensual || 0), 0);

    // Extras sumamos el monto de proyectos extras que caen bajo este filtro y período
    const totalExtrasVal = filteredProjects
      .filter(p => p.tipoCargo === 'extra' && p.status !== 'Cancelado')
      .reduce((sum, p) => sum + (p.monto_proyectado || 0), 0);

    const totalCreatedCount = filteredProjects.length;
    const activeODTsCount = filteredProjects.filter(p => p.status !== 'Finalizado' && p.status !== 'Cancelado').length;

    // 2. Fila de Estados de Control de cara al cliente
    const enRevisionCount = filteredProjects.filter(p => p.status === 'En revisión con cliente' || p.enStandby).length;

    const todayStr = new Date().toISOString().split('T')[0];

    const enTiempoCount = filteredProjects.filter(p => {
      const isActive = p.status !== 'Finalizado' && p.status !== 'Cancelado';
      const isNotWithClient = p.status !== 'En revisión con cliente' && !p.enStandby;
      if (!isActive || !isNotWithClient) return false;
      if (!p.fecha_entrega) return true; // sin fecha estimada se asume en tiempo
      return p.fecha_entrega >= todayStr;
    }).length;

    const conRetrasoCount = filteredProjects.filter(p => {
      const isActive = p.status !== 'Finalizado' && p.status !== 'Cancelado';
      const isNotWithClient = p.status !== 'En revisión con cliente' && !p.enStandby;
      if (!isActive || !isNotWithClient) return false;
      if (!p.fecha_entrega) return false;
      return p.fecha_entrega < todayStr;
    }).length;

    // Entregas Exitosas a Tiempo
    let entregasATiempoCount = 0;
    let entregasTardeCount = 0;

    filteredProjects.forEach(p => {
      let firstDeliveryStr = p.client_standby_periods?.[0]?.start || null;
      if (!firstDeliveryStr) {
        const standbyComments = p.comentarios?.filter(c => c.isSystemEvent && c.text?.includes('puesta en Standby')) || [];
        if (standbyComments.length > 0) {
          firstDeliveryStr = standbyComments[standbyComments.length - 1].createdAt;
        }
      }

      if (firstDeliveryStr && p.fecha_entrega) {
        const actionTime = new Date(firstDeliveryStr);
        const deadlineDateStr = p.fecha_entrega.includes('T') ? p.fecha_entrega.split('T')[0] : p.fecha_entrega;
        const deadline = new Date(`${deadlineDateStr}T23:59:59`);
        if (actionTime <= deadline) {
          entregasATiempoCount++;
        } else {
          entregasTardeCount++;
        }
      }
    });

    return {
      totalIgualasVal,
      totalExtrasVal,
      totalCreatedCount,
      activeODTsCount,
      enRevisionCount,
      enTiempoCount,
      conRetrasoCount,
      entregasATiempoCount,
      entregasTardeCount
    };
  }, [filteredProjects, filteredClientsForExecutive, selectedClientId]);

  // Al cambiar ejecutivo, reiniciamos filtro de cliente para evitar inconsistencias
  const handleExecutiveChange = (execId: string) => {
    setSelectedExecutiveId(execId);
    setSelectedClientId('all');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="w-8 h-8 rounded-2xl bg-apc-pink/10 text-apc-pink flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            Métricas de Cuentas
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            KPIs de gestión, rentabilidad, volumen operativo y cumplimiento de SLA de cara al cliente.
          </p>
        </div>

        {/* Controles de Rango de fecha y Exportación */}
        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          {/* Selector de Rango de Tiempo (Filtro por día, semana, mes, año, todo) */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40 w-fit shadow-sm">
            {(['day', 'week', 'month', 'year', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  timeRange === range
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {range === 'day' ? 'Hoy' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : range === 'year' ? 'Año' : 'Todo'}
              </button>
            ))}
          </div>

          {/* Botón Descargar Reporte Excel */}
          <button
            onClick={openDownloadModal}
            className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-600/10 active:scale-95 duration-150 cursor-pointer"
            title="Descargar Reporte Excel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel Reporte
          </button>

          {/* Botón de Análisis de IA */}
          <button
            onClick={handleRunAIAnalysis}
            disabled={isAnalyzing}
            className="h-11 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-indigo-600/10 active:scale-95 duration-150 cursor-pointer"
            title="Generar Diagnóstico Operativo con IA"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analizando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Analizar con IA
              </>
            )}
          </button>
        </div>
      </header>

      {/* Pestañas por Ejecutivo de Cuentas */}
      <div className="flex flex-col gap-3 p-1">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-slate-100 text-slate-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ejecutivo de Cuentas:</h2>
        </div>
        
        <div className="flex flex-wrap gap-2 text-slate-900">
          {/* Botón de Todos */}
          <button
            onClick={() => handleExecutiveChange('all')}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm ${
              selectedExecutiveId === 'all'
                ? 'bg-slate-900 text-white shadow-slate-900/10'
                : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
            }`}
          >
            <span>TODOS</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] ${
              selectedExecutiveId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {clients?.length || 0}
            </span>
          </button>

          {/* Un botón por ejecutivo */}
          {accountsUsers.map(exec => {
            const count = executiveFolderCounts[exec.id] || 0;
            const isSelected = selectedExecutiveId === exec.id;
            return (
              <button
                key={exec.id}
                onClick={() => handleExecutiveChange(exec.id)}
                className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm ${
                  isSelected
                    ? 'bg-apc-pink text-white shadow-md shadow-apc-pink/20'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
                }`}
              >
                <span>{exec.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Botón para Sin Asignar (si hay alguno) */}
          {unassignedCount > 0 && (
            <button
              onClick={() => handleExecutiveChange('unassigned')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm ${
                selectedExecutiveId === 'unassigned'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/60'
              }`}
            >
              <span>SIN ASIGNAR</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                selectedExecutiveId === 'unassigned' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {unassignedCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* FILTROS SECUNDARIOS: Selector de Marca / Cliente y Caja de Búsqueda */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 flex flex-col md:flex-row items-center gap-4 shadow-sm">
        {/* Selector de Cliente/Marca */}
        <div className="w-full md:w-1/2 flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Folder className="w-3 h-3 text-slate-400" />
            Filtrar Marca o Cliente:
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full h-11 px-4 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-apc-pink/15 focus:border-apc-pink transition-all"
          >
            <option value="all">TODAS LAS MARCAS / CLIENTES</option>
            {filteredClientsForExecutive.map(client => (
              <option key={client.id} value={client.id}>
                {client.name.toUpperCase()} {client.montoIgualaMensual ? `($${client.montoIgualaMensual.toLocaleString('es-MX')} MXN)` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Caja de búsqueda por ODT */}
        <div className="w-full md:w-1/2 flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Search className="w-3 h-3 text-slate-400" />
            Buscar ODT o Producto:
          </label>
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Ej: ODT-1025, Nombre marca, Banner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-apc-pink/15 focus:border-apc-pink transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
        </div>
      </div>

      {/* PANEL DE MÉTRICAS */}
      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/40 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-apc-pink animate-pulse"></span>
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Métricas de Rendimiento y Control
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {selectedExecutiveId === 'all' 
                  ? 'Vista Consolidada (Toda la Agencia)' 
                  : selectedExecutiveId === 'unassigned'
                  ? 'Carpetas Sin Ejecutivo'
                  : `Ejecutivo: ${accountsUsers.find(u => u.id === selectedExecutiveId)?.name || 'Cuentas'}`}
                {selectedClientId !== 'all' && ` • Marca: ${filteredClientsForExecutive.find(c => c.id === selectedClientId)?.name.toUpperCase()}`}
              </p>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200/40 w-fit shadow-sm">
            Filtrados: {filteredProjects.length} ODTs en total
          </div>
        </div>

        {/* Fila Superior (Métricas Financieras y de Carga) - Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Valor Operativo (Igualas) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor Operativo (Igualas)</span>
                <span className="p-1 px-1.5 bg-sky-50 text-sky-600 rounded-lg text-[9px] font-black uppercase">
                  CONTRATADO
                </span>
              </div>
              <p className="text-xl font-black text-slate-950 mt-2 tracking-tight">
                ${accountsMetrics.totalIgualasVal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-medium text-slate-400">MXN</span>
              </p>
            </div>
            <p className="text-[10px] font-medium text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              Valor mensual fijo pactado
            </p>
          </div>

          {/* Card 2: Valor Operativo (Extras) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor Operativo (Extras)</span>
                <span className="p-1 px-1.5 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase">
                  EXTRA S/IGUALA
                </span>
              </div>
              <p className="text-xl font-black text-slate-950 mt-2 tracking-tight">
                ${accountsMetrics.totalExtrasVal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-medium text-slate-400">MXN</span>
              </p>
            </div>
            <p className="text-[10px] font-medium text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Proyectos extraordinarios en período
            </p>
          </div>

          {/* Card 3: ODTs Creadas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ODTs Creadas</span>
                <span className="p-1 px-1.5 bg-slate-100 text-slate-700 rounded-lg text-[9px] font-mono font-black uppercase">
                  PERÍODO
                </span>
              </div>
              <p className="text-3xl font-black text-slate-950 mt-2 tracking-tight">
                {accountsMetrics.totalCreatedCount} <span className="text-xs font-normal text-slate-400">creadas</span>
              </p>
            </div>
            <p className="text-[10px] font-medium text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
              Ingresadas en rango elegido
            </p>
          </div>

          {/* Card 4: ODTs Activas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ODTs Activas</span>
                <span className="p-1 px-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase">
                  VIVAS
                </span>
              </div>
              <p className="text-3xl font-black text-slate-950 mt-2 tracking-tight">
                {accountsMetrics.activeODTsCount} <span className="text-xs font-normal text-slate-400">activas</span>
              </p>
            </div>
            <p className="text-[10px] font-medium text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              En desarrollo o con cliente ahora
            </p>
          </div>
        </div>

        {/* Fila de Estados de Control - Compact Panel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              Flujo de Entrega y Control con Cliente
            </h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Control Item 1: En Revisión con Cliente */}
            <div className="flex items-center gap-4 p-2 lg:p-0 lg:pl-4 first:pl-0">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 animate-fadeIn">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2} />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-black text-purple-600 tracking-tight">
                  {accountsMetrics.enRevisionCount}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                  En Revisión Cliente
                </p>
                <p className="text-[9px] text-slate-450">Bajo Standby activo</p>
              </div>
            </div>

            {/* Control Item 2: En Tiempo */}
            <div className="flex items-center gap-4 p-2 lg:p-0 lg:pl-4">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2} />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-black text-blue-600 tracking-tight">
                  {accountsMetrics.enTiempoCount}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                  En Tiempo
                </p>
                <p className="text-[9px] text-slate-450">Interno dentro de SLA</p>
              </div>
            </div>

            {/* Control Item 3: Con Retraso */}
            <div className="flex items-center gap-4 p-2 lg:p-0 lg:pl-4">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-black text-amber-600 tracking-tight border-none outline-none">
                  {accountsMetrics.conRetrasoCount}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                  Con Retraso
                </p>
                <p className="text-[9px] text-slate-450">SLA de entrega excedido</p>
              </div>
            </div>

            {/* Control Item 4: Entregas Exitosas a Tiempo */}
            <div className="flex items-center gap-4 p-2 lg:p-0 lg:pl-4 text-slate-900">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-black text-emerald-600 tracking-tight flex items-baseline gap-1">
                  {accountsMetrics.entregasATiempoCount}
                  {accountsMetrics.entregasTardeCount > 0 && (
                    <span className="text-[10px] font-black text-rose-500">
                      / {accountsMetrics.entregasTardeCount} tarde
                    </span>
                  )}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                  Entregas a Tiempo
                </p>
                <p className="text-[9px] text-slate-450">Primer envío (Cumplida / Tarde)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE INLINE REPORT/ANALYSIS IA */}
      {(isAnalyzing || aiReportText) && (
        <div ref={reportRef} className="mt-6 bg-white rounded-3xl border border-slate-200/60 shadow-md overflow-hidden animate-fadeIn">
          {/* Cabecera de la Sección */}
          <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-sm">
                <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-850 uppercase tracking-wider">
                  Análisis Directivo IA & Plan de Acción
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Auditoría inteligente del ejecutivo seleccionado bajo el estándar de calidad ISO 9001:2015
                </p>
              </div>
            </div>
            
            {/* Acciones si ya está el reporte listo */}
            {!isAnalyzing && aiReportText && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 duration-150 cursor-pointer shadow-sm"
                  title="Descargar Reporte en PDF Listo para Imprimir"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF Reporte
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aiReportText);
                    alert('¡Reporte copiado al portapapeles con éxito!');
                  }}
                  className="px-4 h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 duration-150 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copiar Texto
                </button>
                <button
                  onClick={() => setAiReportText('')}
                  className="px-3.5 h-10 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  title="Cerrar Reporte"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>

          {/* Contenido principal */}
          <div className="p-8">
            {isAnalyzing ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                  <div className="w-14 h-14 rounded-full border border-dashed border-indigo-200 absolute inset-0 animate-pulse"></div>
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider leading-none">
                    Generando Diagnóstico Operativo con IA...
                  </h4>
                  <p className="text-[10px] text-slate-450 font-bold uppercase tracking-widest mt-2 max-w-sm mx-auto leading-relaxed">
                    Evaluando entregas históricas, porcentajes de cumplimiento de SLA, valor operativo y plan de mitigación continuo de la ODT.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Contexto del Reporte en Inline */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100 pb-5">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/40">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ejecutivo de Cuentas</p>
                    <p className="text-xs font-bold text-slate-800 mt-1 uppercase">
                      {selectedExecutiveId === 'all' ? 'Toda la Agencia' :
                       selectedExecutiveId === 'unassigned' ? 'Sin Asignar' :
                       users.find(u => u.id === selectedExecutiveId)?.name || 'Cuentas'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/40">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Periodo de Análisis</p>
                    <p className="text-xs font-bold text-slate-800 mt-1 uppercase text-ellipsis overflow-hidden">
                      {timeRange === 'day' ? 'Hoy' : timeRange === 'week' ? 'Última Semana' : timeRange === 'month' ? 'Último Mes' : timeRange === 'year' ? 'Último Año' : 'Todo el Tiempo'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/40">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marcas Evaluadas</p>
                    <p className="text-xs font-bold text-slate-800 mt-1 uppercase truncate">
                      {selectedClientId === 'all' ? 'Todas las asignadas' :
                       clients?.find(c => c.id === selectedClientId)?.name || 'Marca específica'}
                    </p>
                  </div>
                </div>

                {/* Contenido Markdown Renderizado */}
                <div className="markdown-body prose max-w-none text-slate-700 leading-relaxed space-y-4">
                  <Markdown
                    components={{
                      h1: ({ children }) => <h1 className="text-base font-black text-slate-900 border-b border-indigo-100 pb-2 mt-6 mb-3 flex items-center gap-2 uppercase tracking-wide">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-black text-indigo-900 mt-5 mb-2.5 uppercase tracking-wide">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mt-4 mb-2 bg-indigo-50/60 p-3 rounded-2xl border-l-[3.5px] border-indigo-600 flex items-center gap-2">{children}</h3>,
                      p: ({ children }) => <p className="text-slate-600 text-[11px] leading-relaxed mb-3.5 font-medium">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mt-1 space-y-1.5 text-[11px] text-slate-600 mb-4">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mt-1 space-y-1.5 text-[11px] text-slate-600 mb-4">{children}</ol>,
                      li: ({ children }) => <li className="text-slate-600 font-medium tracking-normal">{children}</li>,
                      blockquote: ({ children }) => <blockquote className="border-l-[3.5px] border-amber-500 bg-amber-50/40 py-2.5 px-4 rounded-r-2xl italic text-slate-650 text-[11px] mb-4">{children}</blockquote>,
                      table: ({ children }) => <div className="overflow-x-auto rounded-2xl border border-slate-200/60 my-4"><table className="min-w-full divide-y divide-slate-200">{children}</table></div>,
                      thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
                      tbody: ({ children }) => <tbody className="bg-white divide-y divide-slate-200">{children}</tbody>,
                      tr: ({ children }) => <tr>{children}</tr>,
                      th: ({ children }) => <th className="px-3 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">{children}</th>,
                      td: ({ children }) => <td className="px-3 py-2 text-slate-600 text-[10px] font-medium whitespace-nowrap">{children}</td>,
                    }}
                  >
                    {aiReportText}
                  </Markdown>
                </div>

                {/* Pie Final de Recomendaciones */}
                <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Recomendaciones dinámicas asistidas por Gemini
                  </span>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Auditoría continua • ISO 9001:2015
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Opciones de Descarga */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/50 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-slideUp">
            
            {/* Cabecera del Modal */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Configurar Descarga Excel
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Elige los filtros que se exportarán en tu reporte
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsDownloadModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/50 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido / Filtros */}
            <div className="p-6 space-y-4">
              {/* Rango de tiempo */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Rango de Tiempo (Creación de ODT):
                </label>
                <select
                  value={downloadRange}
                  onChange={(e) => setDownloadRange(e.target.value as 'day' | 'week' | 'month' | 'year' | 'all')}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-apc-pink/15 focus:border-apc-pink transition-all"
                >
                  <option value="day">HOY (DESDE LAS 00:00 HRS)</option>
                  <option value="week">ÚLTIMA SEMANA (últimos 7 días)</option>
                  <option value="month">ÚLTIMO MES (últimos 30 días)</option>
                  <option value="year">ÚLTIMO AÑO (últimos 365 días)</option>
                  <option value="all">TODO EL TIEMPO HISTÓRICO</option>
                </select>
              </div>

              {/* Ejecutivo de Cuentas */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Ejecutivo de Cuentas:
                </label>
                <select
                  value={downloadExecId}
                  onChange={(e) => handleModalExecutiveChange(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-apc-pink/15 focus:border-apc-pink transition-all"
                >
                  <option value="all">TODOS LOS EJECUTIVOS DE LA AGENCIA</option>
                  {accountsUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
                  ))}
                  {unassignedCount > 0 && <option value="unassigned">CARPETAS SIN EJECUTIVO ASIGNADO</option>}
                </select>
              </div>

              {/* Marca o Cliente */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Marca o Cliente:
                </label>
                <select
                  value={downloadClientId}
                  onChange={(e) => setDownloadClientId(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-apc-pink/15 focus:border-apc-pink transition-all"
                >
                  <option value="all">TODAS LAS MARCAS DEL EJECUTIVO SELECCIONADO</option>
                  {modalClientsList.map(c => (
                    <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Nota de ayuda */}
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-[11px] font-medium text-slate-500 space-y-1">
                <p className="font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider text-[10px] mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Estructura del Reporte de Excel:
                </p>
                <p>1. Cabecera informativa y filtro de búsqueda de ODT.</p>
                <p>2. Tabla de KPIs consolidados del ejecutivo y tasas de cumplimiento de SLA.</p>
                <p>3. Desglose pormenorizado de ODTs con montos y cumplimiento de SLA individuales.</p>
              </div>
            </div>

            {/* Pie de Modal */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="px-4.5 h-11 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-500 uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleDownloadExcel(downloadRange, downloadExecId, downloadClientId);
                  setIsDownloadModalOpen(false);
                }}
                className="px-6 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-600/10 active:scale-95 duration-150"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generar Excel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
