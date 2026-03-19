import React, { useState, useMemo } from 'react';
import { useODT } from './ODTContext';
import { UserRole, Client, Project } from './types';
import { Icons } from './constants';
import NewODTForm from './NewODTForm';
import { ProjectTable } from './ProjectTable';

interface ClientsViewProps {
  onViewProject?: (id: string) => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ onViewProject }) => {
  const { user, clients, projects, users, addClient, updateClient, removeClient, reassignProjectAndFolder, checkSLA } = useODT();
  const { Edit, Trash, Users: UsersIcon, Folder, Plus, ChevronLeft, Clients: ClientsIcon, Ai } = Icons;
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [creatingODTForClient, setCreatingODTForClient] = useState<Client | null>(null);
  const [transferClient, setTransferClient] = useState<Client | null>(null);
  const [targetOwner, setTargetOwner] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [renamingName, setRenamingName] = useState('');

  const [dialog, setDialog] = useState<{ type: 'alert' | 'confirm', message: string, onConfirm?: () => void } | null>(null);

  const canCreateClient = user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider || user?.role === UserRole.Cuentas_Opera;
  const isLeader = user?.role === UserRole.Admin || user?.role === UserRole.Cuentas_Lider;

  const accountsUsers = useMemo(() => 
    (users || []).filter(u => u.role === UserRole.Cuentas_Opera || u.role === UserRole.Cuentas_Lider),
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
    } catch (error) {
      setDialog({ type: 'alert', message: "Error al crear la carpeta." });
    }
  };

  const handleQuickTransfer = async () => {
    if (!transferClient || !targetOwner) return;
    setDialog({
      type: 'confirm',
      message: `¿Transferir toda la cartera de "${transferClient.name}" a este nuevo ejecutivo?`,
      onConfirm: async () => {
        await reassignProjectAndFolder('', transferClient.id, targetOwner, true);
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
    } catch (error) {
      setDialog({ type: 'alert', message: "Error al renombrar la carpeta." });
    }
  };

  const handleDeleteClient = (client: Client) => {
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
        } catch (error) {
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
    const clientODTs = (projects || []).filter(p => p.clientId === viewingClient.id);
    return (
      <div className="space-y-6 animate-fadeIn">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <button 
              onClick={() => setViewingClient(null)}
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
          
          <button 
            onClick={() => setCreatingODTForClient(viewingClient)}
            className="flex items-center gap-2 px-6 py-3 bg-apc-green text-white font-black text-xs rounded-xl hover:bg-apc-green/80 transition-all shadow-lg shadow-apc-green/20"
          >
            <Plus /> NUEVA ODT
          </button>
        </header>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
           {clientODTs.length === 0 ? (
             <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                   <Folder />
                </div>
                <p className="text-slate-400 italic font-medium">Esta carpeta está vacía. No hay ODTs registradas.</p>
             </div>
           ) : (
             <ProjectTable 
               projects={clientODTs} 
               onView={(p: Project) => onViewProject && onViewProject(p.id)} 
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
        
        {canCreateClient && (
          <button 
            onClick={() => setIsCreatingClient(true)}
            className="flex items-center gap-2 px-6 py-3 bg-apc-green text-white font-black text-xs rounded-xl hover:bg-apc-green/80 transition-all shadow-lg shadow-apc-green/20"
          >
            <Plus /> NUEVA CARPETA DE CLIENTE
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {clients.length === 0 ? (
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
          clients.map(client => {
            const clientODTs = (projects || []).filter(p => p.clientId === client.id);
            const activeODTs = clientODTs.filter(p => p.status !== 'Finalizado' && p.status !== 'Cancelado').length;
            const owner = (users || []).find(u => u.id === client.ownerId);
            
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
                          <button 
                            onClick={() => handleDeleteClient(client)}
                            title="Eliminar Carpeta"
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-apc-pink transition-all"
                          >
                            <Trash />
                          </button>
                        </>
                      )}
                      {isLeader && (
                        <button 
                          onClick={() => setTransferClient(client)}
                          title="Transferir Cartera"
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
                        >
                          <UsersIcon />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 leading-tight mb-1 truncate">{client.name}</h3>
                  <p className="text-[10px] text-slate-400 font-black mb-4 uppercase truncate">Ejecutivo: {owner?.name || 'SISTEMA'}</p>
                  
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn">
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
           <div className="bg-white p-8 rounded-3xl w-full max-w-md border-t-8 border-slate-900 animate-fadeIn">
              <h2 className="text-xl font-black mb-1">Transferir Cartera</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">Cliente: {transferClient.name}</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Nuevo Dueño de Cuenta</label>
                  <select 
                    value={targetOwner} 
                    onChange={e => setTargetOwner(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 rounded-xl font-bold outline-none appearance-none"
                  >
                    <option value="">-- Seleccione Ejecutivo --</option>
                    {accountsUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                
                <p className="text-[10px] text-slate-500 italic bg-slate-50 p-4 rounded-xl">
                  * Al transferir, el nuevo ejecutivo será dueño de la carpeta y de TODAS sus ODTs históricas y activas.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => setTransferClient(null)} className="flex-1 py-3 text-xs font-black text-slate-400 uppercase">Cerrar</button>
                  <button 
                    disabled={!targetOwner}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-fadeIn text-center">
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