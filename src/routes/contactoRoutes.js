// backend/src/routes/contactoRoutes.js
import { Router } from 'express';
import { enviar } from '../controllers/contactoController.js';

const router = Router();
router.post('/', enviar);
export default router;
