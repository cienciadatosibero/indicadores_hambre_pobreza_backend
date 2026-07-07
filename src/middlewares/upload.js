// backend/src/middlewares/upload.js  (sin mkdir al importar; no truena en Vercel)
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uploadDir = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try { fs.mkdirSync(uploadDir, { recursive: true }); } catch { /* solo lectura: se ignora */ }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const allowedExt = ['.xlsx', '.xls', '.csv'];

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos .xlsx, .xls o .csv'));
  },
});
