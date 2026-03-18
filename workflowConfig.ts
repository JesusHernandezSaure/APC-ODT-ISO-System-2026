
export const OPERATIVE_AREAS = [
  'Creativo',
  'Medical MKT',
  'Medical Content',
  'Diseño',
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
  'DIGITAL': ['Veeva', 'Mailing', 'Landing Page', 'Display Ads', 'App Mobile', 'E-commerce'],
  'IMPRESO': ['Folleto', 'Brochure', 'Panel / Gigantografía', 'Stand', 'Merchandising'],
  'EVENTO': ['Kick-off', 'Convención', 'Congreso', 'Lanzamiento'],
  'PARRILLA RRSS': ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube']
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
