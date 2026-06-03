
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useODT } from './ODTContext';
import { UserRole } from './types';
import {Icons} from './constants';
import AgencyHubDashboardTour from './AgencyHubDashboardTour';
import NewODTForm from './NewODTForm';

const AgencyHubView: React.FC = () => {
  const { user, projects, clients, users } = useODT();
  const navigate = useNavigate();
  const [selectedBrandId, setSelectedBrandId] = useState<string | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iniciarTutorial, setIniciarTutorial] = useState(false);

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

  // Helper for status translation
  const translateStatusForClient = (p: Project) => {
    if (p.enStandby) return { text: '✅ Lista para Revisión', color: 'bg-apc-pink text-white' };
    
    const etapaUpper = (p.etapa_actual || '').toUpperCase();
    const statusUpper = (p.status || '').toUpperCase();
    
    if (statusUpper.includes('FINALIZADO') || statusUpper.includes('PAGO') || etapaUpper.includes('ADMINISTRACIÓN')) {
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
                  const status = translateStatusForClient(p);
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

      {/* Ruta de Calidad APC */}
      <div className="bg-white border border-slate-100 p-8 rounded-3xl space-y-6 shadow-xl shadow-slate-100/50">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-apc-pink rounded-full"></span>
            Ruta de Calidad APC
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Conoce el proceso completo de trazabilidad e inspección por el que pasa cada una de tus solicitudes antes de la entrega final.
          </p>
        </div>

        <div className="w-full relative px-2">
          {/* Thread connection line for lg screens */}
          <div className="absolute top-10 left-12 right-12 h-1 bg-gradient-to-r from-slate-900 via-apc-pink to-emerald-500 rounded-full z-0 hidden lg:block" />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4 relative z-10">
            {[
              { label: 'Cuentas', desc: 'Brief y Filtro Inicial', color: 'bg-slate-900', textColor: 'text-slate-900', pulseColor: 'bg-slate-900/10' },
              { label: 'Creativo', desc: 'Idea y Redacción', color: 'bg-apc-pink', textColor: 'text-apc-pink', pulseColor: 'bg-apc-pink/10' },
              { label: 'Médico', desc: 'SLA Regulatorio', color: 'bg-apc-teal', textColor: 'text-apc-teal', pulseColor: 'bg-apc-teal/10' },
              { label: 'Arte', desc: 'Diseño Gráfico', color: 'bg-amber-500', textColor: 'text-amber-500', pulseColor: 'bg-amber-500/10' },
              { label: 'Audio y Video', desc: 'Producción Audiovisual', color: 'bg-indigo-600', textColor: 'text-indigo-600', pulseColor: 'bg-indigo-600/10' },
              { label: 'Digital', desc: 'Mailing & Ads', color: 'bg-apc-green', textColor: 'text-apc-green', pulseColor: 'bg-apc-green/10' },
              { label: 'Innovación', desc: 'Interactivos Especiales', color: 'bg-purple-600', textColor: 'text-purple-600', pulseColor: 'bg-purple-600/10' },
              { label: 'Cuentas', desc: 'QA y Auditoría Final', color: 'bg-slate-800', textColor: 'text-slate-800', pulseColor: 'bg-slate-800/10' },
              { label: '¡Llega a ti!', desc: 'Entregable Aprobado', color: 'bg-emerald-500', textColor: 'text-emerald-600', pulseColor: 'bg-emerald-500/10', isLast: true },
            ].map((step, idx) => (
              <div 
                key={idx} 
                className="flex flex-col items-center text-center group relative h-full justify-between"
              >
                {/* Flow Node representing point on path */}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 mb-3 flex-shrink-0">
                  {/* Concentric pulse ring */}
                  <div className={`absolute inset-0 rounded-full ${step.pulseColor} opacity-70 scale-95 group-hover:scale-115 group-hover:opacity-90 transition-all duration-300 pointer-events-none`} />
                  
                  {/* Concentric node border */}
                  <div className="absolute inset-2 rounded-full border-2 border-white bg-white shadow-md flex items-center justify-center w-16 h-16 group-hover:shadow-lg transition-all duration-300">
                    <span className={`w-10 h-10 rounded-full text-white text-[11px] font-black flex items-center justify-center shadow-sm ${step.color} transition-transform duration-300 group-hover:scale-110`}>
                      {idx + 1}
                    </span>
                  </div>
                  
                  {/* Desktop connecting arrow - highly visible floating element */}
                  {!step.isLast && (
                    <div className="hidden lg:flex absolute top-10 -right-5 translate-x-1/2 -translate-y-1/2 z-30 items-center justify-center bg-white border-2 border-slate-100 rounded-full w-7 h-7 shadow-[0_3px_10px_rgba(0,0,0,0.12)] text-apc-pink group-hover:text-emerald-500 group-hover:scale-110 group-hover:border-slate-200 transition-all duration-300">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </div>
                  )}

                  {/* Mobile & Small screens connecting symbol (visible on non-lg layouts) */}
                  {!step.isLast && (
                    <span className="absolute -right-4.5 top-10 -translate-y-1/2 text-apc-pink font-black text-xs lg:hidden z-20 bg-white shadow-md border-2 border-slate-50 rounded-full w-6 h-6 flex items-center justify-center group-hover:bg-slate-100 transition-all">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </span>
                  )}
                </div>

                {/* Description details card */}
                <div className="bg-slate-50/55 group-hover:bg-slate-50 border border-slate-100/80 group-hover:border-slate-200 p-2.5 rounded-2xl w-full flex-1 flex flex-col justify-center min-h-[64px] transition-all">
                  <h4 className={`text-[11px] font-black tracking-tight uppercase leading-snug mb-1 ${step.textColor}`}>
                    {step.label}
                  </h4>
                  <p className="text-[8px] leading-snug text-slate-400 font-extrabold uppercase tracking-wider">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200/60 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest italic animate-fadeIn">
            * Cada cambio de fase incluye checks automáticos de control de calidad bajo la certificación ISO 9001:2015.
          </p>
        </div>
      </div>

      {/* Modal Nueva ODT (Pre-armado) */}
      {isModalOpen && targetClient && (
        <NewODTForm 
          client={targetClient} 
          isClient={true} 
          onClose={() => setIsModalOpen(false)} 
        />
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
