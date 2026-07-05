// backend/src/controllers/municipiosController.js
import { listEntidades, listMunicipios, listCatalogoCompleto } from '../models/municipioModel.js';
import { toCSV } from '../utils/csv.js';

export async function entidades(req, res, next) {
  try {
    const data = await listEntidades();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function municipios(req, res, next) {
  try {
    const { entidad, q, limit, offset } = req.query;
    const lim = Math.min(Number(limit) || 100, 500);
    const off = Math.max(Number(offset) || 0, 0);
    const data = await listMunicipios({
      cveEnt: entidad ? Number(entidad) : null,
      q: q ? String(q).trim() : null,
      limit: lim,
      offset: off,
    });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

// Descarga publica del catalogo completo de entidades y municipios (CSV).
export async function descargarCatalogo(req, res, next) {
  try {
    const filas = await listCatalogoCompleto();
    const csv = toCSV(filas);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="catalogo_municipios.csv"');
    res.send('\uFEFF' + csv);
  } catch (e) {
    next(e);
  }
}
