
import React, { useState } from 'react';
import { useODT } from './ODTContext';
import { UserRole, User } from './types';
import { Icons } from './constants';
import { OPERATIVE_AREAS, SUPPORT_DEPARTMENTS } from './workflowConfig';

const ALL_DEPARTMENTS = [
  'Cuentas',
  ...OPERATIVE_AREAS,
  ...SUPPORT_DEPARTMENTS
];

const UsersView: React.FC = () => {
  const { users, manageUser, toggleUserStatus, removeUser } = useODT();
  const [isEditing, setIsEditing] = useState<Partial<User> | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const [dialog, setDialog] = useState<{ type: 'alert' | 'confirm', message: string, onConfirm?: () => void } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing || !isEditing.username || !isEditing.name || !isEditing.password) {
      setDialog({ type: 'alert', message: "Por favor, complete todos los campos requeridos." });
      return;
    }
    try {
      await manageUser(isEditing);
      setIsEditing(null);
      setDialog({ type: 'alert', message: "¡Usuario guardado correctamente!" });
    } catch (error) {
      console.error("Error al guardar usuario:", error);
    }
  };

  const seedTestUsers = async () => {
    setDialog({
      type: 'confirm',
      message: "¿Deseas generar los usuarios de prueba con la estructura oficial APC?",
      onConfirm: async () => {
        setIsSeeding(true);
        
        const testUsers = [
          { name: 'Admin General', username: 'admin.apc', password: '123', role: UserRole.Admin, department: 'Sistemas', roles: [UserRole.Admin] },
          { name: 'Líder de Cuentas', username: 'cuentas.lider', password: '123', role: UserRole.Cuentas_Lider, department: 'Cuentas', roles: [UserRole.Cuentas_Lider] },
          { name: 'Ejecutivo Cuentas 1', username: 'cuentas.opera1', password: '123', role: UserRole.Cuentas_Opera, department: 'Cuentas', roles: [UserRole.Cuentas_Opera] },
          { name: 'Líder Creativo', username: 'creativo.lider', password: '123', role: UserRole.Lider_Operativo, department: 'Creativo', roles: [UserRole.Lider_Operativo] },
          { name: 'Diseñador Senior', username: 'diseno.opera', password: '123', role: UserRole.Operativo, department: 'Arte', roles: [UserRole.Operativo] },
          { name: 'Director Médico', username: 'medical.lider', password: '123', role: UserRole.Medico_Lider, department: 'Médico', roles: [UserRole.Medico_Lider, UserRole.Correccion] },
          { name: 'Médico Operativo', username: 'medical.opera', password: '123', role: UserRole.Medico_Opera, department: 'Médico', roles: [UserRole.Medico_Opera] },
          { name: 'Editor Audiovisual', username: 'video.opera', password: '123', role: UserRole.Operativo, department: 'Audio y Video', roles: [UserRole.Operativo] },
          { name: 'Desarrollador Digital', username: 'digital.opera', password: '123', role: UserRole.Operativo, department: 'Digital', roles: [UserRole.Operativo] },
          { name: 'QA Lider (Master)', username: 'qa.lider', password: '123', role: UserRole.Correccion, department: 'QA', roles: [UserRole.Correccion] },
          { name: 'Analista Finanzas', username: 'finanzas.test', password: '123', role: UserRole.Operativo, department: 'Administración', roles: [UserRole.Operativo] },
        ];

        try {
          for (const u of testUsers) {
            await manageUser({ ...u, active: true });
          }
          setDialog({ type: 'alert', message: "¡Estructura de usuarios de prueba creada exitosamente!" });
        } catch {
          setDialog({ type: 'alert', message: "Error en el proceso de semillado." });
        } finally {
          setIsSeeding(false);
        }
      }
    });
  };

  const ROLE_LABELS: Record<string, string> = {
    [UserRole.Admin]: 'Administrador',
    [UserRole.Cuentas_Lider]: 'Líder Cuentas',
    [UserRole.Cuentas_Opera]: 'Ejecutivo Cuentas',
    [UserRole.Lider_Operativo]: 'Líder Operativo',
    [UserRole.Operativo]: 'Operativo',
    [UserRole.Correccion]: 'Líder de QA',
    [UserRole.QA_Opera]: 'QA Operativo',
    [UserRole.Medico_Lider]: 'Médico Líder',
    [UserRole.Medico_Opera]: 'Médico Operativo'
  };

  if (!users) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apc-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-slate-500 font-medium text-sm italic">Estructura Oficial APC - Protocolo ISO 9001</p>
        </div>
        <div className="flex gap-3">
          <button 
            disabled={isSeeding}
            onClick={seedTestUsers}
            className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-black text-xs hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            {isSeeding ? 'GENERANDO...' : 'RE-SEMBRAR ESTRUCTURA APC'}
          </button>
          <button 
            onClick={() => setIsEditing({ name: '', username: '', password: '', department: 'Cuentas', role: UserRole.Cuentas_Opera, active: true })}
            className="bg-apc-green text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-apc-green/80 transition-all shadow-lg shadow-apc-green/20 flex items-center gap-2"
          >
            <Icons.Plus /> NUEVO USUARIO
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
            <tr>
              <th className="px-6 py-5">Colaborador</th>
              <th className="px-6 py-5">ID (Username)</th>
              <th className="px-6 py-5">Departamento</th>
              <th className="px-6 py-5">Rol</th>
              <th className="px-6 py-5">Estatus</th>
              <th className="px-6 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(users || []).map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-black text-slate-800">{u.name}</td>
                <td className="px-6 py-4 font-mono text-xs font-bold text-apc-pink">@{u.username}</td>
                <td className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px]">{u.department}</td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-tight ${u.role === UserRole.QA_Opera ? 'bg-apc-pink/10 text-apc-pink' : 'bg-slate-900 text-white'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${u.active ? 'bg-apc-green/10 text-apc-green' : 'bg-rose-50 text-rose-600'}`}>
                    {u.active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                 <td className="px-6 py-4 text-right space-x-2">
                   <button onClick={() => setIsEditing(u)} className="p-2 hover:bg-apc-green/10 rounded-lg text-slate-400 hover:text-apc-green transition-all">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                   </button>
                   <button onClick={() => toggleUserStatus(u.id, !u.active)} className={`p-2 rounded-lg transition-all ${u.active ? 'hover:bg-rose-50 text-slate-300 hover:text-rose-500' : 'hover:bg-apc-green/10 text-slate-300 hover:text-apc-green'}`}>
                      {u.active ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20"/><path d="m5 15 7 7 7-7"/></svg>}
                   </button>
                   <button 
                     onClick={() => setDialog({
                       type: 'confirm',
                       message: `¿Estás seguro de eliminar permanentemente al usuario ${u.name}? Esta acción no se puede deshacer.`,
                       onConfirm: () => removeUser(u.id)
                     })} 
                     className="p-2 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-500 transition-all"
                   >
                      <Icons.Trash className="w-4 h-4" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-10 w-full max-w-md shadow-2xl animate-fadeIn border-t-8 border-apc-green">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Configurar Usuario</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Gestión de Perfiles APC</p>
            
            <form onSubmit={handleSave} className="space-y-5">
               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block ml-1">Nombre Completo</label>
                  <input required value={isEditing.name} onChange={e => setIsEditing({...isEditing, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-apc-green transition-all font-bold text-sm" placeholder="Nombre completo" />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block ml-1">Username (ID)</label>
                    <input required value={isEditing.username} onChange={e => setIsEditing({...isEditing, username: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-apc-green transition-all font-mono text-xs font-bold" placeholder="usuario.id" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block ml-1">Password</label>
                    <input required type="text" value={isEditing.password} onChange={e => setIsEditing({...isEditing, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-apc-green transition-all font-bold text-sm" placeholder="••••••••" />
                 </div>
               </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block ml-1">Rol Principal</label>
                  <select value={isEditing.role} onChange={e => setIsEditing({...isEditing, role: e.target.value as UserRole})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-apc-green font-black text-xs appearance-none cursor-pointer">
                    {Object.entries(ROLE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
               </div>

               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block ml-1">Roles Adicionales (Multirole)</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border-2 border-slate-100 max-h-40 overflow-y-auto">
                    {Object.entries(ROLE_LABELS).map(([val, label]) => {
                      const roleVal = val as UserRole;
                      const isChecked = isEditing.roles?.includes(roleVal) || isEditing.role === roleVal;
                      return (
                        <label key={val} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            disabled={isEditing.role === roleVal}
                            onChange={() => {
                              const currentRoles = isEditing.roles || [];
                              const newRoles = currentRoles.includes(roleVal)
                                ? currentRoles.filter(r => r !== roleVal)
                                : [...currentRoles, roleVal];
                              setIsEditing({ ...isEditing, roles: newRoles });
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-apc-green focus:ring-apc-green"
                          />
                          <span className="text-[10px] font-bold text-slate-600 group-hover:text-apc-green transition-colors">{label}</span>
                        </label>
                      );
                    })}
                  </div>
               </div>

               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block ml-1">Departamento</label>
                  <select value={isEditing.department} onChange={e => setIsEditing({...isEditing, department: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-apc-green font-black text-xs appearance-none cursor-pointer">
                    {ALL_DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept.toUpperCase()}</option>)}
                  </select>
               </div>

               <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setIsEditing(null)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cerrar</button>
                  <button type="submit" className="flex-2 px-8 py-4 bg-apc-green text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-apc-green/80 transition-all shadow-xl shadow-apc-green/20">Guardar Cambios</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Dialog */}
      {dialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-fadeIn text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${dialog.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-apc-green/10 text-apc-green'}`}>
              <Icons.Ai />
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

export default UsersView;
