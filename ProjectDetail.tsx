
import React, { useState, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useODT } from './ODTContext';
import { Project, UserRole, Material } from './types';
import { Icons } from './constants';
import { auditProjectISO } from './services/geminiService';
import { calculateRoadmap, GLOBAL_STAGES, getPriorityInfo } from './workflowConfig';

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
    addTraceabilityComment
  } = useODT();
  const [briefContent, setBriefContent] = useState(project.brief);
  const [traceabilityComment, setTraceabilityComment] = useState('');
  const [qaFeedback, setQaFeedback] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [deliveryLink, setDeliveryLink] = useState('');
  const [deliveryComment, setDeliveryComment] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

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
  const [dialog, setDialog] = useState<{ type: 'alert' | 'confirm', message: string, onConfirm?: () => void } | null>(null);

  const roadmapStages = useMemo(() => {
    return calculateRoadmap(project.areas_seleccionadas || []);
  }, [project.areas_seleccionadas]);

  const priority = getPriorityInfo(project.fecha_entrega);

  const currentIdx = project.current_stage_index || 0;
  const currentStageName = roadmapStages[currentIdx];
  const nextStageName = roadmapStages[currentIdx + 1];
  const isQAStage = currentStageName?.includes('REVISIÓN QA');
  const isClosingStage = currentStageName === GLOBAL_STAGES.CLOSING;
  
  const isInitialStage = currentIdx === 0;
  const isProductionStage = currentIdx > 0 && currentIdx < roadmapStages.length - 2 && !isQAStage;

  const canOperate = useMemo(() => {
    if (!user) return false;
    if (user.role === UserRole.Admin) return true;
    
    if (isQAStage) {
      const isQaLider = user.role === UserRole.Correccion;
      const isQaOperaAssigned = user.role === UserRole.QA_Opera && project.asignaciones?.some(a => a.usuarioId === user.id);
      return isQaLider || isQaOperaAssigned;
    }
    
    if (isProductionStage) {
      const currentArea = roadmapStages[currentIdx];
      const isAreaLead = user.role === UserRole.Lider_Operativo && user.department === currentArea;
      const isDirectlyAssigned = project.asignaciones?.some(a => a.usuarioId === user.id);
      return isAreaLead || isDirectlyAssigned;
    }

    // Fix: Explicitly casting to string to avoid "no overlap" error caused by narrowed literal types
    if (isInitialStage) return user.department === 'Cuentas' || user.role === UserRole.Cuentas_Lider || user.role === UserRole.Cuentas_Opera;
    if ((currentStageName as string) === (GLOBAL_STAGES.CLOSING as string)) return user.department === 'Cuentas';
    if ((currentStageName as string) === (GLOBAL_STAGES.BILLING as string)) return user.department === 'Administración' || user.department === 'Finanzas';

    return false;
  }, [user, currentIdx, isQAStage, isProductionStage, isInitialStage, currentStageName, project.asignaciones, roadmapStages]);

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
      await advanceProjectStage(project.id, comment);
      
      if (nextStageName?.includes('REVISIÓN QA')) {
        setDialog({ type: 'alert', message: 'Material enviado exitosamente a Corrección' });
      } else {
        setDialog({ type: 'alert', message: `Éxito: ODT enviada a ${nextStageName}` });
      }
      
      setDeliveryLink('');
      setDeliveryComment('');
      setValidationError(null);
    } catch (e) {
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
                  await removeProject(project.id);
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
    const res = await auditProjectISO(project);
    setAuditResult(res);
    setIsAuditing(false);
  };

  const getButtonLabel = () => {
    if (isInitialStage) return `VALIDAR BRIEFING Y ENVIAR A ${roadmapStages[1]}`;
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
  const canEditBrief = canOperate || user?.role === UserRole.Admin || user?.department === 'Cuentas';
  const canManageMaterials = user?.department === 'Digital' || user?.department === 'Cuentas' || user?.role === UserRole.Admin;
  const canRunAudit = user?.role === UserRole.Admin || user?.role === UserRole.Correccion || user?.department === 'Cuentas';

  const getMaterialActions = (material: Material) => {
    if (!user) return [];
    const actions: { label: string, nextStatus: Material['estado'], colorClass: string }[] = [];
    
    const isDigital = user.department === 'Digital' || user.role === UserRole.Admin;
    const isDiseno = user.department === 'Arte' || user.role === UserRole.Admin;
    const isMedico = user.department === 'Médico' || user.role === UserRole.Correccion || user.role === UserRole.Admin;

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
        <header className="flex items-center justify-between bg-apc-green p-6 rounded-3xl text-white shadow-xl shadow-apc-green/20 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all text-white shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight">{project.id}</h1>
                {project.fecha_entrega && (
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${priority.color} text-white text-[8px] font-black uppercase shadow-sm`}>
                    <div className={`w-1.5 h-1.5 bg-white ${priority.shape === 'rhombus' ? 'rotate-45' : 'rounded-full'}`}></div>
                    {priority.text}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/70 font-bold uppercase tracking-widest">{project.empresa} - {project.producto}</p>
                <span className="text-[8px] bg-white/10 text-white/80 px-1.5 py-0.5 rounded font-black uppercase">
                  Owner: {users.find(u => u.id === project.ownerId)?.name || 'Sistema'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDeleteODT && (
              <button 
                onClick={handleDeleteODT}
                className="mr-4 p-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Eliminar ODT
              </button>
            )}
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${project.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-700' : project.status === 'QA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {project.status}
            </span>
          </div>
        </header>

        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
              <Icons.Project className="text-apc-green" /> Brief Maestro APC
            </h3>
            {canEditBrief && (
              <button onClick={() => {
                updateBrief(project.id, briefContent);
                setDialog({ type: 'alert', message: "Brief Maestro guardado exitosamente." });
              }} className="px-4 py-2 bg-apc-green text-white text-[10px] font-black rounded-lg hover:bg-apc-green/80 transition-all uppercase tracking-widest">
                Guardar Cambios
              </button>
            )}
          </div>
          <ReactQuill theme="snow" value={briefContent} onChange={setBriefContent} readOnly={!canEditBrief} />
        </div>

        {/* Accumulated Approved Materials */}
        {project.delivery_history && project.delivery_history.length > 0 && (
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4 uppercase tracking-widest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Materiales Aprobados (Historial)
            </h3>
            <div className="space-y-3">
              {project.delivery_history.map((item, idx) => (
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
                project.materiales.map(mat => {
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
            {user?.department === 'Cuentas' && (
              <div className="flex gap-2 items-center">
                <input 
                  type="text" 
                  placeholder="Agregar observación..."
                  className="text-[10px] px-3 py-1.5 border rounded-lg outline-none focus:ring-2 focus:ring-apc-pink w-48 font-medium"
                  value={traceabilityComment}
                  onChange={(e) => setTraceabilityComment(e.target.value)}
                />
                <button 
                  onClick={async () => {
                    if (!traceabilityComment.trim()) return;
                    await addTraceabilityComment(project.id, traceabilityComment);
                    setTraceabilityComment('');
                    setDialog({ type: 'alert', message: 'Observación agregada y notificada.' });
                  }}
                  className="bg-apc-green text-white p-1.5 rounded-lg hover:bg-apc-green/80 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5L20 7"/></svg>
                </button>
              </div>
            )}
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {project.comentarios.map(c => {
              const isQAFeedback = c.text.includes('RECHAZADO') || c.text.includes('APROBADO');
              const isDelivery = c.text.includes('Entrega Técnica');
              return (
                <div key={c.id} className={`p-4 rounded-2xl text-xs border-l-4 ${
                  c.text.includes('RECHAZADO') ? 'bg-rose-50 border-rose-500' : 
                  c.text.includes('APROBADO') ? 'bg-emerald-50 border-emerald-500' :
                  isDelivery ? 'bg-blue-50 border-blue-500' :
                  c.isSystemEvent ? 'bg-slate-50 border-slate-300' : 'bg-white border-blue-400 shadow-sm'
                }`}>
                  <p className="font-black uppercase text-[8px] text-slate-400 mb-1">{c.authorName} • {new Date(c.createdAt).toLocaleString()}</p>
                  <p className="text-slate-700 font-medium leading-relaxed">{c.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-80 space-y-6">
        {/* Current Responsible Info */}
        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-3 tracking-widest border-b pb-2">Responsable de la Etapa Actual</p>
          {(() => {
            const currentStage = (project.etapa_actual || (project as any).etapaActual || '');
            const isQA = currentStage.toUpperCase().includes('QA') || project.status === 'QA';
            const targetArea = isQA ? 'QA' : currentStage;
            const assignment = project.asignaciones?.find(a => a.area === targetArea);
            let responsible = users?.find((u: any) => u.id === assignment?.usuarioId);
            let isLeader = false;

            if (!responsible) {
              responsible = users?.find((u: any) => 
                u.department === targetArea && 
                (u.role === 'Lider_Operativo' || u.role === 'Correccion')
              );
              if (responsible) isLeader = true;
            }

            return responsible ? (
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border ${isLeader ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-apc-pink/10 border-apc-pink/20 text-apc-pink'}`}>
                  {(responsible.name || '??').substring(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase leading-none">{responsible.name}</p>
                  <p className={`text-[8px] font-black uppercase mt-1 ${isLeader ? 'text-amber-600' : 'text-apc-pink'}`}>
                    {isLeader ? `Líder de ${targetArea} (Pte. Delegar)` : `Operativo ${targetArea}`}
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
            {!canOperate && (
              <p className="text-[9px] text-rose-500 font-bold mt-3 text-center uppercase tracking-tighter italic">
                Solo el responsable de {currentStageName} puede avanzar.
              </p>
            )}
          </div>
        )}

        {isClosingStage && canOperate && project.status !== 'Finalizado' && (
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
                    <select 
                      className="text-[9px] p-1 border rounded bg-white font-bold"
                      value={returnArea}
                      onChange={(e) => setReturnArea(e.target.value)}
                    >
                      <option value="">Regresar a...</option>
                      {project.areas_seleccionadas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <button 
                      onClick={() => {
                        if (!accountsFeedback) { alert("Debe dejar instrucciones para el área."); return; }
                        processAccountsReview(project.id, false, accountsFeedback, returnArea);
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
                    <p className="text-[10px] font-black text-amber-600 uppercase">3. Resultado de Presentación</p>
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
                          <select 
                            className="w-full text-[10px] p-2 border rounded-xl bg-white font-bold"
                            value={returnArea}
                            onChange={(e) => setReturnArea(e.target.value)}
                          >
                            <option value="">Regresar a área...</option>
                            {project.areas_seleccionadas.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        )}
                        <button 
                          onClick={() => {
                            if (clientFeedbackResult !== 'approved' && (!clientFeedbackComment || !returnArea)) {
                              alert("Debe dejar comentarios y seleccionar área de retorno.");
                              return;
                            }
                            processClientFeedback(project.id, clientFeedbackResult, clientFeedbackComment, returnArea);
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

        {isQAStage && canOperate && project.status !== 'Finalizado' && project.category !== 'PARRILLA RRSS' && (
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl border-t-4 border-apc-pink">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-apc-pink mb-4 flex items-center gap-2">
              <Icons.Ai className="w-4 h-4" /> QA Correction Gate
            </h3>
            {project.last_delivery_link && (
               <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
                 <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Material Entregado:</p>
                 <a href={project.last_delivery_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 font-bold underline truncate block">Ver Archivo Externo</a>
               </div>
            )}
            <textarea 
              placeholder="Feedback técnico para el área anterior..."
              className={`w-full bg-white/10 border rounded-xl p-4 text-xs outline-none font-medium h-24 mb-4 ${isRejecting ? 'border-rose-500' : 'border-white/20'}`}
              value={qaFeedback}
              onChange={(e) => setQaFeedback(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => handleQAAction(true)} className="py-3 bg-apc-green text-white font-black text-[10px] rounded-xl hover:bg-apc-green/80 uppercase tracking-widest transition-colors">APROBAR Y CONTINUAR</button>
              <button onClick={() => handleQAAction(false)} className="py-3 bg-apc-pink text-white font-black text-[10px] rounded-xl hover:bg-apc-pink/80 uppercase tracking-widest transition-colors">RECHAZAR Y DEVOLVER</button>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border shadow-sm overflow-hidden">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Ruta de Calidad APC</h3>
          <div className="relative space-y-8">
            <div className="absolute top-0 left-[14px] w-0.5 h-full bg-slate-100 -z-0"></div>
            {roadmapStages.map((stage, idx) => {
              const isActive = idx === currentIdx;
              const isCompleted = idx < currentIdx;
              return (
                <div key={idx} className="flex gap-4 items-start relative z-10">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                    isActive ? 'bg-blue-600 border-blue-100 scale-110 shadow-lg' : 
                    isCompleted ? 'bg-emerald-500 border-emerald-50' : 'bg-slate-50 border-white'
                  }`}>
                    {isCompleted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6 9 17l-5-5"/></svg>}
                    {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-tighter leading-tight mt-1 ${isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {stage}
                  </p>
                </div>
              );
            })}
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

      {dialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn text-center">
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
    </div>
  );
};

export default ProjectDetail;
