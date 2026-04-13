import React, { useState, useMemo } from 'react';
import { useODT } from './ODTContext';
import { UserRole, Client } from './types';
import { Icons } from './constants';
import NewODTForm from './NewODTForm';
import { ProjectTable } from './ProjectTable';

interface ClientsViewProps {
  onViewProject?: (id: string) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ onViewProject }) => {
  const { user, clients, projects, users, addClient, updateClient, removeClient, reassignProjectAndFolder, checkSLA } = useODT();
  const { Edit, Trash, Users: UsersIcon, Folder, Plus, ChevronLeft, Clients: ClientsIcon, Ai, Search } = Icons;
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [creatingODTForClient, setCreatingODTForClient] = useState<Client | null>(null);
  const [transferClient, setTransferClient] = useState<Client | null>(null);
  const [targetOwners, setTargetOwners] = useState<string[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [renamingName, setRenamingName] = useState('');

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDeliverable, setFilterDeliverable] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  const [dialog, setDialog] = useState<{ type: 'alert' | 'confirm', message: string, onConfirm?: () => void } | null>(null);

  const canCreateClient = user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera;
  const isLeader = user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider;

  const filteredClients = useMemo(() => {
    if (!clients || !user) return [];
    let base = clients;
    // Los ejecutivos operativos del área de cuentas (Cuentas_Opera) solo ven sus carpetas asignadas
    if (user.role === UserRole.Cuentas_Opera) {
      base = clients.filter(c => c.assignedExecutives?.includes(user.id));
    }
    
    if (searchTerm) {
      base = base.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    return base;
  }, [clients, user, searchTerm]);

  const accountsUsers = useMemo(() => 
    (users || []).filter(u => {
      const hasRole = (usr: User, role: UserRole) => usr.role === role || (usr.roles && usr.roles.includes(role));
      // Exclude Admins even if they have accounts roles
      if (hasRole(u, UserRole.Admin)) return false;
      return u.role === UserRole.Cuentas_Opera || u.role === UserRole.Cuentas_Lider;
    }),
    [users]
  );

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;
    try {
      await addClient(newClientName);
      setNewClientName('');
      setIsCreatingClient(false);
      setDialog({ type: 'alert', message: `Carpeta "${newClientName}" creada correctamente.` });
    } catch {
      setDialog({ type: 'alert', message: "Error al crear la carpeta." });
    }
  };

  const handleQuickTransfer = async () => {
    if (!transferClient || targetOwners.length === 0) return;
    setDialog({
      type: 'confirm',
      message: `¿Transferir toda la cartera de "${transferClient.name}" a los ejecutivos seleccionados?`,
      onConfirm: async () => {
        await reassignProjectAndFolder('', transferClient.id, targetOwners, true);
        setTransferClient(null);
        setDialog({ type: 'alert', message: "Cartera transferida exitosamente." });
      }
    });
  };

  const handleRenameClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !renamingName.trim()) return;
    try {
      await updateClient(editingClient.id, { name: renamingName.trim() });
      setEditingClient(null);
      setRenamingName('');
      setDialog({ type: 'alert', message: "Nombre de carpeta actualizado correctamente." });
    } catch {
      setDialog({ type: 'alert', message: "Error al renombrar la carpeta." });
    }
  };

  const handleDeleteClient = (client: Client) => {
    if (!isLeader) {
      setDialog({ type: 'alert', message: "No tiene permisos para realizar esta acción." });
      return;
    }
    const clientODTs = (projects || []).filter(p => p.clientId === client.id);
    if (clientODTs.length > 0) {
      setDialog({ 
        type: 'alert', 
        message: "No se puede eliminar una carpeta que contiene ODTs. Primero debe transferir o eliminar las ODTs asociadas." 
      });
      return;
    }

    setDialog({
      type: 'confirm',
      message: `¿Está seguro que desea eliminar la carpeta "${client.name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          await removeClient(client.id);
          setDialog({ type: 'alert', message: "Carpeta eliminada correctamente." });
        } catch {
          setDialog({ type: 'alert', message: "Error al eliminar la carpeta." });
        }
      }
    });
  };

  if (!user || !clients) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apc-green"></div>
      </div>
    );
  }

  if (viewingClient) {
    const allClientODTs = (projects || []).filter(p => p.clientId === viewingClient.id);
    
    const categories = Array.from(new Set(allClientODTs.map(p => p.category).filter(Boolean))).sort();
    const subCategories = Array.from(new Set(allClientODTs.map(p => p.subCategory).filter(Boolean))).sort();
    const brands = Array.from(new Set(allClientODTs.map(p => p.marca).filter(Boolean))).sort();

    const filteredODTs = allClientODTs.filter(p => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (p.empresa || '').toLowerCase().includes(searchLower) || 
        (p.id || '').toLowerCase().includes(searchLower) ||
        (p.marca || '').toLowerCase().includes(searchLower) ||
        (p.producto || '').toLowerCase().includes(searchLower) ||
        (p.subCategory || '').toLowerCase().includes(searchLower);
        
      const matchesCategory = !filterCategory || p.category === filterCategory;
      const matchesDeliverable = !filterDeliverable || p.subCategory === filterDeliverable;
      const matchesBrand = !filterBrand || p.marca === filterBrand;
      return matchesSearch && matchesCategory && matchesDeliverable && matchesBrand;
    });

    return (
      <div className="space-y-6 animate-fadeIn">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <button 
              onClick={() => {
                setViewingClient(null);
                setSearchQuery('');
                setFilterCategory('');
                setFilterDeliverable('');
                setFilterBrand('');
              }}
              className="text-slate-400 hover:text-slate-900 font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-2 transition-colors"
            >
              <ChevronLeft /> VOLVER A CARPETAS
            </button>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{viewingClient.name}</h1>
            <p className="text-slate-500 font-medium text-sm flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-apc-green rounded-full"></span>
              ODTs del Cliente
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-4xl">
            <div className="flex-1 w-full bg-gray-50 p-2 rounded-xl border border-gray-200 flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text"
                  placeholder="Buscar por nombre o ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:border-apc-pink focus:ring-2 focus:ring-apc-pink/20 outline-none transition-all"
                />
              </div>

              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-apc-pink focus:ring-2 focus:ring-apc-pink/20 outline-none transition-all"
              >
                <option value="">Todas las Categorías</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select 
                value={filterDeliverable}
                onChange={(e) => setFilterDeliverable(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-apc-pink focus:ring-2 focus:ring-apc-pink/20 outline-none transition-all"
              >
                <option value="">Todos los Entregables</option>
                {subCategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>

              <select 
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:border-apc-pink focus:ring-2 focus:ring-apc-pink/20 outline-none transition-all"
              >
                <option value="">Todas las Marcas</option>
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setCreatingODTForClient(viewingClient)}
              className="flex items-center gap-2 px-6 py-3 bg-apc-green text-white font-black text-xs rounded-xl hover:bg-apc-green/80 transition-all shadow-lg shadow-apc-green/20 whitespace-nowrap"
            >
              <Plus /> NUEVA ODT
            </button>
          </div>
        </header>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
           {filteredODTs.length === 0 ? (
             <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                   <Folder />
                </div>
                <p className="text-slate-400 italic font-medium">
                  {allClientODTs.length === 0 ? "Esta carpeta está vacía. No hay ODTs registradas." : "No se encontraron ODTs con los filtros seleccionados."}
                </p>
                {(searchQuery || filterCategory || filterDeliverable || filterBrand) && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCategory('');
                      setFilterDeliverable('');
                      setFilterBrand('');
                    }}
                    className="mt-4 text-apc-pink font-black text-xs uppercase tracking-widest hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
             </div>
           ) : (
             <ProjectTable 
               projects={filteredODTs} 
               onView={(id: string) => onViewProject && onViewProject(id)} 
               checkSLA={checkSLA} 
               users={users}
             />
           )}
        </div>

        {creatingODTForClient && (
          <NewODTForm client={creatingODTForClient} onClose={() => setCreatingODTForClient(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Archivo de Clientes</h1>
          <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-apc-pink rounded-full"></span>
            Gestión de Carpetas Maestras ISO 9001
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-2xl justify-end">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Buscar cliente por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl font-bold focus:border-apc-pink focus:ring-2 focus:ring-apc-pink/20 outline-none transition-all shadow-sm"
            />
          </div>
          
          {canCreateClient && (
            <button 
              onClick={() => setIsCreatingClient(true)}
              className="flex items-center gap-2 px-6 py-3 bg-apc-green text-white font-black text-xs rounded-xl hover:bg-apc-green/80 transition-all shadow-lg shadow-apc-green/20 whitespace-nowrap"
            >
              <Plus /> NUEVA CARPETA DE CLIENTE
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClients.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Folder />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">No hay carpetas de clientes</h3>
            <p className="text-slate-500 text-sm mb-6">Comienza creando la primera carpeta maestra para organizar las ODTs.</p>
            {canCreateClient && (
              <button 
                onClick={() => setIsCreatingClient(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-apc-green text-white font-black text-xs rounded-xl hover:bg-apc-green/80 transition-all"
              >
                <Plus /> CREAR MI PRIMERA CARPETA
              </button>
            )}
          </div>
        ) : (
          filteredClients.map(client => {
            const clientODTs = (projects || []).filter(p => p.clientId === client.id);
            const activeODTs = clientODTs.filter(p => p.status !== 'Finalizado' && p.status !== 'Cancelado').length;
            const owners = (users || []).filter(u => client.assignedExecutives?.includes(u.id));
            
            return (
              <div key={client.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/30 hover:shadow-2xl hover:border-apc-green/30 transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white group-hover:bg-apc-green transition-colors">
                      <ClientsIcon />
                    </div>
                    <div className="flex gap-1">
                      {canCreateClient && (
                        <>
                          <button 
                            onClick={() => {
                              setEditingClient(client);
                              setRenamingName(client.name);
                            }}
                            title="Renombrar Carpeta"
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-apc-green transition-all"
                          >
                            <Edit />
                          </button>
                          {isLeader && (
                            <button 
                              onClick={() => handleDeleteClient(client)}
                              title="Eliminar Carpeta"
                              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-apc-pink transition-all"
                            >
                              <Trash />
                            </button>
                          )}
                        </>
                      )}
                      {isLeader && (
                        <button 
                          onClick={() => {
                            setTransferClient(client);
                            setTargetOwners(client.assignedExecutives || []);
                          }}
                          title="Transferir Cartera"
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
                        >
                          <UsersIcon />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 leading-tight mb-1 truncate">{client.name}</h3>
                  <p className="text-[10px] text-slate-400 font-black mb-4 uppercase truncate">Ejecutivos: {owners.map(o => o.name).join(', ') || 'SISTEMA'}</p>
                  
                  <div className="flex gap-4 mb-8">
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activas</p>
                       <p className="text-lg font-black text-slate-900">{activeODTs}</p>
                     </div>
                     <div className="w-px h-8 bg-slate-100"></div>
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico</p>
                       <p className="text-lg font-black text-slate-400">{clientODTs.length}</p>
                     </div>
                  </div>
                </div>

                <button 
                  onClick={() => setViewingClient(client)}
                  className="w-full py-3 bg-slate-50 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl border border-slate-100 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Folder /> VER ODTs DEL CLIENTE
                </button>
              </div>
            );
          })
        )}
      </div>

      {isCreatingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Nueva Carpeta</h2>
            <p className="text-xs text-slate-500 font-medium mb-6">El nombre debe coincidir exactamente con el nombre legal o comercial de la empresa.</p>
            <form onSubmit={handleCreateClient} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nombre de Empresa</label>
                  <input autoFocus value={newClientName} onChange={e => setNewClientName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-apc-green outline-none font-bold" placeholder="Ejem: Laboratorios Roche S.A." />
               </div>
               <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsCreatingClient(false)} className="flex-1 py-3 text-xs font-black text-slate-400 uppercase hover:text-slate-600">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-apc-green text-white font-black text-xs rounded-xl hover:bg-apc-green/80 transition-all shadow-xl shadow-apc-green/20">CREAR CARPETA</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn relative z-[1110]">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Renombrar Carpeta</h2>
            <p className="text-xs text-slate-500 font-medium mb-6">Modifique el nombre de la carpeta maestra.</p>
            <form onSubmit={handleRenameClient} className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nuevo Nombre</label>
                  <input autoFocus value={renamingName} onChange={e => setRenamingName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-apc-green outline-none font-bold" placeholder="Nombre de la empresa" />
               </div>
               <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditingClient(null)} className="flex-1 py-3 text-xs font-black text-slate-400 uppercase hover:text-slate-600">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-apc-green text-white font-black text-xs rounded-xl hover:bg-apc-green/80 transition-all shadow-xl shadow-apc-green/20">GUARDAR CAMBIOS</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {transferClient && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
           <div className="bg-white p-8 rounded-3xl w-full max-w-md border-t-8 border-slate-900 animate-fadeIn relative z-[1210]">
              <h2 className="text-xl font-black mb-1">Transferir Cartera</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Cliente: {transferClient.name}</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Ejecutivos Asignados</label>
                  <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 border-2 rounded-xl">
                    {accountsUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={targetOwners.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTargetOwners([...targetOwners, u.id]);
                            } else {
                              setTargetOwners(targetOwners.filter(id => id !== u.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-apc-green focus:ring-apc-green"
                        />
                        <span className="text-sm font-bold text-slate-700">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-500 italic bg-slate-50 p-4 rounded-xl">
                  * Al transferir, los ejecutivos seleccionados serán dueños de la carpeta y de TODAS sus ODTs históricas y activas.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => setTransferClient(null)} className="flex-1 py-3 text-xs font-black text-slate-400 uppercase">Cerrar</button>
                  <button 
                    disabled={targetOwners.length === 0}
                    onClick={handleQuickTransfer} 
                    className="flex-2 px-8 py-3 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
                  >EJECUTAR TRASPASO</button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Custom Dialog */}
      {dialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-fadeIn text-center relative z-[2010]">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${dialog.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-apc-green/10 text-apc-green'}`}>
              <Ai />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">
              {dialog.type === 'confirm' ? 'Confirmar Acción' : 'Notificación'}
            </h3>
            <p className="text-slate-500 font-medium text-sm mb-8">{dialog.message}</p>
            <div className="flex gap-3">
              {dialog.type === 'confirm' && (
                <button 
                  onClick={() => setDialog(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-xs rounded-xl hover:bg-slate-200 transition-all"
                >
                  CANCELAR
                </button>
              )}
              <button 
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  setDialog(null);
                }}
                className={`flex-1 py-3 text-white font-black text-xs rounded-xl transition-all shadow-lg ${dialog.type === 'confirm' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-apc-green hover:bg-apc-green/80 shadow-apc-green/20'}`}
              >
                {dialog.type === 'confirm' ? 'CONFIRMAR' : 'ENTENDIDO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsView;