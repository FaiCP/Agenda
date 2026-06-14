import type { Vertical } from "./verticals";

export interface DocumentType {
  key: string;
  label: string;
  /** Guía que recibe la IA para estructurar el documento. */
  hint: string;
}

const CERTIFICADO: DocumentType = {
  key: "certificado",
  label: "Certificado de atención",
  hint: "Certificado formal que constata que la persona fue atendida en la fecha indicada, motivo general de la atención y, si se indica, días de reposo o recomendaciones. Inicia con 'CERTIFICADO' y redacta en tercera persona ('Certifico que...').",
};

const CONSENTIMIENTO: DocumentType = {
  key: "consentimiento",
  label: "Consentimiento informado",
  hint: "Consentimiento informado: descripción del procedimiento/tratamiento propuesto, beneficios esperados, riesgos y alternativas, derecho a retirar el consentimiento, y declaración de que el paciente/cliente recibió la información y acepta voluntariamente. Incluye espacio para nombre y cédula del firmante.",
};

export const DOCUMENT_TYPES: Record<Vertical, DocumentType[]> = {
  medical: [
    {
      key: "receta",
      label: "Receta médica",
      hint: "Receta médica: lista de medicamentos con nombre, concentración, dosis, frecuencia y duración (Rp/). Incluye indicaciones generales al final. Solo medicamentos mencionados en las indicaciones o el expediente.",
    },
    CERTIFICADO,
    CONSENTIMIENTO,
    {
      key: "interconsulta",
      label: "Hoja de interconsulta / referencia",
      hint: "Referencia a otro especialista: motivo de la referencia, resumen clínico relevante, diagnóstico presuntivo y qué se solicita al especialista.",
    },
  ],
  dental: [
    {
      key: "receta",
      label: "Receta odontológica",
      hint: "Receta: medicamentos con nombre, concentración, dosis, frecuencia y duración. Indicaciones post-tratamiento si aplican.",
    },
    {
      key: "presupuesto",
      label: "Presupuesto de tratamiento",
      hint: "Presupuesto: lista de procedimientos propuestos con descripción breve y precio en USD si se indica, condiciones de pago y vigencia del presupuesto.",
    },
    CONSENTIMIENTO,
    CERTIFICADO,
  ],
  psychology: [
    {
      key: "certificado_asistencia",
      label: "Certificado de asistencia",
      hint: "Certificado que constata asistencia a sesión/proceso psicológico en la fecha indicada, sin revelar contenido de las sesiones salvo que las indicaciones lo pidan. Redacta en tercera persona.",
    },
    {
      key: "informe",
      label: "Informe psicológico breve",
      hint: "Informe breve: motivo de consulta, proceso realizado, observaciones generales y recomendaciones. Lenguaje técnico pero comprensible, cuidando la confidencialidad.",
    },
    CONSENTIMIENTO,
  ],
  legal: [
    {
      key: "contrato_servicios",
      label: "Contrato de prestación de servicios",
      hint: "Contrato de prestación de servicios profesionales con cláusulas numeradas (PRIMERA, SEGUNDA...): comparecientes, objeto, honorarios y forma de pago, plazo, obligaciones de las partes, confidencialidad, terminación y jurisdicción (Ecuador).",
    },
    {
      key: "carta",
      label: "Carta / escrito formal",
      hint: "Carta o escrito formal según las indicaciones: destinatario, asunto, cuerpo argumentado y petición concreta.",
    },
    {
      key: "recibo_honorarios",
      label: "Recibo de honorarios",
      hint: "Recibo simple: constancia de recepción de honorarios profesionales con monto en USD (número y letras), concepto y fecha.",
    },
  ],
  aesthetics: [
    CONSENTIMIENTO,
    {
      key: "recomendaciones",
      label: "Recomendaciones post-tratamiento",
      hint: "Hoja de cuidados posteriores al tratamiento realizado: lista clara de cuidados, qué evitar, signos de alerta y cuándo contactar al profesional.",
    },
    CERTIFICADO,
  ],
  generic: [
    {
      key: "contrato_servicios",
      label: "Contrato de servicios",
      hint: "Contrato simple de prestación de servicios: partes, objeto, precio en USD, forma de pago, plazo y condiciones de cancelación.",
    },
    CERTIFICADO,
    {
      key: "carta",
      label: "Carta formal",
      hint: "Carta formal según las indicaciones: destinatario, asunto, cuerpo y cierre.",
    },
  ],
};
