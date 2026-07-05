// backend/src/utils/csv.js
// Utilidad minima para convertir filas (arreglo de objetos) a texto CSV.

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  }
  return lines.join('\n');
}
