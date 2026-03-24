
import React from 'react';
import { Icons } from './constants';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';

const MedicalUserManual: React.FC = () => {
  const manualContent = `
# Manual de Usuario: Equipo Médico APC (ISO 9001:2015)

Este manual define los procedimientos operativos para el **Líder Médico** y el **Equipo Médico Operativo** dentro del sistema APC Control Hub, garantizando el cumplimiento de los estándares de calidad.

---

## 1. Roles y Responsabilidades

### 🩺 Médico Operativo (Medico_Opera)
*   **Producción:** Creación y revisión técnica de contenidos médicos.
*   **Trazabilidad:** Registro de avances mediante comentarios y enlaces de entrega.
*   **Corrección:** Implementación de ajustes solicitados por QA o el Cliente.

### 🛡️ Líder Médico (Medico_Lider)
*   **Supervisión:** Validación final de la precisión médica y científica.
*   **QA (Quality Assurance):** Aprobación o rechazo de ODTs en la "Caja de QA".
*   **Checklist de Calidad:** Verificación obligatoria de:
    1.  **Médica:** Precisión de datos y terminología.
    2.  **Estilo:** Tono y coherencia editorial.
    3.  **Referencias:** Validación de fuentes bibliográficas.

---

## 2. Flujo de Trabajo (Workflow)

### Paso 1: Recepción de ODT
Cuando se te asigne un proyecto, recibirás una notificación. Podrás encontrarlo en tu **Bandeja Operativa**.
*   Revisa el **Brief** y los **Materiales de Referencia**.
*   Si falta información, deja un comentario etiquetando al ejecutivo de Cuentas.

### Paso 2: Producción y Entrega (Operativo)
Una vez finalizado el contenido médico:
1.  Sube tu archivo a la nube (Drive/Sharepoint) y obtén el enlace.
2.  En el detalle de la ODT, pega el enlace en el campo **"Link de Entrega"**.
3.  Escribe un comentario detallando lo entregado.
4.  Pulsa el botón **"Enviar a Corrección"**. Esto moverá la ODT a la etapa de revisión.

### Paso 3: Revisión de Calidad (Líder)
Las ODTs listas para revisión aparecerán en la **Caja de QA**.
1.  Abre la ODT y revisa el material entregado.
2.  **Si es correcto:** Marca los 3 checks del **Checklist de Calidad** y pulsa **"APROBAR"**.
3.  **Si requiere ajustes:** Escribe el feedback detallado y pulsa **"RECHAZAR"**. Indica a qué área debe regresar (ej. Arte o Médico Operativo).

---

## 3. Herramientas Clave

### 📥 Bandeja Operativa
Tu centro de trabajo diario. Filtra por estatus para priorizar las ODTs con fechas de entrega próximas.

### 📦 Caja de QA (Solo Líderes)
Filtro especializado para ver únicamente lo que requiere tu firma de aprobación antes de salir al cliente.

### 💬 Trazabilidad (Comentarios)
**Regla de Oro:** Todo cambio o acuerdo debe quedar por escrito en los comentarios. No uses canales externos para decisiones críticas del proyecto.

---

## 4. Preguntas Frecuentes (FAQ)

**¿Qué hago si el enlace de referencia no abre?**
Deja un comentario inmediato en la ODT. El sistema notificará al responsable para que lo corrija.

**¿Cómo sé si mi trabajo fue aprobado?**
Recibirás una notificación de sistema indicando "APROBADO en REVISIÓN QA" o "APROBADO por Cliente".

**¿Puedo editar una ODT finalizada?**
No. Una vez finalizada, la ODT queda bloqueada para lectura. Si necesitas cambios, se debe crear una nueva ODT de corrección.
`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-20">
      <header className="bg-slate-900 p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
              <Icons.Project className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Centro de Capacitación Médica</h1>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">
            Protocolos de Calidad ISO 9001:2015 • APC Publicidad
          </p>
        </div>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-3xl border border-slate-100 shadow-xl"
      >
        <div className="markdown-body prose prose-slate max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-a:text-emerald-600">
          <ReactMarkdown>{manualContent}</ReactMarkdown>
        </div>
      </motion.div>

      <footer className="text-center py-10 border-t border-slate-100">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
          Sistema de Gestión de Calidad • APC Control Hub 2026
        </p>
      </footer>
    </div>
  );
};

export default MedicalUserManual;
