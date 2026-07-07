// backend/src/routes/adminRoutes.js
import { Router } from 'express';
import { authAdmin } from '../middlewares/authAdmin.js';
import { upload } from '../middlewares/upload.js';
import { preview, confirm, tablas, eliminarTabla } from '../controllers/uploadController.js';
import { guardarConfig, listar } from '../controllers/indicadoresController.js';
import { bandeja } from '../controllers/contactoController.js';
import { entidades, municipios, renombrarEstado } from '../controllers/municipiosController.js';
import { variablesGet, variablesPut } from '../controllers/variablesController.js';
const router = Router();
router.use(authAdmin);

router.post('/upload/preview', upload.single('archivo'), preview);
router.post('/upload/confirm', confirm);
router.get('/tablas', tablas);
router.delete('/tablas/:nombre', eliminarTabla);
router.get('/indicadores', listar);
router.post('/indicadores/config', guardarConfig);
router.get('/mensajes', bandeja);
router.get('/municipios/entidades', entidades);
router.get('/municipios', municipios);
router.put('/estados/:cve_ent', renombrarEstado);

router.get('/variables/:tabla', variablesGet);
router.put('/variables/:tabla', variablesPut);

export default router;