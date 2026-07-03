// backend/src/models/contactoModel.js
import { pool } from '../config/db.js';

export async function crearMensaje({ nombre, correo, asunto, mensaje }) {
  const [res] = await pool.query(
    'INSERT INTO mensajes_contacto (nombre, correo, asunto, mensaje) VALUES (?, ?, ?, ?)',
    [nombre, correo, asunto, mensaje]
  );
  return { id: res.insertId };
}

export async function listarMensajes() {
  const [rows] = await pool.query(
    'SELECT * FROM mensajes_contacto ORDER BY created_at DESC'
  );
  return rows;
}
