
import React, { useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { useODT } from './ODTContext';
import { Project } from './types';
import { Icons } from './constants';
import { OPERATIVE_AREAS, CATEGORIES_CONFIG } from './workflowConfig';
import { structureBrief } from './services/geminiService';

interface EditODTFormProps {
  project: Project;
  onClose: () => void;
}

const EditODTForm: React.FC<EditODTFormProps> = ({ project, onClose }) => {
  const { projects, updateFullProject } = useODT();
  const [loading, setLoading] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);

  // Backwards Compatibility Mapping
  const initialTipoCargo = project.tipoCargo || (project.facturado ? 'extra' : 'iguala');
  const initialComplejidad = project.complejidad || 'Media';
  const initialPaginas = project.paginas_estimadas || 0;
  const initialMinutos = project.minutos_video_estimados || 0;
  const initialValorTeorico = project.monto_valor_teorico || 0;

  // Form State
  const [marca, setMarca] = useState(project.marca || '');
  const [producto, setProducto] = useState(project.producto || '');
  const [fechaEntrega, setFechaEntrega] = useState(project.fecha_entrega || '');
  const [category, setCategory] = useState(project.category || '');
  const [subCategory, setSubCategory] = useState(project.subCategory || '');
  const [detalleEntregableCampaña, setDetalleEntregableCampaña] = useState(project.detalleEntregableCampaña || '');
  const [tipoCargo, setTipoCargo] = useState<'extra' | 'iguala' | 'interno'>(initialTipoCargo);
  const [monto, setMonto] = useState(project.monto_proyectado || 0);
  const [montoValorTeorico, setMontoValorTeorico] = useState(initialValorTeorico);
  const [complejidad, setComplejidad] = useState<'Baja' | 'Media' | 'Alta'>(initialComplejidad);
  const [paginasEstimadas, setPaginasEstimadas] = useState(initialPaginas);
  const [minutosVideoEstimados, setMinutosVideoEstimados] = useState(initialMinutos);
  const [justification, setJustification] = useState(project.justificacion_no_facturado || '');
  const [selectedAreas, setSelectedAreas] = useState<string[]>(project.areas_seleccionadas || []);
  const [fechasInternas, setFechasInternas] = useState<Record<string, string>>(project.fechasInternas || {});
  const [brief, setBrief] = useState(project.brief || '');
  const [links, setLinks] = useState<string[]>(project.referenceLinks && project.referenceLinks.length > 0 ? project.referenceLinks : ['']);

  const existingBrands = Array.from(new Set(
    (projects || [])
      .filter(p => p.clientId === project.clientId)
      .map(p => p.marca)
      .filter(Boolean)
  )).sort();

  const handleAddLink = () => setLinks([...links, '']);
  const handleLinkChange = (idx: number, val: string) => {
    const newLinks = [...links];
    newLinks[idx] = val;
    setLinks(newLinks);
  };

  const toggleArea = (area: string) => {
    setSelectedAreas(prev => {
      const isSelected = prev.includes(area);
      if (isSelected) {
        const newFechas = { ...fechasInternas };
        delete newFechas[area];
        setFechasInternas(newFechas);
        return prev.filter(a => a !== area);
      } else {
        return [...prev, area];
      }
    });
  };

  const handleFechaInternaChange = (area: string, fecha: string) => {
    setFechasInternas(prev => ({ ...prev, [area]: fecha }));
  };

  const handleStructureBrief = async () => {
    if (!brief || brief === '<p><br></p>') {
      alert("El brief está vacío. Escribe algo antes de estructurarlo.");
      return;
    }
    
    setIsFormatting(true);
    try {
      const structured = await structureBrief(brief);
      if (structured) {
        const separator = '<hr/><br/><h3>✨ Propuesta Estructurada por IA</h3><br/>';
        setBrief(prev => prev + separator + structured);
        alert("Brief estructurado exitosamente. Revisa la propuesta al final del documento.");
      } else {
        alert("No se pudo estructurar el brief en este momento.");
      }
    } catch (error) {
      console.error("Error structuring brief:", error);
      alert("Ocurrió un error al procesar el brief con IA.");
    } finally {
      setIsFormatting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAreas.length === 0) {
      alert("Error: Debe seleccionar al menos un área operativa para la ruta ISO.");
      return;
    }

    if (!fechaEntrega) {
      alert("Error: Debe definir primero la Fecha de Entrega Global.");
      return;
    }

    setLoading(true);
    try {
      const updatedProject: Partial<Project> = {
        marca,
        producto,
        fecha_entrega: fechaEntrega,
        fechasInternas,
        category,
        subCategory,
        detalleEntregableCampaña: category === 'Campaña' ? detalleEntregableCampaña : '',
        tipoCargo,
        monto_proyectado: tipoCargo === 'extra' ? monto : 0,
        monto_valor_teorico: tipoCargo === 'iguala' ? montoValorTeorico : 0,
        complejidad,
        paginas_estimadas: paginasEstimadas,
        minutos_video_estimados: minutosVideoEstimados,
        justificacion_no_facturado: tipoCargo !== 'extra' ? justification : '',
        areas_seleccionadas: selectedAreas,
        referenceLinks: links.filter(l => l.trim() !== ''),
        brief
      };
      await updateFullProject(project.id, updatedProject);
      alert(`ODT ${project.id} actualizada exitosamente.`);
      onClose();
    } catch {
      alert("Error al actualizar la ODT.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn relative z-[1010]">
        <header className="bg-apc-green p-6 flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-black tracking-tight">Edición de ODT Master</h2>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mt-1">ISO 9001:2015 - ODT: {project.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca o Producto</label>
              <input 
                required 
                list="client-brands"
                value={marca} 
                onChange={e => setMarca(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold" 
                placeholder="Ejem: Roche, Pfizer..." 
              />
              <datalist id="client-brands">
                {existingBrands.map(b => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de campaña o servicio</label>
              <input required value={producto} onChange={e => setProducto(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold" placeholder="Nombre del proyecto..." />
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de entrega</label>
              <input required type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold" />
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal/categoría</label>
              <select required value={category} onChange={e => {
                const val = e.target.value;
                setCategory(val); 
                if (val === 'Campaña') {
                  setSubCategory('Otro');
                } else {
                  setSubCategory('');
                }
              }} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-black text-sm">
                <option value="">Seleccione Canal...</option>
                {Object.keys(CATEGORIES_CONFIG).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de entregable</label>
              <select required value={subCategory} onChange={e => setSubCategory(e.target.value)} disabled={!category || category === 'Campaña'} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-black text-sm disabled:opacity-50">
                <option value="">Seleccione Tipo...</option>
                {category && CATEGORIES_CONFIG[category].map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
            {category === 'Campaña' && (
              <div className="md:col-span-2 space-y-2 animate-fadeIn">
                <label className="text-[10px] font-black text-apc-pink uppercase tracking-widest">Detalle del Entregable de Campaña (Obligatorio)</label>
                <input 
                  required 
                  value={detalleEntregableCampaña} 
                  onChange={e => setDetalleEntregableCampaña(e.target.value)} 
                  className="w-full px-4 py-3 bg-white border-2 border-apc-pink/20 rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold" 
                  placeholder="Especifique qué entregables incluye esta campaña..." 
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ruta ISO (Áreas Operativas Oficiales)</label>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {OPERATIVE_AREAS.map(area => {
                const isSelected = selectedAreas.includes(area);
                const isInvalid = fechaEntrega && fechasInternas[area] && fechasInternas[area] > fechaEntrega;
                
                return (
                  <div key={area} className="space-y-2">
                    <button 
                      type="button" 
                      onClick={() => toggleArea(area)} 
                      className={`w-full px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter border-2 transition-all ${isSelected ? 'bg-apc-green border-apc-green text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-apc-pink/30'}`}
                    >
                      {area}
                    </button>
                    {isSelected && (
                      <div className="animate-fadeIn space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Deadline {area}</label>
                        <input 
                          required 
                          type="date" 
                          disabled={!fechaEntrega}
                          value={fechasInternas[area] || ''} 
                          onChange={e => handleFechaInternaChange(area, e.target.value)}
                          className={`w-full px-3 py-2 bg-white border-2 rounded-xl text-[11px] font-bold outline-none transition-all ${!fechaEntrega ? 'opacity-50 cursor-not-allowed' : isInvalid ? 'border-red-500 ring-4 ring-red-50' : 'border-slate-100 focus:border-apc-pink'}`}
                        />
                        {isInvalid && (
                          <p className="text-[8px] text-red-500 font-bold uppercase tracking-tighter mt-1">⚠️ posterior a entrega global</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
             </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 contents-section">
            <div className="md:col-span-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Esfuerzo Operativo Estimado</label>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel de Complejidad</label>
              <select value={complejidad} onChange={e => setComplejidad(e.target.value as 'Baja' | 'Media' | 'Alta')} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold text-sm">
                 <option value="Baja">Baja</option>
                 <option value="Media">Media</option>
                 <option value="Alta">Alta</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Páginas / Hojas Estimadas</label>
              <input type="number" min="0" value={paginasEstimadas} onChange={e => setPaginasEstimadas(Number(e.target.value))} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Minutos de Video Estimados</label>
              <input type="number" min="0" value={minutosVideoEstimados} onChange={e => setMinutosVideoEstimados(Number(e.target.value))} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold" />
            </div>
          </section>

          <section className="p-6 border-2 border-apc-green/10 bg-apc-green/5 rounded-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h4 className="font-black text-slate-800 text-sm tracking-tight">Parámetros Financieros</h4>
                 <p className="text-[10px] text-slate-500 font-medium">Define el tipo de cargo para reporte de rentabilidad.</p>
               </div>
               <div className="flex-1 max-w-xs">
                 <select 
                   value={tipoCargo} 
                   onChange={e => setTipoCargo(e.target.value as 'extra' | 'iguala' | 'interno')}
                   className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-green outline-none font-black text-xs uppercase"
                 >
                   <option value="extra">Sí Factura (Extra a Iguala)</option>
                   <option value="iguala">Incluida en Iguala / No Factura</option>
                   <option value="interno">Proyecto Interno (No Facturable)</option>
                 </select>
               </div>
            </div>

            {tipoCargo === 'extra' && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto a Facturar ($)</label>
                <input required type="number" min="0" value={monto} onChange={e => setMonto(Number(e.target.value))} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-green outline-none font-black text-xl" placeholder="0.00" />
              </div>
            )}

            {tipoCargo === 'iguala' && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Teórico (Mercado) ($)</label>
                <input required type="number" min="0" value={montoValorTeorico} onChange={e => setMontoValorTeorico(Number(e.target.value))} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-green outline-none font-black text-xl" placeholder="0.00" />
                <small className="text-slate-500 text-[10px] font-medium block">Indica cuánto costaría este trabajo si se cobrara por separado. Útil para medir rentabilidad.</small>
              </div>
            )}

            {tipoCargo !== 'extra' && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificación / Notas</label>
                <textarea required value={justification} onChange={e => setJustification(e.target.value)} className="w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-apc-pink outline-none font-bold text-sm h-24" placeholder="Notas adicionales sobre el cargo..." />
              </div>
            )}
          </section>

          <section className="space-y-4">
             <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brief Maestro y Requerimientos</label>
             </div>
             <div className="bg-white rounded-xl border overflow-hidden">
                <Editor
                  tinymceScriptSrc="https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.3/tinymce.min.js"
                  value={brief}
                  onEditorChange={(content) => setBrief(content)}
                  init={{
                    height: 400,
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
                    content_style: 'body { font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-size:14px; margin: 1rem; }',
                    paste_data_images: true,
                    promotion: false,
                    branding: false
                  }}
                />
               <div className="p-3 border-t flex justify-end">
                 <button 
                   type="button"
                   onClick={handleStructureBrief}
                   disabled={isFormatting}
                   className="px-4 py-2 bg-slate-100 text-slate-700 text-[10px] font-black rounded-lg hover:bg-slate-200 transition-all uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                 >
                   {isFormatting ? (
                     <>
                       <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                       Procesando con IA...
                     </>
                   ) : (
                     <>
                       <span>✨ Estructurar Brief</span>
                     </>
                   )}
                 </button>
               </div>
             </div>

             <div className="space-y-3 pt-6">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enlace general del proyecto</label>
                  <button type="button" onClick={handleAddLink} className="p-1 text-apc-pink hover:bg-apc-pink/10 rounded-lg transition-all"><Icons.Plus /></button>
                </div>
                {links.map((link, idx) => (
                  <input key={idx} value={link} onChange={e => handleLinkChange(idx, e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-dashed rounded-lg text-xs font-medium outline-none focus:border-apc-pink transition-all" placeholder="https://drive.google.com/..." />
                ))}
             </div>
          </section>

          <footer className="pt-8 border-t flex justify-end gap-3">
             <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-black text-slate-500 hover:text-slate-900 transition-all uppercase">Cancelar</button>
             <button disabled={loading} type="submit" className="px-10 py-3 bg-apc-green text-white text-xs font-black rounded-xl hover:bg-apc-green/80 transition-all shadow-xl disabled:opacity-50">
               {loading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
             </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditODTForm;
