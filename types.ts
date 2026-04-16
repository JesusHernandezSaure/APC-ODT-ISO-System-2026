
export enum UserRole {
  Admin = 'Admin',
  Cuentas_Lider = 'Cuentas_Lider',
  Cuentas_Opera = 'Cuentas_Opera',
  Lider_Operativo = 'Lider_Operativo',
  Operativo = 'Operativo',
  Correccion = 'Correccion',
  QA_Opera = 'QA_Opera',
  Medico_Lider = 'Medico_Lider',
  Medico_Opera = 'Medico_Opera',
  Finanzas = 'Finanzas',
  Administracion_Lider = 'Administracion_Lider',
  Administracion_Opera = 'Administracion_Opera'
}

export interface User {
  id: string; 
  name: string;
  username: string;
  password?: string;
  department: string;
  role: UserRole;
  roles?: UserRole[];
  active: boolean;
  createdAt?: string;
}

export interface ProjectComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  isSystemEvent?: boolean;
}

export interface ProjectAssignment {
  area: string;
  usuarioIds: string[];
  usuarioId?: string; // Legacy field for backward compatibility
  status: 'pendiente' | 'en_progreso' | 'completado';
}

export interface Material {
  id: string;
  nombre: string;
  tipo: string;
  redSocial: string;
  estado: 'Pendiente Arte' | 'En Arte' | 'Pendiente Corrección' | 'En Corrección' | 'Pendiente OK Cliente' | 'Aprobado/Publicado';
  creadoPor: string;
  fechaCreacion: string;
}

export interface Project {
  id: string;
  clientId: string;
  empresa: string;
  marca: string;
  producto: string;
  etapa_actual: string;
  category: string;
  subCategory: string;
  referenceLinks: string[];
  status: 'Borrador' | 'En Proceso' | 'Correcciones' | 'QA' | 'Finalizado' | 'Cancelado';
  correccion_ok: boolean;
  areas_seleccionadas: string[];
  asignaciones: ProjectAssignment[];
  tracking: unknown[];
  comentarios: ProjectComment[];
  materiales?: Material[];
  monto_proyectado: number;
  brief: string;
  facturado?: boolean;
  pagado?: boolean;
  justificacion_no_facturado?: string;
  assignedExecutives?: string[];
  createdAt: string;
  updatedAt: string;
  fecha_entrega?: string;
  fecha_finalizado?: string;
  current_stage_index: number;
  last_delivery_link?: string;
  last_delivery_comment?: string;
  delivery_history?: { link: string; comment: string; area: string; date: string; authorId: string; authorName: string }[];
  // Campaign Mode fields
  esCampana?: boolean;
  detalleEntregableCampaña?: string;
  estadoPorArea?: Record<string, 'En Proceso' | 'En QA' | 'Aprobado QA' | 'Rechazado QA'>;
  client_standby_periods?: { start: string; end?: string }[];
  // New quality control fields
  accounts_approval_ok?: boolean;
  presentation_link?: string;
  presentation_version?: string;
  presentation_date?: string;
  client_feedback?: 'approved' | 'approved_with_corrections' | 'rejected';
  correction_count_after_presentation?: number;
  client_rejection_count?: number;
  is_alarm_active?: boolean;
  internal_qa_rejection_count?: number;
  contadorCorrecciones?: number;
  enStandby?: boolean;
  deleted?: boolean;
  deletedBy?: string;
  deletedByName?: string;
  deletedAt?: string;
  deletionReason?: string;
  cierreAnticipado?: {
    motivo: string;
    explicacion?: string;
    linkEvidencia: string;
    fecha: string;
    usuarioUID: string;
  };
  qaChecklist?: {
    medica: boolean;
    estilo: boolean;
    referencias: boolean;
    medicaTimestamp?: string;
    estiloTimestamp?: string;
    referenciasTimestamp?: string;
    medicaUserId?: string;
    estiloUserId?: string;
    referenciasUserId?: string;
  };
}

export interface Client {
  id: string;
  name: string;
  notes?: string;
  assignedExecutives?: string[];
  createdAt: string;
}

export type ViewState = 
  | 'login' 
  | 'dashboard' 
  | 'leader-dashboard' 
  | 'my-projects' 
  | 'clients' 
  | 'users' 
  | 'qa-box' 
  | 'finances' 
  | 'project-detail'
  | 'calendar'
  | 'auditor'
  | 'commercial-intelligence'
  | 'medical-manual'
  | 'deleted-projects';

export interface LoginResult {
  success: boolean;
  error?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'new_odt' | 'assignment' | 'sla_alert' | 'system';
  projectId?: string;
  read: boolean;
  createdAt: string;
}

export interface ODTContextType {
  user: User | null;
  projects: Project[];
  deletedProjects: Project[];
  clients: Client[];
  users: User[];
  notifications: Notification[];
  loading: boolean;
  isInitialLoad: boolean;
  isLoggingIn: boolean;
  isAlertsOpen: boolean;
  setIsAlertsOpen: (open: boolean) => void;
  login: (username: string, pass: string) => Promise<LoginResult>;
  logout: () => void;
  updateProjectStatus: (projectId: string, newStatus: Project['status'], comment: string) => Promise<void>;
  updateBrief: (projectId: string, content: string) => Promise<void>;
  processQA: (projectId: string, approved: boolean, feedback: string) => Promise<string | void>;
  processAccountsReview: (projectId: string, approved: boolean, feedback: string, returnToArea?: string, selectedAreas?: string[]) => Promise<void>;
  submitForPresentation: (projectId: string, link: string, version: string) => Promise<void>;
  processClientFeedback: (projectId: string, result: 'approved' | 'approved_with_corrections' | 'rejected', feedback: string, returnToArea?: string, selectedAreas?: string[]) => Promise<void>;
  updateBilling: (projectId: string, facturado: boolean, justification?: string) => Promise<void>;
  updatePaymentStatus: (projectId: string, pagado: boolean) => Promise<void>;
  checkSLA: (project: Project) => { isAlert: boolean; reason?: string };
  delegateProject: (projectId: string, area: string, userIds: string[]) => Promise<void>;
  reassignProjectAndFolder: (projectId: string, clientId: string, newExecutives: string[], portfolio?: boolean) => Promise<void>;
  addClient: (name: string, notes?: string) => Promise<void>;
  updateClient: (clientId: string, data: Partial<Client>) => Promise<void>;
  removeClient: (clientId: string) => Promise<void>;
  addProject: (project: Partial<Project>) => Promise<void>;
  addTraceabilityComment: (projectId: string, text: string) => Promise<void>;
  updateQAChecklist: (projectId: string, item: 'medica' | 'estilo' | 'referencias', value: boolean) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
  manageUser: (userData: Partial<User>) => Promise<void>;
  toggleUserStatus: (userId: string, active: boolean) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  advanceProjectStage: (projectId: string, comment: string) => Promise<void>;
  updateAreaStatus: (projectId: string, area: string, newStatus: 'En Proceso' | 'En QA' | 'Aprobado QA' | 'Rechazado QA', comment?: string) => Promise<void>;
  toggleClientStandby: (projectId: string, active: boolean) => Promise<void>;
  getRoadmapStages: (project: Project) => string[];
  addMaterial: (projectId: string, material: Omit<Material, 'id' | 'creadoPor' | 'fechaCreacion'>) => Promise<void>;
  updateMaterialStatus: (projectId: string, materialId: string, newStatus: Material['estado']) => Promise<void>;
  updateProjectDate: (projectId: string, newDate: string) => Promise<void>;
  updateProjectId: (oldId: string, newId: string) => Promise<void>;
  updateProjectAreas: (projectId: string, newAreas: string[]) => Promise<void>;
  fastTrackProject: (projectId: string, destinationStage: string, justification: string) => Promise<void>;
  earlyCloseProject: (projectId: string, data: { motivo: string; explicacion?: string; linkEvidencia: string }) => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}
