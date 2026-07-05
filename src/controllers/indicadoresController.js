// backend/src/controllers/indicadoresController.js
import {
  listIndicadores,
  getIndicador,
  upsertIndicador,
  getDatosIndicador,
  getAllRows,
} from '../models/indicadorModel.js';
import { buildScale, colorFor, COLOR_SCALE, NO_DATA_COLOR } from '../services/colorService.js';
import { toCSV } from '../utils/csv.js';

// Lista los indicadores publicos (para el catalogo del sitio).
export async function listar(req, res, next) {
  try {
    const all = await listIndicadores();
    const publicos = req.user ? all : all.filter((i) => i.publico === 1);
    res.json({ success: true, data: publicos });
  } catch (e) {
    next(e);
  }
}

// Devuelve los datos del indicador listos para pintar el mapa.
export async function datosMapa(req, res, next) {
  try {
    const ind = await getIndicador(req.params.tabla);
    if (!ind) return res.status(404).json({ success: false, message: 'Indicador no encontrado' });

    const filas = await getDatosIndicador(
      ind.nombre_tabla,
      ind.columna_geografica,
      ind.columna_valor
    );
    const valores = filas.map((f) => f.valor);
    const scale = buildScale(valores, ind.escala_invertida === 1);

    const datos = filas.map((f) => ({
      geo: f.geo,
      valor: f.valor === null ? null : Number(f.valor),
      color: colorFor(f.valor, scale),
    }));

    res.json({
      success: true,
      data: {
        indicador: ind,
        datos,
        escala: {
          min: scale.min,
          max: scale.max,
          breaks: scale.breaks,
          invertida: !!scale.invertida,
          colores: scale.invertida ? [...COLOR_SCALE].reverse() : COLOR_SCALE,
          sinDato: NO_DATA_COLOR,
        },
      },
    });
  } catch (e) {
    next(e);
  }
}

// Descarga los datos completos de un indicador publico en formato CSV.
export async function descargar(req, res, next) {
  try {
    const ind = await getIndicador(req.params.tabla);
    if (!ind) return res.status(404).json({ success: false, message: 'Indicador no encontrado' });
    if (!ind.publico && !req.user) {
      return res.status(403).json({ success: false, message: 'Indicador no disponible para descarga' });
    }

    const filas = await getAllRows(ind.nombre_tabla);
    const csv = toCSV(filas);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${ind.nombre_tabla}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) {
    next(e);
  }
}

// Guarda o actualiza la configuracion de visualizacion de un indicador.
export async function guardarConfig(req, res, next) {
  try {
    const data = await upsertIndicador(req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
