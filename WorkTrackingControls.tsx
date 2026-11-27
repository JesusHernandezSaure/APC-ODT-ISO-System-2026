import React, { useState } from 'react';
import { Project, ProjectWorkTracking, User } from './types';
import { useODT } from './ODTContext';

interface WorkTrackingControlsProps {
  project: Project;
  user: User;
  updateFullProject?: (projectId: string, projectData: Partial<Project>) => Promise<void>;
}

const buildPausedTracking = (tracking: ProjectWorkTracking, nowMs: number): ProjectWorkTracking => {
  const parsedStart = tracking.startTime ? new Date(tracking.startTime).getTime() : NaN;
  const duration = Number.isFinite(parsedStart) ? Math.max(0, nowMs - parsedStart) : 0;
  const baseTotal = Number.isFinite(tracking.totalTimeMs) && tracking.totalTimeMs >= 0 ? tracking.totalTimeMs : 0;

  return {
    status: 'paused',
    totalTimeMs: baseTotal + duration,
    reviewConfirmed: Boolean(tracking.reviewConfirmed),
    ...(tracking.reviewComment !== undefined ? { reviewComment: tracking.reviewComment } : {}),
    ...(tracking.reviewedBy !== undefined ? { reviewedBy: tracking.reviewedBy } : {}),
    ...(tracking.reviewedAt !== undefined ? { reviewedAt: tracking.reviewedAt } : {})
  };
};

export const WorkTrackingControls: React.FC<WorkTrackingControlsProps> = ({ project, user }) => {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { projects, updateUserWorkTracking } = useODT();
  
  const userTracking: ProjectWorkTracking = project.workTracking?.[user.id] || {
    status: 'idle',
    totalTimeMs: 0,
    reviewConfirmed: false
  };

  const handleStart = async () => {
    if (isSubmitting || !userTracking.reviewConfirmed) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const now = Date.now();
      // 1. Find other projects with status 'in_progress' for this user
      const otherActiveProjects = projects.filter(p => 
        p.id !== project.id && 
        p.workTracking?.[user.id]?.status === 'in_progress'
      );

      // 2. Pause them atomically without sending undefined fields to Firebase RTDB
      for (const p of otherActiveProjects) {
        const userTrackingP = p.workTracking?.[user.id];
        if (!userTrackingP) continue;
        await updateUserWorkTracking(p.id, user.id, buildPausedTracking(userTrackingP, now));
      }

      // 3. Start current project
      const baseTotal = Number.isFinite(userTracking.totalTimeMs) && userTracking.totalTimeMs >= 0
        ? userTracking.totalTimeMs
        : 0;
      const updatedTracking: ProjectWorkTracking = {
        ...userTracking,
        totalTimeMs: baseTotal,
        status: 'in_progress',
        startTime: new Date().toISOString()
      };
      await updateUserWorkTracking(project.id, user.id, updatedTracking);
    } catch (error) {
      console.error('Error al iniciar trabajo:', error);
      setErrorMsg('No se pudo iniciar el trabajo. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async () => {
    if (isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await updateUserWorkTracking(project.id, user.id, buildPausedTracking(userTracking, Date.now()));
    } catch (error) {
      console.error('Error al pausar trabajo:', error);
      setErrorMsg('No se pudo pausar el trabajo. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReview = async () => {
    if (isSubmitting || !reviewComment.trim()) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const baseTotal = Number.isFinite(userTracking.totalTimeMs) && userTracking.totalTimeMs >= 0
        ? userTracking.totalTimeMs
        : 0;
      const updatedTracking: ProjectWorkTracking = {
        ...userTracking,
        totalTimeMs: baseTotal,
        reviewConfirmed: true,
        reviewComment: reviewComment.trim(),
        reviewedBy: user.name,
        reviewedAt: new Date().toISOString()
      };
      await updateUserWorkTracking(project.id, user.id, updatedTracking);
      setShowReviewModal(false);
    } catch (error) {
      console.error('Error al confirmar revisión:', error);
      setErrorMsg('No se pudo confirmar la revisión. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gestión de Tiempo y Material</h4>
      
      <div className="flex flex-wrap gap-2">
        {!userTracking.reviewConfirmed && (
          <button 
            onClick={() => setShowReviewModal(true)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-amber-500 text-white font-black text-[9px] rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            CONFIRMAR REVISIÓN MATERIAL
          </button>
        )}
        
        {userTracking.status === 'idle' || userTracking.status === 'paused' ? (
          <button 
            onClick={handleStart}
            disabled={!userTracking.reviewConfirmed || isSubmitting}
            className="px-4 py-2 bg-emerald-600 text-white font-black text-[9px] rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'INICIANDO...' : 'INICIAR TRABAJO'}
          </button>
        ) : (
          <button 
            onClick={handlePause}
            disabled={isSubmitting}
            className="px-4 py-2 bg-rose-600 text-white font-black text-[9px] rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'PAUSANDO...' : 'PAUSAR TRABAJO'}
          </button>
        )}
      </div>
      
      {userTracking.status === 'in_progress' && (
        <p className="text-[10px] font-bold text-emerald-700 animate-pulse">● Trabajando...</p>
      )}

      {errorMsg && (
        <p className="text-[10px] font-bold text-rose-600">{errorMsg}</p>
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
              <button onClick={() => setShowReviewModal(false)} disabled={isSubmitting} className="flex-1 py-2 bg-slate-200 text-slate-700 rounded text-xs font-bold disabled:opacity-50">CANCELAR</button>
              <button onClick={handleConfirmReview} disabled={isSubmitting || !reviewComment.trim()} className="flex-1 py-2 bg-emerald-600 text-white rounded text-xs font-bold disabled:opacity-50">
                {isSubmitting ? 'GUARDANDO...' : 'CONFIRMAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
