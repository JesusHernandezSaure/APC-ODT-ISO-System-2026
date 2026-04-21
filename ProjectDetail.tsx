
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tinymce/tinymce-react';
import { useODT } from './ODTContext';
import { Project, UserRole, Material, User } from './types';
import { Icons } from './constants';
import { auditProjectISO } from './services/geminiService';
import { calculateRoadmap, GLOBAL_STAGES, getPriorityInfo, OPERATIVE_AREAS, normalizeString } from './workflowConfig';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack }) => {
  const { 
    user, 
    users,
    advanceProjectStage, 
    updateBrief, 
    processQA, 
    removeProject, 
    addMaterial, 
    updateMaterialStatus,
    processAccountsReview,
    submitForPresentation,
    processClientFeedback,
    addTraceabilityComment,
    updateQAChecklist,
    delegateProject,
    updateProjectDate,
    updateProjectId,
    updateProjectAreas,
    fastTrackProject,
    earlyCloseProject,
    reassignProjectAndFolder,
    updateAreaStatus,
    toggleClientStandby
  } = useODT();
  const navigate = useNavigate();
  const [briefContent, setBriefContent] = useState(project.brief);
  const [isEditingId, setIsEditingId] = useState(false);
  const [newId, setNewId] = useState(project.id);
  const [traceabilityComment, setTraceabilityComment] = useState('');
  const [selectedAreasToReturn, setSelectedAreasToReturn] = useState<string[]>([]);

  React.useEffect(() => {
    setNewId(project.id);
  }, [project.id]);
  const [qaFeedback, setQaFeedback] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [deliveryLink, setDeliveryLink] = useState('');
  const [deliveryComment, setDeliveryComment] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{ score: number, findings: string[], recommendations: string[], isoClause: string } | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showAreasModal, setShowAreasModal] = useState(false);
  const [showFastTrackModal, setShowFastTrackModal] = useState(false);
  const [showEarlyCloseModal, setShowEarlyCloseModal] = useState(false);
  const [earlyCloseMotivo, setEarlyCloseMotivo] = useState('Cambio mínimo entregado a cliente');
  const [earlyCloseExplicacion, setEarlyCloseExplicacion] = useState('');
  const [earlyCloseLink, setEarlyCloseLink] = useState('');
  const [fastTrackJustification, setFastTrackJustification] = useState('');
  const [fastTrackDestination, setFastTrackDestination] = useState('');
  const [selectedAreasForEdit, setSelectedAreasForEdit] = useState<string[]>(project.areas_seleccionadas || []);
  const [selectedExecutives, setSelectedExecutives] = useState<string[]>(project.assignedExecutives || []);
  const [selectedDelegateIds, setSelectedDelegateIds] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState(project.fecha_entrega || '');

  // New state for Closing Stage
  const [accountsFeedback, setAccountsFeedback] = useState('');
  const [returnArea, setReturnArea] = useState('');
  const [presentationLink, setPresentationLink] = useState(project.presentation_link || '');
  const [presentationVersion, setPresentationVersion] = useState(project.presentation_version || 'v1');
  const [clientFeedbackResult, setClientFeedbackResult] = useState<'approved' | 'approved_with_corrections' | 'rejected' | null>(null);
  const [clientFeedbackComment, setClientFeedbackComment] = useState('');

  // Materiales State
  const [showNewMaterial, setShowNewMaterial] = useState(false);
  const [newMatNombre, setNewMatNombre] = useState('');
  const [newMatTipo, setNewMatTipo] = useState('Imagen');
  const [newMatRed, setNewMatRed] = useState('Facebook');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [dialog, setDialog] = useState<{ type: 'alert' | 'confirm', message: string, onConfirm?: () => void } | null>(null);

  // Menciones State
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(-1);

  const roadmapStages = useMemo(() => {
    return calculateRoadmap(project.areas_seleccionadas || []);
  }, [project.areas_seleccionadas]);

  const hasClientLink = project.presentation_link || project.comentarios?.some(c => c.text.includes('PRESENTACIÓN PARA CLIENTE'));
  const displayStatus = (project.status === 'En revisión con cliente' || hasClientLink) ? 'En revisión con cliente' : project.status;

  const userDept = user?.department || '';
  const userRole = user?.role || '';
  const isAdminOrCuentas = userRole === UserRole.Admin || normalizeString(userDept || '') === 'cuentas' || userRole === UserRole.Cuentas_Lider || userRole === UserRole.Cuentas_Opera;
  
  const operativeArea = OPERATIVE_AREAS.find(a => normalizeString(a || '') === normalizeString(userDept || ''));
  const internalDeadline = project.fechasInternas && operativeArea ? project.fechasInternas[operativeArea] : null;

  const showInternal = !isAdminOrCuentas && !!internalDeadline;
  const displayDate = (showInternal && internalDeadline) ? internalDeadline : project.fecha_entrega;
  
  const priority = getPriorityInfo(displayDate);

  const currentIdx = project.current_stage_index || 0;
  const currentStageName = roadmapStages[currentIdx];
  const nextStageName = roadmapStages[currentIdx + 1];
  const isQAStage = currentStageName?.includes('REVISIÓN QA');
  const isClosingStage = currentStageName === GLOBAL_STAGES.CLOSING;
  
  const isInitialStage = currentIdx === 0;
  const isProductionStage = currentIdx > 0 && currentIdx < roadmapStages.length - 2 && !isQAStage;

  const fastTrackOptions = useMemo(() => {
    return roadmapStages.filter(stage => 
      stage !== currentStageName && 
      !stage.includes('REVISIÓN QA') && 
      stage !== GLOBAL_STAGES.START &&
      stage !== GLOBAL_STAGES.BILLING
    );
  }, [roadmapStages, currentStageName]);

  const hasRole = (u: User | null, role: UserRole) => {
    if (!u) return false;
    return u.role === role || (u.roles && u.roles.includes(role));
  };

  const canOperate = useMemo(() => {
    if (!user) return false;
    if (hasRole(user, UserRole.Admin)) return true;
    
    if (isQAStage) {
      const isQaLider = hasRole(user, UserRole.Correccion);
      const isQaOperaAssigned = hasRole(user, UserRole.QA_Opera) && project.asignaciones?.some(a => a.usuarioIds?.includes(user.id) || a.usuarioId === user.id);
      
      // Si es una etapa de QA Médico, permitir a roles médicos o al líder de QA
      if (currentStageName?.includes('Médico')) {
        const isMedicalLider = hasRole(user, UserRole.Medico_Lider);
        const isMedicalOperaAssigned = hasRole(user, UserRole.Medico_Opera) && project.asignaciones?.some(a => a.usuarioIds?.includes(user.id) || a.usuarioId === user.id);
        return isQaLider || isMedicalLider || isMedicalOperaAssigned;
      }
      
      return isQaLider || isQaOperaAssigned;
    }
    
    if (isProductionStage) {
      const currentArea = roadmapStages[currentIdx];
      
      if (project.esCampana) {
        // In campaign mode, any user assigned to an area that is "En Proceso" can operate
        const userArea = user.department;
        const isAreaLead = (hasRole(user, UserRole.Lider_Operativo) || hasRole(user, UserRole.Medico_Lider)) && project.areas_seleccionadas?.includes(userArea);
        const isDirectlyAssigned = project.asignaciones?.some(a => (a.usuarioIds?.includes(user.id) || a.usuarioId === user.id) && project.areas_seleccionadas?.includes(a.area));
        const areaStatus = project.estadoPorArea?.[userArea];
        return (isAreaLead || isDirectlyAssigned) && (areaStatus === 'En Proceso' || areaStatus === 'Rechazado QA');
      }

      const isAreaLead = (hasRole(user, UserRole.Lider_Operativo) || hasRole(user, UserRole.Medico_Lider)) && user.department === currentArea;
      const isDirectlyAssigned = project.asignaciones?.some(a => (a.usuarioIds?.includes(user.id) || a.usuarioId === user.id) && a.area === currentArea);
      return isAreaLead || isDirectlyAssigned;
    }

    if (project.enStandby || project.status === 'En revisión con cliente') return user.department === 'Cuentas' || hasRole(user, UserRole.Admin) || hasRole(user, UserRole.Cuentas_Lider) || hasRole(user, UserRole.Cuentas_Opera);

    // Fix: Explicitly casting to string to avoid "no overlap" error caused by narrowed literal types
    if (isInitialStage) return user.department === 'Cuentas' || hasRole(user, UserRole.Cuentas_Lider) || hasRole(user, UserRole.Cuentas_Opera);
    if ((currentStageName as string) === (GLOBAL_STAGES.CLOSING as string)) return user.department === 'Cuentas';
    if ((currentStageName as string) === (GLOBAL_STAGES.BILLING as string)) return user.department === 'Administración' || user.department === 'Finanzas';

    return false;
  }, [user, currentIdx, isQAStage, isProductionStage, isInitialStage, currentStageName, project.asignaciones, roadmapStages, project.esCampana, project.areas_seleccionadas, project.estadoPorArea, project.enStandby, project.status]);

  const canAddObservation = useMemo(() => {
    if (!user) return false;
    if (user.role === UserRole.Admin) return true;
    if (user.department === 'Cuentas' || user.role === UserRole.Cuentas_Lider || user.role === UserRole.Cuentas_Opera) return true;
    if (project.areas_seleccionadas?.includes(user.department)) return true;
    return false;
  }, [user, project.areas_seleccionadas]);

  const filteredMentionUsers = useMemo(() => {
    if (!mentionSearch) return [];
    return users.filter(u => 
      u.username.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(mentionSearch.toLowerCase())
    ).slice(0, 5);
  }, [users, mentionSearch]);

  const handleMentionSelect = (selectedUser: User) => {
    const before = traceabilityComment.substring(0, mentionIndex);
    const after = traceabilityComment.substring(mentionIndex + mentionSearch.length + 1);
    setTraceabilityComment(`${before}@${selectedUser.username} ${after}`);
    setShowMentionDropdown(false);
    setMentionSearch('');
  };

  const onCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTraceabilityComment(value);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1 && (lastAtSymbol === 0 || textBeforeCursor[lastAtSymbol - 1] === ' ')) {
      const query = textBeforeCursor.substring(lastAtSymbol + 1);
      if (!query.includes(' ')) {
        setMentionSearch(query);
        setMentionIndex(lastAtSymbol);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const processBriefHTML = (html: string) => {
    if (!html) return { __html: '' };
    // Ensure all <a> tags have target="_blank" and rel="noopener noreferrer"
    // Using regex that avoids duplicating if already present
    let processed = html;
    if (processed.includes('<a')) {
      // First clean up to avoid duplicates
      processed = processed.replace(/ target="_blank"/g, '');
      processed = processed.replace(/ rel="noopener noreferrer"/g, '');
      // Then add them back
      processed = processed.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
    }
    return { __html: processed };
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const mentionRegex = /(@[\w.]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      
      const subParts = part.split(mentionRegex);
      return subParts.map((subPart, j) => {
        if (subPart.startsWith('@')) {
          let username = subPart.substring(1);
          let mentionedUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
          let trailingDot = '';
          
          // Manejo de punto final gramatical (ej: @jesus.apc.)
          if (!mentionedUser && username.endsWith('.')) {
            const trimmed = username.slice(0, -1);
            mentionedUser = users.find(u => u.username.toLowerCase() === trimmed.toLowerCase());
            if (mentionedUser) {
              username = trimmed;
              trailingDot = '.';
            }
          }
          
          if (mentionedUser) {
            return (
              <React.Fragment key={`${i}-${j}`}>
                <span className="text-apc-green font-black bg-apc-green/5 px-1 rounded">
                  @{username}
                </span>
                {trailingDot}
              </React.Fragment>
            );
          }
        }
        return subPart;
      });
    });
  };

  const handleAdvance = async () => {
    if (!canOperate) return;
    setValidationError(null);

    // If it's a Parrilla project, prevent manual advance if materials are not all approved
    if (project.category === 'PARRILLA RRSS' && project.materiales && project.materiales.length > 0) {
      const allApproved = project.materiales.every(m => m.estado === 'Aprobado/Publicado');
      if (!allApproved) {
        setValidationError("Error: Todos los materiales deben estar Aprobados/Publicados para avanzar.");
        return;
      }
    }

    if (isProductionStage && !deliveryLink.trim() && project.category !== 'PARRILLA RRSS') {
      setValidationError("Error: Es obligatorio subir el link del material para avanzar.");
      return;
    }

    let comment = "";
    if (isInitialStage) {
      comment = "Briefing validado y envío a producción.";
    } else {
      comment = `Entrega Técnica: ${deliveryComment} | Link: ${deliveryLink}`;
    }

    try {
      if (project.esCampana && isProductionStage) {
        const userArea = user.department;
        await updateAreaStatus(project.id, userArea, 'En QA', comment);
        setDialog({ type: 'alert', message: `Material de [${userArea}] enviado a QA.` });
      } else {
        await advanceProjectStage(project.id, comment);
        
        if (nextStageName?.includes('REVISIÓN QA')) {
          setDialog({ type: 'alert', message: 'Material enviado exitosamente a Corrección' });
        } else {
          setDialog({ type: 'alert', message: `Éxito: ODT enviada a ${nextStageName}` });
        }
      }
      
      setDeliveryLink('');
      setDeliveryComment('');
      setValidationError(null);
    } catch {
      setDialog({ type: 'alert', message: "Error al procesar el avance en la base de datos." });
    }
  };

  const handleQAAction = async (approved: boolean) => {
    if (!approved && !qaFeedback.trim()) {
      setIsRejecting(true);
      return;
    }
    
    try {
      const proximaAreaCalculada = await processQA(project.id, approved, qaFeedback);
      
      if (approved) {
        setDialog({ type: 'alert', message: 'Etapa aprobada. La ODT avanza a: ' + proximaAreaCalculada });
      } else {
        setDialog({ type: 'alert', message: 'QA Gate: ODT Rechazada. Regresa a: ' + proximaAreaCalculada });
      }
      
      setQaFeedback('');
      setIsRejecting(false);
    } catch (e) {
      console.error("QA Action Error:", e);
      setDialog({ type: 'alert', message: "Error al procesar la aprobación QA." });
    }
  };

  const handleDeleteODT = async () => {
    if (!canDeleteODT) {
      setDialog({ type: 'alert', message: "Acceso denegado: No tiene permisos para eliminar registros." });
      return;
    }
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const confirmDeleteODT = async () => {
    if (!deleteReason.trim()) {
      setDialog({ type: 'alert', message: "Debe proporcionar un motivo para eliminar la ODT." });
      return;
    }

    setShowDeleteModal(false);
    setDialog({
      type: 'confirm',
      message: `¿ESTÁ SEGURO DE ELIMINAR LA ODT ${project.id}?`,
      onConfirm: () => {
        setDialog({
          type: 'confirm',
          message: `ADVERTENCIA CRÍTICA: Esta acción es irreversible. NO podrá recuperar esta ODT ni sus datos asociados una vez eliminados. ¿Desea continuar?`,
          onConfirm: () => {
            setDialog({
              type: 'confirm',
              message: `ÚLTIMA CONFIRMACIÓN: Todos los registros y datos se perderán para siempre. ¿Confirmar eliminación definitiva de la ODT?`,
              onConfirm: async () => {
                setDialog(null);
                try {
                  await removeProject(project.id, deleteReason);
                  setDialog({ type: 'alert', message: `ELIMINACIÓN COMPLETA: La ODT ${project.id} ha sido borrada permanentemente.`, onConfirm: onBack });
                } catch (error) {
                  console.error("Fallo al eliminar ODT:", error);
                  setDialog({ type: 'alert', message: "Error crítico: No se pudo eliminar la ODT de la base de datos." });
                }
              }
            });
          }
        });
      }
    });
  };

  const handleAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await auditProjectISO(project);
      setAuditResult(res);
      setShowAuditModal(true);
    } catch (e) {
      console.error("Audit failed:", e);
      setDialog({ type: 'alert', message: "Error al ejecutar la auditoría AI." });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleDelegate = async () => {
    if (selectedDelegateIds.length === 0) return;
    try {
      const currentStage = (project.etapa_actual || project.etapaActual || '');
      const isQA = currentStage.toUpperCase().includes('QA') || project.status === 'QA';
      const targetArea = isQA ? 'QA' : currentStage;
      
      await delegateProject(project.id, targetArea, selectedDelegateIds);
      setDialog({ type: 'alert', message: `ODT delegada exitosamente.` });
      setShowDelegationModal(false);
      setSelectedDelegateIds([]);
    } catch (e) {
      console.error("Delegation failed:", e);
      setDialog({ type: 'alert', message: "Error al delegar la ODT." });
    }
  };

  const getButtonLabel = () => {
    if (isInitialStage) {
      return project.esCampana 
        ? "VALIDAR BRIEFING Y ENVIAR A PRODUCCIÓN PARALELA" 
        : `VALIDAR BRIEFING Y ENVIAR A ${roadmapStages[1] || 'PRODUCCIÓN'}`;
    }
    if (nextStageName?.includes('REVISIÓN QA')) return "ENVIAR A REVISIÓN QA";
    return "COMPLETAR ETAPA TÉCNICA";
  };

  const handleAddMaterial = async () => {
    if (!newMatNombre.trim()) return;
    await addMaterial(project.id, {
      nombre: newMatNombre,
      tipo: newMatTipo,
      redSocial: newMatRed,
      estado: 'Pendiente Arte'
    });
    setNewMatNombre('');
    setShowNewMaterial(false);
  };

  const canDeleteODT = user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider;
  const isAccountOwnerOrLeader = (project.assignedExecutives?.includes(user?.id || '') && user?.role === UserRole.Cuentas_Opera) || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Admin;
  const canEditBrief = canOperate || user?.role === UserRole.Admin || user?.department === 'Cuentas' || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera;
  const canManageMaterials = user?.department === 'Digital' || user?.department === 'Cuentas' || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera || user?.role === UserRole.Admin;
  const canRunAudit = user?.role === UserRole.Admin || user?.role === UserRole.Correccion || user?.role === UserRole.Medico_Lider || user?.department === 'Cuentas' || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera;

  const getMaterialActions = (material: Material) => {
    if (!user) return [];
    const actions: { label: string, nextStatus: Material['estado'], colorClass: string }[] = [];
    
    const isDigital = user.department === 'Digital' || user.role === UserRole.Admin;
    const isDiseno = user.department === 'Arte' || user.role === UserRole.Admin;
    const isMedico = user.department === 'Médico' || user.role === UserRole.Correccion || user.role === UserRole.Admin || user.role === UserRole.Medico_Lider || user.role === UserRole.Medico_Opera;

    switch (material.estado) {
      case 'Pendiente Arte':
        if (isDiseno) actions.push({ label: 'Tomar Arte', nextStatus: 'En Arte', colorClass: 'bg-blue-600' });
        break;
      case 'En Arte':
        if (isDiseno) actions.push({ label: 'Enviar a Corrección', nextStatus: 'Pendiente Corrección', colorClass: 'bg-amber-500' });
        break;
      case 'Pendiente Corrección':
        if (isMedico) actions.push({ label: 'Iniciar Revisión', nextStatus: 'En Corrección', colorClass: 'bg-purple-600' });
        break;
      case 'En Corrección':
        if (isMedico) {
          actions.push({ label: 'Aprobar (OK Médico)', nextStatus: 'Pendiente OK Cliente', colorClass: 'bg-emerald-600' });
          actions.push({ label: 'Rechazar (A Arte)', nextStatus: 'Pendiente Arte', colorClass: 'bg-rose-600' });
        }
        break;
      case 'Pendiente OK Cliente':
        if (isDigital) {
          actions.push({ label: 'OK Cliente (Publicar)', nextStatus: 'Aprobado/Publicado', colorClass: 'bg-emerald-600' });
          actions.push({ label: 'Rechazo Cliente (A Arte)', nextStatus: 'Pendiente Arte', colorClass: 'bg-rose-600' });
        }
        break;
      case 'Aprobado/Publicado':
        break;
    }
    return actions;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn pb-20">
      <div className="flex-1 space-y-6">
      <div className={`bg-white rounded-3xl border ${project.deleted ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'} shadow-2xl overflow-hidden mb-8 transition-all`}>
        {project.deleted && (
          <div className="bg-rose-600 text-white px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-between">
            <span>Esta ODT ha sido eliminada</span>
            <span>Eliminado por: {project.deletedByName} ({project.deletedAt ? new Date(project.deletedAt).toLocaleString() : 'N/A'})</span>
          </div>
        )}
        <header className="flex flex-col md:flex-row items-start justify-between bg-apc-green p-8 rounded-[2.5rem] text-white shadow-2xl shadow-apc-green/20 mb-8 gap-6">
          <div className="flex items-start gap-6 flex-1 w-full">
            <button 
              onClick={onBack} 
              className="group flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all text-white shadow-sm mt-1"
              title="Volver"
            >
               <Icons.ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
               <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Volver</span>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 group">
                {isEditingId ? (
                  <div className="flex items-center gap-2 w-full max-w-md">
                    <input 
                      value={newId}
                      onChange={e => setNewId(e.target.value.toUpperCase())}
                      className="bg-white/10 border border-white/30 rounded-lg px-3 py-1 text-white font-black text-xl outline-none focus:ring-2 focus:ring-white/50 w-full"
                      autoFocus
                    />
                    <button 
                      onClick={async () => {
                        if (!newId.trim() || newId === project.id) {
                          setIsEditingId(false);
                          return;
                        }
                        try {
                          await updateProjectId(project.id, newId.trim());
                          setIsEditingId(false);
                          navigate(`/project/${encodeURIComponent(newId.trim())}`, { replace: true });
                        } catch (e: unknown) {
                          const message = e instanceof Error ? e.message : "Error al actualizar el ID.";
                          setDialog({ type: 'alert', message });
                        }
                      }}
                      className="p-2 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-all"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => { setIsEditingId(false); setNewId(project.id); }}
                      className="p-2 bg-rose-500 rounded-lg hover:bg-rose-600 transition-all"
                    >
                      <Icons.X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-black tracking-tighter uppercase truncate leading-tight">
                      {project.id}
                    </h1>
                    {isAccountOwnerOrLeader && (
                      <button 
                        onClick={() => setIsEditingId(true)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-lg transition-all"
                        title="Editar ID"
                      >
                        <Icons.Edit className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
              <h2 className="text-lg font-bold text-white/90 uppercase tracking-wide leading-snug">
                {project.empresa} | {project.producto}
              </h2>
              {project.esCampana && (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-lg border border-white/30 w-fit">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white">MODO CAMPAÑA</span>
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  </div>
                  {project.detalleEntregableCampaña && (
                    <p className="text-[10px] font-bold text-white/70 italic">
                      Detalle: {project.detalleEntregableCampaña}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 pt-3">
                <span className="text-[10px] bg-white/10 text-white px-3 py-1.5 rounded-xl font-black uppercase border border-white/10 flex items-center gap-2 shadow-sm">
                  <Icons.Users className="w-3 h-3 opacity-60" />
                  Ejecutivos: {(project.assignedExecutives || []).map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(', ') || 'Sistema'}
                  {(user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider) && (
                    <button 
                      onClick={() => {
                        setSelectedExecutives(project.assignedExecutives || []);
                        setShowReassignModal(true);
                      }}
                      className="ml-1 p-1 hover:bg-white/20 rounded-lg transition-all"
                      title="Reasignar Ejecutivos"
                    >
                      <Icons.Edit className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
            {/* Etapa / Status */}
            <div className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] shadow-xl ${
              project.status === 'Finalizado' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 
              project.status === 'QA' ? 'bg-amber-500 text-white shadow-amber-500/20' : 
              displayStatus === 'En revisión con cliente' ? 'bg-purple-600 text-white shadow-purple-500/20' :
              'bg-white text-apc-green shadow-black/5'
            }`}>
              {displayStatus}
            </div>

            {/* Fecha de Entrega */}
            {displayDate && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2.5 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-2xl text-white text-[10px] font-black uppercase border border-white/20 shadow-sm">
                  <Icons.Calendar className="w-4 h-4 opacity-70" />
                  Entrega: {new Date(displayDate + 'T00:00:00').toLocaleDateString()}
                </div>
                {showInternal && (
                  <span className="text-[7px] font-black text-white/60 uppercase tracking-[0.2em] mr-2 italic">Deadline Interno ({operativeArea})</span>
                )}
              </div>
            )}

            {/* Prioridad */}
            {displayDate && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl ${priority.color} text-white text-[10px] font-black uppercase shadow-lg border border-white/10`}>
                <div className={`w-2 h-2 bg-white shadow-sm ${priority.shape === 'rhombus' ? 'rotate-45' : 'rounded-full'}`}></div>
                {priority.text}
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex flex-col gap-2 w-full mt-2">
              {isAccountOwnerOrLeader && (
                <button 
                  onClick={() => setShowDatePicker(true)}
                  className="px-4 py-2.5 bg-apc-pink text-white rounded-2xl hover:bg-apc-pink/90 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-apc-pink/20 border border-white/10"
                >
                  <Icons.Calendar className="w-4 h-4" />
                  Cambiar Fecha
                </button>
              )}
              {canDeleteODT && (
                <button 
                  onClick={handleDeleteODT}
                  className="px-4 py-2.5 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-600/20 border border-white/10"
                >
                  <Icons.Trash className="w-4 h-4" />
                  Eliminar ODT
                </button>
              )}
            </div>
          </div>
        </header>
      </div>

        {/* Alertas de Escalación */}
        {project.status === 'Correcciones' && project.assignedExecutives?.includes(user?.id || '') && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl mb-6 animate-pulse shadow-sm">
            <div className="flex items-center gap-3">
              <Icons.Alert className="text-amber-600" />
              <p className="text-sm font-bold text-amber-800">
                Atención: La ODT {project.id} requiere correcciones en {project.etapa_actual}.
              </p>
            </div>
          </div>
        )}

        {project.contadorCorrecciones && project.contadorCorrecciones >= 2 && (
          (() => {
            const currentArea = roadmapStages[currentIdx];
            const isAreaLeader = user?.role === UserRole.Lider_Operativo && user?.department === currentArea;
            const isQALeader = (user?.role === UserRole.Correccion || user?.role === UserRole.Medico_Lider) && currentArea.includes('QA');
            
            if (isAreaLeader || isQALeader || user?.role === UserRole.Admin) {
              return (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl mb-6 shadow-lg border border-rose-100">
                  <div className="flex items-center gap-3">
                    <Icons.Alert className="text-rose-600 animate-bounce" />
                    <div>
                      <p className="text-xs font-black text-rose-800 uppercase tracking-tight">
                        🚨 ALERTA URGENTE: Múltiples Rechazos
                      </p>
                      <p className="text-[10px] text-rose-600 font-bold">
                        La ODT {project.id} ha sido rechazada {project.contadorCorrecciones} veces en esta etapa.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()
        )}

        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
              <Icons.Project className="text-apc-green" /> Brief Maestro APC
            </h3>
            {canEditBrief && (
              <button onClick={() => {
                const hasChanged = briefContent !== project.brief;
                if (hasChanged) {
                  addTraceabilityComment(project.id, 'El Brief Maestro ha sido modificado', 'ACTUALIZACION_BRIEF', briefContent);
                }
                updateBrief(project.id, briefContent);
                setDialog({ type: 'alert', message: "Brief Maestro guardado exitosamente." });
              }} className="px-4 py-2 bg-apc-green text-white text-[10px] font-black rounded-lg hover:bg-apc-green/80 transition-all uppercase tracking-widest">
                Guardar Cambios
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            {canEditBrief ? (
              <Editor
                tinymceScriptSrc="https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.3/tinymce.min.js"
                value={briefContent}
                onEditorChange={(content) => {
                  setBriefContent(content);
                  updateBrief(project.id, content);
                }}
                init={{
                  height: 500,
                  menubar: true,
                  language: 'es',
                  language_url: 'https://cdn.jsdelivr.net/npm/tinymce-i18n@23.10.9/langs6/es.js',
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                  ],
                  toolbar: 'undo redo | blocks | ' +
                    'bold italic forecolor backcolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'link | removeformat | table tabledelete | tableprops tablerowprops tablecellprops | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | help',
                  default_link_target: '_blank',
                  link_assume_external_targets: true,
                  link_context_toolbar: false,
                  setup: (editor) => {
                    editor.on('click', (e) => {
                      const linkNode = editor.dom.getParent(e.target, 'a');
                      if (linkNode && linkNode.href) {
                        e.preventDefault();
                        window.open(linkNode.href, '_blank', 'noopener,noreferrer');
                      }
                    });
                  },
                  table_default_attributes: {
                    border: '1'
                  },
                  table_default_styles: {
                    'border-collapse': 'collapse',
                    'width': 'auto',
                    'margin-left': '0',
                    'margin-right': 'auto'
                  },
                  content_style: 'body { font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-size:14px; margin: 1rem; } table { border-collapse: collapse; margin-left: 0 !important; margin-right: auto !important; } td, th { border: 1px solid #ccc; padding: 4px; }',
                  paste_data_images: true,
                  promotion: false,
                  branding: false
                }}
              />
            ) : (
              <div 
                className="p-6 rich-text-preview min-h-[300px]"
                dangerouslySetInnerHTML={processBriefHTML(briefContent || '')}
              />
            )}
          </div>
        </div>

        {/* Accumulated Approved Materials */}
        {project.delivery_history && project.delivery_history.length > 0 && (
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4 uppercase tracking-widest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Materiales Aprobados (Historial)
            </h3>
            <div className="space-y-3">
              {(project.delivery_history || []).map((item, idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${idx === 0 ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-slate-900 uppercase">{item.area}</span>
                      <span className="text-[8px] font-bold text-slate-400">{new Date(item.date).toLocaleString()}</span>
                      {idx === 0 && <span className="text-[8px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Última Versión</span>}
                    </div>
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-apc-pink font-bold underline truncate block hover:text-apc-pink/80">
                      {item.link}
                    </a>
                    {item.comment && <p className="text-[10px] text-slate-500 italic mt-1 truncate">"{item.comment}"</p>}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Subido por:</p>
                    <p className="text-[9px] font-bold text-slate-600">{item.authorName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {project.category === 'PARRILLA RRSS' && (
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                  Materiales de Parrilla
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                  Total: {project.materiales?.length || 0} | Aprobados: {project.materiales?.filter(m => m.estado === 'Aprobado/Publicado').length || 0}
                </p>
              </div>
              {(canManageMaterials) && project.status !== 'Finalizado' && (
                <button 
                  onClick={() => setShowNewMaterial(!showNewMaterial)}
                  className="px-4 py-2 bg-apc-pink text-white text-[10px] font-black rounded-lg hover:bg-apc-pink/80 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  <Icons.Plus /> Agregar Material
                </button>
              )}
            </div>

            {showNewMaterial && (
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre del Material</label>
                  <input type="text" value={newMatNombre} onChange={e => setNewMatNombre(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-apc-pink" placeholder="Ej: Post 1 - Lunes" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</label>
                  <select value={newMatTipo} onChange={e => setNewMatTipo(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-apc-pink">
                    <option>Imagen</option>
                    <option>Video</option>
                    <option>Carrusel</option>
                    <option>Reel</option>
                    <option>Story</option>
                    <option>GIF</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Red Social</label>
                  <select value={newMatRed} onChange={e => setNewMatRed(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-apc-pink">
                    <option>Facebook</option>
                    <option>Instagram</option>
                    <option>LinkedIn</option>
                    <option>TikTok</option>
                    <option>YouTube</option>
                    <option>X (Twitter)</option>
                  </select>
                </div>
                <button onClick={handleAddMaterial} className="px-4 py-2 bg-apc-green text-white text-[10px] font-black rounded-lg hover:bg-apc-green/80 transition-all uppercase tracking-widest h-[38px]">
                  Guardar
                </button>
              </div>
            )}

            <div className="space-y-3">
              {(!project.materiales || project.materiales.length === 0) ? (
                <p className="text-center text-slate-400 text-xs italic py-4">No hay materiales registrados en esta parrilla.</p>
              ) : (
                (project.materiales || []).map(mat => {
                  const actions = getMaterialActions(mat);
                  return (
                    <div key={mat.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-2xl hover:bg-slate-50 transition-all gap-4">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm">{mat.nombre}</h4>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">{mat.tipo}</span>
                          <span className="text-[9px] font-bold bg-apc-pink/10 text-apc-pink px-2 py-0.5 rounded uppercase">{mat.redSocial}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                          mat.estado === 'Aprobado/Publicado' ? 'bg-emerald-100 text-emerald-700' :
                          mat.estado.includes('Corrección') ? 'bg-purple-100 text-purple-700' :
                          mat.estado.includes('Arte') ? 'bg-amber-100 text-amber-700' :
                          'bg-apc-pink/10 text-apc-pink'
                        }`}>
                          {mat.estado}
                        </span>
                        
                        {actions.length > 0 && project.status !== 'Finalizado' && (
                          <div className="flex gap-2">
                            {actions.map(act => (
                              <button 
                                key={act.label}
                                onClick={() => updateMaterialStatus(project.id, mat.id, act.nextStatus)}
                                className={`px-3 py-1.5 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm hover:scale-105 ${act.colorClass}`}
                              >
                                {act.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {isProductionStage && canOperate && project.category !== 'PARRILLA RRSS' && (
          <div className={`bg-white rounded-2xl p-6 border-2 transition-all ${validationError ? 'border-rose-500 bg-rose-50/30' : 'border-dashed border-slate-200'}`}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-black text-[10px] uppercase text-slate-500 tracking-[0.2em]">Insumos de Entrega Técnica ({currentStageName})</h4>
              {validationError && (
                <span className="text-[9px] font-black text-rose-600 animate-pulse uppercase">¡Error de Validación!</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <input 
                  type="text" 
                  placeholder="Link del material (Obligatorio)..."
                  value={deliveryLink}
                  onChange={e => {
                    setDeliveryLink(e.target.value);
                    if (e.target.value.trim()) setValidationError(null);
                  }}
                  className={`w-full bg-white border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 transition-all font-medium ${validationError ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-apc-pink'}`}
                />
              </div>
              <input 
                type="text" 
                placeholder="Comentarios adicionales de entrega..."
                value={deliveryComment}
                onChange={e => setDeliveryComment(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-apc-pink font-medium"
              />
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b pb-2">
            <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Logs de Trazabilidad ISO 9001</h3>
          </div>
          
          {canAddObservation && (
            <div className="mb-6 space-y-3 relative">
              {showMentionDropdown && filteredMentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                  <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Mencionar a...</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredMentionUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleMentionSelect(u)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-apc-pink/5 text-left transition-all group"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-apc-pink group-hover:text-white transition-all">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 group-hover:text-apc-pink transition-all">{u.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea 
                placeholder="Escribe una observación detallada aquí... Usa @ para mencionar."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-apc-pink font-medium resize-y min-h-[100px]"
                value={traceabilityComment}
                onChange={onCommentChange}
              />
              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    if (!traceabilityComment.trim() || btn.disabled) return;
                    
                    try {
                      btn.disabled = true;
                      btn.classList.add('opacity-50', 'cursor-not-allowed');
                      
                      console.log("Iniciando guardado de observación...");
                      await addTraceabilityComment(project.id, traceabilityComment);
                      
                      setTraceabilityComment('');
                      setDialog({ type: 'alert', message: 'Observación agregada y notificada correctamente.' });
                      console.log("Observación guardada con éxito.");
                    } catch (error) {
                      console.error("Error crítico al agregar observación:", error);
                      setDialog({ 
                        type: 'alert', 
                        message: 'Error al guardar la observación. Por favor, revisa la consola para más detalles.' 
                      });
                    } finally {
                      btn.disabled = false;
                      btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                  }}
                  className="bg-apc-green text-white px-6 py-2 rounded-xl hover:bg-apc-green/80 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-apc-green/20"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
                  Agregar Observación
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {(project.comentarios || []).map(c => {
              if (c.tipo === 'ACTUALIZACION_BRIEF' || c.tipo === 'BRIEF_INICIAL') {
                return (
                  <div key={c.id} className="p-4 rounded-2xl text-xs border bg-blue-50/50 border-blue-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Icons.Project className="w-3 h-3 text-blue-600" />
                        <span className="font-black uppercase text-[10px] text-blue-600 tracking-wider">
                          {c.tipo === 'BRIEF_INICIAL' ? 'Brief Inicial Registrado' : 'Brief Maestro Modificado'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="font-bold text-slate-700 mb-2 truncate">{c.text}</p>
                    <details className="mt-2 group">
                      <summary className="cursor-pointer text-blue-600 font-black flex items-center gap-1 hover:underline list-none">
                        <Icons.ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                        <span>📄 Ver versión del brief de esta fecha</span>
                      </summary>
                      <div className="mt-4 p-4 bg-white rounded-xl border border-blue-100 max-h-[300px] overflow-y-auto">
                        <div 
                          className="rich-text-preview"
                          dangerouslySetInnerHTML={processBriefHTML(c.contenidoHTML || '')} 
                        />
                      </div>
                    </details>
                    <div className="mt-4 flex items-center gap-2 pt-3 border-t border-blue-100/50">
                      <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-[8px] font-black text-blue-700 uppercase shadow-inner">
                        {c.authorName.substring(0, 2)}
                      </div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{c.authorName}</span>
                    </div>
                  </div>
                );
              }

              const isDelivery = c.text.includes('Entrega Técnica');
              return (
                <div key={c.id} className={`p-4 rounded-2xl text-xs border-l-4 ${
                  c.text.includes('RECHAZADO') ? 'bg-rose-50 border-rose-500' : 
                  c.text.includes('APROBADO') ? 'bg-emerald-50 border-emerald-500' :
                  isDelivery ? 'bg-blue-50 border-blue-500' :
                  c.isSystemEvent ? 'bg-slate-50 border-slate-300' : 'bg-white border-blue-400 shadow-sm'
                }`}>
                  <p className="font-black uppercase text-[10px] text-slate-400 mb-1">{c.authorName} • {new Date(c.createdAt).toLocaleString()}</p>
                  <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                    {renderTextWithLinks(c.text)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-80 space-y-6">
        {/* Early Close Button */}
        {isAccountOwnerOrLeader && project.status !== 'Finalizado' && (
          <button 
            onClick={() => setShowEarlyCloseModal(true)}
            className="w-full py-3 bg-white border border-red-300 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Icons.Check className="w-4 h-4" /> Cerrar Proceso (Anticipado)
          </button>
        )}

        {/* Current Responsible Info */}
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-3 border-b pb-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Responsable de la Etapa Actual</p>
            {(() => {
              const currentStage = (project.etapa_actual || project.etapaActual || '');
              const isQA = currentStage.toUpperCase().includes('QA') || project.status === 'QA';
              const targetArea = isQA ? 'QA' : currentStage;
              const isLeader = hasRole(user, UserRole.Lider_Operativo) && user?.department === targetArea;
              const isCorreccion = hasRole(user, UserRole.Correccion) && isQA;
              const isMedicalLider = hasRole(user, UserRole.Medico_Lider) && (isQA || targetArea === 'Médico');
              
              if (isLeader || isCorreccion || isMedicalLider || hasRole(user, UserRole.Admin)) {
                return (
                  <button 
                    onClick={() => setShowDelegationModal(true)}
                    className="text-[8px] font-black text-apc-pink hover:text-apc-pink/80 uppercase tracking-widest flex items-center gap-1"
                  >
                    <Icons.Plus className="w-2 h-2" /> Delegar
                  </button>
                );
              }
              return null;
            })()}
          </div>
          {(() => {
            const currentStage = (project.etapa_actual || project.etapaActual || '');
            const isQA = currentStage.toUpperCase().includes('QA') || project.status === 'QA';
            const targetArea = isQA ? 'QA' : currentStage;
            const assignment = project.asignaciones?.find(a => a.area === targetArea);
            
            let responsibleUsers: User[] = [];
            let isLeaderDisplay = false;

            // NEW LOGIC: If stage is Cuentas or Administración, the responsible is the Executive (Owner)
            const isAccountsStage = targetArea.toUpperCase().includes('CUENTAS') || targetArea.toUpperCase().includes('ADMINISTRACIÓN');
            
            if (isAccountsStage && project.assignedExecutives && project.assignedExecutives.length > 0) {
              responsibleUsers = users.filter(u => project.assignedExecutives?.includes(u.id));
            } else if (assignment && assignment.usuarioIds && assignment.usuarioIds.length > 0) {
              responsibleUsers = users.filter(u => assignment.usuarioIds.includes(u.id));
            } else if (assignment && assignment.usuarioId) {
              // Backward compatibility for single ID
              const u = users.find(u => u.id === assignment.usuarioId);
              if (u) responsibleUsers = [u];
            }

            if (responsibleUsers.length === 0) {
              const leader = users?.find(u => 
                u.department === targetArea && 
                (u.role === UserRole.Lider_Operativo || u.role === UserRole.Correccion || u.role === UserRole.Medico_Lider)
              );
              if (leader) {
                responsibleUsers = [leader];
                isLeaderDisplay = true;
              }
            }

            return responsibleUsers.length > 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2 overflow-hidden">
                  {responsibleUsers.slice(0, 3).map((u) => (
                    <div 
                      key={u.id} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border ring-2 ring-white ${isLeaderDisplay ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-apc-pink/10 border-apc-pink/20 text-apc-pink'}`}
                      title={u.name}
                    >
                      {(u.name || '??').substring(0,2).toUpperCase()}
                    </div>
                  ))}
                  {responsibleUsers.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500 ring-2 ring-white">
                      +{responsibleUsers.length - 3}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase leading-none">
                    {responsibleUsers.map(u => u.name).join(', ')}
                  </p>
                  <p className={`text-[8px] font-black uppercase mt-1 ${isLeaderDisplay ? 'text-amber-600' : 'text-apc-pink'}`}>
                    {isLeaderDisplay ? `Líder de ${targetArea} (Pte. Delegar)` : `Equipo ${targetArea}`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[10px] font-black text-rose-400 italic uppercase">Sin Asignación de Área</p>
            );
          })()}
        </div>

        {!isQAStage && !isClosingStage && project.status !== 'Finalizado' && (project.category !== 'PARRILLA RRSS' || isInitialStage) && (
          <div className="bg-white p-6 rounded-3xl border shadow-xl border-t-8 border-apc-green">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Acción de Etapa Actual</p>
            <button 
              onClick={handleAdvance}
              disabled={!canOperate}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all ${
                canOperate ? 'bg-apc-green text-white hover:bg-apc-green/80 hover:scale-[1.02]' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {getButtonLabel()}
            </button>

            {user?.role === UserRole.Medico_Lider && currentStageName === 'Médico' && (
              <button 
                onClick={() => setShowFastTrackModal(true)}
                className="w-full mt-2 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 border-amber-400 text-amber-600 hover:bg-amber-50 transition-all"
              >
                Ajuste de Ruta (Omitir QA)
              </button>
            )}

            {!canOperate && (
              <p className="text-[9px] text-rose-500 font-bold mt-3 text-center uppercase tracking-tighter italic">
                Solo el responsable de {currentStageName} puede avanzar.
              </p>
            )}
          </div>
        )}

        {(isClosingStage || project.enStandby || project.status === 'En revisión con cliente') && canOperate && project.status !== 'Finalizado' && (
          <div className="bg-white p-6 rounded-3xl border shadow-xl border-t-8 border-apc-pink space-y-6">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-apc-pink flex items-center gap-2">
              <Icons.Check className="w-4 h-4" /> Cierre y Calidad de Cuentas
            </h3>

            {/* Step 1: Quality Review */}
            {!project.accounts_approval_ok ? (
              <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-500 uppercase">1. Revisión de Calidad Operativa</p>
                <textarea 
                  placeholder="Instrucciones o feedback de calidad..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none font-medium h-20"
                  value={accountsFeedback}
                  onChange={(e) => setAccountsFeedback(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => processAccountsReview(project.id, true, accountsFeedback)}
                    className="py-2 bg-apc-green text-white font-black text-[9px] rounded-lg hover:bg-apc-green/80 uppercase"
                  >
                    CALIDAD OK
                  </button>
                  <div className="flex flex-col gap-1">
                    {project.esCampana ? (
                      <div className="p-2 bg-white border rounded space-y-1 max-h-32 overflow-y-auto">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Áreas a corregir:</p>
                        {(project.areas_seleccionadas || []).map(area => (
                          <label key={area} className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={selectedAreasToReturn.includes(area)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedAreasToReturn([...selectedAreasToReturn, area]);
                                else setSelectedAreasToReturn(selectedAreasToReturn.filter(a => a !== area));
                              }}
                              className="w-3 h-3 rounded text-apc-pink"
                            />
                            <span className="text-[9px] font-bold text-slate-600">{area}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <select 
                        className="text-[9px] p-1 border rounded bg-white font-bold"
                        value={returnArea}
                        onChange={(e) => setReturnArea(e.target.value)}
                      >
                        <option value="">Regresar a...</option>
                        {(project.areas_seleccionadas || []).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    )}
                    <button 
                      onClick={() => {
                        if (!accountsFeedback) { alert("Debe dejar instrucciones para el área."); return; }
                        if (project.esCampana) {
                          if (selectedAreasToReturn.length === 0) { alert("Seleccione al menos un área."); return; }
                          processAccountsReview(project.id, false, accountsFeedback, undefined, selectedAreasToReturn);
                        } else {
                          processAccountsReview(project.id, false, accountsFeedback, returnArea);
                        }
                      }}
                      className="py-2 bg-rose-600 text-white font-black text-[9px] rounded-lg hover:bg-rose-700 uppercase"
                    >
                      DEVOLVER
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step 2: Presentation Setup */}
                {!project.presentation_date ? (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-600 uppercase">2. Preparación para Cliente</p>
                    <input 
                      type="text"
                      placeholder="Link de material final..."
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs outline-none font-medium"
                      value={presentationLink}
                      onChange={(e) => setPresentationLink(e.target.value)}
                    />
                    <input 
                      type="text"
                      placeholder="Versión (ej: v1, v2...)"
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs outline-none font-medium"
                      value={presentationVersion}
                      onChange={(e) => setPresentationVersion(e.target.value)}
                    />
                    <button 
                      onClick={() => {
                        if (!presentationLink) { alert("Debe subir el material final."); return; }
                        submitForPresentation(project.id, presentationLink, presentationVersion);
                      }}
                      className="w-full py-3 bg-apc-green text-white font-black text-[10px] rounded-xl hover:bg-apc-green/80 uppercase tracking-widest shadow-md"
                    >
                      PRESENTACIÓN PARA CLIENTE
                    </button>
                  </div>
                ) : (
                  /* Step 3: Client Feedback */
                  <div className="space-y-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-amber-600 uppercase">3. Resultado de Presentación</p>
                      <button 
                        onClick={() => toggleClientStandby(project.id, project.status !== 'En revisión con cliente')}
                        className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${project.status === 'En revisión con cliente' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {project.status === 'En revisión con cliente' ? 'PAUSAR STANDBY' : 'ENVIAR A CLIENTE (STANDBY)'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setClientFeedbackResult('approved')}
                        className={`py-2 px-3 rounded-lg text-[9px] font-black border-2 transition-all ${clientFeedbackResult === 'approved' ? 'bg-apc-green border-apc-green text-white' : 'bg-white border-apc-green/10 text-apc-green'}`}
                      >
                        RECIBE SIN CORRECCIONES
                      </button>
                      <button 
                        onClick={() => setClientFeedbackResult('approved_with_corrections')}
                        className={`py-2 px-3 rounded-lg text-[9px] font-black border-2 transition-all ${clientFeedbackResult === 'approved_with_corrections' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-amber-100 text-amber-600'}`}
                      >
                        RECIBE CON CORRECCIONES
                      </button>
                      <button 
                        onClick={() => setClientFeedbackResult('rejected')}
                        className={`py-2 px-3 rounded-lg text-[9px] font-black border-2 transition-all ${clientFeedbackResult === 'rejected' ? 'bg-apc-pink border-apc-pink text-white' : 'bg-white border-apc-pink/10 text-apc-pink'}`}
                      >
                        RECHAZADA POR CLIENTE
                      </button>
                    </div>

                    {clientFeedbackResult && (
                      <div className="space-y-3 animate-fadeIn">
                        <textarea 
                          placeholder="Comentarios del cliente..."
                          className="w-full bg-white border border-amber-200 rounded-xl p-3 text-xs outline-none font-medium h-20"
                          value={clientFeedbackComment}
                          onChange={(e) => setClientFeedbackComment(e.target.value)}
                        />
                        {clientFeedbackResult !== 'approved' && (
                          <>
                            {!project.esCampana ? (
                              <select 
                                className="w-full text-[10px] p-2 border rounded-xl bg-white font-bold"
                                value={returnArea}
                                onChange={(e) => setReturnArea(e.target.value)}
                              >
                                <option value="">Regresar a área...</option>
                                {(project.areas_seleccionadas || []).map(a => <option key={a} value={a}>{a}</option>)}
                              </select>
                            ) : (
                              <div className="p-3 bg-white border rounded-xl space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Áreas a corregir (Rollback Selectivo):</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {(project.areas_seleccionadas || []).map(area => (
                                    <label key={area} className="flex items-center gap-2 cursor-pointer">
                                      <input 
                                        type="checkbox"
                                        checked={selectedAreasToReturn.includes(area)}
                                        onChange={(e) => {
                                          if (e.target.checked) setSelectedAreasToReturn([...selectedAreasToReturn, area]);
                                          else setSelectedAreasToReturn(selectedAreasToReturn.filter(a => a !== area));
                                        }}
                                        className="w-4 h-4 rounded text-apc-pink"
                                      />
                                      <span className="text-[10px] font-bold text-slate-600">{area}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        <button 
                          onClick={() => {
                            if (clientFeedbackResult !== 'approved') {
                              if (!clientFeedbackComment) { alert("Debe dejar comentarios."); return; }
                              if (project.esCampana && selectedAreasToReturn.length === 0) { alert("Seleccione al menos un área."); return; }
                              if (!project.esCampana && !returnArea) { alert("Seleccione área de retorno."); return; }
                            }
                            processClientFeedback(project.id, clientFeedbackResult, clientFeedbackComment, returnArea, selectedAreasToReturn);
                          }}
                          className="w-full py-3 bg-slate-900 text-white font-black text-[10px] rounded-xl hover:bg-slate-800 uppercase tracking-widest shadow-md"
                        >
                          PROCESAR RESULTADO
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isQAStage && (canOperate || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera) && project.status !== 'Finalizado' && project.category !== 'PARRILLA RRSS' && (
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl border-t-4 border-apc-pink">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-apc-pink mb-4 flex items-center gap-2">
              <Icons.Ai className="w-4 h-4" /> QA Correction Gate {project.esCampana && "(MODO CAMPAÑA)"}
            </h3>
            
            {project.esCampana ? (
              <div className="space-y-4 mb-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado por Área (Agregación QA)</p>
                <div className="grid grid-cols-1 gap-2">
                  {(project.areas_seleccionadas || []).map(area => {
                    const status = project.estadoPorArea?.[area] || 'En Proceso';
                    return (
                      <div key={area} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase">{area}</span>
                          <span className={`text-[8px] font-bold uppercase ${
                            status === 'Aprobado QA' ? 'text-emerald-400' :
                            status === 'En QA' ? 'text-amber-400' :
                            status === 'Rechazado QA' ? 'text-rose-400' : 'text-slate-500'
                          }`}>{status}</span>
                        </div>
                        {canOperate && status === 'En QA' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => updateAreaStatus(project.id, area, 'Aprobado QA', qaFeedback)}
                              className="px-3 py-1 bg-emerald-600 text-white text-[8px] font-black rounded uppercase hover:bg-emerald-700"
                            >
                              Aprobar
                            </button>
                            <button 
                              onClick={() => {
                                if (!qaFeedback) { alert("Debe dejar feedback para rechazar."); return; }
                                updateAreaStatus(project.id, area, 'Rechazado QA', qaFeedback);
                              }}
                              className="px-3 py-1 bg-rose-600 text-white text-[8px] font-black rounded uppercase hover:bg-rose-700"
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {project.last_delivery_link && (
                  <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Material Entregado:</p>
                    <a href={project.last_delivery_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 font-bold underline truncate block">Ver Archivo Externo</a>
                  </div>
                )}
              </>
            )}

            <textarea 
              placeholder={project.esCampana ? "Feedback para el área seleccionada..." : "Feedback técnico para el área anterior..."}
              className={`w-full bg-white/10 border rounded-xl p-4 text-xs outline-none font-medium h-24 mb-4 ${isRejecting ? 'border-rose-500' : 'border-white/20'}`}
              value={qaFeedback}
              onChange={(e) => setQaFeedback(e.target.value)}
              disabled={!canOperate}
            />

            <div className="mb-6 space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
              <p className="text-[9px] font-black text-apc-pink uppercase tracking-[0.2em] mb-2">Checklist de Calidad Obligatorio</p>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={project.qaChecklist?.medica || false}
                  onChange={(e) => updateQAChecklist(project.id, 'medica', e.target.checked)}
                  disabled={!canOperate}
                  className="w-4 h-4 rounded border-white/20 bg-white/10 text-apc-pink focus:ring-apc-pink focus:ring-offset-slate-900"
                />
                <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">Revisión Médica (Precisión científica)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={project.qaChecklist?.estilo || false}
                  onChange={(e) => updateQAChecklist(project.id, 'estilo', e.target.checked)}
                  disabled={!canOperate}
                  className="w-4 h-4 rounded border-white/20 bg-white/10 text-apc-pink focus:ring-apc-pink focus:ring-offset-slate-900"
                />
                <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">Estilo y Ortografía</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={project.qaChecklist?.referencias || false}
                  onChange={(e) => updateQAChecklist(project.id, 'referencias', e.target.checked)}
                  disabled={!canOperate}
                  className="w-4 h-4 rounded border-white/20 bg-white/10 text-apc-pink focus:ring-apc-pink focus:ring-offset-slate-900"
                />
                <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">Calidad y Referencias</span>
              </label>
            </div>

            {!project.esCampana && canOperate && (
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => handleQAAction(true)} 
                  disabled={!(project.qaChecklist?.medica && project.qaChecklist?.estilo && project.qaChecklist?.referencias)}
                  className="py-3 bg-apc-green text-white font-black text-[10px] rounded-xl hover:bg-apc-green/80 uppercase tracking-widest transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale"
                >
                  APROBAR Y CONTINUAR
                </button>
                <button onClick={() => handleQAAction(false)} className="py-3 bg-apc-pink text-white font-black text-[10px] rounded-xl hover:bg-apc-pink/80 uppercase tracking-widest transition-colors">RECHAZAR Y DEVOLVER</button>
              </div>
            )}
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ruta de Calidad APC</h3>
            {isAccountOwnerOrLeader && (
              <button 
                onClick={() => {
                  setSelectedAreasForEdit(project.areas_seleccionadas || []);
                  setShowAreasModal(true);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-apc-pink"
                title="Editar Áreas"
              >
                <Icons.Edit className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative space-y-8">
            {(!roadmapStages || roadmapStages.length <= 3) ? (
              <p className="text-center text-slate-400 text-[10px] italic py-4 font-medium">No hay áreas operativas asignadas para esta ruta.</p>
            ) : (
              <>
                <div className="absolute top-0 left-[14px] w-0.5 h-full bg-slate-100 -z-0"></div>
                {(roadmapStages || []).map((stage, idx) => {
                  let isActive = idx === currentIdx;
                  let isCompleted = idx < currentIdx;
                  
                  // En modo campaña, todas las áreas operativas se muestran como activas si estamos en etapa de producción
                  if (project.esCampana && isProductionStage) {
                    const isOperativeArea = (OPERATIVE_AREAS as readonly string[]).includes(stage);
                    if (isOperativeArea) {
                      isActive = true;
                      isCompleted = false;
                    }
                  }

                  const areaStatus = project.esCampana ? project.estadoPorArea?.[stage] : null;

                  return (
                    <div key={idx} className="flex gap-4 items-start relative z-10">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                        isActive ? 'bg-apc-pink border-apc-pink/20 scale-110 shadow-lg shadow-apc-pink/20' : 
                        isCompleted ? 'bg-emerald-500 border-emerald-50' : 'bg-slate-50 border-white'
                      }`}>
                        {isCompleted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg>}
                        {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className={`text-[10px] font-black uppercase tracking-tighter leading-tight mt-1 ${isActive ? 'text-apc-pink' : isCompleted ? 'text-emerald-600' : 'text-slate-300'}`}>
                            {stage}
                          </p>
                          {areaStatus && (
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                              areaStatus === 'Aprobado QA' ? 'bg-emerald-100 text-emerald-600' :
                              areaStatus === 'En QA' ? 'bg-amber-100 text-amber-600' :
                              areaStatus === 'Rechazado QA' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {areaStatus}
                            </span>
                          )}
                        </div>
                        {isActive && !areaStatus && (
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Etapa Actual</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {canRunAudit && (
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <h3 className="flex items-center gap-2 font-black text-[10px] mb-4 text-blue-600 uppercase tracking-widest"><Icons.Ai /> Auditoría AI</h3>
            <button onClick={handleAudit} disabled={isAuditing} className="w-full py-2 bg-slate-50 text-slate-900 rounded-xl font-black text-[9px] uppercase tracking-widest border hover:bg-blue-50 transition-colors">
              {isAuditing ? 'Auditing ISO...' : 'Run ISO 9001 Check'}
            </button>
            {auditResult && (
              <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 animate-fadeIn">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-[8px] text-slate-400">Score:</span> 
                  <span className="text-sm font-black text-blue-600">{auditResult.score}%</span>
                </div>
                <p className="text-[8px] text-slate-600 font-bold leading-tight">{auditResult.findings[0]}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showAuditModal && auditResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto relative z-[1110]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <Icons.Ai className="text-blue-600" /> Auditoría ISO 9001:2015
              </h2>
              <button onClick={() => setShowAuditModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-2xl text-center border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Score de Calidad</p>
                <p className="text-4xl font-black text-blue-700">{auditResult.score}%</p>
              </div>
              <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cláusula ISO Relevante</p>
                <p className="text-sm font-bold text-slate-700">{auditResult.isoClause}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-rose-600 rounded-full"></div> Hallazgos Críticos
                </h4>
                <div className="space-y-2">
                  {(auditResult.findings || []).map((f, i) => (
                    <div key={i} className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-medium text-rose-700">
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></div> Recomendaciones de Mejora
                </h4>
                <div className="space-y-2">
                  {(auditResult.recommendations || []).map((r, i) => (
                    <div key={i} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-medium text-emerald-700">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowAuditModal(false)}
              className="w-full mt-8 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {showReassignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Reasignar Ejecutivos</h2>
              <button onClick={() => setShowReassignModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 font-medium mb-6">
              Seleccione los ejecutivos de cuenta responsables de esta ODT:
            </p>

            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {(users || []).filter(u => u.role === UserRole.Cuentas_Opera || u.role === UserRole.Cuentas_Lider).map(u => (
                  <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedExecutives.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExecutives([...selectedExecutives, u.id]);
                        } else {
                          setSelectedExecutives(selectedExecutives.filter(id => id !== u.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-apc-pink focus:ring-apc-pink"
                    />
                    <span className="text-sm font-bold text-slate-700">{u.name}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-black text-xs rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    await reassignProjectAndFolder(project.id, project.clientId || '', selectedExecutives, false);
                    setShowReassignModal(false);
                    setDialog({ type: 'alert', message: 'Ejecutivos reasignados correctamente.' });
                  }}
                  disabled={selectedExecutives.length === 0}
                  className="flex-1 py-3 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all uppercase tracking-widest shadow-lg"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDelegationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Delegar ODT</h2>
              <button onClick={() => setShowDelegationModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 font-medium mb-6">
              Seleccione al responsable para la etapa actual: <span className="font-black text-slate-800">{(project.etapa_actual || project.etapaActual)}</span>
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaboradores (Selección Múltiple)</label>
                <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-2xl p-3 space-y-1 bg-slate-50/50">
                  {(users || [])
                    .filter(u => {
                      const currentStage = (project.etapa_actual || project.etapaActual || '').toUpperCase();
                      const isQA = currentStage.includes('QA') || project.status === 'QA';
                      
                      // Helper to check if user has a role (primary or secondary)
                      const hasRole = (r: UserRole) => u.role === r || u.roles?.includes(r);
                      
                      // Exclude Admins from assignment lists to avoid cluttering operational lists
                      if (hasRole(UserRole.Admin)) return false;

                      if (isQA) {
                        return u.department === 'QA' || 
                               hasRole(UserRole.Correccion) || 
                               hasRole(UserRole.QA_Opera) || 
                               hasRole(UserRole.Medico_Lider) || 
                               hasRole(UserRole.Medico_Opera);
                      }
                      
                      // For other areas, include if department matches OR if they have a leadership role for that area
                      if (currentStage === 'MÉDICO' && (hasRole(UserRole.Medico_Lider) || hasRole(UserRole.Medico_Opera))) return true;
                      
                      return u.department === (project.etapa_actual || project.etapaActual);
                    })
                    .map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-2.5 hover:bg-white hover:shadow-sm rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-200">
                        <input 
                          type="checkbox"
                          checked={selectedDelegateIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDelegateIds([...selectedDelegateIds, u.id]);
                            } else {
                              setSelectedDelegateIds(selectedDelegateIds.filter(id => id !== u.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-apc-pink focus:ring-apc-pink"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700">{u.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{u.role}</span>
                        </div>
                      </label>
                    ))
                  }
                </div>
                {selectedDelegateIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedDelegateIds.map(id => {
                      const u = users.find(user => user.id === id);
                      return (
                        <span key={id} className="px-2 py-1 bg-apc-pink/10 text-apc-pink text-[9px] font-black rounded-lg border border-apc-pink/20 uppercase">
                          {u?.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <button 
                onClick={handleDelegate}
                disabled={selectedDelegateIds.length === 0}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all ${
                  selectedDelegateIds.length > 0 ? 'bg-apc-pink text-white hover:bg-apc-pink/80' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                Confirmar Delegación ({selectedDelegateIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showDatePicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 relative z-[1110]">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-3">
              <Icons.Calendar className="text-apc-pink" /> Cambiar Fecha de Entrega
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nueva Fecha de Entrega</label>
                <input 
                  type="date" 
                  value={newDeliveryDate}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-apc-pink font-bold text-slate-700"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-black text-[10px] rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    if (!newDeliveryDate) return;
                    await updateProjectDate(project.id, newDeliveryDate);
                    setShowDatePicker(false);
                    setDialog({ type: 'alert', message: 'Fecha de entrega actualizada correctamente.' });
                  }}
                  className="flex-1 py-3 bg-apc-green text-white font-black text-[10px] rounded-xl hover:bg-apc-green/80 uppercase tracking-widest transition-all shadow-lg shadow-apc-green/20"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 relative z-[1110]">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-3">
              <Icons.Trash className="text-rose-600" /> Eliminar ODT
            </h3>
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                Para proceder con la eliminación de la ODT <span className="font-black text-slate-800">{project.id}</span>, es obligatorio proporcionar un motivo válido para el registro de auditoría.
              </p>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Motivo de Eliminación</label>
                <textarea 
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej: ODT duplicada, error en requerimientos, cancelación de cliente..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-700 text-sm h-32 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 font-black text-[10px] rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteODT}
                  disabled={!deleteReason.trim()}
                  className="flex-1 py-3 bg-rose-600 text-white font-black text-[10px] rounded-xl hover:bg-rose-700 uppercase tracking-widest transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn text-center relative z-[2010]">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6 ${dialog.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
              {dialog.type === 'confirm' ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">{dialog.type === 'confirm' ? 'Confirmación Requerida' : 'Aviso del Sistema'}</h3>
            <p className="text-sm text-slate-600 font-medium mb-8">{dialog.message}</p>
            <div className="flex gap-3 justify-center">
              {dialog.type === 'confirm' && (
                <button 
                  onClick={() => setDialog(null)} 
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-xs rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest"
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  if (dialog.type === 'alert' || !dialog.onConfirm) setDialog(null);
                }} 
                className={`flex-1 py-3 text-white font-black text-xs rounded-xl transition-all uppercase tracking-widest shadow-lg ${dialog.type === 'confirm' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
              >
                {dialog.type === 'confirm' ? 'Confirmar' : 'Entendido'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAreasModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Editar Áreas Operativas</h2>
              <button onClick={() => setShowAreasModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">
              Selecciona las áreas que participarán en esta ODT:
            </p>

            <div className="grid grid-cols-1 gap-2 mb-8 max-h-[300px] overflow-y-auto pr-2">
              {OPERATIVE_AREAS.map(area => (
                <label key={area} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                  <input 
                    type="checkbox"
                    checked={selectedAreasForEdit.includes(area)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAreasForEdit([...selectedAreasForEdit, area]);
                      } else {
                        setSelectedAreasForEdit(selectedAreasForEdit.filter(a => a !== area));
                      }
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-apc-pink focus:ring-apc-pink"
                  />
                  <span className="text-xs font-bold text-slate-700 uppercase">{area}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowAreasModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-[10px] rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (selectedAreasForEdit.length === 0) {
                    setDialog({ type: 'alert', message: "Debe seleccionar al menos un área operativa." });
                    return;
                  }
                  try {
                    await updateProjectAreas(project.id, selectedAreasForEdit);
                    setShowAreasModal(false);
                    setDialog({ type: 'alert', message: "Áreas actualizadas exitosamente." });
                  } catch {
                    setDialog({ type: 'alert', message: "Error al actualizar las áreas." });
                  }
                }}
                className="flex-1 py-3 bg-apc-green text-white font-black text-[10px] rounded-xl hover:bg-apc-green/80 uppercase tracking-widest transition-all shadow-lg shadow-apc-green/20"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {showFastTrackModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Icons.Ai className="text-amber-500" /> Redirigir ODT (Ajuste de Ruta)
              </h2>
              <button onClick={() => setShowFastTrackModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-6">
              <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                <span className="block mb-1 uppercase tracking-widest">⚠️ Protocolo ISO 9001:2015</span>
                Esta acción permite redirigir la ODT omitiendo la revisión de QA. Se requiere una justificación técnica válida para la auditoría de calidad.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Justificación del ajuste de ruta</label>
                <textarea 
                  required
                  placeholder="Explica por qué se redirige la ODT omitiendo la revisión de QA..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs outline-none font-medium h-24 focus:border-amber-400 transition-colors"
                  value={fastTrackJustification}
                  onChange={(e) => setFastTrackJustification(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">¿A qué área enviar ahora?</label>
                <select 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none font-bold focus:border-amber-400 transition-colors"
                  value={fastTrackDestination}
                  onChange={(e) => setFastTrackDestination(e.target.value)}
                >
                  <option value="">Selecciona destino...</option>
                  {fastTrackOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowFastTrackModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-[10px] rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                disabled={!fastTrackJustification || !fastTrackDestination}
                onClick={async () => {
                  try {
                    await fastTrackProject(project.id, fastTrackDestination, fastTrackJustification);
                    setShowFastTrackModal(false);
                    setFastTrackJustification('');
                    setFastTrackDestination('');
                    setDialog({ type: 'alert', message: "Redirección procesada exitosamente." });
                  } catch {
                    setDialog({ type: 'alert', message: "Error al procesar la redirección." });
                  }
                }}
                className="flex-1 py-3 bg-amber-500 text-white font-black text-[10px] rounded-xl hover:bg-amber-600 uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:grayscale"
              >
                Ejecutar Redirección
              </button>
            </div>
          </div>
        </div>
      )}
      {showEarlyCloseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Icons.Check className="text-red-500" /> Confirmar Cierre Anticipado
              </h2>
              <button onClick={() => setShowEarlyCloseModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-6">
              <p className="text-[10px] text-red-700 font-bold leading-relaxed">
                <span className="block mb-1 uppercase tracking-widest">⚠️ Bypass de Ruta</span>
                Esta acción cerrará la ODT anticipadamente, omitiendo las etapas restantes. Se requiere evidencia de la entrega al cliente.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo</label>
                <select 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none font-bold focus:border-red-400 transition-colors"
                  value={earlyCloseMotivo}
                  onChange={(e) => setEarlyCloseMotivo(e.target.value)}
                >
                  <option value="Cambio mínimo entregado a cliente">Cambio mínimo entregado a cliente</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {earlyCloseMotivo === 'Otro' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Explicación</label>
                  <textarea 
                    required
                    placeholder="Explica el motivo del cierre..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs outline-none font-medium h-24 focus:border-red-400 transition-colors"
                    value={earlyCloseExplicacion}
                    onChange={(e) => setEarlyCloseExplicacion(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Link de Evidencia (Entregable)</label>
                <input 
                  type="url"
                  required
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none font-bold focus:border-red-400 transition-colors"
                  value={earlyCloseLink}
                  onChange={(e) => setEarlyCloseLink(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowEarlyCloseModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-[10px] rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                disabled={!earlyCloseLink || (earlyCloseMotivo === 'Otro' && !earlyCloseExplicacion)}
                onClick={async () => {
                  try {
                    await earlyCloseProject(project.id, {
                      motivo: earlyCloseMotivo,
                      explicacion: earlyCloseMotivo === 'Otro' ? earlyCloseExplicacion : undefined,
                      linkEvidencia: earlyCloseLink
                    });
                    setShowEarlyCloseModal(false);
                    setDialog({ type: 'alert', message: "Cierre anticipado procesado exitosamente." });
                  } catch {
                    setDialog({ type: 'alert', message: "Error al procesar el cierre anticipado." });
                  }
                }}
                className="flex-1 py-3 bg-red-600 text-white font-black text-[10px] rounded-xl hover:bg-red-700 uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:grayscale"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
      {showEarlyCloseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Icons.Check className="text-red-500" /> Confirmar Cierre Anticipado
              </h2>
              <button onClick={() => setShowEarlyCloseModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-6">
              <p className="text-[10px] text-red-700 font-bold leading-relaxed">
                <span className="block mb-1 uppercase tracking-widest">⚠️ Bypass de Ruta</span>
                Esta acción cerrará la ODT anticipadamente, omitiendo las etapas restantes. Se requiere evidencia de la entrega al cliente.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo</label>
                <select 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none font-bold focus:border-red-400 transition-colors"
                  value={earlyCloseMotivo}
                  onChange={(e) => setEarlyCloseMotivo(e.target.value)}
                >
                  <option value="Cambio mínimo entregado a cliente">Cambio mínimo entregado a cliente</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {earlyCloseMotivo === 'Otro' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Explicación</label>
                  <textarea 
                    required
                    placeholder="Explica el motivo del cierre..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs outline-none font-medium h-24 focus:border-red-400 transition-colors"
                    value={earlyCloseExplicacion}
                    onChange={(e) => setEarlyCloseExplicacion(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Link de Evidencia (Entregable)</label>
                <input 
                  type="url"
                  required
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none font-bold focus:border-red-400 transition-colors"
                  value={earlyCloseLink}
                  onChange={(e) => setEarlyCloseLink(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowEarlyCloseModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-[10px] rounded-xl hover:bg-slate-200 uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                disabled={!earlyCloseLink || (earlyCloseMotivo === 'Otro' && !earlyCloseExplicacion)}
                onClick={async () => {
                  try {
                    await earlyCloseProject(project.id, {
                      motivo: earlyCloseMotivo,
                      explicacion: earlyCloseMotivo === 'Otro' ? earlyCloseExplicacion : undefined,
                      linkEvidencia: earlyCloseLink
                    });
                    setShowEarlyCloseModal(false);
                    setDialog({ type: 'alert', message: "Cierre anticipado procesado exitosamente." });
                  } catch {
                    setDialog({ type: 'alert', message: "Error al procesar el cierre anticipado." });
                  }
                }}
                className="flex-1 py-3 bg-red-600 text-white font-black text-[10px] rounded-xl hover:bg-red-700 uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:grayscale"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
