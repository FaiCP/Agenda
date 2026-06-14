// Predicción de abandono (Fase 2.4): score heurístico 0-100 por cliente.
// Sin IA externa: reglas explicables a partir del historial de citas.

export interface ClientRiskStats {
  client_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  client_since: string;
  completed: number;
  no_shows: number;
  cancelled: number;
  first_visit: string | null;
  last_visit: string | null;
  next_appointment: string | null;
}

export type RiskLevel = "alto" | "medio" | "bajo";

export interface ClientRisk {
  clientId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  score: number;
  level: RiskLevel;
  reasons: string[];
  suggestion: string;
  daysSinceLastVisit: number | null;
  hasUpcoming: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(from).getTime()) / DAY_MS);
}

export function computeClientRisk(
  stats: ClientRiskStats,
  clientLabel: string,
  now = new Date()
): ClientRisk {
  let score = 0;
  const reasons: string[] = [];
  const hasUpcoming = Boolean(stats.next_appointment);
  const totalScheduled = stats.completed + stats.no_shows + stats.cancelled;

  const daysSinceLastVisit = stats.last_visit
    ? daysBetween(stats.last_visit, now)
    : null;

  if (stats.completed === 0) {
    // Nunca llegó a una cita completada
    if (stats.no_shows > 0) {
      score += 55;
      reasons.push(
        stats.no_shows === 1
          ? "No asistió a su única cita agendada"
          : `No asistió a ${stats.no_shows} citas agendadas`
      );
    } else if (stats.cancelled > 0 && !hasUpcoming) {
      score += 40;
      reasons.push("Canceló y no volvió a agendar");
    } else if (!hasUpcoming && daysBetween(stats.client_since, now) > 30) {
      score += 30;
      reasons.push("Registrado hace más de un mes sin ninguna cita");
    }
  } else {
    // Frecuencia esperada de visita: intervalo promedio entre la primera y
    // la última cita completada; clientes de una sola visita usan 60 días.
    let expectedInterval = 60;
    if (stats.completed >= 2 && stats.first_visit && stats.last_visit) {
      const span = daysBetween(stats.first_visit, new Date(stats.last_visit));
      expectedInterval = Math.min(
        120,
        Math.max(14, Math.round(span / (stats.completed - 1)))
      );
    }

    if (daysSinceLastVisit !== null && !hasUpcoming) {
      const overdue = daysSinceLastVisit / expectedInterval;
      if (overdue >= 2) {
        score += 45;
        reasons.push(
          `Sin visitas hace ${daysSinceLastVisit} días (más del doble de su frecuencia habitual)`
        );
      } else if (overdue >= 1.3) {
        score += 25;
        reasons.push(
          `Sin visitas hace ${daysSinceLastVisit} días (por encima de su frecuencia habitual)`
        );
      }
    }

    if (stats.completed === 1 && daysSinceLastVisit !== null && daysSinceLastVisit > 45 && !hasUpcoming) {
      score += 20;
      reasons.push("Vino una sola vez y no regresó");
    }
  }

  if (totalScheduled > 0) {
    const noShowRate = stats.no_shows / totalScheduled;
    if (stats.completed > 0 && noShowRate >= 0.3) {
      score += 25;
      reasons.push(`Alta tasa de inasistencias (${stats.no_shows} de ${totalScheduled} citas)`);
    } else if (stats.completed > 0 && noShowRate >= 0.15) {
      score += 15;
      reasons.push(`Inasistencias frecuentes (${stats.no_shows} de ${totalScheduled} citas)`);
    }

    const cancelRate = stats.cancelled / totalScheduled;
    if (cancelRate >= 0.3) {
      score += 15;
      reasons.push(`Cancela con frecuencia (${stats.cancelled} de ${totalScheduled} citas)`);
    }
  }

  if (hasUpcoming) {
    score = Math.max(0, score - 40);
  }

  score = Math.min(100, score);
  const level: RiskLevel = score >= 60 ? "alto" : score >= 35 ? "medio" : "bajo";

  let suggestion = "";
  if (level !== "bajo") {
    if (stats.no_shows > 0 && stats.no_shows >= stats.cancelled) {
      suggestion = `Confirmar la próxima cita por teléfono o WhatsApp un día antes; considerar recordatorios adicionales.`;
    } else if (stats.completed === 0) {
      suggestion = `Contactar para ofrecer una primera cita; preguntar si prefiere otro horario.`;
    } else {
      suggestion = `Escribir al ${clientLabel} para agendar una cita de control o seguimiento.`;
    }
  }

  return {
    clientId: stats.client_id,
    fullName: stats.full_name,
    phone: stats.phone,
    email: stats.email,
    score,
    level,
    reasons,
    suggestion,
    daysSinceLastVisit,
    hasUpcoming,
  };
}

/** Calcula y ordena los clientes en riesgo (medio y alto) de mayor a menor. */
export function rankClientRisks(
  stats: ClientRiskStats[],
  clientLabel: string,
  now = new Date()
): ClientRisk[] {
  return stats
    .map((s) => computeClientRisk(s, clientLabel, now))
    .filter((r) => r.level !== "bajo")
    .sort((a, b) => b.score - a.score);
}
