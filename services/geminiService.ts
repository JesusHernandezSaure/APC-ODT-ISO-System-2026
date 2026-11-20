import { Project } from "../types";

/**
 * Audits a project's ODT data against ISO 9001:2015 standards using AI on the server.
 */
export async function auditProjectISO(projectData: Partial<Project>) {
  try {
    const res = await fetch('/api/gemini/audit-iso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectData }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Error al auditar ISO 9001');
    }

    const data = await res.json();
    return data.result || null;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return null;
  }
}

/**
 * Structures a project brief using AI on the server.
 */
export async function structureBrief(htmlContent: string) {
  try {
    const res = await fetch('/api/gemini/structure-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ htmlContent }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Error al estructurar brief');
    }

    const data = await res.json();
    return data.html || null;
  } catch (e) {
    console.error("Failed to structure brief", e);
    return null;
  }
}

/**
 * Generates an executive performance and ROI analysis for a selected account executive (or team) via the server.
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
  try {
    const res = await fetch('/api/gemini/analyze-executive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Error en análisis ejecutivo');
    }

    const json = await res.json();
    return json.text || "No se pudo generar el análisis en este momento.";
  } catch (e) {
    console.error("Failed to analyze executive performance", e);
    return "No se pudo generar el análisis en este momento.";
  }
}

/**
 * Generates an area performance analysis for a selected leader or team via the server.
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
  try {
    const res = await fetch('/api/gemini/analyze-leader', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Error en análisis de líder');
    }

    const json = await res.json();
    return json.text || "No se pudo generar el análisis en este momento.";
  } catch (e) {
    console.error("Failed to analyze leader performance", e);
    return "No se pudo generar el análisis en este momento.";
  }
}
