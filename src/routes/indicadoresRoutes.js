// backend/src/routes/indicadoresRoutes.js
import { Router } from 'express';
import { listar, datosMapa } from '../controllers/indicadoresController.js';

const router = Router();
router.get('/', listar);
router.get('/:tabla', datosMapa);
export default router;
