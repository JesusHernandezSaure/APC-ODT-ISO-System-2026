import React, { useState } from 'react';
import { Project, ProjectWorkTracking, User } from '../types';
import { useODT } from './ODTContext';

interface WorkTrackingControlsProps {
  project: Project;
  user: User;
  updateFullProject: (projectId: string, projectData: Partial<Project>) => Promise<void>;
}

export const WorkTrackingControls: React.FC<WorkTrackingControlsProps> = ({ project, user, updateFullProject }) => {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const { projects } = useODT();
  
  const userTracking = project.workTracking?.[user.id] || { status: 'idle', totalTimeMs: 0, reviewConfirmed: false };

  const handleStart = async () => {
    // 1. Find other projects with status 'in_progress' for this user
    const otherActiveProjects = projects.filter(p => 
      p.id !== project.id && 
      p.workTracking?.[user.id]?.status === 'in_progress'
    );

    // 2. Pause them
    for (const p of otherActiveProjects) {
        const now = new Date().getTime();
        const userTrackingP = p.workTracking![user.id];
        const startTime = userTrackingP.startTime ? new Date(userTrackingP.startTime).getTime() : now;
        const duration = now - startTime;
        
        const { startTime: _, ...trackingWithoutStartTime } = {
          ...userTrackingP,
          status: 'paused' as const,
          totalTimeMs: userTrackingP.totalTimeMs + duration,
        };
        
        await updateFullProject(p.id, {
          workTracking: { ...p.workTracking, [user.id]: trackingWithoutStartTime }
        });
    }

    // 3. Start current project
    const updatedTracking = {
      ...userTracking,
      status: 'in_progress',
      startTime: new Date().toISOString()
    };
    await updateFullProject(project.id, {
      workTracking: { ...project.workTracking, [user.id]: updatedTracking }
    });
  };

  const handlePause = async () => {
    const now = new Date().getTime();
    const startTime = userTracking.startTime ? new Date(userTracking.startTime).getTime() : now;
    const duration = now - startTime;
    
    const { startTime: _, ...trackingWithoutStartTime } = {
      ...userTracking,
      status: 'paused' as const,
      totalTimeMs: userTracking.totalTimeMs + duration,
    };
    await updateFullProject(project.id, {
      workTracking: { ...project.workTracking, [user.id]: trackingWithoutStartTime }
    });
  };

  const handleConfirmReview = async () => {
    if (!reviewComment.trim()) return;
    const updatedTracking = {
      ...userTracking,
      reviewConfirmed: true,
      reviewComment,
      reviewedBy: user.name,
      reviewedAt: new Date().toISOString()
    };
    await updateFullProject(project.id, {
      workTracking: { ...project.workTracking, [user.id]: updatedTracking }
    });
    setShowReviewModal(false);
  };

  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gestión de Tiempo y Material</h4>
      
      <div className="flex flex-wrap gap-2">
        {!userTracking.reviewConfirmed && (
          <button 
            onClick={() => setShowReviewModal(true)}
            className="px-4 py-2 bg-amber-500 text-white font-black text-[9px] rounded-lg hover:bg-amber-600"
          >
            CONFIRMAR REVISIÓN MATERIAL
          </button>
        )}
        
        {userTracking.status === 'idle' || userTracking.status === 'paused' ? (
          <button 
            onClick={handleStart}
            disabled={!userTracking.reviewConfirmed}
            className="px-4 py-2 bg-emerald-600 text-white font-black text-[9px] rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            INICIAR TRABAJO
          </button>
        ) : (
          <button 
            onClick={handlePause}
            className="px-4 py-2 bg-rose-600 text-white font-black text-[9px] rounded-lg hover:bg-rose-700"
          >
            PAUSAR TRABAJO
          </button>
        )}
      </div>
      
      {userTracking.status === 'in_progress' && (
        <p className="text-[10px] font-bold text-emerald-700 animate-pulse">● Trabajando...</p>
      )}

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h3 className="font-black text-xs uppercase">Confirmar revisión de material</h3>
            <textarea 
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Deja tu comentario sobre el material revisado..."
              className="w-full border p-2 rounded text-xs h-20"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReviewModal(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 rounded text-xs font-bold">CANCELAR</button>
              <button onClick={handleConfirmReview} className="flex-1 py-2 bg-emerald-600 text-white rounded text-xs font-bold">CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
