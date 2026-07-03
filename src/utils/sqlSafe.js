// backend/src/utils/sqlSafe.js
// Utilidades para validar y escapar identificadores (nombres de tablas/columnas)
// y evitar inyeccion SQL en operaciones DDL/DML dinamicas.

const IDENT_REGEX = /^[a-z][a-z0-9_]{0,62}$/;

// Convierte un texto arbitrario a un identificador seguro snake_case.
export function toSafeIdentifier(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim().toLowerCase();
  // Reemplaza acentos comunes del espanol
  s = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n');
  // Espacios y caracteres no validos -> guion bajo
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  // No puede empezar por numero
  if (/^[0-9]/.test(s)) s = 't_' + s;
  // Limita longitud
  s = s.slice(0, 60);
  return s;
}

// Valida que un identificador ya sanitizado cumpla el formato estricto.
export function isValidIdentifier(id) {
  return typeof id === 'string' && IDENT_REGEX.test(id);
}

// Escapa un identificador con backticks para usarlo en SQL.
// Lanza error si no es valido (defensa en profundidad).
export function escapeIdent(id) {
  if (!isValidIdentifier(id)) {
    throw new Error(`Identificador SQL invalido: ${id}`);
  }
  return '`' + id + '`';
}

// Tipos SQL permitidos que el admin puede elegir por columna.
export const ALLOWED_SQL_TYPES = {
  INT: 'INT',
  DECIMAL: 'DECIMAL(18,6)',
  VARCHAR: 'VARCHAR(255)',
  TEXT: 'TEXT',
  DATE: 'DATE',
  BOOLEAN: 'TINYINT(1)',
};

export function resolveSqlType(type) {
  const key = String(type || '').toUpperCase();
  if (!ALLOWED_SQL_TYPES[key]) {
    throw new Error(`Tipo de dato no permitido: ${type}`);
  }
  return ALLOWED_SQL_TYPES[key];
}
