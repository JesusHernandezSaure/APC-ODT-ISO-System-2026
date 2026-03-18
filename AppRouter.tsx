
import React, { useState, useEffect } from 'react';
import { useODT } from './ODTContext';
import { UserRole, ViewState } from './types';
import { Icons } from './constants';
import { ref, set } from "firebase/database";
import { db } from './firebase';
import NotificationCenter from './NotificationCenter';

const Login: React.FC = () => {
  const { login } = useODT();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (db) {
      const testRef = ref(db, 'conexion_test');
      set(testRef, { fecha: new Date().toISOString() }).catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const result = await login(u, p);
    if (!result.success) {
      setErrorMsg(result.error || 'Error al iniciar sesión.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-blue-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-black mb-4">ISO</div>
            <h1 className="text-white text-2xl font-bold tracking-tight">ODT Manager</h1>
            <p className="text-blue-100 text-sm mt-1">Gestión Normativa APC</p>
          </div>
          <form className="p-8 space-y-6" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-100 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Usuario</label>
              <input value={u} onChange={e => setU(e.target.value)} type="text" className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none transition-all font-medium" placeholder="ID de Usuario" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contraseña</label>
              <input value={p} onChange={e => setP(e.target.value)} type="password" className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none transition-all font-medium" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-xl">
              Entrar al Sistema
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const AppRouter: React.FC<{ renderView: (view: ViewState) => React.ReactNode }> = ({ renderView }) => {
  const { user, logout } = useODT();
  const [view, setView] = useState<ViewState | null>(null);

  useEffect(() => {
    if (!user) {
      setView('login');
      return;
    }
    // Solo establecer la vista inicial si estamos en login o no hay vista definida
    if (view === 'login' || !view) {
      if (user.role === UserRole.Correccion) setView('leader-dashboard');
      else if (user.role === UserRole.QA_Opera) setView('qa-box');
      else if (user.department === 'Finanzas') setView('finances');
      else if (user.role === UserRole.Lider_Operativo) setView('leader-dashboard');
      else if (user.role === UserRole.Operativo) setView('my-projects');
      else if (user.role === UserRole.Cuentas_Opera || user.role === UserRole.Cuentas_Lider) setView('clients');
      else setView('dashboard');
    }
  }, [user, view]);

  if (!user || !view || view === 'login') return <Login />;

  const canSee = (roles: UserRole[]) => roles.includes(user.role) || user.role === UserRole.Admin;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 fixed h-full p-6 flex flex-col gap-8 shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl">ISO</div>
          <h2 className="text-white font-bold tracking-tighter">ODT Manager</h2>
        </div>
        <nav className="flex flex-col gap-2 flex-1">
          {canSee([UserRole.Admin, UserRole.Cuentas_Lider]) && <SidebarItem icon={<Icons.Dashboard />} label="Dashboard Adm." active={view === 'dashboard'} onClick={() => setView('dashboard')} />}
          {canSee([UserRole.Lider_Operativo, UserRole.Correccion]) && <SidebarItem icon={<Icons.Dashboard />} label="Dashboard Lider" active={view === 'leader-dashboard'} onClick={() => setView('leader-dashboard')} />}
          {canSee([UserRole.Cuentas_Opera, UserRole.Cuentas_Lider, UserRole.Admin]) && <SidebarItem icon={<Icons.Clients />} label="Clientes / Archivo" active={view === 'clients'} onClick={() => setView('clients')} />}
          {canSee([UserRole.Operativo, UserRole.Lider_Operativo, UserRole.Cuentas_Lider, UserRole.Admin, UserRole.QA_Opera]) && <SidebarItem icon={<Icons.Project />} label="Bandeja Operativa" active={view === 'my-projects'} onClick={() => setView('my-projects')} />}
          {canSee([UserRole.Correccion, UserRole.Admin, UserRole.Cuentas_Lider, UserRole.QA_Opera]) && <SidebarItem icon={<Icons.Ai />} label="Caja de QA" active={view === 'qa-box'} onClick={() => setView('qa-box')} />}
          {(user.department === 'Finanzas' || user.role === UserRole.Admin || user.role === UserRole.Cuentas_Lider) ? <SidebarItem icon={<Icons.Clients />} label="Facturación" active={view === 'finances'} onClick={() => setView('finances')} /> : null}
          {user.role === UserRole.Admin && <SidebarItem icon={<Icons.Users />} label="Usuarios" active={view === 'users'} onClick={() => setView('users')} />}
        </nav>
        
        <div className="px-4 py-2 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alertas</span>
          <NotificationCenter />
        </div>

        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <p className="text-xs font-bold text-white truncate">{user.name}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{user.role}</p>
          <button onClick={logout} className="w-full mt-4 py-2 text-[10px] uppercase font-bold text-slate-400 hover:text-white border border-slate-700 rounded-md transition-colors">Salir</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8">{renderView(view)}</main>
    </div>
  );
};

const SidebarItem: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
    {typeof Icon === 'function' ? <Icon /> : Icon} <span className="font-medium text-sm">{label}</span>
  </button>
);
