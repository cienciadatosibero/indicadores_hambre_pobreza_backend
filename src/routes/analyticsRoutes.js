// backend/src/routes/analyticsRoutes.js
import { Router } from 'express';
import { analizar } from '../controllers/analyticsController.js';

const router = Router();
router.get('/:tabla', analizar);
export default router;
