// backend/src/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findByUsername } from '../models/usuarioModel.js';

export async function login(req, res, next) {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ success: false, message: 'Usuario y contrasena requeridos' });
    }
    const user = await findByUsername(usuario);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas' });
    }
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );
    res.json({ success: true, data: { token, usuario: user.usuario, rol: user.rol } });
  } catch (e) {
    next(e);
  }
}
