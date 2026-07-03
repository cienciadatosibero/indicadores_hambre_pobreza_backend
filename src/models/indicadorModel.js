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
  const sql = `SELECT ${escapeIdent(columnaGeo)} AS geo, ${escapeIdent(columnaValor)} AS valor
               FROM ${escapeIdent(nombreTabla)}`;
  const [rows] = await pool.query(sql);
  return rows;
}

// Trae todas las filas de una tabla (para analisis/graficas).
export async function getAllRows(nombreTabla) {
  const [rows] = await pool.query(`SELECT * FROM ${escapeIdent(nombreTabla)}`);
  return rows;
}
