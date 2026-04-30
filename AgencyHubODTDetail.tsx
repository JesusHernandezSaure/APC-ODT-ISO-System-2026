
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useODT } from './ODTContext';
import { Icons } from './constants';
import AgencyHubDetailTour from './AgencyHubDetailTour';

const AgencyHubODTDetail: React.FC = () => {
    const { id } = useParams();
    const { projects, users, updateProjectStatus, user } = useODT();
    const navigate = useNavigate();
    const [comentario, setComentario] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [iniciarTutorialDetalle, setIniciarTutorialDetalle] = useState(false);

    const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);

    const isFinalized = useMemo(() => {
        if (!project) return false;
        const stage = project.etapa_actual.toUpperCase();
        return stage.includes('APROBADA') || stage.includes('FINALIZADA') || stage.includes('ADMINISTRACIÓN') || stage.includes('CIERRE');
    }, [project]);

    // Find the assigned executive (responsible)
    const executive = useMemo(() => {
        if (!project) return null;
        // Typically project.assignedExecutives or lookup from users who are Cuentas for this client
        // For simplicity, let's look at assignments or assignedExecutives
        const execId = project.assignedExecutives?.[0];
        return users.find(u => u.id === execId);
    }, [project, users]);

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                    <Icons.Search size={32} />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">ODT no encontrada</p>
                <button onClick={() => navigate('/agency-hub')} className="text-apc-pink font-black text-[10px] uppercase tracking-widest hover:underline">Volver al Dashboard</button>
            </div>
        );
    }

    const handleAprobar = async () => {
        if (!window.confirm('¿Estás seguro de que deseas aprobar este material?')) return;
        
        setIsSubmitting(true);
        try {
            await updateProjectStatus(project.id, 'Finalizado', '✅ CLIENTE APROBÓ EL MATERIAL');
            alert('¡Material aprobado exitosamente!');
            navigate('/agency-hub');
        } catch (error) {
            console.error('Error updating project:', error);
            alert('Ocurrió un error al procesar tu solicitud.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSolicitarCambios = async () => {
        if (!comentario.trim()) {
            alert('Por favor, describe los cambios que necesitas.');
            return;
        }

        setIsSubmitting(true);
        try {
            await updateProjectStatus(project.id, 'Correcciones', `🛑 CLIENTE SOLICITÓ CAMBIOS: ${comentario.trim()}`);
            alert('Comentarios enviados al equipo.');
            navigate('/agency-hub');
        } catch (error) {
            console.error('Error updating project:', error);
            alert('Ocurrió un error al procesar tu solicitud.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderExecutiveCard = () => {
        if (!executive) return null;

        const initials = executive.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

        return (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md group">
                <div className="relative">
                    {executive.fotoUrl ? (
                        <img src={executive.fotoUrl} alt={executive.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-50 group-hover:border-apc-green transition-all" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-apc-green flex items-center justify-center text-white font-black text-xl border-2 border-slate-50 group-hover:bg-apc-pink transition-all">
                            {initials}
                        </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <div className="w-3 h-3 bg-apc-green rounded-full animate-pulse"></div>
                    </div>
                </div>
                <div className="flex-1">
                    <p className="text-[10px] font-black text-apc-pink uppercase tracking-widest mb-0.5">Tu Ejecutivo Asignado</p>
                    <h4 className="text-base font-black text-slate-800 leading-tight">{executive.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">{executive.puestoPublico || 'Account Executive'}</p>
                    <div className="flex items-center gap-3">
                        {executive.telefonoPublico && (
                            <a href={`tel:${executive.telefonoPublico}`} className="text-slate-400 hover:text-apc-green transition-colors">
                                <Icons.TrendingUp className="w-3.5 h-3.5" />
                            </a>
                        )}
                        <a href={`mailto:${executive.username}`} className="text-slate-400 hover:text-apc-green transition-colors">
                            <Icons.Ai className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            </div>
        );
    };

    const deliveryLink = project.presentation_link || project.last_delivery_link;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-20">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <button 
                  onClick={() => navigate('/agency-hub')}
                  className="group flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-all"
                >
                    <div className="p-2 rounded-xl group-hover:bg-slate-100 transition-all">
                      <Icons.Menu className="w-4 h-4 rotate-90" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Panel de Control</span>
                </button>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIniciarTutorialDetalle(true)}
                        className="px-4 py-2 bg-slate-100 hover:bg-apc-pink hover:text-white text-slate-400 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                    >
                        <span>ℹ️ Ayuda</span>
                    </button>
                    <div className="px-4 py-2 bg-slate-100 rounded-xl">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">ID Proyecto</p>
                       <p className="text-xs font-black text-slate-900 font-mono tracking-tighter">#{project.id}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Project Info & Executive */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-striped-pink opacity-10 -mr-10 -mt-10 rounded-full"></div>
                        <p className="text-[9px] font-black text-apc-pink uppercase tracking-widest mb-2">Proyecto</p>
                        <h2 className="text-2xl font-black tracking-tight leading-tight mb-4">{project.producto}</h2>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                    <Icons.Clients className="w-3 h-3 text-apc-light-teal" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">{project.marca}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                    <Icons.Project className="w-3 h-3 text-apc-light-teal" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">{project.category}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                    <Icons.Calendar className="w-3 h-3 text-apc-light-teal" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                    {project.fecha_entrega ? new Date(project.fecha_entrega).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).toUpperCase() : 'Pendiente'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {renderExecutiveCard()}
                </div>

                {/* Right Column: Interaction / Material */}
                <div className="md:col-span-2 space-y-6">
                    {/* Material Viewer Card */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Icons.Ai className="w-4 h-4 text-apc-pink" /> Material Entregable
                                </h3>
                                {project.enStandby && (
                                    <span className="px-3 py-1 bg-apc-pink text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse">
                                        Revisión Activa
                                    </span>
                                )}
                            </div>

                            {deliveryLink ? (
                                <div className="p-10 bg-slate-50 rounded-[1.5rem] border-2 border-dashed border-slate-200 text-center space-y-6">
                                    <div className={`w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center mx-auto ${isFinalized ? 'text-apc-pink' : 'text-apc-green'}`}>
                                        {isFinalized ? <Icons.Check className="w-8 h-8" /> : <Icons.Plus className="w-8 h-8" />}
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-slate-900 font-black uppercase tracking-tight">
                                            {isFinalized ? '¡Material Aprobado!' : '¡Tu material está listo!'}
                                        </p>
                                        <p className="text-xs text-slate-400 font-medium px-8 italic">
                                            {isFinalized 
                                                ? 'Haz clic en el botón de abajo para abrir el material aprobado' 
                                                : 'Haz clic en el botón de abajo para abrir el canal de revisión y validar el diseño propuesto.'}
                                        </p>
                                    </div>
                                    <a 
                                      href={deliveryLink} 
                                      target="_blank" 
                                      rel="no-referrer"
                                      className={`inline-flex items-center gap-3 px-8 py-4 ${isFinalized ? 'bg-apc-pink shadow-apc-pink/20' : 'bg-slate-900'} text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:opacity-90 hover:shadow-xl transition-all transform hover:-translate-y-1 tour-material`}
                                    >
                                        {isFinalized ? 'Ver material Final' : 'Ver Material para Revisión'}
                                        <Icons.Ai className="w-4 h-4" />
                                    </a>
                                </div>
                            ) : (
                                <div className="p-10 bg-slate-50 rounded-[1.5rem] text-center">
                                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No hay links de entrega registrados aún.</p>
                                </div>
                            )}

                            {/* Approval Controls */}
                            {project.enStandby ? (
                                <div className="space-y-6 pt-6 border-t border-slate-100 animate-fadeIn">
                                    <div className="space-y-3 tour-comentarios">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Tus Comentarios o Ajustes</label>
                                        <textarea 
                                          value={comentario}
                                          onChange={(e) => setComentario(e.target.value)}
                                          className="w-full min-h-[150px] p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-apc-pink transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                          placeholder="Ej: El logotipo debe ser un 10% más grande y cambiar el color de fondo a..."
                                        />
                                        <p className="text-[9px] text-slate-400 font-bold uppercase italic leading-tight px-1">
                                            Para agilizar los ajustes y entregarte el material final lo antes posible, por favor sé lo más específico y detallado posible al describir los cambios.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 tour-acciones">
                                        <button 
                                          disabled={isSubmitting}
                                          onClick={handleSolicitarCambios}
                                          className="py-4 px-6 border-2 border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Icons.Trash className="w-3 h-3" /> Tengo Cambios
                                        </button>
                                        <button 
                                          disabled={isSubmitting}
                                          onClick={handleAprobar}
                                          className="py-4 px-6 bg-apc-pink text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-apc-pink/30 flex items-center justify-center gap-2"
                                        >
                                            <Icons.Ai className="w-3 h-3" /> Aprobar Material
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4 text-slate-400">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                                        <Icons.Plus size={16} />
                                    </div>
                                    {isFinalized ? (
                                        <a href={deliveryLink} target="_blank" rel="no-referrer" className="text-[10px] font-bold uppercase tracking-widest leading-tight hover:text-apc-pink hover:underline">
                                           Ver material entregado
                                        </a>
                                    ) : (
                                        <p className="text-[10px] font-bold uppercase tracking-widest leading-tight">Este material actualmente está siendo procesado por la agencia.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Support Banner */}
                    <div className="bg-apc-green/5 border border-apc-green/10 p-6 rounded-[1.5rem] flex items-center gap-4">
                        <div className="w-10 h-10 bg-apc-green/20 rounded-xl flex items-center justify-center text-apc-green">
                            <Icons.TrendingUp size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-apc-green uppercase tracking-widest">Protocolo de Calidad</p>
                            <p className="text-[11px] font-medium text-slate-500">Toda aprobación o solicitud de cambio queda registrada en el historial para asegurar el cumplimiento de los tiempos de entrega acordados.</p>
                        </div>
                    </div>
                </div>
            </div>
            {user && (
                <AgencyHubDetailTour 
                    userId={user.id} 
                    tutorialVisto={!!user.tutorialDetalleVisto} 
                    runManual={iniciarTutorialDetalle} 
                    setRunManual={setIniciarTutorialDetalle} 
                />
            )}
        </div>
    );
};

export default AgencyHubODTDetail;
