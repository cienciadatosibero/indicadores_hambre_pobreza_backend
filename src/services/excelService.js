// backend/src/services/excelService.js
import xlsx from 'xlsx';
import path from 'path';
import { toSafeIdentifier } from '../utils/sqlSafe.js';

// Lee un archivo .xlsx/.xls/.csv y devuelve:
// { columnas: [{ original, safe }], filas: [ {col: valor} ], tablaSugerida }
export function parseFile(filePath, originalName) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];

  // header:1 -> arreglo de arreglos, conservando la primera fila como encabezados
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  if (!rows.length) {
    throw new Error('El archivo esta vacio');
  }

  const headerRow = rows[0].filter((h) => h !== null && h !== undefined && String(h).trim() !== '');
  if (!headerRow.length) {
    throw new Error('No se encontraron encabezados de columna en la primera fila');
  }

  const columnas = headerRow.map((h) => ({
    original: String(h).trim(),
    safe: toSafeIdentifier(h),
  }));

  // Detecta nombres safe duplicados o vacios
  const seen = new Set();
  for (const c of columnas) {
    if (!c.safe) throw new Error(`La columna "${c.original}" no produce un nombre valido`);
    if (seen.has(c.safe)) throw new Error(`Columna duplicada tras normalizar: ${c.safe}`);
    seen.add(c.safe);
  }

  const filas = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((v) => v === null || v === undefined || String(v).trim() === '')) continue;
    const obj = {};
    columnas.forEach((c, idx) => {
      obj[c.safe] = r[idx] === undefined ? null : r[idx];
    });
    filas.push(obj);
  }

  // Nombre de tabla = nombre del archivo sin extension
  const base = path.basename(originalName, path.extname(originalName));
  const tablaSugerida = toSafeIdentifier(base);

  return { columnas, filas, tablaSugerida };
}

// Infiere un tipo SQL sugerido por columna observando los valores.
export function inferTypes(columnas, filas) {
  return columnas.map((c) => {
    let tipo = 'INT';
    let vistoNumero = false;
    let vistoDecimal = false;
    let vistoTexto = false;
    let vistoFecha = false;

    for (const fila of filas) {
      const v = fila[c.safe];
      if (v === null || v === undefined || v === '') continue;
      if (v instanceof Date) { vistoFecha = true; continue; }
      if (typeof v === 'number') {
        vistoNumero = true;
        if (!Number.isInteger(v)) vistoDecimal = true;
        continue;
      }
      const s = String(v).trim();
      if (/^-?\d+$/.test(s)) { vistoNumero = true; continue; }
      if (/^-?\d*\.\d+$/.test(s)) { vistoNumero = true; vistoDecimal = true; continue; }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) { vistoFecha = true; continue; }
      vistoTexto = true;
    }

    if (vistoTexto) tipo = 'VARCHAR';
    else if (vistoFecha && !vistoNumero) tipo = 'DATE';
    else if (vistoDecimal) tipo = 'DECIMAL';
    else if (vistoNumero) tipo = 'INT';
    else tipo = 'VARCHAR';

    return { ...c, tipoSugerido: tipo };
  });
}
