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

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
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
