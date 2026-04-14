
import {GoogleGenAI, Type} from "@google/genai";

import { Project } from '../types';

/**
 * Audits a project's ODT data against ISO 9001:2015 standards using AI.
 * Uses gemini-3-pro-preview as this is a complex reasoning task.
 */
export async function auditProjectISO(projectData: Partial<Project>) {
  // Always create a new instance right before use to ensure the latest API key is used
  const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Datos del proyecto: ${JSON.stringify(projectData)}`,
    config: {
      // Moved the audit instructions to systemInstruction as per best practices
      systemInstruction: "Analiza esta ODT (Orden de Trabajo) bajo la normativa ISO 9001:2015. Verifica trazabilidad, completitud de campos y posibles riesgos de calidad.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Puntaje de cumplimiento del 1 al 100" },
          findings: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Lista de hallazgos encontrados"
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Recomendaciones para cumplir la norma"
          },
          isoClause: { type: Type.STRING, description: "Cláusula ISO más relevante" }
        },
        required: ["score", "findings", "recommendations", "isoClause"]
      }
    }
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
  const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', // Flash is better for text restructuring and faster
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
    }
  });

  return response.text?.trim() || null;
}
