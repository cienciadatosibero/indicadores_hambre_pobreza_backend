// backend/src/controllers/contactoController.js
import { crearMensaje, listarMensajes } from '../models/contactoModel.js';

export async function enviar(req, res, next) {
  try {
    const { nombre, correo, asunto, mensaje } = req.body;
    if (!nombre || !correo || !mensaje) {
      return res.status(400).json({ success: false, message: 'Nombre, correo y mensaje son obligatorios' });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
    if (!emailOk) {
      return res.status(400).json({ success: false, message: 'Correo invalido' });
    }
    const data = await crearMensaje({ nombre, correo, asunto: asunto || '(sin asunto)', mensaje });
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function bandeja(req, res, next) {
  try {
    const data = await listarMensajes();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
