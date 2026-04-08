
import { Project, User } from './types';
import { normalizeString, OPERATIVE_AREAS } from './workflowConfig';

/**
 * Analyzes the workflow of an ODT based on its system logs (comments).
 */
export const analyzeODTWorkflow = (project: Project) => {
  const areaMetrics: Record<string, { days: number; internalRejections: number; clientRejections: number }> = {};
  
  OPERATIVE_AREAS.forEach(area => {
    areaMetrics[area] = { days: 0, internalRejections: 0, clientRejections: 0 };
  });

  if (!project.comentarios) return areaMetrics;

  // Sort comments by date ascending to replay the history
  const logs = [...project.comentarios]
    .filter(c => c.isSystemEvent)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let currentArea: string | null = null;
  let entryTime: Date | null = null;

  // Initial state is usually CUENTAS (Gestión), but we only care about operative areas
  // The first operative area entry is usually when it's advanced from CUENTAS (Gestión)
  
  logs.forEach((log, index) => {
    const logText = log.text;
    const logDate = new Date(log.createdAt);

    // 1. Detect Area Entry
    // Pattern: "Enviado a [Area]" or "Regresando a [Area]"
    const entryMatch = logText.match(/(?:Enviado a|Regresando a) \[([^\]]+)\]/);
    if (entryMatch) {
      const newArea = entryMatch[1];
      
      // If we were in an operative area, calculate time spent
      if (currentArea && entryTime && (OPERATIVE_AREAS as readonly string[]).includes(currentArea)) {
        const diffDays = (logDate.getTime() - entryTime.getTime()) / (1000 * 60 * 60 * 24);
        areaMetrics[currentArea].days += Math.max(0, diffDays);
      }

      // Update current area
      if ((OPERATIVE_AREAS as readonly string[]).includes(newArea)) {
        currentArea = newArea;
        entryTime = logDate;
      } else {
        currentArea = null;
        entryTime = null;
      }
    }

    // 2. Detect Internal Rejections (QA)
    // Pattern: "RECHAZADO en [REVISIÓN QA (Area)] ... Regresando a [Area]"
    if (logText.includes('RECHAZADO en [REVISIÓN QA')) {
      const returnMatch = logText.match(/Regresando a \[([^\]]+)\]/);
      if (returnMatch) {
        const targetArea = returnMatch[1];
        if ((OPERATIVE_AREAS as readonly string[]).includes(targetArea)) {
          areaMetrics[targetArea].internalRejections++;
        }
      }
    }

    // 3. Detect Client Rejections
    // Pattern: "CLIENTE: RECHAZADA" or "CLIENTE: Recibe CON correcciones" ... Regresando a [Area]
    if (logText.includes('CLIENTE:') && (logText.includes('RECHAZADA') || logText.includes('CON correcciones'))) {
      const returnMatch = logText.match(/Regresando a \[([^\]]+)\]/);
      if (returnMatch) {
        const targetArea = returnMatch[1];
        if ((OPERATIVE_AREAS as readonly string[]).includes(targetArea)) {
          areaMetrics[targetArea].clientRejections++;
        }
      }
    }
    
    // Special case: If it's the last log and we are still in an area, calculate time until now (or finished date)
    if (index === logs.length - 1 && currentArea && entryTime && (OPERATIVE_AREAS as readonly string[]).includes(currentArea)) {
      const endTime = project.fecha_finalizado ? new Date(project.fecha_finalizado) : new Date();
      const diffDays = (endTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60 * 24);
      areaMetrics[currentArea].days += Math.max(0, diffDays);
    }
  });

  return areaMetrics;
};

export const generateMasterReport = (projects: Project[], users: User[], dateFrom?: string, dateTo?: string) => {
  let filtered = [...projects];
  
  if (dateFrom) {
    const from = new Date(dateFrom);
    filtered = filtered.filter(p => new Date(p.createdAt) >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo + 'T23:59:59');
    filtered = filtered.filter(p => new Date(p.createdAt) <= to);
  }

  const rows: Record<string, string | number>[] = [];

  filtered.forEach(p => {
    const metrics = analyzeODTWorkflow(p);
    
    const row: Record<string, string | number> = {
      'ODT ID': p.id,
      'Cliente': p.empresa,
      'Marca': p.marca,
      'Producto': p.producto,
      'Categoría': p.category,
      'Subcategoría': p.subCategory,
      'Status Final': p.status,
      'Monto Proyectado': p.monto_proyectado || 0,
      'Facturado': p.facturado ? 'SÍ' : 'NO',
      'Pagado': p.pagado ? 'SÍ' : 'NO',
      'Fecha Creación': p.createdAt,
      'Fecha Entrega Prometida': p.fecha_entrega || 'N/A',
      'Fecha Real de Cierre': p.fecha_finalizado || 'N/A',
    };

    let totalDays = 0;
    let totalInternalRework = 0;
    let totalClientRework = 0;
    let maxDays = -1;
    let bottleneck = 'N/A';

    OPERATIVE_AREAS.forEach(area => {
      const m = metrics[area];
      row[`Días invertidos en ${area}`] = Number(m.days.toFixed(2));
      row[`Rechazos Internos (QA) en ${area}`] = m.internalRejections;
      row[`Rechazos de Cliente en ${area}`] = m.clientRejections;

      totalDays += m.days;
      totalInternalRework += m.internalRejections;
      totalClientRework += m.clientRejections;

      if (m.days > maxDays) {
        maxDays = m.days;
        bottleneck = area;
      }
    });

    // Executive Analysis
    row['Total Días Invertidos'] = Number(totalDays.toFixed(2));
    row['Total Retrabajo Interno'] = totalInternalRework;
    row['Total Retrabajo Cliente'] = totalClientRework;

    if (p.fecha_entrega && p.fecha_finalizado) {
      const promised = new Date(p.fecha_entrega + 'T00:00:00');
      const actual = new Date(p.fecha_finalizado);
      const diffTime = actual.getTime() - promised.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      row['Días de Retraso'] = diffDays;
    } else {
      row['Días de Retraso'] = 'N/A';
    }

    row['Área Cuello de Botella'] = totalDays > 0 ? bottleneck : 'N/A';

    rows.push(row);
  });

  return rows;
};

/**
 * Downloads a CSV file with UTF-8 BOM for Excel compatibility.
 */
export const downloadMasterCSV = (data: Record<string, string | number>[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  // UTF-8 BOM
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Calculates working hours between two dates considering specific schedules.
 * @param start Start date
 * @param end End date
 * @param isFelipe Special schedule for Felipe López (7 PM to 5 AM)
 */
export const calculateWorkingTime = (start: Date, end: Date, isFelipe: boolean = false) => {
  if (start > end) return { days: 0, hours: 0, totalHours: 0 };

  const dailyWorkHours = 10;

  let totalMinutes = 0;
  const current = new Date(start);

  while (current < end) {
    const currentHour = current.getHours();
    
    let isWorkingHour = false;
    if (isFelipe) {
      // 7 PM (19) to 5 AM (5)
      isWorkingHour = currentHour >= 19 || currentHour < 5;
    } else {
      // 8 AM (8) to 6 PM (18)
      isWorkingHour = currentHour >= 8 && currentHour < 18;
    }

    if (isWorkingHour) {
      totalMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  const totalHours = totalMinutes / 60;
  const days = Math.floor(totalHours / dailyWorkHours);
  const remainingHours = totalHours % dailyWorkHours;

  return {
    days,
    hours: Math.round(remainingHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100
  };
};

export const generateAreaReport = (projects: Project[], users: User[], area: string) => {
  const areaNorm = normalizeString(area);
  const areaProjects = projects.filter(p => 
    p.areas_seleccionadas?.some(a => normalizeString(a) === areaNorm)
  );

  const rows: Record<string, string | number>[] = [];

  areaProjects.forEach(p => {
    const assignments = p.asignaciones?.filter(a => normalizeString(a.area) === areaNorm) || [];
    const internalRejections = p.internal_qa_rejection_count || p.contadorCorrecciones || 0;
    
    // Time calculation
    const start = new Date(p.createdAt);
    const end = p.fecha_finalizado ? new Date(p.fecha_finalizado) : new Date();
    
    // Check if Felipe is assigned
    const felipe = users.find(u => u.name.toLowerCase().includes('felipe lópez'));
    const isFelipeAssigned = assignments.some(a => a.usuarioIds?.includes(felipe?.id || '') || a.usuarioId === felipe?.id);
    
    const time = calculateWorkingTime(start, end, isFelipeAssigned);

    // Extract QA entry time from comments
    const qaEntryComment = p.comentarios?.find(c => c.isSystemEvent && c.text.toUpperCase().includes('REVISIÓN QA'));
    const qaExitComment = p.comentarios?.find(c => c.isSystemEvent && c.text.toUpperCase().includes('APROBADO en [REVISIÓN QA]'));
    
    let qaTime = { totalHours: 0 };
    if (qaEntryComment && qaExitComment) {
      qaTime = calculateWorkingTime(new Date(qaEntryComment.createdAt), new Date(qaExitComment.createdAt), isFelipeAssigned);
    } else if (qaEntryComment) {
      qaTime = calculateWorkingTime(new Date(qaEntryComment.createdAt), new Date(), isFelipeAssigned);
    }

    const row: Record<string, string | number> = {
      'ID ODT': p.id,
      'Empresa': p.empresa,
      'Marca': p.marca,
      'Área': area,
      'Estado': p.status,
      'Integrantes': assignments.map(a => {
        const assignedUsers = users.filter(u => a.usuarioIds?.includes(u.id) || a.usuarioId === u.id);
        return assignedUsers.map(u => u.name).join(', ');
      }).join(' | '),
      'Rechazos QA Interno': internalRejections,
      'Rechazos Cliente': p.client_rejection_count || 0,
      'Tiempo Realización (Días)': time.days,
      'Tiempo Realización (Horas)': time.hours,
      'Total Horas Laborales': time.totalHours,
      'Tiempo en QA (Horas)': qaTime.totalHours,
      'Fecha Creación': p.createdAt,
      'Fecha Finalización': p.fecha_finalizado || 'En curso'
    };

    // Medical specific fields
    if (areaNorm === 'médico' || areaNorm === 'médica' || areaNorm === 'qa') {
      const checklist = p.qaChecklist;
      if (checklist) {
        row['Check Médico'] = checklist.medica ? 'SÍ' : 'NO';
        row['Check Médico Por'] = users.find(u => u.id === checklist.medicaUserId)?.name || '';
        row['Check Médico Fecha'] = checklist.medicaTimestamp || '';
        
        row['Check Estilo'] = checklist.estilo ? 'SÍ' : 'NO';
        row['Check Estilo Por'] = users.find(u => u.id === checklist.estiloUserId)?.name || '';
        row['Check Estilo Fecha'] = checklist.estiloTimestamp || '';
        
        row['Check Referencias'] = checklist.referencias ? 'SÍ' : 'NO';
        row['Check Referencias Por'] = users.find(u => u.id === checklist.referenciasUserId)?.name || '';
        row['Check Referencias Fecha'] = checklist.referenciasTimestamp || '';

        // Calculate time between checks if available
        if (checklist.medicaTimestamp && checklist.estiloTimestamp) {
            const t = calculateWorkingTime(new Date(checklist.medicaTimestamp), new Date(checklist.estiloTimestamp), isFelipeAssigned);
            row['Tiempo Médico -> Estilo (Horas)'] = t.totalHours;
        }
        if (checklist.estiloTimestamp && checklist.referenciasTimestamp) {
            const t = calculateWorkingTime(new Date(checklist.estiloTimestamp), new Date(checklist.referenciasTimestamp), isFelipeAssigned);
            row['Tiempo Estilo -> Referencias (Horas)'] = t.totalHours;
        }
      }
    }

    rows.push(row);
  });

  return rows;
};

export const downloadCSV = (data: Record<string, string | number>[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : row[header];
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Fixes oklch color functions in a cloned document for html2canvas compatibility.
 * Tailwind v4 uses oklch by default, which html2canvas cannot parse.
 */
export const fixOklchForHtml2Canvas = (clonedDoc: Document) => {
  const elements = Array.from(clonedDoc.getElementsByTagName('*')) as HTMLElement[];
  elements.forEach(el => {
    try {
      const computedStyle = window.getComputedStyle(el);
      const props = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'fill', 'stroke'];
      
      props.forEach(prop => {
        const value = computedStyle[prop as keyof CSSStyleDeclaration] as string;
        if (value && value.includes('oklch')) {
          el.style[prop as keyof CSSStyleDeclaration] = prop.toLowerCase().includes('background') ? '#ffffff' : '#000000';
        } else if (value) {
          el.style[prop as keyof CSSStyleDeclaration] = value;
        }
      });
    } catch {
      // Skip elements that can't be processed
    }
  });

  // Sanitize stylesheets to prevent parser errors
  const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
  styleTags.forEach(style => {
    try {
      if (style.innerHTML.includes('oklch')) {
        style.innerHTML = style.innerHTML.replace(/oklch\([^)]+\)/g, '#000000');
      }
    } catch {
      // Skip styles that can't be processed
    }
  });
};
