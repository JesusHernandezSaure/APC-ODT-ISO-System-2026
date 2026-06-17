
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ref, onValue, update, get, set, query, orderByChild, equalTo, limitToLast } from "firebase/database";
import { db } from './firebase';
import { Project, User, ODTContextType, UserRole, LoginResult, Client, Material, Notification as ProjectNotification, ProjectComment } from './types';
import { GLOBAL_STAGES, calculateRoadmap, normalizeString } from './workflowConfig';
import { computeProjectMetrics } from './metricUtils';

const ODTContext = createContext<ODTContextType | undefined>(undefined);

// .... Later inside ODTProvider:


const escapeFirebaseKey = (key: string) => key.toLowerCase().trim().replace(/[.#$/[\]]/g, '_');

export const ODTProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedSession = localStorage.getItem('apc_session');
    if (savedSession) {
      try {
        return JSON.parse(savedSession);
      } catch (e) {
        console.error("Error al recuperar sesión", e);
        return null;
      }
    }
    return null;
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<ProjectNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  const notificationAudio = useRef<HTMLAudioElement | null>(null);
  const processedNotifications = useRef<Set<string>>(new Set());
  const hasInitializedNotifications = useRef(false);

  useEffect(() => {
    notificationAudio.current = new Audio('/notification.mp3');
  }, []);

  useEffect(() => {
    if (user && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, [user]);

  const triggerNativeNotification = (notif: ProjectNotification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('APC System: ' + notif.title, {
        body: notif.message,
        icon: '/logo.png'
      });
      
      n.onclick = () => {
        window.focus();
        setIsAlertsOpen(true);
      };
      
      if (notificationAudio.current) {
        notificationAudio.current.currentTime = 0;
        notificationAudio.current.play().catch(e => console.warn("Audio playback blocked or failed:", e));
      }
    }
  };

  useEffect(() => {
    // 1. Si no hay usuario logueado, liberamos AMBOS estados de carga
    // para que App.tsx pueda mostrar el formulario de Login.
    if (!user?.id) {
      const timer = setTimeout(() => {
        setLoading(false);
        setIsInitialLoad(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Arreglo para guardar las funciones que apagan los listeners
    const activeListeners: (() => void)[] = [];
    
    // Evaluamos el rol del usuario
    const isClientPortal = user.rolPrincipal === 'Cliente Agency Hub (Portal)';

    if (isClientPortal) {
      // ─── BLOQUE A: LÓGICA PARA CLIENTES (AISLAMIENTO TOTAL) ───
      const marcas = user.marcasAsignadas || [];

      // Si es cliente pero no tiene marcas, vaciamos la lista y terminamos
      if (marcas.length === 0) {
        setTimeout(() => setProjects([]), 0);
      } else {
        // Objeto temporal para ir guardando las ODTs de cada marca sin sobreescribirse
        const resultadosPorMarca: Record<string, Project[]> = {};

        marcas.forEach((marcaId) => {
          const q = query(ref(db, 'projects'), orderByChild('clientId'), equalTo(marcaId));
          
          const unsub = onValue(q, (snapshot) => {
            const items: Project[] = [];
            
            // CRÍTICO: Usamos forEach para NO PERDER el ID de Firebase
            snapshot.forEach((childSnapshot) => {
              items.push({ 
                id: childSnapshot.key as string, // Aquí rescatamos el ID único
                ...childSnapshot.val() 
              });
            });

            // Guardamos los resultados de esta marca específica
            resultadosPorMarca[marcaId] = items;
            
            // Aplanamos todas las marcas en un solo arreglo y actualizamos React
            setProjects(Object.values(resultadosPorMarca).flat());
            
          }, (error) => {
            console.error(`Error al cargar ODTs de la marca ${marcaId}:`, error);
          });

          activeListeners.push(unsub);
        });
      }
    } else {
      // ─── BLOQUE B: LÓGICA PARA STAFF (DIETA DE BASURA) ───
      // Para asegurar que el staff vea sus datos hoy, descargamos la colección,
      // pero filtramos los "eliminados" de forma segura sin depender de equalTo(false).

      const unsub = onValue(ref(db, 'projects'), (snapshot) => {
        const items: Project[] = [];
        const deletedItems: Project[] = [];

        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          const proj = {
            id: childSnapshot.key as string,
            ...data
          };

          // Solo agregamos la ODT si NO está marcada como eliminada
          if (!data.deleted) {
            items.push(proj);
          } else {
            deletedItems.push(proj);
          }
        });

        setProjects(items);
        setDeletedProjects(deletedItems);

      }, (error) => {
        // Si la carga de proyectos falla, liberamos el loading para no bloquear la UI
        console.error("Error al cargar ODTs del Staff:", error);
        setLoading(false);
        setIsInitialLoad(false);
      });

      activeListeners.push(unsub);
    }

    // ─── CARGA ÚNICA: Usuarios y Clientes (sin listener continuo) ───
    // Se descargan una sola vez al iniciar sesión. No necesitan tiempo real
    // porque estos catálogos cambian raramente y no afectan el flujo de trabajo diario.
    get(ref(db, 'users')).then((s) => {
      const d = s.val();
      setUsers(d ? Object.keys(d).map(k => ({ ...d[k], id: k })) : []);
    }).catch(e => console.error("Error cargando usuarios:", e));

    get(ref(db, 'clients')).then((s) => {
      const d = s.val();
      setClients(d ? Object.keys(d).map(k => ({ ...d[k], id: k })) : []);
    }).catch(e => console.error("Error cargando clientes:", e));

    // ─── NOTIFICACIONES: Estrategia diferenciada por rol ───
    // Clientes: solo sus propias notificaciones (filtrado en servidor por userId).
    // Staff: las últimas 50 notificaciones recientes (necesarias para el chequeo SLA
    //        que verifica si ya se notificó a otros usuarios antes de crear duplicados).
    const notificationsQuery = isClientPortal
      ? query(ref(db, 'notifications_v3'), orderByChild('userId'), equalTo(user.id))
      : query(ref(db, 'notifications_v3'), limitToLast(50));

    const unsubNotifs = onValue(notificationsQuery, (s) => {
      const d = s.val();
      const list: ProjectNotification[] = d ? Object.keys(d).map(k => ({ ...d[k], id: k })) : [];

      if (!hasInitializedNotifications.current) {
        list.forEach(n => processedNotifications.current.add(n.id));
        hasInitializedNotifications.current = true;
      } else {
        list.forEach(n => {
          if (n.userId === user?.id && !processedNotifications.current.has(n.id)) {
            processedNotifications.current.add(n.id);
            if (!n.read) {
              triggerNativeNotification(n);
            }
          }
        });
      }

      setNotifications(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
      setIsInitialLoad(false);

    }, (error) => {
      // Si la carga de notificaciones falla, liberamos el loading para no bloquear la UI.
      // La app puede funcionar sin notificaciones pero NO puede quedarse en la pantalla de carga.
      console.error("Error al cargar notificaciones:", error);
      setLoading(false);
      setIsInitialLoad(false);
    });
    activeListeners.push(unsubNotifs);

    // ─── BLOQUE C: CLEANUP RIGUROSO ───
    return () => {
      // Apagamos TODOS los listeners al cambiar de usuario o desmontar
      activeListeners.forEach(unsub => unsub());
    };
    
  }, [user]); // Dependencia clave: el objeto usuario completo para detectar cambios de marcas o roles

  // Real-time listener for CURRENT logged-in user to ensure roles are always fresh.
  // IMPORTANTE: la dependencia es solo user?.id (no el objeto user completo) para evitar
  // que cada actualización del usuario provoque una re-suscripción en cascada.
  useEffect(() => {
    if (!db || !user?.id || user.id === 'admin') return;
    
    const currentUserRef = ref(db, `users/${user.id}`);
    const unsub = onValue(currentUserRef, (s) => {
      if (s.exists()) {
        const freshData = { ...s.val(), id: user.id };
        // Usamos la forma funcional de setUser para comparar con el estado actual
        // sin necesitar 'user' como dependencia del efecto (evita el loop).
        setUser(prev => {
          if (JSON.stringify(freshData) !== JSON.stringify(prev)) {
            localStorage.setItem('apc_session', JSON.stringify(freshData));
            return freshData;
          }
          return prev;
        });
      }
    });
    
    return () => unsub();
  }, [user?.id]); // Solo el ID: el listener solo se recrea cuando cambia de usuario (login/logout)

  const getRoadmapStages = (project: Project) => {
    return calculateRoadmap(project.areas_seleccionadas || []);
  };

  const login = async (username: string, pass: string): Promise<LoginResult> => {
    const cleanUsername = username.toLowerCase().trim();
    const dbKey = escapeFirebaseKey(cleanUsername);
    setIsLoggingIn(true);
    
    if (cleanUsername === 'admin' && pass === 'admin') {
      const adminBypass: User = { id: 'admin', name: 'Admin Bypass', username: 'admin', department: 'Sistemas', role: UserRole.Admin, active: true, roles: [UserRole.Admin] };
      setUser(adminBypass);
      localStorage.setItem('apc_session', JSON.stringify(adminBypass));
      setIsLoggingIn(false);
      return { success: true };
    }
    try {
      const userRef = ref(db, `users/${dbKey}`);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        setIsLoggingIn(false);
        return { success: false, error: `Usuario no encontrado.` };
      }
      const userData = snapshot.val();
      if (!userData.active) {
        setIsLoggingIn(false);
        return { success: false, error: 'Cuenta inactiva.' };
      }
      if (userData.password !== pass) {
        setIsLoggingIn(false);
        return { success: false, error: 'Contraseña incorrecta.' };
      }
      
      // Force fresh data and ensure roles array exists
      const authUser: User = { 
        ...userData, 
        id: dbKey,
        roles: userData.roles || [userData.role]
      };
      
      setUser(authUser);
      localStorage.setItem('apc_session', JSON.stringify(authUser));
      setIsLoggingIn(false);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      setIsLoggingIn(false);
      return { success: false, error: 'Error de conexión.' };
    }
  };

  const logout = () => { 
    setUser(null); 
    localStorage.removeItem('apc_session'); 
    processedNotifications.current.clear();
    hasInitializedNotifications.current = false;
  };

  const createNotification = async (notif: Omit<ProjectNotification, 'id' | 'read' | 'createdAt'>) => {
    if (!db) return;
    const id = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newNotif: ProjectNotification = {
      ...notif,
      id,
      read: false,
      createdAt: new Date().toISOString()
    };
    await set(ref(db, `notifications_v3/${id}`), newNotif);
  };

  const updateProjectInDB = async (projectId: string, incomingUpdates: any) => {
    if (!db) return;
    const projectToUpdate = projects.find(p => p.id === projectId) || deletedProjects.find(p => p.id === projectId);
    const updates = { ...incomingUpdates };

    // Si hay actualizaciones de comentarios, asegurar que recuperamos el historial completo
    if (updates.comentarios !== undefined) {
      let existingComments: any[] = [];
      try {
        const snap = await get(ref(db, `project_details/${projectId}/comentarios`));
        if (snap.exists()) {
          existingComments = snap.val() || [];
        }
      } catch (e) {
        console.error("Error fetching existing comments", e);
      }
      
      const providedComments = Array.isArray(updates.comentarios) ? updates.comentarios : [];
      const allComments = [...providedComments, ...existingComments];
      
      const seenIds = new Set();
      const mergedComments = [];
      for (const cmd of allComments) {
         if (cmd.id && !seenIds.has(cmd.id)) {
            seenIds.add(cmd.id);
            mergedComments.push(cmd);
         } else if (!cmd.id) {
            mergedComments.push(cmd);
         }
      }
      updates.comentarios = mergedComments;
    }
    
    if (projectToUpdate && (updates.comentarios !== undefined || updates.presentation_link !== undefined || updates.status !== undefined || updates.etapa_actual !== undefined)) {
      const simulatedProject = { ...projectToUpdate, ...updates };
      const calculatedMetrics = computeProjectMetrics(simulatedProject);
      Object.entries(calculatedMetrics).forEach(([key, value]) => {
        if (value !== undefined) updates[key] = value;
      });
    }

    const rootUpdates: Record<string, any> = {};
    const hasDetails = updates.comentarios !== undefined || updates.brief !== undefined;
    
    // Split heavy fields into project_details
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'comentarios') {
        rootUpdates[`project_details/${projectId}/comentarios`] = value;
      } else if (key === 'brief') {
        rootUpdates[`project_details/${projectId}/brief`] = value;
      } else {
        rootUpdates[`projects/${projectId}/${key}`] = value;
      }
    });

    await update(ref(db), rootUpdates);
  };

  const markNotificationAsRead = async (id: string) => {
    if (!db) return;
    await update(ref(db, `notifications_v3/${id}`), { read: true });
  };

  const clearNotifications = async () => {
    if (!db || !user) return;
    const userNotifs = notifications.filter(n => n.userId === user.id);
    const updates: Record<string, unknown> = {};
    userNotifs.forEach(n => {
      updates[`notifications_v3/${n.id}`] = null;
    });
    await update(ref(db), updates);
  };

  // SLA and Priority Background Check

  // borramos el código de alerta de 3 días en el área

  const syncCalendarEvent = async (projectId: string, data: Partial<Project>) => {
    if (!db) return;
    const eventData = {
      id: projectId,
      empresa: data.empresa || "",
      fecha_entrega: data.fecha_entrega || "",
      etapa_actual: data.etapa_actual || data.etapaActual || "",
      status: data.status || "",
      deleted: !!data.deleted
    };
    await set(ref(db, `calendar_events/${projectId}`), eventData);
  };

  const addProject = async (projectData: Partial<Project>) => {
    if (!db || !user) return;
    const projectId = projectData.id;
    if (!projectId) return;
    const isCampana = projectData.category === 'Campaña';
    const estadoPorArea: Record<string, string> = {};
    if (isCampana && projectData.areas_seleccionadas) {
      projectData.areas_seleccionadas.forEach(area => {
        estadoPorArea[area] = 'En Proceso';
      });
    }

    const rootUpdates: Record<string, any> = {};
    const { brief, ...projectBase } = projectData;

    const newProject = {
      ...projectBase,
      esCampana: isCampana,
      estadoPorArea: isCampana ? estadoPorArea : null,
      status: isCampana ? 'En Proceso' : 'Borrador',
      current_stage_index: 0,
      etapa_actual: GLOBAL_STAGES.START,
      etapaActual: GLOBAL_STAGES.START,
      assignedExecutives: projectBase.assignedExecutives || [user.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      asignaciones: [],
      pagado: false,
      facturado: false
    };

    const comentarios = [
      { id: `sys-${Date.now()}`, authorId: user.id, authorName: user.name, text: isCampana ? `MODO CAMPAÑA INICIADO: Flujo en Paralelo.` : `ODT INICIADA EN ${GLOBAL_STAGES.START.toUpperCase()}`, createdAt: new Date().toISOString(), isSystemEvent: true },
      { 
        id: `brief-init-${Date.now()}`, 
        authorId: user.id, 
        authorName: user.name, 
        text: 'Brief Maestro inicial registrado', 
        createdAt: new Date().toISOString(), 
        isSystemEvent: true,
        tipo: 'BRIEF_INICIAL',
        contenidoHTML: brief || ''
      },
      ...(projectBase.referenceLinks && projectBase.referenceLinks.length > 0 ? [{
        id: `ref-${Date.now()}`,
        authorId: user.id,
        authorName: user.name,
        text: `ENLACE GENERAL DEL PROYECTO: ${projectBase.referenceLinks.join(', ')}`,
        createdAt: new Date().toISOString(),
        isSystemEvent: true
      }] : [])
    ];

    rootUpdates[`projects/${projectId}`] = newProject;
    rootUpdates[`project_details/${projectId}/brief`] = brief || '';
    rootUpdates[`project_details/${projectId}/comentarios`] = comentarios;

    await update(ref(db), rootUpdates);
    await syncCalendarEvent(projectId, newProject as Project);

    // Notificación para el líder de cuentas (si no es el mismo que crea)
    const accountsLeader = users.find(u => u.role === UserRole.Cuentas_Lider);
    if (accountsLeader && accountsLeader.id !== user.id) {
      await createNotification({
        userId: accountsLeader.id,
        title: '🆕 NUEVA ODT REGISTRADA',
        message: `Se ha creado la ODT ${projectId} para el cliente ${newProject.empresa}.`,
        type: 'new_odt',
        projectId: projectId
      });
    }
  };

  const updateFullProject = async (projectId: string, projectData: Partial<Project>) => {
    if (!db || !user) return;
    const updates = {
      ...projectData,
      updatedAt: new Date().toISOString()
    };
    await updateProjectInDB(projectId, updates);
    await syncCalendarEvent(projectId, { ...projects.find(p => p.id === projectId), ...updates });
  };

  const removeProject = async (projectId: string, reason?: string) => {
    if (!db || !user || (user.role !== UserRole.Admin && user.role !== UserRole.Cuentas_Lider)) return;
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const updates: Record<string, unknown> = {
        deleted: true,
        deletedBy: user.id,
        deletedByName: user.name,
        deletedAt: new Date().toISOString(),
        deletionReason: reason || 'Eliminado por usuario',
        updatedAt: new Date().toISOString()
      };

      await updateProjectInDB(projectId, updates);
      await syncCalendarEvent(projectId, { ...project, ...updates });
    } catch (error) {
      console.error("Error al eliminar ODT:", error);
      throw error;
    }
  };

  const restoreProject = async (projectId: string) => {
    if (!db || !user || user.role !== UserRole.Admin) return;
    try {
      const updates: Record<string, unknown> = {
        deleted: null,
        deletedBy: null,
        deletedByName: null,
        deletedAt: null,
        deletionReason: null,
        updatedAt: new Date().toISOString()
      };
      await updateProjectInDB(projectId, updates);
      const project = projects.find(p => p.id === projectId);
      await syncCalendarEvent(projectId, { ...project, ...updates });
    } catch (error) {
      console.error("Error al restaurar ODT:", error);
      throw error;
    }
  };

  const updateAreaStatus = async (projectId: string, area: string, newStatus: 'En Proceso' | 'En QA' | 'Aprobado QA' | 'Rechazado QA', comment?: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.esCampana) return;

    const newEstadoPorArea = { ...(project.estadoPorArea || {}) };
    newEstadoPorArea[area] = newStatus;

    const updates: Record<string, unknown> = {
      estadoPorArea: newEstadoPorArea,
      updatedAt: new Date().toISOString()
    };

    if (comment) {
      updates.comentarios = [{
        id: `area-${Date.now()}`,
        authorId: user.id,
        authorName: user.name,
        text: `[${area}] cambió a ${newStatus}. ${comment}`,
        createdAt: new Date().toISOString(),
        isSystemEvent: true
      }, ...(project.comentarios || [])];
    }

    // Check if all areas are approved
    const allApproved = Object.values(newEstadoPorArea).every(status => status === 'Aprobado QA');
    if (allApproved && project.status !== 'Finalizado') {
      updates.status = 'En Proceso';
      updates.etapa_actual = GLOBAL_STAGES.CLOSING;
      updates.etapaActual = GLOBAL_STAGES.CLOSING;
      const stages = getRoadmapStages(project);
      updates.current_stage_index = stages.indexOf(GLOBAL_STAGES.CLOSING);
    }

    await updateProjectInDB(projectId, updates);
  };

  const toggleClientStandby = async (projectId: string, active: boolean) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const now = new Date().toISOString();
    const periods = [...(project.client_standby_periods || [])];

    if (active) {
      periods.push({ start: now });
    } else {
      if (periods.length > 0 && !periods[periods.length - 1].end) {
        periods[periods.length - 1].end = now;
      }
    }

    const updates: Record<string, unknown> = {
      status: active ? 'En revisión con cliente' : 'En Proceso',
      enStandby: active,
      client_standby_periods: periods,
      updatedAt: now,
      comentarios: [{
        id: `standby-${Date.now()}`,
        authorId: user.id,
        authorName: user.name,
        text: active ? 'ODT puesta en Standby (Revisión Cliente). Cronómetro pausado.' : 'ODT reactivada. Cronómetro reanudado.',
        createdAt: now,
        isSystemEvent: true
      }, ...(project.comentarios || [])]
    };

    await updateProjectInDB(projectId, updates);
  };

  const advanceProjectStage = async (projectId: string, comment: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);
    const oldStage = stages[project.current_stage_index || 0];
    const newIndex = (project.current_stage_index || 0) + 1;
    const proximaArea = stages[newIndex] || 'Finalizado';
    
    const linkMatch = comment.match(/Link: (https?:\/\/[^\s|]+)/);
    const link = linkMatch ? linkMatch[1] : (project.last_delivery_link || "");
    
    let newStatus: Project['status'] = 'En Proceso';
    if (proximaArea === GLOBAL_STAGES.BILLING) newStatus = 'Pendiente de pago';
    else if (newIndex >= stages.length - 1) newStatus = 'Finalizado';
    else if (proximaArea.toUpperCase().includes('REVISIÓN QA')) newStatus = 'QA';

    const updates: Record<string, unknown> = {
      current_stage_index: newIndex,
      etapa_actual: proximaArea,
      etapaActual: proximaArea, // Sync for visibility
      status: newStatus,
      last_delivery_link: link,
      last_delivery_comment: comment,
      updatedAt: new Date().toISOString(),
      comentarios: [{ 
        id: `step-${Date.now()}`, 
        authorId: user.id, 
        authorName: user.name, 
        text: comment.includes('Entrega Técnica') ? comment : `Etapa [${oldStage}] completada. Enviado a [${proximaArea}]. Nota: ${comment}`, 
        createdAt: new Date().toISOString(), 
        isSystemEvent: true 
      }, ...(project.comentarios || [])]
    };

    if (newIndex >= stages.length - 1) {
      updates.fecha_finalizado = new Date().toISOString();
    }

    if (proximaArea === GLOBAL_STAGES.CLOSING) {
      updates.accounts_approval_ok = false;
    }
    
    await updateProjectInDB(projectId, updates);

    // Notificación para el líder de la siguiente área
    const nextArea = proximaArea;
    const nextLeader = users.find(u => {
      const userDept = normalizeString(u.department || '');
      const normalizedNextArea = normalizeString(nextArea);
      const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));
      
      if (normalizedNextArea.includes('qa')) {
        return userDept === 'qa' || hasRole(u, UserRole.Correccion) || hasRole(u, UserRole.Medico_Lider);
      }
      if (normalizedNextArea.includes('cuentas')) {
        return userDept === 'cuentas' || hasRole(u, UserRole.Cuentas_Lider);
      }
      return userDept === normalizedNextArea && (hasRole(u, UserRole.Lider_Operativo) || hasRole(u, UserRole.Correccion) || hasRole(u, UserRole.Medico_Lider));
    });

    if (nextLeader) {
      await createNotification({
        userId: nextLeader.id,
        title: '📂 NUEVA ODT EN TU ÁREA',
        message: `La ODT ${projectId} ha ingresado a la etapa de ${nextArea}.`,
        type: 'new_odt',
        projectId: projectId
      });
    }
  };

  const processQA = async (projectId: string, approved: boolean, feedback: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);
    const qaStageName = stages[project.current_stage_index || 0];

    if (approved) {
      const newIndex = (project.current_stage_index || 0) + 1;
      const proximaAreaCalculada = stages[newIndex] || GLOBAL_STAGES.CLOSING;
      
      let newStatus: Project['status'] = 'En Proceso';
      if (newIndex >= stages.length - 1) newStatus = 'Finalizado';
      else if (proximaAreaCalculada.toUpperCase().includes('REVISIÓN QA')) newStatus = 'QA';

      const updates: Record<string, unknown> = {
        current_stage_index: newIndex,
        etapa_actual: proximaAreaCalculada,
        etapaActual: proximaAreaCalculada,
        status: newStatus,
        correccion_ok: true,
        contadorCorrecciones: 0, // Reset counter when approved and moving to new area
        ultimoComentarioQA: 'Aprobado por ' + user.name + (feedback ? ': ' + feedback : ''),
        fechaAprobacionQA: new Date().toISOString(),
        delivery_history: project.last_delivery_link ? [
          { 
            link: project.last_delivery_link, 
            comment: project.last_delivery_comment || '', 
            area: stages[(project.current_stage_index || 0) - 1] || qaStageName, 
            date: new Date().toISOString(), 
            authorId: user.id, 
            authorName: user.name 
          },
          ...(project.delivery_history || [])
        ] : (project.delivery_history || []),
        updatedAt: new Date().toISOString(),
        comentarios: [{ 
          id: `qa-${Date.now()}`, 
          authorId: user.id, 
          authorName: user.name, 
          text: `APROBADO en [${qaStageName}]. Feedback: ${feedback}`, 
          createdAt: new Date().toISOString(), 
          isSystemEvent: true 
        }, ...(project.comentarios || [])]
      };

      if (proximaAreaCalculada === GLOBAL_STAGES.CLOSING) {
        updates.accounts_approval_ok = false;
      }
      
      if (newIndex >= stages.length - 1) {
        updates.fecha_finalizado = new Date().toISOString();
      }

      await updateProjectInDB(projectId, updates);

      // Notificación para el líder de la siguiente área
      const nextLeader = users.find(u => {
        const userDept = normalizeString(u.department || '');
        const normalizedNextArea = normalizeString(proximaAreaCalculada);
        const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));
        
        if (normalizedNextArea.includes('qa')) {
          return userDept === 'qa' || hasRole(u, UserRole.Correccion) || hasRole(u, UserRole.Medico_Lider);
        }
        if (normalizedNextArea.includes('cuentas')) {
          return userDept === 'cuentas' || hasRole(u, UserRole.Cuentas_Lider);
        }
        return userDept === normalizedNextArea && (hasRole(u, UserRole.Lider_Operativo) || hasRole(u, UserRole.Correccion) || hasRole(u, UserRole.Medico_Lider));
      });

      if (nextLeader) {
        await createNotification({
          userId: nextLeader.id,
          title: '✅ ODT APROBADA POR QA',
          message: `La ODT ${projectId} ha sido aprobada y enviada a tu área (${proximaAreaCalculada}).`,
          type: 'new_odt',
          projectId: projectId
        });
      }

      return proximaAreaCalculada;
    } else {
      const newIndex = project.current_stage_index - 1;
      const areaAnterior = stages[newIndex];
      const newRejectionCount = (project.contadorCorrecciones || 0) + 1;
      
      const updates: Record<string, unknown> = {
        current_stage_index: newIndex,
        etapa_actual: areaAnterior,
        etapaActual: areaAnterior,
        correccion_ok: false,
        status: 'Correcciones',
        contadorCorrecciones: newRejectionCount,
        ultimoComentarioQA: 'Rechazado por ' + user.name + ': ' + feedback,
        updatedAt: new Date().toISOString(),
        comentarios: [{ 
          id: `qa-${Date.now()}`, 
          authorId: user.id, 
          authorName: user.name, 
          text: `RECHAZADO en [${qaStageName}]. Feedback: ${feedback}. Regresando a [${areaAnterior}]. (Rechazo #${newRejectionCount})`, 
          createdAt: new Date().toISOString(), 
          isSystemEvent: true 
        }, ...(project.comentarios || [])]
      };
      await updateProjectInDB(projectId, updates);

      // Notificación al Creador/Ejecutivo (Owner)
      if (project.assignedExecutives) {
        for (const execId of project.assignedExecutives) {
          await createNotification({
            userId: execId,
            title: '⚠️ CORRECCIONES REQUERIDAS',
            message: `La ODT ${projectId} requiere correcciones en ${areaAnterior}.`,
            type: 'sla_alert',
            projectId: projectId
          });
        }
      }

      // Notificación para el responsable de la etapa anterior (quien debe corregir)
      const previousAssignment = project.asignaciones?.find(a => normalizeString(a.area) === normalizeString(areaAnterior));
      if (previousAssignment) {
        const assignedIds = previousAssignment.usuarioIds || (previousAssignment.usuarioId ? [previousAssignment.usuarioId] : []);
        for (const uid of assignedIds) {
          if (!project.assignedExecutives?.includes(uid)) {
            await createNotification({
              userId: uid,
              title: '❌ ODT RECHAZADA POR QA',
              message: `La ODT ${projectId} ha sido rechazada en QA. Feedback: ${feedback}. Por favor, realiza las correcciones.`,
              type: 'sla_alert',
              projectId: projectId
            });
          }
        }
      }

      // Notificación al Líder del Área si contadorCorrecciones >= 2
      if (newRejectionCount >= 2) {
        const areaLeader = users.find(u => {
          const userDept = normalizeString(u.department || '');
          const normalizedArea = normalizeString(areaAnterior);
          const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));

          return userDept === normalizedArea && 
            (hasRole(u, UserRole.Lider_Operativo) || hasRole(u, UserRole.Correccion) || hasRole(u, UserRole.Medico_Lider));
        });
        if (areaLeader) {
          await createNotification({
            userId: areaLeader.id,
            title: '🚨 ALERTA URGENTE: MÚLTIPLES RECHAZOS',
            message: `Atención: La ODT ${projectId} ha sido rechazada múltiples veces en el área de ${areaAnterior}.`,
            type: 'sla_alert',
            projectId: projectId
          });
        }
      }

      return areaAnterior;
    }
  };

  const delegateClientCorrections = async (projectId: string, instructions: string, returnToArea?: string, selectedAreas?: string[]) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);
    let targetArea = returnToArea || stages[project.current_stage_index - 1];

    if (project.esCampana && selectedAreas && selectedAreas.length > 0) {
      const newEstadoPorArea = { ...(project.estadoPorArea || {}) };
      selectedAreas.forEach(area => {
        newEstadoPorArea[area] = 'En Proceso';
      });
      targetArea = selectedAreas.join(', ');
      
      const updates: Record<string, unknown> = {
        estadoPorArea: newEstadoPorArea,
        status: 'Correcciones',
        etapa_actual: 'PRODUCCIÓN PARALELA',
        etapaActual: 'PRODUCCIÓN PARALELA',
        current_stage_index: 1, // Back to production phase
        accounts_approval_ok: false,
        updatedAt: new Date().toISOString(),
        comentarios: [{
          id: `del-corr-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `CUENTAS: Asignando correcciones del cliente. MODO CAMPAÑA: Rollback selectivo a [${targetArea}]. Instrucciones Cuentas: ${instructions}`,
          createdAt: new Date().toISOString(),
          isSystemEvent: true
        }, ...(project.comentarios || [])]
      };
      await updateProjectInDB(projectId, updates);
    } else {
      const targetIndex = stages.indexOf(targetArea);
      
      const updates: Record<string, unknown> = {
        current_stage_index: targetIndex,
        etapa_actual: targetArea,
        etapaActual: targetArea,
        accounts_approval_ok: false,
        status: 'Correcciones',
        updatedAt: new Date().toISOString(),
        comentarios: [{
          id: `del-corr-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `CUENTAS: Asignando correcciones del cliente. Regresando a [${targetArea}]. Instrucciones Cuentas: ${instructions}`,
          createdAt: new Date().toISOString(),
          isSystemEvent: true
        }, ...(project.comentarios || [])]
      };
      await updateProjectInDB(projectId, updates);
    }
  };
  const processAccountsReview = async (projectId: string, approved: boolean, feedback: string, returnToArea?: string, selectedAreas?: string[]) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);

    if (approved) {
      const updates: Record<string, unknown> = {
        accounts_approval_ok: true,
        updatedAt: new Date().toISOString(),
        comentarios: [{
          id: `acc-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `CUENTAS: Calidad Operativa Aprobada. Feedback: ${feedback}`,
          createdAt: new Date().toISOString(),
          isSystemEvent: true
        }, ...(project.comentarios || [])]
      };
      await updateProjectInDB(projectId, updates);
    } else {
      let targetArea = returnToArea || stages[project.current_stage_index - 1];
      
      if (project.esCampana && selectedAreas && selectedAreas.length > 0) {
        const newEstadoPorArea = { ...(project.estadoPorArea || {}) };
        selectedAreas.forEach(area => {
          newEstadoPorArea[area] = 'En Proceso';
        });
        targetArea = selectedAreas.join(', ');
        const updates: Record<string, unknown> = {
          estadoPorArea: newEstadoPorArea,
          status: 'En Proceso',
          etapa_actual: 'PRODUCCIÓN PARALELA',
          etapaActual: 'PRODUCCIÓN PARALELA',
          current_stage_index: 1,
          accounts_approval_ok: false,
          updatedAt: new Date().toISOString(),
          comentarios: [{
            id: `acc-${Date.now()}`,
            authorId: user.id,
            authorName: user.name,
            text: `CUENTAS: Calidad Rechazada. MODO CAMPAÑA: Rollback selectivo a [${targetArea}]. Instrucciones: ${feedback}`,
            createdAt: new Date().toISOString(),
            isSystemEvent: true
          }, ...(project.comentarios || [])]
        };
        await updateProjectInDB(projectId, updates);
      } else {
        const targetIndex = stages.indexOf(targetArea);
        
        const updates: Record<string, unknown> = {
          current_stage_index: targetIndex,
          etapa_actual: targetArea,
          etapaActual: targetArea,
          accounts_approval_ok: false,
          status: 'Correcciones',
          updatedAt: new Date().toISOString(),
          comentarios: [{
            id: `acc-${Date.now()}`,
            authorId: user.id,
            authorName: user.name,
            text: `CUENTAS: Calidad Rechazada. Regresando a [${targetArea}]. Instrucciones: ${feedback}`,
            createdAt: new Date().toISOString(),
            isSystemEvent: true
          }, ...(project.comentarios || [])]
        };
        await updateProjectInDB(projectId, updates);
      }

      // Notificación al Creador/Ejecutivo (Owner)
      if (project.assignedExecutives) {
        for (const execId of project.assignedExecutives) {
          await createNotification({
            userId: execId,
            title: '⚠️ CORRECCIONES REQUERIDAS (CUENTAS)',
            message: `La ODT ${projectId} requiere correcciones en ${targetArea} según revisión de Cuentas.`,
            type: 'sla_alert',
            projectId: projectId
          });
        }
      }

      const targetLeader = users.find(u => u.department === targetArea && (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider));
      if (targetLeader) {
        await createNotification({
          userId: targetLeader.id,
          title: '⚠️ CORRECCIÓN SOLICITADA POR CUENTAS',
          message: `La ODT ${projectId} ha sido devuelta a tu área por Cuentas. Instrucciones: ${feedback}`,
          type: 'sla_alert',
          projectId: projectId
        });
      }

      const assignedUser = project.asignaciones?.find(a => a.area === targetArea);
      if (assignedUser) {
        const assignedIds = assignedUser.usuarioIds || (assignedUser.usuarioId ? [assignedUser.usuarioId] : []);
        for (const uid of assignedIds) {
          if (!targetLeader || uid !== targetLeader.id) {
            await createNotification({
              userId: uid,
              title: '⚠️ CORRECCIÓN SOLICITADA POR CUENTAS',
              message: `Se han solicitado ajustes en la ODT ${projectId} para tu área (${targetArea}). Instrucciones: ${feedback}`,
              type: 'sla_alert',
              projectId: projectId
            });
          }
        }
      }
    }
  };

  const submitForPresentation = async (projectId: string, link: string, version: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const now = new Date().toISOString();
    const periods = [...(project.client_standby_periods || [])];
    periods.push({ start: now });

    const updates: Record<string, unknown> = {
      presentation_link: link,
      presentation_version: version,
      presentation_date: now,
      status: 'En revisión con cliente',
      enStandby: true,
      client_standby_periods: periods,
      updatedAt: now,
      comentarios: [
        {
          id: `status-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `Cambio de Status: En revisión con cliente (Standby activado)`,
          createdAt: now,
          isSystemEvent: true
        },
        {
          id: `pres-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `PRESENTACIÓN PARA CLIENTE: Versión ${version} subida. Link: ${link}`,
          createdAt: new Date().toISOString(),
          isSystemEvent: true
        }, 
        ...(project.comentarios || [])
      ]
    };
    await updateProjectInDB(projectId, updates);
  };

  const processClientFeedback = async (projectId: string, result: 'approved' | 'approved_with_corrections' | 'rejected', feedback: string, returnToArea?: string, selectedAreas?: string[]) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);
    const now = new Date().toISOString();
    
    // REGLA: Al procesar feedback del cliente, la ODT sale de Standby automáticamente
    const periods = [...(project.client_standby_periods || [])];
    if (periods.length > 0 && !periods[periods.length - 1].end) {
      periods[periods.length - 1].end = now;
    }

    let updates: Record<string, unknown> = {
      client_feedback: result,
      enStandby: false,
      client_standby_periods: periods,
      updatedAt: now,
    };

    let alarmTriggered = false;

    if (result === 'approved') {
      const nextIndex = (project.current_stage_index || 0) + 1;
      const nextArea = stages[nextIndex] || GLOBAL_STAGES.BILLING;
      
      updates = {
        ...updates,
        current_stage_index: nextIndex,
        etapa_actual: nextArea,
        etapaActual: nextArea,
        status: nextArea === GLOBAL_STAGES.BILLING ? 'Pendiente de pago' : (nextIndex >= stages.length - 1 ? 'Finalizado' : 'En Proceso'),
        comentarios: [{
          id: `cf-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `CLIENTE: Recibe SIN correcciones. ODT enviada a ${nextArea}.`,
          createdAt: new Date().toISOString(),
          isSystemEvent: true
        }, ...(project.comentarios || [])]
      };
      if (nextIndex >= stages.length - 1) updates.fecha_finalizado = new Date().toISOString();
    } else {
      const newCorrectionCount = (project.correction_count_after_presentation || 0) + 1;
      const newRejectionCount = (project.client_rejection_count || 0) + 1;
      
      updates.correction_count_after_presentation = newCorrectionCount;
      updates.client_rejection_count = newRejectionCount;

      if (result === 'rejected' || newCorrectionCount >= 3) {
        updates.is_alarm_active = true;
        alarmTriggered = true;
      }

      // RESPALDO HISTÓRICO Y LIMPIEZA
      if (project.presentation_link) {
        const newHistoryItem = {
          version: project.presentation_version || 'v1',
          link: project.presentation_link || '',
          date: project.presentation_date || now,
          feedback: result,
          comment: feedback
        };
        const existingHistory = project.historial_versiones || [];
        updates.historial_versiones = [...existingHistory, newHistoryItem];

        // REINICIO DE CAMPOS PRINCIPALES
        updates.presentation_link = null;
        updates.presentation_version = null;
        updates.presentation_date = null;
      }

      if (project.esCampana && selectedAreas && selectedAreas.length > 0) {
        // Selective rollback for campaign
        const newEstadoPorArea = { ...(project.estadoPorArea || {}) };
        selectedAreas.forEach(area => {
          newEstadoPorArea[area] = 'En Proceso';
        });
        const targetArea = selectedAreas.join(', ');
        updates.estadoPorArea = newEstadoPorArea;
        updates.status = 'En Proceso';
        updates.etapa_actual = 'PRODUCCIÓN PARALELA';
        updates.etapaActual = 'PRODUCCIÓN PARALELA';
        updates.current_stage_index = 1; // Back to production phase
        
        updates.comentarios = [{
          id: `cf-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `CLIENTE: ${result === 'rejected' ? 'RECHAZADA' : 'Recibe CON correcciones'}. MODO CAMPAÑA: Rollback selectivo a [${targetArea}]. Feedback: ${feedback}`,
          createdAt: new Date().toISOString(),
          isSystemEvent: true
        }, ...(project.comentarios || [])];

        const targetLeader = users.find(u => selectedAreas.includes(u.department) && (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider));
        if (targetLeader) {
          await createNotification({
            userId: targetLeader.id,
            title: alarmTriggered ? '🚨 ALARMA CRÍTICA: RECHAZO/CORRECCIÓN CLIENTE' : '⚠️ CORRECCIÓN CLIENTE',
            message: `La ODT ${projectId} requiere cambios urgentes tras presentación. Áreas: ${targetArea}. Feedback: ${feedback}`,
            type: 'sla_alert',
            projectId: projectId
          });
        }
      } else {
        const targetArea = returnToArea || stages[project.current_stage_index - 1];
        const targetIndex = stages.indexOf(targetArea);

        updates = {
          ...updates,
          current_stage_index: targetIndex,
          etapa_actual: targetArea,
          etapaActual: targetArea,
          status: 'Correcciones',
          comentarios: [{
            id: `cf-${Date.now()}`,
            authorId: user.id,
            authorName: user.name,
            text: `CLIENTE: ${result === 'rejected' ? 'RECHAZADA' : 'Recibe CON correcciones'}. Regresando a [${targetArea}]. Feedback: ${feedback}`,
            createdAt: new Date().toISOString(),
            isSystemEvent: true
          }, ...(project.comentarios || [])]
        };

        const targetLeader = users.find(u => u.department === targetArea && (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider));
        if (targetLeader) {
          await createNotification({
            userId: targetLeader.id,
            title: alarmTriggered ? '🚨 ALARMA CRÍTICA: RECHAZO/CORRECCIÓN CLIENTE' : '⚠️ CORRECCIÓN CLIENTE',
            message: `La ODT ${projectId} requiere cambios urgentes tras presentación. Área: ${targetArea}. Feedback: ${feedback}`,
            type: 'sla_alert',
            projectId: projectId
          });
        }
      }

      if (alarmTriggered) {
        const involvedUserIds = new Set<string>();
        project.asignaciones?.forEach(a => {
          if (a.usuarioIds) a.usuarioIds.forEach(uid => involvedUserIds.add(uid));
          if (a.usuarioId) involvedUserIds.add(a.usuarioId);
        });
        project.assignedExecutives?.forEach(id => involvedUserIds.add(id));
        
        for (const uid of involvedUserIds) {
          await createNotification({
            userId: uid,
            title: '🚨 ALARMA GLOBAL: FALLO EN CALIDAD',
            message: `La ODT ${projectId} ha sido rechazada o tiene múltiples correcciones. Revisión inmediata requerida.`,
            type: 'sla_alert',
            projectId: projectId
          });
        }
      }
    }

    await updateProjectInDB(projectId, updates);

    // Notificación al Creador/Ejecutivo (Owner) si entra en correcciones
    if (updates.status === 'Correcciones' && project.assignedExecutives) {
      const targetArea = (updates.etapa_actual || updates.etapaActual) as string;
      for (const execId of project.assignedExecutives) {
        await createNotification({
          userId: execId,
          title: '⚠️ CORRECCIONES REQUERIDAS (CLIENTE)',
          message: `La ODT ${projectId} requiere correcciones en ${targetArea} tras feedback del cliente.`,
          type: 'sla_alert',
          projectId: projectId
        });
      }
    }
  };

  const manageUser = async (userData: Partial<User>) => {
    if (!db || !userData.username) throw new Error("Datos incompletos.");
    const dbKey = escapeFirebaseKey(userData.username);
    const userRef = ref(db, `users/${dbKey}`);
    
    // Check if user exists to preserve createdAt or other fields if needed
    const snapshot = await get(userRef);
    const existingData = snapshot.exists() ? snapshot.val() : {};
    
    const updatedData = {
      ...existingData,
      ...userData,
      username: userData.username.toLowerCase(),
      updatedAt: new Date().toISOString()
    };

    // Explicitly overwrite roles array if provided in userData
    if (userData.roles) {
      updatedData.roles = userData.roles;
    }
    
    if (!existingData.createdAt) {
      updatedData.createdAt = new Date().toISOString();
    }
    
    await set(userRef, updatedData);
  };

  const toggleUserStatus = async (userId: string, active: boolean) => {
    if (!db) return;
    await update(ref(db, `users/${userId}`), { active });
  };

  const removeUser = async (userId: string) => {
    if (!db || !user || user.role !== UserRole.Admin) return;
    await set(ref(db, `users/${userId}`), null);
  };

  const addTraceabilityComment = async (projectId: string, text: string, tipo?: ProjectComment['tipo'], contenidoHTML?: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newComment: ProjectComment = {
      id: `comm-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      text: text,
      createdAt: new Date().toISOString(),
      isSystemEvent: !!tipo,
      tipo: tipo || 'COMENTARIO'
    };

    if (contenidoHTML !== undefined) {
      newComment.contenidoHTML = contenidoHTML;
    }

    const updates: Record<string, unknown> = {
      comentarios: [newComment, ...(project.comentarios || [])],
      updatedAt: new Date().toISOString()
    };

    await updateProjectInDB(projectId, updates);

    // Detección de menciones (@usuario)
    const mentionRegex = /@([\w.]+)/g;
    const matches = text.match(mentionRegex);
    
    if (matches) {
      const mentionedUserIds = new Set<string>();
      for (const match of matches) {
        const username = match.substring(1);
        let mentionedUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        // Manejo de punto final gramatical (ej: @jesus.apc.)
        if (!mentionedUser && username.endsWith('.')) {
          const trimmedUsername = username.slice(0, -1);
          mentionedUser = users.find(u => u.username.toLowerCase() === trimmedUsername.toLowerCase());
        }

        if (mentionedUser && mentionedUser.id !== user.id) {
          mentionedUserIds.add(mentionedUser.id);
        }
      }

      for (const userId of mentionedUserIds) {
        await createNotification({
          userId: userId,
          title: '💬 TE HAN MENCIONADO',
          message: `${user.name} te ha mencionado en la ODT ${projectId}`,
          type: 'system',
          projectId: projectId
        });
      }
    }

    // Notificación a quien dejó el último material (si no hay menciones o adicionalmente)
    const lastDelivery = project.delivery_history?.[0];
    if (lastDelivery && lastDelivery.authorId !== user.id) {
      await createNotification({
        userId: lastDelivery.authorId,
        title: '💬 NUEVO COMENTARIO EN ODT',
        message: `${user.name} ha dejado un comentario en la ODT ${projectId}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        type: 'system',
        projectId: projectId
      });
    }
  };

  const updateQAChecklist = async (projectId: string, item: 'medica' | 'estilo' | 'referencias', value: boolean) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const currentChecklist = project.qaChecklist || { medica: false, estilo: false, referencias: false };
    const newChecklist = { 
      ...currentChecklist, 
      [item]: value,
      [`${item}Timestamp`]: value ? new Date().toISOString() : null,
      [`${item}UserId`]: value ? user.id : null
    };

    const labels: Record<string, string> = {
      medica: 'Revisión Médica (Precisión científica)',
      estilo: 'Estilo y Ortografía',
      referencias: 'Calidad y Referencias'
    };

    const newComment: ProjectComment = {
      id: `qa-check-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      text: `${user.name} ha validado: ${labels[item]}`,
      createdAt: new Date().toISOString(),
      isSystemEvent: false
    };

    const updates: Record<string, unknown> = {
      qaChecklist: newChecklist,
      comentarios: [newComment, ...(project.comentarios || [])],
      updatedAt: new Date().toISOString()
    };

    await updateProjectInDB(projectId, updates);
  };

  const updateBilling = async (projectId: string, facturado: boolean, justification?: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    const newComment = {
      id: `bill-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      text: `Facturación: ${facturado ? "SÍ" : "NO"}. Nota: ${justification || 'Sin detalle'}`,
      createdAt: new Date().toISOString(),
      isSystemEvent: true
    };
    const isFinalized = facturado && (project?.pagado || false);
    await updateProjectInDB(projectId, { 
      facturado, 
      justificacion_no_facturado: justification || "", 
      status: isFinalized ? 'Finalizado' : (project?.status || 'Pendiente de pago'),
      updatedAt: new Date().toISOString(),
      comentarios: [newComment, ...(project?.comentarios || [])]
    });
  };

  const updatePaymentStatus = async (projectId: string, pagado: boolean) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    const newComment = {
      id: `pay-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      text: `Pago marcado como: ${pagado ? "PAGADO" : "PENDIENTE"}`,
      createdAt: new Date().toISOString(),
      isSystemEvent: true
    };
    const isFinalized = pagado && (project?.facturado || false);
    await updateProjectInDB(projectId, { 
      pagado, 
      status: isFinalized ? 'Finalizado' : (project?.status || 'Pendiente de pago'),
      updatedAt: new Date().toISOString(),
      comentarios: [newComment, ...(project?.comentarios || [])]
    });
  };

  const checkSLA = (project: Project) => {
    const lastUpdate = new Date(project.updatedAt || project.createdAt);
    const hours = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return { isAlert: project.status !== 'Finalizado' && hours > 72, reason: hours > 72 ? 'Estancado > 72h' : undefined };
  };

  const delegateProject = async (projectId: string, area: string, userIds: string[]) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newAsignaciones = [...(project.asignaciones || []).filter(a => a.area !== area), { area, usuarioIds: userIds, status: 'en_progreso' }];
    await updateProjectInDB(projectId, { asignaciones: newAsignaciones, updatedAt: new Date().toISOString() });

    // Notificación para los usuarios asignados
    for (const uid of userIds) {
      await createNotification({
        userId: uid,
        title: '🎯 NUEVA ASIGNACIÓN',
        message: `Se te ha asignado la ODT ${projectId} para el área de ${area}.`,
        type: 'assignment',
        projectId: projectId
      });
    }
  };

  const reassignProjectAndFolder = async (projectId: string, clientId: string, newExecutives: string[], portfolio: boolean = false) => {
    if (!db || !user) return;
    const updates: Record<string, unknown> = {};
    if (portfolio) {
      updates[`clients/${clientId}/assignedExecutives`] = newExecutives;
      projects.filter(p => p.clientId === clientId).forEach(p => {
        updates[`projects/${p.id}/assignedExecutives`] = newExecutives;
      });
    } else {
      updates[`projects/${projectId}/assignedExecutives`] = newExecutives;
    }
    await update(ref(db), updates);
  };

  const addMaterial = async (projectId: string, materialData: Omit<Material, 'id' | 'creadoPor' | 'fechaCreacion'>) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newMaterial: Material = {
      ...materialData,
      id: `mat-${Date.now()}`,
      creadoPor: user.id,
      fechaCreacion: new Date().toISOString()
    };

    const updatedMateriales = [...(project.materiales || []), newMaterial];
    await updateProjectInDB(projectId, { 
      materiales: updatedMateriales,
      updatedAt: new Date().toISOString()
    });
  };

  const updateMaterialStatus = async (projectId: string, materialId: string, newStatus: Material['estado']) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedMateriales = (project.materiales || []).map(m => 
      m.id === materialId ? { ...m, estado: newStatus } : m
    );

    const allApproved = updatedMateriales.every(m => m.estado === 'Aprobado/Publicado');
    
    const updates: Record<string, unknown> = {
      materiales: updatedMateriales,
      updatedAt: new Date().toISOString()
    };

    // If all materials are approved and it's a Parrilla, we can auto-advance or just leave it to the user.
    // The requirement says: "Una vez dado el Ok se termina la ODT principal."
    if (allApproved && updatedMateriales.length > 0 && project.category === 'PARRILLA RRSS') {
      const stages = getRoadmapStages(project);
      updates.status = 'Finalizado';
      updates.fecha_finalizado = new Date().toISOString();
      updates.current_stage_index = stages.length - 1;
      updates.etapa_actual = stages[stages.length - 1];
      updates.etapaActual = stages[stages.length - 1];
      updates.comentarios = [{
        id: `sys-${Date.now()}`,
        authorId: user.id,
        authorName: user.name,
        text: 'Todos los materiales han sido aprobados/publicados. ODT Finalizada automáticamente.',
        createdAt: new Date().toISOString(),
        isSystemEvent: true
      }, ...(project.comentarios || [])];
    }

    await updateProjectInDB(projectId, updates);
  };

  const updateProjectDate = async (projectId: string, newDate: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newComment = {
      id: `date-change-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      text: `Fecha de entrega actualizada de ${project.fecha_entrega ? new Date(project.fecha_entrega).toLocaleDateString() : 'N/A'} a ${new Date(newDate).toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      isSystemEvent: true
    };

    await updateProjectInDB(projectId, { 
      fecha_entrega: newDate,
      updatedAt: new Date().toISOString(),
      comentarios: [newComment, ...(project.comentarios || [])]
    });
    await syncCalendarEvent(projectId, { ...project, fecha_entrega: newDate });
  };

  const updateProjectId = async (oldId: string, newId: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === oldId);
    if (!project) return;

    const newDbKey = newId.trim().toUpperCase();
    if (newDbKey === oldId) return;

    // Check if newId already exists
    const existing = projects.find(p => p.id === newDbKey);
    if (existing) throw new Error("El ID de ODT ya existe.");

    const updates: Record<string, unknown> = {};
    updates[`projects/${newDbKey}`] = { ...project, id: newDbKey, updatedAt: new Date().toISOString() };
    updates[`projects/${oldId}`] = null;
    
    // Also move project_details if they exist
    const detailsSnap = await get(ref(db, `project_details/${oldId}`));
    if (detailsSnap.exists()) {
      updates[`project_details/${newDbKey}`] = detailsSnap.val();
      updates[`project_details/${oldId}`] = null;
    }

    // Update notifications that reference this project
    notifications.forEach(n => {
      if (n.projectId === oldId) {
        updates[`notifications_v3/${n.id}/projectId`] = newDbKey;
      }
    });

    await update(ref(db), updates);
  };

  const updateProjectAreas = async (projectId: string, newAreas: string[]) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newRoadmap = calculateRoadmap(newAreas);
    const currentStage = project.etapa_actual || project.etapaActual;
    
    // Find the new index for the current stage in the new roadmap
    let newIndex = newRoadmap.indexOf(currentStage);
    
    // If for some reason the current stage is not in the new roadmap (shouldn't happen with append), 
    // we default to the first stage or keep the index if within bounds
    if (newIndex === -1) {
      newIndex = project.current_stage_index;
    }

    const currentAsignaciones = project.asignaciones || [];
    const newAsignaciones = [...currentAsignaciones];
    
    newAreas.forEach(area => {
      if (!newAsignaciones.find(a => a.area === area)) {
        newAsignaciones.push({
          area,
          usuarioIds: [],
          status: 'pendiente'
        });
      }
    });

    const newComment = {
      id: `areas-change-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      text: `Áreas operativas actualizadas. Nuevas áreas: ${newAreas.join(', ')}`,
      createdAt: new Date().toISOString(),
      isSystemEvent: true
    };

    const updates: Record<string, unknown> = {
      areas_seleccionadas: newAreas,
      current_stage_index: newIndex,
      asignaciones: newAsignaciones,
      updatedAt: new Date().toISOString(),
      comentarios: [newComment, ...(project.comentarios || [])]
    };

    await updateProjectInDB(projectId, updates);
  };

  const fastTrackProject = async (projectId: string, destinationStage: string, justification: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);
    const targetIndex = stages.indexOf(destinationStage);
    if (targetIndex === -1) return;

    const isClosing = destinationStage === GLOBAL_STAGES.CLOSING;
    const newStatus = isClosing ? 'En revisión con cliente' : 'En Proceso';

    const updates: Record<string, unknown> = {
      current_stage_index: targetIndex,
      etapa_actual: destinationStage,
      etapaActual: destinationStage,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      comentarios: [{
        id: `ft-${Date.now()}`,
        authorId: user.id,
        authorName: user.name,
        text: `AJUSTE DE RUTA (Omisión de QA) ejecutado por ${user.name}. Destino: ${destinationStage}. Motivo: ${justification}`,
        createdAt: new Date().toISOString(),
        isSystemEvent: true
      }, ...(project.comentarios || [])]
    };

    if (isClosing) {
      updates.accounts_approval_ok = false;
    }

    await updateProjectInDB(projectId, updates);

    // Notification for the next area leader
    const nextLeader = users.find(u => {
      const userDept = normalizeString(u.department || '');
      const normalizedNextArea = normalizeString(destinationStage);
      
      if (normalizedNextArea.includes('cuentas')) {
        return userDept === 'cuentas';
      }
      return userDept === normalizedNextArea && (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider);
    });

    if (nextLeader) {
      await createNotification({
        userId: nextLeader.id,
        title: '⚡ FAST TRACK: ODT EN TU ÁREA',
        message: `La ODT ${projectId} ha saltado QA y ha sido enviada a tu área (${destinationStage}).`,
        type: 'new_odt',
        projectId: projectId
      });
    }
  };

  const earlyCloseProject = async (projectId: string, data: { motivo: string; explicacion?: string; linkEvidencia: string }) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);
    const closingStage = GLOBAL_STAGES.CLOSING;
    const closingIndex = stages.indexOf(closingStage);

    const updates: Record<string, unknown> = {
      cierreAnticipado: {
        motivo: data.motivo,
        explicacion: data.explicacion || '',
        linkEvidencia: data.linkEvidencia,
        fecha: new Date().toISOString(),
        usuarioUID: user.id
      },
      current_stage_index: closingIndex !== -1 ? closingIndex : stages.length - 1,
      etapa_actual: closingStage,
      etapaActual: closingStage,
      status: 'En Proceso',
      enStandby: false,
      updatedAt: new Date().toISOString(),
      comentarios: [{
        id: `early-close-${Date.now()}`,
        authorId: user.id,
        authorName: user.name,
        text: '🚀 CIERRE ANTICIPADO: Producción técnica omitida. La ODT pasa a la bandeja de Cuentas (Cierre) para documentar el envío y enviar a revisión de cliente.',
        createdAt: new Date().toISOString(),
        isSystemEvent: true
      }, ...(project.comentarios || [])]
    };
    await updateProjectInDB(projectId, updates);
  };

  return (
    <ODTContext.Provider value={{ 
      user, projects, deletedProjects, clients, users, notifications, loading, isInitialLoad, isLoggingIn, login, logout, 
      syncCalendarEvent,
      isAlertsOpen, setIsAlertsOpen,
      updateProjectStatus: async (projectId: string, newStatus: Project['status'], comment: string) => {
        if (!db || !user) return;
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const now = new Date().toISOString();
        const systemComment: ProjectComment = {
          id: `sys-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: comment,
          createdAt: now,
          isSystemEvent: true
        };

        const updates: Record<string, unknown> = {
          status: newStatus,
          updatedAt: now,
          comentarios: [systemComment, ...(project.comentarios || [])],
          comentariosCliente: comment, // NEW FIELD AS REQUESTED
        };

        // If it's becoming finalized or corrections, handle enStandby
        if (newStatus === 'Finalizado' || newStatus === 'Correcciones') {
          updates.enStandby = false;
          const periods = [...(project.client_standby_periods || [])];
          if (periods.length > 0 && !periods[periods.length - 1].end) {
            periods[periods.length - 1].end = now;
          }
          updates.client_standby_periods = periods;
        }

        // Handle Rejection from Client specific logic if needed
        if (comment.includes('SOLICITÓ CAMBIOS') || newStatus === 'Correcciones') {
          updates.etapa_actual = 'Cuentas';
          updates.etapaActual = 'Cuentas';
          // Move stage index back if possible
          const stages = calculateRoadmap(project.areas_seleccionadas || []);
          const countsIndex = stages.indexOf('Cuentas');
          if (countsIndex !== -1) {
            updates.current_stage_index = countsIndex;
          }

          // RESPALDO HISTÓRICO Y LIMPIEZA
          if (project.presentation_link) {
            const cleanFeedbackComment = comment.replace('🛑 CLIENTE SOLICITÓ CAMBIOS:', '').trim();
            const newHistoryItem = {
              version: project.presentation_version || 'v1',
              link: project.presentation_link || '',
              date: project.presentation_date || now,
              feedback: newStatus === 'Correcciones' ? 'rejected' : 'approved_with_corrections',
              comment: cleanFeedbackComment || comment
            };
            const existingHistory = project.historial_versiones || [];
            updates.historial_versiones = [...existingHistory, newHistoryItem];

            // REINICIO DE CAMPOS PRINCIPALES
            updates.presentation_link = null;
            updates.presentation_version = null;
            updates.presentation_date = null;
          }
        }

        await updateProjectInDB(projectId, updates);
      }, updateBrief: async (p, c) => { 
        const rootUpdates: Record<string, any> = {};
        rootUpdates[`project_details/${p}/brief`] = c;
        rootUpdates[`projects/${p}/updatedAt`] = new Date().toISOString();
        await update(ref(db), rootUpdates);
      }, 
      processQA,  
      processAccountsReview,
      delegateClientCorrections,
      submitForPresentation,
      processClientFeedback,
      updateBilling, updatePaymentStatus,
      updateFullProject,
      checkSLA, delegateProject, reassignProjectAndFolder, 
      addClient: async (n, notes, montoIgualaMensual) => {
        if (!db || !user) return;
        const clientId = `CL-${Date.now()}`;
        await set(ref(db, `clients/${clientId}`), { 
          id: clientId, 
          name: n.trim(), 
          notes: notes || '', 
          montoIgualaMensual: montoIgualaMensual || 0,
          assignedExecutives: [user.id], 
          createdAt: new Date().toISOString() 
        });
      }, 
      updateClient: async (clientId, data) => {
        if (!db) return;
        await update(ref(db, `clients/${clientId}`), { ...data });
      },
      removeClient: async (clientId) => {
        if (!db) return;
        await set(ref(db, `clients/${clientId}`), null);
      },
      addProject, 
      addTraceabilityComment,
      removeProject, restoreProject, manageUser, toggleUserStatus, removeUser, advanceProjectStage, 
      updateAreaStatus, toggleClientStandby, getRoadmapStages,
      updateQAChecklist,
      addMaterial, updateMaterialStatus, updateProjectDate, updateProjectId, updateProjectAreas, fastTrackProject, earlyCloseProject, markNotificationAsRead, clearNotifications
    }}>
      {children}
    </ODTContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useODT = () => {
  const context = useContext(ODTContext);
  if (!context) throw new Error('useODT error');
  return context;
};

// --- BLOQUE 5: INDEXACIÓN (NO OLVIDAR) ---
// ACCIÓN REQUERIDA EN FIREBASE CONSOLE:
// En Database Rules, agregar bajo "projects":
// { ".indexOn": ["clientId", "deleted"] }
// Sin esto, RTDB ejecuta las queries con full-scan y lanza warnings en consola.

// --- BLOQUE 6: SEGURIDAD (FUERA DE SCOPE DEL CONTEXT, PERO CRÍTICO) ---
// SEGURIDAD PENDIENTE: Este filtrado es solo de performance/UX.
// Un usuario con acceso a las credenciales de Firebase puede bypassearlo.
// Es OBLIGATORIO implementar Firebase Database Security Rules que validen 
// el rolPrincipal del auth.token antes de permitir lecturas a /projects.
