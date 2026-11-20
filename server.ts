import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Helper to get Gemini client with the latest API key
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'undefined') {
    throw new Error('La clave GEMINI_API_KEY actual es un marcador de posición ("MY_GEMINI_API_KEY"). Por favor ingresa una clave válida de Gemini en el panel de configuración (Settings > Secrets).');
  }
  return new GoogleGenAI({ apiKey });
}

// 1. Admin Dashboard Analysis
app.post('/api/gemini/admin-analysis', async (req: Request, res: Response) => {
  try {
    const { dataForAI } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analiza estos datos de la agencia y genera un reporte estratégico ejecutivo:\n\n${JSON.stringify(dataForAI, null, 2)}`,
      config: {
        systemInstruction: 'Eres un Consultor Estratégico Senior. Proporciona un análisis macro del negocio, identificando rentabilidad, riesgos y 3 recomendaciones clave para escalar la agencia.',
        temperature: 0.7,
      },
    });

    res.json({ text: response.text || 'No se pudo generar el análisis.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/admin-analysis:', error);
    res.status(500).json({ error: message });
  }
});

// 2. Commercial Intelligence Analysis
app.post('/api/gemini/commercial-intelligence', async (req: Request, res: Response) => {
  try {
    const { contents, systemInstruction, temperature = 0.7 } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature,
      },
    });

    res.json({ text: response.text || 'No se pudo generar el análisis.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/commercial-intelligence:', error);
    res.status(500).json({ error: message });
  }
});

// 3. Virtual Auditor
app.post('/api/gemini/virtual-auditor', async (req: Request, res: Response) => {
  try {
    const { contents, systemInstruction, temperature = 0.7 } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature,
      },
    });

    res.json({ text: response.text || 'No se pudo generar el análisis.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/virtual-auditor:', error);
    res.status(500).json({ error: message });
  }
});

// 4. Chatbot Assistant
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { contents, systemInstruction, temperature = 0.7 } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature,
      },
    });

    res.json({ text: response.text || 'Lo siento, no pude procesar tu solicitud.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/chat:', error);
    res.status(500).json({ error: message });
  }
});

// 5. Audit Project ISO 9001:2015
app.post('/api/gemini/audit-iso', async (req: Request, res: Response) => {
  try {
    const { projectData } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Datos del proyecto: ${JSON.stringify(projectData)}`,
      config: {
        systemInstruction:
          'Analiza esta ODT (Orden de Trabajo) bajo la normativa ISO 9001:2015. Verifica trazabilidad, completitud de campos y posibles riesgos de calidad.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.NUMBER,
              description: 'Puntaje de cumplimiento del 1 al 100',
            },
            findings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de hallazgos encontrados',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Recomendaciones para cumplir la norma',
            },
            isoClause: {
              type: Type.STRING,
              description: 'Cláusula ISO más relevante',
            },
          },
          required: ['score', 'findings', 'recommendations', 'isoClause'],
        },
      },
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) {
      res.json({ result: null });
      return;
    }
    const result = JSON.parse(jsonStr);
    res.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/audit-iso:', error);
    res.status(500).json({ error: message });
  }
});

// 6. Structure Brief
app.post('/api/gemini/structure-brief', async (req: Request, res: Response) => {
  try {
    const { htmlContent } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

    res.json({ html: response.text?.trim() || null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/structure-brief:', error);
    res.status(500).json({ error: message });
  }
});

// 7. Executive Performance Analysis
app.post('/api/gemini/analyze-executive', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Por favor analiza la siguiente información de rendimiento y actividades:
      - Ejecutivo seleccionado: ${data.executiveName}
      - Período de tiempo: ${data.timeRange}
      - Marcas incluidas: ${data.brandName}
      - Métricas financieras y de control:
        * Valor Operativo de Igualas: $ ${data.metrics.totalIgualasVal.toLocaleString('es-MX')} MXN
        * Valor de Cargos Extra: $ ${data.metrics.totalExtrasVal.toLocaleString('es-MX')} MXN
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

    res.json({ text: response.text?.trim() || 'No se pudo generar el análisis en este momento.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/analyze-executive:', error);
    res.status(500).json({ error: message });
  }
});

// 8. Leader Performance Analysis
app.post('/api/gemini/analyze-leader', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    const ai = getGeminiClient();

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
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text?.trim() || 'No se pudo generar el análisis en este momento.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la solicitud';
    console.error('Error in /api/gemini/analyze-leader:', error);
    res.status(500).json({ error: message });
  }
});

// Vite middleware configuration for development & static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
