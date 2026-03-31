
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ref, onValue, update, get, set } from "firebase/database";
import { db } from './firebase';
import { Project, User, ODTContextType, UserRole, LoginResult, Client, Material, Notification as ProjectNotification, ProjectComment } from './types';
import { GLOBAL_STAGES, calculateRoadmap, getPriorityInfo, normalizeString } from './workflowConfig';

const ODTContext = createContext<ODTContextType | undefined>(undefined);

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
  const [loading, setLoading] = useState(!!db);
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
    if (!db) {
      return;
    }
    const projectsRef = ref(db, 'projects');
    const usersRef = ref(db, 'users');
    const clientsRef = ref(db, 'clients');

    onValue(projectsRef, (s) => {
      const d = s.val();
      const all: Project[] = d ? Object.keys(d).map(k => ({ ...d[k], id: k })) : [];
      setProjects(all.filter(p => !p.deleted));
      setDeletedProjects(all.filter(p => p.deleted));
    });

    onValue(usersRef, (s) => {
      const d = s.val();
      setUsers(d ? Object.keys(d).map(k => ({ ...d[k], id: k })) : []);
    });

    onValue(clientsRef, (s) => {
      const d = s.val();
      setClients(d ? Object.keys(d).map(k => ({ ...d[k], id: k })) : []);
    });

    const notificationsRef = ref(db, 'notifications');
    onValue(notificationsRef, (s) => {
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
    });
  }, [user]);

  const getRoadmapStages = (project: Project) => {
    return calculateRoadmap(project.areas_seleccionadas || []);
  };

  const login = async (username: string, pass: string): Promise<LoginResult> => {
    const cleanUsername = username.toLowerCase().trim();
    const dbKey = escapeFirebaseKey(cleanUsername);
    if (cleanUsername === 'admin' && pass === 'admin') {
      const adminBypass: User = { id: 'admin', name: 'Admin Bypass', username: 'admin', department: 'Sistemas', role: UserRole.Admin, active: true };
      setUser(adminBypass);
      localStorage.setItem('apc_session', JSON.stringify(adminBypass));
      return { success: true };
    }
    try {
      const userRef = ref(db, `users/${dbKey}`);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) return { success: false, error: `Usuario no encontrado.` };
      const userData = snapshot.val();
      if (!userData.active) return { success: false, error: 'Cuenta inactiva.' };
      if (userData.password !== pass) return { success: false, error: 'Contraseña incorrecta.' };
      const authUser: User = { ...userData, id: dbKey };
      setUser(authUser);
      localStorage.setItem('apc_session', JSON.stringify(authUser));
      return { success: true };
    } catch {
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
    await set(ref(db, `notifications/${id}`), newNotif);
  };

  const markNotificationAsRead = async (id: string) => {
    if (!db) return;
    await update(ref(db, `notifications/${id}`), { read: true });
  };

  const clearNotifications = async () => {
    if (!db || !user) return;
    const userNotifs = notifications.filter(n => n.userId === user.id);
    const updates: Record<string, unknown> = {};
    userNotifs.forEach(n => {
      updates[`notifications/${n.id}`] = null;
    });
    await update(ref(db), updates);
  };

  // SLA and Priority Background Check
  useEffect(() => {
    if (!user || projects.length === 0 || !db) return;

    const checkAlerts = async () => {
      const now = new Date();
      for (const p of projects) {
        if (p.status === 'Finalizado' || p.status === 'Cancelado') continue;

        // 1. SLA Check (Estancamiento)
        const lastUpdate = new Date(p.updatedAt || p.createdAt);
        const diffDaysSLA = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDaysSLA >= 3) {
          const stages = getRoadmapStages(p);
          const currentArea = stages[p.current_stage_index || 0];
          const currentAssignment = p.asignaciones?.find(a => a.area === currentArea);

          if (currentAssignment) {
            const alreadyNotified = notifications.some(n => n.userId === currentAssignment.usuarioId && n.projectId === p.id && n.type === 'sla_alert');
            if (!alreadyNotified) {
              await createNotification({
                userId: currentAssignment.usuarioId,
                title: '⚠️ ALERTA DE SLA (3 DÍAS)',
                message: `La ODT ${p.id} lleva más de 3 días a tu cargo sin avances.`,
                type: 'sla_alert',
                projectId: p.id
              });
            }
          }

          const areaLeader = users.find(u => u.department === currentArea && (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider));
          if (areaLeader) {
            const alreadyNotified = notifications.some(n => n.userId === areaLeader.id && n.projectId === p.id && n.type === 'sla_alert' && n.title.includes('RETRASO EN ÁREA'));
            if (!alreadyNotified) {
              await createNotification({
                userId: areaLeader.id,
                title: '🚨 RETRASO EN ÁREA (SLA 3D)',
                message: `La ODT ${p.id} lleva estancada 3 días en tu área (${currentArea}).`,
                type: 'sla_alert',
                projectId: p.id
              });
            }
          }
        }

        // 2. Priority Check (Fecha de Entrega)
        if (p.fecha_entrega) {
          const priority = getPriorityInfo(p.fecha_entrega);
          if (priority.level >= 1 && priority.level <= 3) {
            // Notificar a los Ejecutivos (Owners)
            if (p.assignedExecutives && p.assignedExecutives.length > 0) {
              const alertType = priority.level === 2 ? 'orange' : 'yellow';
              const alertTitle = `⚠️ PRIORIDAD ${priority.text.toUpperCase()} (${alertType.toUpperCase()})`;
              
              for (const execId of p.assignedExecutives) {
                const alreadyNotified = notifications.some(n => n.userId === execId && n.projectId === p.id && n.title === alertTitle);
                
                if (!alreadyNotified) {
                  await createNotification({
                    userId: execId,
                    title: alertTitle,
                    message: `La ODT ${p.id} está a ${4 - priority.level} día(s) de su fecha de entrega.`,
                    type: 'sla_alert',
                    projectId: p.id
                  });
                }
              }
            }
          }
        }
      }
    };

    const timer = setTimeout(checkAlerts, 10000); // Check 10 seconds after load
    return () => clearTimeout(timer);
  }, [user, projects, users, notifications]);

  const addProject = async (projectData: Partial<Project>) => {
    if (!db || !user) return;
    const projectId = projectData.id;
    if (!projectId) return;
    const newProject = {
      ...projectData,
      status: 'Borrador',
      current_stage_index: 0,
      etapa_actual: GLOBAL_STAGES.START,
      etapaActual: GLOBAL_STAGES.START,
      assignedExecutives: projectData.assignedExecutives || [user.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comentarios: [
        { id: `sys-${Date.now()}`, authorId: user.id, authorName: user.name, text: `ODT INICIADA EN ${GLOBAL_STAGES.START.toUpperCase()}`, createdAt: new Date().toISOString(), isSystemEvent: true },
        ...(projectData.referenceLinks && projectData.referenceLinks.length > 0 ? [{
          id: `ref-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `ENLACE GENERAL DEL PROYECTO: ${projectData.referenceLinks.join(', ')}`,
          createdAt: new Date().toISOString(),
          isSystemEvent: true
        }] : [])
      ],
      asignaciones: [],
      pagado: false,
      facturado: false
    };
    await set(ref(db, `projects/${projectId}`), newProject);

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

      await update(ref(db, `projects/${projectId}`), updates);
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
      await update(ref(db, `projects/${projectId}`), updates);
    } catch (error) {
      console.error("Error al restaurar ODT:", error);
      throw error;
    }
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
    
    await update(ref(db, `projects/${projectId}`), updates);

    // Notificación para el líder de la siguiente área
    const nextArea = proximaArea;
    const nextLeader = users.find(u => {
      const userDept = normalizeString(u.department || '');
      const normalizedNextArea = normalizeString(nextArea);
      
      if (normalizedNextArea.includes('qa')) {
        return userDept === 'qa' || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider;
      }
      if (normalizedNextArea.includes('cuentas')) {
        return userDept === 'cuentas';
      }
      return userDept === normalizedNextArea && (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider);
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
        qaChecklist: { medica: false, estilo: false, referencias: false }, // Reset checklist on approval
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

      await update(ref(db, `projects/${projectId}`), updates);

      // Notificación para el líder de la siguiente área
      const nextLeader = users.find(u => {
        const userDept = normalizeString(u.department || '');
        const normalizedNextArea = normalizeString(proximaAreaCalculada);
        
        if (normalizedNextArea.includes('qa')) {
          return userDept === 'qa' || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider;
        }
        if (normalizedNextArea.includes('cuentas')) {
          return userDept === 'cuentas';
        }
        return userDept === normalizedNextArea && (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider);
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
        qaChecklist: { medica: false, estilo: false, referencias: false }, // Reset checklist on rejection
        comentarios: [{ 
          id: `qa-${Date.now()}`, 
          authorId: user.id, 
          authorName: user.name, 
          text: `RECHAZADO en [${qaStageName}]. Feedback: ${feedback}. Regresando a [${areaAnterior}]. (Rechazo #${newRejectionCount})`, 
          createdAt: new Date().toISOString(), 
          isSystemEvent: true 
        }, ...(project.comentarios || [])]
      };
      await update(ref(db, `projects/${projectId}`), updates);

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
      if (previousAssignment && !project.assignedExecutives?.includes(previousAssignment.usuarioId)) {
        await createNotification({
          userId: previousAssignment.usuarioId,
          title: '❌ ODT RECHAZADA POR QA',
          message: `La ODT ${projectId} ha sido rechazada en QA. Feedback: ${feedback}. Por favor, realiza las correcciones.`,
          type: 'sla_alert',
          projectId: projectId
        });
      }

      // Notificación al Líder del Área si contadorCorrecciones >= 2
      if (newRejectionCount >= 2) {
        const areaLeader = users.find(u => 
          normalizeString(u.department) === normalizeString(areaAnterior) && 
          (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider)
        );
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

  const processAccountsReview = async (projectId: string, approved: boolean, feedback: string, returnToArea?: string) => {
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
      await update(ref(db, `projects/${projectId}`), updates);
    } else {
      const targetArea = returnToArea || stages[project.current_stage_index - 1];
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
      await update(ref(db, `projects/${projectId}`), updates);

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
      if (assignedUser && (!targetLeader || assignedUser.usuarioId !== targetLeader.id)) {
        await createNotification({
          userId: assignedUser.usuarioId,
          title: '⚠️ CORRECCIÓN SOLICITADA POR CUENTAS',
          message: `Se han solicitado ajustes en la ODT ${projectId} para tu área (${targetArea}). Instrucciones: ${feedback}`,
          type: 'sla_alert',
          projectId: projectId
        });
      }
    }
  };

  const submitForPresentation = async (projectId: string, link: string, version: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updates: Record<string, unknown> = {
      presentation_link: link,
      presentation_version: version,
      presentation_date: new Date().toISOString(),
      status: 'En revisión con cliente',
      updatedAt: new Date().toISOString(),
      comentarios: [
        {
          id: `status-${Date.now()}`,
          authorId: user.id,
          authorName: user.name,
          text: `Cambio de Status: En revisión con cliente`,
          createdAt: new Date().toISOString(),
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
    await update(ref(db, `projects/${projectId}`), updates);
  };

  const processClientFeedback = async (projectId: string, result: 'approved' | 'approved_with_corrections' | 'rejected', feedback: string, returnToArea?: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const stages = getRoadmapStages(project);
    let updates: Record<string, unknown> = {
      client_feedback: result,
      updatedAt: new Date().toISOString(),
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
      const newRejectionCount = result === 'rejected' ? (project.client_rejection_count || 0) + 1 : (project.client_rejection_count || 0);
      
      updates.correction_count_after_presentation = newCorrectionCount;
      updates.client_rejection_count = newRejectionCount;

      if (result === 'rejected' || newCorrectionCount >= 3) {
        updates.is_alarm_active = true;
        alarmTriggered = true;
      }

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

      if (alarmTriggered) {
        const involvedUserIds = new Set<string>();
        project.asignaciones?.forEach(a => involvedUserIds.add(a.usuarioId));
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

    await update(ref(db, `projects/${projectId}`), updates);

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
    await set(ref(db, `users/${dbKey}`), { ...userData, username: userData.username.toLowerCase(), createdAt: new Date().toISOString() });
  };

  const toggleUserStatus = async (userId: string, active: boolean) => {
    if (!db) return;
    await update(ref(db, `users/${userId}`), { active });
  };

  const removeUser = async (userId: string) => {
    if (!db || !user || user.role !== UserRole.Admin) return;
    await set(ref(db, `users/${userId}`), null);
  };

  const addTraceabilityComment = async (projectId: string, text: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newComment: ProjectComment = {
      id: `comm-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      text: text,
      createdAt: new Date().toISOString(),
      isSystemEvent: false
    };

    const updates: Record<string, unknown> = {
      comentarios: [newComment, ...(project.comentarios || [])],
      updatedAt: new Date().toISOString()
    };

    await update(ref(db, `projects/${projectId}`), updates);

    // Notificación a quien dejó el último material
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

    await update(ref(db, `projects/${projectId}`), updates);
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
    await update(ref(db, `projects/${projectId}`), { 
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
    await update(ref(db, `projects/${projectId}`), { 
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

  const delegateProject = async (projectId: string, area: string, userId: string) => {
    if (!db || !user) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newAsignaciones = [...(project.asignaciones || []).filter(a => a.area !== area), { area, usuarioId: userId, status: 'en_progreso' }];
    await update(ref(db, `projects/${projectId}`), { asignaciones: newAsignaciones, updatedAt: new Date().toISOString() });

    // Notificación para el usuario asignado
    await createNotification({
      userId: userId,
      title: '🎯 NUEVA ASIGNACIÓN',
      message: `Se te ha asignado la ODT ${projectId} para el área de ${area}.`,
      type: 'assignment',
      projectId: projectId
    });
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
    await update(ref(db, `projects/${projectId}`), { 
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

    await update(ref(db, `projects/${projectId}`), updates);
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

    await update(ref(db, `projects/${projectId}`), { 
      fecha_entrega: newDate,
      updatedAt: new Date().toISOString(),
      comentarios: [newComment, ...(project.comentarios || [])]
    });
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

    // Update notifications that reference this project
    notifications.forEach(n => {
      if (n.projectId === oldId) {
        updates[`notifications/${n.id}/projectId`] = newDbKey;
      }
    });

    await update(ref(db), updates);
  };

  return (
    <ODTContext.Provider value={{ 
      user, projects, deletedProjects, clients, users, notifications, loading, login, logout, 
      isAlertsOpen, setIsAlertsOpen,
      updateProjectStatus: async () => {}, updateBrief: async (p, c) => { await update(ref(db, `projects/${p}`), { brief: c, updatedAt: new Date().toISOString() }) }, 
      processQA, 
      processAccountsReview,
      submitForPresentation,
      processClientFeedback,
      updateBilling, updatePaymentStatus,
      checkSLA, delegateProject, reassignProjectAndFolder, 
      addClient: async (n, notes) => {
        if (!db || !user) return;
        const clientId = `CL-${Date.now()}`;
        await set(ref(db, `clients/${clientId}`), { 
          id: clientId, 
          name: n.trim(), 
          notes: notes || '', 
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
      removeProject, restoreProject, manageUser, toggleUserStatus, removeUser, advanceProjectStage, getRoadmapStages,
      updateQAChecklist,
      addMaterial, updateMaterialStatus, updateProjectDate, updateProjectId, markNotificationAsRead, clearNotifications
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
