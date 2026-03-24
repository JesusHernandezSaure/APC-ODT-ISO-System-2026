
import { Project, User } from './types';
import { normalizeString } from './workflowConfig';

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
    const isFelipeAssigned = assignments.some(a => a.usuarioId === felipe?.id);
    
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
      'Integrantes': assignments.map(a => users.find(u => u.id === a.usuarioId)?.name || 'Desconocido').join(', '),
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
