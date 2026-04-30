import React from 'react';
import { Joyride, Step, CallBackProps, STATUS } from 'react-joyride';
import { db } from './firebase';
import { ref, update } from 'firebase/database';

interface AgencyHubDetailTourProps {
  userId: string;
  tutorialVisto: boolean;
  runManual: boolean;
  setRunManual: (run: boolean) => void;
}

const AgencyHubDetailTour: React.FC<AgencyHubDetailTourProps> = ({ 
  userId, 
  tutorialVisto, 
  runManual, 
  setRunManual 
}) => {
  const steps: Step[] = [
    {
      target: '.tour-material',
      content: 'Haz clic en el botón oscuro "Ver Material para Revisión" para abrir y evaluar el diseño que preparamos para ti.',
      disableBeacon: true,
    },
    {
      target: '.tour-comentarios',
      content: 'Si necesitas modificaciones, escríbelas en esta caja. Recuerda ser lo más específico posible para agilizar el proceso de los ajustes.',
    },
    {
      target: '.tour-acciones',
      content: 'Presiona el botón blanco "Tengo Cambios" para devolver el proyecto al equipo, o usa el botón rosa "Aprobar Material" si el diseño está listo para entregarse.',
    }
  ];

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunManual(false);
      
      if (!tutorialVisto) {
        try {
          await update(ref(db, `users/${userId}`), {
            tutorialDetalleVisto: true,
          });
        } catch (error) {
          console.error("Error updating tutorial status:", error);
        }
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={!tutorialVisto || runManual}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Finalizar',
        next: 'Siguiente',
        skip: 'Saltar',
      }}
      styles={{
        options: {
          primaryColor: '#ec4899',
          zIndex: 10000,
        },
      }}
    />
  );
};

export default AgencyHubDetailTour;
