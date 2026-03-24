
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useODT } from './ODTContext';
import { Icons } from './constants';
import { motion, AnimatePresence } from 'motion/react';

const NotificationCenter: React.FC = () => {
  const { user, notifications, markNotificationAsRead, clearNotifications } = useODT();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const userNotifs = notifications.filter(n => n.userId === user.id);
  const unreadCount = userNotifs.filter(n => !n.read).length;

  const dropdown = (
    <AnimatePresence>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[9998] bg-transparent" 
            onClick={() => setIsOpen(false)}
          />
          <motion.div 
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            className="fixed bottom-20 left-4 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[9999] overflow-hidden"
          >
            <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Notificaciones</h3>
              {userNotifs.length > 0 && (
                <button 
                  onClick={clearNotifications}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase"
                >
                  Limpiar todo
                </button>
              )}
            </div>

            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
              {userNotifs.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-400 text-xs italic">No tienes notificaciones pendientes.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {userNotifs.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => markNotificationAsRead(n.id)}
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative ${!n.read ? 'bg-blue-50/30' : ''}`}
                    >
                      {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                          n.type === 'sla_alert' ? 'bg-rose-100 text-rose-600' : 
                          n.type === 'new_odt' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {n.type.replace('_', ' ')}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 mb-1">{n.title}</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{n.message}</p>
                      {n.projectId && (
                        <div className="mt-2 text-[9px] font-black text-blue-600">
                          PROYECTO: {n.projectId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white transition-colors"
      >
        <Icons.Ai />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {createPortal(dropdown, document.body)}
    </div>
  );
};

export default NotificationCenter;
