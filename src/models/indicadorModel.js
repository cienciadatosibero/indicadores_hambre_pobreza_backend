// backend/src/models/indicadorModel.js
import { pool } from '../config/db.js';
import { escapeIdent } from '../utils/sqlSafe.js';

export async function listIndicadores() {
  const [rows] = await pool.query(
    'SELECT * FROM indicadores ORDER BY nombre_legible ASC'
  );
  return rows;
}

export async function getIndicador(nombreTabla) {
  const [rows] = await pool.query(
    'SELECT * FROM indicadores WHERE nombre_tabla = ? LIMIT 1',
    [nombreTabla]
  );
  return rows[0] || null;
}

export async function upsertIndicador(data) {
  const {
    nombre_tabla,
    nombre_legible,
    descripcion,
    columna_geografica,
    columna_valor,
    escala_invertida,
    publico,
  } = data;

  await pool.query(
    `INSERT INTO indicadores
      (nombre_tabla, nombre_legible, descripcion, columna_geografica, columna_valor, escala_invertida, publico)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      nombre_legible = VALUES(nombre_legible),
      descripcion = VALUES(descripcion),
      columna_geografica = VALUES(columna_geografica),
      columna_valor = VALUES(columna_valor),
      escala_invertida = VALUES(escala_invertida),
      publico = VALUES(publico)`,
    [
      nombre_tabla,
      nombre_legible,
      descripcion || null,
      columna_geografica,
      columna_valor,
      escala_invertida ? 1 : 0,
      publico ? 1 : 0,
    ]
  );
  return getIndicador(nombre_tabla);
}

// Trae los datos crudos de la tabla del indicador (geografica + valor).
export async function getDatosIndicador(nombreTabla, columnaGeo, columnaValor) {
  // Une con el catalogo para traer nombre de municipio y estado (via cve_geo).
  const sql = `SELECT t.${escapeIdent(columnaGeo)} AS geo,
                      t.${escapeIdent(columnaValor)} AS valor,
                      m.nom_mun AS nombre, e.nom_ent AS estado, m.cve_ent
               FROM ${escapeIdent(nombreTabla)} t
               LEFT JOIN municipios m ON m.cve_geo = LPAD(t.${escapeIdent(columnaGeo)}, 5, '0')
               LEFT JOIN estados e ON e.cve_ent = m.cve_ent`;
  const [rows] = await pool.query(sql);
  return rows;
}

// Etiquetas legibles de columnas para una tabla (diccionario_variables).
export async function getEtiquetas(nombreTabla) {
  try {
    const [rows] = await pool.query(
      'SELECT columna, etiqueta FROM diccionario_variables WHERE nombre_tabla = ?',
      [nombreTabla]
    );
    return Object.fromEntries(rows.map((r) => [r.columna, r.etiqueta]));
  } catch {
    return {};
  }
}

// Guarda etiquetas (se llama al subir una tabla, con los encabezados originales).
export async function saveEtiquetas(nombreTabla, pares) {
  if (!pares.length) return;
  const values = pares.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const params = pares.flatMap((p) => [
    nombreTabla,
    p.columna,
    p.etiqueta,
    p.escala_invertida === undefined || p.escala_invertida === null ? null : (p.escala_invertida ? 1 : 0),
    p.colores ? (Array.isArray(p.colores) ? p.colores.join(',') : String(p.colores)) : null,
  ]);
  await pool.query(
    `INSERT INTO diccionario_variables (nombre_tabla, columna, etiqueta, escala_invertida, colores) VALUES ${values}
     ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta),
       escala_invertida = VALUES(escala_invertida),
       colores = VALUES(colores)`,
    params
  );
}

// Trae todas las filas de una tabla (para analisis/graficas).
export async function getAllRows(nombreTabla) {
  const [rows] = await pool.query(`SELECT * FROM ${escapeIdent(nombreTabla)}`);
  return rows;
}

// Configuracion completa por variable (etiqueta y direccion de colores).
export async function getVariablesConfig(nombreTabla) {
  try {
    const [rows] = await pool.query(
      'SELECT columna, etiqueta, escala_invertida, colores FROM diccionario_variables WHERE nombre_tabla = ?',
      [nombreTabla]
    );
    return rows;
  } catch { return []; }
}

export async function saveVariablesConfig(nombreTabla, variables) {
  if (!variables.length) return;
  const values = variables.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const params = variables.flatMap((v) => [
    nombreTabla,
    v.columna,
    v.etiqueta || v.columna,
    v.escala_invertida === null || v.escala_invertida === undefined ? null : (v.escala_invertida ? 1 : 0),
    v.colores ? (Array.isArray(v.colores) ? v.colores.join(',') : String(v.colores)) : null,
  ]);
  await pool.query(
    `INSERT INTO diccionario_variables (nombre_tabla, columna, etiqueta, escala_invertida, colores) VALUES ${values}
     ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta),
       escala_invertida = VALUES(escala_invertida),
       colores = VALUES(colores)`,
    params
  );
}
