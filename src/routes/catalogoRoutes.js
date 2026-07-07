// backend/src/routes/catalogoRoutes.js
import { Router } from 'express';
import { descargarCatalogo, entidades, municipios, catalogoJson } from '../controllers/municipiosController.js';

const router = Router();
// Descarga publica: no requiere autenticacion, es informacion abierta.
router.get('/municipios/descarga', descargarCatalogo);
router.get('/estados', entidades);
router.get('/municipios', municipios);
router.get('/municipios/todos', catalogoJson);
export default router;
