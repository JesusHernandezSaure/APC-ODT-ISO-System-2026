import { GoogleGenAI, Type } from "@google/genai";

import { Project } from "../types";

/**
 * Audits a project's ODT data against ISO 9001:2015 standards using AI.
 * Uses gemini-3-pro-preview as this is a complex reasoning task.
 */
export async function auditProjectISO(projectData: Partial<Project>) {
  // Always create a new instance right before use to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: `Datos del proyecto: ${JSON.stringify(projectData)}`,
    config: {
      // Moved the audit instructions to systemInstruction as per best practices
      systemInstruction:
        "Analiza esta ODT (Orden de Trabajo) bajo la normativa ISO 9001:2015. Verifica trazabilidad, completitud de campos y posibles riesgos de calidad.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.NUMBER,
            description: "Puntaje de cumplimiento del 1 al 100",
          },
          findings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Lista de hallazgos encontrados",
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Recomendaciones para cumplir la norma",
          },
          isoClause: {
            type: Type.STRING,
            description: "Cláusula ISO más relevante",
          },
        },
        required: ["score", "findings", "recommendations", "isoClause"],
      },
    },
  });

  try {
    // Access the .text property directly (not a method) as per guidelines
    const jsonStr = response.text?.trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return null;
  }
}

/**
 * Structures a project brief using AI.
 */
export async function structureBrief(htmlContent: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Contenido del Brief: ${htmlContent}`,
    config: {
      systemInstruction: `Eres un experto en gestión de proyectos para una agencia de producción médica y gráfica. 
      Tu tarea es reestructurar el contenido del brief proporcionado en un formato profesional y limpio.
      
      REGLAS:
      1. Extrae información relevante de cualquier tabla o texto que parezca venir de una imagen (OCR simulado).
      2. Utiliza ESTRICTAMENTE los siguientes encabezados H3:
         - Objetivo del Proyecto
         - Requerimientos Técnicos
         - Entregables Sugeridos
         - Referencias
      3. Redacta con un tono claro, profesional y técnico.
      4. Devuelve el resultado ÚNICAMENTE en formato HTML limpio (sin etiquetas <html> o <body>).
      5. No inventes información que no esté en el brief original, pero organízala de forma lógica.`,
    },
  });

  return response.text?.trim() || null;
}

/**
 * Generates an executive performance and ROI analysis for a selected account executive (or team).
 */
export async function analyzeExecutivePerformance(data: {
  executiveName: string;
  timeRange: string;
  brandName: string;
  metrics: {
    totalIgualasVal: number;
    totalExtrasVal: number;
    totalCreatedCount: number;
    activeODTsCount: number;
    enRevisionCount: number;
    enTiempoCount: number;
    conRetrasoCount: number;
    entregasATiempoCount: number;
    entregasTardeCount: number;
  };
  projects: {
    id?: string;
    client?: string;
    brand?: string;
    product?: string;
    created?: string;
    due?: string;
    status?: string;
    type?: string;
    monto?: number;
    sla_intento?: string;
  }[];
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Por favor analiza la siguiente información de rendimiento y actividades:
    - Ejecutivo seleccionado: ${data.executiveName}
    - Período de tiempo: ${data.timeRange}
    - Marcas incluidas: ${data.brandName}
    - Métricas financieras y de control:
      * Valor Operativo de Igualas: $ ${data.metrics.totalIgualasVal.toLocaleString("es-MX")} MXN
      * Valor de Cargos Extra: $ ${data.metrics.totalExtrasVal.toLocaleString("es-MX")} MXN
      * Total de ODTs creadas: ${data.metrics.totalCreatedCount}
      * ODTs Activas de cuenta: ${data.metrics.activeODTsCount}
      * ODTs en Revisión con cliente/Standby: ${data.metrics.enRevisionCount}
      * ODTs Activas en tiempo: ${data.metrics.enTiempoCount}
      * ODTs Activas con retraso: ${data.metrics.conRetrasoCount}
      * Entregas del primer envío a tiempo (SLA): ${data.metrics.entregasATiempoCount}
      * Entregas de primer envío tarde (SLA): ${data.metrics.entregasTardeCount}

    - Desglose de proyectos y ODTs:
    ${JSON.stringify(data.projects)}`,
    config: {
      systemInstruction: `Eres un Consultor Senior Experto en Operaciones de Agencias de Publicidad y Marketing, y Auditor bajo las normas ISO 9001:2015. 
      Tu objetivo es analizar la información operativa proporcionada de un ejecutivo de cuentas (o de toda la agencia) y generar un reporte ejecutivo con un tono corporativo, riguroso, motivador y sumamente analítico de su desempeño general en el periodo especificado.

      Tu análisis debe contener la siguiente estructura en formato Markdown:

      ### 1. 📊 RESUMEN EJECUTIVO Y DIAGNÓSTICO OPERATIVO
      Presenta una evaluación cuantitativa y cualitativa del rendimiento de la persona seleccionada (o de toda la agencia si se selecciona "Toda la Agencia"). Analiza la relación entre el volumen de ODTs generadas, las activas, el cumplimiento de fechas límite, y su éxito en primeras entregas en base a las métricas proporcionadas.

      ### 2. 💰 ANÁLISIS ECONÓMICO Y ROI
      Evalúa la carga financiera operativa. Analiza la proporción de Igualas fijas vs proyectos Extras y estima cómo esto afecta a la rentabilidad del ejecutivo. ¿Qué impacto tiene el retraso o la velocidad de entrega en el flujo de efectivo y el ROI de la agencia?

      ### 3. 🚦 DETERMINACIÓN DE RIESGOS / CUELLOS DE BOTELLA OPERATIVOS
      Identifica de manera detallada los factores críticos de riesgo (ej. alto monto de proyectos extras lentificados, excesivas ODTs en standby, retrasos acumulados en productos específicos, etc.). Haz mención de marcas o proyectos concretos de la lista que requieran atención inmediata.

      ### 4. 🚀 PROPUESTAS DE MEJORA OPERATIVA (SLA & ROI)
      Prescribe propuestas tácticas y estratégicas e hitos de acción para mejorar radicalmente:
      - El flujo y la velocidad de entrega.
      - Las entregas en tiempo al primer intento de cara al cliente (SLA).
      - La eficiencia operativa para potenciar el ROI y reducir tiempos muertos.
      Clasifica tus recomendaciones en "Acciones Inmediatas (Cuyo impacto será en <7 días)" y "Estrategias de Mediano Plazo".

      Usa un español profesional impecable con terminología de agencias publicitarias y de negocios. No inventes métricas, adhiérete enteramente a los números y proyectos provistos, dando valor estratégico a los mismos.`,
    },
  });

  return (
    response.text?.trim() || "No se pudo generar el análisis en este momento."
  );
}

/**
 * Generates an area performance analysis for a selected leader or team.
 */
export async function analyzeLeaderPerformance(data: {
  leaderName: string;
  area: string;
  timeRange: string;
  userFilter: string;
  metrics: {
    totalAttended: number;
    totalFinished: number;
    totalApprovedFirstTime: number;
    totalQARejections: number;
    totalClientRejections: number;
    avgReworksPerODT: number;
    avgAttentionTime: string;
    avgReviewTime: string;
    avgTimeInQA: string;
    slasMet: number;
    slasMissed: number;
    slaCompliancePercentage: number;
    activeODTs: number;
    closedODTs: number;
    firstPassApprovalPercentage: number;
    reworkIndex: number;
    avgCorrectionCycles: number;
  };
  userStats: Record<string, unknown>[];
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const systemInstruction = `Eres un Auditor de Calidad (ISO 9001) y Director de Operaciones de una Agencia.
Tu objetivo es analizar el rendimiento operativo y de calidad del área: ${data.area}, supervisada por: ${data.leaderName}, en el periodo: ${data.timeRange}.
Filtro de usuario aplicado: ${data.userFilter}.

Redacta un RESUMEN DE DESEMPEÑO inteligente y procesable en formato Markdown.

Debe incluir para cada integrante del equipo (o de forma general si es todo el equipo):
1. **Fortalezas Detectadas** (Basado en cumplimiento SLA, aprobación a la primera, productividad).
2. **Áreas de Oportunidad** (Retrabajos, tiempos de revisión altos, rechazos).
3. **Riesgos Identificados** (Carga de trabajo excesiva, incumplimiento crónico).
4. **Recomendaciones Operativas** (Acciones concretas para mejorar calidad y tiempos).

Sé directo, profesional, usa bullet points y resalta los datos más críticos.`;

  const prompt = `Métricas Generales del Área/Filtro:
${JSON.stringify(data.metrics, null, 2)}

Estadísticas Individuales de Usuarios:
${JSON.stringify(data.userStats, null, 2)}

Por favor, genera el Resumen de Desempeño basándote en estos datos reales.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.7,
    },
  });

  return (
    response.text?.trim() || "No se pudo generar el análisis en este momento."
  );
}
