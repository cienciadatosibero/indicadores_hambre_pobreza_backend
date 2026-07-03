// backend/src/controllers/uploadController.js
import fs from 'fs';
import { parseFile, inferTypes } from '../services/excelService.js';
import { applyUpload, listDynamicTables, dropTable } from '../services/schemaService.js';
import { isValidIdentifier } from '../utils/sqlSafe.js';

// Paso 1: vista previa. Lee el archivo, devuelve columnas con tipo sugerido,
// muestra de filas y el nombre de tabla sugerido. NO toca la base.
export async function preview(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibio archivo' });
    }
    const { columnas, filas, tablaSugerida } = parseFile(req.file.path, req.file.originalname);
    const columnasConTipo = inferTypes(columnas, filas);

    res.json({
      success: true,
      data: {
        archivoTmp: req.file.filename, // referencia para confirmar despues
        tablaSugerida,
        columnas: columnasConTipo, // { original, safe, tipoSugerido }
        totalFilas: filas.length,
        muestra: filas.slice(0, 8),
      },
    });
  } catch (e) {
    if (req.file) fs.existsSync(req.file.path) && fs.unlinkSync(req.file.path);
    next(e);
  }
}

// Paso 2: confirmar. El admin envia el nombre de tabla, los tipos elegidos por
// columna y cual es el id. Aqui se crea/fusiona la tabla.
export async function confirm(req, res, next) {
  const path = await import('path');
  const url = await import('url');
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  let filePath = null;
  try {
    const { archivoTmp, tabla, columnas } = req.body;
    // columnas: [{ safe, original, tipo, esId }]
    if (!archivoTmp || !tabla || !Array.isArray(columnas) || !columnas.length) {
      return res.status(400).json({ success: false, message: 'Datos incompletos' });
    }
    if (!isValidIdentifier(tabla)) {
      return res.status(400).json({ success: false, message: 'Nombre de tabla invalido' });
    }
    if (!columnas.some((c) => c.esId)) {
      return res.status(400).json({ success: false, message: 'Debes marcar una columna como id' });
    }

    filePath = path.join(uploadsDir, archivoTmp);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ success: false, message: 'Archivo temporal no encontrado, vuelve a subirlo' });
    }

    // Re-parsear el archivo para obtener las filas con los nombres safe.
    const originalName = archivoTmp.split('-').slice(2).join('-') || archivoTmp;
    const { filas } = parseFile(filePath, originalName);

    const columnasDef = columnas.map((c) => ({
      safe: c.safe,
      tipo: c.tipo,
      esId: !!c.esId,
    }));

    const resumen = await applyUpload({ tabla, columnasDef, filas });
    res.json({ success: true, data: resumen });
  } catch (e) {
    next(e);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }
}

export async function tablas(req, res, next) {
  try {
    const data = await listDynamicTables();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function eliminarTabla(req, res, next) {
  try {
    const data = await dropTable(req.params.nombre);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
