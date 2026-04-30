
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useODT } from './ODTContext';
import { UserRole } from './types';
import {Icons} from './constants';
import { db } from './firebase';
import { ref, set } from 'firebase/database';
import AgencyHubDashboardTour from './AgencyHubDashboardTour';

const AgencyHubView: React.FC = () => {
  const { user, projects, clients, users } = useODT();
  const navigate = useNavigate();
  const [selectedBrandId, setSelectedBrandId] = useState<string | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iniciarTutorial, setIniciarTutorial] = useState(false);
  const [formSolicitud, setFormSolicitud] = useState({
    marca: '',
    tipoMaterial: '',
    campana: '',
    descripcion: '',
    objetivo: '',          // NUEVO
    posicionamiento: '',   // NUEVO
    insights: '',          // NUEVO
    referencias: ''        // NUEVO
  });

  // Filter projects by assigned brands
  const assignedClients = useMemo(() => {
    if (!user) return [];
    return clients.filter(c => user.marcasAsignadas?.includes(c.id));
  }, [clients, user]);

  // Target client for New ODT and Executive info
  const targetClient = useMemo(() => {
    if (selectedBrandId !== 'all') {
      return assignedClients.find(c => c.id === selectedBrandId) || assignedClients[0];
    }
    return assignedClients[0];
  }, [assignedClients, selectedBrandId]);

  // Assigned Executive data
  const ejecutivo = useMemo(() => {
    if (!targetClient) return null;
    const execId = targetClient.assignedExecutives?.[0];
    if (!execId) return null;
    return users.find(u => u.id === execId);
  }, [targetClient, users]);

  // Filter projects by assigned brands
  const filteredProjects = useMemo(() => {
    if (!user) return [];
    let list = projects.filter(p => user.marcasAsignadas?.includes(p.clientId));
    
    if (selectedBrandId !== 'all') {
      list = list.filter(p => p.clientId === selectedBrandId);
    }
    
    return list.sort((a, b) => {
        const dateA = a.fecha_entrega ? new Date(a.fecha_entrega).getTime() : Infinity;
        const dateB = b.fecha_entrega ? new Date(b.fecha_entrega).getTime() : Infinity;
        return dateA - dateB;
    });
  }, [projects, user, selectedBrandId]);

  // 2. Función para guardar la ODT pre-armada en Firebase:
  const handleEnviarSolicitud = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = Date.now();
      const newId = `SOL-${now}`;
      const selectedClient = assignedClients.find(c => c.name === formSolicitud.marca) || targetClient;

      const newRequest = {
        id: newId,
        clientId: selectedClient?.id || 'GLOBAL',
        empresa: selectedClient?.name || formSolicitud.marca,
        marca: formSolicitud.marca,
        tipoMaterial: formSolicitud.tipoMaterial,
        producto: formSolicitud.campana,
        comentariosCliente: formSolicitud.descripcion,
        objetivo: formSolicitud.objetivo,               // NUEVO
        posicionamiento: formSolicitud.posicionamiento, // NUEVO
        insights: formSolicitud.insights,               // NUEVO
        referencias: formSolicitud.referencias,         // NUEVO
        etapa_actual: 'Nueva Solicitud Cliente',
        etapaActual: 'Nueva Solicitud Cliente',
        status: 'Borrador',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        origen: 'Agency Hub',
        ownerId: user.id,
        assignedExecutives: selectedClient?.assignedExecutives || (ejecutivo ? [ejecutivo.id] : []),
        comentarios: [
          {
            id: `sys-${now}`,
            authorId: user.id,
            authorName: user.name,
            text: `ODT SOLICITADA DESDE EL HUB: ${formSolicitud.descripcion}`,
            createdAt: new Date().toISOString(),
            isSystemEvent: true
          }
        ]
      };

      await set(ref(db, `projects/${newId}`), newRequest);
      
      alert("Solicitud enviada exitosamente. Tu ejecutivo la revisará pronto.");
      setIsModalOpen(false);
      setFormSolicitud({ 
        marca: '', tipoMaterial: '', campana: '', descripcion: '',
        objetivo: '', posicionamiento: '', insights: '', referencias: '' 
      });
    } catch (error) {
      console.error("Error al crear solicitud:", error);
      alert("Error al enviar la solicitud. Por favor intenta de nuevo.");
    }
  }, [user, assignedClients, formSolicitud, targetClient, ejecutivo]);

  // Helper for status translation
  const translateStatusForClient = (etapaActual: string, enStandby?: boolean) => {
    if (enStandby) return { text: '✅ Lista para Revisión', color: 'bg-apc-pink text-white' };
    
    const etapaUpper = etapaActual.toUpperCase();
    if (etapaUpper.includes('APROBADA') || etapaUpper.includes('FINALIZADA') || etapaUpper.includes('ADMINISTRACIÓN') || etapaUpper.includes('CIERRE')) {
      return { text: '🎉 Entregada', color: 'bg-emerald-100 text-emerald-700' };
    }
    
    return { text: '⚙️ En Proceso', color: 'bg-slate-100 text-slate-500' };
  };

  if (!user || user.role !== UserRole.Cliente) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400 font-bold uppercase tracking-widest">
        Acceso no autorizado
      </div>
    );
  }

  const handleViewDetail = (id: string) => {
    navigate(`/agency-hub/odt/${id}`);
  };

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-striped-green opacity-[0.03] pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Hola, <span className="text-apc-pink">{user.name}</span></h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Bienvenido a tu Agency Hub • Monitoreo de Proyectos en Tiempo Real</p>
        </div>
        
        <div className="flex gap-4 relative z-10 items-center">
          <button 
            onClick={() => setIniciarTutorial(true)}
            className="px-4 py-2 bg-white hover:bg-apc-pink hover:text-white text-apc-pink rounded-xl border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            ℹ️ Guía de la pantalla
          </button>
          <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-center min-w-[120px]">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marcas</p>
             <p className="text-xl font-black text-slate-800">{assignedClients.length}</p>
          </div>
          <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-center min-w-[120px]">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Proyectos</p>
             <p className="text-xl font-black text-slate-800">{filteredProjects.length}</p>
          </div>
        </div>
      </header>

      {/* Tarjeta de Perfil y Botón de Nueva Solicitud */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-xl border border-slate-100 tour-perfil">
        
        {/* Datos del Ejecutivo Actualizados */}
        <div className="flex items-center gap-6">
          <img 
            src={ejecutivo?.fotoUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'} 
            alt="Ejecutivo" 
            className="w-20 h-20 rounded-full object-cover border-4 border-slate-50 shadow-inner bg-slate-100"
          />
          <div>
            <p className="text-[10px] text-apc-pink font-black uppercase tracking-widest leading-none mb-1">Tu Ejecutivo Asignado</p>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              {ejecutivo?.nombreCompleto || ejecutivo?.name || 'Buscando ejecutivo...'}
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{ejecutivo?.puestoPublico || 'Ejecutivo de Cuentas'}</p>
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <Icons.Project className="w-3 h-3 text-apc-pink" />
                <span className="font-bold">Teléfono:</span> 
                {ejecutivo?.telefonoPublico ? (
                  <a 
                    href={`tel:${ejecutivo.telefonoPublico}`} 
                    className="text-emerald-600 hover:text-emerald-700 hover:underline transition-colors font-bold"
                  >
                    {ejecutivo.telefonoPublico}
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No asignado</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <Icons.Ai className="w-3 h-3 text-emerald-500" />
                <span className="font-bold">Email:</span> 
                {ejecutivo?.emailPublico ? (
                  <a 
                    href={`mailto:${ejecutivo.emailPublico}`} 
                    className="text-emerald-600 hover:text-emerald-700 hover:underline transition-colors font-bold lowercase"
                  >
                    {ejecutivo.emailPublico}
                  </a>
                ) : ejecutivo?.email || ejecutivo?.username ? (
                   <span className="lowercase font-bold">{ejecutivo?.email || ejecutivo?.username}</span>
                ) : (
                  <span className="text-slate-400 italic font-bold">No asignado</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Botón para solicitar ODT */}
        <div className="mt-8 md:mt-0 flex flex-col items-center md:items-end gap-3 bg-slate-50 p-6 rounded-2xl border border-slate-100 md:min-w-[240px] tour-solicitar">
          <p className="text-apc-pink font-semibold mb-2">Solicitar ODT nueva</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest py-4 px-8 rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
          >
            <Icons.Plus className="w-4 h-4" /> Solicitar ODT
          </button>
        </div>
      </div>

      {/* Brand Selector Tabs */}
      {assignedClients.length > 1 && (
        <div className="flex gap-2 p-1 bg-slate-100/50 rounded-2xl w-fit border border-slate-100 tour-marcas">
           <button 
             onClick={() => setSelectedBrandId('all')}
             className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
               selectedBrandId === 'all' ? 'bg-white text-apc-pink shadow-md' : 'text-slate-400 hover:text-slate-600'
             }`}
           >
             Todas las Marcas
           </button>
           {assignedClients.map(c => (
             <button 
               key={c.id}
               onClick={() => setSelectedBrandId(c.id)}
               className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                 selectedBrandId === c.id ? 'bg-white text-apc-pink shadow-md' : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               {c.name}
             </button>
           ))}
        </div>
      )}

      {/* Projects Timeline/List */}
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden tour-tabla">
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
           <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
             <Icons.Project className="w-4 h-4" /> Proyectos Activos
           </h3>
           <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
             Mostrando {filteredProjects.length} proyectos
           </div>
        </div>
        
        {filteredProjects.length === 0 ? (
          <div className="p-20 text-center space-y-6">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              <Icons.Search size={32} />
            </div>
            <div>
              <p className="text-slate-600 font-black uppercase tracking-widest text-sm">Sin proyectos activos</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 px-10">Actualmente no hay proyectos activos para tus marcas asignadas.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Identificador</th>
                  <th className="px-8 py-5">Proyecto / Material</th>
                  <th className="px-8 py-5">Estatus</th>
                  <th className="px-8 py-5">Entrega Prometida</th>
                  <th className="px-8 py-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProjects.map(p => {
                  const status = translateStatusForClient(p.etapa_actual, p.enStandby);
                  return (
                    <tr key={p.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="px-8 py-6">
                        <span className="font-mono text-xs font-black text-slate-300 group-hover:text-apc-pink transition-colors">#{p.id}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 uppercase text-sm leading-tight">{p.producto}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.marca} • {p.category}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Icons.Calendar className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : 'POR DEFINIR'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleViewDetail(p.id)}
                          className="px-6 py-3 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-apc-pink hover:shadow-lg hover:shadow-apc-pink/20 transition-all transform active:scale-95 tour-boton-detalle"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-apc-pink/5 border border-apc-pink/10 p-6 rounded-3xl flex items-center gap-4">
        <div className="w-10 h-10 bg-apc-pink rounded-full flex items-center justify-center text-white">
          <Icons.Ai size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black text-apc-pink uppercase tracking-widest">Soporte Agency Hub</p>
          <p className="text-[11px] font-bold text-slate-500">Si encuentras alguna discrepancia o necesitas ayuda con una ODT, contacta a tu Ejecutivo de Cuentas asignado.</p>
        </div>
      </div>

      {/* Modal Nueva ODT (Pre-armado) */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-start z-[1000] p-4 pt-[95px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-fadeIn max-h-[calc(100vh-120px)] overflow-y-auto relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
              title="Cerrar"
            >
              <Icons.Plus className="w-5 h-5 rotate-45" />
            </button>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Nueva Solicitud de ODT</h2>
            <p className="text-sm text-slate-500 font-medium mb-6">Completa los datos para iniciar un nuevo proyecto.</p>
            
            <form onSubmit={handleEnviarSolicitud} className="flex flex-col gap-5">
              
              {/* Selector de Marca */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca *</label>
                <select 
                  required
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all appearance-none"
                  value={formSolicitud.marca}
                  onChange={(e) => setFormSolicitud({...formSolicitud, marca: e.target.value})}
                >
                  <option value="">Selecciona una marca...</option>
                  {assignedClients.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  {assignedClients.length === 0 && (
                    <>
                      <option value="Sanfer">Sanfer</option>
                      <option value="Ferring">Ferring</option>
                    </>
                  )}
                </select>
              </div>

              {/* Campaña */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la Campaña *</label>
                <input 
                  type="text" required 
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all"
                  placeholder="Ej: Campaña Lanzamiento Q3"
                  value={formSolicitud.campana}
                  onChange={(e) => setFormSolicitud({...formSolicitud, campana: e.target.value})}
                />
              </div>

              {/* Tipo de Material */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Material *</label>
                <input 
                  type="text" required 
                  placeholder="Ej: Video, Brochure, Post..." 
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all"
                  value={formSolicitud.tipoMaterial}
                  onChange={(e) => setFormSolicitud({...formSolicitud, tipoMaterial: e.target.value})}
                />
              </div>

              {/* Descripción Extensa */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción Detallada *</label>
                <textarea 
                  required rows={3} 
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all resize-none"
                  placeholder="Describe de forma extensa el material o campaña que estás solicitando..."
                  value={formSolicitud.descripcion}
                  onChange={(e) => setFormSolicitud({...formSolicitud, descripcion: e.target.value})}
                ></textarea>
              </div>

               {/* Objetivo */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Objetivo de la Campaña / Material *</label>
                <input 
                  type="text" required 
                  placeholder="Ej: Aumentar el conocimiento del producto en..." 
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all"
                  value={formSolicitud.objetivo}
                  onChange={(e) => setFormSolicitud({...formSolicitud, objetivo: e.target.value})}
                />
              </div>

              {/* Posicionamiento */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Posicionamiento *</label>
                <input 
                  type="text" required 
                  placeholder="Ej: El único tratamiento de una sola dosis..." 
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all"
                  value={formSolicitud.posicionamiento}
                  onChange={(e) => setFormSolicitud({...formSolicitud, posicionamiento: e.target.value})}
                />
              </div>

              {/* Insights Clave */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Insights Clave del Producto</label>
                <textarea 
                  rows={2} 
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all resize-none"
                  placeholder="Ej: Los pacientes prefieren tratamientos sin sabor..."
                  value={formSolicitud.insights}
                  onChange={(e) => setFormSolicitud({...formSolicitud, insights: e.target.value})}
                ></textarea>
              </div>

              {/* Referencias o Materiales */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencias o Materiales (Links)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Drive con logotipos o manual de marca..." 
                  className="w-full border-2 border-slate-100 p-4 rounded-2xl bg-slate-50 outline-none focus:border-apc-pink font-bold text-slate-700 transition-all"
                  value={formSolicitud.referencias}
                  onChange={(e) => setFormSolicitud({...formSolicitud, referencias: e.target.value})}
                />
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    
    <AgencyHubDashboardTour 
      userId={user.id} 
      tutorialVisto={!!user.tutorialDashboardVisto} 
      runManual={iniciarTutorial} 
      setRunManual={setIniciarTutorial} 
    />
    </>
  );
};

export default AgencyHubView;
