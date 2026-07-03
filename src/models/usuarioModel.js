// backend/src/models/usuarioModel.js
import { pool } from '../config/db.js';

export async function findByUsername(usuario) {
  const [rows] = await pool.query(
    'SELECT * FROM usuarios WHERE usuario = ? LIMIT 1',
    [usuario]
  );
  return rows[0] || null;
}
