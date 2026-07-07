// backend/src/controllers/indicadoresController.js
import {
  listIndicadores,
  getIndicador,
  upsertIndicador,
  getDatosIndicador,
  getAllRows,
  getEtiquetas,
  getVariablesConfig,
  saveEtiquetas,
} from '../models/indicadorModel.js';
import { buildScale, colorFor, COLOR_SCALE, NO_DATA_COLOR } from '../services/colorService.js';
import { getColumns } from '../services/schemaService.js';
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

    // Variable a mapear: la configurada por defecto, o la que pida el cliente
    // via ?variable= (validada contra las columnas reales de la tabla).
    let columnaValor = ind.columna_valor;
    if (req.query.variable) {
      const cols = await getColumns(ind.nombre_tabla);
      if (!cols.includes(req.query.variable)) {
        return res.status(400).json({ success: false, message: `La variable "${req.query.variable}" no existe en la tabla` });
      }
      columnaValor = req.query.variable;
    }

    const filas = await getDatosIndicador(
      ind.nombre_tabla,
      ind.columna_geografica,
      columnaValor
    );
    const valores = filas.map((f) => f.valor);
    // Direccion de colores: primero la configuracion de la variable, luego la del indicador.
    let invertida = ind.escala_invertida === 1;
    const cfgVars = await getVariablesConfig(ind.nombre_tabla);
    const cfg = cfgVars.find((v) => v.columna === columnaValor);
    if (cfg && cfg.escala_invertida !== null && cfg.escala_invertida !== undefined) {
      invertida = cfg.escala_invertida === 1;
    }
    // Paleta personalizada por variable (5 colores de menor a mayor), si existe.
    let paleta = COLOR_SCALE;
    if (cfg && cfg.colores) {
      const arr = String(cfg.colores).split(',').map((c) => c.trim()).filter(Boolean);
      if (arr.length === 5) paleta = arr;
    }
    const scale = buildScale(valores, invertida);
    scale.palette = paleta;

    const datos = filas.map((f) => ({
      geo: f.geo,
      valor: f.valor === null ? null : Number(f.valor),
      color: colorFor(f.valor, scale),
      nombre: f.nombre || null,
      estado: f.estado || null,
      cve_ent: f.cve_ent || null,
    }));

    const etiquetas = await getEtiquetas(ind.nombre_tabla);
    const coloresLeyenda = invertida ? [...paleta].reverse() : paleta;

    res.json({
      success: true,
      data: {
        indicador: ind,
        variable: columnaValor,
        etiquetas,
        datos,
        escala: {
          min: scale.min,
          max: scale.max,
          breaks: scale.breaks,
          invertida: !!scale.invertida,
          colores: coloresLeyenda,
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
    // Sincroniza la escala de colores de la variable de valor con el diccionario,
    // para que Indicadores y Variables compartan la misma configuracion.
    if (req.body.columna_valor && (req.body.colores || req.body.escala_invertida !== undefined)) {
      await saveEtiquetas(req.body.nombre_tabla, [{
        columna: req.body.columna_valor,
        etiqueta: (await getEtiquetas(req.body.nombre_tabla))[req.body.columna_valor]
          || req.body.columna_valor,
        // Con colores explicitos el orden ya es "menor -> mayor", sin inversion.
        escala_invertida: req.body.colores ? 0 : (req.body.escala_invertida === undefined ? null : req.body.escala_invertida),
        colores: req.body.colores || null,
      }]);
    }
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
