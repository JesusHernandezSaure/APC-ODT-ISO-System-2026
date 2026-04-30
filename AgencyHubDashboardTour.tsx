import React from 'react';
import { Joyride, Step, CallBackProps, STATUS } from 'react-joyride';
import { db } from './firebase';
import { ref, update } from 'firebase/database';

interface AgencyHubDashboardTourProps {
  userId: string;
  tutorialVisto: boolean;
  runManual: boolean;
  setRunManual: (run: boolean) => void;
}

const AgencyHubDashboardTour: React.FC<AgencyHubDashboardTourProps> = ({ 
  userId, 
  tutorialVisto, 
  runManual, 
  setRunManual 
}) => {
  const steps: Step[] = [
    {
      target: '.tour-perfil',
      content: 'Aquí tienes los datos de tu Ejecutivo asignado. Usa su teléfono o correo para contactarlo directamente si tienes dudas.',
      disableBeacon: true, // Inicia sin que el usuario tenga que dar clic al primer punto
    },
    {
      target: '.tour-marcas',
      content: 'Usa estas pestañas para filtrar tus proyectos y enfocarte en una marca o división específica.',
    },
    {
      target: '.tour-solicitar',
      content: 'Usa el botón verde para solicitar un nuevo proyecto. Te pediremos la marca, el formato y una descripción detallada.',
    },
    {
      target: '.tour-tabla',
      content: 'Monitorea el avance de todos tus proyectos aquí. Si el estatus aparece en color rosa ("Lista para revisión"), significa que necesitamos tu validación.',
    },
    {
      target: '.tour-boton-detalle',
      content: 'Haz clic en el botón oscuro "Ver Detalle" para entrar a un proyecto y revisar el material entregable.',
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
            tutorialDashboardVisto: true,
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

export default AgencyHubDashboardTour;
