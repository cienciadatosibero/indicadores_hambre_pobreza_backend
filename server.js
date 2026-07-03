// backend/server.js
import app from './src/app.js';
import { testConnection } from './src/config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await testConnection();
    console.log('Conexion a MySQL establecida');
  } catch (e) {
    console.error('No se pudo conectar a MySQL:', e.message);
    console.error('Revisa tu archivo .env y que la base de datos exista.');
  }
  app.listen(PORT, () => {
    console.log(`Servidor backend en http://localhost:${PORT}`);
  });
})();
