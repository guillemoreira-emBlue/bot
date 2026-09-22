/**
 * Definición única de las opciones de cada desplegable de auditoría.
 * Vive acá (y no repartida en el frontend) para que el front y el back
 * validen siempre contra la misma lista. Si mañana agregan un tipo de
 * error nuevo, se agrega UNA vez acá.
 *
 * "value": lo que se guarda. "label": lo que ve el auditor.
 * Todos los campos aceptan además "" (Pendiente / sin auditar todavía).
 */

const YES_NO = [
  { value: '', label: 'Pendiente' },
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

const ERROR_TYPE = [
  { value: '', label: 'Pendiente' },
  { value: 'TU', label: 'TU (sin error)' },
  { value: 'Error 1', label: 'Error 1' },
  { value: 'Error 2', label: 'Error 2' },
  { value: 'Error 3', label: 'Error 3' },
  { value: 'Error en plataforma', label: 'Error en plataforma' },
];

const COMPLETION = [
  { value: '', label: 'Pendiente' },
  { value: 'Retenido', label: 'Retenido' },
  { value: 'Handover - pidío humano', label: 'Handover - pidió humano' },
  { value: 'Handover - no pudo solucionar', label: 'Handover - no pudo solucionar' },
  { value: 'perdido', label: 'Perdido' },
];

const RETAINED = [
  { value: '', label: 'Pendiente' },
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
];

const ERROR_SPEC = [
  { value: '', label: 'Pendiente' },
  { value: 'Sin error', label: 'Sin error' },
  { value: 'Interpretación', label: 'Interpretación' },
  { value: 'Consulta Incompleta', label: 'Consulta incompleta' },
  { value: 'Error de concepto', label: 'Error de concepto' },
  { value: 'Sin info en el HC', label: 'Sin info en el HC' },
  { value: 'No lee imagenes', label: 'No lee imágenes' },
  { value: 'Cliente no completa info', label: 'Cliente no completa info' },
  { value: 'Bot no responde', label: 'Bot no responde' },
  { value: 'Fuera de horario', label: 'Fuera de horario' },
];

const IMPROVED = [
  { value: '', label: 'Pendiente' },
  { value: 'respuesta correcta', label: 'Respuesta correcta (no requería mejora)' },
  { value: 'si', label: 'Sí, se mejoró' },
  { value: 'no', label: 'No, falta mejorar' },
];

const AUDIT_OK = [
  { value: '', label: 'Pendiente' },
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

// Campos de auditoría manual: los únicos que se pueden editar desde la UI
// de auditoría y los únicos que persiste server/lib/auditStore.js.
const AUDIT_FIELDS = {
  hadInfo: { label: 'Tenía la info para responder?', type: 'select', options: YES_NO },
  answeredCorrectly: { label: 'Respondió correctamente?', type: 'select', options: YES_NO },
  errorType: { label: 'Tipo de Error', type: 'select', options: ERROR_TYPE },
  completion: { label: 'Finalización', type: 'select', options: COMPLETION },
  retained: { label: 'Retenido', type: 'select', options: RETAINED },
  errorSpec: { label: 'Especificación del error', type: 'select', options: ERROR_SPEC },
  improved: { label: 'Improved', type: 'select', options: IMPROVED },
  notes: { label: 'Notas', type: 'text' },
  auditOk: { label: 'Audit ok?', type: 'select', options: AUDIT_OK },
  comments: { label: 'Coments', type: 'text' },
};

module.exports = { AUDIT_FIELDS };
