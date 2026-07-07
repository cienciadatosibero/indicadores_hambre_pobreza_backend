// backend/src/models/municipioModel.js
import { pool } from '../config/db.js';

export async function listEntidades() {
  const [rows] = await pool.query('SELECT cve_ent, nom_ent FROM estados ORDER BY nom_ent');
  return rows;
}

export async function listMunicipios({ cveEnt = null, q = null, limit = 100, offset = 0 }) {
  const cond = []; const params = [];
  if (cveEnt) { cond.push('m.cve_ent = ?'); params.push(cveEnt); }
  if (q) { cond.push('m.nom_mun LIKE ?'); params.push(`%${q}%`); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [rows] = await pool.query(
    `SELECT m.cve_ent, e.nom_ent, m.cve_mun, m.nom_mun, m.cve_geo
       FROM municipios m JOIN estados e ON e.cve_ent = m.cve_ent
       ${where} ORDER BY m.cve_ent, m.cve_mun LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

// Catalogo completo (CSV de descarga y mapa de nombres para el frontend).
export async function listCatalogoCompleto() {
  const [rows] = await pool.query(
    `SELECT m.cve_ent, e.nom_ent, m.cve_mun, m.nom_mun, m.cve_geo
       FROM municipios m JOIN estados e ON e.cve_ent = m.cve_ent
      ORDER BY m.cve_ent, m.cve_mun`
  );
  return rows;
}

export async function updateEstado(cveEnt, nomEnt) {
  await pool.query('UPDATE estados SET nom_ent = ? WHERE cve_ent = ?', [nomEnt, cveEnt]);
}
