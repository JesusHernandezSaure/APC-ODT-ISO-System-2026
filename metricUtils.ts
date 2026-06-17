import { Project, ProjectComment } from './types';

// Centralizamos el cálculo de métricas para optimizar descargas de Firebase
export const computeProjectMetrics = (project: Project): Partial<Project> => {
  const comments = project.comentarios || [];
  
  // 1. QA Rejections
  const qaRejections = comments.filter((c: ProjectComment) => 
    c.isSystemEvent && c.text?.includes("RECHAZADO en [REVISIÓN QA")
  ).length;

  // 2. Standbys
  const standbys = comments.filter((c: ProjectComment) => 
    c.isSystemEvent && c.text?.includes('puesta en Standby')
  ).length;

  // 3. Approvals
  const approvals = comments.filter((c: ProjectComment) => 
    c.isSystemEvent && c.text?.includes("APROBADO")
  ).length;

  // 4. Advancements
  const advancements = comments.filter((c: ProjectComment) => 
    c.isSystemEvent && c.text?.includes("Enviado a [")
  ).length;

  // 5. Area Rejections
  const areaRejections: Record<string, number> = {};
  comments.forEach(c => {
    if (c.isSystemEvent && c.text?.includes("RECHAZADO en [")) {
      const match = c.text.match(/RECHAZADO en \[([^\]]+)\]/);
      if (match && match[1]) {
        const area = match[1];
        areaRejections[area] = (areaRejections[area] || 0) + 1;
      }
    }
  });

  // 6. Has Client Link
  const hasClientLink = !!project.presentation_link || comments.some(c => c.text?.includes('PRESENTACIÓN PARA CLIENTE'));

  // 7. Last comment
  const sortedComments = [...comments].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastComment = sortedComments[0];

  // 8. Retrabajo real
  const retrabajoReal = qaRejections; 

  // 9. QA Entry/Exit
  const qaEntryComment = comments.find((c: ProjectComment) => c.isSystemEvent && c.text?.toUpperCase()?.includes('REVISIÓN QA'));
  const qaExitComment = comments.find((c: ProjectComment) => c.isSystemEvent && c.text?.toUpperCase()?.includes('APROBADO EN [REVISIÓN QA]'));
  const qaEntry = !!qaEntryComment;
  const qaExit = !!qaExitComment;

  const standbyDatesArray = comments.filter((c: ProjectComment) => c.isSystemEvent && c.text?.includes('puesta en Standby')).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    metric_qaRejections: qaRejections,
    metric_standbys: standbys,
    metric_approvals: approvals,
    metric_advancements: advancements,
    metric_areaRejections: areaRejections,
    metric_hasClientLink: hasClientLink,
    metric_lastComment: lastComment,
    metric_retrabajoReal: retrabajoReal,
    metric_qaEntry: qaEntry,
    metric_qaExit: qaExit,
    metric_firstDeliveryDate: standbyDatesArray.length > 0 ? standbyDatesArray[0].createdAt : undefined,
    metric_qaEntryDate: qaEntryComment ? qaEntryComment.createdAt : undefined,
    metric_qaExitDate: qaExitComment ? qaExitComment.createdAt : undefined
  };
};
