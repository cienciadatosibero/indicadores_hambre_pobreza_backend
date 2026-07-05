// backend/src/models/municipioModel.js
import { pool } from '../config/db.js';

// Lista entidades distintas (clave + nombre) para poblar filtros.
export async function listEntidades() {
  const [rows] = await pool.query(
    `SELECT cve_ent, nom_ent
       FROM catalogo_municipios
      GROUP BY cve_ent, nom_ent
      ORDER BY cve_ent ASC`
  );
  return rows;
}

// Devuelve el catalogo completo (para descarga como CSV).
export async function listCatalogoCompleto() {
  const [rows] = await pool.query(
    `SELECT cve_ent, nom_ent, cve_mun, nom_mun, cve_geo
       FROM catalogo_municipios
      ORDER BY cve_ent ASC, cve_mun ASC`
  );
  return rows;
}
export async function listMunicipios({ cveEnt, q, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];

  if (cveEnt) {
    where.push('cve_ent = ?');
    params.push(Number(cveEnt));
  }
  if (q) {
    where.push('(nom_mun LIKE ? OR nom_ent LIKE ? OR cve_geo LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM catalogo_municipios ${whereSql}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT id, cve_ent, nom_ent, cve_mun, nom_mun, cve_geo
       FROM catalogo_municipios
       ${whereSql}
      ORDER BY cve_ent ASC, cve_mun ASC
      LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  return { total, rows };
}
