import type { Enums } from "@/lib/supabase/database.types";

export type Vertical = Enums<"vertical_type">;

export interface VerticalConfig {
  label: string;
  icon: string;
  clientLabel: string;
  clientLabelPlural: string;
  recordLabel: string;
  exampleServices: { name: string; duration_minutes: number; price: number }[];
}

export const VERTICALS: Record<Vertical, VerticalConfig> = {
  medical: {
    label: "Médico / Clínica",
    icon: "🩺",
    clientLabel: "paciente",
    clientLabelPlural: "pacientes",
    recordLabel: "Historia clínica",
    exampleServices: [
      { name: "Consulta general", duration_minutes: 30, price: 25 },
      { name: "Consulta de control", duration_minutes: 20, price: 15 },
    ],
  },
  legal: {
    label: "Abogado / Estudio jurídico",
    icon: "⚖️",
    clientLabel: "cliente",
    clientLabelPlural: "clientes",
    recordLabel: "Expediente del caso",
    exampleServices: [
      { name: "Consulta legal", duration_minutes: 60, price: 40 },
      { name: "Revisión de documentos", duration_minutes: 45, price: 30 },
    ],
  },
  psychology: {
    label: "Psicología / Terapia",
    icon: "🧠",
    clientLabel: "paciente",
    clientLabelPlural: "pacientes",
    recordLabel: "Historia psicológica",
    exampleServices: [
      { name: "Sesión de terapia", duration_minutes: 50, price: 35 },
      { name: "Primera evaluación", duration_minutes: 60, price: 40 },
    ],
  },
  dental: {
    label: "Odontología",
    icon: "🦷",
    clientLabel: "paciente",
    clientLabelPlural: "pacientes",
    recordLabel: "Ficha odontológica",
    exampleServices: [
      { name: "Consulta odontológica", duration_minutes: 30, price: 20 },
      { name: "Limpieza dental", duration_minutes: 45, price: 35 },
    ],
  },
  aesthetics: {
    label: "Estética / Spa",
    icon: "💆",
    clientLabel: "cliente",
    clientLabelPlural: "clientes",
    recordLabel: "Ficha de tratamiento",
    exampleServices: [
      { name: "Limpieza facial", duration_minutes: 60, price: 30 },
      { name: "Masaje relajante", duration_minutes: 60, price: 35 },
    ],
  },
  generic: {
    label: "Otro servicio profesional",
    icon: "📋",
    clientLabel: "cliente",
    clientLabelPlural: "clientes",
    recordLabel: "Expediente",
    exampleServices: [
      { name: "Cita estándar", duration_minutes: 30, price: 20 },
    ],
  },
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
