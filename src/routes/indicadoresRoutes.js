// backend/src/routes/indicadoresRoutes.js
import { Router } from 'express';
import { listar, datosMapa, descargar } from '../controllers/indicadoresController.js';

const router = Router();
router.get('/', listar);
router.get('/:tabla/descarga', descargar);
router.get('/:tabla', datosMapa);
export default router;
