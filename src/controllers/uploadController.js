// backend/src/controllers/uploadController.js
import fs from 'fs';
import { parseFile, inferTypes } from '../services/excelService.js';
import { saveEtiquetas, upsertIndicador } from '../models/indicadorModel.js';
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

    // El nombre guardado es "{timestamp}-{random}-{nombreOriginal}".
    // Recuperamos el nombre original quitando los dos primeros segmentos,
    // conservando cualquier guion que tuviera el nombre real y su extension.
    const partes = archivoTmp.split('-');
    const originalName = partes.length > 2 ? partes.slice(2).join('-') : archivoTmp;
    const { filas } = parseFile(filePath, originalName);

    const columnasDef = columnas.map((c) => ({
      safe: c.safe,
      original: c.original,
      etiqueta: c.etiqueta || c.original || c.safe,
      tipo: c.tipo,
      esId: !!c.esId,
    }));

    // Estructura estandar: si el archivo trae CVE_ENT y CVE_MUN pero no cve_geo,
    // se genera automaticamente (2 digitos + 3 digitos) y se usa como clave primaria.
    const tieneGeo = columnasDef.some((c) => c.safe === 'cve_geo');
    const colEnt = columnasDef.find((c) => c.safe === 'cve_ent');
    const colMun = columnasDef.find((c) => c.safe === 'cve_mun');
    if (!tieneGeo && colEnt && colMun) {
      for (const f of filas) {
        const e = String(parseInt(f[colEnt.safe], 10)).padStart(2, '0');
        const m = String(parseInt(f[colMun.safe], 10)).padStart(3, '0');
        f.cve_geo = e + m;
      }
      columnasDef.forEach((c) => { c.esId = false; });
      columnasDef.unshift({ original: 'cve_geo', safe: 'cve_geo', tipo: 'VARCHAR', esId: true });
    }

    const resumen = await applyUpload({ tabla, columnasDef, filas });

    // Guarda etiquetas legibles a partir de los encabezados originales del archivo.
    try {
      const etiquetasAGuardar = columnasDef.map((c) => ({
        columna: c.safe,
        etiqueta: c.etiqueta || String(c.original || c.safe).replace(/_/g, ' '),
        escala_invertida: c.colores ? 0 : (c.escala_invertida === undefined ? null : c.escala_invertida),
        colores: c.colores || null,
      }));
      if (!columnasDef.some((c) => c.safe === 'cve_geo')) {
        etiquetasAGuardar.push({ columna: 'cve_geo', etiqueta: 'Clave geografica' });
      }
      await saveEtiquetas(tabla, etiquetasAGuardar);
    } catch { /* el diccionario es opcional */ }

    // Crea/actualiza la tarjeta del indicador automaticamente con la config
    // que el usuario definio al cargar (nombre, descripcion, variable, colores).
    try {
      const meta = req.body.meta || {};
      const geoCol = columnasDef.some((c) => c.safe === 'cve_geo') ? 'cve_geo'
        : (colEnt ? 'cve_ent' : columnasDef[0].safe);
      // variable por defecto para el mapa: la elegida, o la primera numerica no-clave
      const claves = ['cve_geo', 'cve_ent', 'cve_mun'];
      const primeraNumerica = columnasDef.find(
        (c) => !claves.includes(c.safe) && ['INT', 'DECIMAL'].includes(c.tipo)
      );
      const columnaValor = meta.columna_valor || (primeraNumerica ? primeraNumerica.safe : columnasDef[0].safe);
      await upsertIndicador({
        nombre_tabla: tabla,
        nombre_legible: meta.nombre_legible || tabla.replace(/_/g, ' '),
        descripcion: meta.descripcion || '',
        columna_geografica: geoCol,
        columna_valor: columnaValor,
        escala_invertida: meta.escala_invertida === undefined ? true : !!meta.escala_invertida,
        publico: meta.publico === undefined ? true : !!meta.publico,
      });
    } catch (e) {
      // Si falla la creacion de la tarjeta, la carga de datos ya fue exitosa.
      console.error('No se pudo crear la tarjeta del indicador:', e.message);
    }

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
