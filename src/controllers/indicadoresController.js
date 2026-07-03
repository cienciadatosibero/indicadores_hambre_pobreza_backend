// backend/src/controllers/indicadoresController.js
import {
  listIndicadores,
  getIndicador,
  upsertIndicador,
  getDatosIndicador,
} from '../models/indicadorModel.js';
import { buildScale, colorFor, COLOR_SCALE, NO_DATA_COLOR } from '../services/colorService.js';

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

// Guarda o actualiza la configuracion de visualizacion de un indicador.
export async function guardarConfig(req, res, next) {
  try {
    const data = await upsertIndicador(req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
