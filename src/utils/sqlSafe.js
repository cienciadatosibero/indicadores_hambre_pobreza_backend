// backend/src/utils/sqlSafe.js
// Utilidades para validar y escapar identificadores (nombres de tablas/columnas)
// y evitar inyeccion SQL en operaciones DDL/DML dinamicas.

const IDENT_REGEX = /^[a-z][a-z0-9_]{0,62}$/;
const MAX_LEN = 62; // limite seguro por debajo del maximo de MySQL (64)

// Hash corto y estable de una cadena (para desambiguar nombres truncados).
function shortHash(s) {
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  return (h1.toString(36) + h2.toString(36)).slice(0, 6);
}

// Convierte un texto arbitrario a un identificador seguro snake_case.
// Si el nombre excede el limite de MySQL, se recorta conservando el INICIO y
// el FINAL (donde suele ir el año, ej. _2020) y se intercala un hash del
// nombre completo, de modo que dos columnas largas distintas nunca colapsen
// al mismo identificador (evita el error "columna duplicada").
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
  // Si excede el limite, recorta conservando inicio + hash + final
  if (s.length > MAX_LEN) {
    const h = shortHash(s);
    // conservamos el sufijo final (hasta 6 chars, tipico "_2020")
    const tail = s.slice(-5);
    const head = s.slice(0, MAX_LEN - h.length - tail.length - 2);
    s = `${head}_${h}${tail}`;
  }
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
