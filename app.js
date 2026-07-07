// backend/src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import indicadoresRoutes from './routes/indicadoresRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import contactoRoutes from './routes/contactoRoutes.js';
import catalogoRoutes from './routes/catalogoRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();

// CORS: admite varios orígenes separados por coma en CORS_ORIGIN (o '*' para todos)
const ORIGENES = (process.env.CORS_ORIGIN || '*')
  .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);              // curl, same-origin, health checks
    if (ORIGENES.includes('*')) return cb(null, true);
    const limpio = origin.replace(/\/+$/, '');
    return cb(null, ORIGENES.includes(limpio));
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ success: true, data: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/indicadores', indicadoresRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
