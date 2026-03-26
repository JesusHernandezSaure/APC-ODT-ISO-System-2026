
import React, { useState, useEffect } from 'react';
import { useODT } from './ODTContext';
import { UserRole, ViewState } from './types';
import * as Constants from './constants';
import { ref, set } from "firebase/database";
import { db } from './firebase';
import NotificationCenter from './NotificationCenter';
import HelpChatbot from './HelpChatbot';

const Pill: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-base',
    lg: 'w-20 h-20 text-2xl'
  };
  return (
    <div className={`apc-pill ${sizes[size]} flex items-center justify-center`}>
      <div className="apc-pill-inner">,</div>
    </div>
  );
};

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
    <div className="min-h-screen flex items-center justify-center bg-apc-green p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-apc-light-teal/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-apc-pink/10 rounded-full blur-3xl"></div>
      <div className="absolute top-10 right-10 w-40 h-40 bg-striped-pink opacity-10 rounded-full"></div>
      
      <div className="w-full max-w-md animate-fadeIn relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
          <div className="bg-gradient-to-br from-apc-green to-apc-teal p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-striped-green opacity-5"></div>
            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <Pill size="lg" />
              </div>
              <h1 className="text-white text-3xl font-black tracking-tighter">APC <span className="text-apc-pink">Control Hub</span></h1>
              <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Ideas frescas y saludables</p>
            </div>
          </div>
          <form className="p-10 space-y-6" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100 flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Usuario</label>
              <input value={u} onChange={e => setU(e.target.value)} type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-apc-pink/20 focus:border-apc-pink transition-all font-bold text-slate-700" placeholder="ID de Usuario" required />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contraseña</label>
              <input value={p} onChange={e => setP(e.target.value)} type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-apc-pink/20 focus:border-apc-pink transition-all font-bold text-slate-700" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full py-5 bg-apc-pink text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-apc-pink/30 active:scale-[0.98]">
              Entrar al Sistema
            </button>
          </form>
        </div>
        <p className="text-center text-white/40 text-[9px] font-bold uppercase tracking-[0.4em] mt-8">APC Publicidad © 2026</p>
      </div>
    </div>
  );
};

export const AppRouter: React.FC<{ 
  view: ViewState | null, 
  setView: (view: ViewState | null) => void,
  renderView: (view: ViewState) => React.ReactNode 
}> = ({ view, setView, renderView }) => {
  const { Icons } = Constants;
  const { user, logout } = useODT();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      if (view !== 'login') {
        setTimeout(() => setView('login'), 0);
      }
      return;
    }
    // Solo establecer la vista inicial si estamos en login o no hay vista definida
    if (view === 'login' || !view) {
      let nextView: ViewState = 'dashboard';
      if (user.role === UserRole.Correccion || user.role === UserRole.Medico_Lider) nextView = 'leader-dashboard';
      else if (user.role === UserRole.QA_Opera) nextView = 'qa-box';
      else if (user.department === 'Finanzas' || user.department === 'Administración' || user.role === UserRole.Finanzas) nextView = 'finances';
      else if (user.role === UserRole.Lider_Operativo) nextView = 'leader-dashboard';
      else if (user.role === UserRole.Operativo) nextView = 'my-projects';
      else if (user.role === UserRole.Cuentas_Opera || user.role === UserRole.Cuentas_Lider) nextView = 'clients';
      
      if (view !== nextView) {
        setTimeout(() => setView(nextView), 0);
      }
    }
  }, [user, view, setView]);

  if (!user || !view || view === 'login') return <Login />;

  const canSee = (roles: UserRole[]) => roles.includes(user.role) || user.role === UserRole.Admin;
  const canSeeQA = canSee([UserRole.Correccion, UserRole.Admin, UserRole.Cuentas_Lider, UserRole.Cuentas_Opera, UserRole.QA_Opera, UserRole.Medico_Lider, UserRole.Medico_Opera]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-[60] p-3 bg-apc-green text-white rounded-2xl shadow-xl"
      >
        <Icons.Menu />
      </button>

      {/* Sidebar */}
      <aside className={`
        ${isCollapsed ? 'md:w-20' : 'md:w-64'} 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        bg-apc-green fixed h-full p-6 flex flex-col gap-8 shadow-2xl z-50 transition-all duration-300 overflow-y-auto custom-scrollbar
      `}>
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-striped-green opacity-10 -mr-16 -mt-16 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-apc-pink opacity-5 -ml-12 -mb-12 rounded-full"></div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <Pill size="sm" />
            {!isCollapsed && (
              <div className="flex flex-col animate-fadeIn">
                <h2 className="text-white font-black tracking-tighter leading-none">APC</h2>
                <span className="text-white/60 text-[8px] font-black uppercase tracking-[0.2em]">Control Hub</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all"
          >
            <Icons.Menu className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1 relative z-10">
          {canSee([UserRole.Admin, UserRole.Cuentas_Lider]) && <SidebarItem icon={<Icons.Dashboard />} label="Dashboard Adm." active={view === 'dashboard'} isCollapsed={isCollapsed} onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }} />}
          {canSee([UserRole.Lider_Operativo, UserRole.Correccion, UserRole.Medico_Lider]) && <SidebarItem icon={<Icons.Dashboard />} label="Dashboard Lider" active={view === 'leader-dashboard'} isCollapsed={isCollapsed} onClick={() => { setView('leader-dashboard'); setIsMobileMenuOpen(false); }} />}
          {canSee([UserRole.Cuentas_Opera, UserRole.Cuentas_Lider, UserRole.Admin, UserRole.Operativo, UserRole.Lider_Operativo]) && <SidebarItem icon={<Icons.Clients />} label="Clientes / Archivo" active={view === 'clients'} isCollapsed={isCollapsed} onClick={() => { setView('clients'); setIsMobileMenuOpen(false); }} />}
          {canSee([UserRole.Operativo, UserRole.Lider_Operativo, UserRole.Cuentas_Lider, UserRole.Cuentas_Opera, UserRole.Admin, UserRole.QA_Opera, UserRole.Medico_Lider, UserRole.Medico_Opera]) && <SidebarItem icon={<Icons.Project />} label="Bandeja Operativa" active={view === 'my-projects'} isCollapsed={isCollapsed} onClick={() => { setView('my-projects'); setIsMobileMenuOpen(false); }} />}
          {canSeeQA && <SidebarItem icon={<Icons.Ai />} label="Caja de QA" active={view === 'qa-box'} isCollapsed={isCollapsed} onClick={() => { setView('qa-box'); setIsMobileMenuOpen(false); }} />}
          <SidebarItem icon={<Icons.Calendar />} label="Calendario" active={view === 'calendar'} isCollapsed={isCollapsed} onClick={() => { setView('calendar'); setIsMobileMenuOpen(false); }} />
          {(user.department === 'Finanzas' || user.department === 'Administración' || user.role === UserRole.Finanzas || user.role === UserRole.Admin || user.role === UserRole.Cuentas_Lider) ? <SidebarItem icon={<Icons.Clients />} label="Facturación" active={view === 'finances'} isCollapsed={isCollapsed} onClick={() => { setView('finances'); setIsMobileMenuOpen(false); }} /> : null}
          {user.role === UserRole.Admin && <SidebarItem icon={<Icons.Users />} label="Usuarios" active={view === 'users'} isCollapsed={isCollapsed} onClick={() => { setView('users'); setIsMobileMenuOpen(false); }} />}
          {(user.role === UserRole.Admin || user.role === UserRole.Cuentas_Lider || user.role === UserRole.Cuentas_Opera || user.department === 'Administración' || user.department === 'Finanzas') && (
            <SidebarItem icon={<Icons.TrendingUp />} label="Inteligencia" active={view === 'commercial-intelligence'} isCollapsed={isCollapsed} onClick={() => { setView('commercial-intelligence'); setIsMobileMenuOpen(false); }} />
          )}
          {(user.role === UserRole.Admin || user.role === UserRole.Cuentas_Lider || user.department === 'Administración' || user.department === 'Finanzas') && (
            <SidebarItem icon={<Icons.Ai />} label="Auditor Virtual" active={view === 'auditor'} isCollapsed={isCollapsed} onClick={() => { setView('auditor'); setIsMobileMenuOpen(false); }} />
          )}
          {(user.role === UserRole.Medico_Lider || user.role === UserRole.Medico_Opera || user.role === UserRole.Admin) && (
            <SidebarItem icon={<Icons.Project />} label="Manual Médico" active={view === 'medical-manual'} isCollapsed={isCollapsed} onClick={() => { setView('medical-manual'); setIsMobileMenuOpen(false); }} />
          )}
        </nav>
        
        <div className={`px-4 py-2 border-t border-white/10 flex ${isCollapsed ? 'justify-center' : 'justify-between'} items-center relative z-10`}>
          {!isCollapsed && <span className="text-[10px] font-black text-apc-light-teal uppercase tracking-widest">Alertas</span>}
          <NotificationCenter />
        </div>

        <div className={`p-4 bg-white/5 rounded-2xl border border-white/10 relative z-10 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {!isCollapsed ? (
            <>
              <p className="text-xs font-black text-white truncate">{user.name}</p>
              <p className="text-[9px] text-white/60 font-black uppercase truncate tracking-tighter">{user.role}</p>
            </>
          ) : (
            <div className="w-8 h-8 rounded-full bg-apc-pink flex items-center justify-center text-white font-black text-[10px]">
              {user.name.charAt(0)}
            </div>
          )}
          <button onClick={logout} className={`w-full mt-4 py-2 text-[9px] uppercase font-black text-white/40 hover:text-apc-pink border border-white/10 rounded-xl transition-all hover:border-apc-pink/30 ${isCollapsed ? 'px-0' : ''}`}>
            {isCollapsed ? <Icons.LogOut className="w-3 h-3 mx-auto" /> : 'Salir'}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className={`flex-1 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'} transition-all duration-300 p-6 md:p-10 bg-white relative min-h-screen`}>
        {/* Global background pattern */}
        <div className={`fixed inset-0 pointer-events-none opacity-[0.02] bg-striped-green ${isCollapsed ? 'md:ml-20' : 'md:ml-64'} transition-all duration-300`}></div>
        <div className="relative z-10 pt-16 md:pt-0">
          {renderView(view)}
        </div>
        <HelpChatbot />
      </main>
    </div>
  );
};

const SidebarItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, isCollapsed?: boolean, onClick: () => void }> = ({ icon: Icon, label, active, isCollapsed, onClick }) => (
  <button 
    onClick={onClick} 
    title={isCollapsed ? label : undefined}
    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl transition-all group ${active ? 'bg-apc-pink text-white shadow-lg shadow-apc-pink/20' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
  >
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
      {typeof Icon === 'function' ? <Icon /> : Icon}
    </div>
    {!isCollapsed && <span className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap animate-fadeIn">{label}</span>}
  </button>
);
