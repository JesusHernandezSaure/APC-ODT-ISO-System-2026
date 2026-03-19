
export const OPERATIVE_AREAS = [
  'Médico',
  'Creativo',
  'Arte',
  'Audio y Video',
  'Digital',
  'Tráfico',
  'Innovación'
] as const;

export const GLOBAL_STAGES = {
  START: 'CUENTAS (Gestión)',
  CLOSING: 'CUENTAS (Cierre)',
  BILLING: 'ADMINISTRACIÓN (Facturación)'
} as const;

export const CATEGORIES_CONFIG: Record<string, string[]> = {
  'Digital': [
    'ayuda visual', 'Mailing', 'WhatsApp', 'Vídeo', 'GIF', 'EBOOK', 
    'Curso flipbook', 'Presentación (PPT)', 'Podcast', 
    'Animación digital (Video)', 'Infografía', 'Blog', 'Otro'
  ],
  'Impreso': [
    'Folleto', 'Infografía', 'Díptico', 'Tríptico', 'Brochure', 
    'Especial con suaje', 'Cuaderno', 'Agenda', 'Hoja membretada', 
    'Manual de capacitación', 'Manual de objeciones', 'Guía de estudio', 
    'Revista', 'Póster', 'Flyer', 'Otro'
  ],
  'Evento': [
    'Kick off', 'Convención', 'Congreso', 'Lanzamiento', 
    'Evento médico', 'Capacitación fuerza de ventas', 'Webinar', 'Otro'
  ],
  'Parrilla': [
    'Parrilla de contenido (Redes sociales)', 'Otro'
  ]
};

export const SUPPORT_DEPARTMENTS = [
  'QA',
  'Administración',
  'Sistemas'
] as const;

/**
 * Calcula la ruta completa de una ODT basándose en las áreas seleccionadas.
 */
export const calculateRoadmap = (selectedAreas: string[] = []) => {
  // Fix: Explicitly type the array as string[] to allow multiple stage names
  const stages: string[] = [GLOBAL_STAGES.START];
  
  selectedAreas.forEach(area => {
    stages.push(area);
    stages.push(`REVISIÓN QA (${area})`);
  });
  
  stages.push(GLOBAL_STAGES.CLOSING);
  stages.push(GLOBAL_STAGES.BILLING);
  
  return stages;
};

/**
 * Normaliza una cadena eliminando acentos, convirtiendo a minúsculas y quitando espacios.
 */
export const normalizeString = (str: string) => {
  if (!str) return '';
  let normalized = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  // Mapeo de áreas antiguas o alias
  if (normalized === 'medical content') return 'medico';
  return normalized;
};

/**
 * Calcula la prioridad de una ODT basándose en la fecha de entrega.
 */
export const getPriorityInfo = (fechaEntrega?: string) => {
  if (!fechaEntrega) return { color: 'bg-slate-200', text: 'N/A', level: 0, iconColor: 'text-slate-300', textColor: 'text-slate-400', shape: 'circle' };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(fechaEntrega + 'T00:00:00');
  delivery.setHours(0, 0, 0, 0);
  
  const diffTime = delivery.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 3) {
    return { color: 'bg-apc-green', text: 'Normal', level: 0, iconColor: 'text-apc-green', textColor: 'text-apc-green', shape: 'circle' };
  } else if (diffDays === 3) {
    return { color: 'bg-apc-teal', text: 'Nivel 1', level: 1, iconColor: 'text-apc-teal', textColor: 'text-apc-teal', shape: 'rhombus' };
  } else if (diffDays === 2) {
    return { color: 'bg-apc-pink', text: 'Nivel 2', level: 2, iconColor: 'text-apc-pink', textColor: 'text-apc-pink', shape: 'rhombus' };
  } else if (diffDays === 1) {
    return { color: 'bg-rose-500', text: 'Nivel 3', level: 3, iconColor: 'text-rose-500', textColor: 'text-rose-500', shape: 'rhombus' };
  } else if (diffDays <= 0) {
    // Vencida - use red for overdue
    return { color: 'bg-rose-600', text: 'Vencida', level: 4, iconColor: 'text-rose-600', textColor: 'text-rose-600', shape: 'rhombus' };
  }
  
  return { color: 'bg-slate-200', text: 'N/A', level: 0, iconColor: 'text-slate-300', textColor: 'text-slate-400', shape: 'circle' };
};
