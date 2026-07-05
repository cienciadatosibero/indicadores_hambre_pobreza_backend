// backend/src/routes/catalogoRoutes.js
import { Router } from 'express';
import { descargarCatalogo } from '../controllers/municipiosController.js';

const router = Router();
// Descarga publica: no requiere autenticacion, es informacion abierta.
router.get('/municipios/descarga', descargarCatalogo);
export default router;
